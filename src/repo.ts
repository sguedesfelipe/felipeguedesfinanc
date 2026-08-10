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
  for (let i = 0; i < transactions.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const t of transactions.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.set(collection.doc(t.transactionId), t, { merge: true });
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
