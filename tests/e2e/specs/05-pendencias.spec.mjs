import { makeLogger, newAuthedPage } from '../fixtures/helpers.mjs';

export async function run({ browser, baseUrl }) {
  const { log, results } = makeLogger('pendencias');
  const { ctx, page, consoleErrors } = await newAuthedPage(browser, baseUrl);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.click('.g-side-item[data-tab="pendencias"]');
  await page.waitForTimeout(300);

  const initialRows = await page.$$eval('#pendencias-table tbody tr[data-row-id]', (rows) => rows.length);
  log('fila de pendencias tem os itens do seed (4)', initialRows === 4, `rows=${initialRows}`);

  const visibleCols = await page.$$eval('#pendencias-table thead th', (ths) => ths.filter((th) => getComputedStyle(th).display !== 'none').length);
  log('7 colunas visiveis (Data incluida)', visibleCols === 7, `got ${visibleCols}`);

  const descHtml = await page.innerHTML('#pendencias-table tbody tr:first-child td[data-col="description"]');
  log('descricao tem avatar + chevron + selo de confianca', descHtml.includes('g-tx-expand') && descHtml.includes('g-tx-avatar-sm') && descHtml.includes('g-conf-pill'));
  const pillClass = await page.getAttribute('#pendencias-table tbody tr:first-child .g-conf-pill', 'class');
  log('selo de confianca tem classe g-conf-{alta|media|baixa}', /g-conf-(alta|media|baixa)/.test(pillClass || ''), pillClass);

  // painel de detalhe: abre, tem os campos certos, fecha
  const expandBtn = await page.$('#pendencias-table tbody tr:first-child .g-tx-expand');
  await expandBtn.click();
  await page.waitForTimeout(200);
  const detailRows = await page.$$eval('#pendencias-table tbody tr.g-tx-detail-row', (els) => els.length);
  log('chevron abre exatamente um painel de detalhe (sem disparo duplo)', detailRows === 1, `got ${detailRows}`);
  const detailLabels = await page.$$eval('#pendencias-table tr.g-tx-detail-row .g-tx-detail-label', (els) => els.map((e) => e.textContent));
  log('painel de detalhe nao duplica a coluna Data', !detailLabels.includes('Data'));
  log('painel de detalhe mostra o motivo da pendencia', detailLabels.includes('Motivo da pendencia'));
  const colspanAttr = await page.getAttribute('#pendencias-table tr.g-tx-detail-row td', 'colspan');
  log('colspan do painel de detalhe bate com 7 colunas', colspanAttr === '7', colspanAttr);
  await expandBtn.click();
  await page.waitForTimeout(150);
  log('chevron fecha o painel de detalhe de novo', !(await page.$('#pendencias-table tbody tr.g-tx-detail-row')));

  // regressao: aceitar uma parcela SEGUIDORA (com a lider ainda pendente)
  // precisa continuar aceita depois de recarregar a pagina — ver
  // enforceInstallmentConsistency() em src/aggregate.ts.
  const followerRow = page.locator('#pendencias-table tbody tr[data-row-id]', {
    has: page.locator('.g-tx-desc-text', { hasText: 'LOJA MOVEIS PARCELA 2' }),
  });
  const followerCount = await followerRow.count();
  log('encontra a parcela seguidora (seed-9) na fila', followerCount === 1, `count=${followerCount}`);

  if (followerCount === 1) {
    const [patchReq] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'PATCH' && req.url().includes('/api/transactions/seed-9'), { timeout: 3000 }).catch(() => null),
      followerRow.locator('.btn-revisado').click(),
    ]);
    await page.waitForTimeout(300);
    log('aceitar a parcela seguidora dispara PATCH', !!patchReq, patchReq ? patchReq.url() : 'nenhuma request vista');

    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.g-side-item[data-tab="pendencias"]');
    await page.waitForTimeout(300);

    const stillGone = await page.locator('#pendencias-table tbody tr[data-row-id]', {
      has: page.locator('.g-tx-desc-text', { hasText: 'LOJA MOVEIS PARCELA 2' }),
    }).count();
    log('parcela seguidora aceita CONTINUA aceita apos recarregar (regressao)', stillGone === 0, `linhas ainda pendentes=${stillGone}`);

    const leaderStillThere = await page.locator('#pendencias-table tbody tr[data-row-id]', {
      has: page.locator('.g-tx-desc-text', { hasText: 'LOJA MOVEIS PARCELA 1' }),
    }).count();
    log('parcela lider (ainda nao revisada) continua na fila', leaderStillThere === 1, `count=${leaderStillThere}`);
  } else {
    log('aceitar a parcela seguidora dispara PATCH', false, 'linha nao encontrada, pulado');
    log('parcela seguidora aceita CONTINUA aceita apos recarregar (regressao)', false, 'linha nao encontrada, pulado');
    log('parcela lider (ainda nao revisada) continua na fila', false, 'linha nao encontrada, pulado');
  }

  // fluxo em lote: selecionar tudo que restou + marcar como revisado
  const remaining = await page.$$eval('#pendencias-table tbody tr[data-row-id]', (rows) => rows.length);
  if (remaining > 0) {
    await page.click('#pend-select-all');
    await page.waitForTimeout(150);
    const selectedCountText = await page.textContent('#pend-selected-count');
    log('selecionar todos atualiza a contagem', Number(selectedCountText) === remaining, selectedCountText);

    const [patchReq2] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'PATCH' && req.url().includes('/api/transactions/'), { timeout: 3000 }).catch(() => null),
      page.click('#pend-bulk-revisado'),
    ]);
    await page.waitForTimeout(300);
    const afterBulkCount = await page.$$eval('#pendencias-table tbody tr[data-row-id]', (rows) => rows.length);
    log('"Marcar selecionados como revisados" esvazia a fila', !!patchReq2 && afterBulkCount === 0, `restante=${afterBulkCount}`);
  } else {
    log('selecionar todos atualiza a contagem', true, 'fila ja vazia');
    log('"Marcar selecionados como revisados" esvazia a fila', true, 'fila ja vazia');
  }

  log('sem erros de console/pageerror', consoleErrors.length === 0, consoleErrors.join('; '));
  await ctx.close();
  return results;
}
