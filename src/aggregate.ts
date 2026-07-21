import { Account, Transaction } from 'pluggy-sdk';
import { AccountTransactions } from './fetchData.js';

export interface CategorizedTransaction {
  accountId: string;
  accountName: string;
  date: Date;
  description: string;
  category: string;
  amount: number;
  isExpense: boolean;
}

export interface MonthTotal {
  month: string; // YYYY-MM
  expenses: number;
  income: number;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface MerchantTotal {
  description: string;
  total: number;
  count: number;
}

export interface AccountSummary {
  id: string;
  name: string;
  type: string;
  balance: number;
  totalExpenses: number;
}

export interface Report {
  transactions: CategorizedTransaction[];
  monthly: MonthTotal[];
  categories: CategoryTotal[];
  merchants: MerchantTotal[];
  accounts: AccountSummary[];
  totals: {
    expenses: number;
    income: number;
    net: number;
    transactionCount: number;
  };
}

const UNCATEGORIZED = 'Sem categoria';

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildReport(data: AccountTransactions[]): Report {
  const transactions: CategorizedTransaction[] = [];
  const monthlyMap = new Map<string, MonthTotal>();
  const categoryMap = new Map<string, CategoryTotal>();
  const merchantMap = new Map<string, MerchantTotal>();
  const accounts: AccountSummary[] = [];

  let totalExpenses = 0;
  let totalIncome = 0;

  for (const { account, transactions: txs } of data) {
    let accountExpenses = 0;

    for (const tx of txs) {
      const date = new Date(tx.date);
      const isExpense = tx.type === 'DEBIT';
      const amount = Math.abs(tx.amount);
      const category = tx.category ?? UNCATEGORIZED;

      transactions.push({
        accountId: account.id,
        accountName: account.name,
        date,
        description: tx.description,
        category,
        amount,
        isExpense,
      });

      const mKey = monthKey(date);
      const monthEntry = monthlyMap.get(mKey) ?? { month: mKey, expenses: 0, income: 0 };
      if (isExpense) {
        monthEntry.expenses += amount;
        accountExpenses += amount;
        totalExpenses += amount;

        const catEntry = categoryMap.get(category) ?? { category, total: 0, count: 0 };
        catEntry.total += amount;
        catEntry.count += 1;
        categoryMap.set(category, catEntry);

        const merchantEntry = merchantMap.get(tx.description) ?? {
          description: tx.description,
          total: 0,
          count: 0,
        };
        merchantEntry.total += amount;
        merchantEntry.count += 1;
        merchantMap.set(tx.description, merchantEntry);
      } else {
        monthEntry.income += amount;
        totalIncome += amount;
      }
      monthlyMap.set(mKey, monthEntry);
    }

    accounts.push({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance,
      totalExpenses: accountExpenses,
    });
  }

  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const categories = [...categoryMap.values()].sort((a, b) => b.total - a.total);
  const merchants = [...merchantMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  return {
    transactions,
    monthly,
    categories,
    merchants,
    accounts,
    totals: {
      expenses: totalExpenses,
      income: totalIncome,
      net: totalIncome - totalExpenses,
      transactionCount: transactions.length,
    },
  };
}
