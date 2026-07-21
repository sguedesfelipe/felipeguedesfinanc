import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'despesas-classificacao.json');

interface RulesFile {
  categories: Record<string, string[]>;
  rulesFull: Record<string, [string, string, number]>;
  rulesPrefix: Record<string, [string, string, number]>;
}

const rules: RulesFile = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

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
function normalizeKey(description: string): string {
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

// Categoria generica que o Pluggy atribui (em ingles) -> melhor palpite na
// taxonomia do usuario, para quando nao ha nenhum historico parecido.
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

// Falha cedo se algum palpite acima referenciar uma categoria/subcategoria
// que nao existe mais na taxonomia gerada a partir da planilha do usuario.
for (const [pluggyCategory, [categoria, subcategoria]] of Object.entries(FALLBACK_BY_PLUGGY_CATEGORY)) {
  const subcategorias = rules.categories[categoria];
  if (!subcategorias || !subcategorias.includes(subcategoria)) {
    throw new Error(
      `FALLBACK_BY_PLUGGY_CATEGORY["${pluggyCategory}"] aponta para "${categoria}" / "${subcategoria}", ` +
        'que nao existe em data/despesas-classificacao.json. Atualize o mapeamento em src/classify.ts.'
    );
  }
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

  const fallback = pluggyCategory ? FALLBACK_BY_PLUGGY_CATEGORY[pluggyCategory] : undefined;
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
    categoria: 'outros',
    subcategoria: 'outros',
    confianca: 'baixa',
    pendente: true,
    motivo: pluggyCategory
      ? `Sem histórico e sem palpite para a categoria do banco ("${pluggyCategory}").`
      : 'Sem histórico e sem categoria do banco para basear um palpite.',
  };
}
