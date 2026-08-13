export const PENDENCIAS_CSS = `
  /* Mesma tecnica da aba Transacoes: colunas enxutas via CSS (posicoes fixas
     em PEND_COLUMNS), nada removido do render generico — o resto dos campos
     continua acessivel no painel de detalhe. */
  #pendencias-table thead th:not(:nth-child(1)):not(:nth-child(2)):not(:nth-child(4)):not(:nth-child(6)):not(:nth-child(7)):not(:nth-child(9)):not(:nth-child(10)),
  #pendencias-table tbody tr:not(.g-tx-detail-row) td:not(:nth-child(1)):not(:nth-child(2)):not(:nth-child(4)):not(:nth-child(6)):not(:nth-child(7)):not(:nth-child(9)):not(:nth-child(10)) {
    display: none;
  }

  #pendencias-table td[data-col="dateISO"] { color: var(--g-text-2); font-size: 12px; white-space: nowrap; }
  #pendencias-table input[type="checkbox"] { accent-color: var(--g-accent); width: 16px; height: 16px; cursor: pointer; }

  #pendencias-table td[data-col="description"] { display: flex; align-items: center; gap: 8px; max-width: 320px; }
  #pendencias-table .g-tx-desc-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--g-text-1); }
  #pendencias-table .g-tx-avatar-sm {
    width: 26px; height: 26px; border-radius: 8px; background: var(--g-card-2);
    display: flex; align-items: center; justify-content: center; font-size: 13px; flex: none;
  }
  #pendencias-table .g-tx-expand {
    flex: none; width: 20px; height: 20px; border: none; background: transparent; color: var(--g-text-3);
    cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s ease;
  }
  #pendencias-table .g-tx-expand.g-open { transform: rotate(90deg); color: var(--g-accent); }

  .g-conf-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px; flex: none; white-space: nowrap; }
  .g-conf-pill.g-conf-alta { background: var(--g-good-soft); color: var(--g-good); }
  .g-conf-pill.g-conf-media { background: var(--g-warn-soft); color: var(--g-warn); }
  .g-conf-pill.g-conf-baixa { background: var(--g-card-2); color: var(--g-text-2); }

  #pendencias-table input.cls-input, #pendencias-table .cls-locked {
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    border: 1px solid var(--g-border);
    border-radius: 100px;
    background: var(--g-card-2);
    color: var(--g-text-1);
    max-width: 130px;
  }
  #pendencias-table input.cls-input:focus {
    outline: none; border-color: var(--g-accent); box-shadow: 0 0 0 3px var(--g-accent-soft); position: relative; z-index: 2;
  }
  #pendencias-table .cls-locked { display: inline-block; color: var(--g-text-2); background: transparent; border-style: dashed; }

  #pendencias-table td[data-col="amount"].g-tx-out { color: var(--g-warn); font-weight: 600; }
  #pendencias-table td[data-col="amount"].g-tx-in { color: var(--g-good); font-weight: 600; }

  .tab-panel .btn-export, .tab-panel .btn-revisado {
    border-radius: 100px;
  }
  .tab-panel .btn-export {
    background: var(--g-accent); border-color: var(--g-accent); color: var(--g-accent-ink);
  }
  .tab-panel .btn-revisado {
    border-color: var(--g-accent); color: var(--g-accent-ink); background: var(--g-accent-soft); font-weight: 700;
  }
  .tab-panel .btn-revisado:hover { background: var(--g-accent); color: var(--g-accent-ink); }

  .pendencias-toolbar label { color: var(--g-text-2); }

  tr.g-tx-detail-row td { background: var(--g-card-2); padding: 14px 20px; }
  .g-tx-detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 20px; }
  .g-tx-detail-field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .g-tx-detail-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--g-text-3); }
  .g-tx-detail-value { font-size: 13px; color: var(--g-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .g-tx-detail-value:empty::after { content: '\\2014'; color: var(--g-text-3); }

  @media (max-width: 860px) {
    #pendencias-table td[data-col="description"] { max-width: 140px; }
  }
`;

