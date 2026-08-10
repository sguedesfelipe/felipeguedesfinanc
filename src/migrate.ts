// Script de migracao unica: roda localmente (com `gcloud auth application-
// default login` ja feito, ou GOOGLE_APPLICATION_CREDENTIALS apontando pra
// uma service account) pra semear o Firestore com a taxonomia/historico
// atual e o lote de transacoes buscado do Pluggy. So precisa rodar uma vez,
// antes do primeiro deploy — ver RUNBOOK.md.
//
// Uso: tsx src/migrate.ts [--months=N | --from=YYYY-MM-DD]
import { loadConfig } from './config.js';
import { createPluggyClient } from './pluggyClient.js';
import { fetchAccountsAndTransactions } from './fetchData.js';
import { buildReport } from './aggregate.js';
import { initClassification, loadRulesFromFile } from './classify.js';
import { getDb } from './firestore.js';
import { upsertTransactions, upsertAccounts } from './repo.js';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const config = loadConfig();
  const rules = loadRulesFromFile();
  initClassification(rules);

  const dateTo = new Date();
  let dateFrom: Date;
  if (config.dateFrom) {
    dateFrom = new Date(config.dateFrom);
  } else {
    dateFrom = new Date(dateTo);
    dateFrom.setMonth(dateFrom.getMonth() - config.months);
  }

  console.log(`Buscando dados no Pluggy para ${config.itemIds.length} item(s) desde ${isoDate(dateFrom)}...`);
  const client = createPluggyClient(config);
  const data = await fetchAccountsAndTransactions(client, config.itemIds, isoDate(dateFrom));
  const report = buildReport(data);

  const db = getDb();

  console.log(`Gravando doc classification/rules (${Object.keys(rules.rulesFull).length} regras)...`);
  await db.doc('classification/rules').set(rules);

  console.log(`Gravando ${report.transactions.length} transacao(oes)...`);
  await upsertTransactions(db, report.transactions);

  console.log(`Gravando ${report.accounts.length} conta(s)...`);
  await upsertAccounts(
    db,
    data.map(({ account }) => account)
  );

  console.log('Migracao concluida. Confira os totais abaixo contra o ultimo relatorio gerado pelo CLI:');
  console.log(` - Transacoes validas: ${report.totals.transactionCount}`);
  console.log(` - Gastos: R$ ${report.totals.expenses.toFixed(2)}`);
  console.log(` - Receitas: R$ ${report.totals.income.toFixed(2)}`);
  console.log(` - Pendentes de classificacao: ${report.totals.pendentesClassificacao}`);
  console.log(` - Invalidas: ${report.totals.invalidas}`);
}

main().catch((error) => {
  console.error('Erro na migracao:', error.message ?? error);
  process.exitCode = 1;
});
