import { Report } from './aggregate.js';

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

function categoryBarChart(report: Report): string {
  const top = report.categories.slice(0, 8);
  const rest = report.categories.slice(8);
  const otherTotal = rest.reduce((sum, c) => sum + c.total, 0);
  const rows = [...top];
  if (otherTotal > 0) rows.push({ category: 'Outras categorias', total: otherTotal, count: rest.length });

  const max = Math.max(1, ...rows.map((r) => r.total));
  const items = rows
    .map((r) => {
      const widthPct = Math.max(2, Math.round((r.total / max) * 100));
      return `
        <div class="hbar-row">
          <div class="hbar-label">${escapeHtml(r.category)}</div>
          <div class="hbar-track">
            <div class="hbar-fill" style="width:${widthPct}%" title="${escapeHtml(r.category)}: ${formatBRL(r.total)}"></div>
          </div>
          <div class="hbar-value">${formatBRL(r.total)}</div>
        </div>`;
    })
    .join('');
  return `<div class="hbar-chart">${items}</div>`;
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
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--page);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: var(--text-secondary); font-size: 14px; margin: 0 0 28px; }
  h2 { font-size: 16px; margin: 0 0 12px; color: var(--text-primary); }
  section { margin-bottom: 36px; }

  .card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
  }

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
  .hbar-row { display: grid; grid-template-columns: 160px 1fr 110px; align-items: center; gap: 10px; }
  .hbar-label { font-size: 13px; color: var(--text-secondary); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hbar-track { background: var(--series-1-soft); border-radius: 4px; height: 14px; }
  .hbar-fill { background: var(--series-1); height: 100%; border-radius: 4px; min-width: 4px; }
  .hbar-value { font-size: 13px; color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .table-scroll { overflow-x: auto; }
  table.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.data-table th, table.data-table td { padding: 8px 10px; border-bottom: 1px solid var(--grid); text-align: left; }
  table.data-table th { color: var(--text-secondary); font-weight: 600; }
  table.data-table td.num, table.data-table th.num { text-align: right; font-variant-numeric: tabular-nums; }

  footer { color: var(--text-muted); font-size: 12px; margin-top: 40px; }
</style>
</head>
<body class="viz-root">
  <div class="wrap">
    <h1>Relatorio de gastos</h1>
    <p class="subtitle">Periodo: ${dateFrom} a ${dateTo} &middot; Gerado em ${generatedAt} &middot; Dados via Pluggy API</p>

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
    </section>

    <section class="card">
      <h2>Gastos por mes</h2>
      ${monthlyBarChart(report)}
    </section>

    <section class="card">
      <h2>Gastos por categoria</h2>
      ${categoryBarChart(report)}
    </section>

    <section class="card">
      <h2>Maiores gastos (por descricao)</h2>
      <div class="table-scroll">${merchantsTable(report)}</div>
    </section>

    <section class="card">
      <h2>Contas conectadas</h2>
      <div class="table-scroll">${accountsTable(report)}</div>
    </section>

    <footer>
      Relatorio gerado localmente a partir da API do Pluggy. A lista completa de transacoes esta disponivel na planilha gerada junto com este arquivo.
    </footer>
  </div>
</body>
</html>`;
}
