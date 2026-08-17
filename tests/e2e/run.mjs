// Orquestra a suite e2e inteira: sobe o emulador do Firestore, popula com
// dados de teste, sobe o servidor Express apontando pro emulador, roda todos
// os specs com um browser Playwright compartilhado, e derruba tudo no final.
// Nunca toca no Firestore/Cloud Run de producao — tudo roda contra um
// projeto fake (FIRESTORE_EMULATOR_HOST) e portas locais.
//
// Uso:
//   npm test                 # builda e roda a suite inteira
//   npm run test:e2e         # so roda a suite (assume que dist/ ja existe)
//
// Variaveis de ambiente opcionais:
//   E2E_FIRESTORE_PORT       porta do emulador (default 8092)
//   E2E_SERVER_PORT          porta do servidor de teste (default 8879)
//   PLAYWRIGHT_CHROMIUM_PATH caminho de um Chromium ja instalado, pra pular
//                            o download do Playwright (usado em sandboxes
//                            com um Chromium do sistema pre-instalado)

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { TEST_EMAIL, TEST_SESSION_SECRET } from './fixtures/helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const SPECS_DIR = path.join(__dirname, 'specs');

const FIRESTORE_PORT = process.env.E2E_FIRESTORE_PORT || '8092';
const SERVER_PORT = process.env.E2E_SERVER_PORT || '8879';
const FIRESTORE_HOST = `127.0.0.1:${FIRESTORE_PORT}`;
const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;
const GCP_PROJECT = 'demo-e2e-test';

const commonEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
  GOOGLE_CLOUD_PROJECT: GCP_PROJECT,
  GCLOUD_PROJECT: GCP_PROJECT,
};

function checkPrerequisites() {
  if (!existsSync(path.join(REPO_ROOT, 'dist/server.js'))) {
    console.error('dist/server.js nao existe. Rode "npm run build" antes (ou use "npm test", que ja faz isso).');
    process.exit(1);
  }
  const firebaseBin = path.join(REPO_ROOT, 'node_modules/.bin/firebase');
  if (!existsSync(firebaseBin)) {
    console.error('firebase-tools nao encontrado em node_modules/.bin. Rode "npm install" primeiro.');
    process.exit(1);
  }
}

function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(url).then(
        () => resolve(),
        () => {
          if (Date.now() > deadline) reject(new Error(`timeout esperando ${url} responder`));
          else setTimeout(poll, 400);
        }
      );
    })();
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`processo terminou com codigo ${code}`))));
    child.on('error', reject);
  });
}

async function main() {
  checkPrerequisites();

  console.log(`\n[1/4] Subindo o emulador do Firestore na porta ${FIRESTORE_PORT}...`);
  const firebaseBin = path.join(REPO_ROOT, 'node_modules/.bin/firebase');
  // detached:true pra poder matar o grupo inteiro depois (o firebase-tools
  // sobe um processo Java filho que sobrevive se so o wrapper for morto).
  const emulator = spawn(
    firebaseBin,
    ['emulators:start', '--only', 'firestore', '--project', GCP_PROJECT],
    { cwd: FIXTURES_DIR, env: commonEnv, stdio: ['ignore', 'pipe', 'pipe'], detached: true }
  );
  let emulatorLog = '';
  emulator.stdout.on('data', (d) => (emulatorLog += d));
  emulator.stderr.on('data', (d) => (emulatorLog += d));

  let server;
  let exitCode = 1;
  try {
    await waitForHttp(`http://${FIRESTORE_HOST}/`, 120_000);
    console.log('      emulador no ar.');

    console.log('[2/4] Populando dados de teste...');
    await waitForExit(spawn(process.execPath, [path.join(FIXTURES_DIR, 'seed.mjs')], { env: commonEnv, stdio: 'inherit' }));

    console.log(`[3/4] Subindo o servidor de teste na porta ${SERVER_PORT}...`);
    server = spawn(process.execPath, [path.join(REPO_ROOT, 'dist/server.js')], {
      env: {
        ...commonEnv,
        PORT: SERVER_PORT,
        GOOGLE_CLIENT_ID: 'e2e-test-client-id.apps.googleusercontent.com',
        ALLOWED_EMAILS: TEST_EMAIL,
        SESSION_SECRET: TEST_SESSION_SECRET,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let serverLog = '';
    server.stdout.on('data', (d) => (serverLog += d));
    server.stderr.on('data', (d) => (serverLog += d));
    await waitForHttp(BASE_URL, 20_000).catch((e) => {
      throw new Error(`servidor nao respondeu a tempo. Log:\n${serverLog}\n${e.message}`);
    });
    console.log('      servidor no ar.');

    console.log('[4/4] Rodando os specs...\n');
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    });

    const specFiles = ['01-nav-and-filters.spec.mjs', '02-resumo.spec.mjs', '03-tabelas-periodo.spec.mjs', '04-transacoes.spec.mjs', '05-pendencias.spec.mjs', '06-theme-and-calendar.spec.mjs'];
    const allResults = [];
    for (const file of specFiles) {
      const mod = await import(path.join(SPECS_DIR, file));
      const results = await mod.run({ browser, baseUrl: BASE_URL });
      allResults.push(...results);
    }
    await browser.close();

    const failed = allResults.filter((r) => !r.ok);
    console.log(`\n=== RESUMO: ${allResults.length - failed.length}/${allResults.length} passaram ===`);
    if (failed.length > 0) {
      console.log('\nFalhas:');
      for (const f of failed) console.log(`  - [${f.spec}] ${f.name}${f.extra ? ' :: ' + f.extra : ''}`);
    }
    exitCode = failed.length === 0 ? 0 : 1;
  } catch (err) {
    console.error('\nSuite e2e falhou:', err.message);
    console.error('\nLog do emulador:\n' + emulatorLog.slice(-4000));
    exitCode = 1;
  } finally {
    console.log('\nEncerrando servidor e emulador...');
    if (server && !server.killed) server.kill();
    try {
      process.kill(-emulator.pid);
    } catch {
      emulator.kill();
    }
  }

  process.exit(exitCode);
}

main();
