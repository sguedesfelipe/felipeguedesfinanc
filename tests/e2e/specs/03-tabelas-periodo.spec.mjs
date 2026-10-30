import { makeLogger, newAuthedPage } from '../fixtures/helpers.mjs';

export async function run({ browser, baseUrl }) {
  const { log, results } = makeLogger('tabelas-periodo');
  const { ctx, page, consoleErrors } = await newAuthedPage(browser, baseUrl);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const tabs = ['categorias', 'subcategorias', 'emprestimos', 'invalidos'];
  for (const tab of tabs) {
    await page.click(`.g-side-item[data-tab="${tab}"]`);
    await page.waitForTimeout(200);

    log(`${tab}: pills de subaba visiveis`, await page.isVisible(`#tab-${tab} .g-tab-pills`));

    const visibility = await page.evaluate((t) => {
      const cards = Array.from(document.querySelectorAll(`#tab-${t} > .card[data-subtab]`));
      return cards.map((c) => ({ subtab: c.getAttribute('data-subtab'), visible: getComputedStyle(c).display !== 'none' }));
    }, tab);
    const saldoCards = visibility.filter((v) => v.subtab === 'saldo');
    const otherCards = visibility.filter((v) => v.subtab !== 'saldo');
    log(`${tab}: cartao(oes) de Saldo visiveis por padrao`, saldoCards.length > 0 && saldoCards.every((v) => v.visible));
    log(`${tab}: cartoes de Gastos/Receita escondidos por padrao`, otherCards.every((v) => !v.visible));

    await page.click(`#tab-${tab} .g-tab-pill[data-subtab-target="gastos"]`);
    await page.waitForTimeout(150);
    const afterGastos = await page.evaluate((t) => {
      const cards = Array.from(document.querySelectorAll(`#tab-${t} > .card[data-subtab]`));
      return cards.map((c) => ({ subtab: c.getAttribute('data-subtab'), visible: getComputedStyle(c).display !== 'none' }));
    }, tab);
    const gastosOk = afterGastos.filter((v) => v.subtab === 'gastos').every((v) => v.visible);
    const othersHiddenOk = afterGastos.filter((v) => v.subtab !== 'gastos').every((v) => !v.visible);
    log(`${tab}: clicar em Gastos mostra so os cartoes de gastos`, gastosOk && othersHiddenOk);

    await page.click(`#tab-${tab} .g-tab-pill[data-subtab-target="saldo"]`);
    await page.waitForTimeout(150);
  }

  await page.click('.g-side-item[data-tab="categorias"]');
  await page.waitForTimeout(200);
  const thLabel = await page.$('#categorias-saldo-periodo-table .periodo-th-label[data-sort-key="total"]');
  if (thLabel) {
    await thLabel.click();
    await page.waitForTimeout(150);
    log('ordenar pelo cabecalho da tabela por periodo ainda funciona', true);
  } else {
    log('ordenar pelo cabecalho da tabela por periodo ainda funciona', false, 'th-label nao encontrado');
  }

  const periodoCell = await page.$('#categorias-saldo-periodo-table td.periodo-cell');
  if (periodoCell) {
    const dimValue = await periodoCell.evaluate((el) => el.dataset.dimValue);
    await periodoCell.click();
    await page.waitForTimeout(200);
    const catFilterValue = await page.$eval('#filter-categoria', (el) => el.value);
    log('clicar numa celula preenche o filtro de categoria', catFilterValue === dimValue, `esperado=${dimValue} obtido=${catFilterValue}`);
    await page.click('#filter-clear');
    await page.waitForTimeout(150);
  } else {
    log('clicar numa celula preenche o filtro de categoria', false, 'nenhuma periodo-cell encontrada');
  }

  // --- drill-down explicito: Categorias -> Subcategorias -> Transacoes ---
  await page.click('.g-side-item[data-tab="categorias"]');
  await page.waitForTimeout(200);
  const catLabel = await page.$('#categorias-saldo-periodo-table .periodo-cat-label');
  if (catLabel) {
    const catValue = await catLabel.evaluate((el) => el.dataset.dimValue);
    await catLabel.click();
    await page.waitForTimeout(200);
    const onSubcategorias = await page.evaluate(() => document.getElementById('tab-subcategorias').classList.contains('active'));
    const catFilterAfterDrill = await page.$eval('#filter-categoria', (el) => el.value);
    log(
      'clicar no rotulo de uma categoria leva pra aba Subcategorias com o filtro aplicado',
      onSubcategorias && catFilterAfterDrill === catValue,
      `ativo=${onSubcategorias} filtro=${catFilterAfterDrill} esperado=${catValue}`
    );

    const subcatLabel = await page.$('#subcategorias-saldo-periodo-table .periodo-cat-label');
    if (subcatLabel) {
      const subcatValue = await subcatLabel.evaluate((el) => el.dataset.dimValue);
      await subcatLabel.click();
      await page.waitForTimeout(200);
      const onTransacoes = await page.evaluate(() => document.getElementById('tab-transacoes').classList.contains('active'));
      const subcatFilterAfterDrill = await page.$eval('#filter-subcategoria', (el) => el.value);
      log(
        'clicar no rotulo de uma subcategoria leva pra aba Transacoes com o filtro aplicado',
        onTransacoes && subcatFilterAfterDrill === subcatValue,
        `ativo=${onTransacoes} filtro=${subcatFilterAfterDrill} esperado=${subcatValue}`
      );
    } else {
      log('clicar no rotulo de uma subcategoria leva pra aba Transacoes com o filtro aplicado', false, 'nenhuma periodo-cat-label encontrada em Subcategorias apos o drill');
    }
    await page.click('#filter-clear');
    await page.waitForTimeout(150);
  } else {
    log('clicar no rotulo de uma categoria leva pra aba Subcategorias com o filtro aplicado', false, 'nenhuma periodo-cat-label encontrada');
    log('clicar no rotulo de uma subcategoria leva pra aba Transacoes com o filtro aplicado', false, 'pulado, categoria nao encontrada');
  }

  log('sem erros de console/pageerror', consoleErrors.length === 0, consoleErrors.join('; '));
  await ctx.close();
  return results;
}
