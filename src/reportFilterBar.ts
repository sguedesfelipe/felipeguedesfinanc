// Barra de filtros global do redesign "Grana": os controles de dimensao
// (Categoria/Subcategoria/Conta/Status/Tipo/Valido) continuam sendo os
// mesmos <select> de sempre, so estilizados como chip — zero JS novo pra
// eles, o motor existente (getBaseFiltered, resetSubcategoriaOptions, etc.)
// nem percebe a mudanca. So o periodo ganha um widget de verdade: um
// popover de calendario que escreve nos mesmos <input type=date> ocultos
// e dispara o mesmo fluxo de "Aplicar"/"renderAll" de sempre.

export const FILTER_BAR_CSS = `
  .g-filterbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    background: var(--g-card-2); border-radius: 14px; padding: 10px 12px;
    margin-bottom: 20px;
    position: relative;
  }
  .g-select {
    font: inherit; font-size: 12.5px; font-weight: 600; color: var(--g-text-1);
    background: var(--g-card); border: 1px solid var(--g-border);
    padding: 7px 26px 7px 12px; border-radius: 10px; cursor: pointer;
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238B9A93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center; background-size: 12px;
  }
  .g-hidden-date { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .g-btn-solid, .g-btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    font: inherit; font-size: 12.5px; font-weight: 700;
    padding: 7px 13px; border-radius: 10px; cursor: pointer;
  }
  .g-btn-solid { background: var(--g-accent); color: var(--g-accent-ink); border: none; }
  .g-btn-ghost { background: var(--g-card); color: var(--g-text-1); border: 1px solid var(--g-border); }
  .g-link {
    font: inherit; font-size: 12px; font-weight: 600; color: var(--g-text-3);
    background: none; border: none; cursor: pointer; text-decoration: underline;
    margin-left: auto;
  }

  /* chip + popover de periodo */
  .g-period-filter { position: relative; }
  .g-chip {
    display: inline-flex; align-items: center; gap: 6px;
    font: inherit; font-size: 12.5px; font-weight: 600; color: var(--g-text-1);
    background: var(--g-card); border: 1px solid var(--g-border);
    padding: 7px 12px; border-radius: 10px; cursor: pointer;
  }
  .g-fc-label { color: var(--g-text-3); font-weight: 500; }
  .g-period-trigger svg { width: 12px; height: 12px; stroke: var(--g-text-3); }
  .g-calendar-pop {
    display: none;
    position: absolute; top: calc(100% + 8px); left: 0; z-index: 50;
    background: var(--g-card); border: 1px solid var(--g-border); border-radius: 16px;
    box-shadow: var(--g-shadow-2); padding: 16px; gap: 18px;
  }
  .g-period-filter.g-open .g-calendar-pop { display: flex; }
  .g-cal-presets { display: flex; flex-direction: column; gap: 2px; width: 136px; flex: none; border-right: 1px solid var(--g-border); padding-right: 14px; }
  .g-cal-preset {
    text-align: left; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--g-text-2);
    background: none; border: none; padding: 8px 9px; border-radius: 8px; cursor: pointer;
  }
  .g-cal-preset:hover { background: var(--g-card-2); }
  .g-cal-body { display: flex; flex-direction: column; gap: 12px; min-width: 440px; }
  .g-cal-nav { display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 13px; font-weight: 700; color: var(--g-text-1); }
  .g-cal-arrow {
    width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--g-border);
    background: var(--g-card); cursor: pointer; font: inherit; font-size: 14px; color: var(--g-text-2);
  }
  .g-cal-arrow:hover { background: var(--g-card-2); }
  .g-cal-months { display: flex; gap: 20px; }
  .g-cal-month { flex: 1; min-width: 0; }
  .g-cal-month-head { text-align: center; font-size: 12.5px; font-weight: 700; margin-bottom: 8px; color: var(--g-text-1); }
  .g-cal-weekdays { display: grid; grid-template-columns: repeat(7,1fr); text-align: center; font-size: 10px; font-weight: 700; color: var(--g-text-3); margin-bottom: 4px; }
  .g-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
  .g-cal-day {
    aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
    font-size: 11.5px; font-weight: 600; color: var(--g-text-1); border-radius: 7px; cursor: pointer;
  }
  .g-cal-day:hover:not(.g-empty):not(.g-disabled) { background: var(--g-card-2); }
  .g-cal-day.g-empty { visibility: hidden; cursor: default; }
  .g-cal-day.g-disabled { color: var(--g-text-3); opacity: 0.4; cursor: not-allowed; }
  .g-cal-day.g-in-range { background: var(--g-accent-soft); }
  .g-cal-day.g-range-end { background: var(--g-accent); color: var(--g-accent-ink); border-radius: 50%; font-weight: 700; }
  .g-cal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--g-border); padding-top: 12px; flex-wrap: wrap; }
  .g-cal-range-label { font-size: 12px; color: var(--g-text-2); font-weight: 600; }
  .g-cal-footer-btns { display: flex; gap: 8px; }

  @media (max-width: 900px) {
    .g-calendar-pop { flex-direction: column; width: min(420px, 88vw); }
    .g-cal-presets { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--g-border); padding-right: 0; padding-bottom: 10px; width: auto; }
    .g-cal-body { min-width: 0; }
    .g-cal-months { flex-direction: column; gap: 14px; }
  }

  .g-sheet-close { display: none; }

  @media (max-width: 860px) {
    .g-filterbar { display: none; }
    .g-filterbar.g-sheet-open {
      display: flex; flex-direction: column; align-items: stretch;
      position: fixed; inset: 0; z-index: 40; border-radius: 0;
      padding: 16px; overflow-y: auto; margin-bottom: 0;
    }
    .g-filterbar.g-sheet-open::before {
      content: "Filtros"; font-size: 15px; font-weight: 700; color: var(--g-text-1); margin-bottom: 4px;
    }
    .g-filterbar.g-sheet-open .g-sheet-close {
      display: flex; align-items: center; justify-content: center;
      position: absolute; top: 14px; right: 14px;
      width: 34px; height: 34px; border-radius: 10px;
      background: var(--g-card-2); border: none; cursor: pointer;
      order: -1;
    }
    .g-sheet-close svg { width: 16px; height: 16px; stroke: var(--g-text-1); }
    .g-filterbar.g-sheet-open .g-select,
    .g-filterbar.g-sheet-open .g-chip { width: 100%; }
    .g-filterbar.g-sheet-open .g-link { margin-left: 0; text-align: center; padding: 10px; }
    .g-filterbar.g-sheet-open .g-calendar-pop { position: static; box-shadow: none; border: 1px solid var(--g-border); width: 100%; }
    .g-filterbar.g-sheet-open .g-period-filter.g-open .g-calendar-pop { display: flex; }
  }
`;

