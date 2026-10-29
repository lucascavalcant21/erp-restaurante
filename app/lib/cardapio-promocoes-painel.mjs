// PAINEL → PROMOÇÕES E DESCONTOS (protótipo PainelPromocoes, 9K.2 da spec) — regras puras.
// A conta usa o custo da ficha técnica (F2) e as despesas variáveis da casa
// (impostos, maquininha...). Sem ficha com custo, a tela diz isso em vez de
// inventar lucro. Quem cobra a promoção do cliente é o servidor.

import {
  CANAIS_CARDAPIO, DIAS_SEMANA, formatarPreco, normalizarPromocao, promocaoVigente, quandoVale, rotuloDaPromocao,
} from "./cardapio-digital.mjs";

const c2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (v) => `${Math.round(v * 100)}%`;
const brl = (v) => (v < 0 ? `− ${formatarPreco(-v)}` : formatarPreco(v));

// Os tipos na ordem do protótipo. "Combo" tem editor próprio (combos da vitrine).
export const TIPOS_PAINEL = [
  { id: "desconto", nome: "Desconto %" },
  { id: "desconto_valor", nome: "Desconto em R$" },
  { id: "preco", nome: "Preço fixo" },
  { id: "leve_mais", nome: "Pegue e leve mais" },
  { id: "combo", nome: "Combo" },
  { id: "frete_gratis", nome: "Frete grátis" },
];
export const REGRAS_LEVE = [[1, 2], [2, 3], [1, 3]];

export function nomeDoTipo(tipo, p = {}) {
  if (tipo === "leve_mais") return `Pegue ${p.pague || 1}, leve ${p.leve || 2}`;
  if (tipo === "aviso") return "Aviso";
  return TIPOS_PAINEL.find((t) => t.id === tipo)?.nome || "Promoção";
}

/** Selo curto do card da lista: "10%", "R$", "1+1", "−5", "🚚" não — só texto. */
export function seloDaPromocao(p) {
  if (p.tipo === "desconto" && p.desconto_pct) return `${p.desconto_pct}%`;
  if (p.tipo === "desconto_valor" && p.desconto_valor) return `−${Math.round(p.desconto_valor)}`;
  if (p.tipo === "preco") return "R$";
  if (p.tipo === "leve_mais") return `${p.pague}+${p.leve - p.pague}`;
  if (p.tipo === "frete_gratis") return "Frete";
  return "!";
}

/** Custo e despesas variáveis de um prato, a partir do resumo da ficha (F2). */
export function custoDoPrato(resumo, params = {}) {
  const cmv = Number(resumo?.cmvValor) || 0;
  if (!(cmv > 0)) return null;
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  const variaveisPct = n(resumo?.impostoPct ?? params.imposto_pct) + n(resumo?.taxaMaquininhaPct ?? params.taxa_cartao_pct)
    + n(params.comissao_pct) + n(params.marketplace_pct) + n(params.outras_variaveis_pct);
  return { cmv: c2(cmv), variaveisPct: Math.round(variaveisPct * 100) / 100 };
}

/** Quanto o cliente paga por 1 venda da promoção, e quanto pagaria sem ela. */
function precosDaVenda(p, preco) {
  if (p.tipo === "leve_mais") return { cheio: c2(preco * p.leve), paga: c2(preco * p.pague), unidades: p.leve, vendidas: p.pague };
  let paga = preco;
  if (p.tipo === "desconto" && p.desconto_pct) paga = c2(preco * (1 - p.desconto_pct / 100));
  if (p.tipo === "desconto_valor" && p.desconto_valor) paga = c2(preco - p.desconto_valor);
  if (p.tipo === "preco" && p.preco_promocional) paga = c2(p.preco_promocional);
  return { cheio: c2(preco), paga: Math.max(0, paga), unidades: 1, vendidas: 1 };
}

/**
 * A "Conta da promoção" de um prato: linhas, lucro por venda e o veredito
 * (dá lucro / margem abaixo da meta / prejuízo). Margem = lucro ÷ o que o
 * cliente paga, depois do custo da ficha e das despesas variáveis.
 */
