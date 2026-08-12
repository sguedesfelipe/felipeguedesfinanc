import express from 'express';
import cookieParser from 'cookie-parser';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb } from './firestore.js';
import { initClassification, loadRulesFromFirestore, persistClassificationEdit } from './classify.js';
import { deriveReport, Report, CategorizedTransaction } from './aggregate.js';
import { loadAllTransactions, loadAllAccounts, updateTransaction } from './repo.js';
import { buildHtmlReport, toClientTransactions } from './reportHtml.js';
import { writeSpreadsheetBuffer } from './reportSpreadsheet.js';
import { runDailyRefresh } from './refresh.js';
import {
  loadAuthConfig,
  loginPageHtml,
  verifyGoogleIdToken,
  createSessionCookieValue,
  verifySessionCookieValue,
  SESSION_COOKIE_NAME,
} from './auth.js';

async function loadReport(db: Firestore): Promise<Report> {
  const [transactions, accounts] = await Promise.all([loadAllTransactions(db), loadAllAccounts(db)]);
  return deriveReport(transactions, accounts);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Intervalo exibido no topo do dashboard: como aqui os dados vem inteiros do
// Firestore (nao de uma busca com --from/--months), usamos a data da
// transacao mais antiga carregada ate hoje, so pra referencia visual.
function reportDateRange(report: Report): { from: string; to: string } {
  const dates = report.transactions.map((t) => t.dataConsiderada.getTime());
  const from = dates.length ? isoDate(new Date(Math.min(...dates))) : isoDate(new Date());
  return { from, to: isoDate(new Date()) };
}

async function main() {
  const db = getDb();
  initClassification(await loadRulesFromFirestore(db));
  const auth = loadAuthConfig();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Login com Google feito no proprio app (ver src/auth.ts): nao depende de
  // nenhuma configuracao de plataforma tipo IAP, so das duas rotas abaixo +
  // este middleware de portaria. O cookie de sessao e verificado a cada
  // requisicao; quem nao tiver um valido e redirecionado (paginas) ou
  // recebe 401 (API) antes de chegar em qualquer dado.
  app.get('/login', (_req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8').send(loginPageHtml(auth.googleClientId));
  });

  app.post('/auth/google', async (req, res) => {
    const { credential } = req.body ?? {};
    if (typeof credential !== 'string') {
      res.status(400).end();
      return;
    }
    const email = await verifyGoogleIdToken(credential, auth.googleClientId).catch(() => null);
    if (!email || !auth.allowedEmails.includes(email)) {
      res.status(403).end();
      return;
    }
    res.cookie(SESSION_COOKIE_NAME, createSessionCookieValue(email, auth.sessionSecret), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.status(204).end();
  });

  app.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(204).end();
  });

  app.use((req, res, next) => {
    const email = verifySessionCookieValue(req.cookies?.[SESSION_COOKIE_NAME], auth.sessionSecret);
    if (email && auth.allowedEmails.includes(email)) {
      next();
      return;
    }
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Nao autenticado.' });
      return;
    }
    res.redirect('/login');
  });

  app.get('/', async (_req, res) => {
    const report = await loadReport(db);
    const { from, to } = reportDateRange(report);
    res.set('Content-Type', 'text/html; charset=utf-8').send(buildHtmlReport(report, from, to));
  });

  app.get('/api/transactions', async (_req, res) => {
    const report = await loadReport(db);
    res.json(toClientTransactions(report));
  });

  app.patch('/api/transactions/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    const { description, categoria, subcategoria, valido, pendente } = req.body ?? {};

    const patch: Partial<Pick<CategorizedTransaction, 'categoria' | 'subcategoria' | 'valido' | 'pendente'>> = {};
    if (typeof categoria === 'string') patch.categoria = categoria;
    if (typeof subcategoria === 'string') patch.subcategoria = subcategoria;
    if (typeof valido === 'boolean') patch.valido = valido;
    if (typeof pendente === 'boolean') patch.pendente = pendente;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'Nenhum campo reconhecido no corpo da requisicao.' });
      return;
    }

    await updateTransaction(db, transactionId, patch);

    if (typeof description === 'string' && typeof categoria === 'string' && typeof subcategoria === 'string') {
      await persistClassificationEdit(db, description, categoria, subcategoria);
    }

    res.status(204).end();
  });

  app.post('/api/refresh', async (_req, res) => {
    const stats = await runDailyRefresh(db);
    res.json(stats);
  });

  app.get('/api/export/xlsx', async (_req, res) => {
    const report = await loadReport(db);
    const buffer = await writeSpreadsheetBuffer(report);
    res
      .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .set('Content-Disposition', `attachment; filename="relatorio-gastos-${isoDate(new Date())}.xlsx"`)
      .send(buffer);
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Erro interno.' });
  });

  const port = Number(process.env.PORT) || 8080;
  app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

main().catch((error) => {
  console.error('Erro ao iniciar o servidor:', error.message ?? error);
  process.exitCode = 1;
});
