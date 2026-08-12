// Redesign "Grana" da aba Resumo: hero de saldo, cartoes de gastos/receitas,
// graficos de barra reestilizados (mesma logica de sempre, so CSS novo),
// lista de categorias rankeada e ultimas transacoes. So consome as funcoes
// de calculo que ja existem (computeTotals, computeByDimension,
// computeTimeSeries via renderTimeSeriesChart) — nenhum calculo novo aqui.

export const RESUMO_CSS = `
  /* ---- hero + stats ---- */
  .g-hero {
    background: var(--g-hero-bg); color: var(--g-hero-text);
    border-radius: 24px; padding: 24px 26px 20px; box-shadow: var(--g-shadow-1);
    margin-bottom: 14px;
  }
  .g-hero-label { font-size: 12px; font-weight: 600; color: rgba(242,245,243,0.6); }
  .g-hero-amount { font-size: 42px; font-weight: 700; letter-spacing: -0.02em; margin: 8px 0 4px; font-variant-numeric: tabular-nums; display: block; }
  .g-hero-amount.net-positive { color: #7CE3B8; }
  .g-hero-amount.net-negative { color: #F0B389; }
  .g-hero-meta { font-size: 12.5px; color: rgba(242,245,243,0.65); margin: 0; }
  .g-hero-meta strong { color: var(--g-hero-text); font-weight: 700; }

  .g-stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 18px; }
  .g-stat-card { background: var(--g-card); border: 1px solid var(--g-border); border-radius: 18px; padding: 14px 16px; }
  .g-stat-card .g-stat-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .g-stat-icon { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex: none; }
  .g-stat-card.g-expense .g-stat-icon { background: var(--g-warn-soft); color: var(--g-warn); }
  .g-stat-card.g-income .g-stat-icon { background: var(--g-good-soft); color: var(--g-good); }
  .g-stat-label { font-size: 12px; color: var(--g-text-2); margin: 0 0 4px; }
  .g-stat-amount { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; color: var(--g-text-1); }

  /* ---- reskin dos graficos de barra existentes (mesma logica/markup) ---- */
  .g-chart-card { background: var(--g-card); border: 1px solid var(--g-border); border-radius: 20px; padding: 18px 20px; margin-bottom: 14px; }
  .g-chart-card .chart-header { margin-bottom: 4px; }
  .g-chart-card h2 { font-size: 15px; font-weight: 700; letter-spacing: -0.005em; }
  .bar-chart {
    display: flex; align-items: flex-end; gap: 8px; height: 150px;
    border-bottom: 1px solid var(--g-border); padding-top: 22px;
    overflow-x: auto; overflow-y: hidden;
  }
  .bar-fill { background: color-mix(in srgb, var(--g-text-1) 22%, transparent); border-radius: 7px 7px 2px 2px; }
  .bar-fill.income { background: color-mix(in srgb, var(--g-good) 45%, transparent); }
  .bar-fill.is-selected { background: var(--g-text-1); box-shadow: none; }
  .bar-fill.income.is-selected { background: var(--g-good); }
  .bar-fill.is-dimmed { opacity: 0.35; }
  .bar-label { font-size: 10.5px; font-weight: 600; color: var(--g-text-3); }
  .bar-value { color: var(--g-text-2); font-weight: 700; }
  #bar-selection-info { color: var(--g-text-2); }
  .g-chart-card .chart-header select {
    font: inherit; font-size: 12px; font-weight: 600; color: var(--g-text-1);
    background: var(--g-card-2); border: 1px solid var(--g-border); border-radius: 8px; padding: 5px 8px;
  }

  /* ---- lista de categorias + ultimas transacoes ---- */
  .g-panels-row { display: grid; grid-template-columns: 1fr 1.4fr; gap: 14px; margin-bottom: 14px; }
  .g-panel { background: var(--g-card); border: 1px solid var(--g-border); border-radius: 20px; padding: 18px 20px; }
  .g-panel-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
  .g-panel-head h2 { font-size: 14.5px; font-weight: 700; margin: 0; }

  .g-cat-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; }
  .g-cat-row .g-emoji { width: 30px; height: 30px; border-radius: 9px; background: var(--g-card-2); display: flex; align-items: center; justify-content: center; font-size: 14px; flex: none; }
  .g-cat-row .g-cb-mid { flex: 1; min-width: 0; }
  .g-cat-row .g-cb-top { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; margin-bottom: 6px; }
  .g-cat-row .g-cb-name { font-weight: 600; color: var(--g-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .g-cat-row .g-cb-amt { font-weight: 700; font-variant-numeric: tabular-nums; flex: none; }
  .g-bar-track { height: 6px; border-radius: 3px; background: var(--g-card-2); overflow: hidden; }
  .g-bar-fill-thin { height: 100%; border-radius: 3px; background: var(--g-accent); }
  .g-empty-note { font-size: 12.5px; color: var(--g-text-3); padding: 6px 0; }

  .g-tx-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--g-border); }
  .g-tx-row:last-child { border-bottom: none; }
  .g-tx-avatar { width: 36px; height: 36px; border-radius: 11px; background: var(--g-card-2); display: flex; align-items: center; justify-content: center; font-size: 15px; flex: none; }
  .g-tx-mid { flex: 1; min-width: 0; }
  .g-tx-desc { font-size: 13px; font-weight: 600; margin: 0 0 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--g-text-1); }
  .g-tx-meta { font-size: 11px; color: var(--g-text-3); display: flex; align-items: center; gap: 6px; }
  .g-tx-tag { font-size: 10px; font-weight: 600; background: var(--g-card-2); color: var(--g-text-2); padding: 2px 7px; border-radius: 100px; }
  .g-tx-amount { font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; flex: none; }
  .g-tx-amount.g-out { color: var(--g-text-1); }
  .g-tx-amount.g-in { color: var(--g-good); }

  .g-secondary-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .g-secondary-panels .card { border-radius: 20px; }

  @media (max-width: 900px) {
    .g-panels-row, .g-secondary-panels { grid-template-columns: 1fr; }
  }
`;

