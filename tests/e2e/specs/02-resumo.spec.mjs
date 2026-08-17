import { makeLogger, newAuthedPage } from '../fixtures/helpers.mjs';

export async function run({ browser, baseUrl }) {
  const { log, results } = makeLogger('resumo');
  const { ctx, page, consoleErrors } = await newAuthedPage(browser, baseUrl);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const heroText = await page.textContent('#kpi-net');
  log('saldo em destaque populado', !!heroText && heroText.trim().length > 0, heroText);

  const expensesText = await page.textContent('#kpi-expenses');
  const incomeText = await page.textContent('#kpi-income');
  log('cartoes de gastos/receitas populados', !!expensesText && !!incomeText, `gastos=${expensesText} receitas=${incomeText}`);

  const catListHtml = await page.innerHTML('#g-resumo-cat-list');
  log('lista de categorias renderizada', catListHtml.includes('g-cat-row'), catListHtml.slice(0, 150));

  const txListHtml = await page.innerHTML('#g-resumo-tx-list');
  log('lista de transacoes recentes renderizada', txListHtml.includes('g-tx-row'), txListHtml.slice(0, 150));
  log('icone de categoria presente (emoji ou fallback)', catListHtml.includes('g-emoji'));

  const barChartHtml = await page.innerHTML('#monthly-chart');
  log('grafico de barras renderiza (reestilizado)', barChartHtml.includes('bar-col'), `${barChartHtml.length} chars`);

  const firstBar = await page.$('.bar-col.clickable');
  if (firstBar) {
    await firstBar.click();
    await page.waitForTimeout(200);
    const selInfo = await page.textContent('#bar-selection-info');
    log('clicar numa barra ainda seleciona um periodo', !!selInfo && selInfo.includes('selecionado'), selInfo);
    await page.click('#clear-bar-selection').catch(() => {});
  } else {
    log('clicar numa barra ainda seleciona um periodo', false, 'nenhuma barra clicavel encontrada');
  }

  const catBefore = await page.innerHTML('#g-resumo-cat-list');
  await page.selectOption('#filter-categoria', { label: 'Alimentação' }).catch(() => {});
  await page.waitForTimeout(200);
  const catAfter = await page.innerHTML('#g-resumo-cat-list');
  log('mudar filtro de categoria re-renderiza o resumo', catBefore !== catAfter);
  await page.selectOption('#filter-categoria', '');
  await page.waitForTimeout(150);

  log('sem erros de console/pageerror', consoleErrors.length === 0, consoleErrors.join('; '));
  await ctx.close();
  return results;
}
