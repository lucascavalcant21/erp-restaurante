// CMV REAL — F2.4C. Motor puro (sem banco): recebe inventários fechados,
// compras e faturamento já lidos e devolve números AUDITÁVEIS.
//
//   CMV R$ = ESTOQUE INICIAL + COMPRAS DO PERÍODO − ESTOQUE FINAL
//   CMV %  = CMV R$ ÷ FATURAMENTO DO MESMO PERÍODO × 100
//
// Regras (não negociáveis):
// - NÃO INVENTAR: dado ausente nunca vira zero. Faltou inventário inicial ou
//   final fechado, ou um produto sem contagem numa das pontas → NÃO APURADO,
//   com o motivo. Sem faturamento → CMV % NÃO APURADO (o CMV R$ pode existir).
// - COMPRA ≠ CMV: compra entra na fórmula; conta a pagar não entra; o "cmv"
//   do DRE antigo não é usado.
// - Inventário vale o que valia no fechamento (valor_total congelado); nunca
//   é revalorizado pelo custo atual.
// - Compra cancelada não entra; só compras CONFIRMADAS com data de entrada
//   (recebimento, ou a da compra) dentro da janela.
// Tudo o que é limite/convenção fica em CONFIG_CMV (um lugar só, documentado).

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const r6 = (n) => Math.round(Number(n) * 1e6) / 1e6;
const soma = (xs, f) => xs.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const p2 = (n) => String(n).padStart(2, "0");
export function somarDiasIso(iso, dias) {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())}`;
}
const diasEntre = (de, ateExcl) => Math.round((Date.parse(`${ateExcl}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);

/**
 * Convenções e limites — ÚNICO lugar. A tela mostra os limites dos alertas.
 * momentoPorTipo: quando a contagem acontece no dia. "abertura" = antes das
 *   vendas e entregas do dia (o dia entra no período SEGUINTE à contagem);
 *   "fechamento" = depois do último movimento (o dia entra no período ANTERIOR).
 *   Inicial e semanal: abertura (ex.: 08:00). Fechamento do mês: fim do dia,
 *   para outubro ir de 01/10 a 31/10 inteiro.
 * grupoPorDepartamento: o que é CMV. Cozinha/bar/ambos = mercadoria;
 *   embalagens = embalagem (entra no CMV, mostrada à parte); limpeza =
 *   consumo operacional (fora do CMV). Departamento desconhecido = mercadoria.
 */
export const CONFIG_CMV = {
  momentoPorTipo: { inicial: "abertura", intermediaria: "abertura", final: "fechamento" },
  grupoPorDepartamento: { cozinha: "mercadoria", bar: "mercadoria", ambos: "mercadoria", embalagens: "embalagem", limpeza: "operacional" },
  gruposNoCmv: ["mercadoria", "embalagem"],
  alertas: {
    variacaoPrecoPct: 10,        // preço da compra × média das compras anteriores do produto
    variacaoConsumoPct: 30,      // consumo do produto no período × média dos períodos anteriores
    variacaoCompraPct: 30,       // quanto comprou do produto × média dos períodos anteriores
    estoqueSobreConsumo: 2,      // estoque final ≥ 2 × consumo médio por período
    periodosParaMedia: 2,        // mínimo de períodos apurados para usar média
    janelaPeriodos: 8,           // últimos N períodos na média
  },
  baixoGiroPct: 10,              // consumo do período ≤ 10% do disponível (inicial + compras)
};

export const ROTULO_GRUPO = { mercadoria: "Mercadoria (alimentos e bebidas)", embalagem: "Embalagens", operacional: "Consumo operacional (fora do CMV)" };
export const grupoDoInsumo = (insumo, cfg = CONFIG_CMV) => cfg.grupoPorDepartamento[String(insumo?.departamento || "").toLowerCase()] || "mercadoria";
const ROT_BASE = { g: "kg", ml: "L", un: "un" };
const FATOR_BASE = { g: 1000, ml: 1000, un: 1 };
/** Quantidade em unidade base → unidade de exibição (g→kg, ml→L). */
export const exibirQtd = (qBase, base) => (qBase == null ? null : r3(Number(qBase) / (FATOR_BASE[base] || 1)));
export const rotuloBase = (base) => ROT_BASE[base] || base || "un";

// ─── Contagens → fronteiras e períodos ───────────────────────────────────────
/** Fronteira de uma contagem fechada: o primeiro dia que fica DEPOIS dela. */
export function fronteiraDaContagem(c, cfg = CONFIG_CMV) {
  const momento = cfg.momentoPorTipo[c.tipo] || "abertura";
  const data = String(c.data_referencia).slice(0, 10);
  return { data: momento === "fechamento" ? somarDiasIso(data, 1) : data, momento };
}