// Mapa de icone por categoria — a taxonomia (CATEGORIAS) e so uma lista de
// strings, sem metadado de icone/cor, entao o mapeamento e por
// palavra-chave (comparado com foldClient, que ja existe no motor). Categoria
// fora do mapa cai no fallback de avatar com a inicial.
export const CATEGORY_ICON_SCRIPT = `
  const G_CATEGORY_ICONS = {
    'ALIMENTACAO': '\u{1F6D2}',
    'ASSINATURAS': '\u{1F4FA}',
    'COMPRAS E LAZER': '\u{1F6CD}️',
    'EMPRESTIMOS': '\u{1F91D}',
    'INVESTIMENTOS': '\u{1F4C8}',
    'MORADIA': '\u{1F3E0}',
    'NEGOCIOS': '\u{1F4BC}',
    'OUTROS': '\u{2733}️',
    'RENDA': '\u{1F4B0}',
    'SAUDE E BEM ESTAR': '\u{1F48A}',
    'SEGUROS': '\u{1F6E1}️',
    'SERVICOS FINANCEIROS E BANCARIOS': '\u{1F3E6}',
    'TRANSPORTE': '\u{1F697}',
    'VIAGEM': '\u{2708}️',
  };
  function g_categoryIcon(categoria) {
    return G_CATEGORY_ICONS[foldClient(categoria)] || null;
  }
  function g_categoryAvatarHtml(categoria) {
    const icon = g_categoryIcon(categoria);
    if (icon) return icon;
    return '<span style="font-size:12px;font-weight:700;">' + esc((categoria || '?').trim().charAt(0).toUpperCase()) + '</span>';
  }
`;

