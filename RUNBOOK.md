# Runbook: hospedar no Google Cloud

Passo a passo pra colocar o dashboard no ar no GCP, com login restrito à sua
conta Google e atualização automática 1x/dia. Todos os comandos abaixo usam
`gcloud` — rode com a sua própria conta autenticada (`gcloud auth login`),
já que esta sessão não tem acesso ao seu projeto GCP.

Preencha essas variáveis no seu terminal antes de começar (ajuste a região
se preferir outra):

```bash
export PROJECT_ID=SEU_PROJETO_GCP
export REGION=southamerica-east1
export SERVICE=relatorio-gastos
export SEU_EMAIL=felipe.sguedes@gmail.com
gcloud config set project "$PROJECT_ID"
```

**Custo esperado: praticamente zero (US$0-1/mês).** Tudo abaixo usa o free
tier do Cloud Run, Firestore, Cloud Scheduler e Secret Manager para o volume
de dados desse projeto (single user, ~2 mil transações, uma atualização por
dia).

**Nota sobre permissões em projetos GCP novos:** projetos criados recentemente
não dão mais permissão automática de "Editor" pra conta de serviço padrão
(`PROJECT_NUMBER-compute@developer.gserviceaccount.com`), que é quem builda
e roda tudo abaixo. Isso significa que, na primeira vez que cada serviço novo
tenta usar algo (Cloud Storage, Artifact Registry, Cloud Logging, Secret
Manager, Firestore...), pode faltar permissão especificamente pra essa conta
— o próprio comando costuma avisar exatamente qual `role` falta. As seções
abaixo já incluem os `add-iam-policy-binding` que descobrimos serem
necessários; se algum comando novo reclamar de permissão, o padrão é sempre o
mesmo: conceder o `role` indicado à conta `${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`
via `gcloud projects add-iam-policy-binding` (pra permissões de projeto) ou
`gcloud secrets add-iam-policy-binding <nome> ...` (pra um segredo
específico).

## 0. Testar localmente antes de mexer em infra real (opcional, recomendado)

```bash
npm install -g firebase-tools   # ou use npx firebase-tools
firebase emulators:start --only firestore --project demo-test
```

Em outro terminal, com `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` (ou a porta
que o emulador informar) e `GOOGLE_CLOUD_PROJECT=demo-test` exportados, dá
pra rodar `tsx src/migrate.ts` e `npm run dev:server` contra o emulador,
sem tocar em nada real. Foi assim que essas mudanças foram validadas nesta
sessão (dados carregam, edição persiste, flag de Empréstimo recalcula,
planilha baixa certinho).

## 1. Habilitar APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

## 2. Tela de consentimento OAuth (necessária pro login do Google no app)

No Console (`APIs e Serviços > Tela de consentimento OAuth`):
1. Tipo: **Externo**.
2. Modo: deixe em **Teste** (não publique/envie pra verificação — como é
   conta Gmail pessoal, não Workspace, publicar exigiria um processo de
   verificação do Google que não é necessário aqui).
3. Em "Usuários de teste", adicione `$SEU_EMAIL`.

## 3. Criar o banco Firestore

```bash
gcloud firestore databases create --location="$REGION" --type=firestore-native
```

Dá permissão pra conta de serviço padrão ler/escrever no Firestore (é ela
quem roda o site e o job diário):

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## 4. Guardar as credenciais do Pluggy e a chave de sessão no Secret Manager

```bash
printf '%s' "SEU_CLIENT_ID" | gcloud secrets create pluggy-client-id --data-file=-
printf '%s' "SEU_CLIENT_SECRET" | gcloud secrets create pluggy-client-secret --data-file=-
printf '%s' "seu-item-id-1,seu-item-id-2" | gcloud secrets create pluggy-item-ids --data-file=-

# chave aleatoria usada pra assinar o cookie de sessao do login (ver secao 6a)
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create session-secret --data-file=-
```

Dá permissão pra conta de serviço padrão ler os 4 segredos (ver nota sobre
permissões no topo deste arquivo):

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
for SECRET in pluggy-client-id pluggy-client-secret pluggy-item-ids session-secret; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 5. Migração inicial (rodar uma única vez, localmente)

Autentique sua máquina local pro `firebase-admin` conseguir escrever no
Firestore de produção:

```bash
gcloud auth application-default login
```

