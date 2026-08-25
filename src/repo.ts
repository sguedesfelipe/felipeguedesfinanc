import type { Firestore } from 'firebase-admin/firestore';
import { CategorizedTransaction, AccountLike } from './aggregate.js';

// Campos de data em CategorizedTransaction: o Firestore guarda Date como
// Timestamp nativamente na escrita, mas devolve um objeto Timestamp na
// leitura — precisam ser convertidos de volta pra Date pra bater com o tipo
// que o resto do codigo (classify/aggregate/reportHtml/reportSpreadsheet) ja
// espera.
const DATE_FIELDS = ['date', 'createdAt', 'updatedAt', 'dataConsiderada'] as const;

const FIRESTORE_BATCH_LIMIT = 450; // limite real do Firestore e 500 escritas/batch

function fromFirestoreTransaction(data: FirebaseFirestore.DocumentData): CategorizedTransaction {
  const out: Record<string, unknown> = { ...data };
  for (const field of DATE_FIELDS) {
    const value = data[field];
    out[field] = value?.toDate ? value.toDate() : value;
  }
  out.purchaseDate = data.purchaseDate?.toDate ? data.purchaseDate.toDate() : data.purchaseDate ?? null;
  return out as unknown as CategorizedTransaction;
}

export async function upsertTransactions(db: Firestore, transactions: CategorizedTransaction[]): Promise<void> {
  const collection = db.collection('transactions');

  // O refresh diario rebusca uma janela de 45 dias e reclassifica tudo do
  // zero — pra transacoes que ja existem no Firestore, "pendente" pode ja
  // ter sido revisado manualmente no dashboard (PATCH -> pendente:false).
  // Sem essa checagem, o upsert sobrescreveria isso com o valor recalculado
  // pela classificacao (que sempre aplica o corte de REVISADO_ATE) todo dia,
  // fazendo a mesma transacao voltar pra pendente pra sempre, mesmo revisada.
  // So transacoes genuinamente novas recebem o pendente calculado agora.
  const existingIds = new Set<string>();
  const refs = transactions.map((t) => collection.doc(t.transactionId));
  for (let i = 0; i < refs.length; i += FIRESTORE_BATCH_LIMIT) {
    const snaps = await db.getAll(...refs.slice(i, i + FIRESTORE_BATCH_LIMIT));
    for (const snap of snaps) {
      if (snap.exists) existingIds.add(snap.id);
    }
  }

  for (let i = 0; i < transactions.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const t of transactions.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      // notificadoWhatsapp fica de fora do upsert de proposito: classifyAndShapeTransactions
      // sempre gera esse campo como false (transacao "nova" do ponto de vista do Pluggy), e
      // como o refresh diario rebusca uma janela de 45 dias, um upsert normal reescreveria
      // false por cima de transacoes que ja foram marcadas como notificadas — o campo so muda
      // via markTransactionsNotified() abaixo, nunca aqui.
      const { notificadoWhatsapp, pendente, motivoClassificacao, ...rest } = t;
      const doc = collection.doc(t.transactionId);
      if (existingIds.has(t.transactionId)) {
        batch.set(doc, rest, { merge: true });
      } else {
        batch.set(doc, { ...rest, pendente, motivoClassificacao }, { merge: true });
      }
    }
    await batch.commit();
  }
}

// Marca transacoes como ja avisadas via WhatsApp, chamado so depois que
// sendDailyDigest() confirma que o envio deu certo (ver src/dailyDigest.ts).
export async function markTransactionsNotified(db: Firestore, transactionIds: string[]): Promise<void> {
  const collection = db.collection('transactions');
  for (let i = 0; i < transactionIds.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const id of transactionIds.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.update(collection.doc(id), { notificadoWhatsapp: true });
    }
    await batch.commit();
  }
}

export async function loadAllTransactions(db: Firestore): Promise<CategorizedTransaction[]> {
  const snap = await db.collection('transactions').get();
  return snap.docs.map((doc) => fromFirestoreTransaction(doc.data()));
}

export async function updateTransaction(
  db: Firestore,
  transactionId: string,
  patch: Partial<Pick<CategorizedTransaction, 'categoria' | 'subcategoria' | 'valido' | 'pendente'>>
): Promise<void> {
  await db.collection('transactions').doc(transactionId).update(patch);
}

export async function upsertAccounts(db: Firestore, accounts: AccountLike[]): Promise<void> {
  const collection = db.collection('accounts');
  const batch = db.batch();
  for (const account of accounts) {
    batch.set(collection.doc(account.id), account, { merge: true });
  }
  await batch.commit();
}

export async function loadAllAccounts(db: Firestore): Promise<AccountLike[]> {
  const snap = await db.collection('accounts').get();
  return snap.docs.map((doc) => doc.data() as AccountLike);
}
