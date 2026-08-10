import type { Firestore } from 'firebase-admin/firestore';
import { loadConfig } from './config.js';
import { createPluggyClient } from './pluggyClient.js';
import { fetchAccountsAndTransactions } from './fetchData.js';
import { classifyAndShapeTransactions } from './aggregate.js';
import { upsertTransactions, upsertAccounts } from './repo.js';

// Janela de busca generosa (nao so "desde ontem"): cobre lancamentos que
// assentam com atraso no banco e garante que, se o job nao rodar num dia,
// o proximo ainda pega tudo que ficou pra tras.
const REFRESH_WINDOW_DAYS = 45;

export interface RefreshStats {
  accountsCount: number;
  transactionsFetched: number;
  startedAt: Date;
  finishedAt: Date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Busca transacoes recentes no Pluggy, classifica com as regras ja
// carregadas (chame initClassification() antes) e grava no Firestore.
// upsertTransactions usa transactionId como chave do doc, entao rodar isso
// mais de uma vez no mesmo dia (ou duas vezes seguidas) nao duplica nada.
export async function runDailyRefresh(db: Firestore): Promise<RefreshStats> {
  const startedAt = new Date();
  const config = loadConfig();
  const client = createPluggyClient(config);

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - REFRESH_WINDOW_DAYS);

  const data = await fetchAccountsAndTransactions(client, config.itemIds, isoDate(dateFrom));
  const transactions = classifyAndShapeTransactions(data);

  await upsertTransactions(db, transactions);
  await upsertAccounts(
    db,
    data.map(({ account }) => account)
  );

  const finishedAt = new Date();
  const stats: RefreshStats = {
    accountsCount: data.length,
    transactionsFetched: transactions.length,
    startedAt,
    finishedAt,
  };

  await db.doc('appMeta/refresh').set(
    {
      lastRefreshAt: finishedAt,
      accountsCount: stats.accountsCount,
      transactionsFetched: stats.transactionsFetched,
    },
    { merge: true }
  );

  return stats;
}
