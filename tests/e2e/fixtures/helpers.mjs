// Helpers compartilhados por todos os specs: criar uma aba ja autenticada
// (via cookie de sessao assinado localmente, sem passar pelo OAuth de
// verdade do Google) e um coletor de resultados com o mesmo formato usado
// em toda a suite.
import { createSessionCookieValue } from '../../../dist/auth.js';

export const TEST_EMAIL = 'e2e-test@example.com';
export const TEST_SESSION_SECRET = 'e2e-test-session-secret';

export function makeLogger(specName) {
  const results = [];
  function log(name, ok, extra) {
    const entry = { spec: specName, name, ok, extra };
    results.push(entry);
    const prefix = ok ? 'PASS' : 'FAIL';
    console.log(`${prefix} [${specName}] ${name}${extra ? ' :: ' + extra : ''}`);
  }
  return { log, results };
}

export async function newAuthedPage(browser, baseUrl, contextOptions) {
  const cookieValue = createSessionCookieValue(TEST_EMAIL, TEST_SESSION_SECRET);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...contextOptions });
  await ctx.addCookies([{ name: 'session', value: cookieValue, domain: new URL(baseUrl).hostname, path: '/' }]);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) consoleErrors.push('console.error: ' + msg.text());
  });
  return { ctx, page, consoleErrors };
}
