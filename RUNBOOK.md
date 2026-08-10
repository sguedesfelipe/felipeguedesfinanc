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
dia). Se o seu projeto exigir o caminho "clássico" de IAP (seção 6), soma
mais alguns dólares/mês pelo IP fixo do load balancer.

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
  iap.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

## 2. Tela de consentimento OAuth (necessária pro IAP)

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

## 4. Guardar as credenciais do Pluggy no Secret Manager

```bash
printf '%s' "SEU_CLIENT_ID" | gcloud secrets create pluggy-client-id --data-file=-
printf '%s' "SEU_CLIENT_SECRET" | gcloud secrets create pluggy-client-secret --data-file=-
printf '%s' "seu-item-id-1,seu-item-id-2" | gcloud secrets create pluggy-item-ids --data-file=-
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

## 6. Deploy do serviço web no Cloud Run

```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets="PLUGGY_CLIENT_ID=pluggy-client-id:latest,PLUGGY_CLIENT_SECRET=pluggy-client-secret:latest,PLUGGY_ITEM_IDS=pluggy-item-ids:latest"
```

`--source .` builda a imagem automaticamente via Cloud Build (usa o
`Dockerfile` do repositório) — não precisa configurar Artifact Registry na
mão. `--allow-unauthenticated` é temporário, só pra confirmar que o serviço
sobe certo; a seção 8 troca isso pelo IAP.

Abra a URL que o comando imprimir e confira se o dashboard carrega com os
dados migrados.

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

## 8. Ativar o IAP (login restrito à sua conta Google)

Primeiro confira se o seu projeto tem a integração nativa de IAP no Cloud
Run:

```bash
gcloud run services describe "$SERVICE" --region "$REGION"
```

No Console, vá em **Cloud Run > (seu serviço) > Segurança** e procure uma
opção de ativar IAP diretamente. Se existir, ative por ali e pule pro passo
"Liberar seu e-mail" abaixo. Se não existir (depende da maturidade/região do
projeto), o caminho é o clássico — um Load Balancer HTTPS na frente do Cloud
Run:

```bash
gcloud compute backend-services create relatorio-gastos-backend --global
gcloud compute network-endpoint-groups create relatorio-gastos-neg \
  --region "$REGION" --network-endpoint-type=serverless --cloud-run-service="$SERVICE"
gcloud compute backend-services add-backend relatorio-gastos-backend \
  --global --network-endpoint-group=relatorio-gastos-neg --network-endpoint-group-region="$REGION"
gcloud compute addresses create relatorio-gastos-ip --global
gcloud compute ssl-certificates create relatorio-gastos-cert --domains=SEU_DOMINIO_OU_IP.nip.io --global
gcloud compute url-maps create relatorio-gastos-lb --default-service=relatorio-gastos-backend
gcloud compute target-https-proxies create relatorio-gastos-proxy \
  --url-map=relatorio-gastos-lb --ssl-certificates=relatorio-gastos-cert
gcloud compute forwarding-rules create relatorio-gastos-fr \
  --global --target-https-proxy=relatorio-gastos-proxy --address=relatorio-gastos-ip --ports=443
gcloud compute backend-services update relatorio-gastos-backend --global --iap=enabled
```

Depois de qualquer um dos dois caminhos, remova o acesso público do Cloud
Run (o IAP passa a ser a única porta de entrada) e libere seu e-mail:

```bash
gcloud run services update "$SERVICE" --region "$REGION" --no-allow-unauthenticated

gcloud iap web add-iam-policy-binding \
  --member="user:${SEU_EMAIL}" \
  --role="roles/iap.httpsResourceAccessor" \
  --resource-type=cloud-run \
  --service="$SERVICE" \
  --region "$REGION"
```

Pronto: só a sua conta Google consegue abrir a URL do serviço a partir daqui.
O Google cuida da tela de login e da sessão — nenhum código de autenticação
roda no app.

## Depois de tudo no ar

- O botão **"Atualizar agora"** no dashboard chama `POST /api/refresh` e
  roda a mesma busca do job diário, na hora.
- Toda edição de Categoria/Subcategoria/Válido feita no dashboard já fica
  permanente no Firestore — não precisa mais exportar CSV nem mandar nada
  numa conversa pra classificação virar definitiva.
- Pra liberar outra conta Google (ex.: cônjuge), repita o
  `gcloud iap web add-iam-policy-binding` do passo 8 com o e-mail dela — não
  precisa mudar nada no código ou no modelo de dados.
