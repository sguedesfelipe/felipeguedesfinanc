---
name: verify-grana
description: Rodar ou estender a suite de testes e2e deste projeto (tests/e2e). Use quando o usuario pedir para "testar", "verificar se quebrou algo", "rodar os testes" ou antes de qualquer deploy que mexa em src/.
---

# Suite de testes e2e do Grana

Antes desta skill existir, cada verificação era montada à mão numa pasta de
scratch, a cada sessão — emulador do Firestore, dados de exemplo e um script
Playwright, tudo recriado do zero toda vez. Isso agora está formalizado em
`tests/e2e/`, versionado no repositório.

## Rodar a suite

```bash
npm test
```

Isso builda o projeto (`tsc`) e depois roda `tests/e2e/run.mjs`, que:

1. Sobe um emulador do Firestore local (porta 8092 por padrão) — nunca toca
   no Firestore de produção.
2. Popula com os dados de `tests/e2e/fixtures/seed.mjs` (transações, contas,
   regras de classificação, incluindo um grupo de parcelas e itens
   pendentes com diferentes níveis de confiança).
3. Sobe o servidor Express (`dist/server.js`) apontando pro emulador, numa
   porta local (8879 por padrão).
4. Roda os 6 arquivos de `tests/e2e/specs/*.spec.mjs` com um browser
   Playwright compartilhado.
5. Derruba servidor e emulador no final, mesmo se algum teste falhar.

Se só quiser rodar a suite sem re-buildar (já tem `dist/` atualizado):

```bash
npm run test:e2e
```

### Pré-requisitos

- **Java**: o emulador do Firestore precisa de um JRE no PATH. Normalmente
  já está disponível; se faltar, instale um JRE (ex.: `apt install
  default-jre` em Debian/Ubuntu).
- **Browser do Playwright**: na primeira vez, rode
  `npx playwright install chromium` pra baixar o Chromium que os testes
  usam. Num ambiente com um Chromium do sistema já instalado (como esta
  sandbox), aponte pra ele em vez de baixar de novo:
  ```bash
  PLAYWRIGHT_CHROMIUM_PATH=/caminho/pro/chromium npm test
  ```
- **Portas livres**: 8092 e 8879 por padrão. Pra usar outras (ex.: já tem
  algo rodando nelas), sobrescreva:
  ```bash
  E2E_FIRESTORE_PORT=9092 E2E_SERVER_PORT=9879 npm test
  ```

## O que cada spec cobre

| Arquivo | Cobre |
|---|---|
| `01-nav-and-filters.spec.mjs` | Navegação desktop/mobile (sidebar, barra inferior, folha "Mais"), calendário de período (abrir, presets, aplicar, limpar), edição de categoria disparando PATCH |
| `02-resumo.spec.mjs` | Saldo em destaque, cartões, gráfico de barras, listas rankeadas, filtro por categoria re-renderizando |
| `03-tabelas-periodo.spec.mjs` | As 4 abas de tabela-pivô (Categorias/Subcategorias/Empréstimos/Inválidos): pills Saldo/Gastos/Receita, ordenação, clique em célula filtrando |
| `04-transacoes.spec.mjs` | Colunas visíveis (incluindo Data), avatar + chevron, painel de detalhe, edição via chip, ordenação, exportar CSV |
| `05-pendencias.spec.mjs` | Selo de confiança, painel de detalhe, aceite individual **persistindo após recarregar a página** (regressão do bug de parcela seguidora), fluxo em lote |
| `06-theme-and-calendar.spec.mjs` | Fundo correto em light/dark mode, período padrão (ano corrente até hoje), preset "Este ano" resolvendo pro ano certo, botão "Baixar Excel" |

## Escrevendo um novo caso de teste

Todo spec segue o mesmo formato: exporta uma função `run({ browser, baseUrl })`
que devolve um array de resultados. Use `tests/e2e/fixtures/helpers.mjs`:

```js
import { makeLogger, newAuthedPage } from '../fixtures/helpers.mjs';

export async function run({ browser, baseUrl }) {
  const { log, results } = makeLogger('nome-do-spec');
  const { ctx, page, consoleErrors } = await newAuthedPage(browser, baseUrl);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // ... interações com a pagina ...
  log('descricao do que foi verificado', condicaoBooleana, 'detalhe opcional pra debug');

  log('sem erros de console/pageerror', consoleErrors.length === 0, consoleErrors.join('; '));
  await ctx.close();
  return results;
}
```

`newAuthedPage` já injeta um cookie de sessão válido (sem passar pelo OAuth
de verdade do Google) — use `newAuthedPage(browser, baseUrl, { viewport: {...} })`
pra testar em outra largura, ou `{ colorScheme: 'dark' }` pra testar o tema
escuro.

Depois de escrever o spec, registre o nome do arquivo no array `specFiles`
dentro de `tests/e2e/run.mjs`.

**Se o teste precisar de dados novos** (uma transação com uma característica
específica, outro grupo de parcelas), adicione ao array `transactions` em
`tests/e2e/fixtures/seed.mjs` em vez de criar um fixture paralelo — mantém
todos os specs compartilhando a mesma base de dados coerente.

## Debugando uma falha

O runner imprime `PASS`/`FAIL` linha a linha com o nome do spec e, quando
disponível, um detalhe extra (valor esperado vs. obtido, trecho de HTML,
etc.). Se algo falhar de um jeito que não dá pra entender só pela mensagem:

1. Rode só aquele spec isoladamente — comente temporariamente os outros
   nomes em `specFiles` dentro de `run.mjs`.
2. Troque `chromium.launch({ ... })` em `run.mjs` por
   `chromium.launch({ ..., headless: false })` pra ver o browser de verdade
   (só funciona em ambiente com display; não funciona em CI/sandbox
   headless).
3. Se a falha for "elemento não encontrado", quase sempre é porque a marcação
   HTML mudou — confira `src/reportHtml.ts` e os arquivos `src/report*.ts`
   pelo id/classe que o spec está procurando.

## Antes de confiar numa mudança pra deploy

Rode `npm test` depois de qualquer alteração em `src/`. Se a mudança tocou
em algo sensível (autenticação, classificação, agregação financeira), rode
também `/code-review` ou `/security-review` antes de seguir pra
`/deploy-grana`.
