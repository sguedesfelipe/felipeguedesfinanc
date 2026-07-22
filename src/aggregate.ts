import { Transaction, TransactionPaymentParticipantDocument } from 'pluggy-sdk';
import { AccountTransactions } from './fetchData.js';
import { classifyTransaction, checkKnownInvalid, normalizeKey, Confianca } from './classify.js';

function formatParticipant(name: string | null | undefined, doc: TransactionPaymentParticipantDocument | undefined): string {
  const parts = [name?.trim()].filter(Boolean) as string[];
  if (doc?.value) parts.push(`${doc.type ?? 'doc'}: ${doc.value}`);
  return parts.join(' — ');
}

function fallbackTransactionId(date: Date): string {
  return `${date.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

// "billForecastDate" volta na API do Pluggy (mes/ano da fatura em que a
// parcela cai) mas nao esta no SDK oficial ainda — acessamos via um tipo
// estendido em vez de "any" solto.
type TransactionWithUndocumentedFields = Transaction & {
  creditCardMetadata: (Transaction['creditCardMetadata'] & { billForecastDate?: string }) | null;
};

// Todos os campos extras que o Pluggy pode trazer por transacao, alem do que
// ja usamos para classificar/agregar (deixamos de fora somente categoryId, a
// pedido do usuario). Nem todo banco/conector preenche tudo (ex.: "merchant"
// costuma vir vazio em transacoes de conta corrente) — os campos ficam string
// vazia quando o Pluggy nao devolveu o dado.
export interface TransactionExtra {
  transactionId: string;
  descriptionRaw: string;
  statusBanco: string;
  operationType: string;
  currencyCode: string;
  amountInAccountCurrency: number | null;
  providerCode: string;
  providerId: string;
  merchantName: string;
  merchantCnpj: string;
  merchantCnae: string;
  payer: string;
  receiver: string;
  paymentMethod: string;
  paymentReason: string;
  transferType: string;
  receiverReferenceId: string;
  boletoDigitableLine: string;
  boletoBarcode: string;
  boletoBaseAmount: number | null;
  boletoPenaltyAmount: number | null;
  boletoInterestAmount: number | null;
  boletoDiscountAmount: number | null;
  cardLastDigits: string;
  installment: string;
  installmentTotalAmount: number | null;
  payeeMCC: string;
  purchaseDate: Date | null;
  billId: string;
  billForecastMonth: string;
  cardFeeType: string;
  cardOtherCreditType: string;
  balanceAfter: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function extractExtra(tx: Transaction, date: Date): TransactionExtra {
  const merchant = tx.merchant;
  const cc = (tx as TransactionWithUndocumentedFields).creditCardMetadata;
  const payment = tx.paymentData;
  const boleto = payment?.boletoMetadata;

  return {
    transactionId: tx.id || fallbackTransactionId(date),
    descriptionRaw: tx.descriptionRaw && tx.descriptionRaw !== tx.description ? tx.descriptionRaw : '',
    statusBanco: tx.status ?? '',
    operationType: [tx.operationType, tx.operationTypeAdditionalInfo].filter(Boolean).join(' — '),
    currencyCode: tx.currencyCode ?? '',
    amountInAccountCurrency: tx.amountInAccountCurrency ?? null,
    providerCode: tx.providerCode ?? '',
    providerId: tx.providerId ?? '',
    merchantName: merchant?.businessName || merchant?.name || '',
    merchantCnpj: merchant?.cnpj ?? '',
    merchantCnae: merchant?.cnae ?? '',
    payer: payment?.payer ? formatParticipant(payment.payer.name, payment.payer.documentNumber) : '',
    receiver: payment?.receiver ? formatParticipant(payment.receiver.name, payment.receiver.documentNumber) : '',
    paymentMethod: payment?.paymentMethod ?? '',
    paymentReason: payment?.reason ?? '',
    transferType: payment?.referenceNumber ?? '',
    receiverReferenceId: payment?.receiverReferenceId ?? '',
    boletoDigitableLine: boleto?.digitableLine ?? '',
    boletoBarcode: boleto?.barcode ?? '',
    boletoBaseAmount: boleto?.baseAmount ?? null,
    boletoPenaltyAmount: boleto?.penaltyAmount ?? null,
    boletoInterestAmount: boleto?.interestAmount ?? null,
    boletoDiscountAmount: boleto?.discountAmount ?? null,
    cardLastDigits: cc?.cardNumber ?? '',
    installment: cc?.installmentNumber && cc?.totalInstallments ? `${cc.installmentNumber}/${cc.totalInstallments}` : '',
    installmentTotalAmount: cc?.totalAmount ?? null,
    payeeMCC: cc?.payeeMCC ? String(cc.payeeMCC) : '',
    purchaseDate: cc?.purchaseDate ? new Date(cc.purchaseDate) : null,
    billId: cc?.billId ?? '',
    billForecastMonth: cc?.billForecastDate ?? '',
    cardFeeType: [cc?.feeType, cc?.feeTypeAdditionalInfo].filter(Boolean).join(' — '),
    cardOtherCreditType: [cc?.otherCreditsType, cc?.otherCreditsAdditionalInfo].filter(Boolean).join(' — '),
    balanceAfter: tx.balance ?? null,
    createdAt: new Date(tx.createdAt),
    updatedAt: new Date(tx.updatedAt),
  };
}

export interface CategorizedTransaction extends TransactionExtra {
  accountId: string;
  accountName: string;
  accountType: string;
  date: Date;
  description: string;
  bankCategory: string;
  categoria: string;
  subcategoria: string;
  confianca: Confianca;
  pendente: boolean;
  motivoClassificacao: string;
  valido: boolean;
  motivoInvalido: string;
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
    pendentesClassificacao: number;
    invalidas: number;
  };
}

const UNCATEGORIZED = 'Sem categoria';
const CARD_PAYMENT_CATEGORY = 'Credit card payment';
// Janela de dias para casar o pagamento da fatura (debito na conta corrente)
// com o "pagamento recebido" no cartao (credito), mesmo que as datas de
// processamento nao coincidam exatamente entre as duas contas.
const CARD_PAYMENT_MATCH_WINDOW_DAYS = 5;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Quando a fatura do cartao e paga pela mesma conta corrente conectada, o
// Pluggy traz o mesmo valor duas vezes: como "Credit card payment" (credito)
// na conta do cartao, e como um debito de boleto/pix na conta corrente. Os
// gastos individuais do cartao ja entram no relatorio, entao contar essa
// fatura de novo dobraria o total — as duas pontas sao marcadas invalidas por
// padrao (o usuario pode reverter manualmente se algum caso for diferente).
function flagCardPaymentDuplicates(transactions: CategorizedTransaction[]): void {
  const cardPayments = transactions.filter(
    (t) => t.accountType === 'CREDIT' && t.bankCategory === CARD_PAYMENT_CATEGORY
  );
  for (const payment of cardPayments) {
    if (!payment.valido) continue; // ja invalidado pelo historico — preserva o motivo original
    payment.valido = false;
    payment.motivoInvalido = 'Pagamento de fatura recebido no cartao (categoria do banco "Credit card payment").';
  }

  const windowMs = CARD_PAYMENT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  for (const t of transactions) {
    if (!t.valido || t.accountType === 'CREDIT') continue;
    const match = cardPayments.find(
      (p) => Math.abs(Math.abs(p.amount) - Math.abs(t.amount)) < 0.01 && Math.abs(p.date.getTime() - t.date.getTime()) <= windowMs
    );
    if (match) {
      t.valido = false;
      t.motivoInvalido = 'Provavel pagamento da fatura do cartao (mesmo valor de um "Credit card payment" na conta de credito).';
    }
  }
}

export function buildReport(data: AccountTransactions[]): Report {
  const transactions: CategorizedTransaction[] = [];

  for (const { account, transactions: txs } of data) {
    for (const tx of txs) {
      const date = new Date(tx.date);
      const isExpense = tx.type === 'DEBIT';
      const amount = Math.abs(tx.amount);
      const bankCategory = tx.category ?? UNCATEGORIZED;
      const classification = classifyTransaction(tx.description, tx.category ?? null);
      const knownInvalidReason = checkKnownInvalid(normalizeKey(tx.description));

      transactions.push({
        ...extractExtra(tx, date),
        accountId: account.id,
        accountName: account.name,
        accountType: account.type,
        date,
        description: tx.description,
        bankCategory,
        categoria: classification.categoria,
        subcategoria: classification.subcategoria,
        confianca: classification.confianca,
        pendente: classification.pendente,
        motivoClassificacao: classification.motivo,
        valido: !knownInvalidReason,
        motivoInvalido: knownInvalidReason ?? '',
        amount,
        isExpense,
      });
    }
  }

  flagCardPaymentDuplicates(transactions);
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  const monthlyMap = new Map<string, MonthTotal>();
  const categoryMap = new Map<string, CategoryTotal>();
  const merchantMap = new Map<string, MerchantTotal>();
  const accountExpensesMap = new Map<string, number>();
  let totalExpenses = 0;
  let totalIncome = 0;

  for (const t of transactions) {
    if (!t.valido) continue;

    const mKey = monthKey(t.date);
    const monthEntry = monthlyMap.get(mKey) ?? { month: mKey, expenses: 0, income: 0 };
    if (t.isExpense) {
      monthEntry.expenses += t.amount;
      totalExpenses += t.amount;
      accountExpensesMap.set(t.accountId, (accountExpensesMap.get(t.accountId) ?? 0) + t.amount);

      const catEntry = categoryMap.get(t.categoria) ?? { category: t.categoria, total: 0, count: 0 };
      catEntry.total += t.amount;
      catEntry.count += 1;
      categoryMap.set(t.categoria, catEntry);

      const merchantEntry = merchantMap.get(t.description) ?? { description: t.description, total: 0, count: 0 };
      merchantEntry.total += t.amount;
      merchantEntry.count += 1;
      merchantMap.set(t.description, merchantEntry);
    } else {
      monthEntry.income += t.amount;
      totalIncome += t.amount;
    }
    monthlyMap.set(mKey, monthEntry);
  }

  const accounts: AccountSummary[] = data.map(({ account }) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    totalExpenses: accountExpensesMap.get(account.id) ?? 0,
  }));

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
      transactionCount: transactions.filter((t) => t.valido).length,
      pendentesClassificacao: transactions.filter((t) => t.valido && t.pendente).length,
      invalidas: transactions.filter((t) => !t.valido).length,
    },
  };
}
