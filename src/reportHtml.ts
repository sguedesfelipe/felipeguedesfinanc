import { Report } from './aggregate.js';
import { CATEGORIAS, SUBCATEGORIAS } from './classify.js';

interface ClientTransaction {
  id: number;
  transactionId: string;
  dateISO: string;
  dateLabel: string;
  dataConsideradaISO: string;
  dataConsideradaLabel: string;
  month: string;
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
  valido: boolean;
  motivoInvalido: string;
  isExpense: boolean;
  amount: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toClientTransactions(report: Report): ClientTransaction[] {
  return report.transactions.map((t, id) => ({
    id,
    transactionId: t.transactionId,
    dateISO: t.date.toISOString().slice(0, 10),
    dateLabel: t.date.toLocaleDateString('pt-BR'),
    dataConsideradaISO: t.dataConsiderada.toISOString().slice(0, 10),
    dataConsideradaLabel: t.dataConsiderada.toLocaleDateString('pt-BR'),
    month: monthKey(t.date),
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
    valido: t.valido,
    motivoInvalido: t.motivoInvalido,
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
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const monthLabel = (m) => { const [y, mm] = m.split('-'); return MONTH_NAMES[Number(mm) - 1] + '/' + y.slice(2); };

  // --- edicoes salvas neste navegador (categoria/subcategoria/valido/pendente
  // sobrevivem a um F5 ou a fechar e reabrir esta mesma pagina; nao viajam
  // pra um relatorio novo gerado depois — pra isso, exporte o CSV e mande) ---
  const STORAGE_KEY = 'pluggy-relatorio-edicoes';
  function loadSavedEdits() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }
  // Cache em memoria do blob salvo, pra "cls-input" (que dispara a cada
  // tecla digitada) nao precisar reler+reparsear o localStorage inteiro a
  // cada letra — so escreve de volta o que mudou.
  const savedEditsCache = loadSavedEdits();
  function saveEdit(t) {
    savedEditsCache[t.transactionId] = { categoria: t.categoria, subcategoria: t.subcategoria, valido: t.valido, pendente: t.pendente };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedEditsCache));
    } catch (e) {
      // localStorage indisponivel (ex.: aba anonima) — edicao so vale nesta sessao
    }
  }
  function restoreSavedEdits() {
    let n = 0;
    for (const t of state) {
      const edit = savedEditsCache[t.transactionId];
      if (!edit) continue;
      Object.assign(t, edit);
      n += 1;
    }
    return n;
  }
  const savedEditsCount = restoreSavedEdits();

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
  function propagateInstallmentGroup(t) {
    if (!t.installmentGroupKey || t.installmentLocked) return;
    const group = installmentGroups.get(t.installmentGroupKey);
    if (!group || group.length < 2) return;
    for (const sibling of group) {
      if (sibling === t) continue;
      sibling.categoria = t.categoria;
      sibling.subcategoria = t.subcategoria;
      saveEdit(sibling);
      ['categoria', 'subcategoria'].forEach((field) => {
        document.querySelectorAll('tr[data-row-id="' + sibling.id + '"] td[data-col="' + field + '"]').forEach((cell) => {
          cell.innerHTML = classificationInput(sibling, field);
        });
      });
    }
  }

