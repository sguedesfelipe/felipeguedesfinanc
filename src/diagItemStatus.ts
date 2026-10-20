// Script de diagnostico (so leitura, nao grava nada): consulta direto na API
// do Pluggy o status de cada "item" (conexao com o banco) configurado em
// PLUGGY_ITEM_IDS. Se o status nao for UPDATED, o Pluggy pode estar so
// devolvendo dados antigos em cache em vez de sincronizar de verdade com o
// banco — o que explicaria transacoes recentes nao aparecerem mesmo com o
// job diario rodando sem erro.
//
// Uso: tsx src/diagItemStatus.ts
import { loadConfig } from './config.js';
import { createPluggyClient } from './pluggyClient.js';

async function main() {
  const config = loadConfig();
  const client = createPluggyClient(config);

  for (const itemId of config.itemIds) {
    const item = await client.fetchItem(itemId);
    console.log(`--- Item ${itemId} (${item.connector?.name ?? 'conector desconhecido'}) ---`);
    console.log(`status: ${item.status}`);
    console.log(`lastUpdatedAt: ${item.lastUpdatedAt ?? 'nunca'}`);
    if (item.error) {
      console.log(`error: ${JSON.stringify(item.error)}`);
    }
    if (item.statusDetail?.transactions) {
      console.log(`transactions.isUpdated: ${item.statusDetail.transactions.isUpdated}`);
      console.log(`transactions.lastUpdatedAt: ${item.statusDetail.transactions.lastUpdatedAt}`);
      if (item.statusDetail.transactions.warnings?.length) {
        console.log(`transactions.warnings: ${JSON.stringify(item.statusDetail.transactions.warnings)}`);
      }
    }
    console.log(
      item.status === 'UPDATED'
        ? '✅ Conexao OK, sincronizando normalmente.'
        : `⚠ Conexao precisa de atencao (status "${item.status}") — provavelmente precisa reconectar o banco no Pluggy.`
    );
    console.log('');
  }
}

main().catch((error) => {
  console.error('Erro no diagnostico:', error.message ?? error);
  process.exitCode = 1;
});
