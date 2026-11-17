// AÇÃO production.plan — "Jhon, amanhã precisamos produzir 300 filés de frango
// empanado; 150 vão ser parmegianas; amanhã é dia de limpar as fritadeiras"
// (HDEV-015, dono 17/11/2026).
//
//   pedido → fichas técnicas → prévia com:
//     • o que vai em cada produção (frango, farinha, leite…);
//     • o que fabricar antes (molho), descontando o que já tem pronto;
//     • a limpeza e os materiais (óleo, sal, água), pela ficha de limpeza;
//     • o que falta comprar (estoque da marmitaria), com valor ESTIMATIVA;
//   → confirmar → plano do dia daquela data (hefisto_aprovar_plano_dia):
//     a equipe vê as tarefas no Nico, na ordem (fabricar antes de usar).
// A conta é a das fichas (REAL do cadastro); nada é inventado. Gravar é só
// o plano (as tarefas); estoque e compras não mudam aqui.

import { s } from "../schemas/schema.mjs";
import { hojeNoFuso } from "./lancar-nota.mjs";
import { carregarProducao, num } from "../agents/producao-agente.mjs";
import { contaDaProducao, lerPedidoDeProducao } from "../../marmitaria/planejamento.mjs";
import { ler } from "../context/db-escopado.mjs";

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const r3 = (v) => Math.round(Number(v) * 1000) / 1000;

export const paramsSchema = s.object({
  pedido: s.string({ min: 3, max: 500 }),
});

const qtdTexto = (q, un) => `${num(q)} ${un || ""}`.trim();
const listaTexto = (itens) => itens.map((i) => `${i.nome} ${qtdTexto(i.quantidade, i.unidade)}`).join(" · ");

