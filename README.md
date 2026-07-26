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

Pra comecar numa data especifica (em vez de "ultimos N meses"), use `--from`
— tem prioridade sobre `--months`:

```bash
npm run report -- --from=2025-01-01
```

**Limite de historico:** `--from` so controla a partir de qual data o script
*pede* transacoes — quanto o Pluggy de fato *tem* depende de quanto historico
o banco/cartao compartilhou quando a conexao foi feita (normalmente ~12 meses
em Open Finance no Brasil, contados a partir da data da conexao, nao da data
de hoje). Pedir uma data anterior a esse limite nao traz mais nada — o script
so devolve o que a API retornar. Transacoes mais antigas que isso precisam ser
adicionadas manualmente (ex.: extrato do proprio banco), o Pluggy nao as tem.

Os arquivos sao gravados em `reports/<data-de-hoje>/`:

- `relatorio-gastos.html` — dashboard com abas: Resumo, Categorias,
  Subcategorias, Transacoes e Pendencias de Classificacao.
  - Barra de filtros no topo, valida para todas as abas e graficos:
    **periodo** (De/Ate), **Categoria**, **Subcategoria** (so mostra as da
    categoria escolhida), **Valido**, **Conta**, **Status (banco)** e
    **Tipo** (Gasto/Receita). Tem um botao **"Aplicar filtro"** (alem de
    aplicar sozinho quando voce muda uma data) e um **"Limpar todos os
    filtros"** que reseta literalmente tudo — periodo, dimensoes, a selecao
    de barras do grafico e os filtros/ordenacao de cada coluna em cada
    tabela — nao so a aba que esta aberta no momento.
  - **Cada cabecalho de coluna das tabelas funciona como ordenador e
    filtro**: clique no nome da coluna pra ordenar (crescente/decrescente,
    alternando a cada clique), digite no campinho abaixo do nome pra
    filtrar por aquele valor especifico daquela tabela.
  - O grafico "Gastos ao longo do tempo" (aba Resumo) tem um seletor de
    granularidade: **por dia**, ou acumulado por **mes**, **trimestre**,
    **semestre** ou **ano** — e mostra o valor de cada barra direto no
    grafico (sem precisar passar o mouse, quando ha espaco pra isso).
  - **O grafico "Gastos ao longo do tempo" e selecionavel**: clique numa
    barra pra selecionar aquele periodo — as outras barras continuam
    visiveis (so ficam esmaecidas), a clicada fica destacada. Ctrl+clique
    adiciona/remove outras barras da selecao. A selecao filtra o resto do
    relatorio (KPIs, tabelas, outras abas) igual aos filtros do topo, sem
    trocar de aba sozinho — confira o resultado quando quiser em
    "Transacoes". Um link "limpar selecao" aparece ao lado do grafico
    quando ha alguma selecao ativa.
  - As abas **Categorias** e **Subcategorias** seguem o mesmo formato: uma
    tabela **"...ao longo do tempo"** (categoria/subcategoria x periodo, com
    seletor de granularidade proprio) em vez de grafico — com varias
    categorias/subcategorias de escalas bem diferentes, uma barra
    proporcional escondia as menores; a tabela mostra o valor exato de cada
    uma, com um leve realce proporcional ao peso daquela linha naquele
    periodo. Clicar numa celula filtra por categoria/subcategoria + periodo;
    clicar no nome da linha filtra so por aquela categoria/subcategoria (sem
    trocar de aba). Tem uma linha **"Total"** no rodape (subtotal de cada
    coluna/periodo) e uma coluna **"Total"** no fim (subtotal de cada linha),
    e qualquer cabecalho de coluna (nome, periodo ou Total) funciona como
    ordenador — clique pra ordenar do maior pro menor ou vice-versa. Abaixo
    ficam duas tabelas simples: **Gastos por categoria/subcategoria** e
    **Receita por categoria/subcategoria** (total e quantidade).
  - Cada transacao tem um **ID** (o id que o Pluggy atribui; se algum dia
    vier vazio, um id proprio e gerado a partir da data + um sufixo
    aleatorio).
  - Alem da coluna "Data" (data da fatura, no caso de cartao), toda transacao
    tem uma coluna **DataConsiderada**: a data real da compra e, em compras
    parceladas, avancada um mes por parcela (parcela 3 de uma compra feita em
    maio cai em julho) — e a data certa pra analisar quando o gasto realmente
    aconteceu, em vez de quando ele apareceu na fatura. **Todo filtro de
    periodo, grafico e tabela agregada (Resumo, Categorias, Subcategorias,
    Resumo Mensal na planilha) usa a DataConsiderada pra agrupar/filtrar por
    data — nunca a "Data" crua**, que pra compras parceladas no cartao
    reflete a fatura, nao quando o gasto de fato aconteceu.
  - **Todas as parcelas de uma mesma compra sempre tem a mesma
    Categoria/Subcategoria.** So a primeira parcela (a de menor numero que
    apareceu no periodo buscado) e editavel; as demais ficam com um cadeado
    🔒 e seguem automaticamente o que voce definir na primeira — tanto no
    dashboard quanto na planilha.
  - As abas Categorias/Transacoes/Pendencias sao editaveis: alterar a
    Categoria/Subcategoria de qualquer linha recalcula os totais na hora.
  - A aba Transacoes traz **todos os campos que o Pluggy devolve** por
    lancamento, exceto `categoryId` (a pedido do usuario): descricao
    original do banco, moeda, valor na moeda da conta, codigos internos do
    banco/Open Finance, estabelecimento (nome/CNPJ/CNAE), pagador/recebedor
    de PIX/boleto (nome + CPF ou CNPJ), motivo do pagamento, tipo de
    transferencia, dados do boleto (linha digitavel, codigo de barras,
    multa/juros/desconto), parcela e valor total da compra, cartao (4
    ultimos digitos), MCC, data da compra, **mes da fatura** (campo que nem
    esta documentado no SDK oficial do Pluggy, so aparece na API — e o que
    explica a coluna "Data" mostrar datas futuras em compras parceladas:
    pra lancamentos de cartao, "Data" e a data da fatura, nao da compra),
    ID/tipo de taxa do cartao, status no banco, saldo apos a transacao, e
    quando o lancamento foi criado/atualizado no Pluggy.
  - A aba Transacoes tem um botao **"Exportar CSV"** que baixa a tabela
    inteira (respeitando o filtro de periodo, com as edicoes que voce ja fez
    na tela) num arquivo `.csv` pronto pra abrir no Excel/Google Sheets —
    mais facil de revisar em lote do que clicar linha por linha na pagina.
  - Edicoes de Categoria/Subcategoria/Valido **sao salvas automaticamente no
    navegador** (localStorage) — fechar a aba, dar F5 ou reabrir esse mesmo
    arquivo depois nao perde o que voce mudou. Um aviso aparece no topo
    quando alguma edicao salva e restaurada, e tem um link no rodape pra
    apagar as edicoes salvas. Isso **nao** substitui mandar a planilha de
    volta: essas edicoes so existem nesse navegador, nesse arquivo — um
    relatorio novo gerado depois (`npm run report`) nao as ve. Pra elas
    valerem permanentemente (inclusive em relatorios futuros), exporte o CSV
    na aba Transacoes e mande de volta, do jeito que ja fizemos antes.
