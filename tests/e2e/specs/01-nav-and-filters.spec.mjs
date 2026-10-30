import { makeLogger, newAuthedPage } from '../fixtures/helpers.mjs';

export async function run({ browser, baseUrl }) {
  const { log, results } = makeLogger('nav-and-filters');

  // ---------- Desktop ----------
  const { ctx, page, consoleErrors } = await newAuthedPage(browser, baseUrl, { viewport: { width: 1400, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  log('sidebar visible on desktop', await page.isVisible('.g-sidebar'));
  log('bottom-nav hidden on desktop', !(await page.isVisible('.g-bottom-nav')));

  await page.click('.g-side-item[data-tab="transacoes"]');
  await page.waitForTimeout(200);
  log('sidebar nav switches tab (transacoes)', await page.evaluate(() => document.getElementById('tab-transacoes').classList.contains('active')));

  await page.click('.g-side-item[data-tab="resumo"]');
  await page.waitForTimeout(200);

  await page.click('#g-period-trigger');
  await page.waitForTimeout(150);
  log('calendar popover opens', await page.isVisible('#g-calendar-pop'));

  await page.click('.g-cal-preset[data-preset="month"]');
  await page.waitForTimeout(150);
  const rangeLabelText = await page.textContent('#g-cal-range-label');
  log('preset "Este mes" fills range label', !!rangeLabelText && rangeLabelText !== 'Selecione o periodo', rangeLabelText);

  const fromBefore = await page.$eval('#filter-from', (el) => el.value);
  await page.click('#g-cal-apply');
  await page.waitForTimeout(200);
  const fromAfter = await page.$eval('#filter-from', (el) => el.value);
  log('apply updates filter-from input + chip label', fromAfter !== fromBefore, `${fromBefore} -> ${fromAfter}`);
  log('popover closes after apply', !(await page.isVisible('#g-calendar-pop')));

  // --- novos atalhos rapidos de data (Ontem / Ultimos N dias / Mes passado) ---
  function localIso(dayOffsetFn) {
    return page.evaluate((fn) => {
      const now = new Date();
      const d = eval('(' + fn + ')')(now);
      const pad = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }, dayOffsetFn.toString());
  }

  await page.click('#g-period-trigger');
  await page.waitForTimeout(150);
  await page.click('.g-cal-preset[data-preset="yesterday"]');
  await page.waitForTimeout(150);
  await page.click('#g-cal-apply');
  await page.waitForTimeout(200);
  const yFrom = await page.$eval('#filter-from', (el) => el.value);
  const yTo = await page.$eval('#filter-to', (el) => el.value);
  const expectedYesterday = await localIso((now) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  log('preset "Ontem" seleciona o dia anterior', yFrom === yTo && yFrom === expectedYesterday, `from=${yFrom} to=${yTo} esperado=${expectedYesterday}`);

  await page.click('#g-period-trigger');
  await page.waitForTimeout(150);
  await page.click('.g-cal-preset[data-preset="15d"]');
  await page.waitForTimeout(150);
  await page.click('#g-cal-apply');
  await page.waitForTimeout(200);
  const d15From = await page.$eval('#filter-from', (el) => el.value);
  const d15To = await page.$eval('#filter-to', (el) => el.value);
  const expected15From = await localIso((now) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14));
  const expectedToday = await localIso((now) => now);
  log(
    'preset "Ultimos 15 dias" cobre 15 dias ate hoje',
    d15From === expected15From && d15To === expectedToday,
    `from=${d15From} (esperado ${expected15From}) to=${d15To} (esperado ${expectedToday})`
  );

  await page.click('#g-period-trigger');
  await page.waitForTimeout(150);
  await page.click('.g-cal-preset[data-preset="lastMonth"]');
  await page.waitForTimeout(150);
  await page.click('#g-cal-apply');
  await page.waitForTimeout(200);
  const lmFrom = await page.$eval('#filter-from', (el) => el.value);
  const lmTo = await page.$eval('#filter-to', (el) => el.value);
  const expectedLmFrom = await localIso((now) => new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const expectedLmTo = await localIso((now) => new Date(now.getFullYear(), now.getMonth(), 0));
  log(
    'preset "Mes passado" cobre do 1o ao ultimo dia do mes anterior',
    lmFrom === expectedLmFrom && lmTo === expectedLmTo,
    `from=${lmFrom} (esperado ${expectedLmFrom}) to=${lmTo} (esperado ${expectedLmTo})`
  );

  await page.click('#filter-clear');
  await page.waitForTimeout(200);
  const fromAfterClear = await page.$eval('#filter-from', (el) => el.value);
  const minDate = await page.$eval('#filter-from', (el) => el.min);
  log('"Limpar todos os filtros" volta pro historico completo', fromAfterClear === minDate, `from=${fromAfterClear} min=${minDate}`);

  await page.click('.g-side-item[data-tab="transacoes"]');
  await page.waitForTimeout(300);
  const firstClsInput = await page.$('input.cls-input');
  if (firstClsInput) {
    await firstClsInput.click({ clickCount: 3 });
    await firstClsInput.fill('Alimentação');
    const [patchReq] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'PATCH' && req.url().includes('/api/transactions/'), { timeout: 3000 }).catch(() => null),
      page.keyboard.press('Tab'),
    ]);
    log('editando categoria dispara PATCH', !!patchReq, patchReq ? patchReq.url() : 'nenhuma request vista');
  } else {
    log('editando categoria dispara PATCH', false, 'nenhum cls-input encontrado');
  }

  log('sem erros de console/pageerror (desktop)', consoleErrors.length === 0, consoleErrors.join('; '));
  await ctx.close();

  // ---------- Mobile ----------
  const mobile = await newAuthedPage(browser, baseUrl, { viewport: { width: 390, height: 844 } });
  await mobile.page.goto(baseUrl, { waitUntil: 'networkidle' });

  log('sidebar hidden on mobile', !(await mobile.page.isVisible('.g-sidebar')));
  log('bottom-nav visible on mobile', await mobile.page.isVisible('.g-bottom-nav'));
  log('mobile topbar visible', await mobile.page.isVisible('.g-topbar-mobile'));

  await mobile.page.click('#g-filter-toggle');
  await mobile.page.waitForTimeout(200);
  log('mobile filter sheet opens', await mobile.page.evaluate(() => document.getElementById('g-filterbar').classList.contains('g-sheet-open')));
  await mobile.page.click('#g-filter-sheet-close');
  await mobile.page.waitForTimeout(150);
  log('mobile filter sheet closes via X', !(await mobile.page.evaluate(() => document.getElementById('g-filterbar').classList.contains('g-sheet-open'))));

  await mobile.page.click('#g-more-toggle');
  await mobile.page.waitForTimeout(250);
  log('mobile "Mais" sheet opens', await mobile.page.evaluate(() => document.getElementById('g-more-sheet').classList.contains('g-open')));
  const moreItemCount = await mobile.page.$$eval('.g-more-item.tab-btn', (els) => els.length);
  log('mobile "Mais" sheet has 3 tab items', moreItemCount === 3, `count=${moreItemCount}`);

  await mobile.page.click('.g-more-item[data-tab="subcategorias"]');
  await mobile.page.waitForTimeout(200);
  log('"Mais" item navega + fecha a folha', await mobile.page.evaluate(() => document.getElementById('tab-subcategorias').classList.contains('active')));
  log('more-sheet fecha depois de escolher uma aba', !(await mobile.page.evaluate(() => document.getElementById('g-more-sheet').classList.contains('g-open'))));

  log('sem erros de console/pageerror (mobile)', mobile.consoleErrors.length === 0, mobile.consoleErrors.join('; '));
  await mobile.ctx.close();

  return results;
}