/**
 * Contagens fechadas da UNIDADE INTEIRA, uma por fronteira (se duas caem no
 * mesmo momento — ex.: fechamento de 31/10 e inicial de 01/11 — vale a última
 * fechada, e a outra aparece como "mesmo momento").
 */
export function contagensValidas(contagens, cfg = CONFIG_CMV) {
  const elegiveis = (contagens || []).filter((c) => c.status === "fechada" && !c.estoque_id && cfg.momentoPorTipo[c.tipo]);
  const porFronteira = new Map();
  for (const c of elegiveis) {
    const f = fronteiraDaContagem(c, cfg);
    const atual = porFronteira.get(f.data);
    if (!atual || String(c.fechada_em || "") > String(atual.c.fechada_em || "")) porFronteira.set(f.data, { c, f, mesmoMomento: atual ? [...atual.mesmoMomento, atual.c.id] : [] });
    else atual.mesmoMomento.push(c.id);
  }
  return [...porFronteira.values()].sort((a, b) => a.f.data.localeCompare(b.f.data)).map(({ c, f, mesmoMomento }) => ({ ...c, fronteira: f.data, momento: f.momento, mesmoMomento }));
}

/**
 * Períodos entre contagens consecutivas (a mesma contagem fecha um e abre o
 * próximo) + o período em andamento depois da última. Janela [de, ateExclusivo).
 */
export function periodosEntreContagens(contagens, hoje, cfg = CONFIG_CMV) {
  const v = contagensValidas(contagens, cfg);
  const lista = [];
  for (let i = 0; i < v.length - 1; i++) {
    lista.push({ id: `${v[i].id}>${v[i + 1].id}`, inicio: v[i], fim: v[i + 1], de: v[i].fronteira, ateExclusivo: v[i + 1].fronteira, emAndamento: false });
  }
  if (v.length) {
    const ult = v[v.length - 1];
    lista.push({ id: `${ult.id}>`, inicio: ult, fim: null, de: ult.fronteira, ateExclusivo: somarDiasIso(hoje, 1), emAndamento: true });
  }
  return lista;
}

/** Período por datas (filtros rápidos): só é apurável se começar e terminar exatamente em contagens fechadas. */
export function periodoPorDatas(de, ateInclusivo, contagens, cfg = CONFIG_CMV) {
  const v = contagensValidas(contagens, cfg);
  const ateExclusivo = somarDiasIso(ateInclusivo, 1);
  const inicio = v.find((c) => c.fronteira === de) || null;
  const fim = v.find((c) => c.fronteira === ateExclusivo) || null;
  return { id: `datas:${de}:${ateInclusivo}`, inicio, fim, de, ateExclusivo, emAndamento: false, porDatas: true };
}

// ─── Faturamento ─────────────────────────────────────────────────────────────
/**
 * Faturamento de uma janela a partir de valores DIÁRIOS de uma fonte oficial.
 * dias: [{ data, valor }]. Se faltar algum dia da janela → null (NÃO APURADO),
 * nunca zero. Fonte ausente → null com o motivo.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function faturamentoDaJanela(de, ateExclusivo, fonte) {
  if (!ISO.test(String(de)) || !ISO.test(String(ateExclusivo)) || de > ateExclusivo || diasEntre(de, ateExclusivo) > 3700) {
    return { valor: null, fonte: fonte?.nome || null, motivo: "Período inválido para o faturamento.", diasFaltando: [] };
  }
  if (!fonte || !fonte.disponivel) return { valor: null, fonte: fonte?.nome || null, motivo: fonte?.motivo || "Fonte oficial do faturamento ainda não definida.", diasFaltando: [] };
  const porDia = new Map((fonte.dias || []).map((d) => [String(d.data).slice(0, 10), Number(d.valor)]));
  const faltando = [];
  let total = 0;
  for (let d = de; d < ateExclusivo; d = somarDiasIso(d, 1)) {
    if (!porDia.has(d)) faltando.push(d); else total += porDia.get(d);
  }
  if (faltando.length) {
    return { valor: null, fonte: fonte.nome, motivo: `Faturamento sem registro em ${faltando.length} dia(s) do período.`, diasFaltando: faltando };
  }
  return { valor: r2(total), fonte: fonte.nome, motivo: null, diasFaltando: [] };
}

// ─── Compras da janela ───────────────────────────────────────────────────────
const dataEntrada = (c) => String(c.data_recebimento || c.data_compra).slice(0, 10);
/** Compras confirmadas na janela; cada item com o valor rateado de frete/desconto (igual à vw_compras e ao custo médio). */
export function comprasDaJanela(compras, itens, de, ateExclusivo) {
  const dentro = (compras || []).filter((c) => { const d = dataEntrada(c); return d >= de && d < ateExclusivo; });
  const confirmadas = dentro.filter((c) => c.status === "confirmada");
  const ids = new Set(confirmadas.map((c) => c.id));
  const porCompra = new Map(confirmadas.map((c) => [c.id, c]));
  const its = (itens || []).filter((i) => ids.has(i.compra_id)).map((i) => {
    const c = porCompra.get(i.compra_id);
    const valorItens = Number(c.valor_itens ?? 0);
    const fator = valorItens > 0 ? Number(c.valor_total) / valorItens : 1;
    const qtd = Number(i.quantidade_base ?? Number(i.quantidade_embalagens) * Number(i.conteudo_por_embalagem));
    return { ...i, quantidade_base: qtd, valor_rateado: r2(Number(i.valor_total) * fator), data: dataEntrada(c), fornecedor_id: c.fornecedor_id };
  });
  return { confirmadas, canceladas: dentro.filter((c) => c.status === "cancelada"), rascunhos: dentro.filter((c) => c.status === "rascunho"), itens: its };
}

