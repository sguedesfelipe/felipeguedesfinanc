# Relatorio de gastos via API do Pluggy

Script em Node.js/TypeScript que conecta na [API do Pluggy](https://docs.pluggy.ai)
para buscar contas e transacoes reais e gerar um relatorio de gastos em dois
formatos: uma planilha (`.xlsx`) com todas as transacoes categorizadas e um
dashboard (`.html`) com totais, gastos por mes e por categoria.

## 1. Credenciais do Pluggy

O app que voce ja usa em [meu.pluggy.ai](https://meu.pluggy.ai/overview) e o
produto voltado ao usuario final. Para acessar os mesmos dados **via API** e
preciso, adicionalmente, de uma conta de desenvolvedor:

1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) (isso
   libera um trial).
2. Crie uma **Application** no dashboard. Isso gera um `CLIENT_ID` e um
   `CLIENT_SECRET` — copie os dois.
3. Para usar a conta que voce ja conectou em meu.pluggy.ai (em vez de conectar
   o banco de novo): no dashboard, adicione o conector "MeuPluggy" a sua
   aplicacao, abra a aplicacao Demo e use a opcao de vincular sua conta
   MeuPluggy existente via OAuth. Isso cria um `item` na sua aplicacao para
   cada banco que voce ja tem conectado no MeuPluggy.
4. Anote o(s) `itemId` gerado(s) — eles aparecem no dashboard (Items) ou na
   resposta do fluxo de conexao.

Se preferir conectar uma conta do zero (sem passar pelo MeuPluggy), use o
Pluggy Connect widget com um `connectToken` gerado pela sua aplicacao — nesse
caso o `itemId` retornado ao final da conexao e o que voce deve usar.

### Nao sei meu itemId

A API do Pluggy nao expoe um endpoint para "listar todos os items" (por
seguranca), entao se voce nao anotou o itemId ao conectar, tem duas opcoes:

1. Ver no [dashboard.pluggy.ai](https://dashboard.pluggy.ai), dentro da sua
   Application, na aba **Items**.
2. Gerar um novo item rodando (depois de preencher `PLUGGY_CLIENT_ID` e
   `PLUGGY_CLIENT_SECRET` no `.env`):

   ```bash
   npm run connect
   ```

   Isso abre `http://localhost:4321` com o widget oficial do Pluggy Connect.
   Conecte sua conta (ou vincule a que ja existe no MeuPluggy) e o `itemId`
   aparece na pagina e no terminal — copie para `PLUGGY_ITEM_IDS` no `.env`.

## 2. Configurar o projeto

```bash
npm install
cp .env.example .env
```

Preencha o `.env`:

```
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
PLUGGY_ITEM_IDS=item-id-1,item-id-2
```

`PLUGGY_ITEM_IDS` aceita varios ids separados por virgula (um por banco/cartao
conectado).

## 3. Gerar o relatorio

```bash
npm run report
```

Por padrao busca os ultimos 6 meses de transacoes. Para mudar o periodo ou a
pasta de saida:

```bash
npm run report -- --months=12 --out=meus-relatorios
```

Os arquivos sao gravados em `reports/<data-de-hoje>/`:

- `relatorio-gastos.html` — dashboard com abas: Resumo, Categorias,
  Transacoes e Pendencias de Classificacao. As abas Categorias/Transacoes/
  Pendencias sao editaveis: alterar a Categoria/Subcategoria de qualquer
  linha recalcula os totais por categoria na hora, direto no navegador (sem
  precisar de servidor). Essas edicoes valem so nessa pagina aberta — para
  valerem no proximo `npm run report`, repita a mesma classificacao na
  planilha `.xlsx`.
- `relatorio-gastos.xlsx` — planilha com abas de Resumo, Resumo Mensal,
  Categorias, Maiores Gastos, Contas, a lista completa de Transacoes e
  Pendencias de Classificacao.

## Como os gastos sao calculados

- Cada transacao tem um campo `type` (`DEBIT` ou `CREDIT`) retornado pelo
  Pluggy. `DEBIT` e tratado como gasto e `CREDIT` como receita/entrada — essa
  logica ja vale tanto para contas correntes quanto para cartao de credito.

## Classificacao por Categoria/Subcategoria

Cada transacao recebe uma **Categoria** e **Subcategoria** na mesma taxonomia
usada na planilha pessoal do usuario (aba "Despezzas"), em vez da categoria
generica em ingles que o Pluggy atribui (essa continua disponivel na coluna
"Categoria do banco", so como referencia).

A logica em `src/classify.ts` decide a classificacao nesta ordem:

1. **Match exato** com uma descricao ja classificada antes (ex.: mesma loja em
   meses diferentes, ignorando o numero da parcela) — confianca alta.
2. **Match por prefixo** do estabelecimento (antes do `*` na descricao) — usado
   quando o merchant se repete mas com sufixo diferente — confianca media.
3. **Sem historico parecido**: um palpite e feito a partir da categoria
   generica do Pluggy (ex. "Groceries" -> alimentacao/supermercado). A
   transacao ainda recebe uma sugestao (nunca fica em branco), mas e marcada
   como pendente.

Todo lancamento marcado como pendente aparece na aba **Pendencias de
Classificacao** da planilha, com a sugestao ja preenchida, o motivo e o numero
da linha correspondente na aba Transacoes. As colunas Categoria/Subcategoria
tem uma lista suspensa (com as opcoes da sua taxonomia) para facilitar, mas
aceitam qualquer texto — voce pode alterar qualquer classificacao, mesmo as
que nao ficaram pendentes.

**Importante:** os totais do relatorio (Categorias, HTML, etc.) sao calculados
a partir da aba Transacoes. Se corrigir algo na aba Pendencias, repita a
mesma correcao na linha indicada da aba Transacoes.

As regras de classificacao (taxonomia + historico de estabelecimentos ja
classificados) ficam em `data/despesas-classificacao.json`, gerado uma vez a
partir da planilha pessoal do usuario.

**Limitacao conhecida:** se voce paga a fatura do cartao pela mesma conta
corrente conectada, essa transferencia aparece duas vezes nos dados brutos —
como gasto (`DEBIT`) na conta corrente e como receita (`CREDIT`) no cartao.
O relatorio atual nao tenta casar/anular transferencias entre contas prorias;
se isso distorcer muito os totais, e possivel filtrar essas transacoes na aba
"Transacoes" da planilha.

## Estrutura

```
src/
  config.ts            variaveis de ambiente e argumentos de linha de comando
  pluggyClient.ts       inicializacao do PluggyClient (SDK oficial)
  fetchData.ts          busca items -> contas -> transacoes
  classify.ts            classifica cada transacao em categoria/subcategoria
  aggregate.ts           agrega totais por mes, categoria, conta e descricao
  reportSpreadsheet.ts  gera o .xlsx (exceljs)
  reportHtml.ts          gera o dashboard .html
  index.ts               orquestra tudo (CLI)
  connect.ts             ajuda a achar/criar um itemId (npm run connect)
data/
  despesas-classificacao.json  taxonomia + historico usados por classify.ts
```