- `relatorio-gastos.xlsx` — planilha com abas de Resumo, Resumo Mensal,
  Categorias, Maiores Gastos, Contas, a lista completa de Transacoes (com as
  mesmas colunas extras do dashboard, incluindo ID e Valido) e Pendencias de
  Classificacao. As abas de tabela tem os **filtros nativos do Excel**
  habilitados no cabecalho (ordenar e filtrar por qualquer coluna).

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

No dashboard, a coluna **"Revisado?"** (planilha) / o checkbox de selecao
(dashboard) ficam na frente, seguidos do motivo da pendencia — e da pra marcar
varias linhas de uma vez e clicar em **"Marcar selecionados como revisados"**,
em vez de uma por uma.

### Corte de revisao ("o que ainda preciso conferir")

`data/despesas-classificacao.json` guarda um campo `revisadoAte`: a data (com
base na DataConsiderada real, nao projetada) ate onde voce ja revisou tudo
manualmente da ultima vez que mandou a planilha de volta. Todo lancamento com
DataConsiderada **nessa data ou depois** cai automaticamente na aba
Pendencias — mesmo que a classificacao sugerida tenha confianca alta — porque
ainda nao foi conferido por voce. Isso e recalculado a cada vez que voce manda
uma planilha revisada: o novo corte passa a ser a data mais recente que
aparece nela.

**Importante:** os totais do relatorio (Categorias, HTML, etc.) sao calculados
a partir da aba Transacoes. Se corrigir algo na aba Pendencias, repita a
mesma correcao na linha indicada da aba Transacoes.

As regras de classificacao (taxonomia + historico de estabelecimentos ja
classificados) ficam em `data/despesas-classificacao.json`. Esse arquivo pode
ser atualizado sempre que o usuario reclassificar transacoes numa planilha
exportada e mandar de volta — nesse caso a classificacao **so vem do
historico** (match exato ou por prefixo) ou do palpite generico baseado na
categoria do banco; nenhuma categoria/subcategoria nova e criada por conta
propria, so as que ja existem na taxonomia ou que o usuario incluiu
explicitamente na planilha.

## Coluna "Valido" (evita contar a fatura do cartao 2x)

Quando voce paga a fatura do cartao pela mesma conta corrente conectada, o
Pluggy traz essa transferencia duas vezes: como gasto (boleto/pix) na conta
corrente e como "Credit card payment" (credito) na conta do cartao. Como os
gastos individuais do cartao ja entram no relatorio um a um, contar essa
fatura de novo dobraria o total.

`src/aggregate.ts` detecta esse caso automaticamente e marca as duas pontas
como **invalidas** (coluna `Valido?` = Nao): tudo que tem a categoria do
banco "Credit card payment", e qualquer debito de conta corrente cujo valor e
data batam com um desses pagamentos recebidos no cartao (janela de 5 dias).
Transacoes invalidas continuam visiveis na aba Transacoes/no dashboard, mas
nao entram nos totais, nas Categorias, no Resumo Mensal nem em Maiores
Gastos.

Voce tem controle total: a coluna `Valido?` e editavel (dropdown Sim/Nao no
Excel, checkbox no dashboard) — se a deteccao errar em algum caso especifico,
so mudar o valor manualmente. O motivo da invalidacao fica na coluna ao lado.

Alem da deteccao automatica, `data/despesas-classificacao.json` guarda uma
lista de descricoes que o usuario ja marcou como invalidas manualmente (ex.:
transferencias entre contas proprias, tipo "Pix enviado FELIPE ..." pro
proprio nome) — essas continuam marcadas `Valido? = Nao` sempre que a mesma
descricao aparecer de novo em relatorios futuros, ate o usuario reverter.

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
