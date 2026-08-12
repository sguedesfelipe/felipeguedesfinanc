import { Report } from './aggregate.js';
import { CATEGORIAS, SUBCATEGORIAS, Confianca } from './classify.js';
import { DESIGN_TOKENS_CSS } from './reportTokens.js';
import { SHELL_CSS, SHELL_SCRIPT, shellSidebarHtml, shellMobileTopbarHtml, shellBottomNavHtml } from './reportShell.js';
import { FILTER_BAR_CSS, FILTER_BAR_SCRIPT, filterBarHtml } from './reportFilterBar.js';
import { RESUMO_CSS, RESUMO_SCRIPT, resumoTabHtml } from './reportResumo.js';
import { PERIODO_TABLE_CSS, PERIODO_TABLE_SCRIPT } from './reportPeriodoTableCss.js';
import { TRANSACOES_CSS, TRANSACOES_SCRIPT } from './reportTransacoes.js';
import { PENDENCIAS_CSS, PENDENCIAS_SCRIPT } from './reportPendencias.js';

interface ClientTransaction {
  id: number;
  transactionId: string;
  dateISO: string;
  dateLabel: string;
  dataConsideradaISO: string;
  dataConsideradaLabel: string;
  installmentNumber: number | null;
  installmentGroupKey: string;
  accountId: string;
  account: string;
  description: string;
  descriptionRaw: string;
  categoria: string;
  subcategoria: string;
  bankCategory: string;
  currencyCode: string;
  amountInAccountCurrency: number | null;
  providerCode: string;
  providerId: string;
  merchantName: string;
  merchantCnpj: string;
  merchantCnae: string;
  payer: string;
  receiver: string;
  paymentMethod: string;
  paymentReason: string;
  transferType: string;
  receiverReferenceId: string;
  boletoDigitableLine: string;
  boletoBarcode: string;
  boletoBaseAmount: number | null;
  boletoPenaltyAmount: number | null;
  boletoInterestAmount: number | null;
  boletoDiscountAmount: number | null;
  operationType: string;
  installment: string;
  installmentTotalAmount: number | null;
  cardLastDigits: string;
  payeeMCC: string;
  purchaseDateLabel: string;
  billId: string;
  billForecastMonth: string;
  cardFeeType: string;
  cardOtherCreditType: string;
  statusBanco: string;
  balanceAfter: number | null;
  createdAtLabel: string;
  updatedAtLabel: string;
  pendente: boolean;
  motivo: string;
  confianca: Confianca;
  valido: boolean;
  motivoInvalido: string;
  isEmprestimo: boolean;
  isExpense: boolean;
  amount: number;
}

export function toClientTransactions(report: Report): ClientTransaction[] {
  return report.transactions.map((t, id) => ({
    id,
    transactionId: t.transactionId,
    dateISO: t.date.toISOString().slice(0, 10),
    dateLabel: t.date.toLocaleDateString('pt-BR'),
    dataConsideradaISO: t.dataConsiderada.toISOString().slice(0, 10),
    dataConsideradaLabel: t.dataConsiderada.toLocaleDateString('pt-BR'),
    installmentNumber: t.installmentNumber,
    installmentGroupKey: t.installmentGroupKey,
    accountId: t.accountId,
    account: t.accountName,
    description: t.description,
    descriptionRaw: t.descriptionRaw,
    categoria: t.categoria,
    subcategoria: t.subcategoria,
    bankCategory: t.bankCategory,
    currencyCode: t.currencyCode,
    amountInAccountCurrency: t.amountInAccountCurrency,
    providerCode: t.providerCode,
    providerId: t.providerId,
    merchantName: t.merchantName,
    merchantCnpj: t.merchantCnpj,
    merchantCnae: t.merchantCnae,
    payer: t.payer,
    receiver: t.receiver,
    paymentMethod: t.paymentMethod,
    paymentReason: t.paymentReason,
    transferType: t.transferType,
    receiverReferenceId: t.receiverReferenceId,
    boletoDigitableLine: t.boletoDigitableLine,
    boletoBarcode: t.boletoBarcode,
    boletoBaseAmount: t.boletoBaseAmount,
    boletoPenaltyAmount: t.boletoPenaltyAmount,
    boletoInterestAmount: t.boletoInterestAmount,
    boletoDiscountAmount: t.boletoDiscountAmount,
    operationType: t.operationType,
    installment: t.installment,
    installmentTotalAmount: t.installmentTotalAmount,
    cardLastDigits: t.cardLastDigits,
    payeeMCC: t.payeeMCC,
    purchaseDateLabel: t.purchaseDate ? t.purchaseDate.toLocaleDateString('pt-BR') : '',
    billId: t.billId,
    billForecastMonth: t.billForecastMonth,
    cardFeeType: t.cardFeeType,
    cardOtherCreditType: t.cardOtherCreditType,
    statusBanco: t.statusBanco,
    balanceAfter: t.balanceAfter,
    createdAtLabel: t.createdAt.toLocaleString('pt-BR'),
    updatedAtLabel: t.updatedAt.toLocaleString('pt-BR'),
    pendente: t.pendente,
    motivo: t.motivoClassificacao,
    confianca: t.confianca,
    valido: t.valido,
    motivoInvalido: t.motivoInvalido,
    isEmprestimo: t.isEmprestimo,
    isExpense: t.isExpense,
    amount: t.amount,
  }));
}

// Todo o relatorio (KPIs, graficos e as 4 abas) e calculado e renderizado no
// navegador a partir deste payload — e o que permite o filtro de periodo e a
// edicao de categoria/subcategoria se refletirem em tudo, sem precisar de
// servidor.
function buildClientPayload(report: Report): string {
  const payload = {
    transactions: toClientTransactions(report),
    accounts: report.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })),
    categorias: CATEGORIAS,
    subcategorias: SUBCATEGORIAS,
  };
  // Escapa "<" para nao correr risco de uma descricao de transacao fechar a
  // tag <script> (ex.: "</script>") no meio do JSON embutido.
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

