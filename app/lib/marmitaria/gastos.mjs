// Gastos e rendimento da marmitaria (pedido do dono, 17/11/2026): "quero ter
// um controle de gastos e compras… uma planilha de quanto eu gastei naquele
// dia, na semana e no mês", "comprei 18 kg de frango e rendeu 1000 frangos
// empanados", "frigideira, panela, avental para um funcionário, touca,
// detergente… separo por categorias e vejo para quem foi".
//
// Tudo sai do que já está gravado (REAL):
//   - compras confirmadas (ingredientes, embalagens, limpeza), item a item;
//   - contas a pagar da unidade que não vieram de compra (utensílios,
//     uniformes, manutenção, contas fixas…), com o detalhe (item, quantidade,
//     para quem) quando foi lançado como gasto;
//   - saídas do estoque (produção, perda, retirada) a custo médio;
//   - produções: o que entrou (baixas) e quanto rendeu.
// Sem custo médio na saída, o valor fica nulo e é contado à parte: nunca zero.
// Funções puras (testadas em gastos.test.mjs); a leitura do banco fica em gastos-dados.js.

export const TIPOS_GASTO = Object.freeze([
  { id: "utensilios", rotulo: "Utensílios e equipamentos", categoria: "utensilios", exemplos: "frigideira, panela, faca, pote" },
  { id: "uniformes_epi", rotulo: "Uniformes e EPI", categoria: "uniformes_epi", exemplos: "avental, camisa, touca, luva" },
  { id: "limpeza", rotulo: "Limpeza e higiene", categoria: "limpeza", exemplos: "detergente, sabão, pano" },
  { id: "manutencao", rotulo: "Manutenção", categoria: "manutencao", exemplos: "conserto, peça, gás do fogão" },
  { id: "outros", rotulo: "Outros", categoria: "outros", exemplos: "" },
]);
const ROTULO_TIPO = Object.fromEntries(TIPOS_GASTO.map((t) => [t.id, t.rotulo]));
export const rotuloTipo = (id) => ROTULO_TIPO[id] || "Outros";
/** O código do plano de contas de cada tipo de gasto (centro de custo: marmitaria). */
export const categoriaDoTipo = (id) => TIPOS_GASTO.find((t) => t.id === id)?.categoria || "outros";

// rótulos das categorias do plano de contas que aparecem nas contas da unidade
const ROTULO_CATEGORIA_CONTA = {
  utensilios: "Utensílios e equipamentos", uniformes_epi: "Uniformes e EPI", limpeza: "Limpeza e higiene", manutencao: "Manutenção",
  marketing: "Marketing", outros: "Outros", investimento_equipamentos: "Investimentos",
  ocupacao_aluguel: "Aluguel", ocupacao_condominio: "Condomínio", utilidades_energia: "Energia", utilidades_agua: "Água", utilidades_gas: "Gás",
  utilidades_internet: "Internet e telefone", adm_contabilidade: "Contabilidade", adm_sistemas: "Sistemas", adm_material: "Material administrativo",
  com_taxa_cartao: "Taxas de cartão", com_comissao_marketplace: "Comissão dos apps", com_comissoes: "Comissões", com_entregas: "Entregas",
  imp_sobre_vendas: "Impostos", imp_taxas_licencas: "Taxas e licenças", fin_tarifas_bancarias: "Tarifas bancárias", fin_juros_multas: "Juros e multas",
};
export function rotuloCategoriaConta(codigo) {
  const c = String(codigo || "");
  if (ROTULO_CATEGORIA_CONTA[c]) return ROTULO_CATEGORIA_CONTA[c];
  if (c.startsWith("pessoal_")) return "Pessoal";
  return "Outros";
}

const r2 = (v) => Math.round(Number(v) * 100) / 100;
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dentro = (d, p) => !!d && d >= p.de && d <= p.ate;
const dia = (v) => (v ? String(v).slice(0, 10) : null);

