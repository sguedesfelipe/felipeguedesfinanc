import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './config.js';
import { createPluggyClient } from './pluggyClient.js';
import { fetchAccountsAndTransactions } from './fetchData.js';
import { buildReport } from './aggregate.js';
import { writeSpreadsheet } from './reportSpreadsheet.js';
import { buildHtmlReport } from './reportHtml.js';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const config = loadConfig();

  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setMonth(dateFrom.getMonth() - config.months);

  console.log(`Buscando dados no Pluggy para ${config.itemIds.length} item(s) desde ${isoDate(dateFrom)}...`);

  const client = createPluggyClient(config);
  const data = await fetchAccountsAndTransactions(client, config.itemIds, isoDate(dateFrom));

  const totalTx = data.reduce((sum, d) => sum + d.transactions.length, 0);
  console.log(`Encontradas ${data.length} conta(s) e ${totalTx} transacao(oes).`);

  const report = buildReport(data);

  const runDir = path.join(config.outDir, isoDate(dateTo));
  await mkdir(runDir, { recursive: true });

  const xlsxPath = path.join(runDir, 'relatorio-gastos.xlsx');
  const htmlPath = path.join(runDir, 'relatorio-gastos.html');

  await writeSpreadsheet(report, xlsxPath);
  await writeFile(htmlPath, buildHtmlReport(report, isoDate(dateFrom), isoDate(dateTo)), 'utf-8');

  console.log('Relatorios gerados:');
  console.log(` - ${htmlPath}`);
  console.log(` - ${xlsxPath}`);
}

main().catch((error) => {
  console.error('Erro ao gerar relatorio:', error.message ?? error);
  process.exitCode = 1;
});