function clientScript(): string {
  return `
  const DATA = REPORT_DATA;
  const state = DATA.transactions;
  const brl = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  // Rotulo compacto pra caber sempre visivel em cima de cada barra sem
  // colidir com a barra vizinha (brl() por extenso e largo demais pra isso).
  const brlCompact = (v) => {
    const n = v ?? 0;
    if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'mil';
    return Math.round(n).toLocaleString('pt-BR');
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const monthLabel = (m) => { const [y, mm] = m.split('-'); return MONTH_NAMES[Number(mm) - 1] + '/' + y.slice(2); };

  // --- edicoes de categoria/subcategoria/valido/pendente sao salvas direto no
  // servidor (Firestore), nao mais no navegador: qualquer edicao ja fica
  // permanente e disponivel em qualquer dispositivo/sessao no proximo
  // carregamento da pagina, sem precisar exportar CSV e mandar de volta.
  // Se a pagina estiver aberta sem servidor por tras (ex.: um relatorio
  // estatico gerado localmente pelo CLI), o fetch so falha silenciosamente —
  // a edicao ainda aparece na tela durante essa sessao, so nao persiste.
  // Debounced por transacao: o campo de categoria dispara saveEdit a cada
  // tecla digitada (pra tabela reagir na hora), mas so manda pro servidor
  // 400ms depois da ultima tecla — senao cada letra vira uma escrita no
  // Firestore.
  const pendingSaves = new Map();
  function saveEdit(t) {
    const id = t.transactionId;
    clearTimeout(pendingSaves.get(id));
    pendingSaves.set(
      id,
      setTimeout(() => {
        pendingSaves.delete(id);
        fetch('/api/transactions/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: t.description,
            categoria: t.categoria,
            subcategoria: t.subcategoria,
            valido: t.valido,
            pendente: t.pendente,
          }),
        }).catch((e) => {
          console.error('Nao foi possivel salvar a edicao no servidor:', e);
        });
      }, 400)
    );
  }

  // --- compras parceladas devem ter sempre a mesma classificacao: so a
  // primeira parcela (menor installmentNumber) fica editavel, as demais
  // seguem o valor dela (mesmo que edicoes salvas antigas tenham divergido). ---
  const installmentGroups = new Map();
  for (const t of state) {
    if (!t.installmentGroupKey) continue;
    const group = installmentGroups.get(t.installmentGroupKey) || [];
    group.push(t);
    installmentGroups.set(t.installmentGroupKey, group);
  }
  for (const group of installmentGroups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => (a.installmentNumber ?? 1) - (b.installmentNumber ?? 1));
    const leader = group[0];
    for (const t of group) {
      t.installmentLocked = t !== leader;
      if (t !== leader) {
        t.categoria = leader.categoria;
        t.subcategoria = leader.subcategoria;
      }
    }
  }

  // --- flag de Emprestimo: sempre derivado da categoria atual (fold()
  // ignora acento/maiuscula, igual ao mesmo calculo do lado do servidor em
  // aggregate.ts). Roda de novo aqui pra ficar certo mesmo apos sincronizar
  // parcelas com a lider. ---
  function foldClient(s) {
    let result = '';
    for (const ch of String(s || '').normalize('NFKD')) {
      const code = ch.codePointAt(0);
      if (code >= 0x0300 && code <= 0x036f) continue; // marca de acento combinante — descarta
      result += ch;
    }
    return result.toUpperCase().trim();
  }
  function recomputeEmprestimoFlag(t) {
    t.isEmprestimo = foldClient(t.categoria) === 'EMPRESTIMOS';
  }
  state.forEach(recomputeEmprestimoFlag);

  function propagateInstallmentGroup(t) {
    if (!t.installmentGroupKey || t.installmentLocked) return;
    const group = installmentGroups.get(t.installmentGroupKey);
    if (!group || group.length < 2) return;
    let anyBecameEmprestimo = false;
    for (const sibling of group) {
      if (sibling === t) continue;
      sibling.categoria = t.categoria;
      sibling.subcategoria = t.subcategoria;
      const wasEmprestimo = sibling.isEmprestimo;
      recomputeEmprestimoFlag(sibling);
      if (sibling.isEmprestimo && !wasEmprestimo && sibling.valido) {
        sibling.valido = false;
        document.querySelectorAll('.valido-input[data-id="' + sibling.id + '"]').forEach((cb) => { cb.checked = false; });
        anyBecameEmprestimo = true;
      }
      saveEdit(sibling);
      ['categoria', 'subcategoria'].forEach((field) => {
        document.querySelectorAll('tr[data-row-id="' + sibling.id + '"] td[data-col="' + field + '"]').forEach((cell) => {
          cell.innerHTML = classificationInput(sibling, field);
        });
      });
    }
    if (anyBecameEmprestimo) refreshAfterValidoChange();
  }

  // --- filtro de periodo + dimensoes, valido para as 5 tabelas e os graficos ---
  // Usa DataConsiderada (a data real da compra, ja projetada por parcela),
  // nunca a "Data" crua — pra cartao de credito "Data" e a data da fatura,
  // que atrasaria/adiantaria a contabilizacao de quando o gasto de fato
  // aconteceu.
  const allDates = state.map((t) => t.dataConsideradaISO).sort();
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];
  const fromInput = document.getElementById('filter-from');
  const toInput = document.getElementById('filter-to');
  fromInput.min = toInput.min = minDate;
  fromInput.max = toInput.max = maxDate;
  fromInput.value = minDate;
  toInput.value = maxDate;

  const categoriaFilter = document.getElementById('filter-categoria');
  const subcategoriaFilter = document.getElementById('filter-subcategoria');
  const validoFilter = document.getElementById('filter-valido');
  const contaFilter = document.getElementById('filter-conta');
  const statusFilter = document.getElementById('filter-status');
  const tipoFilter = document.getElementById('filter-tipo');

  function distinctValues(getter) {
    return [...new Set(state.map(getter).filter((v) => v))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  function fillSelect(select, values) {
    for (const v of values) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
  }
  fillSelect(categoriaFilter, distinctValues((t) => t.categoria));
  fillSelect(subcategoriaFilter, distinctValues((t) => t.subcategoria));
  fillSelect(contaFilter, distinctValues((t) => t.account));
  fillSelect(statusFilter, distinctValues((t) => t.statusBanco));

  // Filtros de dimensao "simples" (um <select>, sem opcoes dependentes de
  // outro filtro) — Subcategoria fica de fora porque suas opcoes dependem da
  // Categoria escolhida.
  const SIMPLE_DIMENSION_FILTERS = [validoFilter, contaFilter, statusFilter, tipoFilter];

  function resetSubcategoriaOptions(cat) {
    subcategoriaFilter.innerHTML = '<option value="">Todas</option>';
    const subs = cat
      ? distinctValues((t) => (t.categoria === cat ? t.subcategoria : ''))
      : distinctValues((t) => t.subcategoria);
    fillSelect(subcategoriaFilter, subs);
    return subs;
  }

  categoriaFilter.addEventListener('change', () => {
    const currentSub = subcategoriaFilter.value;
    const subs = resetSubcategoriaOptions(categoriaFilter.value);
    subcategoriaFilter.value = subs.includes(currentSub) ? currentSub : '';
    renderAll();
  });
  [subcategoriaFilter, ...SIMPLE_DIMENSION_FILTERS].forEach((el) => el.addEventListener('change', renderAll));

  // skipValido ignora o filtro "Valido" do topo — usado so pela aba
  // Emprestimos, cujas transacoes sao sempre invalidas por definicao (ver
  // applyEmprestimoFlag em aggregate.ts); sem isso ela nunca mostraria nada.
  function getBaseFiltered(skipValido) {
    const from = fromInput.value || minDate;
    const to = toInput.value || maxDate;
    const cat = categoriaFilter.value;
    const sub = subcategoriaFilter.value;
    const validoSel = validoFilter.value;
    const conta = contaFilter.value;
    const status = statusFilter.value;
    const tipo = tipoFilter.value;
    return state.filter((t) => {
      if (t.dataConsideradaISO < from || t.dataConsideradaISO > to) return false;
      if (cat && t.categoria !== cat) return false;
      if (sub && t.subcategoria !== sub) return false;
      if (!skipValido) {
        if (validoSel === 'sim' && !t.valido) return false;
        if (validoSel === 'nao' && t.valido) return false;
      }
      if (conta && t.account !== conta) return false;
      if (status && t.statusBanco !== status) return false;
      if (tipo === 'gasto' && !t.isExpense) return false;
      if (tipo === 'receita' && t.isExpense) return false;
      return true;
    });
  }

  // --- selecao de barras no grafico "Gastos ao longo do tempo": clicar
  // seleciona um periodo, Ctrl+clique adiciona/remove outros — sem tirar as
  // demais barras do grafico (isso e so um filtro extra, por cima do resto),
  // e sem trocar de aba sozinho. Vale pra todas as abas/tabelas ate ser
  // limpa, exatamente como os outros filtros do topo. ---
  let barSelection = null; // { granularity, keys: Set<string> } | null
  function applyBarSelection(rows) {
    if (!barSelection) return rows;
    return rows.filter((t) => barSelection.keys.has(bucketKey(t, barSelection.granularity)));
  }
  function getFiltered() {
    return applyBarSelection(getBaseFiltered());
  }
  // Fonte de dados da aba Emprestimos: os mesmos filtros do topo (periodo,
  // conta, status, tipo, selecao de barras), mas ignorando "Valido" e
  // restrito ao flag isEmprestimo — essas transacoes contam so aqui.
  function getEmprestimoFiltered() {
    return applyBarSelection(getBaseFiltered(true)).filter((t) => t.isEmprestimo);
  }
  // Fonte de dados da aba Invalidos: mesma ideia, mas pra qualquer transacao
  // invalida (fatura de cartao duplicada, invalidada manualmente na
  // planilha, emprestimo, etc.) — nao so a categoria "Emprestimos". Da pra
  // gerir tudo que hoje fica de fora dos totais gerais num lugar so.
  function getInvalidoFiltered() {
    return applyBarSelection(getBaseFiltered(true)).filter((t) => !t.valido);
  }
  function toggleBarSelection(key, granularity, multi) {
    if (!barSelection || barSelection.granularity !== granularity) {
      barSelection = { granularity, keys: new Set([key]) };
    } else if (multi) {
      if (barSelection.keys.has(key)) barSelection.keys.delete(key);
      else barSelection.keys.add(key);
      if (barSelection.keys.size === 0) barSelection = null;
    } else if (barSelection.keys.size === 1 && barSelection.keys.has(key)) {
      barSelection = null; // clique de novo na unica selecionada desmarca
    } else {
      barSelection = { granularity, keys: new Set([key]) };
    }
    renderAll();
  }

  function findTransaction(id) {
    return state.find((t) => t.id === Number(id));
  }

  function activateTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tabName));
  }
  // Usado pelas tabelas de categoria/subcategoria-por-periodo: so ajusta os
  // filtros (categoria OU subcategoria, e/ou periodo), sem trocar de aba —
  // o usuario confere quando quiser.
  function drillToFilters({ categoria, subcategoria, from, to }) {
    if (categoria !== undefined) {
      categoriaFilter.value = categoria;
      resetSubcategoriaOptions(categoria);
      subcategoriaFilter.value = '';
    }
    if (subcategoria !== undefined) {
      categoriaFilter.value = '';
      resetSubcategoriaOptions('');
      subcategoriaFilter.value = subcategoria;
    }
    if (from !== undefined) fromInput.value = from < minDate ? minDate : from;
    if (to !== undefined) toInput.value = to > maxDate ? maxDate : to;
    renderAll();
  }

  function datalistOptions(id, values) {
    return '<datalist id="' + id + '">' + values.map((v) => '<option value="' + esc(v) + '"></option>').join('') + '</datalist>';
  }
  document.getElementById('datalists').innerHTML =
    datalistOptions('categorias-list', DATA.categorias) + datalistOptions('subcategorias-list', DATA.subcategorias);

  function classificationInput(t, field) {
    if (t.installmentLocked) {
      return '<span class="cls-locked" title="Segue a classificacao da 1a parcela desta compra">' + esc(t[field]) + '</span>';
    }
    const list = field === 'categoria' ? 'categorias-list' : 'subcategorias-list';
    return '<input class="cls-input" list="' + list + '" data-id="' + t.id + '" data-field="' + field + '" value="' + esc(t[field]) + '">';
  }

  function validoCheckbox(t) {
    return '<input type="checkbox" class="valido-input" data-id="' + t.id + '"' + (t.valido ? ' checked' : '') + '>';
  }

  // --- selecao em lote na aba Pendencias ("Marcar selecionados como revisados") ---
  const selectedPendentes = new Set();
  function updatePendSelectedCount() {
    document.getElementById('pend-selected-count').textContent = selectedPendentes.size;
  }

  // Usado tanto pelo botao individual quanto pelo botao em lote — ids pode
  // ter 1 ou N elementos, o resto do fluxo (salvar, tirar da selecao,
  // re-renderizar) e sempre o mesmo.
  function markReviewed(ids) {
    let changed = false;
    for (const id of ids) {
      const t = findTransaction(id);
      if (!t) continue;
      t.pendente = false;
      saveEdit(t);
      selectedPendentes.delete(t.id);
      changed = true;
    }
    if (!changed) return;
    renderTable('pendencias-table');
    renderTable('transacoes-table');
    renderResumo(getBaseFiltered());
    updatePendSelectedCount();
  }

  // --- agregacoes (so consideram transacoes com valido=true) ---
  function computeTotals(filtered) {
    const validas = filtered.filter((t) => t.valido);
    let expenses = 0, income = 0;
    for (const t of validas) { if (t.isExpense) expenses += t.amount; else income += t.amount; }
    return {
      expenses, income, net: income - expenses,
      count: validas.length,
      pendentes: validas.filter((t) => t.pendente).length,
    };
  }

  // --- serie temporal do grafico "Gastos ao longo do tempo": agrupa por dia,
  // mes, trimestre, semestre ou ano, conforme o seletor de granularidade.
  // Sempre usa DataConsiderada (nunca "Data") pra agrupar. ---
  function bucketKey(t, granularity) {
    const [y, m] = t.dataConsideradaISO.split('-');
    switch (granularity) {
      case 'dia': return t.dataConsideradaISO;
      case 'trimestre': return y + '-T' + Math.ceil(Number(m) / 3);
      case 'semestre': return y + '-S' + Math.ceil(Number(m) / 6);
      case 'ano': return y;
      default: return y + '-' + m;
    }
  }
  function bucketLabel(key, granularity) {
    if (granularity === 'dia') {
      const [y, m, d] = key.split('-');
      return d + '/' + m + '/' + y.slice(2);
    }
    if (granularity === 'trimestre' || granularity === 'semestre') {
      const [y, suffix] = key.split('-');
      return suffix + '/' + y.slice(2);
    }
    if (granularity === 'ano') return key;
    return monthLabel(key);
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function lastDayOfMonth(y, m) { return new Date(Number(y), Number(m), 0).getDate(); }

  // Inverso de bucketKey: devolve o intervalo de datas (De/Ate) que um
  // "balde" do grafico cobre, pra poder aplicar o filtro de periodo quando o
  // usuario clica numa barra.
  function bucketDateRange(key, granularity) {
    if (granularity === 'dia') return { from: key, to: key };
    if (granularity === 'ano') return { from: key + '-01-01', to: key + '-12-31' };
    if (granularity === 'trimestre' || granularity === 'semestre') {
      const [y, suffix] = key.split('-');
      const n = Number(suffix.slice(1));
      const span = granularity === 'trimestre' ? 3 : 6;
      const startMonth = (n - 1) * span + 1;
      const endMonth = startMonth + span - 1;
      return {
        from: y + '-' + pad2(startMonth) + '-01',
        to: y + '-' + pad2(endMonth) + '-' + pad2(lastDayOfMonth(y, endMonth)),
      };
    }
    const [y, m] = key.split('-'); // mes: key = 'YYYY-MM'
    return { from: key + '-01', to: key + '-' + pad2(lastDayOfMonth(y, m)) };
  }
  function computeTimeSeries(filtered, granularity) {
    const map = new Map();
    for (const t of filtered) {
      if (!t.valido) continue;
      const key = bucketKey(t, granularity);
      const bucket = map.get(key) || { key, expenses: 0, income: 0 };
      if (t.isExpense) bucket.expenses += t.amount; else bucket.income += t.amount;
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  function computeByDimension(filtered, dimensionField, isExpense, requireValido) {
    const map = new Map();
    for (const t of filtered) {
      if ((requireValido && !t.valido) || t.isExpense !== isExpense) continue;
      const key = t[dimensionField] || '(sem categoria)';
      const entry = map.get(key) || { category: key, total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  function computeMerchants(filtered) {
    const map = new Map();
    for (const t of filtered) {
      if (!t.valido || !t.isExpense) continue;
      const entry = map.get(t.description) || { description: t.description, total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(t.description, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 15);
  }

  function computeAccounts(filtered) {
    const byAccount = new Map();
    for (const t of filtered) {
      if (!t.valido || !t.isExpense) continue;
      byAccount.set(t.accountId, (byAccount.get(t.accountId) || 0) + t.amount);
    }
    return DATA.accounts.map((a) => ({ ...a, totalExpenses: byAccount.get(a.id) || 0 }));
  }

  // --- aba Resumo: KPIs + grafico mensal (as 5 tabelas ficam em renderTable) ---
  // Recebe o filtro "base" (sem a selecao de barras) pra o grafico sempre
  // mostrar todos os periodos; os KPIs e a tabela de categoria-por-periodo
  // aplicam a selecao por cima, igual as outras abas/tabelas.
  function renderResumo(base) {
    const filtered = applyBarSelection(base);
    const totals = computeTotals(filtered);
    document.getElementById('kpi-expenses').textContent = brl(totals.expenses);
    document.getElementById('kpi-income').textContent = brl(totals.income);
    const netEl = document.getElementById('kpi-net');
    netEl.textContent = brl(totals.net);
    netEl.classList.toggle('net-positive', totals.net >= 0);
    document.getElementById('kpi-count').textContent = totals.count;
    const pendEl = document.getElementById('kpi-pendentes');
    pendEl.textContent = totals.pendentes;
    pendEl.classList.toggle('net-negative', totals.pendentes > 0);
    document.getElementById('pend-tab-count').textContent = totals.pendentes;

    renderTimeSeriesChart(base);
    renderCategoriaPeriodoTable(filtered);
    renderSubcategoriaPeriodoTable(filtered);
  }

  const granularitySelect = document.getElementById('chart-granularity');
  function updateBarSelectionInfo() {
    const el = document.getElementById('bar-selection-info');
    if (!barSelection || barSelection.granularity !== granularitySelect.value || barSelection.keys.size === 0) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = barSelection.keys.size + ' periodo(s) selecionado(s) · <button type="button" id="clear-bar-selection" class="link-btn">limpar selecao</button>';
  }
  // Desenha uma das duas barras (gastos/receitas) do periodo — mesmos
  // buckets e mesma selecao de barras pras duas, so muda o valor plotado e
  // a cor, pra dar pra comparar visualmente e clicar em qualquer uma delas.
  function renderBarChart(containerId, buckets, granularity, valueOf, colorClass) {
    const max = Math.max(1, ...buckets.map(valueOf));
    // Com poucas colunas da pra escrever o valor sempre visivel em cima da
    // barra; com muitas (ex.: "por dia" num periodo longo) os rotulos se
    // sobrepoem, entao volta a depender so do hover (title).
    const showValues = buckets.length <= 40;
    const hasSelection = barSelection && barSelection.granularity === granularity;
    document.getElementById(containerId).innerHTML =
      '<div class="bar-chart">' +
      buckets
        .map((b) => {
          const v = valueOf(b);
          const label = bucketLabel(b.key, granularity);
          const isSelected = hasSelection && barSelection.keys.has(b.key);
          const fillClass = 'bar-fill' + colorClass + (isSelected ? ' is-selected' : hasSelection ? ' is-dimmed' : '');
          const valueHtml = showValues ? '<span class="bar-value">' + brlCompact(v) + '</span>' : '';
          return '<div class="bar-col clickable" data-bucket-key="' + b.key + '" data-granularity="' + granularity +
            '" title="' + label + ': ' + brl(v) + ' — clique para selecionar, Ctrl+clique pra selecionar varios"><div class="bar-track"><div class="' + fillClass + '" style="height:' +
            Math.round((v / max) * 100) + '%">' + valueHtml + '</div></div><div class="bar-label">' + label + '</div></div>';
        })
        .join('') +
      '</div>';
  }
  function renderTimeSeriesChart(base) {
    const granularity = granularitySelect.value;
    const buckets = computeTimeSeries(base, granularity);
    renderBarChart('monthly-chart', buckets, granularity, (b) => b.expenses, '');
    renderBarChart('monthly-income-chart', buckets, granularity, (b) => b.income, ' income');
    updateBarSelectionInfo();
  }
  granularitySelect.addEventListener('change', () => {
    barSelection = null; // buckets de outra granularidade nao tem a ver com a selecao anterior
    renderAll();
  });

  // --- "Gastos por categoria/subcategoria ao longo do tempo": tabela
  // dimensao x periodo em vez de grafico — com ate 15 categorias (ou mais
  // subcategorias) de escalas bem diferentes (aluguel vs. assinatura, por
  // exemplo), uma barra ou linha proporcional escondia as menores. A
  // tabela mostra o valor exato de cada uma, com um leve realce (mais forte
  // quanto maior o valor NA PROPRIA LINHA, pra nao competir entre linhas de
  // escalas diferentes) so como pista visual. Clicar numa celula ou no nome
  // da linha filtra (a mesma funcao serve pra categoria e subcategoria). ---
  function computeDimensionPeriodTable(filtered, granularity, dimensionField, isExpense, requireValido) {
    const cellMap = new Map(); // bucketKey -> Map(valor da dimensao -> total)
    const totals = new Map();
    const bucketSet = new Set();
    for (const t of filtered) {
      if ((requireValido && !t.valido) || t.isExpense !== isExpense) continue;
      const dim = t[dimensionField] || '(sem categoria)';
      const key = bucketKey(t, granularity);
      bucketSet.add(key);
      const byDim = cellMap.get(key) || new Map();
      byDim.set(dim, (byDim.get(dim) || 0) + t.amount);
      cellMap.set(key, byDim);
      totals.set(dim, (totals.get(dim) || 0) + t.amount);
    }
    const buckets = [...bucketSet].sort();
    const dims = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
    return { buckets, dims, cellMap, totals };
  }

  // Igual a computeDimensionPeriodTable, mas cada celula guarda {income,
  // expense} em vez de um total so — o saldo (income - expense) pode ser
  // negativo, entao precisa dos dois lados pra calcular na hora de renderizar.
  function computeDimensionSaldoPeriodTable(filtered, granularity, dimensionField, requireValido) {
    const cellMap = new Map(); // bucketKey -> Map(valor da dimensao -> {income, expense})
    const totals = new Map();
    const bucketSet = new Set();
    for (const t of filtered) {
      if (requireValido && !t.valido) continue;
      const dim = t[dimensionField] || '(sem categoria)';
      const key = bucketKey(t, granularity);
      bucketSet.add(key);
      const byDim = cellMap.get(key) || new Map();
      const cell = byDim.get(dim) || { income: 0, expense: 0 };
      if (t.isExpense) cell.expense += t.amount; else cell.income += t.amount;
      byDim.set(dim, cell);
      cellMap.set(key, byDim);
      const total = totals.get(dim) || { income: 0, expense: 0 };
      if (t.isExpense) total.expense += t.amount; else total.income += t.amount;
      totals.set(dim, total);
    }
    const buckets = [...bucketSet].sort();
    const dims = [...totals.entries()].sort((a, b) => (b[1].income - b[1].expense) - (a[1].income - a[1].expense)).map(([d]) => d);
    return { buckets, dims, cellMap, totals };
  }

  // Estado de ordenacao de cada tabela dimensao x periodo (independente do
  // sistema de ordenacao das tabelas genericas, que dependem de TABLE_DEFS —
  // essas sao renderizadas por conta propria). key pode ser 'dim' (nome da
  // categoria/subcategoria), 'total', ou a chave de um periodo.
  const periodoTableSort = {};
  function getPeriodoSort(tableId) {
    if (!periodoTableSort[tableId]) periodoTableSort[tableId] = { key: null, dir: 1 };
    return periodoTableSort[tableId];
  }
  // valueOf extrai um numero comparavel de cada entrada de totals/cellMap —
  // um total simples nas tabelas de gastos/receita, ou income-expense na de
  // saldo. Default trata a entrada como o proprio numero.
  function sortPeriodoDims(dims, cellMap, totals, sortState, valueOf) {
    if (!sortState.key) return dims; // ordem default ja vem pronta de compute*PeriodTable
    const get = valueOf || ((x) => x || 0);
    const valueFor = (dim) =>
      sortState.key === 'dim' ? dim : sortState.key === 'total' ? get(totals.get(dim)) : get((cellMap.get(sortState.key) || new Map()).get(dim));
    return [...dims].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      return sortState.key === 'dim' ? sortState.dir * String(av).localeCompare(String(bv), 'pt-BR') : sortState.dir * (av - bv);
    });
  }
  function buildPeriodoHeaderHtml(tableId, columnLabel, buckets, granularity, sortState) {
    function thLabel(key, label) {
      const arrow = sortState.key === key ? (sortState.dir === 1 ? ' ▲' : ' ▼') : '';
      return '<span class="periodo-th-label" data-table-id="' + tableId + '" data-sort-key="' + key + '">' + label + arrow + '</span>';
    }
    return '<tr><th>' + thLabel('dim', columnLabel) + '</th>' +
      buckets.map((key) => '<th class="num">' + thLabel(key, bucketLabel(key, granularity)) + '</th>').join('') +
      '<th class="num">' + thLabel('total', 'Total') + '</th></tr>';
  }

  function renderDimensionPeriodoTable(tableId, granularitySelectEl, filtered, dimensionField, columnLabel, isExpense, requireValido) {
    const granularity = granularitySelectEl.value;
    const { buckets, dims: unsortedDims, cellMap, totals } = computeDimensionPeriodTable(filtered, granularity, dimensionField, isExpense, requireValido);
    const sortState = getPeriodoSort(tableId);
    const dims = sortPeriodoDims(unsortedDims, cellMap, totals, sortState);
    const headerHtml = buildPeriodoHeaderHtml(tableId, columnLabel, buckets, granularity, sortState);

    const bodyHtml = dims
      .map((dim) => {
        const rowValues = buckets.map((key) => (cellMap.get(key) || new Map()).get(dim) || 0);
        const rowMax = Math.max(1, ...rowValues);
        const cells = rowValues
          .map((v, i) => {
            if (v <= 0) return '<td class="num"></td>';
            const intensity = 0.06 + Math.min(1, v / rowMax) * 0.28;
            return '<td class="num periodo-cell" data-dim-field="' + dimensionField + '" data-dim-value="' + esc(dim) + '" data-bucket-key="' + buckets[i] +
              '" data-granularity="' + granularity + '" style="background:rgba(0,169,154,' + intensity.toFixed(2) + ')" title="Clique para filtrar">' + brl(v) + '</td>';
          })
          .join('');
        return '<tr><td class="periodo-cat-label clickable" data-dim-field="' + dimensionField + '" data-dim-value="' + esc(dim) + '" title="Clique para filtrar por ' + esc(dim) + '">' +
          esc(dim) + '</td>' + cells + '<td class="num periodo-total">' + brl(totals.get(dim)) + '</td></tr>';
      })
      .join('');

    // Subtotal por coluna (uma linha "Total" no rodape) + o total geral no
    // canto — soma sempre todas as dimensoes, independente da ordenacao.
    const columnTotals = buckets.map((key) => {
      const byDim = cellMap.get(key) || new Map();
      return unsortedDims.reduce((sum, dim) => sum + (byDim.get(dim) || 0), 0);
    });
    const grandTotal = columnTotals.reduce((a, b) => a + b, 0);
    const footerHtml = '<tr class="periodo-total-row"><td>Total</td>' +
      columnTotals.map((v) => '<td class="num">' + (v > 0 ? brl(v) : '') + '</td>').join('') +
      '<td class="num">' + brl(grandTotal) + '</td></tr>';

    const table = document.getElementById(tableId);
    table.querySelector('thead').innerHTML = headerHtml;
    table.querySelector('tbody').innerHTML = bodyHtml + footerHtml;
  }

  // Saldo = receita - despesa por celula. Ao contrario das tabelas de gastos
  // e receita (sempre positivas), aqui o valor pode ser negativo — o realce
  // vira divergente (verde pra saldo positivo, ambar pra negativo, mesma
  // cor de "Saldo no periodo" no card de KPIs) em vez da escala azul unica.
  function renderSaldoPeriodoTable(tableId, granularitySelectEl, filtered, dimensionField, columnLabel, requireValido) {
    const granularity = granularitySelectEl.value;
    const { buckets, dims: unsortedDims, cellMap, totals } = computeDimensionSaldoPeriodTable(filtered, granularity, dimensionField, requireValido);
    const sortState = getPeriodoSort(tableId);
    const saldoOf = (cell) => (cell ? cell.income - cell.expense : 0);
    const dims = sortPeriodoDims(unsortedDims, cellMap, totals, sortState, saldoOf);
    const headerHtml = buildPeriodoHeaderHtml(tableId, columnLabel, buckets, granularity, sortState);

    const bodyHtml = dims
      .map((dim) => {
        const rowValues = buckets.map((key) => saldoOf((cellMap.get(key) || new Map()).get(dim)));
        const rowMaxAbs = Math.max(1, ...rowValues.map((v) => Math.abs(v)));
        const cells = rowValues
          .map((v, i) => {
            const cellExists = (cellMap.get(buckets[i]) || new Map()).has(dim);
            if (!cellExists) return '<td class="num"></td>';
            const intensity = 0.06 + Math.min(1, Math.abs(v) / rowMaxAbs) * 0.28;
            const rgb = v >= 0 ? '46,158,79' : '193,112,28';
            return '<td class="num periodo-cell" data-dim-field="' + dimensionField + '" data-dim-value="' + esc(dim) + '" data-bucket-key="' + buckets[i] +
              '" data-granularity="' + granularity + '" style="background:rgba(' + rgb + ',' + intensity.toFixed(2) + ')" title="Clique para filtrar">' + brl(v) + '</td>';
          })
          .join('');
        return '<tr><td class="periodo-cat-label clickable" data-dim-field="' + dimensionField + '" data-dim-value="' + esc(dim) + '" title="Clique para filtrar por ' + esc(dim) + '">' +
          esc(dim) + '</td>' + cells + '<td class="num periodo-total">' + brl(saldoOf(totals.get(dim))) + '</td></tr>';
      })
      .join('');

    const columnTotals = buckets.map((key) => {
      const byDim = cellMap.get(key) || new Map();
      return unsortedDims.reduce((sum, dim) => sum + saldoOf(byDim.get(dim)), 0);
    });
    const grandTotal = columnTotals.reduce((a, b) => a + b, 0);
    const footerHtml = '<tr class="periodo-total-row"><td>Total</td>' +
      columnTotals.map((v) => '<td class="num">' + brl(v) + '</td>').join('') +
      '<td class="num">' + brl(grandTotal) + '</td></tr>';

    const table = document.getElementById(tableId);
    table.querySelector('thead').innerHTML = headerHtml;
    table.querySelector('tbody').innerHTML = bodyHtml + footerHtml;
  }

  const categoriaGranularitySelect = document.getElementById('categoria-chart-granularity');
  const subcategoriaGranularitySelect = document.getElementById('subcategoria-chart-granularity');
  const emprestimoGranularitySelect = document.getElementById('emprestimo-chart-granularity');
  const invalidoGranularitySelect = document.getElementById('invalido-chart-granularity');
  function renderCategoriaPeriodoTable(filtered) {
    renderSaldoPeriodoTable('categorias-saldo-periodo-table', categoriaGranularitySelect, filtered, 'categoria', 'Categoria', true);
    renderDimensionPeriodoTable('categorias-periodo-table', categoriaGranularitySelect, filtered, 'categoria', 'Categoria', true, true);
    renderDimensionPeriodoTable('categorias-receita-periodo-table', categoriaGranularitySelect, filtered, 'categoria', 'Categoria', false, true);
  }
  function renderSubcategoriaPeriodoTable(filtered) {
    renderSaldoPeriodoTable('subcategorias-saldo-periodo-table', subcategoriaGranularitySelect, filtered, 'subcategoria', 'Subcategoria', true);
    renderDimensionPeriodoTable('subcategorias-periodo-table', subcategoriaGranularitySelect, filtered, 'subcategoria', 'Subcategoria', true, true);
    renderDimensionPeriodoTable('subcategorias-receita-periodo-table', subcategoriaGranularitySelect, filtered, 'subcategoria', 'Subcategoria', false, true);
  }
  // Aba Emprestimos: mesma logica das duas acima, mas agrupada por
  // subcategoria (categoria e sempre "Emprestimos" aqui, entao agrupar por
  // ela nao ajudaria) e sem exigir Valido — essas transacoes sao sempre
  // invalidas pra nao contar nos totais gerais.
  function renderEmprestimoPeriodoTable(filtered) {
    renderSaldoPeriodoTable('emprestimos-saldo-periodo-table', emprestimoGranularitySelect, filtered, 'subcategoria', 'Subcategoria', false);
    renderDimensionPeriodoTable('emprestimos-periodo-table', emprestimoGranularitySelect, filtered, 'subcategoria', 'Subcategoria', true, false);
    renderDimensionPeriodoTable('emprestimos-receita-periodo-table', emprestimoGranularitySelect, filtered, 'subcategoria', 'Subcategoria', false, false);
  }
  // Aba Invalidos: agrupada por categoria (ao contrario de Emprestimos, aqui
  // a categoria varia — fatura de cartao duplicada, invalidacao manual,
  // emprestimo, etc. — entao agrupar por ela ajuda a ver onde o volume
  // invalidado esta concentrado). Tambem sem exigir Valido, obviamente.
  function renderInvalidoPeriodoTable(filtered) {
    renderSaldoPeriodoTable('invalidos-saldo-periodo-table', invalidoGranularitySelect, filtered, 'categoria', 'Categoria', false);
    renderDimensionPeriodoTable('invalidos-periodo-table', invalidoGranularitySelect, filtered, 'categoria', 'Categoria', true, false);
    renderDimensionPeriodoTable('invalidos-receita-periodo-table', invalidoGranularitySelect, filtered, 'categoria', 'Categoria', false, false);
  }
  categoriaGranularitySelect.addEventListener('change', () => renderCategoriaPeriodoTable(getFiltered()));
  subcategoriaGranularitySelect.addEventListener('change', () => renderSubcategoriaPeriodoTable(getFiltered()));
  emprestimoGranularitySelect.addEventListener('change', () => renderEmprestimoPeriodoTable(getEmprestimoFiltered()));
  invalidoGranularitySelect.addEventListener('change', () => renderInvalidoPeriodoTable(getInvalidoFiltered()));

  // --- tabelas genericas: cabecalho clicavel pra ordenar + filtro por coluna ---
  const TX_COLUMNS = [
    { key: 'dateISO', label: 'Data', value: (t) => t.dateISO, render: (t) => t.dateLabel },
    { key: 'dataConsideradaISO', label: 'DataConsiderada', value: (t) => t.dataConsideradaISO, render: (t) => t.dataConsideradaLabel },
    { key: 'description', label: 'Descricao', value: (t) => t.description },
    { key: 'categoria', label: 'Categoria', value: (t) => t.categoria, render: (t) => classificationInput(t, 'categoria') },
    { key: 'subcategoria', label: 'Subcategoria', value: (t) => t.subcategoria, render: (t) => classificationInput(t, 'subcategoria') },
    { key: 'amount', label: 'Valor', value: (t) => t.amount, type: 'currency' },
    { key: 'transactionId', label: 'ID', value: (t) => t.transactionId },
    { key: 'account', label: 'Conta', value: (t) => t.account },
    { key: 'pendente', label: 'Pendente', value: (t) => (t.pendente ? 'Sim' : 'Nao'), render: (t) => (t.pendente ? '<span class="badge-pend">pendente</span>' : '') },
    { key: 'valido', label: 'Valido?', value: (t) => (t.valido ? 'Sim' : 'Nao'), render: (t) => validoCheckbox(t) },
    { key: 'isEmprestimo', label: 'Emprestimo?', value: (t) => (t.isEmprestimo ? 'Sim' : 'Nao') },
    { key: 'motivoInvalido', label: 'Motivo (invalido)', value: (t) => t.motivoInvalido },
    { key: 'bankCategory', label: 'Categoria do banco', value: (t) => t.bankCategory },
    { key: 'descriptionRaw', label: 'Descricao original do banco', value: (t) => t.descriptionRaw },
    { key: 'currencyCode', label: 'Moeda', value: (t) => t.currencyCode },
    { key: 'amountInAccountCurrency', label: 'Valor na moeda da conta', value: (t) => t.amountInAccountCurrency, type: 'currency' },
    { key: 'providerCode', label: 'Codigo do banco (interno)', value: (t) => t.providerCode },
    { key: 'providerId', label: 'Provider ID (Open Finance)', value: (t) => t.providerId },
    { key: 'merchantName', label: 'Estabelecimento', value: (t) => t.merchantName },
    { key: 'merchantCnpj', label: 'CNPJ do estabelecimento', value: (t) => t.merchantCnpj },
    { key: 'merchantCnae', label: 'CNAE', value: (t) => t.merchantCnae },
    { key: 'payer', label: 'Pagador', value: (t) => t.payer },
    { key: 'receiver', label: 'Recebedor', value: (t) => t.receiver },
    { key: 'paymentMethod', label: 'Forma de pagamento', value: (t) => t.paymentMethod },
    { key: 'paymentReason', label: 'Motivo do pagamento', value: (t) => t.paymentReason },
    { key: 'transferType', label: 'Tipo de transferencia', value: (t) => t.transferType },
    { key: 'receiverReferenceId', label: 'Identificador do recebedor', value: (t) => t.receiverReferenceId },
    { key: 'boletoDigitableLine', label: 'Linha digitavel (boleto)', value: (t) => t.boletoDigitableLine },
    { key: 'boletoBarcode', label: 'Codigo de barras (boleto)', value: (t) => t.boletoBarcode },
    { key: 'boletoBaseAmount', label: 'Valor base (boleto)', value: (t) => t.boletoBaseAmount, type: 'currency' },
    { key: 'boletoPenaltyAmount', label: 'Multa (boleto)', value: (t) => t.boletoPenaltyAmount, type: 'currency' },
    { key: 'boletoInterestAmount', label: 'Juros (boleto)', value: (t) => t.boletoInterestAmount, type: 'currency' },
    { key: 'boletoDiscountAmount', label: 'Desconto (boleto)', value: (t) => t.boletoDiscountAmount, type: 'currency' },
    { key: 'operationType', label: 'Tipo de operacao', value: (t) => t.operationType },
    { key: 'installment', label: 'Parcela', value: (t) => t.installment },
    { key: 'installmentTotalAmount', label: 'Valor total da compra', value: (t) => t.installmentTotalAmount, type: 'currency' },
    { key: 'cardLastDigits', label: 'Cartao (final)', value: (t) => t.cardLastDigits },
    { key: 'payeeMCC', label: 'MCC', value: (t) => t.payeeMCC },
    { key: 'purchaseDateLabel', label: 'Data da compra', value: (t) => t.purchaseDateLabel },
    { key: 'billId', label: 'ID da fatura', value: (t) => t.billId },
    { key: 'billForecastMonth', label: 'Mes da fatura', value: (t) => t.billForecastMonth },
    { key: 'cardFeeType', label: 'Tipo de taxa (cartao)', value: (t) => t.cardFeeType },
    { key: 'cardOtherCreditType', label: 'Outro tipo de credito (cartao)', value: (t) => t.cardOtherCreditType },
    { key: 'statusBanco', label: 'Status (banco)', value: (t) => t.statusBanco },
    { key: 'balanceAfter', label: 'Saldo apos', value: (t) => t.balanceAfter, type: 'currency' },
    { key: 'createdAtLabel', label: 'Criado no Pluggy em', value: (t) => t.createdAtLabel },
    { key: 'updatedAtLabel', label: 'Atualizado no Pluggy em', value: (t) => t.updatedAtLabel },
    { key: 'isExpense', label: 'Tipo', value: (t) => (t.isExpense ? 'Gasto' : 'Receita') },
  ];
  // Move colunas pra logo depois de "Descricao" numa copia de TX_COLUMNS,
  // preservando a ordem/definicao original de cada coluna.
  function withColumnsMovedAfter(columns, afterKey, keysToMove) {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const rest = columns.filter((c) => !keysToMove.includes(c.key));
    const afterIdx = rest.findIndex((c) => c.key === afterKey);
    return [...rest.slice(0, afterIdx + 1), ...keysToMove.map((k) => byKey.get(k)), ...rest.slice(afterIdx + 1)];
  }
  const PEND_COLUMNS = [
    {
      key: '_select',
      label: 'Selecionar',
      value: () => '',
      render: (t) => '<input type="checkbox" class="pend-select" data-id="' + t.id + '"' + (selectedPendentes.has(t.id) ? ' checked' : '') + '>',
      noSort: true,
      noFilter: true,
    },
    { key: '_acao', label: '', value: () => '', render: (t) => '<button type="button" class="btn-revisado" data-id="' + t.id + '">Marcar como revisado</button>', noSort: true, noFilter: true },
    { key: 'motivo', label: 'Motivo da pendencia', value: (t) => t.motivo },
    ...withColumnsMovedAfter(TX_COLUMNS, 'description', ['amount', 'isExpense']),
  ];
  const CAT_COLUMNS = [
    { key: 'category', label: 'Categoria', value: (c) => c.category },
    { key: 'total', label: 'Total gasto', value: (c) => c.total, type: 'currency' },
    { key: 'count', label: 'Qtde.', value: (c) => c.count, type: 'number' },
  ];
  const RECEITA_CAT_COLUMNS = [
    { key: 'category', label: 'Categoria', value: (c) => c.category },
    { key: 'total', label: 'Total recebido', value: (c) => c.total, type: 'currency' },
    { key: 'count', label: 'Qtde.', value: (c) => c.count, type: 'number' },
  ];
  const SUBCAT_COLUMNS = [
    { key: 'category', label: 'Subcategoria', value: (c) => c.category },
    { key: 'total', label: 'Total gasto', value: (c) => c.total, type: 'currency' },
    { key: 'count', label: 'Qtde.', value: (c) => c.count, type: 'number' },
  ];
  const RECEITA_SUBCAT_COLUMNS = [
    { key: 'category', label: 'Subcategoria', value: (c) => c.category },
    { key: 'total', label: 'Total recebido', value: (c) => c.total, type: 'currency' },
    { key: 'count', label: 'Qtde.', value: (c) => c.count, type: 'number' },
  ];
  const MERCHANT_COLUMNS = [
    { key: 'description', label: 'Descricao', value: (m) => m.description },
    { key: 'count', label: 'Qtde.', value: (m) => m.count, type: 'number' },
    { key: 'total', label: 'Total', value: (m) => m.total, type: 'currency' },
  ];
  const ACCOUNT_COLUMNS = [
    { key: 'name', label: 'Conta', value: (a) => a.name },
    { key: 'typeLabel', label: 'Tipo', value: (a) => (a.type === 'CREDIT' ? 'Cartao de credito' : 'Conta') },
    { key: 'balance', label: 'Saldo atual', value: (a) => a.balance, type: 'currency' },
    { key: 'totalExpenses', label: 'Gasto no periodo', value: (a) => a.totalExpenses, type: 'currency' },
  ];

  const TABLE_DEFS = {
    'transacoes-table': { columns: TX_COLUMNS, rows: () => getFiltered(), rowId: (t) => t.id },
    'pendencias-table': { columns: PEND_COLUMNS, rows: () => getFiltered().filter((t) => t.pendente && t.valido), rowId: (t) => t.id },
    'categorias-table': { columns: CAT_COLUMNS, rows: () => computeByDimension(getFiltered(), 'categoria', true, true) },
    'categorias-receita-table': { columns: RECEITA_CAT_COLUMNS, rows: () => computeByDimension(getFiltered(), 'categoria', false, true) },
    'subcategorias-table': { columns: SUBCAT_COLUMNS, rows: () => computeByDimension(getFiltered(), 'subcategoria', true, true) },
    'subcategorias-receita-table': { columns: RECEITA_SUBCAT_COLUMNS, rows: () => computeByDimension(getFiltered(), 'subcategoria', false, true) },
    'emprestimos-table': { columns: SUBCAT_COLUMNS, rows: () => computeByDimension(getEmprestimoFiltered(), 'subcategoria', true, false) },
    'emprestimos-receita-table': { columns: RECEITA_SUBCAT_COLUMNS, rows: () => computeByDimension(getEmprestimoFiltered(), 'subcategoria', false, false) },
    'invalidos-table': { columns: CAT_COLUMNS, rows: () => computeByDimension(getInvalidoFiltered(), 'categoria', true, false) },
    'invalidos-receita-table': { columns: RECEITA_CAT_COLUMNS, rows: () => computeByDimension(getInvalidoFiltered(), 'categoria', false, false) },
    'merchants-table': { columns: MERCHANT_COLUMNS, rows: () => computeMerchants(getFiltered()) },
    'accounts-table': { columns: ACCOUNT_COLUMNS, rows: () => computeAccounts(getFiltered()) },
  };
  const tableStates = {};

  function defaultCellContent(col, row) {
    const v = col.value(row);
    return col.type === 'currency' ? (v == null ? '' : brl(v)) : esc(v);
  }

  function cellHtml(col, row) {
    const content = col.render ? col.render(row) : defaultCellContent(col, row);
    const cls = col.type === 'currency' || col.type === 'number' ? ' class="num"' : '';
    return '<td' + cls + ' data-col="' + col.key + '">' + content + '</td>';
  }

  function compareRows(a, b, col) {
    const av = col.value(a);
    const bv = col.value(b);
    if (col.type === 'currency' || col.type === 'number') return (av ?? -Infinity) - (bv ?? -Infinity);
    return String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR');
  }

  // O clique pra ordenar fica so no <span class="th-label">, nunca no <input>
  // de filtro — antes o data-sort-key ficava no <th> inteiro, e clicar dentro
  // do campo de filtro (que e filho do <th>) contava como clique no cabecalho
  // e reordenava a coluna em vez de deixar digitar o filtro.
  function buildHeaderHtml(tableId, columns) {
    const state = tableStates[tableId];
    return (
      '<tr>' +
      columns
        .map((c) => {
          const arrow = state.sortKey === c.key ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '';
          const labelHtml = c.noSort
            ? esc(c.label)
            : '<span class="th-label" data-sort-key="' + c.key + '" data-table="' + tableId + '">' + esc(c.label) + arrow + '</span>';
          const currentFilter = state.filters[c.key] || '';
          const filterHtml = c.noFilter
            ? ''
            : '<br><input type="text" class="col-filter" data-table="' + tableId + '" data-filter-key="' + c.key +
              '" placeholder="filtrar..." value="' + esc(currentFilter) + '">';
          return '<th>' + labelHtml + filterHtml + '</th>';
        })
        .join('') +
      '</tr>'
    );
  }

  function initTable(tableId) {
    tableStates[tableId] = { sortKey: null, sortDir: 1, filters: {} };
    document.querySelector('#' + tableId + ' thead').innerHTML = buildHeaderHtml(tableId, TABLE_DEFS[tableId].columns);
  }

  function computeTableRows(tableId) {
    const def = TABLE_DEFS[tableId];
    const state = tableStates[tableId];
    let rows = def.rows();

    const activeFilters = Object.entries(state.filters).filter(([, v]) => v);
    if (activeFilters.length > 0) {
      rows = rows.filter((row) =>
        activeFilters.every(([key, needle]) => {
          const col = def.columns.find((c) => c.key === key);
          return String(col.value(row) ?? '').toLowerCase().includes(needle.toLowerCase());
        })
      );
    }
    if (state.sortKey) {
      const col = def.columns.find((c) => c.key === state.sortKey);
      rows = [...rows].sort((a, b) => state.sortDir * compareRows(a, b, col));
    }
    return rows;
  }

  function renderTable(tableId, precomputedRows) {
    const def = TABLE_DEFS[tableId];
    const rows = precomputedRows || computeTableRows(tableId);
    document.querySelector('#' + tableId + ' tbody').innerHTML = rows
      .map((row) => {
        const idAttr = def.rowId ? ' data-row-id="' + def.rowId(row) + '"' : '';
        return '<tr' + idAttr + '>' + def.columns.map((c) => cellHtml(c, row)).join('') + '</tr>';
      })
      .join('');
  }

  Object.keys(TABLE_DEFS).forEach(initTable);

  document.addEventListener('click', (ev) => {
    const label = ev.target.closest('.th-label');
    if (label) {
      const tableId = label.dataset.table;
      const state = tableStates[tableId];
      const key = label.dataset.sortKey;
      if (state.sortKey === key) state.sortDir *= -1;
      else { state.sortKey = key; state.sortDir = 1; }
      document.querySelector('#' + tableId + ' thead').innerHTML = buildHeaderHtml(tableId, TABLE_DEFS[tableId].columns);
      renderTable(tableId);
      return;
    }

    const btn = ev.target.closest('.btn-revisado');
    if (btn) {
      markReviewed([btn.dataset.id]);
      return;
    }

    const bulkBtn = ev.target.closest('#pend-bulk-revisado');
    if (bulkBtn) {
      markReviewed([...selectedPendentes]);
      return;
    }

    const clearSel = ev.target.closest('#clear-bar-selection');
    if (clearSel) {
      barSelection = null;
      renderAll();
      return;
    }

    const barCol = ev.target.closest('.bar-col[data-bucket-key]');
    if (barCol) {
      toggleBarSelection(barCol.dataset.bucketKey, barCol.dataset.granularity, ev.ctrlKey || ev.metaKey);
      return;
    }

    const periodoTh = ev.target.closest('.periodo-th-label');
    if (periodoTh) {
      const tableId = periodoTh.dataset.tableId;
      const key = periodoTh.dataset.sortKey;
      const sortState = getPeriodoSort(tableId);
      if (sortState.key === key) sortState.dir *= -1;
      else { sortState.key = key; sortState.dir = 1; }
      if (tableId.startsWith('categorias-')) renderCategoriaPeriodoTable(getFiltered());
      else if (tableId.startsWith('subcategorias-')) renderSubcategoriaPeriodoTable(getFiltered());
      else if (tableId.startsWith('emprestimos-')) renderEmprestimoPeriodoTable(getEmprestimoFiltered());
      else renderInvalidoPeriodoTable(getInvalidoFiltered());
      return;
    }

    const periodoCatLabel = ev.target.closest('.periodo-cat-label[data-dim-value]');
    if (periodoCatLabel) {
      drillToFilters({ [periodoCatLabel.dataset.dimField]: periodoCatLabel.dataset.dimValue });
      return;
    }

    const periodoCell = ev.target.closest('.periodo-cell[data-bucket-key]');
    if (periodoCell) {
      const range = bucketDateRange(periodoCell.dataset.bucketKey, periodoCell.dataset.granularity);
      drillToFilters({ [periodoCell.dataset.dimField]: periodoCell.dataset.dimValue, from: range.from, to: range.to });
    }
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.classList && el.classList.contains('col-filter')) {
      tableStates[el.dataset.table].filters[el.dataset.filterKey] = el.value;
      renderTable(el.dataset.table);
      return;
    }
    if (el.classList && el.classList.contains('cls-input')) {
      const t = findTransaction(el.dataset.id);
      if (!t) return;
      t[el.dataset.field] = el.value;
      saveEdit(t);
      document.querySelectorAll('input.cls-input[data-id="' + el.dataset.id + '"][data-field="' + el.dataset.field + '"]').forEach((other) => {
        if (other !== el) other.value = el.value;
      });
      renderTable('categorias-table');
      renderTable('categorias-receita-table');
      renderTable('subcategorias-table');
      renderTable('subcategorias-receita-table');
      renderTable('emprestimos-table');
      renderTable('emprestimos-receita-table');
      renderTable('invalidos-table');
      renderTable('invalidos-receita-table');
      renderCategoriaPeriodoTable(getFiltered());
      renderSubcategoriaPeriodoTable(getFiltered());
      renderEmprestimoPeriodoTable(getEmprestimoFiltered());
      renderInvalidoPeriodoTable(getInvalidoFiltered());
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'pend-select-all') {
      const rows = computeTableRows('pendencias-table');
      if (el.checked) rows.forEach((t) => selectedPendentes.add(t.id));
      else rows.forEach((t) => selectedPendentes.delete(t.id));
      renderTable('pendencias-table', rows);
      updatePendSelectedCount();
      return;
    }
    if (el.classList && el.classList.contains('pend-select')) {
      const id = Number(el.dataset.id);
      if (el.checked) selectedPendentes.add(id);
      else selectedPendentes.delete(id);
      updatePendSelectedCount();
      return;
    }
    // Propagar pra parcelas-irmas so ao sair do campo (nao a cada tecla) —
    // evita varrer o DOM das outras linhas a cada letra digitada na
    // classificacao da parcela lider. Tambem e onde
    // conferimos se a categoria virou "Emprestimos": se virou, invalida a
    // transacao automaticamente (empréstimo não é gasto/receita de verdade).
    if (el.classList && el.classList.contains('cls-input')) {
      const t = findTransaction(el.dataset.id);
      if (t) {
        if (el.dataset.field === 'categoria') {
          const wasEmprestimo = t.isEmprestimo;
          recomputeEmprestimoFlag(t);
          if (t.isEmprestimo && !wasEmprestimo && t.valido) {
            t.valido = false;
            document.querySelectorAll('.valido-input[data-id="' + t.id + '"]').forEach((cb) => { cb.checked = false; });
            saveEdit(t);
            refreshAfterValidoChange();
          }
        }
        propagateInstallmentGroup(t);
      }
      return;
    }
    if (!el.classList || !el.classList.contains('valido-input')) return;
    const t = findTransaction(el.dataset.id);
    if (!t) return;
    t.valido = el.checked;
    saveEdit(t);
    document.querySelectorAll('.valido-input[data-id="' + el.dataset.id + '"]').forEach((other) => {
      if (other !== el) other.checked = el.checked;
    });
    refreshAfterValidoChange();
  });

  // --- exportar aba Transacoes para .csv (abre direto no Excel/Sheets) ---
  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvValue(col, row) {
    const v = col.value(row);
    if ((col.type === 'currency' || col.type === 'number') && typeof v === 'number') {
      return String(v).replace('.', ',');
    }
    return v;
  }

  function exportTransacoesCsv() {
    const rows = getFiltered();
    const lines = [TX_COLUMNS.map((c) => csvEscape(c.label)).join(';')];
    for (const t of rows) {
      lines.push(TX_COLUMNS.map((c) => csvEscape(csvValue(c, t))).join(';'));
    }
    const csv = '﻿' + lines.join('\\r\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacoes-' + fromInput.value + '_a_' + toInput.value + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  document.getElementById('export-transacoes').addEventListener('click', exportTransacoesCsv);

  document.querySelectorAll('.js-logout').forEach((btn) => {
    btn.addEventListener('click', () => {
      fetch('/logout', { method: 'POST' }).finally(() => {
        location.href = '/login';
      });
    });
  });

  function renderAll() {
    renderResumo(getBaseFiltered());
    renderEmprestimoPeriodoTable(getEmprestimoFiltered());
    renderInvalidoPeriodoTable(getInvalidoFiltered());
    Object.keys(TABLE_DEFS).forEach((tableId) => renderTable(tableId));
  }

  // Reaproveitado pelo toggle manual de "Valido" e pela auto-invalidacao ao
  // classificar algo como Emprestimos — os dois mudam o que entra nos
  // totais, entao precisam do mesmo conjunto de tabelas atualizado.
  function refreshAfterValidoChange() {
    renderResumo(getBaseFiltered());
    renderEmprestimoPeriodoTable(getEmprestimoFiltered());
    renderInvalidoPeriodoTable(getInvalidoFiltered());
    renderCategoriaPeriodoTable(getFiltered());
    renderSubcategoriaPeriodoTable(getFiltered());
    renderTable('categorias-table');
    renderTable('categorias-receita-table');
    renderTable('subcategorias-table');
    renderTable('subcategorias-receita-table');
    renderTable('emprestimos-table');
    renderTable('emprestimos-receita-table');
    renderTable('invalidos-table');
    renderTable('invalidos-receita-table');
    renderTable('merchants-table');
    renderTable('accounts-table');
    renderTable('pendencias-table');
  }

  document.getElementById('filter-apply').addEventListener('click', renderAll);
  fromInput.addEventListener('change', renderAll);
  toInput.addEventListener('change', renderAll);
  // Limpa tudo que filtra o relatorio: periodo, dimensoes do topo, selecao
  // de barras do grafico e os filtros/ordenacao de cada coluna em cada
  // tabela — vale pra todas as abas, nao so a que esta aberta agora.
  document.getElementById('filter-clear').addEventListener('click', () => {
    fromInput.value = minDate;
    toInput.value = maxDate;
    categoriaFilter.value = '';
    resetSubcategoriaOptions('');
    SIMPLE_DIMENSION_FILTERS.forEach((el) => (el.value = ''));
    barSelection = null;
    Object.keys(TABLE_DEFS).forEach(initTable);
    [
      'categorias-saldo-periodo-table', 'categorias-periodo-table', 'categorias-receita-periodo-table',
      'subcategorias-saldo-periodo-table', 'subcategorias-periodo-table', 'subcategorias-receita-periodo-table',
      'emprestimos-saldo-periodo-table', 'emprestimos-periodo-table', 'emprestimos-receita-periodo-table',
      'invalidos-saldo-periodo-table', 'invalidos-periodo-table', 'invalidos-receita-periodo-table',
    ].forEach((tableId) => {
      periodoTableSort[tableId] = { key: null, dir: 1 };
    });
    renderAll();
  });

  document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => activateTab(b.dataset.tab)));

  updatePendSelectedCount();
  renderAll();
  `;
}

