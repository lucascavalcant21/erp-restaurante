// Respostas do Assistente Héfisto que não são ações: conferência de recebimento,
// pontualidade da equipe, custo de X gramas de uma ficha e lucro de um prato
// a um preço. Os números vêm do Metrics Engine (metrics/assistente.mjs); aqui
// só se monta o texto, as listas e os próximos passos.

import { NIVEL } from "../core/niveis.mjs";
import { temValor } from "../core/contratos.mjs";
import { fraseDaMetrica, blocoMetrica, blocoLista, blocoTexto, brl, num, ddmm } from "../commands/resposta.mjs";
import { divergenciaRecebimento, quantidadeNoRendimento, TOLERANCIA_MIN } from "../metrics/assistente.mjs";
import { paraUnidadeDoInsumo } from "../actions/criar-ficha.mjs";

const r = (texto, blocos = [], acoes = [], nivel = NIVEL.OBSERVAR) => ({ texto, blocos, acoes, nivel });
const insuf = (m, rotulo) => r(fraseDaMetrica(m, rotulo), [blocoMetrica(m, rotulo)], [], NIVEL.OBSERVAR);
const dobrar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const UN = { kg: "kg", quilo: "kg", quilos: "kg", kilo: "kg", kilos: "kg", g: "g", gr: "g", grama: "g", gramas: "g", l: "l", litro: "l", litros: "l", ml: "ml", un: "un", unidade: "un", unidades: "un", caixa: "cx", caixas: "cx" };
const ROT = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un", porcao: "porção" };

/** Números ditos, na ordem, com a unidade quando houver: "chegou 3 kg… era 2" → [{3,kg},{2,null}]. */
export function numerosDoTexto(texto) {
  const f = dobrar(texto).replace(/(\d),(\d)/g, "$1.$2");
  const out = [];
  const re = /(\d+(?:\.\d+)?)\s*(kg|quilos?|kilos?|g|gr|gramas?|l|litros?|ml|un|unidades?|caixas?)?\b/g;
  let m;
  while ((m = re.exec(f))) out.push({ n: Number(m[1]), u: m[2] ? UN[m[2]] : null });
  return out;
}