export function contaDaPromocao(promo, { produto, custo, metaPct = 0, taxaEntrega = 0 } = {}) {
  const p = normalizarPromocao({ titulo: "x", ...promo });
  if (p.tipo === "frete_gratis") {
    const t = c2(taxaEntrega);
    return {
      linhas: [{ rotulo: "Taxa de entrega que o cliente deixa de pagar", valor: t > 0 ? brl(t) : "R$ 0,00", tom: "ganho" }],
      veredito: t > 0
        ? { nivel: "baixa", titulo: `O frete sai do seu lucro: ${brl(t)} por pedido`, texto: p.frete_minimo > 0 ? `Só vale acima de ${brl(p.frete_minimo)}: use para subir o ticket.` : "Coloque um valor mínimo para o frete grátis puxar pedidos maiores." }
        : { nivel: "ok", titulo: "Sua entrega já não cobra taxa", texto: "Frete grátis não muda nada para o cliente hoje." },
      cliente: null,
    };
  }
  const preco = Number(produto?.preco) || 0;
  if (!produto || !(preco > 0)) return { linhas: [], veredito: { nivel: "vazio", titulo: "Escolha um prato", texto: "A conta aparece com o preço e o custo da ficha técnica." }, cliente: null };
  const v = precosDaVenda(p, preco);
  const ganha = c2(v.cheio - v.paga);
  const cliente = {
    etiqueta: (rotuloDaPromocao(p) || p.titulo).toUpperCase(),
    titulo: v.unidades > 1 ? `${v.unidades} × ${produto.nome}` : produto.nome,
    de: v.cheio, por: v.paga, ganha,
  };
  const linhas = [
    { rotulo: v.unidades > 1 ? `Preço normal (${v.unidades} × ${brl(preco)})` : "Preço normal", valor: brl(v.cheio) },
    { rotulo: v.unidades > 1 ? `Cliente paga (${v.vendidas} × ${brl(preco)})` : "Cliente paga", valor: brl(v.paga) },
    { rotulo: "Desconto que o cliente ganha", valor: `${brl(ganha)} · ${v.cheio > 0 ? pct(ganha / v.cheio) : "0%"}`, tom: "ganho" },
  ];
  if (!custo) {
    return { linhas, cliente, veredito: { nivel: "sem_custo", titulo: "Sem custo na ficha técnica", texto: "Cadastre a ficha técnica deste prato com os ingredientes para ver o lucro da promoção." } };
  }
  const cmv = c2(custo.cmv * v.unidades);
  const taxas = c2((v.paga * custo.variaveisPct) / 100);
  const lucro = c2(v.paga - cmv - taxas);
  const margem = v.paga > 0 ? lucro / v.paga : -1;
  linhas.push(
    { rotulo: v.unidades > 1 ? `Custo dos produtos (${v.unidades} × ${brl(custo.cmv)})` : "Custo do prato (ficha técnica)", valor: `− ${brl(cmv)}`, tom: "custo" },
    { rotulo: `Despesas variáveis (${String(custo.variaveisPct).replace(".", ",")}%)`, valor: `− ${brl(taxas)}`, tom: "custo" },
    { rotulo: "Seu lucro por venda", valor: `${brl(lucro)} · ${v.paga > 0 ? pct(margem) : "—"}`, tom: "total" },
  );
  // Sem a promoção: o lucro de vender as mesmas unidades que o cliente paga.
  const lucroSem = c2((preco - custo.cmv - (preco * custo.variaveisPct) / 100) * v.vendidas);
  const precisa = lucro > 0 && lucroSem > lucro ? lucroSem / lucro - 1 : 0;
  const meta = Number(metaPct) > 0 ? Number(metaPct) / 100 : 0;
  let veredito;
  if (lucro <= 0) {
    veredito = { nivel: "prejuizo", titulo: `Prejuízo de ${brl(-lucro)} por venda`, texto: "O custo passa do que o cliente paga. Não recomendado." };
  } else if (meta && margem < meta) {
    veredito = { nivel: "baixa", titulo: `Margem baixa: ${pct(margem)} (sua meta é ${pct(meta)})`, texto: `Dá ${brl(lucro)} de lucro por venda, abaixo da meta.${precisa ? ` Para empatar com o lucro sem promoção, precisa vender ${pct(precisa)} mais.` : ""}` };
  } else {
    veredito = { nivel: "ok", titulo: `Dá lucro: ${brl(lucro)} por venda (${pct(margem)})`, texto: precisa ? `Sem a promoção você lucraria ${brl(lucroSem)}. Para empatar, ela precisa trazer ${pct(precisa)} mais vendas.` : "Lucra o mesmo ou mais do que sem a promoção." };
  }
  return { linhas, cliente, veredito, lucro, margem };
}

