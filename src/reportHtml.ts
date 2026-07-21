import { Report } from './aggregate.js';
import { CATEGORIAS, SUBCATEGORIAS } from './classify.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  const names = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
  ];
  return `${names[Number(m) - 1]}/${year.slice(2)}`;
}

function monthlyBarChart(report: Report): string {
  const max = Math.max(1, ...report.monthly.map((m) => m.expenses));
  const bars = report.monthly
    .map((m) => {
      const heightPct = Math.round((m.expenses / max) * 100);
      return `
        <div class="bar-col">
          <div class="bar-track">
            <div class="bar-fill" style="height:${heightPct}%" title="${monthLabel(m.month)}: ${formatBRL(m.expenses)}"></div>
          </div>
          <div class="bar-label">${monthLabel(m.month)}</div>
        </div>`;
    })
    .join('');
  return `<div class="bar-chart">${bars}</div>`;
}

function merchantsTable(report: Report): string {
  const rows = report.merchants
    .map(
      (m) => `
        <tr>
          <td>${escapeHtml(m.description)}</td>
          <td class="num">${m.count}</td>
          <td class="num">${formatBRL(m.total)}</td>
        </tr>`
    )
    .join('');
  return `
    <table class="data-table">
      <thead><tr><th>Descricao</th><th class="num">Qtde.</th><th class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function accountsTable(report: Report): string {
  const rows = report.accounts
    .map(
      (a) => `
        <tr>
          <td>${escapeHtml(a.name)}</td>
          <td>${a.type === 'CREDIT' ? 'Cartao de credito' : 'Conta'}</td>
          <td class="num">${formatBRL(a.balance)}</td>
          <td class="num">${formatBRL(a.totalExpenses)}</td>
        </tr>`
    )
    .join('');
  return `
    <table class="data-table">
      <thead><tr><th>Conta</th><th>Tipo</th><th class="num">Saldo atual</th><th class="num">Gasto no periodo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

interface ClientTransaction {
  id: number;
  dateLabel: string;
  account: string;
  description: string;
  categoria: string;
  subcategoria: string;
  bankCategory: string;
  pendente: boolean;
  motivo: string;
  isExpense: boolean;
  amount: number;
}

function toClientTransactions(report: Report): ClientTransaction[] {
  return report.transactions.map((t, id) => ({
    id,
    dateLabel: t.date.toLocaleDateString('pt-BR'),
    account: t.accountName,
    description: t.description,
    categoria: t.categoria,
    subcategoria: t.subcategoria,
    bankCategory: t.bankCategory,
    pendente: t.pendente,
    motivo: t.motivoClassificacao,
    isExpense: t.isExpense,
    amount: t.amount,
  }));
}

// Payload embutido no HTML para as abas Categorias/Transacoes/Pendencias, que
// sao renderizadas e recalculadas inteiramente no navegador (sem servidor),
// permitindo editar a classificacao e ver o relatorio inteiro se ajustar.
function buildClientPayload(report: Report): string {
  const payload = {
    transactions: toClientTransactions(report),
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
  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'categorias') renderCategorias();
    if (name === 'pendencias') renderPendencias();
  }
  document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  function pendentesCount() {
    return state.filter((t) => t.pendente).length;
  }

  function refreshPendentesKpi() {
    const n = pendentesCount();
    document.getElementById('kpi-pendentes').textContent = n;
    document.getElementById('kpi-pendentes').classList.toggle('net-negative', n > 0);
    const tabCount = document.getElementById('pend-tab-count');
    if (tabCount) tabCount.textContent = n;
  }

  function datalistOptions(id, values) {
    return '<datalist id="' + id + '">' + values.map((v) => '<option value="' + esc(v) + '"></option>').join('') + '</datalist>';
  }
  document.getElementById('datalists').innerHTML =
    datalistOptions('categorias-list', DATA.categorias) + datalistOptions('subcategorias-list', DATA.subcategorias);

  function classificationInputs(t) {
    return (
      '<input class="cls-input" list="categorias-list" data-id="' + t.id + '" data-field="categoria" value="' + esc(t.categoria) + '">' +
      '<input class="cls-input" list="subcategorias-list" data-id="' + t.id + '" data-field="subcategoria" value="' + esc(t.subcategoria) + '">'
    );
  }

  function renderTransacoes() {
    const rows = state
      .map(
        (t) => \`
        <tr data-row-id="\${t.id}">
          <td>\${t.dateLabel}</td>
          <td>\${esc(t.account)}</td>
          <td>\${esc(t.description)}</td>
          <td class="cls-cell">\${classificationInputs(t)}</td>
          <td>\${t.pendente ? '<span class="badge-pend">pendente</span>' : ''}</td>
          <td>\${esc(t.bankCategory)}</td>
          <td>\${t.isExpense ? 'Gasto' : 'Receita'}</td>
          <td class="num">\${brl(t.amount)}</td>
        </tr>\`
      )
      .join('');
    document.querySelector('#transacoes-table tbody').innerHTML = rows;
  }

  function computeCategorias() {
    const map = new Map();
    for (const t of state) {
      if (!t.isExpense) continue;
      const key = t.categoria || '(sem categoria)';
      const entry = map.get(key) || { category: key, total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  function renderCategorias() {
    const categorias = computeCategorias();
    const max = Math.max(1, ...categorias.map((c) => c.total));
    const chart = categorias
      .map(
        (c) => \`
        <div class="hbar-row">
          <div class="hbar-label">\${esc(c.category)}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:\${Math.max(2, Math.round((c.total / max) * 100))}%" title="\${esc(c.category)}: \${brl(c.total)}"></div></div>
          <div class="hbar-value">\${brl(c.total)}</div>
        </div>\`
      )
      .join('');
    document.getElementById('categorias-chart').innerHTML = '<div class="hbar-chart">' + chart + '</div>';

    const rows = categorias
      .map((c) => \`<tr><td>\${esc(c.category)}</td><td class="num">\${brl(c.total)}</td><td class="num">\${c.count}</td></tr>\`)
      .join('');
    document.querySelector('#categorias-table tbody').innerHTML = rows;
  }

  function renderPendencias() {
    const pendentes = state.filter((t) => t.pendente);
    const rows = pendentes
      .map(
        (t) => \`
        <tr data-row-id="\${t.id}">
          <td>\${t.dateLabel}</td>
          <td>\${esc(t.account)}</td>
          <td>\${esc(t.description)}</td>
          <td class="cls-cell">\${classificationInputs(t)}</td>
          <td class="num">\${brl(t.amount)}</td>
          <td>\${esc(t.motivo)}</td>
          <td><button type="button" class="btn-revisado" data-id="\${t.id}">Marcar como revisado</button></td>
        </tr>\`
      )
      .join('');
    document.querySelector('#pendencias-table tbody').innerHTML = rows;
  }

  function findTransaction(id) {
    return state.find((t) => t.id === Number(id));
  }

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('cls-input')) return;
    const t = findTransaction(el.dataset.id);
    if (!t) return;
    t[el.dataset.field] = el.value;
    // mantem a mesma linha sincronizada caso ela apareca nas duas abas (Transacoes e Pendencias)
    document.querySelectorAll('input.cls-input[data-id="' + el.dataset.id + '"][data-field="' + el.dataset.field + '"]').forEach((other) => {
      if (other !== el) other.value = el.value;
    });
  });

  document.addEventListener('click', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('btn-revisado')) return;
    const t = findTransaction(el.dataset.id);
    if (!t) return;
    t.pendente = false;
    el.closest('tr').remove();
    const tRow = document.querySelector('#transacoes-table tr[data-row-id="' + t.id + '"] .badge-pend');
    if (tRow) tRow.remove();
    refreshPendentesKpi();
  });

  renderTransacoes();
  refreshPendentesKpi();
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
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
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
  table.data-table th, table.data-table td { padding: 8px 10px; border-bottom: 1px solid var(--grid); text-align: left; }
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
    width: 140px;
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
    <p class="subtitle">Periodo: ${dateFrom} a ${dateTo} &middot; Gerado em ${generatedAt} &middot; Dados via Pluggy API</p>

    <div class="tab-bar">
      <button class="tab-btn active" data-tab="resumo">Resumo</button>
      <button class="tab-btn" data-tab="categorias">Categorias</button>
      <button class="tab-btn" data-tab="transacoes">Transacoes</button>
      <button class="tab-btn" data-tab="pendencias">Pendencias de Classificacao (<span id="pend-tab-count">${report.totals.pendentesClassificacao}</span>)</button>
    </div>

    <div id="tab-resumo" class="tab-panel active">
      <section class="kpi-row">
        <div class="kpi-tile">
          <div class="kpi-label">Total de gastos</div>
          <div class="kpi-value">${formatBRL(report.totals.expenses)}</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Total de receitas</div>
          <div class="kpi-value">${formatBRL(report.totals.income)}</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Saldo no periodo</div>
          <div class="kpi-value ${report.totals.net >= 0 ? 'net-positive' : ''}">${formatBRL(report.totals.net)}</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Transacoes analisadas</div>
          <div class="kpi-value">${report.totals.transactionCount}</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Pendentes de classificacao</div>
          <div class="kpi-value${report.totals.pendentesClassificacao > 0 ? ' net-negative' : ''}" id="kpi-pendentes">${report.totals.pendentesClassificacao}</div>
        </div>
      </section>

      <section class="card" style="margin-top:24px;">
        <h2>Gastos por mes</h2>
        ${monthlyBarChart(report)}
      </section>

      <section class="card">
        <h2>Maiores gastos (por descricao)</h2>
        <div class="table-scroll">${merchantsTable(report)}</div>
      </section>

      <section class="card">
        <h2>Contas conectadas</h2>
        <div class="table-scroll">${accountsTable(report)}</div>
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
        <p class="subtitle">Edite Categoria/Subcategoria diretamente na tabela — os totais da aba Categorias se ajustam sozinhos.</p>
        <div class="table-scroll">
          <table class="data-table" id="transacoes-table">
            <thead><tr><th>Data</th><th>Conta</th><th>Descricao</th><th>Categoria / Subcategoria</th><th></th><th>Categoria do banco</th><th>Tipo</th><th class="num">Valor</th></tr></thead>
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
            <thead><tr><th>Data</th><th>Conta</th><th>Descricao</th><th>Categoria / Subcategoria</th><th class="num">Valor</th><th>Motivo</th><th></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <footer id="datalists">
      Relatorio gerado localmente a partir da API do Pluggy. As edicoes de classificacao feitas aqui ficam so nesta pagina aberta no navegador —
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