// ─── Compras: chegou x pedido ────────────────────────────────────────────────
export const HANDLERS_COMPRAS = {
  async "compras.foto_nota"() {
    return r("Mande a foto da nota (DANFE): toque na câmera ao lado do campo de mensagem (ou no + para escolher da galeria) e tire a foto com a nota inteira, reta e com boa luz. Eu leio os itens, confiro com o cadastro, cadastro o que faltar e te mostro a compra para confirmar.");
  },
  async "compras.conferir_recebimento"({ motor, params }) {
    const [chegou, pedido] = numerosDoTexto(params.texto);
    if (!params.produto || !chegou) {
      return { ...r("O que chegou e quanto?"), pergunta: { campo: "produto", livre: true, texto: "Me diga o produto, quanto chegou e quanto foi pedido. Ex.: \"chegou 3 kg de picanha, o pedido era 2 kg\".", comandoBase: "{valor}" } };
    }
    const m = await motor.getReceivingCheck({ termo: params.produto });
    if (m.status === "sem_permissao") return insuf(m, "Conferência de recebimento");
    const ins = temValor(m) ? m.detalhes.insumo : null;
    const nome = ins?.nome || params.produto;
    const un = chegou.u || pedido?.u || ins?.unidade || "";
    const pedidoNaUn = pedido ? (pedido.u && un && pedido.u !== un ? paraUnidadeDoInsumo(pedido.n, pedido.u, un) : pedido.n) : null;
    const d = pedidoNaUn != null ? divergenciaRecebimento(chegou.n, pedidoNaUn) : null;
    const q = (x) => `${num(x)} ${ROT[un] || un}`.trim();
    const partes = [];
    const blocos = [];
    if (d) {
      if (d.situacao === "igual") partes.push(`Chegou ${q(d.chegou)} de ${nome}, exatamente o que foi pedido.`);
      else {
        const dif = Math.abs(d.diferenca);
        partes.push(`Chegou ${q(d.chegou)} de ${nome}, mas o pedido era ${q(d.pedido)}: veio ${q(dif)} a ${d.situacao === "a_mais" ? "mais" : "menos"} (${d.pct > 0 ? "+" : ""}${num(d.pct, 1)}%).`);
      }
      blocos.push(blocoLista(`Conferência — ${nome}`, [
        { rotulo: "Pedido", valor: q(d.pedido) }, { rotulo: "Chegou", valor: q(d.chegou) },
        { rotulo: "Diferença", valor: `${d.diferenca > 0 ? "+" : ""}${q(d.diferenca)}` },
      ]));
    } else {
      partes.push(`Chegou ${q(chegou.n)} de ${nome}.`);
    }
    if (temValor(m)) {
      const ped = m.detalhes.pedidos;
      if (ped.length) {
        partes.push(`Em Compras há ${ped.length} pedido(s) em aberto com ${nome}: ${ped.map((x) => `${num(x.quantidade)} ${ROT[x.unidade] || x.unidade}${x.data ? ` (${ddmm(x.data)})` : ""}`).join("; ")}.`);
        blocos.push(blocoLista("Pedidos em aberto (rascunho em Compras)", ped.map((x) => ({ rotulo: x.data ? ddmm(x.data) : "Compra", valor: `${num(x.quantidade)} ${ROT[x.unidade] || x.unidade}` }))));
      } else partes.push(`Não há compra em rascunho com ${nome} em Compras${d ? `, então o pedido de ${q(d.pedido)} não está lançado no Héfisto` : ""}.`);
    } else if (m.status === "insuficiente") partes.push(m.motivo);
    if (d?.situacao === "a_mais") partes.push(`Antes de guardar, confirme com o fornecedor se o excedente será cobrado. Se ficar, lance a compra com ${q(d.chegou)} para o estoque e o custo baterem com a nota.`);
    if (d?.situacao === "a_menos") partes.push(`Cobre o que faltou ou peça abatimento; lance a compra só com o que chegou (${q(d.chegou)}).`);
    const acoes = [{ rotulo: "Abrir Compras", rota: "/dashboard/operacao/estoque/compras" }];
    if (ins) acoes.unshift({ rotulo: `Dar entrada de ${q(chegou.n)}`, comando: `Dei entrada por recebimento de ${num(chegou.n)} ${un} de ${ins.nome}` });
    const out = r(partes.join(" "), blocos, acoes, d && d.situacao !== "igual" ? NIVEL.RECOMENDAR : NIVEL.OBSERVAR);
    if (ins) out.referencia = { produto: { id: ins.id, nome: ins.nome } };
    return out;
  },
};

