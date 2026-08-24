// Cliente fino do WhatsApp Cloud API (Meta), usado so pelo digest diario
// (ver src/dailyDigest.ts). Sem SDK — a API e simples o suficiente pra um
// POST direto.
const GRAPH_API_VERSION = 'v21.0';

export interface WhatsappConfig {
  accessToken: string;
  phoneNumberId: string;
  recipientNumber: string;
  templateName: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente ${name} nao definida.`);
  }
  return value;
}

export function loadWhatsappConfig(): WhatsappConfig {
  return {
    accessToken: requireEnv('WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: requireEnv('WHATSAPP_PHONE_NUMBER_ID'),
    recipientNumber: requireEnv('WHATSAPP_RECIPIENT_NUMBER'),
    templateName: requireEnv('WHATSAPP_TEMPLATE_NAME'),
  };
}

// Envia o template "atualizacao_diaria_gastos" (categoria Marketing, 2
// variaveis de corpo: lista de transacoes novas e contagem de pendencias —
// ver RUNBOOK.md). Variaveis de template do WhatsApp nao podem conter
// quebra de linha; quem monta o texto (src/dailyDigest.ts) ja garante isso.
export async function sendWhatsappTemplateMessage(
  config: WhatsappConfig,
  bodyParams: string[]
): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: config.recipientNumber,
      type: 'template',
      template: {
        name: config.templateName,
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: bodyParams.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar mensagem no WhatsApp (${response.status}): ${body}`);
  }
}
