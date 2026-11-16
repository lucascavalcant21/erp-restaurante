// "Como são nossas marmitas? Quem está ganhando quanto por ela? Qual é o
// componente mais caro?" (dono, 16/11/2026). O Jhon e o Nico respondem com o
// raio-x do preço da marmitaria (lib/marmitaria/raio-x.mjs): a mesma conta da
// Precificação, lida pelo banco escopado da unidade. Só leitura.
//
// Permissão: quem vê a margem na marmitaria (capacidade lucro_marmitaria).
// A equipe aparece só como total por marmita, nunca o salário de alguém.

import { NIVEL } from "../core/niveis.mjs";
import { ler } from "../context/db-escopado.mjs";
import { CAMPOS_INSUMO_CUSTO, carregarFichasComCusto } from "../metrics/assistente.mjs";
import { cmoMarmitaria, custoDaMarmita, encargosDaConfig, normalizarCanal } from "../../marmitaria/nucleo.mjs";
import { custosEmbutidos, mesAnterior } from "../../marmitaria/cardapio.mjs";
import { guiaDeMontagem } from "../../marmitaria/processos.mjs";
import { canalDaPergunta, itensDoRaioX, raioXDaMarmita, resumoDasMarmitas, textoDoRaioX } from "../../marmitaria/raio-x.mjs";

const ROTA_PRECO = "/dashboard/marmitaria/marmitas/cardapio";
const ROTA_CUSTOS = "/dashboard/marmitaria/configuracoes/custos";
const r = (texto, blocos = [], acoes = [], natureza = "ESTIMATIVA") => ({ texto, blocos, acoes, natureza, nivel: NIVEL.OBSERVAR, agentes: ["operacoes"] });
const n = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

const tentar = async (p) => { try { return await p; } catch (e) { if (e?.name === "ErroDeIsolamento") throw e; return null; } };

/** Tudo o que o raio-x precisa, lido pela unidade da sessão. */
export async function carregarDadosDaMarmitaria(dbe, hoje) {
  const cfgRows = await ler(dbe.from("marmitaria_configuracoes").select("canais, tributos_pct, rateio, encargos").limit(1), "marmitaria_configuracoes");
  const cfg = cfgRows?.[0] || {};
  const rateio = cfg.rateio && typeof cfg.rateio === "object" ? cfg.rateio : {};
  const { todas } = await carregarFichasComCusto(dbe);
  const marmitasBase = todas.filter((f) => f.departamento === "marmitaria" && f.ativo !== false && f.status !== "arquivada");
  const ids = marmitasBase.map((m) => m.id);
  const [emb, precos] = await Promise.all([
    ids.length ? tentar(ler(dbe.from("marmitaria_fichas_embalagens").select("ficha_id, embalagem_insumo_id, quantidade").in("ficha_id", ids), "marmitaria_fichas_embalagens")) : [],
    ids.length ? tentar(ler(dbe.from("marmitaria_precificacao_canais").select("ficha_id, canal, preco_venda").in("ficha_id", ids), "marmitaria_precificacao_canais")) : [],
  ]);
  const idsInsumos = new Set();
  for (const f of todas) for (const fi of f.fichas_ingredientes || []) if (fi.insumo_id) idsInsumos.add(fi.insumo_id);
  for (const e of emb || []) if (e.embalagem_insumo_id) idsInsumos.add(e.embalagem_insumo_id);
  const insumosLista = idsInsumos.size ? (await ler(dbe.from("insumos").select(CAMPOS_INSUMO_CUSTO).in("id", [...idsInsumos]), "insumos")) || [] : [];
  const insumos = new Map(insumosLista.map((i) => [i.id, i]));
  const marmitas = marmitasBase.map((f) => ({
    ...f,
    itens: (f.fichas_ingredientes || []).map((fi) => ({ insumo_id: fi.insumo_id || null, subficha_id: fi.subficha_id || null, quantidade: Number(fi.quantidade) || 0, fator_correcao: Number(fi.fator_correcao) || 0 })),
    embalagens: (emb || []).filter((e) => e.ficha_id === f.id && e.embalagem_insumo_id).map((e) => ({ insumo_id: e.embalagem_insumo_id, quantidade: Number(e.quantidade) || 0 })),
    precos: Object.fromEntries((precos || []).filter((p) => p.ficha_id === f.id).map((p) => [p.canal, Number(p.preco_venda)])),
  }));

  // Equipe: o valor digitado em Custos manda; senão, as alocações do RH (mês passado).
  const mes = mesAnterior(hoje);
  let cmoMes = 0;
  let pessoas = null;
  const [aloc, vendas] = await Promise.all([
    tentar(ler(dbe.from("marmitaria_rh_alocacoes").select("colaborador_id, tipo_alocacao, percentual_tempo, horas_por_semana, ativo"), "marmitaria_rh_alocacoes")),
    tentar(ler(dbe.from("marmitaria_vendas").select("quantidade, data").gte("data", `${mes}-01`).lte("data", `${mes}-31`), "marmitaria_vendas")),
  ]);
  const ativas = (aloc || []).filter((a) => a.ativo !== false);
  if (ativas.length) pessoas = ativas.length;
  if (n(rateio.cmo_mes) == null && ativas.length) {
    const [col, rec] = await Promise.all([
      tentar(ler(dbe.from("colaboradores").select("id, nome, cargo, status, data_desligamento, tipo_contrato, salario, vale_alimentacao, usa_vale_transporte, vale_transporte_val").in("id", ativas.map((a) => a.colaborador_id)), "colaboradores")),
      tentar(ler(dbe.from("rh_recibos_prestacao").select("colaborador_id, valor_total, pagamento_realizado, data_pagamento, data_trabalho").gte("data_trabalho", `${mes}-01`), "rh_recibos_prestacao")),
    ]);
    if (col) cmoMes = cmoMarmitaria({ alocacoes: ativas, colaboradores: col, recibos: rec || [], encargos: encargosDaConfig(cfg.encargos || {}), mes }).total || 0;
  }
  const vendidasMes = (vendas || []).reduce((t, v) => t + (Number(v.quantidade) || 0), 0);
  const embutidos = custosEmbutidos({ cmoMes, vendidasMes, config: { rateio } });
  const tributosPct = rateio.regime === "mei" ? 0 : n(cfg.tributos_pct);
  return { canais: (cfg.canais || []).map(normalizarCanal).filter((c) => c.id), marmitas, fichas: todas, insumos, embutidos, tributosPct, pessoas, temConfig: cfgRows?.length > 0 };
}

