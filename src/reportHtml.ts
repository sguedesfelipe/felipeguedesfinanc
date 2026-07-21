import { Report } from './aggregate.js';
import { CATEGORIAS, SUBCATEGORIAS } from './classify.js';

interface ClientTransaction {
  id: number;
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
  isExpense: boolean;
  amount: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toClientTransactions(report: Report): ClientTransaction[] {
  return report.transactions.map((t, id) => ({
    id,
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

  // --- filtro de periodo, valido para as 4 abas ---
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

  function datalistOptions(id, values) {
    return '<datalist id="' + id + '">' + values.map((v) => '<option value="' + esc(v) + '"></option>').join('') + '</datalist>';
  }
  document.getElementById('datalists').innerHTML =
    datalistOptions('categorias-list', DATA.categorias) + datalistOptions('subcategorias-list', DATA.subcategorias);

  function classificationInputs(t) {
    return (
      '<input class="cls-input" list="categorias-list" data-id="' + t.id + '" data-field="categoria" value="' + esc(t.categoria) + '" placeholder="Categoria">' +
      '<input class="cls-input" list="subcategorias-list" data-id="' + t.id + '" data-field="subcategoria" value="' + esc(t.subcategoria) + '" placeholder="Subcategoria">'
    );
  }

  // --- aba Resumo ---
  function renderResumo(filtered) {
    let expenses = 0, income = 0;
    const monthly = new Map();
    const merchants = new Map();
    const accountExpenses = new Map();
    for (const t of filtered) {
      const me = monthly.get(t.month) || { month: t.month, expenses: 0, income: 0 };
      if (t.isExpense) {
        expenses += t.amount;
        me.expenses += t.amount;
        accountExpenses.set(t.accountId, (accountExpenses.get(t.accountId) || 0) + t.amount);
        const me2 = merchants.get(t.description) || { description: t.description, total: 0, count: 0 };
        me2.total += t.amount;
        me2.count += 1;
        merchants.set(t.description, me2);
      } else {
        income += t.amount;
        me.income += t.amount;
      }
      monthly.set(t.month, me);
    }
    const pendentes = filtered.filter((t) => t.pendente).length;

    document.getElementById('kpi-expenses').textContent = brl(expenses);
    document.getElementById('kpi-income').textContent = brl(income);
    const netEl = document.getElementById('kpi-net');
    netEl.textContent = brl(income - expenses);
    netEl.classList.toggle('net-positive', income - expenses >= 0);
    document.getElementById('kpi-count').textContent = filtered.length;
    const pendEl = document.getElementById('kpi-pendentes');
    pendEl.textContent = pendentes;
    pendEl.classList.toggle('net-negative', pendentes > 0);
    document.getElementById('pend-tab-count').textContent = pendentes;

    const months = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month));
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

    const topMerchants = [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 15);
    document.querySelector('#merchants-table tbody').innerHTML = topMerchants
      .map((m) => '<tr><td>' + esc(m.description) + '</td><td class="num">' + m.count + '</td><td class="num">' + brl(m.total) + '</td></tr>')
      .join('');

    document.querySelector('#accounts-table tbody').innerHTML = DATA.accounts
      .map(
        (a) =>
          '<tr><td>' + esc(a.name) + '</td><td>' + (a.type === 'CREDIT' ? 'Cartao de credito' : 'Conta') + '</td><td class="num">' +
          brl(a.balance) + '</td><td class="num">' + brl(accountExpenses.get(a.id) || 0) + '</td></tr>'
      )
      .join('');
  }

  // --- aba Categorias ---
  function computeCategorias(filtered) {
    const map = new Map();
    for (const t of filtered) {
      if (!t.isExpense) continue;
      const key = t.categoria || '(sem categoria)';
      const entry = map.get(key) || { category: key, total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  function renderCategorias(filtered) {
    const categorias = computeCategorias(filtered);
    const max = Math.max(1, ...categorias.map((c) => c.total));
    document.getElementById('categorias-chart').innerHTML =
      '<div class="hbar-chart">' +
      categorias
        .map(
          (c) =>
            '<div class="hbar-row"><div class="hbar-label">' + esc(c.category) + '</div><div class="hbar-track"><div class="hbar-fill" style="width:' +
            Math.max(2, Math.round((c.total / max) * 100)) + '%" title="' + esc(c.category) + ': ' + brl(c.total) + '"></div></div><div class="hbar-value">' +
            brl(c.total) + '</div></div>'
        )
        .join('') +
      '</div>';
    document.querySelector('#categorias-table tbody').innerHTML = categorias
      .map((c) => '<tr><td>' + esc(c.category) + '</td><td class="num">' + brl(c.total) + '</td><td class="num">' + c.count + '</td></tr>')
      .join('');
  }

  // --- aba Transacoes ---
  function transactionRow(t, extraCols) {
    return \`
        <tr data-row-id="\${t.id}">
          <td>\${t.dateLabel}</td>
          <td>\${esc(t.account)}</td>
          <td>\${esc(t.description)}</td>
          <td class="cls-cell">\${classificationInputs(t)}</td>
          <td>\${t.pendente ? '<span class="badge-pend">pendente</span>' : ''}</td>
          <td>\${esc(t.bankCategory)}</td>
          <td>\${esc(t.descriptionRaw)}</td>
          <td>\${esc(t.merchantName)}</td>
          <td>\${esc(t.merchantCnpj)}</td>
          <td>\${esc(t.merchantCnae)}</td>
          <td>\${esc(t.payer)}</td>
          <td>\${esc(t.receiver)}</td>
          <td>\${esc(t.paymentMethod)}</td>
          <td>\${esc(t.operationType)}</td>
          <td>\${esc(t.installment)}</td>
          <td class="num">\${t.installmentTotalAmount != null ? brl(t.installmentTotalAmount) : ''}</td>
          <td>\${esc(t.cardLastDigits)}</td>
          <td>\${esc(t.payeeMCC)}</td>
          <td>\${esc(t.purchaseDateLabel)}</td>
          <td>\${esc(t.statusBanco)}</td>
          <td class="num">\${t.balanceAfter != null ? brl(t.balanceAfter) : ''}</td>
          <td>\${t.isExpense ? 'Gasto' : 'Receita'}</td>
          <td class="num">\${brl(t.amount)}</td>
          \${extraCols ? extraCols(t) : ''}
        </tr>\`;
  }

  function renderTransacoes(filtered) {
    document.querySelector('#transacoes-table tbody').innerHTML = filtered.map((t) => transactionRow(t)).join('');
  }

  // --- aba Pendencias de Classificacao ---
  function renderPendencias(filtered) {
    const pendentes = filtered.filter((t) => t.pendente);
    document.querySelector('#pendencias-table tbody').innerHTML = pendentes
      .map((t) =>
        transactionRow(
          t,
          (t) => '<td>' + esc(t.motivo) + '</td><td><button type="button" class="btn-revisado" data-id="' + t.id + '">Marcar como revisado</button></td>'
        )
      )
      .join('');
  }

  function renderAll() {
    const filtered = getFiltered();
    renderResumo(filtered);
    renderCategorias(filtered);
    renderTransacoes(filtered);
    renderPendencias(filtered);
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

  function findTransaction(id) {
    return state.find((t) => t.id === Number(id));
  }

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('cls-input')) return;
    const t = findTransaction(el.dataset.id);
    if (!t) return;
    t[el.dataset.field] = el.value;
    document.querySelectorAll('input.cls-input[data-id="' + el.dataset.id + '"][data-field="' + el.dataset.field + '"]').forEach((other) => {
      if (other !== el) other.value = el.value;
    });
    renderCategorias(getFiltered());
  });

  document.addEventListener('click', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('btn-revisado')) return;
    const t = findTransaction(el.dataset.id);
    if (!t) return;
    t.pendente = false;
    el.closest('tr').remove();
    const badge = document.querySelector('#transacoes-table tr[data-row-id="' + t.id + '"] .badge-pend');
    if (badge) badge.remove();
    const pendEl = document.getElementById('kpi-pendentes');
    const n = Number(pendEl.textContent) - 1;
    pendEl.textContent = n;
    pendEl.classList.toggle('net-negative', n > 0);
    document.getElementById('pend-tab-count').textContent = n;
  });

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
  table.data-table th { color: var(--text-secondary); font-weight: 600; position: sticky; top: 0; background: var(--surface-1); }
  table.data-table td.num, table.data-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.cls-cell { display: flex; gap: 6px; }

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
  input.cls-input:focus { outline: 2px solid var(--series-1); outline-offset: 1px; }

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
            <thead><tr><th>Descricao</th><th class="num">Qtde.</th><th class="num">Total</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Contas conectadas</h2>
        <div class="table-scroll">
          <table class="data-table" id="accounts-table">
            <thead><tr><th>Conta</th><th>Tipo</th><th class="num">Saldo atual</th><th class="num">Gasto no periodo</th></tr></thead>
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
            <thead><tr><th>Categoria</th><th class="num">Total gasto</th><th class="num">Qtde.</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-transacoes" class="tab-panel">
      <section class="card">
        <p class="subtitle">Edite Categoria/Subcategoria diretamente na tabela — os totais da aba Categorias se ajustam sozinhos. Todos os dados que o Pluggy devolveu para cada lancamento estao aqui (quando o banco/cartao os fornece).</p>
        <div class="table-scroll">
          <table class="data-table" id="transacoes-table">
            <thead><tr>
              <th>Data</th><th>Conta</th><th>Descricao</th><th>Categoria / Subcategoria</th><th></th>
              <th>Categoria do banco</th><th>Descricao original do banco</th><th>Estabelecimento</th>
              <th>CNPJ do estabelecimento</th><th>CNAE</th><th>Pagador</th><th>Recebedor</th>
              <th>Forma de pagamento</th><th>Tipo de operacao</th><th>Parcela</th>
              <th class="num">Valor total da compra</th><th>Cartao (final)</th><th>MCC</th>
              <th>Data da compra</th><th>Status (banco)</th><th class="num">Saldo apos</th>
              <th>Tipo</th><th class="num">Valor</th>
            </tr></thead>
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
            <thead><tr>
              <th>Data</th><th>Conta</th><th>Descricao</th><th>Categoria / Subcategoria</th><th></th>
              <th>Categoria do banco</th><th>Descricao original do banco</th><th>Estabelecimento</th>
              <th>CNPJ do estabelecimento</th><th>CNAE</th><th>Pagador</th><th>Recebedor</th>
              <th>Forma de pagamento</th><th>Tipo de operacao</th><th>Parcela</th>
              <th class="num">Valor total da compra</th><th>Cartao (final)</th><th>MCC</th>
              <th>Data da compra</th><th>Status (banco)</th><th class="num">Saldo apos</th>
              <th>Tipo</th><th class="num">Valor</th><th>Motivo</th><th></th>
            </tr></thead>
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
