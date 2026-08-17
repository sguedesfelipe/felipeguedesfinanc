---
name: deploy-grana
description: Publicar uma nova versao do dashboard "Grana" no Cloud Run (relatorio-gastos, southamerica-east1). Use quando o usuario pedir para "fazer o deploy", "publicar", "subir pro ar" ou "atualizar o site" deste projeto.
---

# Deploy do Grana no Cloud Run

O app roda no serviço Cloud Run `relatorio-gastos`, região `southamerica-east1`,
projeto GCP `relatorio-gastos`. O deploy builda a imagem via Cloud Build a
partir do código local (`gcloud run deploy --source .`) — não existe pipeline
automático ainda (ver skill/tarefa de CI para o que É automatizado: apenas
typecheck+build a cada push, não o deploy em si).

Este runbook assume que quem está rodando os comandos é o usuário, num
terminal com `gcloud` autenticado (tipicamente o Cloud Shell do GCP) — uma
sessão do Claude Code aqui não tem essas credenciais. Se você (Claude) está
processando este pedido e não tem acesso a `gcloud`, **entregue os comandos
abaixo para o usuário rodar**, não tente executá-los.

## Passo a passo

### 1. Garantir que está no diretório do projeto

Cada sessão nova do Cloud Shell abre em `$HOME`, não de onde a pessoa parou.

```bash
cd ~/felipeguedesfinanc
```

Se a pasta não existir (Cloud Shell às vezes limpa o disco persistente depois
de muito tempo sem uso), clone de novo:

```bash
git clone https://github.com/sguedesfelipe/felipeguedesfinanc.git
cd felipeguedesfinanc
```

### 2. Atualizar o código

```bash
git fetch origin
git checkout claude/pluggy-expense-report-5xcbmu
git pull origin claude/pluggy-expense-report-5xcbmu
```

Ajuste o nome da branch se o trabalho atual estiver em outra (ex.: depois de
um merge pra `main`, use `main` aqui em vez disso).

### 3. Conferir login e projeto do `gcloud`

Geralmente persistem entre sessões do Cloud Shell, mas vale confirmar:

```bash
gcloud auth list
gcloud config get-value project
```

Deve mostrar a conta correta como ativa e o projeto `relatorio-gastos`. Se
não estiver certo:

```bash
gcloud auth login
gcloud config set project relatorio-gastos
```

### 4. Exportar as variáveis do deploy

Não persistem entre sessões — precisa redefinir toda vez:

```bash
export REGION=southamerica-east1
export SERVICE=relatorio-gastos
```

### 5. Rodar o deploy

```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION"
```

**Não** passe `--allow-unauthenticated`, `--set-env-vars` nem
`--set-secrets` — o Cloud Run mantém a configuração da revisão anterior
automaticamente quando esses parâmetros não são informados. Se em algum
momento o comando perguntar "Allow unauthenticated invocations?", responda
**N** (o controle de acesso é feito pelo próprio app via cookie de sessão,
não pelo Cloud Run).

O build leva de 2 a 4 minutos. Ao final, o comando imprime a URL do serviço:
`https://relatorio-gastos-798723137416.southamerica-east1.run.app`.

### 6. Verificar que subiu certo

Abra a URL, faça login com uma conta Google que esteja em `ALLOWED_EMAILS`, e
confira:

- a interface carrega sem tela em branco / sem erro no console do navegador
- os dados reais aparecem (não uma tela vazia por falha de conexão com o
  Firestore)
- uma edição de categoria numa transação salva normalmente (dispara um PATCH
  que persiste — recarregar a página não deve reverter a edição)

Se a mudança deployada mexeu em algo visual, confira também que light/dark
mode continuam legíveis e que a versão mobile (reduza a largura da janela ou
abra num celular) mantém a barra de navegação inferior.

## Se algo der errado: como voltar atrás

O Cloud Run guarda as revisões anteriores. Pra rollback imediato sem precisar
reverter código e re-deployar:

```bash
gcloud run revisions list --service "$SERVICE" --region "$REGION"
gcloud run services update-traffic "$SERVICE" --region "$REGION" \
  --to-revisions=REVISAO_ANTERIOR=100
```

Troque `REVISAO_ANTERIOR` pelo nome exato listado (ex.:
`relatorio-gastos-00006-abc`).

## Antes de deployar algo sensível

Se a mudança mexeu em autenticação (`src/auth.ts`, `src/server.ts`) ou em
qualquer lógica que decide dinheiro (`src/classify.ts`, `src/aggregate.ts`),
rode `/code-review` ou `/security-review` antes deste passo a passo — não é
parte do deploy em si, mas é o momento certo de pedir essa revisão.