export function resumoTabHtml(): string {
  return `
    <div id="tab-resumo" class="tab-panel active">
      <div class="g-hero">
        <div class="g-hero-label">Saldo no periodo</div>
        <span class="g-hero-amount" id="kpi-net"></span>
        <p class="g-hero-meta">
          <strong id="kpi-count"></strong> transacao(oes) no periodo &middot;
          <strong id="kpi-pendentes"></strong> pendente(s) de classificacao
        </p>
      </div>

      <div class="g-stats-row">
        <div class="g-stat-card g-expense">
          <div class="g-stat-top"><span class="g-stat-icon">&darr;</span></div>
          <p class="g-stat-label">Total de gastos</p>
          <span class="g-stat-amount" id="kpi-expenses"></span>
        </div>
        <div class="g-stat-card g-income">
          <div class="g-stat-top"><span class="g-stat-icon">&uarr;</span></div>
          <p class="g-stat-label">Total de receitas</p>
          <span class="g-stat-amount" id="kpi-income"></span>
        </div>
      </div>

      <section class="g-chart-card">
        <div class="chart-header">
          <h2>Gastos ao longo do tempo</h2>
          <div style="display:flex;align-items:center;gap:12px;">
            <span id="bar-selection-info"></span>
            <select id="chart-granularity">
              <option value="dia">Por dia</option>
              <option value="mes" selected>Acumulado por mes</option>
              <option value="trimestre">Acumulado por trimestre</option>
              <option value="semestre">Acumulado por semestre</option>
              <option value="ano">Acumulado por ano</option>
            </select>
          </div>
        </div>
        <p class="subtitle" style="margin:0 0 4px;">Clique numa barra pra selecionar aquele periodo (Ctrl+clique pra selecionar varios) — filtra o resto do relatorio sem esconder as outras barras.</p>
        <div id="monthly-chart"></div>
      </section>

      <section class="g-chart-card">
        <h2>Receitas ao longo do tempo</h2>
        <div id="monthly-income-chart"></div>
      </section>

      <div class="g-panels-row">
        <div class="g-panel">
          <div class="g-panel-head"><h2>Gastos por categoria</h2></div>
          <div id="g-resumo-cat-list"></div>
        </div>
        <div class="g-panel">
          <div class="g-panel-head"><h2>Ultimas transacoes</h2></div>
          <div id="g-resumo-tx-list"></div>
        </div>
      </div>

      <div class="g-secondary-panels">
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
    </div>`;
}

export const RESUMO_SCRIPT = `
  ${CATEGORY_ICON_SCRIPT}

  function g_renderResumoCategoryList(filtered) {
    const rows = computeByDimension(filtered, 'categoria', true, true).slice(0, 6);
    const el = document.getElementById('g-resumo-cat-list');
    if (!el) return;
    if (rows.length === 0) { el.innerHTML = '<p class="g-empty-note">Sem gastos no periodo.</p>'; return; }
    const max = rows[0].total || 1;
    el.innerHTML = rows.map((r) => {
      const pct = Math.round((r.total / max) * 100);
      return '<div class="g-cat-row">' +
        '<div class="g-emoji">' + g_categoryAvatarHtml(r.category) + '</div>' +
        '<div class="g-cb-mid"><div class="g-cb-top"><span class="g-cb-name">' + esc(r.category) + '</span><span class="g-cb-amt">' + brl(r.total) + '</span></div>' +
        '<div class="g-bar-track"><div class="g-bar-fill-thin" style="width:' + pct + '%"></div></div></div>' +
        '</div>';
    }).join('');
  }

  function g_renderResumoTxList(filtered) {
    const rows = filtered.slice(0, 6);
    const el = document.getElementById('g-resumo-tx-list');
    if (!el) return;
    if (rows.length === 0) { el.innerHTML = '<p class="g-empty-note">Nenhuma transacao no periodo.</p>'; return; }
    el.innerHTML = rows.map((t) => {
      const amountClass = t.isExpense ? 'g-out' : 'g-in';
      const sign = t.isExpense ? '-' : '+';
      return '<div class="g-tx-row">' +
        '<div class="g-tx-avatar">' + g_categoryAvatarHtml(t.categoria) + '</div>' +
        '<div class="g-tx-mid"><p class="g-tx-desc">' + esc(t.description) + '</p>' +
        '<div class="g-tx-meta"><span class="g-tx-tag">' + esc(t.categoria) + '</span><span>' + esc(t.dataConsideradaLabel) + '</span></div></div>' +
        '<div class="g-tx-amount ' + amountClass + '">' + sign + brl(t.amount) + '</div>' +
        '</div>';
    }).join('');
  }

  // Envolve o renderResumo original (motor, inalterado) so pra tambem
  // popular as duas listas novas — mesmo filtro "filtered" (com selecao de
  // barra aplicada) que o resto do Resumo ja usa.
  const g_originalRenderResumo = renderResumo;
  renderResumo = function (base) {
    g_originalRenderResumo(base);
    const filtered = applyBarSelection(base);
    g_renderResumoCategoryList(filtered);
    g_renderResumoTxList(filtered);
  };
  // O motor ja chamou renderAll()/renderResumo() uma vez antes deste script
  // rodar (usando a versao original) — repete aqui pra preencher o hero/
  // listas novas na carga inicial da pagina, sem esperar o usuario mexer
  // em algum filtro.
  renderResumo(getBaseFiltered());
`;
