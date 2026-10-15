// Script de migracao unica: marca como invalidas as transacoes ja existentes
// no Firestore cuja categoria do banco (Pluggy) e "Automatic Investiment"
// (dinheiro so mudando de lugar pra um investimento automatico, nunca gasto/
// receita real) e que ainda estao valido:true — a partir de agora, essa
// regra ja entra valido:false de cara pra transacoes novas (ver
// classifyAndShapeTransactions em src/aggregate.ts), mas as que ja existiam
// antes dessa mudanca precisam ser corrigidas uma vez so, aqui. Roda
// localmente, com `gcloud auth application-default login` ja feito.
//
// Uso: tsx src/migrateInvalidateAutoInvestment.ts
import { getDb } from './firestore.js';
import { loadAllTransactions } from './repo.js';

const AUTO_INVALID_BANK_CATEGORIES = new Set(['Automatic Investiment', 'Automatic Investment']);
const FIRESTORE_BATCH_LIMIT = 450;

async function main() {
  const db = getDb();
  const transactions = await loadAllTransactions(db);
  const toFix = transactions.filter((t) => t.valido && AUTO_INVALID_BANK_CATEGORIES.has(t.bankCategory));

  if (toFix.length === 0) {
    console.log('Nenhuma transacao "Automatic Investiment" valido:true encontrada — nada para corrigir.');
    return;
  }

  console.log(`Invalidando ${toFix.length} transacao(oes) com categoria do banco "Automatic Investiment"...`);
  const collection = db.collection('transactions');
  for (let i = 0; i < toFix.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const t of toFix.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.update(collection.doc(t.transactionId), {
        valido: false,
        motivoInvalido: `Categoria do banco "${t.bankCategory}" — dinheiro movendo pra um investimento automatico, nao e gasto/receita real.`,
      });
    }
    await batch.commit();
  }
  console.log('Concluido.');
}

main().catch((error) => {
  console.error('Erro na migracao de invalidacao de Automatic Investiment:', error.message ?? error);
  process.exitCode = 1;
});