export function filterBarHtml(): string {
  return `
      <div class="g-filterbar" id="g-filterbar">
        <button type="button" class="g-sheet-close" id="g-filter-sheet-close" aria-label="Fechar filtros">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="g-period-filter" id="g-period-filter">
          <button type="button" class="g-chip g-period-trigger" id="g-period-trigger">
            <span class="g-fc-label">Periodo</span> <span id="g-period-label">Todo o periodo</span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="g-calendar-pop" id="g-calendar-pop">
            <div class="g-cal-presets" id="g-cal-presets">
              <button type="button" class="g-cal-preset" data-preset="today">Hoje</button>
              <button type="button" class="g-cal-preset" data-preset="7d">Ultimos 7 dias</button>
              <button type="button" class="g-cal-preset" data-preset="month">Este mes</button>
              <button type="button" class="g-cal-preset" data-preset="3m">Ultimos 3 meses</button>
              <button type="button" class="g-cal-preset" data-preset="6m">Ultimos 6 meses</button>
              <button type="button" class="g-cal-preset" data-preset="year">Este ano</button>
              <button type="button" class="g-cal-preset" data-preset="all">Tudo</button>
            </div>
            <div class="g-cal-body">
              <div class="g-cal-nav">
                <button type="button" class="g-cal-arrow" id="g-cal-prev">&lsaquo;</button>
                <span class="g-cal-nav-label" id="g-cal-nav-label"></span>
                <button type="button" class="g-cal-arrow" id="g-cal-next">&rsaquo;</button>
              </div>
              <div class="g-cal-months" id="g-cal-months"></div>
              <div class="g-cal-footer">
                <span class="g-cal-range-label" id="g-cal-range-label"></span>
                <div class="g-cal-footer-btns">
                  <button type="button" class="g-btn-ghost" id="g-cal-cancel">Cancelar</button>
                  <button type="button" class="g-btn-solid" id="g-cal-apply">Aplicar</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <select id="filter-categoria" class="g-select"><option value="">Categoria</option></select>
        <select id="filter-subcategoria" class="g-select"><option value="">Subcategoria</option></select>
        <select id="filter-conta" class="g-select"><option value="">Conta</option></select>
        <select id="filter-status" class="g-select"><option value="">Status (banco)</option></select>
        <select id="filter-tipo" class="g-select">
          <option value="">Tipo</option>
          <option value="gasto">Gasto</option>
          <option value="receita">Receita</option>
        </select>
        <select id="filter-valido" class="g-select">
          <option value="">Valido</option>
          <option value="sim">Valido: Sim</option>
          <option value="nao">Valido: Nao</option>
        </select>

        <input type="date" id="filter-from" class="g-hidden-date" tabindex="-1" aria-hidden="true">
        <input type="date" id="filter-to" class="g-hidden-date" tabindex="-1" aria-hidden="true">

        <button type="button" id="filter-apply" class="g-btn-solid">Aplicar filtro</button>
        <button type="button" id="filter-clear" class="g-link">Limpar todos os filtros</button>
      </div>`;
}

