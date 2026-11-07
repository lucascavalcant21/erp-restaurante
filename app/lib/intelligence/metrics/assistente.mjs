// MÉTRICAS DO ASSISTENTE HÉFISTO — pontualidade da equipe, conferência de
// recebimento e custo de ficha técnica (por quantidade e por preço de venda).
//
// Tudo determinístico e com as MESMAS regras do ERP:
//   - escala: app/lib/escala-dia.mjs (a do RH e da janta);
//   - custo de ficha: custoDeProduzirFicha (ficha-calculos.mjs), a conta da
//     tela de fichas, inclusive subfichas (bases) e perda do cadastro;
//   - compra em aberto: compras_itens do rascunho (quantidade pedida).
// Nada é estimado sem dizer: custo sem preço de algum ingrediente sai como
// dado parcial, com o nome do que falta.

import { metrica, insuficiente, CONFIANCA, NATUREZA } from "../core/contratos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { montarEscala } from "../../escala-dia.mjs";
import { custoDeProduzirFicha, custoUnitarioEfetivoInsumo } from "../../ficha-calculos.mjs";
import { candidatosDoTermo, CAMPOS_INSUMO } from "./produtos.mjs";
import { medir, fonte, r2 } from "./base.mjs";

// ─── Pontualidade ────────────────────────────────────────────────────────────

/** CLT art. 58, § 1º: variações de até 5 min no registro não são computadas (limite de 10 min no dia). */
export const TOLERANCIA_MIN = 5;