// ─── Apuração de um período ──────────────────────────────────────────────────
function linhasDaContagem(itens) {
  const m = new Map();
  for (const i of itens || []) {
    const a = m.get(i.insumo_id) || { q: 0, v: 0, bases: new Set() };
    a.q += Number(i.quantidade_contada) || 0;
    a.v += Number(i.valor_total ?? Number(i.quantidade_contada) * Number(i.custo_unitario)) || 0;
    a.bases.add(i.unidade_base);
    m.set(i.insumo_id, a);
  }
  return m;
}

/**
 * Apura um período. Devolve números E a explicação de cada um:
 *   status: "apurado" | "nao_apurado" | "em_andamento"
 *   motivos: por que não apurou (texto para a tela)
 *   ei / compras / ef / cmv / faturamento / cmvPct + produtos (por insumo)
 */
export function apurarPeriodo(periodo, { itensPorContagem, compras, comprasItens, insumoPorId = new Map(), fonteFaturamento = null, cfg = CONFIG_CMV }) {
  const motivos = [];
  const ini = periodo.inicio; const fim = periodo.fim;
  if (!ini) motivos.push(periodo.porDatas ? `Não há inventário fechado no início do período (${fmtDia(periodo.de)}).` : "Inventário inicial não fechado.");
  if (!fim) motivos.push(periodo.emAndamento ? "Aguardando a próxima contagem de estoque." : periodo.porDatas ? `Não há inventário fechado no fim do período (${fmtDia(somarDiasIso(periodo.ateExclusivo, -1))}).` : "Inventário final ainda não realizado.");
  const cp = comprasDaJanela(compras, comprasItens, periodo.de, periodo.ateExclusivo);
  const ei = linhasDaContagem(ini ? itensPorContagem.get(ini.id) : []);
  const ef = linhasDaContagem(fim ? itensPorContagem.get(fim.id) : []);
  const cq = new Map();
  for (const i of cp.itens) {
    const a = cq.get(i.insumo_id) || { q: 0, v: 0, bases: new Set() };
    a.q += i.quantidade_base; a.v += i.valor_rateado; a.bases.add(i.unidade_base);
    cq.set(i.insumo_id, a);
  }
  const ids = new Set([...ei.keys(), ...ef.keys(), ...cq.keys()]);
  const produtos = [];
  for (const id of ids) {
    const ins = insumoPorId.get(id);
    const e = ei.get(id); const f = ef.get(id); const c = cq.get(id);
    const bases = new Set([...(e?.bases || []), ...(f?.bases || []), ...(c?.bases || [])]);
    let cobertura = "ok";
    if (bases.size > 1) cobertura = "unidade_incompativel";
    else if (ini && fim && !f && ((e?.q || 0) > 0 || (c?.q || 0) > 0)) cobertura = "sem_contagem_final";
    else if (ini && fim && !e && (f?.q || 0) > 0) cobertura = "sem_contagem_inicial";
    const base = [...bases][0] || "un";
    const p = {
      insumo_id: id, nome: ins?.nome || "(produto removido)", categoria: ins?.categoria || "Sem categoria", grupo: grupoDoInsumo(ins, cfg), unidade_base: base,
      ei_q: e ? r3(e.q) : null, ei_v: e ? r2(e.v) : null, compras_q: r3(c?.q || 0), compras_v: r2(c?.v || 0), ef_q: f ? r3(f.q) : null, ef_v: f ? r2(f.v) : null,
      cobertura,
    };
    if (cobertura === "ok" && ini && fim) {
      p.consumo_q = r3((e?.q || 0) + p.compras_q - (f?.q || 0));
      p.consumo_v = r2((e?.v || 0) + p.compras_v - (f?.v || 0));
    } else { p.consumo_q = null; p.consumo_v = null; }
    produtos.push(p);
  }
  const noCmv = (p) => cfg.gruposNoCmv.includes(p.grupo);
  const problemas = produtos.filter((p) => noCmv(p) && p.cobertura !== "ok");
  if (ini && fim && problemas.length) {
    const nomes = (tipo) => problemas.filter((p) => p.cobertura === tipo).map((p) => p.nome);
    const sf = nomes("sem_contagem_final"); const si = nomes("sem_contagem_inicial"); const ui = nomes("unidade_incompativel");
    if (sf.length) motivos.push(`${sf.length} produto(s) tinham estoque inicial ou foram comprados e não foram contados no inventário final: ${listar(sf)}.`);
    if (si.length) motivos.push(`${si.length} produto(s) contados no inventário final não foram contados no inicial: ${listar(si)}.`);
    if (ui.length) motivos.push(`${ui.length} produto(s) com unidades diferentes entre contagens e compras: ${listar(ui)}.`);
  }
  const porGrupo = (sel) => Object.fromEntries(["mercadoria", "embalagem", "operacional"].map((g) => [g, r2(soma(produtos.filter((p) => p.grupo === g), sel))]));
  const valorEi = ini ? r2(soma([...ei.values()], (x) => x.v)) : null;
  const valorEf = fim ? r2(soma([...ef.values()], (x) => x.v)) : null;
  const valorCompras = r2(soma(cp.confirmadas, (c) => c.valor_total));
  const eiG = porGrupo((p) => p.ei_v); const efG = porGrupo((p) => p.ef_v); const cG = porGrupo((p) => p.compras_v);
  const apurado = !!(ini && fim) && !problemas.length;
  const emAndamento = !fim && periodo.emAndamento;
  const cmvGrupo = (g) => (apurado ? r2(eiG[g] + cG[g] - efG[g]) : null);
  const cmvValor = apurado ? r2(cfg.gruposNoCmv.reduce((s, g) => s + cmvGrupo(g), 0)) : null;
  // valor parcial: só produtos com contagem nas duas pontas (para a tela explicar; NÃO é o CMV)
  const parcial = ini && fim && problemas.length ? r2(soma(produtos.filter((p) => noCmv(p) && p.cobertura === "ok"), (p) => p.consumo_v)) : null;
  const fat = faturamentoDaJanela(periodo.de, periodo.ateExclusivo, fonteFaturamento);
  let cmvPct = null; let motivoPct = null;
  if (cmvValor == null) motivoPct = "CMV R$ não apurado.";
  else if (fat.valor == null) motivoPct = fat.motivo;
  else if (!(fat.valor > 0)) motivoPct = "Faturamento do período é zero: não há base para o percentual.";
  else cmvPct = r2((cmvValor / fat.valor) * 100);
  return {
    periodo: { id: periodo.id, de: periodo.de, ate: somarDiasIso(periodo.ateExclusivo, -1), ateExclusivo: periodo.ateExclusivo, dias: diasEntre(periodo.de, periodo.ateExclusivo), porDatas: !!periodo.porDatas },
    status: apurado ? "apurado" : emAndamento ? "em_andamento" : "nao_apurado",
    motivos,
    ei: { valor: valorEi, porGrupo: ini ? eiG : null, contagem: ini || null },
    compras: { valor: valorCompras, porGrupo: cG, confirmadas: cp.confirmadas, canceladas: cp.canceladas, rascunhos: cp.rascunhos, itens: cp.itens },
    ef: { valor: valorEf, porGrupo: fim ? efG : null, contagem: fim || null },
    cmv: { valor: cmvValor, mercadoria: cmvGrupo("mercadoria"), embalagem: cmvGrupo("embalagem"), operacional: apurado ? r2(eiG.operacional + cG.operacional - efG.operacional) : null, parcial },
    faturamento: fat,
    cmvPct, motivoPct,
    produtos,
  };
}
const fmtDia = (iso) => { const [a, m, d] = String(iso).split("-"); return `${d}/${m}/${a}`; };
const listar = (nomes) => (nomes.length > 5 ? `${nomes.slice(0, 5).join(", ")} e mais ${nomes.length - 5}` : nomes.join(", "));

