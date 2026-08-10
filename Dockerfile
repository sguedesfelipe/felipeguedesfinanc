# Imagem unica usada tanto pro servico web (Cloud Run Service, CMD padrao
# abaixo) quanto pro job de atualizacao diaria (Cloud Run Job, que sobrescreve
# o comando pra "node dist/refreshJob.js" na hora de criar o job — ver
# RUNBOOK.md). Nao inclui data/despesas-classificacao.json: em producao a
# taxonomia/historico vem do Firestore (doc classification/rules), nao do
# arquivo local.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/server.js"]
