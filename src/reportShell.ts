// Shell responsivo do redesign "Grana": sidebar fixa (telas largas) + barra
// de abas inferior (telas estreitas), os dois navegando pelos mesmos 7
// `data-tab` que `activateTab()` ja usa hoje — nenhuma mudanca no motor de
// abas, so uma casca visual nova por cima.

export const SHELL_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--g-paper);
    color: var(--g-text-1);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .g-shell { display: flex; min-height: 100vh; }

  .g-sidebar {
    width: 232px;
    flex: none;
    background: var(--g-hero-bg);
    color: var(--g-hero-text);
    padding: 22px 16px;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .g-sidebar-logo {
    display: flex; align-items: center; gap: 9px;
    font-size: 17px; font-weight: 700; letter-spacing: -0.01em;
    padding: 0 8px; margin-bottom: 28px;
  }
  .g-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--g-accent); flex: none; }
  .g-sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
  .g-side-item {
    display: flex; align-items: center; gap: 11px;
    padding: 9px 10px; border-radius: 10px;
    font: inherit; font-size: 13.5px; font-weight: 600;
    color: rgba(242,245,243,0.62);
    background: none; border: none; cursor: pointer; text-align: left;
  }
  .g-side-item svg { width: 18px; height: 18px; flex: none; }
  .g-side-item.active { background: rgba(255,255,255,0.09); color: var(--g-hero-text); }
  .g-side-badge {
    margin-left: auto; font-size: 10.5px; font-weight: 700;
    background: var(--g-warn); color: #241505;
    padding: 1px 6px; border-radius: 100px; min-width: 8px; text-align: center;
  }
  .g-sidebar-foot { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 8px; }
  .g-logout {
    font: inherit; font-size: 12.5px; font-weight: 600;
    color: rgba(242,245,243,0.6); background: none; border: none; cursor: pointer; padding: 6px 8px;
    text-decoration: none; display: inline-block;
  }
  .g-logout:hover { color: var(--g-hero-text); }

  .g-topbar-mobile, .g-bottom-nav, .g-more-sheet { display: none; }

  .g-main { flex: 1; min-width: 0; padding: 26px 30px 40px; }

  @media (max-width: 860px) {
    .g-sidebar { display: none; }
    .g-topbar-mobile {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; background: var(--g-card); border-bottom: 1px solid var(--g-border);
      position: sticky; top: 0; z-index: 20;
    }
    .g-logo-mobile { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
    .g-icon-btn {
      width: 36px; height: 36px; border-radius: 11px; border: 1px solid var(--g-border);
      background: var(--g-card); display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .g-icon-btn svg { width: 18px; height: 18px; stroke: var(--g-text-1); }
    .g-main { padding: 16px 16px 90px; }

    .g-bottom-nav {
      display: flex; justify-content: space-around; align-items: center;
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
      padding: 8px 6px calc(env(safe-area-inset-bottom, 8px) + 6px);
      background: color-mix(in srgb, var(--g-card) 92%, transparent);
      backdrop-filter: blur(14px);
      border-top: 1px solid var(--g-border);
    }
    .g-bottom-item {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      font: inherit; font-size: 10px; font-weight: 600;
      color: var(--g-text-3); background: none; border: none; cursor: pointer;
      width: 58px; position: relative;
    }
    .g-bottom-item svg { width: 20px; height: 20px; }
    .g-bottom-item.active { color: var(--g-accent-ink); }
    @media (prefers-color-scheme: dark) { .g-bottom-item.active { color: var(--g-accent); } }
    .g-bottom-badge {
      position: absolute; top: -2px; right: 10px;
      font-size: 9px; font-weight: 700; background: var(--g-warn); color: #241505;
      padding: 0px 5px; border-radius: 100px; line-height: 1.5;
    }
    .g-more-sheet {
      display: block; position: fixed; inset: 0; z-index: 30;
      background: rgba(0,0,0,0.4);
      opacity: 0; pointer-events: none; transition: opacity .15s ease;
    }
    .g-more-sheet.g-open { opacity: 1; pointer-events: auto; }
    .g-more-sheet-card {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: var(--g-card); border-radius: 20px 20px 0 0;
      padding: 14px 10px calc(env(safe-area-inset-bottom, 14px) + 14px);
      transform: translateY(100%); transition: transform .18s ease;
    }
    .g-more-sheet.g-open .g-more-sheet-card { transform: translateY(0); }
    .g-more-item {
      display: flex; align-items: center; gap: 12px; width: 100%;
      font: inherit; font-size: 14px; font-weight: 600; color: var(--g-text-1);
      background: none; border: none; padding: 13px 10px; cursor: pointer;
      text-decoration: none; box-sizing: border-box;
    }
    .g-more-item svg { width: 19px; height: 19px; stroke: var(--g-text-2); }
  }
`;

const NAV_ITEMS: { tab: string; label: string; icon: string; badge?: string }[] = [
  {
    tab: 'resumo',
    label: 'Resumo',
    icon: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  },
  {
    tab: 'categorias',
    label: 'Categorias',
    icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.8"/>',
  },
  {
    tab: 'subcategorias',
    label: 'Subcategorias',
    icon: '<path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 13l9 5 9-5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  },
  {
    tab: 'transacoes',
    label: 'Transacoes',
    icon: '<path d="M12 3v18M18 7l-4-4-4 4M18 17l-4 4-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    tab: 'pendencias',
    label: 'Pendencias',
    icon: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.2" r="0.9" fill="currentColor"/>',
    badge: '<span id="pend-tab-count">0</span>',
  },
  {
    tab: 'emprestimos',
    label: 'Emprestimos',
    icon: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    tab: 'invalidos',
    label: 'Invalidos',
    icon: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 6.5l11 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  },
];

// Bottom nav so cabe um punhado de destinos — os mais usados no dia a dia
// ficam direto na barra, o resto (Subcategorias/Emprestimos/Invalidos) fica
// atras do botao "Mais".
const BOTTOM_TABS = ['resumo', 'categorias', 'transacoes', 'pendencias'];
const MORE_TABS = ['subcategorias', 'emprestimos', 'invalidos'];

function navIcon(svg: string): string {
  return `<svg viewBox="0 0 24 24" fill="none">${svg}</svg>`;
}

export function shellSidebarHtml(): string {
  const items = NAV_ITEMS.map(
    (item) => `
        <button type="button" class="tab-btn g-side-item${item.tab === 'resumo' ? ' active' : ''}" data-tab="${item.tab}">
          ${navIcon(item.icon)}
          <span>${item.label}</span>
          ${item.badge ? `<span class="g-side-badge">${item.badge}</span>` : ''}
        </button>`
  ).join('');
  return `
    <aside class="g-sidebar">
      <div class="g-sidebar-logo"><span class="g-dot"></span>Grana</div>
      <nav class="g-sidebar-nav">${items}
      </nav>
      <div class="g-sidebar-foot">
        <a href="/api/export/xlsx" class="g-logout" id="download-xlsx-btn">Baixar Excel</a>
        <button type="button" id="logout-btn" class="g-logout js-logout">Sair</button>
      </div>
    </aside>`;
}

export function shellMobileTopbarHtml(): string {
  return `
    <div class="g-topbar-mobile">
      <div class="g-logo-mobile"><span class="g-dot"></span>Grana</div>
      <button type="button" id="g-filter-toggle" class="g-icon-btn" aria-label="Filtros">
        ${navIcon('<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')}
      </button>
    </div>`;
}

export function shellBottomNavHtml(): string {
  const items = NAV_ITEMS.filter((i) => BOTTOM_TABS.includes(i.tab))
    .map(
      (item) => `
      <button type="button" class="tab-btn g-bottom-item${item.tab === 'resumo' ? ' active' : ''}" data-tab="${item.tab}">
        ${navIcon(item.icon)}
        <span>${item.label}</span>
        ${item.badge ? `<span class="g-side-badge g-bottom-badge">${item.badge.replace('id="pend-tab-count"', 'data-mirror-count="pend-tab-count"')}</span>` : ''}
      </button>`
    )
    .join('');
  return `
    <div class="g-bottom-nav">${items}
      <button type="button" id="g-more-toggle" class="g-bottom-item">
        ${navIcon('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>')}
        <span>Mais</span>
      </button>
    </div>
    <div class="g-more-sheet" id="g-more-sheet">
      <div class="g-more-sheet-card">
        ${MORE_TABS.map((tab) => {
          const item = NAV_ITEMS.find((i) => i.tab === tab)!;
          return `<button type="button" class="tab-btn g-more-item" data-tab="${tab}">${navIcon(item.icon)}<span>${item.label}</span></button>`;
        }).join('')}
        <a href="/api/export/xlsx" class="g-more-item">
          ${navIcon('<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')}
          <span>Baixar Excel</span>
        </a>
        <button type="button" class="g-more-item js-logout">
          ${navIcon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')}
          <span>Sair</span>
        </button>
      </div>
    </div>`;
}

export const SHELL_SCRIPT = `
  // "Mais" (mobile): mostra/esconde a folha com as abas secundarias, e
  // fecha sozinha quando uma delas e escolhida (activateTab ja roda pelo
  // listener generico de .tab-btn mais abaixo, isso so cuida da folha).
  const moreToggle = document.getElementById('g-more-toggle');
  const moreSheet = document.getElementById('g-more-sheet');
  if (moreToggle && moreSheet) {
    moreToggle.addEventListener('click', () => moreSheet.classList.toggle('g-open'));
    moreSheet.addEventListener('click', (ev) => {
      if (ev.target === moreSheet) moreSheet.classList.remove('g-open');
    });
    moreSheet.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => moreSheet.classList.remove('g-open')));
  }
  // Espelha a contagem de pendencias (calculada em renderResumo) tambem no
  // badge da barra inferior do mobile, que e um <span> separado (nao pode
  // repetir o mesmo id do sidebar).
  function g_mirrorPendCount() {
    const src = document.getElementById('pend-tab-count');
    if (!src) return;
    document.querySelectorAll('[data-mirror-count="pend-tab-count"]').forEach((el) => { el.textContent = src.textContent; });
  }
  const g_pendObserver = new MutationObserver(g_mirrorPendCount);
  const g_pendTabCountEl = document.getElementById('pend-tab-count');
  if (g_pendTabCountEl) g_pendObserver.observe(g_pendTabCountEl, { childList: true, characterData: true, subtree: true });
`;