// ─── Análises ────────────────────────────────────────────────────────────────
/** Análise das compras da janela (não precisa de inventário). Rankings sem misturar unidades. */
export function analiseCompras(ap, { insumoPorId = new Map(), fornecedorPorId = new Map() } = {}) {
  const { confirmadas, itens } = ap.compras;
  const porInsumo = new Map();
  for (const i of itens) {
    const a = porInsumo.get(i.insumo_id) || { insumo_id: i.insumo_id, nome: insumoPorId.get(i.insumo_id)?.nome || i.descricao_snapshot, unidade_base: i.unidade_base, q: 0, valor: 0, valorItem: 0 };
    a.q += i.quantidade_base; a.valor += i.valor_rateado; a.valorItem += Number(i.valor_total);
    porInsumo.set(i.insumo_id, a);
  }
  const produtos = [...porInsumo.values()].map((p) => ({ ...p, q: r3(p.q), valor: r2(p.valor), precoMedio: p.q > 0 ? r6((p.valorItem / p.q) * (FATOR_BASE[p.unidade_base] || 1)) : null }));
  const porUnidade = (base) => produtos.filter((p) => p.unidade_base === base);
  const forn = new Map();
  for (const c of confirmadas) {
    const k = c.fornecedor_id || "-";
    const a = forn.get(k) || { fornecedor_id: c.fornecedor_id, nome: fornecedorPorId.get(c.fornecedor_id)?.nome || "Fornecedor não informado", valor: 0, compras: 0 };
    a.valor = r2(a.valor + Number(c.valor_total)); a.compras += 1; forn.set(k, a);
  }
  return {
    total: ap.compras.valor, quantidadeCompras: confirmadas.length, quantidadeItens: itens.length,
    ticketMedio: confirmadas.length ? r2(ap.compras.valor / confirmadas.length) : null,
    fornecedores: [...forn.values()].sort((a, b) => b.valor - a.valor),
    porValor: [...produtos].sort((a, b) => b.valor - a.valor),
    // quantidade e preço por unidade: rankings SEPARADOS por kg, L e un
    porQuantidade: Object.fromEntries(["g", "ml", "un"].map((b) => [b, porUnidade(b).sort((a, z) => z.q - a.q)])),
    maisCaros: Object.fromEntries(["g", "ml", "un"].map((b) => [b, porUnidade(b).filter((p) => p.precoMedio != null).sort((a, z) => z.precoMedio - a.precoMedio)])),
  };
}

