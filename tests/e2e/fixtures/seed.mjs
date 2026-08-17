// Popula o emulador do Firestore com um conjunto pequeno e realista de dados
// pra rodar a suite e2e — nunca toca no Firestore de producao (so funciona
// contra FIRESTORE_EMULATOR_HOST, que o runner sempre define antes de
// chamar este script).
import { getDb } from '../../../dist/firestore.js';
import { loadRulesFromFile } from '../../../dist/classify.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('seed.mjs so deve rodar contra o emulador (FIRESTORE_EMULATOR_HOST nao definido).');
}

const db = getDb();
const rules = loadRulesFromFile();
await db.doc('classification/rules').set(rules);

function tx(over) {
  const now = new Date();
  return {
    transactionId: over.transactionId,
    descriptionRaw: '', statusBanco: 'POSTED', operationType: '', currencyCode: 'BRL',
    amountInAccountCurrency: null, providerCode: '', providerId: '',
    merchantName: '', merchantCnpj: '', merchantCnae: '', payer: '', receiver: '',
    paymentMethod: '', paymentReason: '', transferType: '', receiverReferenceId: '',
    boletoDigitableLine: '', boletoBarcode: '', boletoBaseAmount: null, boletoPenaltyAmount: null,
    boletoInterestAmount: null, boletoDiscountAmount: null, cardLastDigits: '', installment: '',
    installmentNumber: null, installmentTotalAmount: null, payeeMCC: '', purchaseDate: null,
    billId: '', billForecastMonth: '', cardFeeType: '', cardOtherCreditType: '', balanceAfter: null,
    createdAt: now, updatedAt: now, dataConsiderada: now, installmentGroupKey: '',
    accountId: 'acc1', accountName: 'Conta Teste', accountType: 'BANK',
    date: now, bankCategory: 'Groceries', confianca: 'baixa', pendente: true,
    motivoClassificacao: 'teste', motivoInvalido: '', isEmprestimo: false,
    ...over,
  };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const currentYear = new Date().getFullYear();

const transactions = [
  tx({ transactionId: 'seed-1', description: 'SUPERMERCADO TESTE', categoria: 'Alimentação', subcategoria: 'Supermercado', valido: true, isExpense: true, amount: 150.5, date: daysAgo(1), dataConsiderada: daysAgo(1), pendente: false }),
  tx({ transactionId: 'seed-2', description: 'SALARIO EMPRESA X', categoria: 'Renda', subcategoria: 'Salário', valido: true, isExpense: false, amount: 5000, date: daysAgo(3), dataConsiderada: daysAgo(3), pendente: false }),
  tx({ transactionId: 'seed-3', description: 'EMPRESTIMO JOAO', categoria: 'Emprestimos', subcategoria: 'Emprestimos', valido: true, isExpense: true, amount: 300, date: daysAgo(5), dataConsiderada: daysAgo(5), pendente: false }),
  tx({ transactionId: 'seed-4', description: 'NETFLIX.COM', categoria: 'Compras e Lazer', subcategoria: 'Jogos e Entreterimento', valido: true, isExpense: true, amount: 44.9, date: daysAgo(40), dataConsiderada: daysAgo(40), pendente: false, accountName: 'Cartao Teste', accountType: 'CREDIT' }),
  tx({ transactionId: 'seed-5', description: 'UBER TRIP', categoria: 'Transporte', subcategoria: 'Aplicativos de Mobilidade', valido: true, isExpense: true, amount: 32.5, date: daysAgo(90), dataConsiderada: daysAgo(90), pendente: false }),
  tx({ transactionId: 'seed-6', description: 'MERCADO LIVRE COMPRA', categoria: 'Outros', subcategoria: 'Outros', valido: true, isExpense: true, amount: 189.9, date: daysAgo(2), dataConsiderada: daysAgo(2), pendente: true, confianca: 'baixa', motivoClassificacao: 'Sem historico parecido — palpite a partir da categoria do banco ("Online shopping").' }),
  tx({ transactionId: 'seed-7', description: 'POSTO SHELL COMBUSTIVEL', categoria: 'Transporte', subcategoria: 'Combustivel', valido: true, isExpense: true, amount: 220, date: daysAgo(1), dataConsiderada: daysAgo(1), pendente: true, confianca: 'media', motivoClassificacao: 'Correspondencia parcial (prefixo) com uma regra existente.' }),
  // grupo de parcelas: lider (1/2) e seguidora (2/2), ambas pendentes —
  // cobre o bug de enforceInstallmentConsistency que revertia o aceite de
  // uma parcela seguidora enquanto a lider ainda estivesse pendente.
  tx({ transactionId: 'seed-8', description: 'LOJA MOVEIS PARCELA 1', categoria: 'Compras e Lazer', subcategoria: 'Casa', valido: true, isExpense: true, amount: 100, date: daysAgo(10), dataConsiderada: daysAgo(10), pendente: true, confianca: 'baixa', motivoClassificacao: 'Sem historico parecido.', installmentGroupKey: 'grupo-parcela-teste', installmentNumber: 1, installment: '1/2' }),
  tx({ transactionId: 'seed-9', description: 'LOJA MOVEIS PARCELA 2', categoria: 'Compras e Lazer', subcategoria: 'Casa', valido: true, isExpense: true, amount: 100, date: daysAgo(1), dataConsiderada: daysAgo(1), pendente: true, confianca: 'baixa', motivoClassificacao: 'Sem historico parecido.', installmentGroupKey: 'grupo-parcela-teste', installmentNumber: 2, installment: '2/2' }),
  // datas nas pontas (janeiro do ano corrente e hoje) pra testar o padrao
  // "ano corrente ate hoje" do filtro de periodo sem ele ficar mascarado
  // pelo clamp de minDate/maxDate.
  tx({ transactionId: 'seed-10', description: 'IPTU PARCELA JANEIRO', categoria: 'Moradia', subcategoria: 'Impostos', valido: true, isExpense: true, amount: 80, date: new Date(currentYear, 0, 15), dataConsiderada: new Date(currentYear, 0, 15), pendente: false }),
  tx({ transactionId: 'seed-11', description: 'PADARIA HOJE', categoria: 'Alimentação', subcategoria: 'Restaurante', valido: true, isExpense: true, amount: 15, date: daysAgo(0), dataConsiderada: daysAgo(0), pendente: false }),
];

const batch = db.batch();
for (const t of transactions) batch.set(db.collection('transactions').doc(t.transactionId), t);
await batch.commit();

await db.collection('accounts').doc('acc1').set({ id: 'acc1', name: 'Conta Teste', type: 'BANK', balance: 1000 });
await db.collection('accounts').doc('acc2').set({ id: 'acc2', name: 'Cartao Teste', type: 'CREDIT', balance: -500 });

console.log(`seed ok: ${transactions.length} transacoes, 2 contas, regras de classificacao`);