/** Categoria do item de compra: pelo local do estoque, senão pelo cadastro do produto. */
export function categoriaDaCompra(item, insumo, estoque) {
  const slug = String(estoque?.slug || "");
  const dep = fold(insumo?.departamento);
  if (slug === "embalagens-marmitaria" || dep === "embalagens") return "Embalagens";
  if (slug === "limpeza-marmitaria" || dep === "limpeza" || /limpeza/.test(fold(insumo?.categoria))) return "Limpeza e higiene";
  return "Ingredientes";
}

/** Quantidade legível: 18000 g → "18 kg"; 1000 un → "1.000 un". */
export function quantidadeTexto(q, un) {
  const n = num(q);
  if (n == null) return "—";
  const u = String(un || "").toLowerCase();
  const f = (v, c = 3) => v.toLocaleString("pt-BR", { maximumFractionDigits: c });
  if (u === "g" && Math.abs(n) >= 1000) return `${f(n / 1000)} kg`;
  if (u === "ml" && Math.abs(n) >= 1000) return `${f(n / 1000)} L`;
  if (u === "l") return `${f(n)} L`;
  return `${f(n)} ${u || "un"}`.trim();
}

/** Por unidade produzida: 18 kg para 1000 → "18 g". */
export function porUnidadeTexto(q, un, produzido) {
  const n = num(q);
  const p = num(produzido);
  if (n == null || !(p > 0)) return null;
  const u = String(un || "").toLowerCase();
  const v = n / p;
  if (u === "kg" && v < 1) return quantidadeTexto(v * 1000, "g");
  if (u === "l" && v < 1) return quantidadeTexto(v * 1000, "ml");
  return quantidadeTexto(v, u);
}

/**
 * @param {object} p
 * @param {{de:string, ate:string}} p.periodo
 * @param {Array} p.compras        compras (id, status, data_compra, data_recebimento, valor_frete, valor_desconto, fornecedor_nome?)
 * @param {Array} p.itensCompra    compras_itens (compra_id, insumo_id, estoque_id, descricao_snapshot, quantidade_base, unidade_base, valor_total)
 * @param {Array} p.contas         contas_pagar da unidade (id, descricao, valor, categoria_codigo, status, data_pagamento, data_vencimento, origem_tipo, cancelado_em)
 * @param {Array} p.detalhes       gastos_detalhe (conta_pagar_id, data, tipo_gasto, item, quantidade, valor_total, destino, colaborador_id)
 * @param {Array} p.movimentos     saídas do estoque (insumo_id, quantidade, unidade_medida, valor_total, motivo, data_movimento, chave_idempotencia)
 * @param {Array} p.lotes          marmitaria_producao_lotes (id, ficha_id, tipo_demanda, quantidade_produzida, data_producao, custo_total, rendimento_real_dados)
 * @param {Map} p.insumos          id → insumo
 * @param {Array} p.fichas         fichas (id, nome_receita, rendimento_unidade)
 * @param {Array} p.estoques       estoques (id, slug, nome)
 * @param {Map} p.colaboradores    id → nome
 */
