// Script de diagnostico (nao e migracao, nao grava nada): lista todas as
// transacoes no Firestore cuja descricao contem o texto passado, pra
// investigar casos como "essa transacao sempre volta pra pendente/invalida"
// — se o Pluggy esta gerando um transactionId novo pra cada reenvio da mesma
// transacao real, vai aparecer mais de uma linha abaixo com a mesma
// descricao/valor mas IDs diferentes (o que explicaria o comportamento sem
// precisar de nenhum bug no nosso codigo de persistencia).
//
// Uso: tsx src/diagFindByDescription.ts "texto da descricao"
import { getDb } from './firestore.js';
import { loadAllTransactions } from './repo.js';

async function main() {
  const needle = process.argv[2];
  if (!needle) {
    console.error('Uso: tsx src/diagFindByDescription.ts "texto da descricao"');
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  const transactions = await loadAllTransactions(db);
  const matches = transactions
    .filter((t) => t.description.toLowerCase().includes(needle.toLowerCase()))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (matches.length === 0) {
    console.log(`Nenhuma transacao com "${needle}" na descricao.`);
    return;
  }

  console.log(`${matches.length} transacao(oes) encontrada(s):\n`);
  for (const t of matches) {
    console.log(
      [
        `transactionId: ${t.transactionId}`,
        `descricao: ${t.description}`,
        `valor: ${t.amount}`,
        `dataConsiderada: ${t.dataConsiderada.toISOString().slice(0, 10)}`,
        `valido: ${t.valido}  pendente: ${t.pendente}`,
        `createdAt: ${t.createdAt.toISOString()}  updatedAt: ${t.updatedAt.toISOString()}`,
      ].join(' | ')
    );
  }

  const uniqueIds = new Set(matches.map((t) => t.transactionId));
  if (uniqueIds.size > 1) {
    console.log(
      `\n⚠ ${uniqueIds.size} transactionId(s) diferentes pra descricoes parecidas — o Pluggy provavelmente esta` +
        ' gerando um ID novo a cada reenvio da mesma transacao real (bug fora do nosso controle).'
    );
  } else {
    console.log('\nUm unico transactionId — se o valido/pendente continua revertendo, o problema nao e duplicacao de ID.');
  }
}

main().catch((error) => {
  console.error('Erro no diagnostico:', error.message ?? error);
  process.exitCode = 1;
});
