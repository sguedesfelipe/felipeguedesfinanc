import { makeLogger, newAuthedPage } from '../fixtures/helpers.mjs';

export async function run({ browser, baseUrl }) {
  const { log, results } = makeLogger('transacoes');
  const { ctx, page, consoleErrors } = await newAuthedPage(browser, baseUrl);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.click('.g-side-item[data-tab="transacoes"]');
  await page.waitForTimeout(300);

  const visibleCols = await page.$$eval('#transacoes-table thead th', (ths) => ths.filter((th) => getComputedStyle(th).display !== 'none').length);
  log('7 colunas visiveis (Data + Descricao + Categoria + Subcategoria + Valor + Conta + Valido)', visibleCols === 7, `got ${visibleCols}`);

  const dateText = await page.textContent('#transacoes-table tbody tr:first-child td[data-col="dateISO"]');
  log('coluna Data visivel com formato dd/mm/aaaa', /\d{2}\/\d{2}\/\d{4}/.test(dateText || ''), dateText);

  const descHtml = await page.innerHTML('#transacoes-table tbody tr:first-child td[data-col="description"]');
  log('descricao tem avatar + botao de expandir', descHtml.includes('g-tx-expand') && descHtml.includes('g-tx-avatar-sm'));

  const amountClass = await page.getAttribute('#transacoes-table tbody tr:first-child td[data-col="amount"]', 'class');
  log('celula de valor tem classe g-tx-out ou g-tx-in', (amountClass || '').includes('g-tx-out') || (amountClass || '').includes('g-tx-in'), amountClass);

  log('toggle de Valido presente', !!(await page.$('#transacoes-table tbody tr:first-child input.valido-input')));
  log('chip de categoria presente', !!(await page.$('#transacoes-table tbody tr:first-child td[data-col="categoria"] input.cls-input, #transacoes-table tbody tr:first-child td[data-col="categoria"] .cls-locked')));

  const expandBtn = await page.$('#transacoes-table tbody tr:first-child .g-tx-expand');
  await expandBtn.click();
  await page.waitForTimeout(200);
  const detailRow = await page.$('#transacoes-table tbody tr.g-tx-detail-row');
  log('chevron abre o painel de detalhe', !!detailRow);
  const detailLabels = await page.$$eval('#transacoes-table tr.g-tx-detail-row .g-tx-detail-label', (els) => els.map((e) => e.textContent));
  log('painel de detalhe nao duplica a coluna Data', !detailLabels.includes('Data'), detailLabels.slice(0, 5).join(', '));
  log('painel de detalhe mostra DataConsiderada', detailLabels.includes('DataConsiderada'));
  const colspanAttr = await page.getAttribute('#transacoes-table tr.g-tx-detail-row td', 'colspan');
  log('colspan do painel de detalhe bate com 7 colunas', colspanAttr === '7', colspanAttr);

  await expandBtn.click();
  await page.waitForTimeout(150);
  log('chevron fecha o painel de detalhe de novo', !(await page.$('#transacoes-table tbody tr.g-tx-detail-row')));

  const firstCatInput = await page.$('#transacoes-table tbody tr:first-child input.cls-input[data-field="categoria"]');
  if (firstCatInput) {
    await firstCatInput.click({ clickCount: 3 });
    await firstCatInput.fill('Transporte');
    const [patchReq] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'PATCH' && req.url().includes('/api/transactions/'), { timeout: 3000 }).catch(() => null),
      page.keyboard.press('Tab'),
    ]);
    log('editar categoria via chip ainda dispara PATCH (motor intocado)', !!patchReq, patchReq ? patchReq.url() : 'nenhuma request vista');
  } else {
    log('editar categoria via chip ainda dispara PATCH (motor intocado)', false, 'nenhum cls-input desbloqueado na 1a linha');
  }

  const amountTh = await page.$('#transacoes-table thead th:nth-child(6) .th-label');
  if (amountTh) {
    const beforeHtml = await page.innerHTML('#transacoes-table tbody');
    await amountTh.click();
    await page.waitForTimeout(150);
    const afterHtml = await page.innerHTML('#transacoes-table tbody');
    log('ordenar pela coluna Valor ainda funciona', beforeHtml !== afterHtml);
  } else {
    log('ordenar pela coluna Valor ainda funciona', false, 'th-label nao encontrado na posicao 6');
  }

  log('botao Exportar CSV ainda presente', !!(await page.$('#export-transacoes')));

  log('sem erros de console/pageerror', consoleErrors.length === 0, consoleErrors.join('; '));
  await ctx.close();
  return results;
}