export const FILTER_BAR_SCRIPT = `
  (function () {
    const trigger = document.getElementById('g-period-trigger');
    const container = document.getElementById('g-period-filter');
    const pop = document.getElementById('g-calendar-pop');
    const periodLabel = document.getElementById('g-period-label');
    const monthsEl = document.getElementById('g-cal-months');
    const navLabel = document.getElementById('g-cal-nav-label');
    const rangeLabel = document.getElementById('g-cal-range-label');
    if (!trigger || !container || !pop) return;

    const MONTH_NAMES_FULL = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    function pad(n) { return String(n).padStart(2, '0'); }
    function toISO(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
    function parseISO(iso) { const p = iso.split('-').map(Number); return { y: p[0], m: p[1] - 1, d: p[2] }; }
    function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
    function fmtBR(iso) { const p = parseISO(iso); return pad(p.d) + '/' + pad(p.m + 1) + '/' + p.y; }
    function addDaysIso(iso, n) { const p = parseISO(iso); const dt = new Date(p.y, p.m, p.d + n); return toISO(dt.getFullYear(), dt.getMonth(), dt.getDate()); }
    function addMonthsIso(iso, n) { const p = parseISO(iso); const dt = new Date(p.y, p.m + n, 1); const last = daysInMonth(dt.getFullYear(), dt.getMonth()); return toISO(dt.getFullYear(), dt.getMonth(), Math.min(p.d, last)); }
    function clamp(iso) { if (iso < minDate) return minDate; if (iso > maxDate) return maxDate; return iso; }

    let pendingFrom = fromInput.value;
    let pendingTo = toInput.value;
    let picking = 'start';
    let viewIso = pendingTo || maxDate;

    function monthGridHtml(y, m) {
      const nd = daysInMonth(y, m);
      const fw = new Date(y, m, 1).getDay();
      let cells = '';
      for (let i = 0; i < fw; i++) cells += '<span class="g-cal-day g-empty"></span>';
      for (let d = 1; d <= nd; d++) {
        const iso = toISO(y, m, d);
        let cls = 'g-cal-day';
        if (pendingFrom && pendingTo && iso >= pendingFrom && iso <= pendingTo) cls += ' g-in-range';
        if (iso === pendingFrom || iso === pendingTo) cls += ' g-range-end';
        if (iso < minDate || iso > maxDate) cls += ' g-disabled';
        cells += '<span class="' + cls + '" data-iso="' + iso + '">' + d + '</span>';
      }
      return '<div class="g-cal-month"><div class="g-cal-month-head">' + MONTH_NAMES_FULL[m] + ' ' + y + '</div>' +
        '<div class="g-cal-weekdays"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>' +
        '<div class="g-cal-grid">' + cells + '</div></div>';
    }

    function draw() {
      const right = parseISO(viewIso);
      const leftDate = new Date(right.y, right.m - 1, 1);
      monthsEl.innerHTML = monthGridHtml(leftDate.getFullYear(), leftDate.getMonth()) + monthGridHtml(right.y, right.m);
      navLabel.textContent = MONTH_NAMES_FULL[leftDate.getMonth()] + ' - ' + MONTH_NAMES_FULL[right.m] + ' ' + right.y;
      rangeLabel.textContent = pendingFrom && pendingTo ? (fmtBR(pendingFrom) + ' a ' + fmtBR(pendingTo)) : 'Selecione o periodo';
    }

    function updateTriggerLabel() {
      periodLabel.textContent = (fromInput.value && toInput.value) ? (fmtBR(fromInput.value) + ' - ' + fmtBR(toInput.value)) : 'Todo o periodo';
    }
    updateTriggerLabel();

    function openPop() {
      pendingFrom = fromInput.value;
      pendingTo = toInput.value;
      picking = 'start';
      viewIso = pendingTo || maxDate;
      draw();
      container.classList.add('g-open');
    }
    function closePop() {
      container.classList.remove('g-open');
    }
    trigger.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (container.classList.contains('g-open')) closePop(); else openPop();
    });
    document.addEventListener('click', (ev) => {
      if (container.classList.contains('g-open') && !container.contains(ev.target)) closePop();
    });
    pop.addEventListener('click', (ev) => ev.stopPropagation());

    document.getElementById('g-cal-prev').addEventListener('click', () => { viewIso = clamp(addMonthsIso(viewIso, -1)); draw(); });
    document.getElementById('g-cal-next').addEventListener('click', () => { viewIso = clamp(addMonthsIso(viewIso, 1)); draw(); });

    monthsEl.addEventListener('click', (ev) => {
      const cell = ev.target.closest('.g-cal-day');
      if (!cell || cell.classList.contains('g-empty') || cell.classList.contains('g-disabled')) return;
      const iso = cell.dataset.iso;
      if (picking === 'start') {
        pendingFrom = iso;
        pendingTo = iso;
        picking = 'end';
      } else if (iso < pendingFrom) {
        pendingTo = pendingFrom;
        pendingFrom = iso;
        picking = 'start';
      } else {
        pendingTo = iso;
        picking = 'start';
      }
      draw();
    });

    function applyPreset(preset) {
      // "Hoje" e' a data real do calendario (nao a ultima data com dado no
      // periodo, que pode estar no futuro por causa de parcelas projetadas).
      const now = new Date();
      const today = clamp(toISO(now.getFullYear(), now.getMonth(), now.getDate()));
      if (preset === 'today') { pendingFrom = today; pendingTo = today; }
      else if (preset === '7d') { pendingFrom = clamp(addDaysIso(today, -6)); pendingTo = today; }
      else if (preset === 'month') { const p = parseISO(today); pendingFrom = clamp(toISO(p.y, p.m, 1)); pendingTo = today; }
      else if (preset === '3m') { pendingFrom = clamp(addMonthsIso(today, -3)); pendingTo = today; }
      else if (preset === '6m') { pendingFrom = clamp(addMonthsIso(today, -6)); pendingTo = today; }
      else if (preset === 'year') { const p = parseISO(today); pendingFrom = clamp(toISO(p.y, 0, 1)); pendingTo = today; }
      else if (preset === 'all') { pendingFrom = minDate; pendingTo = maxDate; }
      viewIso = pendingTo;
      picking = 'start';
      draw();
    }
    document.querySelectorAll('.g-cal-preset').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));

    document.getElementById('g-cal-cancel').addEventListener('click', closePop);
    document.getElementById('g-cal-apply').addEventListener('click', () => {
      if (pendingFrom && pendingTo) {
        fromInput.value = pendingFrom;
        toInput.value = pendingTo;
        updateTriggerLabel();
        renderAll();
      }
      closePop();
    });

    const clearBtn = document.getElementById('filter-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => { setTimeout(updateTriggerLabel, 0); closePop(); });

    // Folha de filtro no mobile: reaproveita a MESMA barra (so troca a
    // apresentacao via classe), entao nao ha elemento nem id duplicado. A
    // folha cobre a tela inteira (inclusive o botao que abriu ela), entao
    // precisa de um jeito proprio de fechar — o X e o proprio "Aplicar
    // filtro" fecham.
    const filterToggle = document.getElementById('g-filter-toggle');
    const filterBar = document.getElementById('g-filterbar');
    const sheetClose = document.getElementById('g-filter-sheet-close');
    if (filterToggle && filterBar) {
      filterToggle.addEventListener('click', () => filterBar.classList.add('g-sheet-open'));
    }
    if (sheetClose && filterBar) {
      sheetClose.addEventListener('click', () => filterBar.classList.remove('g-sheet-open'));
    }
    const applyBtn = document.getElementById('filter-apply');
    if (applyBtn && filterBar) {
      applyBtn.addEventListener('click', () => filterBar.classList.remove('g-sheet-open'));
    }
  })();
`;
