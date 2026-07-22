import 'dotenv/config';

export interface Config {
  clientId: string;
  clientSecret: string;
  itemIds: string[];
  months: number;
  dateFrom: string | null;
  outDir: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variavel de ambiente ${name} nao definida. Copie .env.example para .env e preencha os valores.`
    );
  }
  return value;
}

function parseArgs(argv: string[]): { months?: number; from?: string; outDir?: string } {
  const result: { months?: number; from?: string; outDir?: string } = {};
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'months' && value) result.months = Number(value);
    if (key === 'from' && value) result.from = value;
    if (key === 'out' && value) result.outDir = value;
  }
  return result;
}

export function loadConfig(): Config {
  const clientId = requireEnv('PLUGGY_CLIENT_ID');
  const clientSecret = requireEnv('PLUGGY_CLIENT_SECRET');
  const itemIds = requireEnv('PLUGGY_ITEM_IDS')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (itemIds.length === 0) {
    throw new Error('PLUGGY_ITEM_IDS esta vazio. Informe ao menos um item id.');
  }

  const args = parseArgs(process.argv.slice(2));

  return {
    clientId,
    clientSecret,
    itemIds,
    months: args.months ?? 6,
    dateFrom: args.from ?? null,
    outDir: args.outDir ?? 'reports',
  };
}
