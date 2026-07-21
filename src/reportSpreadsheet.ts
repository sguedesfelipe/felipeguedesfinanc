import ExcelJS from 'exceljs';
import { Report } from './aggregate.js';
import { CATEGORIAS, SUBCATEGORIAS } from './classify.js';

const BRL = '#,##0.00';

// worksheet.dataValidations.add() applies a validation to a whole range in one
// XML entry, unlike per-cell assignment. It exists at runtime but isn't in
// exceljs's published types, hence the narrow cast.
interface WorksheetWithRangeValidations extends ExcelJS.Worksheet {
  dataValidations: { add(address: string, validation: ExcelJS.DataValidation): void };
}

function classificationValidation(kind: 'Categoria' | 'Subcategoria', range: string): ExcelJS.DataValidation {
  return {
    type: 'list',
    allowBlank: true,
    showErrorMessage: false,
    formulae: [range],
    promptTitle: kind,
    prompt: 'Escolha da lista ou digite outra — voce pode alterar livremente.',
    showInputMessage: true,
  };
}

const VALIDO_VALIDATION: ExcelJS.DataValidation = {
  type: 'list',
  allowBlank: true,
  showErrorMessage: false,
  formulae: ['"Sim,Nao"'],
  promptTitle: 'Considerar no relatorio?',
  prompt: 'Sim conta nos totais, Nao exclui (ex.: pagamento de fatura ja contado nas compras do cartao).',
  showInputMessage: true,
};

function addColumnValidation(sheet: ExcelJS.Worksheet, columnKey: string, validation: ExcelJS.DataValidation): void {
  if (sheet.rowCount < 2) return;
  const col = sheet.getColumn(columnKey).letter;
  (sheet as WorksheetWithRangeValidations).dataValidations.add(`${col}2:${col}${sheet.rowCount}`, validation);
}

// Aplica o dropdown de Categoria/Subcategoria em todas as linhas de dados de
// uma planilha que tenha colunas com essas keys (Transacoes e Pendencias).
function applyClassificationDropdowns(
  sheet: ExcelJS.Worksheet,
  categoriasRange: string,
  subcategoriasRange: string
): void {
  addColumnValidation(sheet, 'categoria', classificationValidation('Categoria', categoriasRange));
  addColumnValidation(sheet, 'subcategoria', classificationValidation('Subcategoria', subcategoriasRange));
}

// Habilita os filtros/ordenacao nativos do Excel na linha de cabecalho.
function enableAutoFilter(sheet: ExcelJS.Worksheet): void {
  const lastCol = sheet.getColumn(sheet.columnCount).letter;
  sheet.autoFilter = `A1:${lastCol}1`;
}