export function resumoDeGastos({ periodo, compras = [], itensCompra = [], contas = [], detalhes = [], movimentos = [], lotes = [], insumos = new Map(), fichas = [], estoques = [], colaboradores = new Map() }) {
  const estPorId = new Map(estoques.map((e) => [e.id, e]));
  const nomeInsumo = (id, alt) => insumos.get(id)?.nome || alt || "Produto sem cadastro";

  // ── Gastos: compras confirmadas + contas que não vieram de compra ──
  const gastos = [];
  const compraPorId = new Map(compras.filter((c) => c.status === "confirmada" && !c.cancelado_em).map((c) => [c.id, c]));
  for (const it of itensCompra) {
    const c = compraPorId.get(it.compra_id);
    if (!c) continue;
    const data = dia(c.data_recebimento || c.data_compra);
    if (!dentro(data, periodo)) continue;
    const valor = num(it.valor_total);
    if (valor == null) continue;
    gastos.push({
      data, origem: "compra", categoria: categoriaDaCompra(it, insumos.get(it.insumo_id), estPorId.get(it.estoque_id)),
      item: nomeInsumo(it.insumo_id, it.descricao_snapshot), quantidade: num(it.quantidade_base), unidade: it.unidade_base || "",
      valor: r2(valor), destino: null, fornecedor: c.fornecedor_nome || null,
    });
  }
  for (const c of compraPorId.values()) {
    const data = dia(c.data_recebimento || c.data_compra);
    if (!dentro(data, periodo)) continue;
    const frete = num(c.valor_frete) || 0;
    const desconto = num(c.valor_desconto) || 0;
    if (frete > 0) gastos.push({ data, origem: "compra", categoria: "Frete de compras", item: "Frete", quantidade: null, unidade: "", valor: r2(frete), destino: null, fornecedor: c.fornecedor_nome || null });
    if (desconto > 0) gastos.push({ data, origem: "compra", categoria: "Descontos em compras", item: "Desconto", quantidade: null, unidade: "", valor: r2(-desconto), destino: null, fornecedor: c.fornecedor_nome || null });
  }
  const detPorConta = new Map(detalhes.map((d) => [d.conta_pagar_id, d]));
  for (const c of contas) {
    if (c.origem_tipo === "COMPRA" || c.cancelado_em || c.status === "cancelado" || c.status === "cancelada") continue;
    const d = detPorConta.get(c.id);
    const data = dia(d?.data || c.data_pagamento || c.data_vencimento);
    if (!dentro(data, periodo)) continue;
    const valor = num(d?.valor_total ?? c.valor);
    if (valor == null) continue;
    gastos.push({
      data, origem: "conta", contaId: c.id,
      categoria: d ? rotuloTipo(d.tipo_gasto) : rotuloCategoriaConta(c.categoria_codigo),
      item: d?.item || c.descricao || "Conta", quantidade: num(d?.quantidade), unidade: d?.quantidade ? "un" : "",
      valor: r2(valor),
      destino: d ? (d.destino === "colaborador" ? (colaboradores.get(d.colaborador_id) || "Funcionário") : "Geral") : null,
      fornecedor: null, pago: !!c.data_pagamento,
    });
  }
  gastos.sort((a, b) => (a.data === b.data ? a.categoria.localeCompare(b.categoria) : a.data.localeCompare(b.data)));
  const totalGastos = r2(gastos.reduce((t, g) => t + g.valor, 0));
  const porCat = new Map();
  for (const g of gastos) porCat.set(g.categoria, r2((porCat.get(g.categoria) || 0) + g.valor));
  const porCategoria = [...porCat.entries()].map(([categoria, valor]) => ({ categoria, valor, pct: totalGastos > 0 ? Math.round((valor / totalGastos) * 1000) / 10 : null }))
    .sort((a, b) => b.valor - a.valor);
  const porDiaM = new Map();
  for (const g of gastos) porDiaM.set(g.data, r2((porDiaM.get(g.data) || 0) + g.valor));
  const porDia = [...porDiaM.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, valor]) => ({ data, valor }));
  const porPessoaM = new Map();
  for (const g of gastos) if (g.destino && g.destino !== "Geral") porPessoaM.set(g.destino, r2((porPessoaM.get(g.destino) || 0) + g.valor));
  const porPessoa = [...porPessoaM.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);

  // ── Uso: saídas do estoque no período, a custo médio ──
  const usoM = new Map();
  let semValor = 0;
  for (const m of movimentos) {
    const data = dia(m.data_movimento || m.created_at);
    if (!dentro(data, periodo) || m.tipo === "entrada") continue;
    const q = num(m.quantidade);
    if (!(q > 0)) continue;
    const chave = `${m.insumo_id}|${m.unidade_medida || ""}`;
    const u = usoM.get(chave) || { insumoId: m.insumo_id, item: nomeInsumo(m.insumo_id), quantidade: 0, unidade: m.unidade_medida || "", valor: 0, semValor: false, motivos: new Set() };
    u.quantidade += q;
    if (num(m.valor_total) == null) { u.semValor = true; semValor += 1; } else u.valor += Number(m.valor_total);
    u.motivos.add(m.motivo || "saída");
    usoM.set(chave, u);
  }
  const uso = [...usoM.values()].map((u) => ({ ...u, valor: u.semValor && u.valor === 0 ? null : r2(u.valor), motivos: [...u.motivos] }))
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  const totalUso = r2(uso.reduce((t, u) => t + (u.valor || 0), 0));

  // ── Rendimento: cada produção do período, o que entrou e quanto rendeu ──
  const fichaPorId = new Map(fichas.map((f) => [f.id, f]));
  const movPorChave = new Map(movimentos.filter((m) => m.chave_idempotencia).map((m) => [m.chave_idempotencia, m]));
  const rendimento = [];
  for (const l of lotes) {
    if (!dentro(dia(l.data_producao), periodo)) continue;
    const produzido = num(l.quantidade_produzida);
    if (!(produzido > 0)) continue;
    const ficha = fichaPorId.get(l.ficha_id);
    const baixas = Array.isArray(l.rendimento_real_dados) ? l.rendimento_real_dados : (l.rendimento_real_dados?.baixas || []);
    const prefixo = l.tipo_demanda === "preparo" ? "marm-prep" : "marm-prod";
    let custo = 0;
    let custoCompleto = baixas.length > 0;
    const entradas = baixas.map((b) => {
      const mov = movPorChave.get(`${prefixo}:${l.id}:${b.estoque_id}:${b.insumo_id}`);
      const q = num(mov?.quantidade ?? b.quantidade);
      const un = mov?.unidade_medida || b.unidade || insumos.get(b.insumo_id)?.unidade_medida || "";
      const valor = num(mov?.valor_total);
      if (valor == null) custoCompleto = false; else custo += valor;
      return { item: nomeInsumo(b.insumo_id), quantidade: q, unidade: un, valor: valor == null ? null : r2(valor), porUnidade: porUnidadeTexto(q, un, produzido) };
    });
    const unProduto = l.tipo_demanda === "preparo" ? (ficha?.rendimento_unidade || "un") : "marmitas";
    rendimento.push({
      data: dia(l.data_producao), loteId: l.id, nome: ficha?.nome_receita || ficha?.nome || "Produção", produzido, unidade: unProduto, entradas,
      custo: custoCompleto ? r2(custo) : null,
      custoPorUnidade: custoCompleto && produzido > 0 ? Math.round((custo / produzido) * 10000) / 10000 : null,
      custoPrevisto: num(l.custo_total) > 0 ? r2(l.custo_total) : null,
    });
  }
  rendimento.sort((a, b) => b.data.localeCompare(a.data));

  return { periodo, gastos, totalGastos, porCategoria, porDia, porPessoa, uso, totalUso, usoSemValor: semValor, rendimento };
}