// ─── RH: quem chegou no horário ──────────────────────────────────────────────
export const HANDLERS_RH = {
  async "rh.pontualidade"({ motor }) {
    const m = await motor.getPunctuality();
    if (!temValor(m)) return insuf(m, "Pontualidade");
    const { pessoas, foraDaEscala, agora } = m.detalhes;
    const ok = pessoas.filter((p) => p.situacao === "no_horario");
    const atras = pessoas.filter((p) => p.situacao === "atrasado");
    const falta = pessoas.filter((p) => p.situacao === "nao_chegou");
    const depois = pessoas.filter((p) => p.situacao === "ainda_nao_e_hora");
    const partes = [];
    if (!atras.length && !falta.length) {
      partes.push(ok.length ? `Sim. Todos que já deviam ter chegado bateram o ponto no horário (${ok.length}).` : "Ninguém tinha horário de entrada até agora.");
    } else {
      partes.push("Não.");
      if (atras.length) partes.push(`Atrasado: ${atras.map((p) => `${p.nome} ${p.minutos} min (entrou ${p.chegou}, entrada ${p.esperado})${p.tolerancia ? " — dentro da tolerância" : ""}`).join("; ")}.`);
      if (falta.length) partes.push(`Ainda não chegou: ${falta.map((p) => `${p.nome} (entrada ${p.esperado}, ${p.minutos} min de atraso até agora)`).join("; ")}.`);
      if (ok.length) partes.push(`No horário: ${ok.map((p) => p.nome).join(", ")}.`);
    }
    if (depois.length) partes.push(`Entram mais tarde: ${depois.map((p) => `${p.nome} às ${p.esperado}`).join(", ")}.`);
    const item = (p, valor, detalhe) => ({ rotulo: p.nome, valor, detalhe: [p.area, detalhe].filter(Boolean).join(" · ") });
    const blocos = [
      falta.length ? blocoLista(`Ainda não chegou (${falta.length})`, falta.map((p) => item(p, `+${p.minutos} min`, `entrada ${p.esperado}`))) : null,
      atras.length ? blocoLista(`Atrasado (${atras.length})`, atras.map((p) => item(p, `${p.minutos} min`, `entrou ${p.chegou} · entrada ${p.esperado}${p.tolerancia ? ` · tolerância de ${TOLERANCIA_MIN} min` : ""}`))) : null,
      ok.length ? blocoLista(`No horário (${ok.length})`, ok.map((p) => item(p, p.chegou, `entrada ${p.esperado}`))) : null,
      depois.length ? blocoLista(`Entram mais tarde (${depois.length})`, depois.map((p) => item(p, p.esperado, null))) : null,
      foraDaEscala.length ? blocoLista("Bateram ponto fora da escala de hoje", foraDaEscala.map((f) => ({ rotulo: f.nome, valor: f.chegou }))) : null,
      blocoTexto(`Apurado às ${agora}. ${m.observacoes.join(" ")}`, "De onde vem"),
    ].filter(Boolean);
    return r(partes.join(" "), blocos, [{ rotulo: "Abrir ponto", rota: "/dashboard/rh/ponto" }], atras.length || falta.length ? NIVEL.DETECTAR : NIVEL.OBSERVAR);
  },
};

// ─── Fichas: custo de X gramas e lucro a um preço ───────────────────────────
function fichaDaPergunta(params) {
  return params.produto ? { termo: params.produto } : params.fichaIdContexto ? { fichaId: params.fichaIdContexto } : null;
}

const rotuloRend = (q, u) => (u === "porcao" || /porc/.test(String(u)) ? `${num(q)} ${Number(q) === 1 ? "porção" : "porções"}` : `${num(q)} ${ROT[u] || u}`);

