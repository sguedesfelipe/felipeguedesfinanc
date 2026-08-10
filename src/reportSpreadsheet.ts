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

function buildWorkbook(report: Report): ExcelJS.Workbook {
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

  // Aba dedicada a gestao de emprestimos — so conta o que tem o flag
  // isEmprestimo (categoria "Emprestimos"), que ja vem sempre invalido dos
  // totais gerais (ver applyEmprestimoFlag em aggregate.ts), entao nao
  // aparece em nenhuma outra aba/soma do relatorio.
  const emprestimosTx = report.transactions.filter((t) => t.isEmprestimo);
  const emprestimoSubcatMap = new Map<string, { gasto: number; receita: number; count: number }>();
  for (const t of emprestimosTx) {
    const entry = emprestimoSubcatMap.get(t.subcategoria) ?? { gasto: 0, receita: 0, count: 0 };
    if (t.isExpense) entry.gasto += t.amount;
    else entry.receita += t.amount;
    entry.count += 1;
    emprestimoSubcatMap.set(t.subcategoria, entry);
  }
  const emprestimos = workbook.addWorksheet('Emprestimos');
  emprestimos.columns = [
    { header: 'Subcategoria', key: 'subcategoria', width: 28 },
    { header: 'Total gasto', key: 'gasto', width: 16 },
    { header: 'Total recebido', key: 'receita', width: 16 },
    { header: 'Saldo', key: 'saldo', width: 16 },
    { header: 'Qtde. transacoes', key: 'count', width: 16 },
  ];
  const sortedEmprestimoEntries = [...emprestimoSubcatMap.entries()].sort(
    (a, b) => b[1].receita - b[1].gasto - (a[1].receita - a[1].gasto)
  );
  for (const [subcategoria, entry] of sortedEmprestimoEntries) {
    emprestimos.addRow({ subcategoria, gasto: entry.gasto, receita: entry.receita, saldo: entry.receita - entry.gasto, count: entry.count });
  }
  ['gasto', 'receita', 'saldo'].forEach((key) => (emprestimos.getColumn(key).numFmt = BRL));
  emprestimos.getRow(1).font = { bold: true };
  enableAutoFilter(emprestimos);

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
    { header: 'DataConsiderada', key: 'dataConsiderada', width: 16 },
    { header: 'Conta', key: 'account', width: 22 },
    { header: 'Descricao', key: 'description', width: 40 },
    { header: 'Categoria', key: 'categoria', width: 26 },
    { header: 'Subcategoria', key: 'subcategoria', width: 26 },
    { header: 'Pendente de revisao?', key: 'pendente', width: 18 },
    { header: 'Valido?', key: 'valido', width: 10 },
    { header: 'Emprestimo?', key: 'emprestimo', width: 12 },
    { header: 'Motivo (se invalido)', key: 'motivoInvalido', width: 40 },
    { header: 'Categoria do banco', key: 'bankCategory', width: 22 },
    { header: 'Descricao original do banco', key: 'descriptionRaw', width: 34 },
    { header: 'Moeda', key: 'currencyCode', width: 10 },
    { header: 'Valor na moeda da conta', key: 'amountInAccountCurrency', width: 18 },
    { header: 'Codigo do banco (interno)', key: 'providerCode', width: 20 },
    { header: 'Provider ID (Open Finance)', key: 'providerId', width: 22 },
    { header: 'Estabelecimento', key: 'merchantName', width: 30 },
    { header: 'CNPJ do estabelecimento', key: 'merchantCnpj', width: 20 },
    { header: 'CNAE', key: 'merchantCnae', width: 12 },
    { header: 'Pagador', key: 'payer', width: 34 },
    { header: 'Recebedor', key: 'receiver', width: 34 },
    { header: 'Forma de pagamento', key: 'paymentMethod', width: 18 },
    { header: 'Motivo do pagamento', key: 'paymentReason', width: 26 },
    { header: 'Tipo de transferencia', key: 'transferType', width: 18 },
    { header: 'Identificador do recebedor', key: 'receiverReferenceId', width: 22 },
    { header: 'Linha digitavel (boleto)', key: 'boletoDigitableLine', width: 26 },
    { header: 'Codigo de barras (boleto)', key: 'boletoBarcode', width: 26 },
    { header: 'Valor base (boleto)', key: 'boletoBaseAmount', width: 16 },
    { header: 'Multa (boleto)', key: 'boletoPenaltyAmount', width: 14 },
    { header: 'Juros (boleto)', key: 'boletoInterestAmount', width: 14 },
    { header: 'Desconto (boleto)', key: 'boletoDiscountAmount', width: 16 },
    { header: 'Tipo de operacao', key: 'operationType', width: 22 },
    { header: 'Parcela', key: 'installment', width: 10 },
    { header: 'Valor total da compra', key: 'installmentTotalAmount', width: 18 },
    { header: 'Cartao (final)', key: 'cardLastDigits', width: 14 },
    { header: 'MCC', key: 'payeeMCC', width: 10 },
    { header: 'Data da compra', key: 'purchaseDate', width: 14 },
    { header: 'ID da fatura', key: 'billId', width: 20 },
    { header: 'Mes da fatura', key: 'billForecastMonth', width: 14 },
    { header: 'Tipo de taxa (cartao)', key: 'cardFeeType', width: 22 },
    { header: 'Outro tipo de credito (cartao)', key: 'cardOtherCreditType', width: 24 },
    { header: 'Status (banco)', key: 'statusBanco', width: 14 },
    { header: 'Saldo apos', key: 'balanceAfter', width: 16 },
    { header: 'Criado no Pluggy em', key: 'createdAt', width: 18 },
    { header: 'Atualizado no Pluggy em', key: 'updatedAt', width: 18 },
    { header: 'Tipo', key: 'kind', width: 12 },
    { header: 'Valor', key: 'amount', width: 16 },
  ];
  for (const t of report.transactions) {
    transacoes.addRow({
      id: t.transactionId,
      date: t.date,
      dataConsiderada: t.dataConsiderada,
      account: t.accountName,
      description: t.description,
      categoria: t.categoria,
      subcategoria: t.subcategoria,
      pendente: t.pendente ? 'Sim' : '',
      valido: t.valido ? 'Sim' : 'Nao',
      emprestimo: t.isEmprestimo ? 'Sim' : 'Nao',
      motivoInvalido: t.motivoInvalido,
      bankCategory: t.bankCategory,
      descriptionRaw: t.descriptionRaw,
      currencyCode: t.currencyCode,
      amountInAccountCurrency: t.amountInAccountCurrency,
      providerCode: t.providerCode,
      providerId: t.providerId,
      merchantName: t.merchantName,
      merchantCnpj: t.merchantCnpj,
      merchantCnae: t.merchantCnae,
      payer: t.payer,
      receiver: t.receiver,
      paymentMethod: t.paymentMethod,
      paymentReason: t.paymentReason,
      transferType: t.transferType,
      receiverReferenceId: t.receiverReferenceId,
      boletoDigitableLine: t.boletoDigitableLine,
      boletoBarcode: t.boletoBarcode,
      boletoBaseAmount: t.boletoBaseAmount,
      boletoPenaltyAmount: t.boletoPenaltyAmount,
      boletoInterestAmount: t.boletoInterestAmount,
      boletoDiscountAmount: t.boletoDiscountAmount,
      operationType: t.operationType,
      installment: t.installment,
      installmentTotalAmount: t.installmentTotalAmount,
      cardLastDigits: t.cardLastDigits,
      payeeMCC: t.payeeMCC,
      purchaseDate: t.purchaseDate,
      billId: t.billId,
      billForecastMonth: t.billForecastMonth,
      cardFeeType: t.cardFeeType,
      cardOtherCreditType: t.cardOtherCreditType,
      statusBanco: t.statusBanco,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      kind: t.isExpense ? 'Gasto' : 'Receita',
      amount: t.amount,
    });
  }
  ['date', 'dataConsiderada', 'purchaseDate'].forEach((key) => (transacoes.getColumn(key).numFmt = 'dd/mm/yyyy'));
  ['createdAt', 'updatedAt'].forEach((key) => (transacoes.getColumn(key).numFmt = 'dd/mm/yyyy hh:mm'));
  [
    'amount',
    'installmentTotalAmount',
    'balanceAfter',
    'amountInAccountCurrency',
    'boletoBaseAmount',
    'boletoPenaltyAmount',
    'boletoInterestAmount',
    'boletoDiscountAmount',
  ].forEach((key) => (transacoes.getColumn(key).numFmt = BRL));
  transacoes.getRow(1).font = { bold: true };
  applyClassificationDropdowns(transacoes, categoriasRange, subcategoriasRange);
  addColumnValidation(transacoes, 'valido', VALIDO_VALIDATION);
  enableAutoFilter(transacoes);

  const pendencias = workbook.addWorksheet('Pendencias de Classificacao');
  pendencias.columns = [
    { header: 'Revisado?', key: 'revisado', width: 12 },
    { header: 'Por que ficou pendente', key: 'motivo', width: 46 },
    { header: 'ID', key: 'id', width: 22 },
    { header: 'Data', key: 'date', width: 14 },
    { header: 'DataConsiderada', key: 'dataConsiderada', width: 16 },
    { header: 'Conta', key: 'account', width: 22 },
    { header: 'Descricao', key: 'description', width: 40 },
    { header: 'Valor', key: 'amount', width: 16 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Categoria sugerida', key: 'categoria', width: 26 },
    { header: 'Subcategoria sugerida', key: 'subcategoria', width: 26 },
    { header: 'Linha na aba Transacoes', key: 'linha', width: 20 },
  ];
  report.transactions.forEach((t, index) => {
    if (!t.pendente || !t.valido) return;
    pendencias.addRow({
      revisado: '',
      motivo: t.motivoClassificacao,
      id: t.transactionId,
      date: t.date,
      dataConsiderada: t.dataConsiderada,
      account: t.accountName,
      description: t.description,
      amount: t.amount,
      tipo: t.isExpense ? 'Gasto' : 'Receita',
      categoria: t.categoria,
      subcategoria: t.subcategoria,
      linha: index + 2,
    });
  });
  ['date', 'dataConsiderada'].forEach((key) => (pendencias.getColumn(key).numFmt = 'dd/mm/yyyy'));
  pendencias.getColumn('amount').numFmt = BRL;
  pendencias.getRow(1).font = { bold: true };
  applyClassificationDropdowns(pendencias, categoriasRange, subcategoriasRange);
  addColumnValidation(pendencias, 'revisado', {
    type: 'list',
    allowBlank: true,
    showErrorMessage: false,
    formulae: ['"Sim,Nao"'],
    promptTitle: 'Revisado?',
    prompt: 'Marque "Sim" depois de conferir a classificacao (nao afeta os totais aqui, e so um lembrete pra voce).',
    showInputMessage: true,
  });
  enableAutoFilter(pendencias);
  pendencias.getCell('C1').note =
    'Sugestoes automaticas para lancamentos sem historico parecido. Corrija a Categoria/Subcategoria aqui ' +
    'e repita a mesma escolha na linha indicada da aba Transacoes (e la que os totais do relatorio sao calculados).';

  return workbook;
}

export async function writeSpreadsheet(report: Report, filePath: string): Promise<void> {
  await buildWorkbook(report).xlsx.writeFile(filePath);
}

// Mesma planilha, em memoria — usada pelo botao "Baixar Excel" do dashboard
// hospedado, que gera o arquivo sob demanda a partir dos dados atuais em vez
// de escrever num caminho local.
export async function writeSpreadsheetBuffer(report: Report): Promise<ExcelJS.Buffer> {
  return buildWorkbook(report).xlsx.writeBuffer();
}
