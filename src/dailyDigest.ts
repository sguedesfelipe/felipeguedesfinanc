import type { Firestore } from 'firebase-admin/firestore';
import { deriveReport, CategorizedTransaction } from './aggregate.js';
import { loadAllTransactions, loadAllAccounts, markTransactionsNotified } from './repo.js';
import { loadWhatsappConfig, sendWhatsappTemplateMessage } from './whatsapp.js';

// Quantas transacoes novas entram por extenso na mensagem antes de resumir o
// resto em "e mais N" — o valor de uma variavel de template do WhatsApp tem
// um limite de tamanho, e uma lista maior que isso vira ilegivel de qualquer
// jeito numa mensagem de celular.
const MAX_TRANSACTIONS_IN_MESSAGE = 15;

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatTransactionLine(t: CategorizedTransaction): string {
  return `${t.description}: ${currencyFormatter.format(t.amount)}`;
}

// Variaveis de template do WhatsApp nao podem conter quebra de linha, entao
// a lista fica numa unica linha, separada por "||" (mesmo separador usado no
// exemplo aprovado pela Meta pro template atualizacao_diaria_gastos).
export function formatNewTransactionsSummary(transactions: CategorizedTransaction[]): string {
  if (transactions.length === 0) return 'Nenhuma';
  const shown = transactions.slice(0, MAX_TRANSACTIONS_IN_MESSAGE);
  const lines = shown.map(formatTransactionLine);
  const remaining = transactions.length - shown.length;
  if (remaining > 0) lines.push(`e mais ${remaining}`);
  return lines.join(' || ');
}

// Carrega o estado atual do Firestore, monta e envia o digest com as
// transacoes que chegaram desde o ultimo envio (notificadoWhatsapp:false) e
// o total de pendencias, e so marca essas transacoes como notificadas depois
// que o envio confirma sucesso — se o envio falhar, nada e marcado e essas
// mesmas transacoes entram no proximo digest de novo (idempotente).
export async function sendDailyDigest(db: Firestore): Promise<void> {
  const [transactions, accounts] = await Promise.all([loadAllTransactions(db), loadAllAccounts(db)]);
  const report = deriveReport(transactions, accounts);

  const newTransactions = report.transactions.filter((t) => t.valido && !t.notificadoWhatsapp);
  if (newTransactions.length === 0) {
    console.log('Digest diario: nenhuma transacao nova para avisar, nada enviado.');
    return;
  }

  const config = loadWhatsappConfig();
  await sendWhatsappTemplateMessage(config, [
    formatNewTransactionsSummary(newTransactions),
    String(report.totals.pendentesClassificacao),
  ]);

  await markTransactionsNotified(
    db,
    newTransactions.map((t) => t.transactionId)
  );

  console.log(`Digest diario enviado: ${newTransactions.length} transacao(oes) nova(s) avisada(s).`);
}
