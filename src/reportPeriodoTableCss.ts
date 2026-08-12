export const PERIODO_TABLE_CSS = `
  .g-tab-pills {
    display: inline-flex;
    gap: 4px;
    background: var(--g-card-2);
    border: 1px solid var(--g-border);
    border-radius: 100px;
    padding: 4px;
    margin-bottom: 16px;
  }
  .g-tab-pill {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 16px;
    border: none;
    border-radius: 100px;
    background: transparent;
    color: var(--g-text-2);
    cursor: pointer;
  }
  .g-tab-pill.active { background: var(--g-card); color: var(--g-text-1); box-shadow: var(--g-shadow-1); }
  .g-tab-pill:hover:not(.active) { color: var(--g-text-1); }

  .tab-panel .card {
    background: var(--g-card);
    border: 1px solid var(--g-border);
    border-radius: 20px;
    padding: 20px;
    box-shadow: var(--g-shadow-1);
  }
  .tab-panel .card[data-subtab] { display: none; }
  .tab-panel .card[data-subtab="saldo"] { display: block; }
  .tab-panel h2 { color: var(--g-text-1); font-size: 15px; font-weight: 700; letter-spacing: -0.005em; }
  .tab-panel .subtitle { color: var(--g-text-2); }
  .tab-panel .chart-header select {
    font: inherit; font-size: 13px; padding: 6px 10px;
    background: var(--g-card-2); border: 1px solid var(--g-border); border-radius: 8px; color: var(--g-text-1);
  }

  .tab-panel table.data-table th,
  .tab-panel table.data-table td { border-bottom: 1px solid var(--g-border); }
  .tab-panel table.data-table th {
    background: var(--g-card);
    color: var(--g-text-2);
  }
  .tab-panel table.data-table tbody tr:hover td { background: var(--g-card-2); }
  .tab-panel table.data-table:has(.periodo-cat-label) th:first-child,
  .tab-panel table.data-table:has(.periodo-cat-label) td:first-child {
    position: sticky;
    left: 0;
    background: var(--g-card);
    z-index: 1;
  }
  .tab-panel table.data-table:has(.periodo-cat-label) tbody tr:hover td:first-child { background: var(--g-card-2); }

  .tab-panel .periodo-cat-label.clickable:hover { color: var(--g-accent); text-decoration: underline; }
  .tab-panel td.periodo-cell:hover { outline: 1px solid var(--g-accent); outline-offset: -1px; }
  .tab-panel td.periodo-total { font-weight: 700; }
  .tab-panel tr.periodo-total-row td {
    font-weight: 700;
    border-top: 2px solid var(--g-border);
    background: var(--g-card-2);
  }
  .tab-panel tr.periodo-total-row td:first-child { background: var(--g-card-2); }
`;

export const PERIODO_TABLE_SCRIPT = `
  document.querySelectorAll('.g-tab-pills').forEach(function (group) {
    const panel = group.closest('.tab-panel');
    if (!panel) return;
    group.querySelectorAll('.g-tab-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        const target = pill.getAttribute('data-subtab-target');
        group.querySelectorAll('.g-tab-pill').forEach(function (p) { p.classList.toggle('active', p === pill); });
        panel.querySelectorAll(':scope > .card[data-subtab]').forEach(function (card) {
          card.style.display = card.getAttribute('data-subtab') === target ? 'block' : 'none';
        });
      });
    });
  });
`;