/** Estoque agora, valorizado pelo custo médio (sem custo: valor nulo). */
export function estoqueValorizado({ itensEstoque = [], estoques = [], insumos = new Map(), custos = new Map(), slugs = null }) {
  const locais = new Map(estoques.filter((e) => !slugs || slugs.includes(e.slug)).map((e) => [e.id, e]));
  const por = new Map();
  for (const it of itensEstoque) {
    if (!locais.has(it.estoque_id)) continue;
    const q = num(it.quantidade_atual);
    if (!(q > 0)) continue;
    const ins = insumos.get(it.insumo_id);
    const atual = por.get(it.insumo_id) || { insumoId: it.insumo_id, item: ins?.nome || "Produto", quantidade: 0, unidade: custos.get(it.insumo_id)?.unidade_base || ins?.unidade_medida || "" };
    atual.quantidade += q;
    por.set(it.insumo_id, atual);
  }
  const linhas = [...por.values()].map((l) => {
    const c = num(custos.get(l.insumoId)?.custo_medio_base);
    return { ...l, valor: c == null ? null : r2(l.quantidade * c) };
  }).sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  return { linhas, total: r2(linhas.reduce((t, l) => t + (l.valor || 0), 0)), semCusto: linhas.filter((l) => l.valor == null).length };
}