Com o `.env` local já preenchido (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`,
`PLUGGY_ITEM_IDS`), rode:

```bash
GOOGLE_CLOUD_PROJECT="$PROJECT_ID" npm run migrate
```

Isso lê `data/despesas-classificacao.json` (taxonomia + histórico) e busca o
histórico completo no Pluggy, gravando tudo no Firestore. O script imprime os
totais no final — confira contra o último relatório gerado pelo CLI
(`reports/<data>/relatorio-gastos.html`) pra bater os números antes de seguir.

## 6a. Criar as credenciais do login do Google

O acesso ao site é protegido por um login "Entrar com o Google" feito no
próprio app (ver `src/auth.ts`) — não usa IAP. Isso porque a integração
nativa de IAP com Cloud Run se mostrou pouco confiável na prática (várias
permissões corretas e ainda assim acesso negado, e a API que gerencia os
"brands" do IAP está sendo descontinuada pelo Google). Login feito no
próprio código é mais previsível e mais fácil de depurar.

No Console: **APIs e Serviços > Credenciais > + CREATE CREDENTIALS > OAuth
client ID**.
1. Tipo de aplicativo: **Web application**.
2. Em "Authorized JavaScript origins", adicione a URL do seu serviço Cloud
   Run (só vai saber a URL definitiva depois do primeiro deploy da seção
   6b — pode voltar aqui e editar depois, ou já colocar um palpite tipo
   `https://SERVICE-PROJECT_NUMBER.REGION.run.app`).
3. Crie e copie o **Client ID** gerado (termina em
   `.apps.googleusercontent.com`) — não é segredo, pode ficar em variável
   de ambiente normal.

```bash
export GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI
```

## 6b. Deploy do serviço web no Cloud Run

Na primeira vez que `--source .` builda algo nesse projeto, a conta de
serviço padrão também costuma faltar permissão pra ler o código enviado, pra
publicar a imagem no Artifact Registry e pra escrever log da build — dá pra
conceder tudo de uma vez, adiantando o problema (ver nota sobre permissões
no topo deste arquivo):

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
for ROLE in storage.objectViewer artifactregistry.writer logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/${ROLE}"
done
```

```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID},ALLOWED_EMAILS=${SEU_EMAIL}" \
  --set-secrets="PLUGGY_CLIENT_ID=pluggy-client-id:latest,PLUGGY_CLIENT_SECRET=pluggy-client-secret:latest,PLUGGY_ITEM_IDS=pluggy-item-ids:latest,SESSION_SECRET=session-secret:latest"
