import ExcelJS from 'exceljs';
import { Report } from './aggregate.js';

const BRL = '#,##0.00';

export async function writeSpreadsheet(report: Report, filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Relatorio de gastos Pluggy';
  workbook.created = new Date();

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
    { header: 'Categoria', key: 'category', width: 24 },
    { header: 'Tipo', key: 'kind', width: 12 },
    { header: 'Valor', key: 'amount', width: 16 },
  ];
  for (const t of report.transactions) {
    transacoes.addRow({
      date: t.date,
      account: t.accountName,
      description: t.description,
      category: t.category,
      kind: t.isExpense ? 'Gasto' : 'Receita',
      amount: t.amount,
    });
  }
  transacoes.getColumn('date').numFmt = 'dd/mm/yyyy';
  transacoes.getColumn('amount').numFmt = BRL;
  transacoes.getRow(1).font = { bold: true };

  await workbook.xlsx.writeFile(filePath);
}
