// Script de diagnostico (so leitura, nao grava nada): mostra as N transacoes
// mais recentes por dataConsiderada e por createdAt (data que o Pluggy
// registrou a transacao), pra checar se os dados realmente pararam de
// atualizar ou se e so um problema de filtro/visualizacao no dashboard.
//
// Uso: tsx src/diagLatestTransactions.ts [N=10]
import { getDb } from './firestore.js';
import { loadAllTransactions } from './repo.js';
import { CategorizedTransaction } from './aggregate.js';

function printRow(t: CategorizedTransaction) {
  console.log(
    [
      `dataConsiderada: ${t.dataConsiderada.toISOString().slice(0, 10)}`,
      `descricao: ${t.description}`,
      `valor: ${t.amount}`,
      `valido: ${t.valido}  pendente: ${t.pendente}`,
      `createdAt: ${t.createdAt.toISOString()}`,
    ].join(' | ')
  );
}

async function main() {
  const n = Number(process.argv[2]) || 10;
  const db = getDb();
  const transactions = await loadAllTransactions(db);

  console.log(`Total de transacoes no Firestore: ${transactions.length}\n`);

  console.log(`--- ${n} mais recentes por DataConsiderada ---`);
  [...transactions]
    .sort((a, b) => b.dataConsiderada.getTime() - a.dataConsiderada.getTime())
    .slice(0, n)
    .forEach(printRow);

  console.log(`\n--- ${n} mais recentes por createdAt (quando o Pluggy registrou) ---`);
  [...transactions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, n)
    .forEach(printRow);
}

main().catch((error) => {
  console.error('Erro no diagnostico:', error.message ?? error);
  process.exitCode = 1;
});