  const savedNotice = document.getElementById('saved-edits-notice');
  if (savedEditsCount > 0) {
    savedNotice.textContent = savedEditsCount + ' edicao(oes) salva(s) neste navegador foram restauradas.';
    savedNotice.style.display = 'inline';
  }
  document.getElementById('clear-saved-edits').addEventListener('click', () => {
    if (!confirm('Isso apaga as edicoes salvas neste navegador (nao desfaz o que ja foi exportado ou mandado). Continuar?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  // --- filtro de periodo + dimensoes, valido para as 5 tabelas e os graficos ---
  const allDates = state.map((t) => t.dateISO).sort();
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

  function getFiltered() {
    const from = fromInput.value || minDate;
    const to = toInput.value || maxDate;
    const cat = categoriaFilter.value;
    const sub = subcategoriaFilter.value;
    const validoSel = validoFilter.value;
    const conta = contaFilter.value;
    const status = statusFilter.value;
    const tipo = tipoFilter.value;
    return state.filter((t) => {
      if (t.dateISO < from || t.dateISO > to) return false;
      if (cat && t.categoria !== cat) return false;
      if (sub && t.subcategoria !== sub) return false;
      if (validoSel === 'sim' && !t.valido) return false;
      if (validoSel === 'nao' && t.valido) return false;
      if (conta && t.account !== conta) return false;
      if (status && t.statusBanco !== status) return false;
      if (tipo === 'gasto' && !t.isExpense) return false;
      if (tipo === 'receita' && t.isExpense) return false;
      return true;
    });
  }

  function findTransaction(id) {
    return state.find((t) => t.id === Number(id));
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
    renderResumo(getFiltered());
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
  // mes, trimestre, semestre ou ano, conforme o seletor de granularidade ---
  function bucketKey(t, granularity) {
    const [y, m] = t.dateISO.split('-');
    switch (granularity) {
      case 'dia': return t.dateISO;
      case 'trimestre': return y + '-T' + Math.ceil(Number(m) / 3);
      case 'semestre': return y + '-S' + Math.ceil(Number(m) / 6);
      case 'ano': return y;
      default: return t.month;
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

  function computeCategorias(filtered) {
    const map = new Map();
    for (const t of filtered) {
      if (!t.valido || !t.isExpense) continue;
      const key = t.categoria || '(sem categoria)';
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
  function renderResumo(filtered) {
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

    renderTimeSeriesChart(filtered);
    renderCategoriasChart(filtered);
    renderCategoriaTimeSeriesChart(filtered);
  }

  const granularitySelect = document.getElementById('chart-granularity');
  function renderTimeSeriesChart(filtered) {
    const granularity = granularitySelect.value;
    const buckets = computeTimeSeries(filtered, granularity);
    const max = Math.max(1, ...buckets.map((b) => b.expenses));
    document.getElementById('monthly-chart').innerHTML =
      '<div class="bar-chart">' +
      buckets
        .map(
          (b) =>
            '<div class="bar-col"><div class="bar-track"><div class="bar-fill" style="height:' +
            Math.round((b.expenses / max) * 100) +
            '%" title="' + bucketLabel(b.key, granularity) + ': ' + brl(b.expenses) + '"></div></div><div class="bar-label">' + bucketLabel(b.key, granularity) + '</div></div>'
        )
        .join('') +
      '</div>';
  }
  granularitySelect.addEventListener('change', () => renderTimeSeriesChart(getFiltered()));

  function renderCategoriasChart(filtered) {
    const categorias = computeCategorias(filtered);
    const catMax = Math.max(1, ...categorias.map((c) => c.total));
    document.getElementById('categorias-chart').innerHTML =
      '<div class="hbar-chart">' +
      categorias
        .map(
          (c) =>
            '<div class="hbar-row"><div class="hbar-label">' + esc(c.category) + '</div><div class="hbar-track"><div class="hbar-fill" style="width:' +
            Math.max(2, Math.round((c.total / catMax) * 100)) + '%" title="' + esc(c.category) + ': ' + brl(c.total) + '"></div></div><div class="hbar-value">' +
            brl(c.total) + '</div></div>'
        )
        .join('') +
      '</div>';
  }

  // --- grafico "Gastos por categoria ao longo do tempo": uma barra
  // empilhada por periodo, uma cor por categoria. So as categorias com mais
  // gasto no periodo filtrado ganham cor propria (limite de 7, a mesma
  // ordem categorica validada do resto do relatorio); o restante cai em
  // "Outros" pra nao estourar o numero de cores distinguiveis num grafico. ---
  const CATEGORY_SERIES_COLORS = [
    'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
    'var(--series-5)', 'var(--series-6)', 'var(--series-7)',
  ];
  const OUTROS_COLOR = 'var(--baseline)';

  function computeCategoriaTimeSeries(filtered, granularity) {
    const totalsByCategory = new Map();
    const bucketMap = new Map();
    for (const t of filtered) {
      if (!t.valido || !t.isExpense) continue;
      const cat = t.categoria || '(sem categoria)';
      totalsByCategory.set(cat, (totalsByCategory.get(cat) || 0) + t.amount);
      const key = bucketKey(t, granularity);
      const byCat = bucketMap.get(key) || new Map();
      byCat.set(cat, (byCat.get(cat) || 0) + t.amount);
      bucketMap.set(key, byCat);
    }

    const topCategories = [...totalsByCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, CATEGORY_SERIES_COLORS.length)
      .map(([cat]) => cat);
    const hasOutros = totalsByCategory.size > topCategories.length;
    const series = hasOutros ? topCategories.concat(['Outros']) : topCategories;
    const colors = topCategories.map((_, i) => CATEGORY_SERIES_COLORS[i]);
    if (hasOutros) colors.push(OUTROS_COLOR);

    const buckets = [...bucketMap.keys()].sort().map((key) => {
      const byCat = bucketMap.get(key);
      const values = topCategories.map((cat) => byCat.get(cat) || 0);
      if (hasOutros) {
        let outros = 0;
        byCat.forEach((v, cat) => { if (!topCategories.includes(cat)) outros += v; });
        values.push(outros);
      }
      return { key, values, total: values.reduce((a, b) => a + b, 0) };
    });

    return { series, colors, buckets };
  }

  const categoriaGranularitySelect = document.getElementById('categoria-chart-granularity');
  function renderCategoriaTimeSeriesChart(filtered) {
    const granularity = categoriaGranularitySelect.value;
    const { series, colors, buckets } = computeCategoriaTimeSeries(filtered, granularity);
    const max = Math.max(1, ...buckets.map((b) => b.total));

    document.getElementById('categorias-timeseries-chart').innerHTML =
      '<div class="stack-chart">' +
      buckets
        .map((b) => {
          const segs = b.values
            .map((v, i) => {
              if (v <= 0) return '';
              const pct = Math.max(0.6, (v / max) * 100);
              return '<div class="stack-seg" style="height:' + pct + '%;background:' + colors[i] +
                '" title="' + esc(series[i]) + ' — ' + bucketLabel(b.key, granularity) + ': ' + brl(v) + '"></div>';
            })
            .join('');
          return '<div class="stack-col"><div class="stack-track">' + segs + '</div><div class="stack-label">' +
            bucketLabel(b.key, granularity) + '</div></div>';
        })
        .join('') +
      '</div>';

    document.getElementById('categorias-timeseries-legend').innerHTML = series
      .map((cat, i) => '<div class="stack-legend-item"><span class="stack-legend-swatch" style="background:' +
        colors[i] + '"></span>' + esc(cat) + '</div>')
      .join('');
  }
  categoriaGranularitySelect.addEventListener('change', () => renderCategoriaTimeSeriesChart(getFiltered()));

  // --- tabelas genericas: cabecalho clicavel pra ordenar + filtro por coluna ---
  const TX_COLUMNS = [
    { key: 'transactionId', label: 'ID', value: (t) => t.transactionId },
    { key: 'dateISO', label: 'Data', value: (t) => t.dateISO, render: (t) => t.dateLabel },
    { key: 'dataConsideradaISO', label: 'DataConsiderada', value: (t) => t.dataConsideradaISO, render: (t) => t.dataConsideradaLabel },
    { key: 'account', label: 'Conta', value: (t) => t.account },
    { key: 'description', label: 'Descricao', value: (t) => t.description },
    { key: 'categoria', label: 'Categoria', value: (t) => t.categoria, render: (t) => classificationInput(t, 'categoria') },
    { key: 'subcategoria', label: 'Subcategoria', value: (t) => t.subcategoria, render: (t) => classificationInput(t, 'subcategoria') },
    { key: 'pendente', label: 'Pendente', value: (t) => (t.pendente ? 'Sim' : 'Nao'), render: (t) => (t.pendente ? '<span class="badge-pend">pendente</span>' : '') },
    { key: 'valido', label: 'Valido?', value: (t) => (t.valido ? 'Sim' : 'Nao'), render: (t) => validoCheckbox(t) },
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
    { key: 'amount', label: 'Valor', value: (t) => t.amount, type: 'currency' },
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
    'categorias-table': { columns: CAT_COLUMNS, rows: () => computeCategorias(getFiltered()) },
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
      renderCategoriasChart(getFiltered());
      renderCategoriaTimeSeriesChart(getFiltered());
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
    // evita reescrever o localStorage e varrer o DOM das outras linhas a
    // cada letra digitada na classificacao da parcela lider.
    if (el.classList && el.classList.contains('cls-input')) {
      const t = findTransaction(el.dataset.id);
      if (t) propagateInstallmentGroup(t);
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
    renderResumo(getFiltered());
    renderTable('categorias-table');
    renderTable('merchants-table');
    renderTable('accounts-table');
    renderTable('pendencias-table');
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

  function renderAll() {
    const filtered = getFiltered();
    renderResumo(filtered);
    Object.keys(TABLE_DEFS).forEach((tableId) => renderTable(tableId));
  }

  document.getElementById('filter-apply').addEventListener('click', renderAll);
  fromInput.addEventListener('change', renderAll);
  toInput.addEventListener('change', renderAll);
  document.getElementById('filter-clear').addEventListener('click', () => {
    fromInput.value = minDate;
    toInput.value = maxDate;
    categoriaFilter.value = '';
    resetSubcategoriaOptions('');
    SIMPLE_DIMENSION_FILTERS.forEach((el) => (el.value = ''));
    renderAll();
  });

  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.toggle('active', btn === b));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    })
  );

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
    --series-2:       #eb6834;
    --series-3:       #1baf7a;
    --series-4:       #eda100;
    --series-5:       #e87ba4;
    --series-6:       #008300;
    --series-7:       #4a3aa7;
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
      --series-2:       #d95926;
      --series-3:       #199e70;
      --series-4:       #c98500;
      --series-5:       #d55181;
      --series-6:       #008300;
      --series-7:       #9085e9;
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
    padding-top: 8px;
    overflow-x: auto;
  }
  .bar-col { flex: 1 1 28px; min-width: 28px; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 6px; }
  .bar-track { width: 100%; height: 100%; display: flex; align-items: flex-end; }
  .bar-fill { width: 100%; background: var(--series-1); border-radius: 4px 4px 0 0; min-height: 2px; }
  .bar-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }

  .hbar-chart { display: flex; flex-direction: column; gap: 10px; }
  .hbar-row { display: grid; grid-template-columns: 200px 1fr 110px; align-items: center; gap: 10px; }
  .hbar-label { font-size: 13px; color: var(--text-secondary); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hbar-track { background: var(--series-1-soft); border-radius: 4px; height: 14px; }
  .hbar-fill { background: var(--series-1); height: 100%; border-radius: 4px; min-width: 4px; }
  .hbar-value { font-size: 13px; color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .stack-chart {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    height: 220px;
    border-bottom: 1px solid var(--baseline);
    padding-top: 8px;
    overflow-x: auto;
  }
  .stack-col { flex: 1 1 28px; min-width: 28px; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 6px; }
  .stack-track { width: 100%; height: 100%; display: flex; flex-direction: column-reverse; gap: 2px; }
  .stack-seg { width: 100%; min-height: 2px; border-radius: 2px; }
  .stack-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
  .stack-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 14px; font-size: 12px; color: var(--text-secondary); }
  .stack-legend-item { display: flex; align-items: center; gap: 6px; }
  .stack-legend-swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

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
</style>
</head>
<body class="viz-root">
  <div class="wrap">
    <h1>Relatorio de gastos</h1>
    <p class="subtitle">Dados buscados no Pluggy de ${dateFrom} a ${dateTo} &middot; Gerado em ${generatedAt}</p>

    <div class="filter-bar">
      <label>De <input type="date" id="filter-from"></label>
      <label>Ate <input type="date" id="filter-to"></label>
      <label>Categoria <select id="filter-categoria"><option value="">Todas</option></select></label>
      <label>Subcategoria <select id="filter-subcategoria"><option value="">Todas</option></select></label>
      <label>Valido <select id="filter-valido"><option value="">Todos</option><option value="sim">Sim</option><option value="nao">Nao</option></select></label>
      <label>Conta <select id="filter-conta"><option value="">Todas</option></select></label>
      <label>Status (banco) <select id="filter-status"><option value="">Todos</option></select></label>
      <label>Tipo <select id="filter-tipo"><option value="">Todos</option><option value="gasto">Gasto</option><option value="receita">Receita</option></select></label>
      <button type="button" id="filter-apply" class="btn-export">Aplicar filtro</button>
      <button type="button" id="filter-clear">Limpar filtro</button>
      <span class="filter-hint">Vale para todas as abas e graficos.</span>
      <span class="filter-hint" id="saved-edits-notice" style="display:none;"></span>
    </div>

    <div class="tab-bar">
      <button class="tab-btn active" data-tab="resumo">Resumo</button>
      <button class="tab-btn" data-tab="categorias">Categorias</button>
      <button class="tab-btn" data-tab="transacoes">Transacoes</button>
      <button class="tab-btn" data-tab="pendencias">Pendencias de Classificacao (<span id="pend-tab-count">0</span>)</button>
    </div>

    <div id="tab-resumo" class="tab-panel active">
      <section class="kpi-row">
        <div class="kpi-tile">
          <div class="kpi-label">Total de gastos</div>
          <div class="kpi-value" id="kpi-expenses"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Total de receitas</div>
          <div class="kpi-value" id="kpi-income"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Saldo no periodo</div>
          <div class="kpi-value" id="kpi-net"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Transacoes no periodo</div>
          <div class="kpi-value" id="kpi-count"></div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-label">Pendentes de classificacao</div>
          <div class="kpi-value" id="kpi-pendentes"></div>
        </div>
      </section>

      <section class="card" style="margin-top:24px;">
        <div class="chart-header">
          <h2>Gastos ao longo do tempo</h2>
          <select id="chart-granularity">
            <option value="dia">Por dia</option>
            <option value="mes" selected>Acumulado por mes</option>
            <option value="trimestre">Acumulado por trimestre</option>
            <option value="semestre">Acumulado por semestre</option>
            <option value="ano">Acumulado por ano</option>
          </select>
        </div>
        <div id="monthly-chart"></div>
      </section>

      <section class="card">
        <h2>Maiores gastos (por descricao)</h2>
        <div class="table-scroll">
          <table class="data-table" id="merchants-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Contas conectadas</h2>
        <div class="table-scroll">
          <table class="data-table" id="accounts-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>

    <div id="tab-categorias" class="tab-panel">
      <section class="card">
        <h2>Gastos por categoria</h2>
        <div id="categorias-chart"></div>
      </section>
      <section class="card">
        <div class="chart-header">
          <h2>Gastos por categoria ao longo do tempo</h2>
          <select id="categoria-chart-granularity">
            <option value="dia">Por dia</option>
            <option value="mes" selected>Acumulado por mes</option>
            <option value="trimestre">Acumulado por trimestre</option>
            <option value="semestre">Acumulado por semestre</option>
            <option value="ano">Acumulado por ano</option>
          </select>
        </div>
        <div id="categorias-timeseries-chart"></div>
        <div id="categorias-timeseries-legend" class="stack-legend"></div>
      </section>
      <section class="card">
        <div class="table-scroll">
          <table class="data-table" id="categorias-table">
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
      Relatorio gerado localmente a partir da API do Pluggy. Edicoes de classificacao/valido feitas aqui sao salvas
      automaticamente neste navegador (sobrevivem a fechar e reabrir a pagina) — mas nao viajam sozinhas pra um
      relatorio novo gerado depois. Pra isso, use "Exportar CSV" na aba Transacoes e mande o arquivo de volta.
      <button type="button" id="clear-saved-edits" class="link-btn">Limpar edicoes salvas neste navegador</button>
    </footer>
  </div>
  <script>
    const REPORT_DATA = ${buildClientPayload(report)};
    ${clientScript()}
  </script>
</body>
</html>`;
}