/** Consumo aparente por produto (inicial + compras − final), por quantidade (por unidade) e por valor. */
export function maisConsumidos(ap) {
  const ok = ap.produtos.filter((p) => p.consumo_q != null);
  return {
    porValor: [...ok].sort((a, b) => b.consumo_v - a.consumo_v),
    porQuantidade: Object.fromEntries(["g", "ml", "un"].map((b) => [b, ok.filter((p) => p.unidade_base === b).sort((a, z) => z.consumo_q - a.consumo_q)])),
    negativos: ok.filter((p) => p.consumo_q < -0.0005),   // contou mais no fim do que tinha + comprou: erro de contagem ou entrada sem registro
  };
}

/** CMV por categoria do cadastro e por grupo (mercadoria / embalagem / operacional). */
export function porCategoria(ap, cfg = CONFIG_CMV) {
  if (ap.status !== "apurado") return null;
  const cat = new Map();
  for (const p of ap.produtos.filter((x) => cfg.gruposNoCmv.includes(x.grupo) && x.consumo_v != null)) {
    cat.set(p.categoria, r2((cat.get(p.categoria) || 0) + p.consumo_v));
  }
  const total = ap.cmv.valor;
  return {
    categorias: [...cat.entries()].map(([nome, valor]) => ({ nome, valor, pct: total ? r2((valor / total) * 100) : null })).sort((a, b) => b.valor - a.valor),
    grupos: ["mercadoria", "embalagem", "operacional"].map((g) => ({ grupo: g, rotulo: ROTULO_GRUPO[g], valor: g === "operacional" ? ap.cmv.operacional : ap.cmv[g], noCmv: cfg.gruposNoCmv.includes(g) })),
  };
}

/**
 * Variação de preço por produto: cada compra confirmada (preço do item, sem
 * frete) contra a compra anterior do mesmo produto. histórico completo.
 */