async function preparar(ctx, params) {
  const hoje = hojeNoFuso(new Date(), ctx.escopo?.fuso || "America/Sao_Paulo");
  const d = await carregarProducao(ctx.dbe, hoje);
  const pedido = lerPedidoDeProducao(params.pedido, { fichas: d.fichas, hoje });
  if (!pedido.alvos.length && !pedido.limpezas.length) {
    const exemplos = d.fichas.filter((f) => f.eh_base && f.ativo !== false).slice(0, 4).map((f) => f.nome_receita).join(", ");
    const nao = pedido.semFicha.length ? ` Não calculei: ${pedido.semFicha.map((x) => (x.motivo ? `${x.frase} (${x.motivo})` : `${x.frase} (sem ficha)`)).join("; ")}.` : "";
    return { erro: `DADOS INSUFICIENTES: não achei na frase o que produzir com uma ficha cadastrada.${nao} Diga a quantidade e o nome da ficha${exemplos ? ` (ex.: ${exemplos})` : ""}, ou cadastre a ficha em Marmitaria > Fichas.` };
  }
  const alvos = [
    ...pedido.alvos,
    ...pedido.limpezas.filter((l) => l.ficha).map((l) => ({ ficha: l.ficha, quantidade: Number(l.ficha.rendimento_porcoes) || 1, vezes: 1, limpeza: true })),
  ];
  const c = contaDaProducao({ alvos, fichas: d.fichas, marmitas: new Map(d.marmitas.map((m) => [m.id, m])), insumos: d.insumos, saldo: d.saldo, espelho: d.espelho });
  const nomeIns = (id) => d.insumos.get(id)?.nome || "Ingrediente";

  const linhas = [{ rotulo: "Para", valor: `${pedido.rotuloData} (${ddmm(pedido.data)})` }];
  const tarefas = [];
  // 1º: fabricar o que os outros usam (molho antes da parmegiana)
  for (const f of c.fabricar) {
    const ficha = d.fichas.find((x) => x.id === f.ficha_id);
    if (f.produzir > 0) {
      const ings = (ficha?.fichas_ingredientes || []).map((fi) => ({ nome: fi.subficha_id ? d.fichas.find((x) => x.id === fi.subficha_id)?.nome_receita : nomeIns(fi.insumo_id), quantidade: r3((Number(fi.quantidade) || 0) * (f.lotes || 0)), unidade: fi.subficha_id ? "" : d.insumos.get(fi.insumo_id)?.unidade_medida })).filter((i) => i.quantidade > 0);
      linhas.push({ rotulo: `Fabricar ${f.nome}`, valor: `${qtdTexto(f.produzir, f.unidade)} (precisa ${qtdTexto(f.necessario, f.unidade)}, tem ${qtdTexto(f.temNoEstoque, f.unidade)})${ings.length ? `: ${listaTexto(ings)}` : ""}` });
      tarefas.push({ titulo: `Fabricar ${f.nome}`, tipo: "producao", fichaId: f.ficha_id, quantidade: r3(f.produzir), unidade: f.unidade, motivo: `Para ${c.porAlvo.filter((a) => !a.limpeza).map((a) => `${num(a.quantidade, 0)} ${a.nome}`).join(" e ")}` });
    } else {
      linhas.push({ rotulo: f.nome, valor: `já tem ${qtdTexto(f.temNoEstoque, f.unidade)}; precisa ${qtdTexto(f.necessario, f.unidade)}: não precisa fabricar` });
    }
  }
  // 2º: as produções pedidas, na ordem: quem é usado por outro alvo vem antes
  const usados = new Set(c.porAlvo.flatMap((a) => (d.fichas.find((f) => f.id === a.fichaId)?.fichas_ingredientes || []).map((fi) => fi.subficha_id).filter(Boolean)));
  const ordem = [...c.porAlvo.filter((a) => !a.limpeza)].sort((a, b) => usados.has(b.fichaId) - usados.has(a.fichaId));
  for (const a of ordem) {
    const pedidoComo = pedido.alvos.find((x) => x.ficha.id === a.fichaId)?.pedidoComo;
    linhas.push({ rotulo: `${num(a.quantidade)} ${a.nome}`, valor: `${pedidoComo ? `(${pedidoComo}) ` : ""}${listaTexto(a.itens) || "ficha sem ingredientes"}` });
    tarefas.push({ titulo: `Produzir ${a.nome}`, tipo: "producao", fichaId: a.fichaId, quantidade: a.quantidade, unidade: a.unidade });
  }
  // 3º: limpezas (com os materiais, se tem ficha)
  for (const l of pedido.limpezas) {
    const conta = l.ficha ? c.porAlvo.find((a) => a.fichaId === l.ficha.id) : null;
    linhas.push({ rotulo: l.titulo, valor: conta?.itens.length ? listaTexto(conta.itens) : "DADOS INSUFICIENTES dos materiais: cadastre a ficha de limpeza (ex.: óleo, sal, água) em Fichas, departamento Limpeza" });
    tarefas.push({ titulo: l.titulo, tipo: "limpeza", fichaId: l.ficha?.id || null, ...(conta ? { quantidade: 1, unidade: "vez" } : {}), motivo: conta?.itens.length ? `Separar: ${listaTexto(conta.itens)}`.slice(0, 300) : null });
  }
  // 4º: compras
  if (c.listaDeCompras.length) {
    linhas.push({ rotulo: "Falta no estoque", valor: c.listaDeCompras.map((i) => `${i.nome} ${qtdTexto(i.comprar, i.unidade)}`).join(" · ") });
    linhas.push({ rotulo: "Compra estimada", valor: c.valorEstimadoCompras != null ? `${brl(c.valorEstimadoCompras)} (ESTIMATIVA pelo último custo)` : "DADOS INSUFICIENTES (item sem custo)" });
  } else if (c.itens.length) {
    linhas.push({ rotulo: "Estoque", valor: d.temEstoque ? "tem tudo o que precisa" : "DADOS INSUFICIENTES: sem estoque da marmitaria nesta unidade" });
  }
  for (const x of pedido.semFicha) linhas.push({ rotulo: x.motivo ? "Não calculei" : "Sem ficha", valor: x.motivo ? `${x.frase}: ${x.motivo}` : `${x.frase}: cadastre a ficha para eu calcular` });
  for (const a of c.avisos) linhas.push({ rotulo: "Atenção", valor: a });

  // plano já aprovado para a data: este substitui (o banco marca o antigo como substituído)
  const ja = await ler(ctx.dbe.from("plano_dia").select("id").eq("data", pedido.data).eq("status", "ativo").limit(1), "plano_dia").catch((e) => { if (e?.name === "ErroDeIsolamento") throw e; return null; });
  if (ja?.length) linhas.push({ rotulo: "Plano", valor: `substitui o plano já aprovado para ${ddmm(pedido.data)}` });

  return {
    pronto: {
      preview: { titulo: `Produção de ${pedido.rotuloData} (${ddmm(pedido.data)})`, linhas, entidade: { tipo: "plano_dia", id: null, nome: `Plano de ${ddmm(pedido.data)}` } },
      payload: { unidade_id: ctx.escopo.unidadeId, data: pedido.data, pedido: params.pedido.slice(0, 2000), tarefas: tarefas.slice(0, 60), resumo: { data: pedido.data, rotulo: pedido.rotuloData, tarefas: tarefas.length, compras: c.listaDeCompras.length } },
    },
  };
}

