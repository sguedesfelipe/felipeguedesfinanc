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

// Aplica o dropdown de Categoria/Subcategoria em todas as linhas de dados de
// uma planilha que tenha colunas com essas keys (Transacoes e Pendencias).
function applyClassificationDropdowns(
  sheet: ExcelJS.Worksheet,
  categoriasRange: string,
  subcategoriasRange: string
): void {
  if (sheet.rowCount < 2) return;
  const categoriaCol = sheet.getColumn('categoria').letter;
  const subcategoriaCol = sheet.getColumn('subcategoria').letter;
  const validations = (sheet as WorksheetWithRangeValidations).dataValidations;
  validations.add(
    `${categoriaCol}2:${categoriaCol}${sheet.rowCount}`,
    classificationValidation('Categoria', categoriasRange)
  );
  validations.add(
    `${subcategoriaCol}2:${subcategoriaCol}${sheet.rowCount}`,
    classificationValidation('Subcategoria', subcategoriasRange)
  );
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
    { label: 'Numero de transacoes', value: report.totals.transactionCount },
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

  const transacoes = workbook.addWorksheet('Transacoes');
  transacoes.columns = [
    { header: 'Data', key: 'date', width: 14 },
    { header: 'Conta', key: 'account', width: 22 },
    { header: 'Descricao', key: 'description', width: 40 },
    { header: 'Categoria', key: 'categoria', width: 26 },
    { header: 'Subcategoria', key: 'subcategoria', width: 26 },
    { header: 'Pendente de revisao?', key: 'pendente', width: 18 },
    { header: 'Categoria do banco', key: 'bankCategory', width: 22 },
    { header: 'Tipo', key: 'kind', width: 12 },
    { header: 'Valor', key: 'amount', width: 16 },
  ];
  for (const t of report.transactions) {
    transacoes.addRow({
      date: t.date,
      account: t.accountName,
      description: t.description,
      categoria: t.categoria,
      subcategoria: t.subcategoria,
      pendente: t.pendente ? 'Sim' : '',
      bankCategory: t.bankCategory,
      kind: t.isExpense ? 'Gasto' : 'Receita',
      amount: t.amount,
    });
  }
  transacoes.getColumn('date').numFmt = 'dd/mm/yyyy';
  transacoes.getColumn('amount').numFmt = BRL;
  transacoes.getRow(1).font = { bold: true };
  applyClassificationDropdowns(transacoes, categoriasRange, subcategoriasRange);

  const pendencias = workbook.addWorksheet('Pendencias de Classificacao');
  pendencias.columns = [
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
    if (!t.pendente) return;
    pendencias.addRow({
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
  pendencias.getCell('A1').note =
    'Sugestoes automaticas para lancamentos sem historico parecido. Corrija a Categoria/Subcategoria aqui ' +
    'e repita a mesma escolha na linha indicada da aba Transacoes (e la que os totais do relatorio sao calculados).';

  await workbook.xlsx.writeFile(filePath);
}