```

`--source .` builda a imagem automaticamente via Cloud Build (usa o
`Dockerfile` do repositório) — não precisa configurar Artifact Registry na
mão. `--allow-unauthenticated` aqui é definitivo (não é um passo temporário):
o Cloud Run fica com ingress público, e quem realmente controla o acesso é o
próprio app, checando o cookie de sessão em toda requisição (rotas `/` e
`/api/*`; `/login` e `/auth/google` ficam sempre abertas, é onde o login
acontece).

`ALLOWED_EMAILS` aceita uma lista separada por vírgula, se mais de uma conta
Google precisar de acesso (ex.: `${SEU_EMAIL},conjuge@gmail.com`) — não
precisa mudar nada no código pra isso, só redeployar com a lista atualizada.

Abra a URL que o comando imprimir — deve aparecer a tela de login própria do
site ("Relatório de gastos / Entrar com o Google"), não mais um link direto
pro dashboard. Entre e confira se os dados migrados aparecem certinho.

## 7. Job diário + Cloud Scheduler

Cria um Cloud Run Job usando a mesma imagem, mas trocando o comando padrão
pelo entrypoint do job:

```bash
IMAGE=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(spec.template.spec.containers[0].image)')

gcloud run jobs create relatorio-gastos-refresh \
  --image "$IMAGE" \
  --region "$REGION" \
  --command node --args dist/refreshJob.js \
  --set-secrets="PLUGGY_CLIENT_ID=pluggy-client-id:latest,PLUGGY_CLIENT_SECRET=pluggy-client-secret:latest,PLUGGY_ITEM_IDS=pluggy-item-ids:latest"

# service account dedicada pro Scheduler disparar o job
gcloud iam service-accounts create relatorio-gastos-scheduler \
  --display-name="Dispara o job diario do relatorio de gastos"

gcloud run jobs add-iam-policy-binding relatorio-gastos-refresh \
  --region "$REGION" \
  --member="serviceAccount:relatorio-gastos-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

gcloud scheduler jobs create http relatorio-gastos-diario \
  --location "$REGION" \
  --schedule="0 7 * * *" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/relatorio-gastos-refresh:run" \
  --http-method=POST \
  --oauth-service-account-email="relatorio-gastos-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
```

Ajuste `0 7 * * *` (7h UTC = 4h em Brasília) pro horário que preferir. Teste
rodando manualmente antes de confiar no agendamento:

```bash
gcloud run jobs execute relatorio-gastos-refresh --region "$REGION"
```

## 8. Backup automático do Firestore

O Firestore tem um recurso nativo de backup agendado — sem precisar montar
export manual pra um bucket nem escrever nenhum código. Cria uma política
que gera um backup completo todo dia, guardado por um período configurável:

```bash
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d \
  --project="$PROJECT_ID"
```

Confirmar que a política foi criada:

```bash
gcloud firestore backups schedules list --database='(default)' --project="$PROJECT_ID"
```

Depois do primeiro ciclo (até 24h), os backups aparecem em:

```bash
gcloud firestore backups list --project="$PROJECT_ID"
```

Se precisar restaurar (cria um banco novo a partir do backup — não sobrescreve
o banco atual):

```bash
gcloud firestore databases restore \
  --source-backup="BACKUP_NAME_AQUI" \
  --destination-database="relatorio-gastos-restaurado" \
  --project="$PROJECT_ID"
```

`BACKUP_NAME_AQUI` vem da coluna `NAME` do comando `backups list` acima.
Isso tem um custo pequeno de armazenamento (fora do free tier padrão, mas
irrelevante pro volume de dados deste projeto — poucos MB).

## 9. Alerta se o job diário falhar

Hoje a única forma de saber que o job diário falhou é olhando os logs manualmente.
O caminho mais confiável pra configurar um alerta é pelo console (os nomes
exatos de métrica podem mudar de versão pra versão, então a interface visual
evita depender de sintaxe que pode ficar desatualizada):

1. Abra [Cloud Monitoring → Alerting](https://console.cloud.google.com/monitoring/alerting) no projeto `$PROJECT_ID`.
2. **Create Policy** → **Select a metric** → resource type **Cloud Run Job**,
   métrica **Job Execution** (ou **Completed Execution Count**) → filtre por
   `job_name = relatorio-gastos-refresh` e `result = failed`.
3. Condição: **is above 0**, janela de checagem **1 day** (cobre uma execução
   diária).
4. Notificação: adicione seu e-mail como canal (crie um se ainda não tiver
   nenhum).
5. Salve com um nome tipo "Job diário de atualização falhou".

Se preferir configurar tudo via terminal, dá pra criar o canal de notificação
e a política por `gcloud`, mas os nomes de campo abaixo valem a pena conferir
no **Metrics Explorer** do console antes de confiar cegamente neles (métricas
do Cloud Run Jobs mudam de rótulo ocasionalmente):

```bash
gcloud beta monitoring channels create \
  --display-name="E-mail - alertas do job diario" \
  --type=email \
  --channel-labels=email_address="$SEU_EMAIL" \
  --project="$PROJECT_ID"
# anote o ID do canal que o comando devolve (algo como
# projects/.../notificationChannels/1234567890)
```

```bash
cat > /tmp/alert-policy-refresh.json <<'EOF'
{
  "displayName": "Job diario de atualizacao falhou",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Execucao do job com falha",
    "conditionThreshold": {
      "filter": "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"relatorio-gastos-refresh\" AND metric.type=\"run.googleapis.com/job/completed_execution_count\" AND metric.labels.result=\"failed\"",
      "comparison": "COMPARISON_GT",
      "thresholdValue": 0,
      "duration": "0s",
      "aggregations": [{
        "alignmentPeriod": "86400s",
        "perSeriesAligner": "ALIGN_COUNT",
        "crossSeriesReducer": "REDUCE_SUM"
      }]
    }
  }],
  "notificationChannels": ["CHANNEL_ID_AQUI"],
  "alertStrategy": { "autoClose": "86400s" }
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/alert-policy-refresh.json \
  --project="$PROJECT_ID"
```

Troque `CHANNEL_ID_AQUI` pelo ID anotado no passo anterior antes de rodar.

## Depois de tudo no ar

- O botão **"Atualizar agora"** no dashboard chama `POST /api/refresh` e
  roda a mesma busca do job diário, na hora.
- Toda edição de Categoria/Subcategoria/Válido feita no dashboard já fica
  permanente no Firestore — não precisa mais exportar CSV nem mandar nada
  numa conversa pra classificação virar definitiva.
- O botão **"Sair"** no rodapé do dashboard encerra a sessão.
- Pra liberar outra conta Google (ex.: cônjuge), redeploya (seção 6b) com
  `ALLOWED_EMAILS` incluindo o e-mail dela — não precisa mudar nada no código
  ou no modelo de dados.
- Se em algum momento precisar trocar a chave de sessão (`SESSION_SECRET`) —
  por exemplo, se ela vazar — gere uma nova e redeploye: todo mundo logado é
  automaticamente deslogado (cookies antigos assinados com a chave anterior
  deixam de validar).