export const paraMinutos = (hhmm) => {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Minutos desde a meia-noite no fuso da unidade. */
export function minutosNoFuso(data, fuso) {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: fuso, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(data);
  const h = Number(partes.find((p) => p.type === "hour")?.value) % 24;
  const m = Number(partes.find((p) => p.type === "minute")?.value);
  return h * 60 + m;
}

const hhmm = (min) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((min % 60) + 60) % 60).padStart(2, "0")}`;

/**
 * Quem chegou no horário, atrasado (minutos exatos), quem ainda não chegou e
 * quem ainda não está na hora. Pura: testável sem banco.
 * @param {{ trabalham: object[] }} escala  montarEscala(...)
 * @param {object[]} registros               registro_ponto do dia
 * @param {number} agoraMin                  minutos de agora no fuso
 * @param {string} fuso
 */
export function avaliarPontualidade({ escala, registros, agoraMin, fuso }) {
  const porColab = new Map();
  for (const r of registros || []) {
    if (!r?.hora_entrada) continue;
    const atual = porColab.get(r.colaborador_id);
    if (!atual || String(r.hora_entrada) < String(atual.hora_entrada)) porColab.set(r.colaborador_id, r);
  }
  const pessoas = [];
  const naEscala = new Set();
  for (const p of escala.trabalham || []) {
    naEscala.add(p.id);
    const esperado = paraMinutos(p.entrada);
    const reg = porColab.get(p.id);
    const base = { id: p.id, nome: p.nome, area: p.area || p.cargo || null, esperado: p.entrada };
    if (esperado == null) continue;
    if (reg) {
      const chegou = minutosNoFuso(new Date(reg.hora_entrada), fuso);
      let dif = chegou - esperado;
      if (dif < -720) dif += 1440; // virou o dia (turno da noite)
      if (dif > 720) dif -= 1440;
      pessoas.push({ ...base, chegou: hhmm(chegou), minutos: dif, situacao: dif > 0 ? "atrasado" : "no_horario", tolerancia: dif > 0 && dif <= TOLERANCIA_MIN });
    } else if (agoraMin >= esperado) {
      pessoas.push({ ...base, chegou: null, minutos: agoraMin - esperado, situacao: "nao_chegou" });
    } else {
      pessoas.push({ ...base, chegou: null, minutos: esperado - agoraMin, situacao: "ainda_nao_e_hora" });
    }
  }
  const fora = [...porColab.values()].filter((r) => !naEscala.has(r.colaborador_id)).map((r) => ({ id: r.colaborador_id, chegou: hhmm(minutosNoFuso(new Date(r.hora_entrada), fuso)) }));
  const ordem = { nao_chegou: 0, atrasado: 1, no_horario: 2, ainda_nao_e_hora: 3 };
  pessoas.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || b.minutos - a.minutos || a.nome.localeCompare(b.nome, "pt-BR"));
  return { pessoas, foraDaEscala: fora };
}

export function pontualidadeDoDia(amb) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: "hoje" };
  return medir(amb, { id: "pontualidade", capacidade: "ponto", periodo }, async (consultas) => {
    const fontes = [fonte("colaboradores", "Horário de entrada do cadastro"), fonte("rh_folgas_esporadicas", "Folgas lançadas"), fonte("registro_ponto", "Ponto batido hoje")];
    const colaboradores = (await ler(amb.dbe.from("colaboradores").select("id, nome, cargo, status, data_admissao, data_desligamento, dias_trabalho, horario_entrada, horario_saida, horario_dom_entrada, horario_dom_saida, horario_por_dia, horarios_dia, area_escala, setor_entrega, ordem_escala"), "colaboradores")) || [];
    let folgas = [];
    try {
      folgas = (await ler(amb.dbe.from("rh_folgas_esporadicas").select("colaborador_id, data_folga, descricao").eq("data_folga", amb.hoje), "rh_folgas_esporadicas")) || [];
    } catch (e) { if (!e.ausente) throw e; }
    const registros = (await ler(amb.dbe.from("registro_ponto").select("colaborador_id, data_referencia, hora_entrada, hora_saida").eq("data_referencia", amb.hoje), "registro_ponto")) || [];
    const escala = montarEscala({ colaboradores, folgas, data: amb.hoje });
    if (!escala.trabalham.length) {
      return insuficiente({ metrica: "pontualidade", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: colaboradores.length ? "Ninguém está na escala de hoje pelo cadastro (dias e horário de trabalho)." : "Nenhum colaborador cadastrado nesta unidade.",
        faltando: ["dias de trabalho e horário de entrada no cadastro do colaborador"] });
    }
    const av = avaliarPontualidade({ escala, registros, agoraMin: minutosNoFuso(amb.agora, amb.fuso), fuso: amb.fuso });
    const nomes = new Map(colaboradores.map((c) => [c.id, c.nome]));
    av.foraDaEscala = av.foraDaEscala.map((f) => ({ ...f, nome: nomes.get(f.id) || "Colaborador" }));
    const problemas = av.pessoas.filter((p) => p.situacao === "atrasado" || p.situacao === "nao_chegou").length;
    const observacoes = [`Horário combinado = entrada do cadastro do colaborador. Tolerância legal: até ${TOLERANCIA_MIN} min (CLT art. 58, § 1º) — o atraso aparece com o minuto exato, a tolerância só é indicada.`];
    if (escala.semHorario.length) observacoes.push(`${escala.semHorario.length} colaborador(es) sem horário no cadastro ficaram de fora.`);
    return metrica({
      metrica: "pontualidade", valor: problemas, unidade: "pessoas", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: escala.semHorario.length ? 0.9 : 1, confianca: escala.semHorario.length ? CONFIANCA.MEDIA : CONFIANCA.ALTA, natureza: NATUREZA.REAL,
      apuradoEm: amb.apuradoEm, observacoes, detalhes: { ...av, folgas: escala.folgas, agora: hhmm(minutosNoFuso(amb.agora, amb.fuso)) },
    });
  });
}

// ─── Conferência de recebimento ──────────────────────────────────────────────

/** "Chegou 3, era para pedir 2": diferença do que a pessoa disse. Pura. */
export function divergenciaRecebimento(chegou, pedido) {
  const c = Number(chegou);
  const p = Number(pedido);
  if (!(c > 0) || !(p > 0)) return null;
  const diferenca = Math.round((c - p) * 1000) / 1000;
  return { chegou: c, pedido: p, diferenca, pct: Math.round((diferenca / p) * 1000) / 10, situacao: diferenca > 0 ? "a_mais" : diferenca < 0 ? "a_menos" : "igual" };
}

const PARA_UNIDADE = { g: { kg: 0.001, g: 1 }, ml: { l: 0.001, ml: 1 }, un: { un: 1 } };

export function conferenciaRecebimento(amb, { termo, frase = null }) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: "compras em aberto" };
  return medir(amb, { id: "conferencia_recebimento", capacidade: "compras", periodo }, async (consultas) => {
    const fontes = [fonte("insumos", "Cadastro do produto"), fonte("vw_compras", "Compras em rascunho"), fonte("compras_itens", "Quantidade pedida")];
    const insumos = (await ler(amb.dbe.from("insumos").select(CAMPOS_INSUMO).order("nome"), "insumos")) || [];
    const c = candidatosDoTermo(insumos, termo || "", 8, { frase });
    if (!c.length) {
      return insuficiente({ metrica: "conferencia_recebimento", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `Não encontrei "${termo}" no cadastro desta unidade.`, faltando: ["produto no cadastro"] });
    }
    const insumo = c[0];
    const abertas = (await ler(amb.dbe.from("vw_compras").select("id, data_compra, status, fornecedor_id").eq("status", "rascunho"), "vw_compras")) || [];
    const ids = abertas.map((x) => x.id);
    const itens = ids.length ? ((await ler(amb.dbe.from("compras_itens").select("compra_id, insumo_id, quantidade_embalagens, quantidade_pedida_embalagens, conteudo_por_embalagem, unidade_base").in("compra_id", ids).eq("insumo_id", insumo.id), "compras_itens")) || []) : [];
    const unSaldo = String(insumo.unidade_medida || "").toLowerCase();
    const pedidos = itens.map((it) => {
      const emb = Number(it.quantidade_pedida_embalagens ?? it.quantidade_embalagens);
      const base = emb * (Number(it.conteudo_por_embalagem) || 0);
      const fator = PARA_UNIDADE[String(it.unidade_base || "").toLowerCase()]?.[unSaldo];
      const compra = abertas.find((x) => x.id === it.compra_id);
      return Number.isFinite(base) && base > 0 ? { compraId: it.compra_id, data: String(compra?.data_compra || "").slice(0, 10), quantidade: fator ? r2(base * fator) : base, unidade: fator ? unSaldo : it.unidade_base } : null;
    }).filter(Boolean);
    return metrica({
      metrica: "conferencia_recebimento", valor: pedidos.length, unidade: "pedidos em aberto", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, natureza: NATUREZA.REAL, apuradoEm: amb.apuradoEm,
      observacoes: ["Pedido em aberto = compra em rascunho em Compras com este produto."],
      detalhes: { insumo: { id: insumo.id, nome: insumo.nome, unidade: insumo.unidade_medida }, pedidos, outros: c.slice(1, 4).map((x) => x.nome) },
    });
  });
}

// ─── Custo de ficha técnica ──────────────────────────────────────────────────

export const CAMPOS_FICHA_CUSTO = "id, nome_receita, nome_comercial, nome_interno, departamento, eh_base, tipo_base, rendimento_porcoes, rendimento_unidade, peso_porcao_g, preco_venda, custo_embalagens_total, ativo, status";
export const CAMPOS_INSUMO_CUSTO = "id, nome, nome_interno, departamento, unidade_medida, custo_unitario, custo_compra, preco_normalizado, tamanho_embalagem, perda_pct, perda_g, peso_bruto_padrao, empanado, ganho_pct, custo_empanado_kg";

/** Fichas da unidade com ingredientes e insumos no formato de custoDeProduzirFicha. */
export async function carregarFichasComCusto(dbe) {
  const fichas = (await ler(dbe.from("fichas_tecnicas").select(CAMPOS_FICHA_CUSTO), "fichas_tecnicas")) || [];
  const ids = fichas.map((f) => f.id);
  const ings = ids.length ? ((await ler(dbe.from("fichas_ingredientes").select("ficha_id, insumo_id, subficha_id, quantidade, fator_correcao").in("ficha_id", ids), "fichas_ingredientes")) || []) : [];
  const idsIns = [...new Set(ings.map((i) => i.insumo_id).filter(Boolean))];
  const insumos = idsIns.length ? new Map(((await ler(dbe.from("insumos").select(CAMPOS_INSUMO_CUSTO).in("id", idsIns), "insumos")) || []).map((i) => [i.id, i])) : new Map();
  const porFicha = new Map();
  for (const i of ings) porFicha.set(i.ficha_id, [...(porFicha.get(i.ficha_id) || []), { ...i, insumos: i.insumo_id ? insumos.get(i.insumo_id) || null : null }]);
  const todas = fichas.map((f) => ({ ...f, nome: f.nome_receita || f.nome_comercial, fichas_ingredientes: porFicha.get(f.id) || [] }));
  return { todas, ativas: todas.filter((f) => f.ativo !== false && f.status !== "arquivada") };
}

const UN_RENDIMENTO = { kg: "kg", quilo: "kg", quilos: "kg", g: "g", gramas: "g", l: "l", litro: "l", litros: "l", ml: "ml" };
export const unidadeDoRendimento = (u) => UN_RENDIMENTO[String(u || "").trim().toLowerCase()] || null;

/**
 * Custo de uma ficha: total, por unidade do rendimento e por linha.
 * Ingrediente sem preço no cadastro ou que não existe mais → listado (parcial).
 */
export function custoDetalhado(ficha, todas) {
  const linhas = [];
  const semPreco = [];
  for (const fi of ficha.fichas_ingredientes || []) {
    const custo = custoDeProduzirFicha({ id: `${ficha.id}:linha`, fichas_ingredientes: [fi] }, todas);
    if (fi.subficha_id) {
      const b = todas.find((x) => x.id === fi.subficha_id);
      linhas.push({ nome: b ? `${b.nome} (base)` : "Base não encontrada", quantidade: Number(fi.quantidade), unidade: b?.rendimento_unidade || "", custo: r2(custo) });
      if (!b) semPreco.push("base não encontrada");
    } else if (fi.insumos) {
      linhas.push({ nome: fi.insumos.nome, quantidade: Number(fi.quantidade), unidade: fi.insumos.unidade_medida, custo: r2(custo) });
      if (!(custoUnitarioEfetivoInsumo(fi.insumos) > 0)) semPreco.push(fi.insumos.nome);
    } else {
      semPreco.push("ingrediente fora do cadastro");
    }
  }
  const total = custoDeProduzirFicha(ficha, todas);
  const rendimento = Number(ficha.rendimento_porcoes) || 0;
  return { total: r2(total), porUnidade: rendimento > 0 ? total / rendimento : null, rendimento, unidade: ficha.rendimento_unidade || "porção", linhas, semPreco };
}

/** Converte quantidade pedida para a unidade do rendimento (g↔kg, ml↔l, porção pelo peso). */
export function quantidadeNoRendimento({ quantidade, unidade, ficha }) {
  const q = Number(quantidade);
  const de = unidadeDoRendimento(unidade);
  const para = unidadeDoRendimento(ficha.rendimento_unidade);
  if (!(q > 0)) return null;
  if (!de) return { q, rotulo: `${q} ${ficha.rendimento_unidade || "porção(ões)"}` }; // porções: na unidade da ficha
  if (para) {
    const fat = { "g>kg": 0.001, "kg>g": 1000, "ml>l": 0.001, "l>ml": 1000 }[`${de}>${para}`] ?? (de === para ? 1 : null);
    return fat == null ? null : { q: q * fat };
  }
  // ficha em porções: só com peso da porção cadastrado
  const g = de === "kg" ? q * 1000 : de === "g" ? q : null;
  const peso = Number(ficha.peso_porcao_g);
  return g != null && peso > 0 ? { q: g / peso } : null;
}

export function custoDeFicha(amb, { termo = null, fichaId = null, frase = null } = {}) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: "custo atual do cadastro" };
  return medir(amb, { id: "custo_ficha", capacidade: "custo_fichas", periodo }, async (consultas) => {
    const fontes = [fonte("fichas_tecnicas", "Ficha técnica"), fonte("fichas_ingredientes", "Ingredientes e quantidades"), fonte("insumos", "Preço de compra do cadastro")];
    const { todas, ativas } = await carregarFichasComCusto(amb.dbe);
    const ficha = fichaId ? ativas.find((f) => f.id === fichaId) : candidatosDoTermo(ativas, termo || "", 8, { frase })[0];
    if (!ficha) {
      return insuficiente({ metrica: "custo_ficha", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: termo ? `Não há ficha técnica "${termo}" nesta unidade.` : "Não sei de qual ficha você está falando.", faltando: ["ficha técnica"] });
    }
    const c = custoDetalhado(ficha, todas);
    if (!c.linhas.length) {
      return insuficiente({ metrica: "custo_ficha", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `A ficha "${ficha.nome}" não tem ingredientes cadastrados.`, faltando: ["ingredientes da ficha"] });
    }
    const observacoes = ["Custo pelo preço de compra atual do cadastro e a perda de cada ingrediente — a mesma conta da tela de fichas."];
    if (c.semPreco.length) observacoes.push(`Sem preço no cadastro: ${c.semPreco.join(", ")}. O custo está abaixo do real.`);
    return metrica({
      metrica: "custo_ficha", valor: c.total, unidade: "BRL", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: c.semPreco.length ? 0.8 : 1, confianca: c.semPreco.length ? CONFIANCA.MEDIA : CONFIANCA.ALTA, natureza: NATUREZA.REAL,
      apuradoEm: amb.apuradoEm, observacoes,
      detalhes: {
        ficha: { id: ficha.id, nome: ficha.nome, ehBase: ficha.eh_base === true, rendimento: c.rendimento, rendimentoUnidade: c.unidade, pesoPorcaoG: Number(ficha.peso_porcao_g) || null, precoVenda: Number(ficha.preco_venda) || null, departamento: ficha.departamento || null },
        ...c,
      },
    });
  });
}
