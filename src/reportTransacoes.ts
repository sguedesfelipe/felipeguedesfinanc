export const TRANSACOES_CSS = `
  /* Colunas enxutas: so Descricao/Categoria/Subcategoria/Valor/Conta/Valido
     ficam visiveis por padrao (posicoes fixas em TX_COLUMNS, contadas em
     ordem 1-indexada). O restante dos ~40 campos do Pluggy continua no DOM
     (nada foi removido de TX_COLUMNS nem do render generico), so escondido
     por CSS — abre no painel de detalhe (linha extra) ao clicar no chevron. */
  #transacoes-table thead th:not(:nth-child(3)):not(:nth-child(4)):not(:nth-child(5)):not(:nth-child(6)):not(:nth-child(8)):not(:nth-child(10)),
  #transacoes-table tbody tr:not(.g-tx-detail-row) td:not(:nth-child(3)):not(:nth-child(4)):not(:nth-child(5)):not(:nth-child(6)):not(:nth-child(8)):not(:nth-child(10)) {
    display: none;
  }

  #transacoes-table td[data-col="description"] { display: flex; align-items: center; gap: 8px; max-width: 360px; }
  #transacoes-table .g-tx-desc-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--g-text-1); }
  #transacoes-table .g-tx-avatar-sm {
    width: 26px; height: 26px; border-radius: 8px; background: var(--g-card-2);
    display: flex; align-items: center; justify-content: center; font-size: 13px; flex: none;
  }
  #transacoes-table .g-tx-expand {
    flex: none; width: 20px; height: 20px; border: none; background: transparent; color: var(--g-text-3);
    cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s ease;
  }
  #transacoes-table .g-tx-expand.g-open { transform: rotate(90deg); color: var(--g-accent); }

  #transacoes-table td[data-col="amount"].g-tx-out { color: var(--g-warn); font-weight: 600; }
  #transacoes-table td[data-col="amount"].g-tx-in { color: var(--g-good); font-weight: 600; }

  #transacoes-table input.cls-input, #transacoes-table .cls-locked {
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    border: 1px solid var(--g-border);
    border-radius: 100px;
    background: var(--g-card-2);
    color: var(--g-text-1);
    max-width: 140px;
  }
  #transacoes-table input.cls-input:focus {
    outline: none;
    border-color: var(--g-accent);
    box-shadow: 0 0 0 3px var(--g-accent-soft);
    position: relative;
    z-index: 2;
  }
  #transacoes-table .cls-locked { display: inline-block; color: var(--g-text-2); background: transparent; border-style: dashed; }

  #transacoes-table input.valido-input {
    -webkit-appearance: none; appearance: none;
    width: 34px; height: 20px; border-radius: 100px; background: var(--g-card-2); border: 1px solid var(--g-border);
    position: relative; cursor: pointer; flex: none; vertical-align: middle;
  }
  #transacoes-table input.valido-input::before {
    content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
    background: var(--g-text-3); transition: transform 0.15s ease, background 0.15s ease;
  }
  #transacoes-table input.valido-input:checked { background: var(--g-good-soft); border-color: var(--g-good); }
  #transacoes-table input.valido-input:checked::before { background: var(--g-good); transform: translateX(14px); }

  tr.g-tx-detail-row td { background: var(--g-card-2); padding: 14px 20px; }
  .g-tx-detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 20px; }
  .g-tx-detail-field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .g-tx-detail-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--g-text-3); }
  .g-tx-detail-value { font-size: 13px; color: var(--g-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .g-tx-detail-value:empty::after { content: '\\2014'; color: var(--g-text-3); }

  @media (max-width: 860px) {
    #transacoes-table td[data-col="description"] { max-width: 160px; }
  }
`;

export const TRANSACOES_SCRIPT = `
  (function () {
    const G_TX_VISIBLE_KEYS = ['description', 'categoria', 'subcategoria', 'amount', 'account', 'valido'];
    const G_TX_DETAIL_COLUMNS = TX_COLUMNS.filter(function (c) { return G_TX_VISIBLE_KEYS.indexOf(c.key) === -1; });

    function g_txDetailHtml(t) {
      return '<div class="g-tx-detail-grid">' + G_TX_DETAIL_COLUMNS.map(function (c) {
        const content = c.render ? c.render(t) : defaultCellContent(c, t);
        return '<div class="g-tx-detail-field"><span class="g-tx-detail-label">' + esc(c.label) + '</span><span class="g-tx-detail-value">' + content + '</span></div>';
      }).join('') + '</div>';
    }

    function g_closeTxDetail(tr) {
      const next = tr.nextElementSibling;
      if (next && next.classList.contains('g-tx-detail-row')) next.remove();
      const btn = tr.querySelector('.g-tx-expand');
      if (btn) btn.classList.remove('g-open');
    }

    function g_toggleTxDetail(tr) {
      const next = tr.nextElementSibling;
      if (next && next.classList.contains('g-tx-detail-row')) { g_closeTxDetail(tr); return; }
      document.querySelectorAll('#transacoes-table tr.g-tx-detail-row').forEach(function (row) {
        const ownerTr = row.previousElementSibling;
        if (ownerTr) g_closeTxDetail(ownerTr); else row.remove();
      });
      const t = findTransaction(tr.dataset.rowId);
      if (!t) return;
      const detailTr = document.createElement('tr');
      detailTr.className = 'g-tx-detail-row';
      detailTr.innerHTML = '<td colspan="6">' + g_txDetailHtml(t) + '</td>';
      tr.after(detailTr);
      const btn = tr.querySelector('.g-tx-expand');
      if (btn) btn.classList.add('g-open');
    }

    function g_enhanceTransacoesRows() {
      document.querySelectorAll('#transacoes-table tbody tr[data-row-id]').forEach(function (tr) {
        const descTd = tr.querySelector('td[data-col="description"]');
        if (descTd && !descTd.dataset.gEnhanced) {
          descTd.dataset.gEnhanced = '1';
          const t = findTransaction(tr.dataset.rowId);
          const text = descTd.textContent;
          const icon = t ? g_categoryAvatarHtml(t.categoria) : '';
          descTd.innerHTML =
            '<button type="button" class="g-tx-expand" data-id="' + tr.dataset.rowId + '">&#9656;</button>' +
            '<span class="g-tx-avatar-sm">' + icon + '</span>' +
            '<span class="g-tx-desc-text">' + esc(text) + '</span>';
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

    const g_originalRenderTable = renderTable;
    renderTable = function (tableId, precomputedRows) {
      g_originalRenderTable(tableId, precomputedRows);
      if (tableId === 'transacoes-table') g_enhanceTransacoesRows();
    };
    g_enhanceTransacoesRows();

    document.addEventListener('click', function (ev) {
      const expandBtn = ev.target.closest('#transacoes-table .g-tx-expand');
      if (expandBtn) {
        const tr = expandBtn.closest('tr[data-row-id]');
        if (tr) g_toggleTxDetail(tr);
      }
    });
  })();
`;