export function variacoesPreco(compras, itens, { ateExclusivo = null } = {}) {
  const conf = new Map((compras || []).filter((c) => c.status === "confirmada").map((c) => [c.id, c]));
  const linhas = (itens || []).filter((i) => conf.has(i.compra_id)).map((i) => {
    const c = conf.get(i.compra_id);
    const q = Number(i.quantidade_base ?? Number(i.quantidade_embalagens) * Number(i.conteudo_por_embalagem));
    return { insumo_id: i.insumo_id, unidade_base: i.unidade_base, data: dataEntrada(c), compra_id: c.id, fornecedor_id: c.fornecedor_id,
      preco: q > 0 ? r6((Number(i.valor_total) / q) * (FATOR_BASE[i.unidade_base] || 1)) : null, criado: c.confirmada_em || c.created_at || "" };
  }).filter((l) => l.preco != null && (!ateExclusivo || l.data < ateExclusivo))
    .sort((a, b) => (a.data === b.data ? String(a.criado).localeCompare(String(b.criado)) : a.data.localeCompare(b.data)));
  const porInsumo = new Map();
  for (const l of linhas) {
    const k = `${l.insumo_id}|${l.unidade_base}`;
    porInsumo.set(k, [...(porInsumo.get(k) || []), l]);
  }
  return [...porInsumo.values()].map((hist) => {
    const ult = hist[hist.length - 1]; const ant = hist[hist.length - 2] || null;
    return {
      insumo_id: ult.insumo_id, unidade_base: ult.unidade_base, historico: hist, atual: ult, anterior: ant,
      diferenca: ant ? r2(ult.preco - ant.preco) : null, pct: ant && ant.preco > 0 ? r2(((ult.preco - ant.preco) / ant.preco) * 100) : null,
    };
  });
}

/** Comparação de cada período apurado com o anterior apurado (↑ / ↓, valor e %). */
export function comparacaoPeriodos(apurados) {
  const ok = apurados.filter((a) => a.status === "apurado");
  const delta = (atual, ant) => (atual == null || ant == null ? null : { valor: r2(atual - ant), pct: ant ? r2(((atual - ant) / Math.abs(ant)) * 100) : null });
  return ok.map((a, i) => {
    const b = ok[i - 1];
    return {
      periodo: a.periodo, cmv: a.cmv.valor, cmvPct: a.cmvPct, compras: a.compras.valor, faturamento: a.faturamento.valor, estoqueFinal: a.ef.valor,
      vsAnterior: b ? {
        cmvPctPontos: a.cmvPct != null && b.cmvPct != null ? r2(a.cmvPct - b.cmvPct) : null,
        cmv: delta(a.cmv.valor, b.cmv.valor), compras: delta(a.compras.valor, b.compras.valor),
        faturamento: delta(a.faturamento.valor, b.faturamento.valor), estoqueFinal: delta(a.ef.valor, b.ef.valor),
      } : null,
    };
  });
}

/** Médias dos períodos apurados (últimos N). Abaixo do mínimo: HISTÓRICO INSUFICIENTE. */
export function mediasHistoricas(apurados, cfg = CONFIG_CMV) {
  const ok = apurados.filter((a) => a.status === "apurado").slice(-cfg.alertas.janelaPeriodos);
  if (ok.length < cfg.alertas.periodosParaMedia) return { suficiente: false, periodos: ok.length, minimo: cfg.alertas.periodosParaMedia };
  const media = (xs) => (xs.length ? r2(soma(xs, (x) => x) / xs.length) : null);
  const dias = soma(ok, (a) => a.periodo.dias);
  const comPct = ok.filter((a) => a.cmvPct != null);
  return {
    suficiente: true, periodos: ok.length,
    cmv: media(ok.map((a) => a.cmv.valor)),
    cmvPct: comPct.length ? { valor: media(comPct.map((a) => a.cmvPct)), periodos: comPct.length } : null,
    comprasPorSemana: dias > 0 ? r2((soma(ok, (a) => a.compras.valor) / dias) * 7) : null,
    faturamento: ok.some((a) => a.faturamento.valor != null) ? media(ok.filter((a) => a.faturamento.valor != null).map((a) => a.faturamento.valor)) : null,
    estoqueFinal: media(ok.map((a) => a.ef.valor)),
  };
}

/**
 * Alertas baseados no PRÓPRIO histórico. Cada alerta traz: período comparado,
 * média usada, valor atual, diferença, fonte e o limite configurado. Sem causa.
 */
