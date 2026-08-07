import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'despesas-classificacao.json');

interface RulesFile {
  categories: Record<string, string[]>;
  rulesFull: Record<string, [string, string, number]>;
  rulesPrefix: Record<string, [string, string, number]>;
  invalidFull: Record<string, string>;
  revisadoAte: string | null;
}

const rules: RulesFile = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

// Data (YYYY-MM-DD) ate onde o usuario ja revisou classificacoes manualmente.
// Qualquer lancamento com DataConsiderada nesse dia ou depois ainda nao foi
// visto por ele e deve ficar pendente, mesmo com sugestao de alta confianca.
export const REVISADO_ATE: string | null = rules.revisadoAte;

export const CATEGORIAS: string[] = Object.keys(rules.categories).sort((a, b) =>
  a.localeCompare(b, 'pt-BR')
);

export const SUBCATEGORIAS: string[] = [...new Set(Object.values(rules.categories).flat())].sort(
  (a, b) => a.localeCompare(b, 'pt-BR')
);

export type Confianca = 'alta' | 'media' | 'baixa';

export interface Classification {
  categoria: string;
  subcategoria: string;
  confianca: Confianca;
  pendente: boolean;
  motivo: string;
}

// Descricoes de cartao/conta costumam trazer sufixo de parcela ou data no
// final (ex: "AMAZONMKTPLC*WEBCO12/12", "PIX TRANSF LINCOLN02/01") — removemos
// para conseguir casar o mesmo estabelecimento em meses diferentes.
export function normalizeKey(description: string): string {
  return description
    .trim()
    .toUpperCase()
    .replace(/\d{1,2}\/\d{1,2}$/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function prefixKey(normalizedDescription: string): string {
  return normalizedDescription.split('*')[0].trim();
}

// Chave "solta" pra comparar categoria/subcategoria ignorando acento,
// maiusculas e pontuacao (a taxonomia do usuario ja apareceu tanto em
// "saúde e bem-estar" quanto "SAUDE E BEM ESTAR" em revisoes diferentes).
export function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface CategoryIndexEntry {
  categoria: string;
  subcategorias: Map<string, string>; // fold(subcategoria) -> subcategoria canonica
}

const categoryIndex = new Map<string, CategoryIndexEntry>(); // fold(categoria) -> entry
for (const [categoria, subcategorias] of Object.entries(rules.categories)) {
  categoryIndex.set(fold(categoria), {
    categoria,
    subcategorias: new Map(subcategorias.map((s) => [fold(s), s])),
  });
}

// Resolve um par categoria/subcategoria (em qualquer grafia) para a grafia
// canonica atual da taxonomia. Usado pelo mapa de palpites abaixo, pra nao
// quebrar toda vez que o usuario reclassifica a planilha e a grafia muda.
function resolveCanonical(categoria: string, subcategoria: string): [string, string] {
  const entry = categoryIndex.get(fold(categoria));
  if (!entry) return [categoria, subcategoria];
  const canonSub = entry.subcategorias.get(fold(subcategoria));
  return [entry.categoria, canonSub ?? subcategoria];
}

const OUTROS = resolveCanonical('outros', 'outros');

// Categoria generica que o Pluggy atribui (em ingles) -> melhor palpite na
// taxonomia do usuario, para quando nao ha nenhum historico parecido. A
// grafia aqui nao precisa ficar em dia com a taxonomia atual — resolveCanonical
// acha a forma canonica correspondente (ou falha alto embaixo se ela sumiu).
const FALLBACK_BY_PLUGGY_CATEGORY: Record<string, [string, string]> = {
  Groceries: ['alimentação', 'supermercado'],
  'Eating out': ['compras e lazer', 'Restaurante ou Delivery'],
  'Food delivery': ['compras e lazer', 'Restaurante ou Delivery'],
  Shopping: ['compras e lazer', 'coisas para casa'],
  'Online shopping': ['compras e lazer', 'coisas para casa'],
  Houseware: ['compras e lazer', 'coisas para casa'],
  'Office supplies': ['compras e lazer', 'coisas para casa'],
  Electronics: ['compras e lazer', 'eletrônicos'],
  Bookstore: ['compras e lazer', 'livros e materiais'],
  Clothing: ['compras e lazer', 'roupas e acessórios'],
  Bicycle: ['compras e lazer', 'esportes e equipamentos'],
  'Sports practice': ['saúde e bem-estar', 'academia e fitness'],
  'Gyms and fitness centers': ['saúde e bem-estar', 'academia e fitness'],
  Wellness: ['saúde e bem-estar', 'academia e fitness'],
  'Wellness and fitness': ['saúde e bem-estar', 'academia e fitness'],
  'Kids and toys': ['compras e lazer', 'presentes'],
  Gaming: ['compras e lazer', 'jogos e entreterimento'],
  'Cinema, theater and concerts': ['compras e lazer', 'eventos e atividades'],
  Leisure: ['compras e lazer', 'eventos e atividades'],
  Tickets: ['compras e lazer', 'eventos e atividades'],
  Pharmacy: ['saúde e bem-estar', 'farmácia e medicamentos'],
  Healthcare: ['saúde e bem-estar', 'farmácia e medicamentos'],
  'Hospital clinics and labs': ['saúde e bem-estar', 'farmácia e medicamentos'],
  'Taxi and ride-hailing': ['transporte', 'aplicativos de mobilidade'],
  'Gas stations': ['transporte', 'Combustível'],
  Parking: ['transporte', 'estacionamento e pedágio'],
  'Tolls and in vehicle payment': ['transporte', 'estacionamento e pedágio'],
  Automotive: ['transporte', 'manutenção do carro'],
  'Car rental': ['viagem', 'passagens e transporte'],
  'Airport and airlines': ['viagem', 'passagens e transporte'],
  Accomodation: ['viagem', 'hospedagem'],
  Transportation: ['transporte', 'aplicativos de mobilidade'],
  Telecommunications: ['moradia', 'internet e telefone'],
  Internet: ['moradia', 'internet e telefone'],
  Electricity: ['moradia', 'luz'],
  Housing: ['moradia', 'aluguel'],
  'Credit card payment': ['serviços financeiros e bancários', 'cartão de crédito'],
  'Credit card fees': ['serviços financeiros e bancários', 'cartão de crédito'],
  Insurance: ['seguros', 'seguro de vida'],
  'Tax on financial operations': ['serviços financeiros e bancários', 'taxas de contas bancárias'],
  'Proceeds interests and dividends': ['investimentos', 'proventos de investimentos'],
};

// Falha cedo se algum palpite acima referenciar uma categoria que sumiu de
// vez da taxonomia (subcategoria pode ter mudado de grafia sem problema,
// resolveCanonical cobre isso — so a categoria em si precisa mesmo existir).
const RESOLVED_FALLBACK = new Map<string, [string, string]>();
for (const [pluggyCategory, [categoria, subcategoria]] of Object.entries(FALLBACK_BY_PLUGGY_CATEGORY)) {
  if (!categoryIndex.has(fold(categoria))) {
    throw new Error(
      `FALLBACK_BY_PLUGGY_CATEGORY["${pluggyCategory}"] aponta para a categoria "${categoria}", ` +
        'que nao existe mais em data/despesas-classificacao.json. Atualize o mapeamento em src/classify.ts.'
    );
  }
  RESOLVED_FALLBACK.set(pluggyCategory, resolveCanonical(categoria, subcategoria));
}

export function classifyTransaction(
  description: string,
  pluggyCategory: string | null
): Classification {
  const fullKey = normalizeKey(description);
  const fullMatch = rules.rulesFull[fullKey];
  if (fullMatch) {
    return {
      categoria: fullMatch[0],
      subcategoria: fullMatch[1],
      confianca: 'alta',
      pendente: false,
      motivo: `Igual a lançamentos anteriores com essa mesma descrição.`,
    };
  }

  const pKey = prefixKey(fullKey);
  const prefixMatch = rules.rulesPrefix[pKey];
  if (prefixMatch) {
    return {
      categoria: prefixMatch[0],
      subcategoria: prefixMatch[1],
      confianca: 'media',
      pendente: false,
      motivo: `Baseado em lançamentos parecidos ("${pKey}").`,
    };
  }

  const fallback = pluggyCategory ? RESOLVED_FALLBACK.get(pluggyCategory) : undefined;
  if (fallback) {
    return {
      categoria: fallback[0],
      subcategoria: fallback[1],
      confianca: 'baixa',
      pendente: true,
      motivo: `Sem histórico parecido — palpite a partir da categoria do banco ("${pluggyCategory}").`,
    };
  }

  return {
    categoria: OUTROS[0],
    subcategoria: OUTROS[1],
    confianca: 'baixa',
    pendente: true,
    motivo: pluggyCategory
      ? `Sem histórico e sem palpite para a categoria do banco ("${pluggyCategory}").`
      : 'Sem histórico e sem categoria do banco para basear um palpite.',
  };
}

// Descricoes que o usuario ja marcou como invalidas antes (ex.: transferencia
// entre contas proprias, pagamento de fatura) continuam invalidas por padrao
// quando aparecerem de novo — mas o usuario sempre pode reverter na planilha.
// Recebe a chave ja normalizada (normalizeKey) pra nao recalcular a mesma
// coisa que classifyTransaction ja calculou pra essa transacao.
export function checkKnownInvalid(normalizedDescription: string): string | null {
  return rules.invalidFull[normalizedDescription] ?? null;
}
