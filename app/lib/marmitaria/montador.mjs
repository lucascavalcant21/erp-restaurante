// CRIAR MARMITA (pedido do dono, 08/11/2026): "a ideia tem que ser simples,
// ganhar dinheiro. Peito de frango empanado, com e sem empanamento, valor do
// empanamento, do frango, da quantidade, arroz, batata, embalagem, custos, preço
// de venda, lucro, preço com desconto, combos com sobremesa e bebida ou só a
// marmita, descrição, foto: pronto para ganhar dinheiro."
//
// Uma tela só que, ao salvar, usa as peças que já existem: cada versão vira uma
// ficha técnica da marmitaria (marmitaria_salvar_ficha, com o preço da
// plataforma), o desconto vira uma oferta e os combos entram em
// marmitaria_combos. Nada de tabela nova.
//
// Funções puras (testes em montador.test.mjs). As contas de custo e lucro são as
// mesmas da Ficha técnica (custoDoForm) e da Precificação (lucroDoPedido,
// precoSugerido). Sem custo, sem preço: DADOS INSUFICIENTES.

import { novaChave } from "../contas-pagar.mjs";
import { parseNumero } from "../ficha-calculos.mjs";
import { custoDoForm, itensConvertidos, payloadDoForm } from "./formulario.mjs";
import { precoSugerido, r2 } from "./nucleo.mjs";
import { lucroDoPedido, normalizarCombo, normalizarOferta, veredito } from "./promocoes.mjs";

const valor = (t) => {
  const s = String(t ?? "").trim();
  if (!s) return null;
  const n = parseNumero(s);
  return Number.isFinite(n) ? n : null;
};

export const TIPOS_COMBO = [
  { id: "bebida", rotulo: "Marmita + bebida", modelo: "comida_bebida", grupos: ["bebida"] },
  { id: "sobremesa", rotulo: "Marmita + sobremesa", modelo: "comida_sobremesa", grupos: ["sobremesa"] },
  { id: "bebida_sobremesa", rotulo: "Marmita + bebida + sobremesa", modelo: "comida_bebida_sobremesa", grupos: ["bebida", "sobremesa"] },
];

export function montadorVazio() {
  return {
    idSem: novaChave(), idCom: novaChave(),
    nome: "", nomeCom: "", nomeComEditado: false, descricao: "", foto: "", categoria: "", tamanho: "M",
    proteina: null, empanar: false, vender: "os_dois", empanamento: [],
    acompanhamentos: [], embalagens: [],
    precoSem: "", precoCom: "", descontoPct: "",
    combos: [],
  };
}

/** Nome da versão empanada: "Peito de frango com arroz" → "Peito de frango empanado com arroz". */
export function nomeEmpanado(nome) {
  const s = String(nome || "").trim();
  if (!s) return "";
  if (/empanad/i.test(s)) return s;
  const m = s.match(/^(.*?)(\s+(com|e|ao|à|na|no)\s+.*)$/i);
  return m ? `${m[1]} empanado${m[2]}` : `${s} empanado`;
}

export function novoItem({ insumo_id = null, subficha_id = null, un = "g", qtd = "" } = {}) {
  return { key: novaChave(), insumo_id, subficha_id, qtd: String(qtd ?? ""), un, fator_correcao: 0 };
}

/**
 * As versões que vão para o cardápio. Sem empanamento: uma só. Com empanamento:
 * as duas (com e sem), ou só a empanada.
 */
export function versoesDoMontador(m) {
  const base = [m.proteina, ...(m.acompanhamentos || [])].filter(Boolean);
  const sem = { chave: "sem", id: m.idSem, nome: String(m.nome || "").trim(), itens: base, preco: m.precoSem };
  if (!m.empanar) return [sem];
  const com = { chave: "com", id: m.idCom, nome: String(m.nomeComEditado ? m.nomeCom : nomeEmpanado(m.nome)).trim(),
    itens: [m.proteina, ...(m.empanamento || []), ...(m.acompanhamentos || [])].filter(Boolean), preco: m.precoCom };
  return m.vender === "so_empanado" ? [com] : [sem, com];
}

/** A versão no formato do formulário da Ficha técnica (custoDoForm / payloadDoForm). */
export function formDaVersao(m, v, canalId) {
  const preco = valor(v.preco);
  return {
    id: v.id, novo: true, codigo: "", nome: v.nome, descricao: m.descricao || "", foto: m.foto || "",
    categoria: m.categoria || "", tamanho: m.tamanho || "M", peso: "", ativo: true,
    preco: preco === null ? "" : String(preco).replace(".", ","),
    itens: v.itens.map((i) => ({ key: i.key, insumo_id: i.insumo_id || null, subficha_id: i.subficha_id || null, qtd: i.qtd, un: i.un, fator_correcao: Number(i.fator_correcao) || 0 })),
    embalagens: (m.embalagens || []).map((e) => ({ key: e.key, insumo_id: e.insumo_id, qtd: e.qtd, tipo: e.tipo || "outra" })),
    precos: canalId && preco !== null ? { [canalId]: String(preco).replace(".", ",") } : {},
  };
}