export function alertas({ apurados, variacoes, insumoPorId = new Map(), cfg = CONFIG_CMV }) {
  const A = cfg.alertas; const out = [];
  const nome = (id) => insumoPorId.get(id)?.nome || "produto";
  // preço da última compra × média das compras anteriores do produto
  for (const v of variacoes || []) {
    const ant = v.historico.slice(0, -1).slice(-A.janelaPeriodos);
    if (ant.length < A.periodosParaMedia) continue;
    const media = soma(ant, (x) => x.preco) / ant.length;
    const pct = r2(((v.atual.preco - media) / media) * 100);
    if (Math.abs(pct) >= A.variacaoPrecoPct) out.push({ tipo: "preco", insumo_id: v.insumo_id, texto: `${nome(v.insumo_id)}: preço ${pct > 0 ? "+" : ""}${pct}% em relação à média das ${ant.length} compras anteriores.`,
      atual: v.atual.preco, media: r2(media), diferencaPct: pct, base: `${ant.length} compras anteriores`, unidade: rotuloBase(v.unidade_base), fonte: "compras confirmadas (preço do item, sem frete)", limite: `${A.variacaoPrecoPct}%` });
  }
  const ok = apurados.filter((a) => a.status === "apurado");
  if (ok.length >= A.periodosParaMedia + 1) {
    const atual = ok[ok.length - 1]; const ant = ok.slice(0, -1).slice(-A.janelaPeriodos);
    const pctPeriodo = `${fmtDia(atual.periodo.de)} a ${fmtDia(atual.periodo.ate)}`;
    if (atual.cmvPct != null) {
      const comPct = ant.filter((a) => a.cmvPct != null);
      if (comPct.length >= A.periodosParaMedia) {
        const m = soma(comPct, (a) => a.cmvPct) / comPct.length;
        const pp = r2(atual.cmvPct - m);
        if (Math.abs(pp) >= 1) out.push({ tipo: "cmv", texto: `CMV de ${pctPeriodo} ficou ${pp > 0 ? "+" : ""}${pp} ponto(s) percentual(is) ${pp > 0 ? "acima" : "abaixo"} da média dos ${comPct.length} períodos anteriores.`,
          atual: atual.cmvPct, media: r2(m), diferencaPct: pp, base: `${comPct.length} períodos`, fonte: "inventários fechados + compras + faturamento", limite: "1 p.p." });
      }
    }
    const mediaProduto = (id, campo) => { const xs = ant.map((a) => a.produtos.find((p) => p.insumo_id === id)?.[campo]).filter((x) => x != null); return xs.length >= A.periodosParaMedia ? { m: soma(xs, (x) => x) / xs.length, n: xs.length } : null; };
    for (const p of atual.produtos.filter((x) => x.consumo_q != null)) {
      const mc = mediaProduto(p.insumo_id, "consumo_q");
      if (mc && mc.m > 0) {
        const pct = r2(((p.consumo_q - mc.m) / mc.m) * 100);
        if (Math.abs(pct) >= A.variacaoConsumoPct) out.push({ tipo: "consumo", insumo_id: p.insumo_id, texto: `${p.nome}: consumo aparente ${pct > 0 ? "+" : ""}${pct}% em ${pctPeriodo} contra a média de ${mc.n} períodos.`,
          atual: exibirQtd(p.consumo_q, p.unidade_base), media: exibirQtd(mc.m, p.unidade_base), diferencaPct: pct, base: `${mc.n} períodos`, unidade: rotuloBase(p.unidade_base), fonte: "inventário inicial + compras − inventário final", limite: `${A.variacaoConsumoPct}%` });
        if (p.ef_q != null && p.ef_q >= A.estoqueSobreConsumo * mc.m) out.push({ tipo: "estoque", insumo_id: p.insumo_id, texto: `${p.nome}: estoque final cobre ${r2(p.ef_q / mc.m)} períodos de consumo médio.`,
          atual: exibirQtd(p.ef_q, p.unidade_base), media: exibirQtd(mc.m, p.unidade_base), base: `${mc.n} períodos`, unidade: rotuloBase(p.unidade_base), fonte: "inventário final × consumo médio", limite: `${A.estoqueSobreConsumo}× o consumo médio` });
      }
      const mq = mediaProduto(p.insumo_id, "compras_q");
      if (mq && mq.m > 0 && p.compras_q > 0) {
        const pct = r2(((p.compras_q - mq.m) / mq.m) * 100);
        if (Math.abs(pct) >= A.variacaoCompraPct) out.push({ tipo: "compra", insumo_id: p.insumo_id, texto: `${p.nome}: comprou ${pct > 0 ? "+" : ""}${pct}% em ${pctPeriodo} contra a média de ${mq.n} períodos.`,
          atual: exibirQtd(p.compras_q, p.unidade_base), media: exibirQtd(mq.m, p.unidade_base), diferencaPct: pct, base: `${mq.n} períodos`, unidade: rotuloBase(p.unidade_base), fonte: "compras confirmadas", limite: `${A.variacaoCompraPct}%` });
      }
    }
  }
  return out;
}

