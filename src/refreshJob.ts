// Entrypoint do Cloud Run Job disparado 1x/dia pelo Cloud Scheduler (ver
// RUNBOOK.md). Roda ate o fim e sai — nao e um servidor HTTP.
import { getDb } from './firestore.js';
import { initClassification, loadRulesFromFirestore } from './classify.js';
import { runDailyRefresh } from './refresh.js';
import { sendDailyDigest } from './dailyDigest.js';

async function main() {
  const db = getDb();
  initClassification(await loadRulesFromFirestore(db));
  const stats = await runDailyRefresh(db);
  console.log(
    `Atualizacao diaria concluida: ${stats.transactionsFetched} transacao(oes) em ${stats.accountsCount} conta(s), ` +
      `${(stats.finishedAt.getTime() - stats.startedAt.getTime()) / 1000}s.`
  );

  // Falha so no envio do WhatsApp fica so logada — nao deve derrubar o job
  // (a atualizacao dos dados acima e a parte critica) nem disparar o alerta
  // de monitoramento configurado pro job (RUNBOOK.md), que olha o exit code.
  try {
    await sendDailyDigest(db);
  } catch (error) {
    console.error('Erro ao enviar o digest diario no WhatsApp:', (error as Error).message ?? error);
  }
}

main().catch((error) => {
  console.error('Erro na atualizacao diaria:', error.message ?? error);
  process.exitCode = 1;
});