/** Custo de uma lista de itens (sem embalagem): quanto custa o frango, o empanamento… */
export function custoDosItens(itens, ctx) {
  const c = custoDoForm({ itens: (itens || []).filter(Boolean), embalagens: [] }, ctx);
  return { total: c.total, linhas: c.linhas, pendencias: c.pendencias };
}

/**
 * A conta de uma versão: custo (comida + embalagem), preço sugerido pela meta,
 * lucro no preço cheio e com o desconto. O lucro desconta taxas da plataforma,
 * tributos, equipe e custos fixos por marmita (os mesmos da Precificação).
 */
export function contaDaVersao({ m, v, ctx, canal, tributosPct = null, embutidos = null, margemAlvoPct = null, lucroAlvoReais = null }) {
  const form = formDaVersao(m, v, canal?.id);
  const c = custoDoForm(form, ctx);
  const temItens = v.itens.some((i) => valor(i.qtd) > 0);
  // Item fora do cadastro ou com unidade que não converte some do custoDoForm:
  // aqui ele torna o custo incompleto, para o lucro não sair maior do que é.
  const perdidos = itensConvertidos(form, ctx).filter((i, k) => valor(form.itens[k].qtd) > 0 && !(i.quantidade > 0)
    || (i.insumo_id && !ctx.insumos.get(i.insumo_id)) || (i.subficha_id && !ctx.fichas.find((f) => f.id === i.subficha_id)));
  const pendencias = [...c.pendencias, ...(perdidos.length ? ["Um item não foi encontrado no cadastro ou está com a unidade errada."] : [])];
  const custo = temItens && c.total > 0 && pendencias.length === 0 ? c.total : null;
  const porMarmita = (embutidos?.cmoPorMarmita || 0) + (embutidos?.fixosPorMarmita || 0);
  const sugerido = custo === null ? { preco: null, motivo: temItens ? "Custo incompleto: confira os itens." : "Monte a marmita para ver o preço." }
    : precoSugerido({ custoTecnico: custo + porMarmita, canal, tributosPct, margemAlvoPct, lucroAlvoReais });
  const preco = valor(v.preco);
  const cheio = preco > 0 && custo !== null ? lucroDoPedido({ paga: preco, custo, canal, tributosPct, embutidos }) : null;
  const d = valor(m.descontoPct);
  const precoDesconto = preco > 0 && d > 0 && d < 100 ? r2(preco * (1 - d / 100)) : null;
  const comDesconto = precoDesconto && custo !== null ? lucroDoPedido({ paga: precoDesconto, custo, canal, tributosPct, embutidos }) : null;
  return {
    chave: v.chave, nome: v.nome, custo, custoParcial: c.total, alimentos: r2((c.alimentos || 0) + (c.prePreparos || 0)), embalagens: c.embalagens,
    pendencias, sugerido, preco, cheio, precoDesconto, comDesconto,
  };
}

/**
 * Combo da marmita com bebida e/ou sobremesa já cadastradas.
 * marmita: { preco, custo }; catalogo: { bebida: [], sobremesa: [] } (catalogoParaCombo).
 */
export function contaDoCombo({ combo, marmita, catalogo, canal, tributosPct = null, embutidos = null }) {
  const tipo = TIPOS_COMBO.find((t) => t.id === combo.tipo) || TIPOS_COMBO[0];
  const extras = tipo.grupos.map((g) => (catalogo?.[g] || []).find((i) => i.id === combo[`${g}_id`]) || null);
  if (extras.some((e) => !e)) return { ok: false, motivo: `Escolha ${tipo.grupos.map((g) => (g === "bebida" ? "a bebida" : "a sobremesa")).join(" e ")}.`, tipo };
  if (!(marmita?.custo > 0)) return { ok: false, motivo: "DADOS INSUFICIENTES: a marmita ainda não tem custo completo.", tipo, extras };
  const semCusto = extras.find((e) => !(e.custo > 0));
  if (semCusto) return { ok: false, motivo: `DADOS INSUFICIENTES: "${semCusto.nome}" está sem custo.`, tipo, extras };
  const separado = r2((marmita.preco || 0) + extras.reduce((t, e) => t + (e.preco || 0), 0));
  const custo = r2(marmita.custo + extras.reduce((t, e) => t + e.custo, 0));
  const preco = valor(combo.preco);
  const conta = preco > 0 ? lucroDoPedido({ paga: preco, custo, canal, tributosPct, embutidos }) : null;
  return {
    ok: true, tipo, extras, separado, custo, preco,
    economiaCliente: preco > 0 && separado > 0 ? r2(separado - preco) : null,
    lucro: conta?.lucro ?? null, lucroPct: conta?.lucroPct ?? null, prejuizo: conta?.lucro != null && conta.lucro < 0,
  };
}

