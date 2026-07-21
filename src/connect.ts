import 'dotenv/config';
import http from 'node:http';

const PORT = 4321;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variavel de ambiente ${name} nao definida. Copie .env.example para .env e preencha os valores.`
    );
  }
  return value;
}

async function getApiKey(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao autenticar no Pluggy (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { apiKey: string };
  return data.apiKey;
}

async function getConnectToken(apiKey: string): Promise<string> {
  const res = await fetch('https://api.pluggy.ai/connect_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`Falha ao gerar connect token (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

function pageHtml(connectToken: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Conectar conta Pluggy</title>
<script src="https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js"></script>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; }
  #result { margin-top: 24px; padding: 16px; border-radius: 8px; background: #f0f0f0; display: none; }
  #result.ok { background: #e6f6ea; }
  code { user-select: all; }
  button { padding: 10px 18px; font-size: 15px; cursor: pointer; }
</style>
</head>
<body>
  <h1>Conectar conta ao Pluggy</h1>
  <p>Clique no botao abaixo para abrir o widget oficial do Pluggy Connect. Conecte
  sua conta (ou vincule a que ja existe no MeuPluggy). Ao final, o itemId aparece
  aqui embaixo.</p>
  <button id="open">Abrir Pluggy Connect</button>
  <div id="result"></div>
  <script>
    const connectToken = ${JSON.stringify(connectToken)};
    document.getElementById('open').addEventListener('click', () => {
      const pluggyConnect = new PluggyConnect({
        connectToken,
        includeSandbox: false,
        onSuccess: (itemData) => {
          const itemId = itemData.item.id;
          fetch('/item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }) });
          const el = document.getElementById('result');
          el.className = 'ok';
          el.style.display = 'block';
          el.innerHTML = '<strong>Conectado!</strong><br>itemId: <code>' + itemId + '</code>' +
            '<br><br>Cole esse valor em PLUGGY_ITEM_IDS no seu .env. Pode fechar esta aba.';
        },
        onError: (error) => {
          const el = document.getElementById('result');
          el.style.display = 'block';
          el.innerText = 'Erro: ' + JSON.stringify(error);
        },
      });
      pluggyConnect.init();
    });
  </script>
</body>
</html>`;
}

async function main() {
  const clientId = requireEnv('PLUGGY_CLIENT_ID');
  const clientSecret = requireEnv('PLUGGY_CLIENT_SECRET');

  console.log('Autenticando no Pluggy...');
  const apiKey = await getApiKey(clientId, clientSecret);

  console.log('Gerando connect token...');
  const connectToken = await getConnectToken(apiKey);

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageHtml(connectToken));
      return;
    }

    if (req.method === 'POST' && req.url === '/item') {
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const { itemId } = JSON.parse(body) as { itemId: string };
        console.log('\nitemId encontrado:', itemId);
        console.log(`Adicione (ou acrescente, separado por virgula) em PLUGGY_ITEM_IDS no .env:\n  ${itemId}\n`);
      } catch {
        // ignore malformed body
      }
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, () => {
    console.log(`\nAbra no navegador: http://localhost:${PORT}\n`);
    console.log('(o connect token expira em ~30 minutos)');
  });
}

main().catch((error) => {
  console.error('Erro:', error.message ?? error);
  process.exitCode = 1;
});