export const PENDENCIAS_SCRIPT = `
  (function () {
    const G_PEND_VISIBLE_KEYS = ['_select', '_acao', 'dateISO', 'description', 'amount', 'categoria', 'subcategoria'];
    const G_PEND_DETAIL_COLUMNS = PEND_COLUMNS.filter(function (c) { return G_PEND_VISIBLE_KEYS.indexOf(c.key) === -1; });
    const G_CONF_LABELS = { alta: 'Alta confianca', media: 'Media confianca', baixa: 'Baixa confianca' };

    function g_confPillHtml(t) {
      const conf = t.confianca || 'baixa';
      const label = G_CONF_LABELS[conf] || G_CONF_LABELS.baixa;
      return '<span class="g-conf-pill g-conf-' + conf + '">' + label + '</span>';
    }

    function g_pendDetailHtml(t) {
      return '<div class="g-tx-detail-grid">' + G_PEND_DETAIL_COLUMNS.map(function (c) {
        const content = c.render ? c.render(t) : defaultCellContent(c, t);
        return '<div class="g-tx-detail-field"><span class="g-tx-detail-label">' + esc(c.label) + '</span><span class="g-tx-detail-value">' + content + '</span></div>';
      }).join('') + '</div>';
    }

    function g_closePendDetail(tr) {
      const next = tr.nextElementSibling;
      if (next && next.classList.contains('g-tx-detail-row')) next.remove();
      const btn = tr.querySelector('.g-tx-expand');
      if (btn) btn.classList.remove('g-open');
    }

    function g_togglePendDetail(tr) {
      const next = tr.nextElementSibling;
      if (next && next.classList.contains('g-tx-detail-row')) { g_closePendDetail(tr); return; }
      document.querySelectorAll('#pendencias-table tr.g-tx-detail-row').forEach(function (row) {
        const ownerTr = row.previousElementSibling;
        if (ownerTr) g_closePendDetail(ownerTr); else row.remove();
      });
      const t = findTransaction(tr.dataset.rowId);
      if (!t) return;
      const detailTr = document.createElement('tr');
      detailTr.className = 'g-tx-detail-row';
      detailTr.innerHTML = '<td colspan="7">' + g_pendDetailHtml(t) + '</td>';
      tr.after(detailTr);
      const btn = tr.querySelector('.g-tx-expand');
      if (btn) btn.classList.add('g-open');
    }

    function g_enhancePendenciasRows() {
      document.querySelectorAll('#pendencias-table tbody tr[data-row-id]').forEach(function (tr) {
        const descTd = tr.querySelector('td[data-col="description"]');
        if (descTd && !descTd.dataset.gEnhanced) {
          descTd.dataset.gEnhanced = '1';
          const t = findTransaction(tr.dataset.rowId);
          const text = descTd.textContent;
          const icon = t ? g_categoryAvatarHtml(t.categoria) : '';
          descTd.innerHTML =
            '<button type="button" class="g-tx-expand" data-id="' + tr.dataset.rowId + '">&#9656;</button>' +
            '<span class="g-tx-avatar-sm">' + icon + '</span>' +
            '<span class="g-tx-desc-text">' + esc(text) + '</span>' +
            (t ? g_confPillHtml(t) : '');
        }
        const amountTd = tr.querySelector('td[data-col="amount"]');
        if (amountTd) {
          const t = findTransaction(tr.dataset.rowId);
          if (t) {
            amountTd.classList.toggle('g-tx-out', !!t.isExpense);
            amountTd.classList.toggle('g-tx-in', !t.isExpense);
          }
        }
      });
    }

    const g_originalRenderTable2 = renderTable;
    renderTable = function (tableId, precomputedRows) {
      g_originalRenderTable2(tableId, precomputedRows);
      if (tableId === 'pendencias-table') g_enhancePendenciasRows();
    };
    g_enhancePendenciasRows();

    document.addEventListener('click', function (ev) {
      const expandBtn = ev.target.closest('#pendencias-table .g-tx-expand');
      if (expandBtn) {
        const tr = expandBtn.closest('tr[data-row-id]');
        if (tr) g_togglePendDetail(tr);
      }
    });
  })();
`;