/** O que falta para salvar (mensagens para o dono). */
export function errosDoMontador(m, ctx, canalId) {
  const erros = [];
  if (String(m.nome || "").trim().length < 2) erros.push("Dê um nome para a marmita.");
  if (!m.proteina) erros.push("Escolha a proteína.");
  if (m.empanar && !(m.empanamento || []).length) erros.push("Coloque os itens do empanamento (farinha, ovo…) ou desligue o empanamento.");
  if (!(m.embalagens || []).length) erros.push("Escolha a embalagem.");
  for (const v of versoesDoMontador(m)) {
    const { erros: e } = payloadDoForm(formDaVersao(m, v, canalId), ctx, "x");
    erros.push(...e.map((x) => (v.chave === "com" ? `Empanada: ${x}` : x)));
    if (!(valor(v.preco) > 0)) erros.push(`Informe o preço de venda${v.chave === "com" ? " da empanada" : ""}.`);
  }
  return [...new Set(erros)];
}

/**
 * Tudo o que o botão "Salvar" grava, sem tocar no banco:
 * - payloads da marmitaria_salvar_ficha (uma por versão, com o preço da plataforma);
 * - ofertas (desconto %) e combos, juntando com os que já existem (pelo id, para
 *   salvar de novo não duplicar).
 */
export function planoDeGravacao({ m, ctx, unidadeId, canalId, ofertasAtuais = [], combosAtuais = [] }) {
  const versoes = versoesDoMontador(m);
  const fichas = versoes.map((v) => payloadDoForm(formDaVersao(m, v, canalId), ctx, unidadeId).payload);
  const d = valor(m.descontoPct);
  const ids = new Set(versoes.map((v) => v.id));
  const ofertas = [
    ...ofertasAtuais.filter((o) => !ids.has(o.ficha_id) || !String(o.id).startsWith("montador-")),
    ...(d > 0 && d < 100 ? versoes.map((v) => normalizarOferta({ id: `montador-${v.id}`, ficha_id: v.id, tipo: "desconto_pct", valor: String(d) })) : []),
  ];
  const novosCombos = (m.combos || []).flatMap((c) => {
    const tipo = TIPOS_COMBO.find((t) => t.id === c.tipo) || TIPOS_COMBO[0];
    const v = versoes.find((x) => x.chave === c.versao) || versoes[0];
    if (!(valor(c.preco) > 0) || tipo.grupos.some((g) => !c[`${g}_id`])) return [];
    return [normalizarCombo({
      id: `montador-${c.id}`, nome: c.nome || `${v.nome} + ${tipo.grupos.map((g) => (g === "bebida" ? "bebida" : "sobremesa")).join(" + ")}`,
      modelo: tipo.modelo, preco: String(valor(c.preco)),
      itens: [{ grupo: "marmita", id: v.id }, ...tipo.grupos.map((g) => ({ grupo: g, id: c[`${g}_id`] }))],
    })];
  });
  const idsCombos = new Set(novosCombos.map((c) => c.id));
  const combos = [...combosAtuais.filter((c) => !idsCombos.has(c.id)), ...novosCombos];
  return { fichas, ofertas, combos, versoes: versoes.map((v) => ({ id: v.id, nome: v.nome })) };
}

/**
 * Bateu a meta? Com meta em R$ por marmita (Configurações), compara o lucro em
 * reais — a mesma meta que gera o preço sugerido. Sem ela, a meta em %.
 */
export function vereditoDaVersao(conta, { margemAlvoPct = null, lucroAlvoReais = null } = {}) {
  if (conta.custo === null) return { id: "sem_dados", rotulo: "Dados insuficientes" };
  if (!conta.cheio) return { id: "sem_dados", rotulo: "Sem preço" };
  const meta = valor(lucroAlvoReais);
  if (meta > 0) {
    const l = conta.cheio.lucro;
    if (l == null) return { id: "sem_dados", rotulo: "Dados insuficientes" };
    if (l < 0) return { id: "prejuizo", rotulo: "Prejuízo" };
    if (l + 0.005 >= meta) return { id: "ok", rotulo: "Meta alcançada" };
    return { id: "baixo", rotulo: `Abaixo da meta (R$ ${meta.toFixed(2).replace(".", ",")})` };
  }
  return veredito(conta.cheio.lucroPct ?? null, margemAlvoPct, false, null);
}