export const HANDLERS_FICHAS = {
  async "fichas.custo_quantidade"({ motor, params }) {
    const alvo = fichaDaPergunta(params);
    const qtd = params.quantidade ? `${num(params.quantidade)} ${params.unidade === "un" ? "porção(ões)" : ROT[params.unidade] || params.unidade || ""}`.trim() : null;
    if (!alvo) return { ...r("De qual receita?"), pergunta: { campo: "produto", livre: true, texto: "De qual receita ou prato?", comandoBase: qtd ? `Quanto custa ${qtd} de {valor}?` : "Quanto custa {valor}?" } };
    const m = await motor.getRecipeCost(alvo);
    if (!temValor(m)) return insuf(m, "Custo da ficha");
    const d = m.detalhes;
    const f = d.ficha;
    const parcial = m.status === "parcial" ? ` Atenção: ${m.observacoes[1] || "custo parcial."}` : "";
    const referencia = { ficha: { id: f.id, nome: f.nome } };
    const base = `${f.nome} custa ${brl(d.total)} e rende ${rotuloRend(f.rendimento, f.rendimentoUnidade)}${d.porUnidade != null ? ` (${brl(d.porUnidade)} por ${/porc/.test(String(f.rendimentoUnidade)) ? "porção" : ROT[f.rendimentoUnidade] || f.rendimentoUnidade})` : ""}.`;
    const blocos = [blocoLista(`Ingredientes — ${f.nome}`, d.linhas.map((l) => ({ rotulo: l.nome, valor: brl(l.custo), detalhe: `${num(l.quantidade)} ${ROT[String(l.unidade).toLowerCase()] || l.unidade}` })))];
    const acoes = [{ rotulo: "Abrir fichas técnicas", rota: "/dashboard/operacao/fichas" }];
    if (!params.quantidade) return { ...r(`${base}${parcial}`, blocos, acoes, NIVEL.ANALISAR), referencia };
    const conv = quantidadeNoRendimento({ quantidade: params.quantidade, unidade: params.unidade === "un" ? null : params.unidade, ficha: { rendimento_unidade: f.rendimentoUnidade, peso_porcao_g: f.pesoPorcaoG } });
    if (!conv || d.porUnidade == null) {
      return { ...r(`Não consigo calcular ${qtd}: ${f.nome} rende em ${f.rendimentoUnidade || "unidade não cadastrada"}${/porc/.test(String(f.rendimentoUnidade)) ? " e a ficha não tem o peso da porção" : ""}. ${base}`, blocos, acoes), referencia };
    }
    const valor = d.porUnidade * conv.q;
    return { ...r(`${qtd} de ${f.nome} custam ${brl(valor)}. ${base}${parcial}`, blocos, acoes, NIVEL.ANALISAR), referencia };
  },

  async "fichas.lucro_preco"({ motor, params }) {
    const alvo = fichaDaPergunta(params);
    if (!alvo) return { ...r("De qual prato?"), pergunta: { campo: "produto", livre: true, texto: "De qual prato você está falando?", comandoBase: params.quantidade ? `Vou vender {valor} por ${params.quantidade} reais` : "Vou vender {valor} por" } };
    const preco = Number(params.quantidade);
    const m = await motor.getRecipeCost(alvo);
    if (!temValor(m)) return insuf(m, "Custo do prato");
    const d = m.detalhes;
    const f = d.ficha;
    const referencia = { ficha: { id: f.id, nome: f.nome } };
    if (!(preco > 0)) return { ...r(`Por quanto você quer vender ${f.nome}?`), pergunta: { campo: "preco", livre: true, texto: `Por quanto vai vender ${f.nome}?`, comandoBase: `Vou vender ${f.nome} por {valor} reais` }, referencia };
    // custo de UMA venda: a porção (ou a porção pelo peso cadastrado)
    let custo = null;
    if (/porc/.test(String(f.rendimentoUnidade)) && d.porUnidade != null) custo = d.porUnidade;
    else if (f.pesoPorcaoG && d.porUnidade != null) custo = d.porUnidade * (quantidadeNoRendimento({ quantidade: f.pesoPorcaoG, unidade: "g", ficha: { rendimento_unidade: f.rendimentoUnidade } })?.q ?? NaN);
    else if (Number(f.rendimento) === 1) custo = d.total;
    if (!Number.isFinite(custo)) {
      return { ...r(`${f.nome} rende ${rotuloRend(f.rendimento, f.rendimentoUnidade)} e a ficha não diz o tamanho da porção vendida, então não sei o custo de uma venda. Cadastre o peso da porção na ficha.`, [], [{ rotulo: "Abrir fichas técnicas", rota: "/dashboard/operacao/fichas" }]), referencia };
    }
    const lucro = preco - custo;
    const cmv = (custo / preco) * 100;
    const texto = `Vendendo ${f.nome} por ${brl(preco)}, com custo de ${brl(custo)} por venda, o lucro bruto é ${brl(lucro)} (${num(100 - cmv, 1)}% do preço; CMV ${num(cmv, 1)}%). SIMULAÇÃO: não desconta impostos, taxa da maquininha, embalagem e mão de obra.${f.ehBase ? " Obs.: essa ficha está cadastrada como base." : ""}${m.status === "parcial" ? ` ${m.observacoes[1] || ""}` : ""}`;
    const blocos = [blocoLista(`Simulação — ${f.nome}`, [
      { rotulo: "Preço de venda", valor: brl(preco) },
      { rotulo: "Custo (ficha técnica)", valor: brl(custo) },
      { rotulo: "Lucro bruto por venda", valor: brl(lucro) },
      { rotulo: "CMV", valor: `${num(cmv, 1)}%` },
    ])];
    return { ...r(texto, blocos, [{ rotulo: "Abrir fichas técnicas", rota: "/dashboard/operacao/fichas" }], NIVEL.RECOMENDAR), referencia };
  },
};
