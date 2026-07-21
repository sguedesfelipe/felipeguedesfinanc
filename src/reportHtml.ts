import { Report } from './aggregate.js';
import { CATEGORIAS, SUBCATEGORIAS } from './classify.js';

interface ClientTransaction {
  id: number;
  transactionId: string;
  dateISO: string;
  dateLabel: string;
  month: string;
  accountId: string;
  account: string;
  description: string;
  descriptionRaw: string;
  categoria: string;
  subcategoria: string;
  bankCategory: string;
  merchantName: string;
  merchantCnpj: string;
  merchantCnae: string;
  payer: string;
  receiver: string;
  paymentMethod: string;
  operationType: string;
  installment: string;
  installmentTotalAmount: number | null;
  cardLastDigits: string;
  payeeMCC: string;
  purchaseDateLabel: string;
  statusBanco: string;
  balanceAfter: number | null;
  pendente: boolean;
  motivo: string;
  valido: boolean;
  motivoInvalido: string;
  isExpense: boolean;
  amount: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toClientTransactions(report: Report): ClientTransaction[] {
  return report.transactions.map((t, id) => ({
    id,
    transactionId: t.transactionId,
    dateISO: t.date.toISOString().slice(0, 10),
    dateLabel: t.date.toLocaleDateString('pt-BR'),
    month: monthKey(t.date),
    accountId: t.accountId,
    account: t.accountName,
    description: t.description,
    descriptionRaw: t.descriptionRaw,
    categoria: t.categoria,
    subcategoria: t.subcategoria,
    bankCategory: t.bankCategory,
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
    purchaseDateLabel: t.purchaseDate ? t.purchaseDate.toLocaleDateString('pt-BR') : '',
    statusBanco: t.statusBanco,
    balanceAfter: t.balanceAfter,
    pendente: t.pendente,
    motivo: t.motivoClassificacao,
    valido: t.valido,
    motivoInvalido: t.motivoInvalido,
    isExpense: t.isExpense,
    amount: t.amount,
  }));
}

// Todo o relatorio (KPIs, graficos e as 4 abas) e calculado e renderizado no
// navegador a partir deste payload — e o que permite o filtro de periodo e a
// edicao de categoria/subcategoria se refletirem em tudo, sem precisar de
// servidor.
function buildClientPayload(report: Report): string {
  const payload = {
    transactions: toClientTransactions(report),
    accounts: report.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })),
    categorias: CATEGORIAS,
    subcategorias: SUBCATEGORIAS,
  };
  // Escapa "<" para nao correr risco de uma descricao de transacao fechar a
  // tag <script> (ex.: "</script>") no meio do JSON embutido.
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

