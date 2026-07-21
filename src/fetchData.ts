import { PluggyClient, Account, Transaction } from 'pluggy-sdk';

export interface AccountTransactions {
  account: Account;
  transactions: Transaction[];
}

export async function fetchAccountsAndTransactions(
  client: PluggyClient,
  itemIds: string[],
  dateFrom: string
): Promise<AccountTransactions[]> {
  const out: AccountTransactions[] = [];

  for (const itemId of itemIds) {
    const accountsPage = await client.fetchAccounts(itemId);

    for (const account of accountsPage.results) {
      const transactions = await client.fetchAllTransactions(account.id, { dateFrom });
      out.push({ account, transactions });
    }
  }

  return out;
}
