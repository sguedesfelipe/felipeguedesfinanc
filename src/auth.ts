import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

const COOKIE_NAME = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface AuthConfig {
  googleClientId: string;
  allowedEmails: string[];
  sessionSecret: string;
}

export function loadAuthConfig(): AuthConfig {
  const googleClientId = requireEnv('GOOGLE_CLIENT_ID');
  const sessionSecret = requireEnv('SESSION_SECRET');
  const allowedEmails = requireEnv('ALLOWED_EMAILS')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length === 0) {
    throw new Error('ALLOWED_EMAILS esta vazio. Informe ao menos um e-mail.');
  }
  return { googleClientId, allowedEmails, sessionSecret };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel de ambiente ${name} nao definida.`);
  return value;
}

function sign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

// Cookie de sessao "sem estado" (nao fica guardado em nenhum banco/memoria do
// servidor): o proprio valor do cookie carrega o e-mail + validade,
// autenticado com HMAC. Como o Cloud Run pode rodar varias instancias do
// container ao mesmo tempo, uma sessao guardada so em memoria local
// quebraria toda vez que o Cloud Run decidisse atender a mesma pessoa numa
// instancia diferente — esse formato funciona igual em qualquer instancia,
// todas com o mesmo SESSION_SECRET.
export function createSessionCookieValue(email: string, secret: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionCookieValue(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  const [encoded, sig] = value.split('.');
  if (!encoded || !sig) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sign(encoded, secret)), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload.email;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

// Confere o token que o botao "Entrar com o Google" (Google Identity
// Services) manda pro backend depois do login. Verifica a assinatura do
// Google (garante que o token e legitimo e foi emitido pra este app) e
// devolve o e-mail so se ele vier confirmado como verificado pelo Google.
export async function verifyGoogleIdToken(idToken: string, googleClientId: string): Promise<string | null> {
  const client = new OAuth2Client(googleClientId);
  const ticket = await client.verifyIdToken({ idToken, audience: googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) return null;
  return payload.email.toLowerCase();
}

export function loginPageHtml(googleClientId: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Entrar — Relatorio de gastos</title>
<script src="https://accounts.google.com/gsi/client" async defer></script>
<style>
  body { font: 15px system-ui, sans-serif; background: #f5f5f3; color: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border: 1px solid #e2e1da; border-radius: 12px; padding: 32px 40px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #6b6a63; margin: 0 0 24px; font-size: 14px; }
  #status { margin-top: 16px; color: #9a5b00; font-size: 13px; min-height: 18px; }
</style>
</head>
<body>
  <div class="card">
    <h1>Relatorio de gastos</h1>
    <p>Entre com a conta Google autorizada pra acessar o dashboard.</p>
    <div id="g_id_onload" data-client_id="${googleClientId}" data-callback="handleCredentialResponse"></div>
    <div class="g_id_signin" data-type="standard" data-shape="pill"></div>
    <div id="status"></div>
  </div>
  <script>
    function handleCredentialResponse(response) {
      const statusEl = document.getElementById('status');
      statusEl.textContent = 'Entrando...';
      fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      }).then((r) => {
        if (r.ok) {
          location.href = '/';
        } else {
          statusEl.textContent = 'Acesso negado — essa conta nao esta autorizada.';
        }
      }).catch(() => {
        statusEl.textContent = 'Erro ao entrar. Tenta de novo.';
      });
    }
  </script>
</body>
</html>`;
}