function raioX(d, marmita, texto) {
  const canal = canalDaPergunta(d.canais, texto, marmita);
  const custo = custoDaMarmita({ itens: marmita.itens, embalagens: marmita.embalagens, fichas: d.fichas, insumos: d.insumos });
  return raioXDaMarmita({ marmita, custo, canal, tributosPct: d.tributosPct, embutidos: d.embutidos, pessoasEquipe: d.pessoas });
}

/** "Frango empanado" dentro da frase → a marmita; só quando uma ganha das outras. */
const PARADAS = new Set(["com", "sem", "de", "da", "do", "das", "dos", "e", "a", "o", "marmita", "marmitas", "quentinha", "na", "no"]);
const fold = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function marmitaDaFrase(marmitas, texto) {
  const palavras = new Set(fold(texto).split(/[^a-z0-9]+/).filter(Boolean));
  const notas = marmitas.map((m) => {
    const tokens = fold(m.nome_receita || m.nome_comercial).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !PARADAS.has(t));
    return { m, nota: tokens.filter((t) => palavras.has(t) || palavras.has(`${t}s`) || palavras.has(t.replace(/s$/, ""))).length };
  }).filter((x) => x.nota > 0).sort((a, b) => b.nota - a.nota);
  if (!notas.length || (notas[1] && notas[1].nota === notas[0].nota)) return null;
  return notas[0].m;
}