function clientScript(): string {
  return `
  const DATA = REPORT_DATA;
  const state = DATA.transactions;
  const brl = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const monthLabel = (m) => { const [y, mm] = m.split('-'); return MONTH_NAMES[Number(mm) - 1] + '/' + y.slice(2); };

  // --- filtro de periodo, valido para as 5 tabelas ---
  const allDates = state.map((t) => t.dateISO).sort();
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];
  const fromInput = document.getElementById('filter-from');
  const toInput = document.getElementById('filter-to');
  fromInput.min = toInput.min = minDate;
  fromInput.max = toInput.max = maxDate;
  fromInput.value = minDate;
  toInput.value = maxDate;

  function getFiltered() {
    const from = fromInput.value || minDate;
    const to = toInput.value || maxDate;
    return state.filter((t) => t.dateISO >= from && t.dateISO <= to);
  }

  function findTransaction(id) {
    return state.find((t) => t.id === Number(id));
  }

  function datalistOptions(id, values) {
    return '<datalist id="' + id + '">' + values.map((v) => '<option value="' + esc(v) + '"></option>').join('') + '</datalist>';
  }
  document.getElementById('datalists').innerHTML =
    datalistOptions('categorias-list', DATA.categorias) + datalistOptions('subcategorias-list', DATA.subcategorias);

  function classificationInput(t, field) {
    const list = field === 'categoria' ? 'categorias-list' : 'subcategorias-list';
    return '<input class="cls-input" list="' + list + '" data-id="' + t.id + '" data-field="' + field + '" value="' + esc(t[field]) + '">';
  }

  function validoCheckbox(t) {
    return '<input type="checkbox" class="valido-input" data-id="' + t.id + '"' + (t.valido ? ' checked' : '') + '>';
  }

  // --- agregacoes (so consideram transacoes com valido=true) ---
  function computeTotals(filtered) {
    const validas = filtered.filter((t) => t.valido);
    let expenses = 0, income = 0;
    for (const t of validas) { if (t.isExpense) expenses += t.amount; else income += t.amount; }
    return {
      expenses, income, net: income - expenses,
      count: validas.length,
      pendentes: validas.filter((t) => t.pendente).length,
    };
  }

  function computeMonthly(filtered) {
    const map = new Map();
    for (const t of filtered) {
      if (!t.valido) continue;
      const m = map.get(t.month) || { month: t.month, expenses: 0, income: 0 };
      if (t.isExpense) m.expenses += t.amount; else m.income += t.amount;
      map.set(t.month, m);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }

  function computeCategorias(filtered) {
    const map = new Map();
    for (const t of filtered) {
      if (!t.valido || !t.isExpense) continue;
      const key = t.categoria || '(sem categoria)';
      const entry = map.get(key) || { category: key, total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  function computeMerchants(filtered) {
    const map = new Map();
    for (const t of filtered) {
      if (!t.valido || !t.isExpense) continue;
      const entry = map.get(t.description) || { description: t.description, total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(t.description, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 15);
  }

  function computeAccounts(filtered) {
    const byAccount = new Map();
    for (const t of filtered) {
      if (!t.valido || !t.isExpense) continue;
      byAccount.set(t.accountId, (byAccount.get(t.accountId) || 0) + t.amount);
    }
    return DATA.accounts.map((a) => ({ ...a, totalExpenses: byAccount.get(a.id) || 0 }));
  }

  // --- aba Resumo: KPIs + grafico mensal (as 5 tabelas ficam em renderTable) ---
  function renderResumo(filtered) {
    const totals = computeTotals(filtered);
    document.getElementById('kpi-expenses').textContent = brl(totals.expenses);
    document.getElementById('kpi-income').textContent = brl(totals.income);
    const netEl = document.getElementById('kpi-net');
    netEl.textContent = brl(totals.net);
    netEl.classList.toggle('net-positive', totals.net >= 0);
    document.getElementById('kpi-count').textContent = totals.count;
    const pendEl = document.getElementById('kpi-pendentes');
    pendEl.textContent = totals.pendentes;
    pendEl.classList.toggle('net-negative', totals.pendentes > 0);
    document.getElementById('pend-tab-count').textContent = totals.pendentes;

    const months = computeMonthly(filtered);
    const max = Math.max(1, ...months.map((m) => m.expenses));
    document.getElementById('monthly-chart').innerHTML =
      '<div class="bar-chart">' +
      months
        .map(
          (m) =>
            '<div class="bar-col"><div class="bar-track"><div class="bar-fill" style="height:' +
            Math.round((m.expenses / max) * 100) +
            '%" title="' + monthLabel(m.month) + ': ' + brl(m.expenses) + '"></div></div><div class="bar-label">' + monthLabel(m.month) + '</div></div>'
        )
        .join('') +
      '</div>';

    renderCategoriasChart(filtered);
  }

  function renderCategoriasChart(filtered) {
    const categorias = computeCategorias(filtered);
    const catMax = Math.max(1, ...categorias.map((c) => c.total));
    document.getElementById('categorias-chart').innerHTML =
      '<div class="hbar-chart">' +
      categorias
        .map(
          (c) =>
            '<div class="hbar-row"><div class="hbar-label">' + esc(c.category) + '</div><div class="hbar-track"><div class="hbar-fill" style="width:' +
            Math.max(2, Math.round((c.total / catMax) * 100)) + '%" title="' + esc(c.category) + ': ' + brl(c.total) + '"></div></div><div class="hbar-value">' +
            brl(c.total) + '</div></div>'
        )
        .join('') +
      '</div>';
  }

  // --- tabelas genericas: cabecalho clicavel pra ordenar + filtro por coluna ---
  const TX_COLUMNS = [
    { key: 'transactionId', label: 'ID', value: (t) => t.transactionId },
    { key: 'dateISO', label: 'Data', value: (t) => t.dateISO, render: (t) => t.dateLabel },
    { key: 'account', label: 'Conta', value: (t) => t.account },
    { key: 'description', label: 'Descricao', value: (t) => t.description },
    { key: 'categoria', label: 'Categoria', value: (t) => t.categoria, render: (t) => classificationInput(t, 'categoria') },
    { key: 'subcategoria', label: 'Subcategoria', value: (t) => t.subcategoria, render: (t) => classificationInput(t, 'subcategoria') },
    { key: 'pendente', label: 'Pendente', value: (t) => (t.pendente ? 'Sim' : 'Nao'), render: (t) => (t.pendente ? '<span class="badge-pend">pendente</span>' : '') },
    { key: 'valido', label: 'Valido?', value: (t) => (t.valido ? 'Sim' : 'Nao'), render: (t) => validoCheckbox(t) },
    { key: 'motivoInvalido', label: 'Motivo (invalido)', value: (t) => t.motivoInvalido },
    { key: 'bankCategory', label: 'Categoria do banco', value: (t) => t.bankCategory },
    { key: 'descriptionRaw', label: 'Descricao original do banco', value: (t) => t.descriptionRaw },
    { key: 'merchantName', label: 'Estabelecimento', value: (t) => t.merchantName },
    { key: 'merchantCnpj', label: 'CNPJ do estabelecimento', value: (t) => t.merchantCnpj },
    { key: 'merchantCnae', label: 'CNAE', value: (t) => t.merchantCnae },
    { key: 'payer', label: 'Pagador', value: (t) => t.payer },
    { key: 'receiver', label: 'Recebedor', value: (t) => t.receiver },
    { key: 'paymentMethod', label: 'Forma de pagamento', value: (t) => t.paymentMethod },
    { key: 'operationType', label: 'Tipo de operacao', value: (t) => t.operationType },
    { key: 'installment', label: 'Parcela', value: (t) => t.installment },
    { key: 'installmentTotalAmount', label: 'Valor total da compra', value: (t) => t.installmentTotalAmount, type: 'currency' },
    { key: 'cardLastDigits', label: 'Cartao (final)', value: (t) => t.cardLastDigits },
    { key: 'payeeMCC', label: 'MCC', value: (t) => t.payeeMCC },
    { key: 'purchaseDateLabel', label: 'Data da compra', value: (t) => t.purchaseDateLabel },
    { key: 'statusBanco', label: 'Status (banco)', value: (t) => t.statusBanco },
    { key: 'balanceAfter', label: 'Saldo apos', value: (t) => t.balanceAfter, type: 'currency' },
    { key: 'isExpense', label: 'Tipo', value: (t) => (t.isExpense ? 'Gasto' : 'Receita') },
    { key: 'amount', label: 'Valor', value: (t) => t.amount, type: 'currency' },
  ];
  const PEND_COLUMNS = TX_COLUMNS.concat([
    { key: 'motivo', label: 'Motivo da pendencia', value: (t) => t.motivo },
    { key: '_acao', label: '', value: () => '', render: (t) => '<button type="button" class="btn-revisado" data-id="' + t.id + '">Marcar como revisado</button>', noSort: true, noFilter: true },
  ]);
  const CAT_COLUMNS = [
    { key: 'category', label: 'Categoria', value: (c) => c.category },
    { key: 'total', label: 'Total gasto', value: (c) => c.total, type: 'currency' },
    { key: 'count', label: 'Qtde.', value: (c) => c.count, type: 'number' },
  ];
  const MERCHANT_COLUMNS = [
    { key: 'description', label: 'Descricao', value: (m) => m.description },
    { key: 'count', label: 'Qtde.', value: (m) => m.count, type: 'number' },
    { key: 'total', label: 'Total', value: (m) => m.total, type: 'currency' },
  ];
  const ACCOUNT_COLUMNS = [
    { key: 'name', label: 'Conta', value: (a) => a.name },
    { key: 'typeLabel', label: 'Tipo', value: (a) => (a.type === 'CREDIT' ? 'Cartao de credito' : 'Conta') },
    { key: 'balance', label: 'Saldo atual', value: (a) => a.balance, type: 'currency' },
    { key: 'totalExpenses', label: 'Gasto no periodo', value: (a) => a.totalExpenses, type: 'currency' },
  ];

  const TABLE_DEFS = {
    'transacoes-table': { columns: TX_COLUMNS, rows: () => getFiltered(), rowId: (t) => t.id },
    'pendencias-table': { columns: PEND_COLUMNS, rows: () => getFiltered().filter((t) => t.pendente && t.valido), rowId: (t) => t.id },
    'categorias-table': { columns: CAT_COLUMNS, rows: () => computeCategorias(getFiltered()) },
    'merchants-table': { columns: MERCHANT_COLUMNS, rows: () => computeMerchants(getFiltered()) },
    'accounts-table': { columns: ACCOUNT_COLUMNS, rows: () => computeAccounts(getFiltered()) },
  };
  const tableStates = {};

  function defaultCellContent(col, row) {
    const v = col.value(row);
    return col.type === 'currency' ? (v == null ? '' : brl(v)) : esc(v);
  }

  function cellHtml(col, row) {
    const content = col.render ? col.render(row) : defaultCellContent(col, row);
    const cls = col.type === 'currency' || col.type === 'number' ? ' class="num"' : '';
    return '<td' + cls + '>' + content + '</td>';
  }

  function compareRows(a, b, col) {
    const av = col.value(a);
    const bv = col.value(b);
    if (col.type === 'currency' || col.type === 'number') return (av ?? -Infinity) - (bv ?? -Infinity);
    return String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR');
  }

  function buildHeaderHtml(tableId, columns) {
    const state = tableStates[tableId];
    return (
      '<tr>' +
      columns
        .map((c) => {
          const arrow = state.sortKey === c.key ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '';
          const sortAttr = c.noSort ? '' : ' data-sort-key="' + c.key + '" data-table="' + tableId + '"';
          const filterHtml = c.noFilter
            ? ''
            : '<br><input type="text" class="col-filter" data-table="' + tableId + '" data-filter-key="' + c.key + '" placeholder="filtrar...">';
          return '<th' + sortAttr + (c.noSort ? '' : ' class="sortable"') + '>' + esc(c.label) + arrow + filterHtml + '</th>';
        })
        .join('') +
      '</tr>'
    );
  }

  function initTable(tableId) {
    tableStates[tableId] = { sortKey: null, sortDir: 1, filters: {} };
    document.querySelector('#' + tableId + ' thead').innerHTML = buildHeaderHtml(tableId, TABLE_DEFS[tableId].columns);
  }

  function renderTable(tableId) {
    const def = TABLE_DEFS[tableId];
    const state = tableStates[tableId];
    let rows = def.rows();

    const activeFilters = Object.entries(state.filters).filter(([, v]) => v);
    if (activeFilters.length > 0) {
      rows = rows.filter((row) =>
        activeFilters.every(([key, needle]) => {
          const col = def.columns.find((c) => c.key === key);
          return String(col.value(row) ?? '').toLowerCase().includes(needle.toLowerCase());
        })
      );
    }
    if (state.sortKey) {
      const col = def.columns.find((c) => c.key === state.sortKey);
      rows = [...rows].sort((a, b) => state.sortDir * compareRows(a, b, col));
    }

    document.querySelector('#' + tableId + ' tbody').innerHTML = rows
      .map((row) => {
        const idAttr = def.rowId ? ' data-row-id="' + def.rowId(row) + '"' : '';
        return '<tr' + idAttr + '>' + def.columns.map((c) => cellHtml(c, row)).join('') + '</tr>';
      })
      .join('');
  }

  Object.keys(TABLE_DEFS).forEach(initTable);

  document.addEventListener('click', (ev) => {
    const th = ev.target.closest('th[data-sort-key]');
    if (th) {
      const tableId = th.dataset.table;
      const state = tableStates[tableId];
      const key = th.dataset.sortKey;
      if (state.sortKey === key) state.sortDir *= -1;
      else { state.sortKey = key; state.sortDir = 1; }
      document.querySelector('#' + tableId + ' thead').innerHTML = buildHeaderHtml(tableId, TABLE_DEFS[tableId].columns);
      renderTable(tableId);
      return;
    }

    const btn = ev.target.closest('.btn-revisado');
    if (btn) {
      const t = findTransaction(btn.dataset.id);
      if (!t) return;
      t.pendente = false;
      renderTable('pendencias-table');
      renderTable('transacoes-table');
      renderResumo(getFiltered());
    }
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.classList && el.classList.contains('col-filter')) {
      tableStates[el.dataset.table].filters[el.dataset.filterKey] = el.value;
      renderTable(el.dataset.table);
      return;
    }
    if (el.classList && el.classList.contains('cls-input')) {
      const t = findTransaction(el.dataset.id);
      if (!t) return;
      t[el.dataset.field] = el.value;
      document.querySelectorAll('input.cls-input[data-id="' + el.dataset.id + '"][data-field="' + el.dataset.field + '"]').forEach((other) => {
        if (other !== el) other.value = el.value;
      });
      renderTable('categorias-table');
      renderCategoriasChart(getFiltered());
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('valido-input')) return;
    const t = findTransaction(el.dataset.id);
    if (!t) return;
    t.valido = el.checked;
    document.querySelectorAll('.valido-input[data-id="' + el.dataset.id + '"]').forEach((other) => {
      if (other !== el) other.checked = el.checked;
    });
    renderResumo(getFiltered());
    renderTable('categorias-table');
    renderTable('merchants-table');
    renderTable('accounts-table');
    renderTable('pendencias-table');
  });

  // --- exportar aba Transacoes para .csv (abre direto no Excel/Sheets) ---
  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvValue(col, row) {
    const v = col.value(row);
    if ((col.type === 'currency' || col.type === 'number') && typeof v === 'number') {
      return String(v).replace('.', ',');
    }
    return v;
  }

  function exportTransacoesCsv() {
    const rows = getFiltered();
    const lines = [TX_COLUMNS.map((c) => csvEscape(c.label)).join(';')];
    for (const t of rows) {
      lines.push(TX_COLUMNS.map((c) => csvEscape(csvValue(c, t))).join(';'));
    }
    const csv = '﻿' + lines.join('\\r\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacoes-' + fromInput.value + '_a_' + toInput.value + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  document.getElementById('export-transacoes').addEventListener('click', exportTransacoesCsv);

  function renderAll() {
    const filtered = getFiltered();
    renderResumo(filtered);
    Object.keys(TABLE_DEFS).forEach(renderTable);
  }

  fromInput.addEventListener('change', renderAll);
  toInput.addEventListener('change', renderAll);
  document.getElementById('filter-clear').addEventListener('click', () => {
    fromInput.value = minDate;
    toInput.value = maxDate;
    renderAll();
  });

  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.toggle('active', btn === b));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    })
  );

  renderAll();
  `;
}

