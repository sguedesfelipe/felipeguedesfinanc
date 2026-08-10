// Entrypoint do Cloud Run Job disparado 1x/dia pelo Cloud Scheduler (ver
// RUNBOOK.md). Roda ate o fim e sai — nao e um servidor HTTP.
import { getDb } from './firestore.js';
import { initClassification, loadRulesFromFirestore } from './classify.js';
import { runDailyRefresh } from './refresh.js';

async function main() {
  const db = getDb();
  initClassification(await loadRulesFromFirestore(db));
  const stats = await runDailyRefresh(db);
  console.log(
    `Atualizacao diaria concluida: ${stats.transactionsFetched} transacao(oes) em ${stats.accountsCount} conta(s), ` +
      `${(stats.finishedAt.getTime() - stats.startedAt.getTime()) / 1000}s.`
  );
}

main().catch((error) => {
  console.error('Erro na atualizacao diaria:', error.message ?? error);
  process.exitCode = 1;
});