export const HANDLERS_MARMITARIA = {
  async "marmitaria.raio_x"({ motor, params }) {
    const amb = motor.ambiente;
    if (!(await amb.verificador.pode("lucro_marmitaria"))) {
      return r("Você não tem acesso à margem da marmitaria. Quem vê a Precificação da marmitaria consegue essa conta.", [], [], "REAL");
    }
    const texto = params.texto || "";
    const d = await carregarDadosDaMarmitaria(amb.dbe, amb.hoje);
    if (!d.marmitas.length) {
      return r("DADOS INSUFICIENTES: não há marmita cadastrada nesta unidade. Cadastre a ficha técnica de cada uma (o que vai e quanto) e o preço.", [], [{ rotulo: "Abrir a ficha técnica", rota: "/dashboard/marmitaria/marmitas" }], "REAL");
    }
    const alvo = params.marmitaId ? d.marmitas.find((m) => m.id === params.marmitaId) : marmitaDaFrase(d.marmitas, texto);
    const acoes = [{ rotulo: "Abrir a precificação", rota: ROTA_PRECO }];
    if (alvo) {
      const rx = raioX(d, alvo, texto);
      if (!rx.valido) return r(textoDoRaioX(rx), [], [{ rotulo: "Abrir a ficha técnica", rota: "/dashboard/marmitaria/marmitas" }], "REAL");
      if (rx.faltando.length) acoes.push({ rotulo: "Completar os custos", rota: ROTA_CUSTOS });
      return {
        ...r(textoDoRaioX(rx), [{ tipo: "lista", titulo: `Para onde vão os ${rx.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, itens: itensDoRaioX(rx) }], acoes, rx.natureza),
        sugestoes: [rx.maisCaro ? `Como baixar o custo de ${rx.maisCaro.rotulo}?` : null, "Como são nossas marmitas?"].filter(Boolean),
      };
    }
    const resumo = resumoDasMarmitas(d.marmitas.map((m) => raioX(d, m, texto)));
    return {
      ...r(resumo.texto, resumo.itens.length ? [{ tipo: "lista", titulo: "Lucro por marmita", itens: resumo.itens }] : [], acoes, resumo.natureza),
      sugestoes: d.marmitas.slice(0, 2).map((m) => `Raio-x da marmita ${m.nome_receita}`),
    };
  },

  // "Nico, como monta a marmita de frango?": o guia de montagem (sem custo).
  async "marmitaria.montagem"({ motor, params }) {
    const amb = motor.ambiente;
    if (!(await amb.verificador.pode("fichas_marmitaria"))) return r("Você não tem acesso às fichas da marmitaria.", [], [], "REAL");
    const texto = params.texto || "";
    const { todas } = await carregarFichasComCusto(amb.dbe);
    const marmitasBase = todas.filter((f) => f.departamento === "marmitaria" && f.ativo !== false && f.status !== "arquivada");
    const alvo = marmitaDaFrase(marmitasBase, texto);
    if (!alvo) {
      if (!marmitasBase.length) return r("DADOS INSUFICIENTES: não há marmita cadastrada nesta unidade.", [], [], "REAL");
      return {
        ...r("Qual marmita?", [], [], "REAL"),
        pergunta: { campo: "marmita", texto: "Qual marmita você vai montar?", opcoes: marmitasBase.slice(0, 8).map((m) => ({ id: m.id, rotulo: m.nome_receita, comando: `Como monta a marmita ${m.nome_receita}?` })) },
      };
    }
    const [emb, cfg] = await Promise.all([
      tentar(ler(amb.dbe.from("marmitaria_fichas_embalagens").select("ficha_id, embalagem_insumo_id, quantidade").eq("ficha_id", alvo.id), "marmitaria_fichas_embalagens")),
      tentar(ler(amb.dbe.from("config_sistema").select("params").limit(1), "config_sistema")),
    ]);
    const ids = new Set([...(alvo.fichas_ingredientes || []).map((fi) => fi.insumo_id), ...(emb || []).map((e) => e.embalagem_insumo_id)].filter(Boolean));
    const insumos = new Map(((ids.size ? await ler(amb.dbe.from("insumos").select(CAMPOS_INSUMO_CUSTO).in("id", [...ids]), "insumos") : []) || []).map((i) => [i.id, i]));
    const marmita = {
      ...alvo,
      itens: (alvo.fichas_ingredientes || []).map((fi) => ({ insumo_id: fi.insumo_id || null, subficha_id: fi.subficha_id || null, quantidade: Number(fi.quantidade) || 0 })),
      embalagens: (emb || []).map((e) => ({ insumo_id: e.embalagem_insumo_id, quantidade: Number(e.quantidade) || 0 })),
    };
    const g = guiaDeMontagem({ marmita, processo: cfg?.[0]?.params?.marmitaria_processos?.[alvo.id], insumos, fichas: todas });
    const blocos = [];
    if (g.componentes.length) blocos.push({ tipo: "lista", titulo: `O que vai${g.peso ? ` (peso final ${g.peso})` : ""}`, itens: g.componentes.map((c) => ({ rotulo: c.nome, valor: c.quantidade })) });
    if (g.embalagens.length) blocos.push({ tipo: "lista", titulo: "Embalagens", itens: g.embalagens.map((e) => ({ rotulo: e.nome, valor: `${e.quantidade} un` })) });
    for (const grupo of g.etapas) blocos.push({ tipo: "lista", titulo: grupo.rotulo, itens: grupo.itens.map((e, i) => ({ rotulo: `${i + 1}. ${e.titulo || "Passo"}`, detalhe: e.texto || null })) });
    const linhas = g.componentes.map((c) => `${c.nome}: ${c.quantidade}`).join("; ");
    const texto2 = [
      `${g.nome}${g.peso ? ` (${g.peso})` : ""}: ${linhas || "a ficha técnica ainda não diz o que vai"}.`,
      g.embalagens.length ? `Embalagem: ${g.embalagens.map((e) => `${e.quantidade} ${e.nome}`).join(", ")}.` : null,
      g.faltando.length ? `Ainda não cadastraram ${g.faltando.join(" e ")}: confirme com o responsável.` : null,
    ].filter(Boolean).join(" ");
    return r(texto2, blocos, [{ rotulo: "Abrir o guia de montagem", rota: "/dashboard/marmitaria/marmitas/processos" }], "REAL");
  },
};