export async function writeSpreadsheet(report: Report, filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Relatorio de gastos Pluggy';
  workbook.created = new Date();

  const listas = workbook.addWorksheet('Listas', { state: 'veryHidden' });
  listas.getColumn(1).values = ['Categoria', ...CATEGORIAS];
  listas.getColumn(2).values = ['Subcategoria', ...SUBCATEGORIAS];
  const categoriasRange = `Listas!$A$2:$A$${CATEGORIAS.length + 1}`;
  const subcategoriasRange = `Listas!$B$2:$B$${SUBCATEGORIAS.length + 1}`;

  const resumo = workbook.addWorksheet('Resumo');
  resumo.columns = [
    { header: 'Indicador', key: 'label', width: 28 },
    { header: 'Valor', key: 'value', width: 18 },
  ];
  resumo.addRows([
    { label: 'Total de gastos', value: report.totals.expenses },
    { label: 'Total de receitas', value: report.totals.income },
    { label: 'Saldo (receitas - gastos)', value: report.totals.net },
    { label: 'Numero de transacoes (validas)', value: report.totals.transactionCount },
    { label: 'Transacoes invalidadas (nao contam no relatorio)', value: report.totals.invalidas },
    { label: 'Pendentes de classificacao', value: report.totals.pendentesClassificacao },
  ]);
  resumo.getColumn('value').numFmt = BRL;
  resumo.getRow(1).font = { bold: true };

  const mensal = workbook.addWorksheet('Resumo Mensal');
  mensal.columns = [
    { header: 'Mes', key: 'month', width: 12 },
    { header: 'Gastos', key: 'expenses', width: 16 },
    { header: 'Receitas', key: 'income', width: 16 },
    { header: 'Saldo', key: 'net', width: 16 },
  ];
  for (const m of report.monthly) {
    mensal.addRow({ month: m.month, expenses: m.expenses, income: m.income, net: m.income - m.expenses });
  }
  ['expenses', 'income', 'net'].forEach((key) => (mensal.getColumn(key).numFmt = BRL));
  mensal.getRow(1).font = { bold: true };

  const categorias = workbook.addWorksheet('Categorias');
  categorias.columns = [
    { header: 'Categoria', key: 'category', width: 28 },
    { header: 'Total gasto', key: 'total', width: 16 },
    { header: 'Qtde. transacoes', key: 'count', width: 16 },
  ];
  for (const c of report.categories) {
    categorias.addRow({ category: c.category, total: c.total, count: c.count });
  }
  categorias.getColumn('total').numFmt = BRL;
  categorias.getRow(1).font = { bold: true };
  enableAutoFilter(categorias);

  const maioresGastos = workbook.addWorksheet('Maiores Gastos');
  maioresGastos.columns = [
    { header: 'Descricao', key: 'description', width: 40 },
    { header: 'Total gasto', key: 'total', width: 16 },
    { header: 'Qtde. transacoes', key: 'count', width: 16 },
  ];
  for (const m of report.merchants) {
    maioresGastos.addRow({ description: m.description, total: m.total, count: m.count });
  }
  maioresGastos.getColumn('total').numFmt = BRL;
  maioresGastos.getRow(1).font = { bold: true };
  enableAutoFilter(maioresGastos);

  const contas = workbook.addWorksheet('Contas');
  contas.columns = [
    { header: 'Conta', key: 'name', width: 28 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Saldo atual', key: 'balance', width: 16 },
    { header: 'Total gasto no periodo', key: 'totalExpenses', width: 20 },
  ];
  for (const a of report.accounts) {
    contas.addRow({ name: a.name, type: a.type, balance: a.balance, totalExpenses: a.totalExpenses });
  }
  ['balance', 'totalExpenses'].forEach((key) => (contas.getColumn(key).numFmt = BRL));
  contas.getRow(1).font = { bold: true };
  enableAutoFilter(contas);

  const transacoes = workbook.addWorksheet('Transacoes');
  transacoes.columns = [
    { header: 'ID', key: 'id', width: 22 },
    { header: 'Data', key: 'date', width: 14 },
    { header: 'Conta', key: 'account', width: 22 },
    { header: 'Descricao', key: 'description', width: 40 },
    { header: 'Categoria', key: 'categoria', width: 26 },
    { header: 'Subcategoria', key: 'subcategoria', width: 26 },
    { header: 'Pendente de revisao?', key: 'pendente', width: 18 },
    { header: 'Valido?', key: 'valido', width: 10 },
    { header: 'Motivo (se invalido)', key: 'motivoInvalido', width: 40 },
    { header: 'Categoria do banco', key: 'bankCategory', width: 22 },
    { header: 'Descricao original do banco', key: 'descriptionRaw', width: 34 },
    { header: 'Estabelecimento', key: 'merchantName', width: 30 },
    { header: 'CNPJ do estabelecimento', key: 'merchantCnpj', width: 20 },
    { header: 'CNAE', key: 'merchantCnae', width: 12 },
    { header: 'Pagador', key: 'payer', width: 34 },
    { header: 'Recebedor', key: 'receiver', width: 34 },
    { header: 'Forma de pagamento', key: 'paymentMethod', width: 18 },
    { header: 'Tipo de operacao', key: 'operationType', width: 22 },
    { header: 'Parcela', key: 'installment', width: 10 },
    { header: 'Valor total da compra', key: 'installmentTotalAmount', width: 18 },
    { header: 'Cartao (final)', key: 'cardLastDigits', width: 14 },
    { header: 'MCC', key: 'payeeMCC', width: 10 },
    { header: 'Data da compra', key: 'purchaseDate', width: 14 },
    { header: 'Status (banco)', key: 'statusBanco', width: 14 },
    { header: 'Saldo apos', key: 'balanceAfter', width: 16 },
    { header: 'Tipo', key: 'kind', width: 12 },
    { header: 'Valor', key: 'amount', width: 16 },
  ];
  for (const t of report.transactions) {
    transacoes.addRow({
      id: t.transactionId,
      date: t.date,
      account: t.accountName,
      description: t.description,
      categoria: t.categoria,
      subcategoria: t.subcategoria,
      pendente: t.pendente ? 'Sim' : '',
      valido: t.valido ? 'Sim' : 'Nao',
      motivoInvalido: t.motivoInvalido,
      bankCategory: t.bankCategory,
      descriptionRaw: t.descriptionRaw,
      merchantName: t.merchantName,
      merchantCnpj: t.merchantCnpj,
      merchantCnae: t.merchantCnae,
      payer: t.payer,
      receiver: t.receiver,
      paymentMethod: t.paymentMethod,
      operationType: t.operationType,
      installment: t.installment,
      installmentTotalAmount: t.installmentTotalAmount,
      cardLastDigits: t.cardLastDigits,
      payeeMCC: t.payeeMCC,
      purchaseDate: t.purchaseDate,
      statusBanco: t.statusBanco,
      balanceAfter: t.balanceAfter,
      kind: t.isExpense ? 'Gasto' : 'Receita',
      amount: t.amount,
    });
  }
  transacoes.getColumn('date').numFmt = 'dd/mm/yyyy';
  transacoes.getColumn('purchaseDate').numFmt = 'dd/mm/yyyy';
  transacoes.getColumn('amount').numFmt = BRL;
  transacoes.getColumn('installmentTotalAmount').numFmt = BRL;
  transacoes.getColumn('balanceAfter').numFmt = BRL;
  transacoes.getRow(1).font = { bold: true };
  applyClassificationDropdowns(transacoes, categoriasRange, subcategoriasRange);
  addColumnValidation(transacoes, 'valido', VALIDO_VALIDATION);
  enableAutoFilter(transacoes);

  const pendencias = workbook.addWorksheet('Pendencias de Classificacao');
  pendencias.columns = [
    { header: 'ID', key: 'id', width: 22 },
    { header: 'Data', key: 'date', width: 14 },
    { header: 'Conta', key: 'account', width: 22 },
    { header: 'Descricao', key: 'description', width: 40 },
    { header: 'Categoria sugerida', key: 'categoria', width: 26 },
    { header: 'Subcategoria sugerida', key: 'subcategoria', width: 26 },
    { header: 'Valor', key: 'amount', width: 16 },
    { header: 'Por que ficou pendente', key: 'motivo', width: 46 },
    { header: 'Linha na aba Transacoes', key: 'linha', width: 20 },
  ];
  report.transactions.forEach((t, index) => {
    if (!t.pendente || !t.valido) return;
    pendencias.addRow({
      id: t.transactionId,
      date: t.date,
      account: t.accountName,
      description: t.description,
      categoria: t.categoria,
      subcategoria: t.subcategoria,
      amount: t.amount,
      motivo: t.motivoClassificacao,
      linha: index + 2,
    });
  });
  pendencias.getColumn('date').numFmt = 'dd/mm/yyyy';
  pendencias.getColumn('amount').numFmt = BRL;
  pendencias.getRow(1).font = { bold: true };
  applyClassificationDropdowns(pendencias, categoriasRange, subcategoriasRange);
  enableAutoFilter(pendencias);
  pendencias.getCell('A1').note =
    'Sugestoes automaticas para lancamentos sem historico parecido. Corrija a Categoria/Subcategoria aqui ' +
    'e repita a mesma escolha na linha indicada da aba Transacoes (e la que os totais do relatorio sao calculados).';

  await workbook.xlsx.writeFile(filePath);
}