export function buildHtmlReport(report: Report, dateFrom: string, dateTo: string): string {
  const generatedAt = new Date().toLocaleString('pt-BR');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatorio de gastos</title>
<style>
  .viz-root {
    color-scheme: light;
    --surface-1:      #fcfcfb;
    --page:           #f9f9f7;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --text-muted:     #898781;
    --grid:           #e1e0d9;
    --baseline:       #c3c2b7;
    --border:         rgba(11,11,11,0.10);
    --series-1:       #2a78d6;
    --series-1-soft:  #cde2fb;
    --good:           #006300;
    --warn:           #9a5b00;
  }
  @media (prefers-color-scheme: dark) {
    .viz-root {
      color-scheme: dark;
      --surface-1:      #1a1a19;
      --page:           #0d0d0d;
      --text-primary:   #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted:     #898781;
      --grid:           #2c2c2a;
      --baseline:       #383835;
      --border:         rgba(255,255,255,0.10);
      --series-1:       #3987e5;
      --series-1-soft:  #184f95;
      --good:           #0ca30c;
      --warn:           #e0a030;
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--page);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: var(--text-secondary); font-size: 14px; margin: 0 0 20px; }
  h2 { font-size: 16px; margin: 0 0 12px; color: var(--text-primary); }
  section { margin-bottom: 36px; }

  .card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .filter-bar label { color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
  .filter-bar input[type="date"] {
    font: inherit;
    padding: 5px 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text-primary);
  }
  .filter-bar button {
    font: inherit;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text-primary);
    cursor: pointer;
  }
  .filter-bar .filter-hint { color: var(--text-muted); }

  .tab-bar { display: flex; gap: 6px; margin-bottom: 20px; border-bottom: 1px solid var(--border); }
  .tab-btn {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    font-size: 14px;
    font-family: inherit;
    padding: 10px 14px;
    cursor: pointer;
  }
  .tab-btn.active { color: var(--text-primary); border-bottom-color: var(--series-1); font-weight: 600; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .kpi-tile {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
  }
  .kpi-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
  .kpi-value { font-size: 24px; font-weight: 600; font-variant-numeric: proportional-nums; }
  .kpi-value.net-positive { color: var(--good); }
  .kpi-value.net-negative { color: var(--warn); }

  .chart-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .chart-header h2 { margin: 0; }
  .chart-header select {
    font: inherit;
    font-size: 13px;
    padding: 5px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text-primary);
  }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    height: 200px;
    border-bottom: 1px solid var(--baseline);
    padding-top: 24px;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .bar-col { flex: 1 1 28px; min-width: 28px; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 6px; }
  .bar-track { width: 100%; height: 100%; display: flex; align-items: flex-end; }
  .bar-fill { position: relative; width: 100%; background: var(--series-1); border-radius: 4px 4px 0 0; min-height: 2px; }
  .bar-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
  .bar-value {
    position: absolute;
    top: -15px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: var(--text-secondary);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .bar-fill.is-selected { box-shadow: 0 0 0 2px var(--text-primary) inset; }
  .bar-fill.is-dimmed { opacity: 0.35; }
  .bar-fill.income { background: var(--good); }
  #bar-selection-info { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }

  /* Barras e celulas clicaveis filtram o dashboard (periodo/categoria) sem
     trocar de aba sozinho — o cursor e o realce no hover sao a unica pista
     visual disso, entao ficam num lugar so. */
  .bar-col.clickable { cursor: pointer; }
  .bar-col.clickable:hover .bar-fill { filter: brightness(1.15); }

  .periodo-cat-label.clickable { cursor: pointer; }
  .periodo-cat-label.clickable:hover { color: var(--series-1); text-decoration: underline; }
  td.periodo-cell { cursor: pointer; }
  td.periodo-cell:hover { outline: 1px solid var(--series-1); outline-offset: -1px; }
  td.periodo-total { font-weight: 600; }
  .periodo-th-label { cursor: pointer; user-select: none; display: inline-block; }
  .periodo-th-label:hover { color: var(--text-primary); }
  tr.periodo-total-row td { font-weight: 600; border-top: 2px solid var(--baseline); }

  .table-scroll { overflow-x: auto; max-height: 70vh; }
  table.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.data-table th, table.data-table td { padding: 8px 10px; border-bottom: 1px solid var(--grid); text-align: left; white-space: nowrap; }
  table.data-table th { color: var(--text-secondary); font-weight: 600; font-size: 12px; position: sticky; top: 0; background: var(--surface-1); vertical-align: top; }
  .th-label { cursor: pointer; user-select: none; display: inline-block; }
  .th-label:hover { color: var(--text-primary); }
  table.data-table td.num, table.data-table th.num { text-align: right; font-variant-numeric: tabular-nums; }

  input.col-filter {
    font: inherit;
    font-size: 11px;
    font-weight: 400;
    padding: 3px 6px;
    margin-top: 4px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--page);
    color: var(--text-primary);
    width: 100%;
    box-sizing: border-box;
    cursor: text;
  }

  input.cls-input {
    font: inherit;
    font-size: 12px;
    padding: 5px 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text-primary);
    width: 130px;
  }
  input.cls-input:focus, input.col-filter:focus { outline: 2px solid var(--series-1); outline-offset: 1px; }

  .badge-pend {
    display: inline-block;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--warn);
    color: #fff;
  }
  .btn-revisado {
    font: inherit;
    font-size: 12px;
    padding: 5px 10px;
    border: 1px solid var(--series-1);
    border-radius: 6px;
    background: transparent;
    color: var(--series-1);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-revisado:hover { background: var(--series-1-soft); }

  .transacoes-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .pendencias-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    padding: 10px 12px;
    background: var(--series-1-soft);
    border-radius: 8px;
  }
  .pendencias-toolbar label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); }
  .cls-locked {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }
  .cls-locked::after { content: '🔒'; font-size: 11px; }
  .btn-export {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    border: 1px solid var(--series-1);
    border-radius: 6px;
    background: var(--series-1);
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-export:hover { opacity: 0.9; }

  footer { color: var(--text-muted); font-size: 12px; margin-top: 40px; }
  .link-btn {
    font: inherit;
    font-size: 12px;
    color: var(--series-1);
    background: none;
    border: none;
    padding: 0;
    margin-left: 4px;
    text-decoration: underline;
    cursor: pointer;
  }
  ${DESIGN_TOKENS_CSS}
  ${SHELL_CSS}
  ${FILTER_BAR_CSS}
  ${RESUMO_CSS}
  ${PERIODO_TABLE_CSS}
  ${TRANSACOES_CSS}
  ${PENDENCIAS_CSS}
  .g-report-meta { font-size: 12px; color: var(--g-text-3); margin: 0 0 16px; }
</style>
</head>
<body class="viz-root">
  <div class="g-shell">
    ${shellSidebarHtml()}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
      ${shellMobileTopbarHtml()}
      <main class="g-main">
        <p class="g-report-meta">Dados buscados no Pluggy de ${dateFrom} a ${dateTo} &middot; Gerado em ${generatedAt}</p>

        ${filterBarHtml()}

    ${resumoTabHtml()}

    <div id="tab-categorias" class="tab-panel">
      <div class="g-tab-pills" data-subtab-group="categorias">
        <button type="button" class="g-tab-pill active" data-subtab-target="saldo">Saldo</button>
        <button type="button" class="g-tab-pill" data-subtab-target="gastos">Gastos</button>
        <button type="button" class="g-tab-pill" data-subtab-target="receita">Receita</button>
      </div>

      <section class="card" data-subtab="saldo">
        <div class="chart-header">
          <h2>Saldo por categoria ao longo do tempo</h2>
          <select id="categoria-chart-granularity">
            <option value="dia">Por dia</option>
            <option value="mes" selected>Acumulado por mes</option>
            <option value="trimestre">Acumulado por trimestre</option>
            <option value="semestre">Acumulado por semestre</option>
            <option value="ano">Acumulado por ano</option>
          </select>
        </div>
        <p class="subtitle" style="margin:0 0 12px;">Receita menos despesa por categoria e periodo. Clique numa celula ou no nome da categoria para filtrar por aquele recorte (confira o resultado na aba Transacoes quando quiser).</p>
        <div class="table-scroll">
          <table class="data-table" id="categorias-saldo-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos por categoria ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="categorias-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Receita por categoria ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="categorias-receita-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos por categoria</h2>
        <div class="table-scroll">
          <table class="data-table" id="categorias-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Receita por categoria</h2>
        <div class="table-scroll">
          <table class="data-table" id="categorias-receita-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-subcategorias" class="tab-panel">
      <div class="g-tab-pills" data-subtab-group="subcategorias">
        <button type="button" class="g-tab-pill active" data-subtab-target="saldo">Saldo</button>
        <button type="button" class="g-tab-pill" data-subtab-target="gastos">Gastos</button>
        <button type="button" class="g-tab-pill" data-subtab-target="receita">Receita</button>
      </div>

      <section class="card" data-subtab="saldo">
        <div class="chart-header">
          <h2>Saldo por subcategoria ao longo do tempo</h2>
          <select id="subcategoria-chart-granularity">
            <option value="dia">Por dia</option>
            <option value="mes" selected>Acumulado por mes</option>
            <option value="trimestre">Acumulado por trimestre</option>
            <option value="semestre">Acumulado por semestre</option>
            <option value="ano">Acumulado por ano</option>
          </select>
        </div>
        <p class="subtitle" style="margin:0 0 12px;">Receita menos despesa por subcategoria e periodo. Clique numa celula ou no nome da subcategoria para filtrar por aquele recorte (confira o resultado na aba Transacoes quando quiser).</p>
        <div class="table-scroll">
          <table class="data-table" id="subcategorias-saldo-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos por subcategoria ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="subcategorias-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Receita por subcategoria ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="subcategorias-receita-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos por subcategoria</h2>
        <div class="table-scroll">
          <table class="data-table" id="subcategorias-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Receita por subcategoria</h2>
        <div class="table-scroll">
          <table class="data-table" id="subcategorias-receita-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-emprestimos" class="tab-panel">
      <div class="g-tab-pills" data-subtab-group="emprestimos">
        <button type="button" class="g-tab-pill active" data-subtab-target="saldo">Saldo</button>
        <button type="button" class="g-tab-pill" data-subtab-target="gastos">Gastos</button>
        <button type="button" class="g-tab-pill" data-subtab-target="receita">Receita</button>
      </div>

      <section class="card" data-subtab="saldo">
        <div class="chart-header">
          <h2>Saldo de Emprestimos ao longo do tempo</h2>
          <select id="emprestimo-chart-granularity">
            <option value="dia">Por dia</option>
            <option value="mes" selected>Acumulado por mes</option>
            <option value="trimestre">Acumulado por trimestre</option>
            <option value="semestre">Acumulado por semestre</option>
            <option value="ano">Acumulado por ano</option>
          </select>
        </div>
        <p class="subtitle" style="margin:0 0 12px;">Aba dedicada a gestao de emprestimos — so conta o que foi classificado como categoria "Emprestimos" (marcado automaticamente como invalido nas demais abas, pra nao entrar nos totais gerais). Agrupado por subcategoria. Clique numa celula ou no nome da subcategoria para filtrar por aquele recorte (confira o resultado na aba Transacoes quando quiser).</p>
        <div class="table-scroll">
          <table class="data-table" id="emprestimos-saldo-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos de Emprestimos ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="emprestimos-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Recebimentos de Emprestimos ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="emprestimos-receita-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos de Emprestimos</h2>
        <div class="table-scroll">
          <table class="data-table" id="emprestimos-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Recebimentos de Emprestimos</h2>
        <div class="table-scroll">
          <table class="data-table" id="emprestimos-receita-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-invalidos" class="tab-panel">
      <div class="g-tab-pills" data-subtab-group="invalidos">
        <button type="button" class="g-tab-pill active" data-subtab-target="saldo">Saldo</button>
        <button type="button" class="g-tab-pill" data-subtab-target="gastos">Gastos</button>
        <button type="button" class="g-tab-pill" data-subtab-target="receita">Receita</button>
      </div>

      <section class="card" data-subtab="saldo">
        <div class="chart-header">
          <h2>Saldo de Invalidos ao longo do tempo</h2>
          <select id="invalido-chart-granularity">
            <option value="dia">Por dia</option>
            <option value="mes" selected>Acumulado por mes</option>
            <option value="trimestre">Acumulado por trimestre</option>
            <option value="semestre">Acumulado por semestre</option>
            <option value="ano">Acumulado por ano</option>
          </select>
        </div>
        <p class="subtitle" style="margin:0 0 12px;">Aba dedicada a gestao do que fica de fora dos totais gerais — fatura de cartao duplicada, invalidado manualmente, emprestimos, etc. So conta o que tem Valido = Nao, ignorando o filtro "Valido" do topo. Agrupado por categoria. Clique numa celula ou no nome da categoria para filtrar por aquele recorte (confira o resultado na aba Transacoes quando quiser).</p>
        <div class="table-scroll">
          <table class="data-table" id="invalidos-saldo-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos Invalidos ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="invalidos-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Receitas Invalidas ao longo do tempo</h2>
        <div class="table-scroll">
          <table class="data-table" id="invalidos-receita-periodo-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="gastos">
        <h2>Gastos Invalidos</h2>
        <div class="table-scroll">
          <table class="data-table" id="invalidos-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" data-subtab="receita">
        <h2>Receitas Invalidas</h2>
        <div class="table-scroll">
          <table class="data-table" id="invalidos-receita-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-transacoes" class="tab-panel">
      <section class="card">
        <div class="transacoes-toolbar">
          <p class="subtitle" style="margin:0;">Clique num cabecalho pra ordenar, digite no campo abaixo dele pra filtrar. Edite Categoria/Subcategoria/Valido direto na tabela — os totais das outras abas se ajustam sozinhos. Todos os dados que o Pluggy devolveu para cada lancamento estao aqui (quando o banco/cartao os fornece).</p>
          <button type="button" id="export-transacoes" class="btn-export">Exportar CSV</button>
        </div>
        <div class="table-scroll">
          <table class="data-table" id="transacoes-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-pendencias" class="tab-panel">
      <section class="card">
        <p class="subtitle">Lancamentos sem historico parecido (ou lancamentos recentes ainda nao revisados por voce), com uma sugestao automatica. Ajuste a classificacao e clique em "Marcar como revisado", ou selecione varios e use o botao abaixo.</p>
        <div class="pendencias-toolbar">
          <label><input type="checkbox" id="pend-select-all"> Selecionar todos visiveis</label>
          <button type="button" id="pend-bulk-revisado" class="btn-export">Marcar selecionados como revisados (<span id="pend-selected-count">0</span>)</button>
        </div>
        <div class="table-scroll">
          <table class="data-table" id="pendencias-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

        <div id="datalists"></div>
        <footer>
          Relatorio gerado a partir da API do Pluggy. Edicoes de classificacao/valido feitas aqui sao salvas
          automaticamente no servidor — ja aparecem em qualquer dispositivo no proximo carregamento da pagina.
        </footer>
      </main>
      ${shellBottomNavHtml()}
    </div>
  </div>
  <script>
    const REPORT_DATA = ${buildClientPayload(report)};
    ${clientScript()}
    ${SHELL_SCRIPT}
    ${FILTER_BAR_SCRIPT}
    ${RESUMO_SCRIPT}
    ${PERIODO_TABLE_SCRIPT}
    ${TRANSACOES_SCRIPT}
    ${PENDENCIAS_SCRIPT}
  </script>
</body>
</html>`;
}
