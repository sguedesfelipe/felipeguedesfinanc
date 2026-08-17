import { makeLogger, newAuthedPage } from '../fixtures/helpers.mjs';

export async function run({ browser, baseUrl }) {
  const { log, results } = makeLogger('theme-and-calendar');

  // ---------- Fundo/tema ----------
  const { ctx, page, consoleErrors } = await newAuthedPage(browser, baseUrl);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const gPaperVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--g-paper').trim());
  log('fundo do body usa o token --g-paper (nao o branco antigo)', bodyBg !== 'rgb(255, 255, 255)' && bodyBg !== 'rgba(0, 0, 0, 0)', `body-bg=${bodyBg} --g-paper=${gPaperVar}`);
  const mainBg = await page.evaluate(() => getComputedStyle(document.querySelector('.g-main')).backgroundColor);
  log('.g-main nao tem fundo branco proprio (herda do body)', mainBg === 'rgba(0, 0, 0, 0)' || mainBg === bodyBg, `main-bg=${mainBg}`);
  await ctx.close();

  const darkPageCtx = await newAuthedPage(browser, baseUrl, { colorScheme: 'dark' });
  await darkPageCtx.page.goto(baseUrl, { waitUntil: 'networkidle' });
  const darkBodyBg = await darkPageCtx.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  log('dark mode: fundo escuro renderiza sem quebrar (sem pageerror)', darkPageCtx.consoleErrors.length === 0, `bg=${darkBodyBg} errors=${darkPageCtx.consoleErrors.join('; ')}`);
  await darkPageCtx.ctx.close();

  // ---------- Calendario: padrao + preset "Este ano" ----------
  const { ctx: ctx2, page: page2, consoleErrors: errors2 } = await newAuthedPage(browser, baseUrl);
  await page2.goto(baseUrl, { waitUntil: 'networkidle' });

  const now = new Date();
  const toVal = await page2.$eval('#filter-to', (el) => el.value);
  const expectedToday = now.toISOString().slice(0, 10);
  log('periodo padrao vai ate perto de hoje (nao uma data futura de parcela)', toVal <= expectedToday, `to=${toVal} hoje=${expectedToday}`);

  await page2.click('#g-period-trigger');
  await page2.waitForTimeout(150);
  await page2.click('.g-cal-preset[data-preset="year"]');
  await page2.waitForTimeout(150);
  const rangeLabel = await page2.textContent('#g-cal-range-label');
  const currentYearOk = rangeLabel.includes('/' + now.getFullYear()) && !rangeLabel.includes('/' + (now.getFullYear() + 1));
  log('preset "Este ano" resolve pro ano corrente de verdade (nao um ano futuro)', currentYearOk, rangeLabel);
  await page2.click('#g-cal-cancel');
  await page2.waitForTimeout(150);

  log('sem erros de console/pageerror', errors2.length === 0, errors2.join('; '));
  await ctx2.close();

  // ---------- Botao "Baixar Excel" ----------
  const { ctx: ctx3, page: page3 } = await newAuthedPage(browser, baseUrl);
  await page3.goto(baseUrl, { waitUntil: 'networkidle' });
  const desktopHref = await page3.getAttribute('#download-xlsx-btn', 'href');
  log('link "Baixar Excel" presente na barra lateral', desktopHref === '/api/export/xlsx', desktopHref);
  await ctx3.close();

  const mobile = await newAuthedPage(browser, baseUrl, { viewport: { width: 390, height: 844 } });
  await mobile.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.page.click('#g-more-toggle');
  await mobile.page.waitForTimeout(250);
  const mobileHref = await mobile.page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('.g-more-sheet a.g-more-item'));
    const el = links.find((a) => a.textContent.includes('Baixar Excel'));
    return el ? el.getAttribute('href') : null;
  });
  log('link "Baixar Excel" presente na folha "Mais" do mobile', mobileHref === '/api/export/xlsx', mobileHref);
  await mobile.ctx.close();

  return results;
}
