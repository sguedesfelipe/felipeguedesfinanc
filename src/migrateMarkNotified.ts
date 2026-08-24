// Script de migracao unica (bootstrap do digest diario via WhatsApp): marca
// todas as transacoes ja existentes no Firestore como notificadoWhatsapp:true,
// pra que o primeiro digest real (ver src/dailyDigest.ts) so liste
// transacoes que chegarem a partir da proxima atualizacao diaria, sem tentar
// mandar o historico inteiro de uma vez. Roda uma vez so, localmente (com
// `gcloud auth application-default login` ja feito), antes do primeiro envio
// real — ver RUNBOOK.md.
//
// Uso: tsx src/migrateMarkNotified.ts
import { getDb } from './firestore.js';
import { loadAllTransactions, markTransactionsNotified } from './repo.js';

async function main() {
  const db = getDb();
  const transactions = await loadAllTransactions(db);
  const idsToMark = transactions.filter((t) => !t.notificadoWhatsapp).map((t) => t.transactionId);

  if (idsToMark.length === 0) {
    console.log('Nenhuma transacao pendente de marcar — todas ja estao notificadoWhatsapp:true.');
    return;
  }

  console.log(`Marcando ${idsToMark.length} de ${transactions.length} transacao(oes) como ja notificadas...`);
  await markTransactionsNotified(db, idsToMark);
  console.log('Concluido.');
}

main().catch((error) => {
  console.error('Erro na migracao de bootstrap do digest:', error.message ?? error);
  process.exitCode = 1;
});