/** Linhas da lista (cards à esquerda), com status e lucro do primeiro prato. */
export function linhasDaLista(promocoes = [], { produtosPorId = new Map(), custos = {}, metaPct = 0, taxaEntrega = 0, agora = new Date() } = {}) {
  return promocoes.map((bruta) => {
    const p = normalizarPromocao(bruta);
    const nomes = p.produto_ids.map((id) => produtosPorId.get(id)?.nome).filter(Boolean);
    const primeiro = produtosPorId.get(p.produto_ids[0]);
    const conta = contaDaPromocao(p, { produto: primeiro, custo: primeiro ? custos[primeiro.id] : null, metaPct, taxaEntrega });
    const noAr = p.ativa && promocaoVigente(p, agora);
    return {
      id: p.id,
      tipoId: p.tipo,
      selo: seloDaPromocao(p),
      nome: p.titulo,
      tipo: nomeDoTipo(p.tipo, p),
      regra: p.tipo === "frete_gratis"
        ? (p.frete_minimo > 0 ? `Pedidos acima de ${formatarPreco(p.frete_minimo)}` : "Todos os pedidos de entrega")
        : nomes.length ? (nomes.length > 3 ? `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}` : nomes.join(", ")) : "Nenhum prato escolhido",
      quando: quandoVale(p) || "Sempre",
      canais: p.canais.length ? CANAIS_CARDAPIO.filter((c) => p.canais.includes(c.id)).map((c) => c.rotulo).join(", ") : "Todos os canais",
      ativa: p.ativa,
      noAr,
      status: p.ativa ? (noAr ? "Ativa · no ar agora" : "Ativa") : "Pausada",
      ganha: conta.cliente ? `${formatarPreco(conta.cliente.ganha)}${conta.cliente.de > 0 ? ` (${pct(conta.cliente.ganha / conta.cliente.de)})` : ""}` : "",
      lucro: conta.lucro != null ? `${brl(conta.lucro)} por venda · ${pct(conta.margem)}` : "",
      nivel: conta.veredito.nivel,
    };
  });
}

/** Os 4 números do topo — só o que existe de verdade na configuração. */
export function resumoDaLista(linhas = []) {
  const ativas = linhas.filter((l) => l.ativa);
  const abaixo = linhas.filter((l) => l.ativa && (l.nivel === "baixa" || l.nivel === "prejuizo"));
  const semCusto = linhas.filter((l) => l.nivel === "sem_custo");
  return [
    { rotulo: "No ar agora", valor: String(linhas.filter((l) => l.noAr).length), sub: "valendo neste horário" },
    { rotulo: "Ativas", valor: String(ativas.length), sub: `${linhas.length - ativas.length} pausada${linhas.length - ativas.length === 1 ? "" : "s"}` },
    { rotulo: "Abaixo da meta", valor: String(abaixo.length), sub: abaixo.length ? "margem baixa ou prejuízo" : "todas dão lucro", tom: abaixo.length ? "alerta" : "ok" },
    { rotulo: "Sem custo na ficha", valor: String(semCusto.length), sub: semCusto.length ? "cadastre a ficha para ver o lucro" : "todas com custo" },
  ];
}

/** Promoção nova em branco (o formulário do lado direito). */
export function promocaoEmBranco() {
  return {
    id: `promo-${Date.now().toString(36)}`, titulo: "", tipo: "desconto", produto_ids: [], desconto_pct: 10,
    desconto_valor: "", preco_promocional: "", pague: 1, leve: 2, frete_minimo: "", dias_semana: [], hora_inicio: "", hora_fim: "",
    canais: [], mostrar_agora: true, acumula_cadastro: false, ativa: true,
  };
}

export { DIAS_SEMANA };