/** Estoque com baixo giro no período: sobrou quase tudo do que havia (inicial + compras). */
export function estoqueParado(ap, { compras = [], itens = [] } = {}, cfg = CONFIG_CMV) {
  if (ap.status !== "apurado") return [];
  const ultimaCompra = new Map();
  const conf = new Map(compras.filter((c) => c.status === "confirmada").map((c) => [c.id, dataEntrada(c)]));
  for (const i of itens) { const d = conf.get(i.compra_id); if (d && d < ap.periodo.ateExclusivo && (!ultimaCompra.get(i.insumo_id) || d > ultimaCompra.get(i.insumo_id))) ultimaCompra.set(i.insumo_id, d); }
  return ap.produtos
    .filter((p) => p.consumo_q != null && (p.ef_q || 0) > 0)
    .filter((p) => { const disp = (p.ei_q || 0) + p.compras_q; return disp > 0 && p.consumo_q <= disp * (cfg.baixoGiroPct / 100); })
    .map((p) => ({ ...p, valorParado: p.ef_v, ultimaCompra: ultimaCompra.get(p.insumo_id) || null }))
    .sort((a, b) => (b.valorParado || 0) - (a.valorParado || 0));
}

/**
 * ENTRADAS E SAÍDAS por produto, com médias por dia / semana (×7) / mês (×30).
 *   entrada = compras confirmadas; saída = consumo aparente (inicial + entradas − final).
 * Todos os grupos: mercadoria, embalagens e limpeza (consumo operacional).
 * Média ponderada pelos dias, só nos períodos APURADOS em que o produto aparece
 * (contado ou comprado) com contagem nas duas pontas — nada estimado.
 */
export function entradasSaidasPorProduto(apurados) {
  const ok = (apurados || []).filter((a) => a.status === "apurado");
  const acc = new Map();
  for (const a of ok) {
    for (const p of a.produtos) {
      if (p.consumo_q == null) continue;
      const k = `${p.insumo_id}|${p.unidade_base}`;
      const x = acc.get(k) || { insumo_id: p.insumo_id, nome: p.nome, grupo: p.grupo, categoria: p.categoria, unidade_base: p.unidade_base, entrada_q: 0, saida_q: 0, saida_v: 0, dias: 0, periodos: 0, ultimo_ef_q: null };
      x.entrada_q += p.compras_q; x.saida_q += p.consumo_q; x.saida_v += p.consumo_v; x.dias += a.periodo.dias; x.periodos += 1; x.ultimo_ef_q = p.ef_q;
      acc.set(k, x);
    }
  }
  return [...acc.values()].map((x) => {
    const dia = (q) => (x.dias > 0 ? q / x.dias : null);
    return {
      ...x, entrada_q: r3(x.entrada_q), saida_q: r3(x.saida_q), saida_v: r2(x.saida_v),
      entradaDia: dia(x.entrada_q) == null ? null : r3(dia(x.entrada_q)), saidaDia: dia(x.saida_q) == null ? null : r3(dia(x.saida_q)),
      entradaSemana: dia(x.entrada_q) == null ? null : r3(dia(x.entrada_q) * 7), saidaSemana: dia(x.saida_q) == null ? null : r3(dia(x.saida_q) * 7),
      entradaMes: dia(x.entrada_q) == null ? null : r3(dia(x.entrada_q) * 30), saidaMes: dia(x.saida_q) == null ? null : r3(dia(x.saida_q) * 30),
      // quantos dias o último estoque final cobre na saída média (só informação)
      coberturaDias: x.ultimo_ef_q != null && dia(x.saida_q) > 0 ? Math.round((x.ultimo_ef_q / dia(x.saida_q)) * 10) / 10 : null,
    };
  }).sort((a, b) => b.saida_v - a.saida_v);
}

/** Resultado consolidado para o DRE futuro (só números apurados; o resto é null com motivo). */
export function cmvRealPeriodo(ap) {
  return {
    de: ap.periodo.de, ate: ap.periodo.ate, status: ap.status,
    estoque_inicial: ap.ei.valor, compras: ap.compras.valor, estoque_final: ap.ef.valor,
    cmv_real: ap.cmv.valor, faturamento: ap.faturamento.valor, cmv_pct: ap.cmvPct,
    motivos: [...ap.motivos, ...(ap.motivoPct && ap.cmv.valor != null ? [ap.motivoPct] : [])],
  };
}