export function buildHtmlReport(report: Report, dateFrom: string, dateTo: string): string {
  const generatedAt = new Date().toLocaleString('pt-BR');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatorio de gastos</title>
<style>
  .viz-root {
    color-scheme: light;
    --surface-1:      #fcfcfb;
    --page:           #f9f9f7;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --text-muted:     #898781;
    --grid:           #e1e0d9;
    --baseline:       #c3c2b7;
    --border:         rgba(11,11,11,0.10);
    --series-1:       #2a78d6;
    --series-1-soft:  #cde2fb;
    --good:           #006300;
    --warn:           #9a5b00;
  }
  @media (prefers-color-scheme: dark) {
    .viz-root {
      color-scheme: dark;
      --surface-1:      #1a1a19;
      --page:           #0d0d0d;
      --text-primary:   #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted:     #898781;
      --grid:           #2c2c2a;
      --baseline:       #383835;
      --border:         rgba(255,255,255,0.10);
      --series-1:       #3987e5;
      --series-1-soft:  #184f95;
      --good:           #0ca30c;
      --warn:           #e0a030;
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--page);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: var(--text-secondary); font-size: 14px; margin: 0 0 20px; }
  h2 { font-size: 16px; margin: 0 0 12px; color: var(--text-primary); }
  section { margin-bottom: 36px; }

  .card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .filter-bar label { color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
  .filter-bar input[type="date"] {
    font: inherit;
    padding: 5px 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text-primary);
  }
  .filter-bar button {
    font: inherit;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text-primary);
    cursor: pointer;
  }
  .filter-bar .filter-hint { color: var(--text-muted); }

  .tab-bar { display: flex; gap: 6px; margin-bottom: 20px; border-bottom: 1px solid var(--border); }
  .tab-btn {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    font-size: 14px;
    font-family: inherit;
    padding: 10px 14px;
    cursor: pointer;
  }
  .tab-btn.active { color: var(--text-primary); border-bottom-color: var(--series-1); font-weight: 600; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .kpi-tile {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
  }
  .kpi-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
  .kpi-value { font-size: 24px; font-weight: 600; font-variant-numeric: proportional-nums; }
  .kpi-value.net-positive { color: var(--good); }
  .kpi-value.net-negative { color: var(--warn); }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    height: 200px;
    border-bottom: 1px solid var(--baseline);
    padding-top: 8px;
  }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 6px; }
  .bar-track { width: 100%; height: 100%; display: flex; align-items: flex-end; }
  .bar-fill { width: 100%; background: var(--series-1); border-radius: 4px 4px 0 0; min-height: 2px; }
  .bar-label { font-size: 11px; color: var(--text-muted); }

  .hbar-chart { display: flex; flex-direction: column; gap: 10px; }
  .hbar-row { display: grid; grid-template-columns: 200px 1fr 110px; align-items: center; gap: 10px; }
  .hbar-label { font-size: 13px; color: var(--text-secondary); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hbar-track { background: var(--series-1-soft); border-radius: 4px; height: 14px; }
  .hbar-fill { background: var(--series-1); height: 100%; border-radius: 4px; min-width: 4px; }
  .hbar-value { font-size: 13px; color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .table-scroll { overflow-x: auto; max-height: 70vh; }
  table.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.data-table th, table.data-table td { padding: 8px 10px; border-bottom: 1px solid var(--grid); text-align: left; white-space: nowrap; }
  table.data-table th { color: var(--text-secondary); font-weight: 600; font-size: 12px; position: sticky; top: 0; background: var(--surface-1); vertical-align: top; }
  table.data-table th.sortable { cursor: pointer; user-select: none; }
  table.data-table th.sortable:hover { color: var(--text-primary); }
  table.data-table td.num, table.data-table th.num { text-align: right; font-variant-numeric: tabular-nums; }

  input.col-filter {
    font: inherit;
    font-size: 11px;
    font-weight: 400;
    padding: 3px 6px;
    margin-top: 4px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--page);
    color: var(--text-primary);
    width: 100%;
    box-sizing: border-box;
    cursor: text;
  }

  input.cls-input {
    font: inherit;
    font-size: 12px;
    padding: 5px 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text-primary);
    width: 130px;
  }
  input.cls-input:focus, input.col-filter:focus { outline: 2px solid var(--series-1); outline-offset: 1px; }

  .badge-pend {
    display: inline-block;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--warn);
    color: #fff;
  }
  .btn-revisado {
    font: inherit;
    font-size: 12px;
    padding: 5px 10px;
    border: 1px solid var(--series-1);
    border-radius: 6px;
    background: transparent;
    color: var(--series-1);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-revisado:hover { background: var(--series-1-soft); }

  .transacoes-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .btn-export {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    border: 1px solid var(--series-1);
    border-radius: 6px;
    background: var(--series-1);
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-export:hover { opacity: 0.9; }

  footer { color: var(--text-muted); font-size: 12px; margin-top: 40px; }
</style>
</head>
<body class="viz-root">
  <div class="wrap">
    <h1>Relatorio de gastos</h1>
    <p class="subtitle">Dados buscados no Pluggy de ${dateFrom} a ${dateTo} &middot; Gerado em ${generatedAt}</p>

    <div class="filter-bar">
      <label>De <input type="date" id="filter-from"></label>
      <label>Ate <input type="date" id="filter-to"></label>
      <button type="button" id="filter-clear">Limpar filtro</button>
      <span class="filter-hint">O periodo selecionado vale para todas as abas.</span>
    </div>

    <div class="tab-bar">
      <button class="tab-btn active" data-tab="resumo">Resumo</button>
      <button class="tab-btn" data-tab="categorias">Categorias</button>
      <button class="tab-btn" data-tab="transacoes">Transacoes</button>
      <button class="tab-btn" data-tab="pendencias">Pendencias de Classificacao (<span id="pend-tab-count">0</span>)</button>
    </div>

    <div id="tab-resumo" class="tab-panel active">
      <section class="kpi-row">
        <div class="kpi-tile">
          <div class="kpi-label">Total de gastos</div>
          <div class="kpi-value" id="kpi-expenses"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Total de receitas</div>
          <div class="kpi-value" id="kpi-income"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Saldo no periodo</div>
          <div class="kpi-value" id="kpi-net"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Transacoes no periodo</div>
          <div class="kpi-value" id="kpi-count"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Pendentes de classificacao</div>
          <div class="kpi-value" id="kpi-pendentes"></div>
        </div>
      </section>

      <section class="card" style="margin-top:24px;">
        <h2>Gastos por mes</h2>
        <div id="monthly-chart"></div>
      </section>

      <section class="card">
        <h2>Maiores gastos (por descricao)</h2>
        <div class="table-scroll">
          <table class="data-table" id="merchants-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Contas conectadas</h2>
        <div class="table-scroll">
          <table class="data-table" id="accounts-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-categorias" class="tab-panel">
      <section class="card">
        <h2>Gastos por categoria</h2>
        <div id="categorias-chart"></div>
      </section>
      <section class="card">
        <div class="table-scroll">
          <table class="data-table" id="categorias-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-transacoes" class="tab-panel">
      <section class="card">
        <div class="transacoes-toolbar">
          <p class="subtitle" style="margin:0;">Clique num cabecalho pra ordenar, digite no campo abaixo dele pra filtrar. Edite Categoria/Subcategoria/Valido direto na tabela — os totais das outras abas se ajustam sozinhos. Todos os dados que o Pluggy devolveu para cada lancamento estao aqui (quando o banco/cartao os fornece).</p>
          <button type="button" id="export-transacoes" class="btn-export">Exportar CSV</button>
        </div>
        <div class="table-scroll">
          <table class="data-table" id="transacoes-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-pendencias" class="tab-panel">
      <section class="card">
        <p class="subtitle">Lancamentos sem historico parecido, com uma sugestao automatica. Ajuste a classificacao e clique em "Marcar como revisado".</p>
        <div class="table-scroll">
          <table class="data-table" id="pendencias-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <footer id="datalists">
      Relatorio gerado localmente a partir da API do Pluggy. As edicoes de classificacao e o filtro de periodo feitos aqui ficam so nesta pagina aberta no navegador —
      para valerem no proximo relatorio, repita a mesma classificacao na planilha (.xlsx) gerada junto com este arquivo.
    </footer>
  </div>
  <script>
    const REPORT_DATA = ${buildClientPayload(report)};
    ${clientScript()}
  </script>
</body>
</html>`;
}