async function executar(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  if (!payload.tarefas?.length) return { ok: false, erro: "Plano sem tarefas." };
  const { data, error } = await ctx.dbUsuario.rpc("hefisto_aprovar_plano_dia", { p_unidade: ctx.escopo.unidadeId, p_data: payload.data, p_pedido: payload.pedido, p_tarefas: payload.tarefas });
  if (error) {
    const ausente = /does not exist|could not find the function|PGRST202/i.test(`${error.message} ${error.code}`);
    return { ok: false, erro: ausente ? "O banco ainda não tem o plano do dia (migração PLANO-DIA-1). Nada foi programado." : `Não consegui programar: ${error.message}` };
  }
  if (!data?.ok) return { ok: false, erro: data?.erro || "O banco não confirmou o plano." };
  if (data.plano_id && !UUID.test(data.plano_id)) return { ok: false, erro: "Resposta inesperada do banco." };
  return { ok: true, resultado: { ...payload.resumo, planoId: data.plano_id, gravadas: data.tarefas }, antes: null, depois: { planoId: data.plano_id } };
}

function resumoResultado(rec) {
  const x = rec.resultado || {};
  return {
    texto: `Produção de ${x.rotulo} (${ddmm(x.data)}) programada: ${x.gravadas ?? x.tarefas} tarefa(s) no plano do dia. A equipe vê no Nico, na ordem.${x.compras ? ` Faltam ${x.compras} item(ns) no estoque: compre antes.` : ""}`,
    linhas: [{ rotulo: "Data", valor: ddmm(x.data) }, { rotulo: "Tarefas", valor: String(x.gravadas ?? x.tarefas) }],
    acoes: [{ rotulo: "Ver plano do dia", rota: "/dashboard/inteligencia/plano-do-dia" }],
    sugestoes: ["Quanto tenho de frango empanado no estoque?"],
  };
}

export const planejarProducao = Object.freeze({
  id: "production.plan",
  nome: "Programar a produção do dia",
  descricao: "Calcula pelas fichas o que vai em cada produção, o que fabricar antes, os materiais da limpeza e o que falta comprar, e programa as tarefas no plano do dia.",
  modulo: "marmitaria",
  capacidade: "aprovar_plano",
  risco: "MEDIUM",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["pedido"],
  validacoes: [
    "quantidades pelas fichas técnicas (rendimento e ingredientes); sem ficha, não calcula",
    "o que um alvo usa de outro sai da produção planejada (parmegiana usa o empanado dos 300)",
    "pré-preparo que não foi pedido desconta o estoque pronto; o resto vira 'fabricar'",
    "só grava o plano do dia (tarefas); estoque e compras não mudam",
    "plano pela função hefisto_aprovar_plano_dia (permissão do dono, conferida no banco)",
  ],
  rollback: "Aprovar outro plano para a mesma data (o anterior fica marcado como substituído).",
  paramsSchema,
  preparar,
  executar,
  resumoResultado,
});