// ─── Planilha (CSV para Excel/Google Planilhas: ; e vírgula decimal) ─────────

const celula = (v) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const linha = (...cs) => cs.map(celula).join(";");
const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

export function planilhaDeGastos(resumo, { estoque = null, titulo = "Gastos da marmitaria" } = {}) {
  const L = [];
  L.push(linha(`${titulo} de ${dataBR(resumo.periodo.de)} a ${dataBR(resumo.periodo.ate)}`));
  L.push("");
  L.push(linha("GASTOS"));
  L.push(linha("Data", "Categoria", "Item", "Quantidade", "Unidade", "Valor (R$)", "Para quem", "Origem"));
  for (const g of resumo.gastos) L.push(linha(dataBR(g.data), g.categoria, g.item, g.quantidade, g.unidade, g.valor, g.destino || "", g.origem === "compra" ? "Compra" : "Conta a pagar"));
  L.push(linha("", "", "", "", "Total", resumo.totalGastos));
  L.push("");
  L.push(linha("POR CATEGORIA"));
  L.push(linha("Categoria", "Valor (R$)", "% do total"));
  for (const c of resumo.porCategoria) L.push(linha(c.categoria, c.valor, c.pct));
  L.push("");
  L.push(linha("POR DIA"));
  L.push(linha("Data", "Valor (R$)"));
  for (const d of resumo.porDia) L.push(linha(dataBR(d.data), d.valor));
  if (resumo.porPessoa.length) {
    L.push("");
    L.push(linha("POR FUNCIONÁRIO"));
    L.push(linha("Funcionário", "Valor (R$)"));
    for (const p of resumo.porPessoa) L.push(linha(p.nome, p.valor));
  }
  L.push("");
  L.push(linha("USO DO ESTOQUE (a custo médio)"));
  L.push(linha("Item", "Quantidade", "Unidade", "Valor (R$)", "Motivo"));
  for (const u of resumo.uso) L.push(linha(u.item, u.quantidade, u.unidade, u.valor, u.motivos.join(", ")));
  L.push(linha("", "", "Total", resumo.totalUso));
  L.push("");
  L.push(linha("RENDIMENTO DA PRODUÇÃO"));
  L.push(linha("Data", "Produzido", "Quantidade", "Unidade", "Entrou", "Quantidade", "Unidade", "Por unidade produzida", "Valor (R$)", "Custo por unidade (R$)"));
  for (const r of resumo.rendimento) {
    r.entradas.forEach((e, k) => L.push(linha(k === 0 ? dataBR(r.data) : "", k === 0 ? r.nome : "", k === 0 ? r.produzido : "", k === 0 ? r.unidade : "", e.item, e.quantidade, e.unidade, e.porUnidade || "", e.valor, k === 0 ? r.custoPorUnidade : "")));
    if (!r.entradas.length) L.push(linha(dataBR(r.data), r.nome, r.produzido, r.unidade, "", "", "", "", "", r.custoPorUnidade));
  }
  if (estoque) {
    L.push("");
    L.push(linha("ESTOQUE AGORA (a custo médio)"));
    L.push(linha("Item", "Quantidade", "Unidade", "Valor (R$)"));
    for (const e of estoque.linhas) L.push(linha(e.item, e.quantidade, e.unidade, e.valor));
    L.push(linha("", "", "Total", estoque.total));
  }
  return `﻿${L.join("\r\n")}\r\n`;
}
