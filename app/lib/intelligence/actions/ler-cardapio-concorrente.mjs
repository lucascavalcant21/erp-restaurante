// AÇÃO competitor.menu — guardar o cardápio de um concorrente do delivery
// (Jhon, pedido do dono 17/11/2026).
//
//   prints do cardápio → /api/ocr/cardapio (leitura) → cardapioDoOcr → esta ação:
//     de qual concorrente é (se a leitura não pegou o nome) e de qual app
//     → prévia (quantos pratos, faixa de preço, adicionais, primeiros itens)
//     → confirmar → hefisto_salvar_leitura_concorrente (CONC-1): uma leitura
//       nova com data, guardada com histórico; a mesma chave não grava duas vezes.
//
// Os preços são do CARDÁPIO DO CONCORRENTE (REAL lido do print, com a data em
// que foi visto). Nada é gravado antes de confirmar. Gravação pelo cliente do
// usuário (RLS + permissão do banco: marmitaria.competitors.create).

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { hojeNoFuso } from "./lancar-nota.mjs";
import {
  PLATAFORMAS, TIPOS_ITEM, MAX_ITENS_CARDAPIO, brl, rotuloPlataforma, plataformaDoTexto, resumoDoCardapio,
} from "../../marmitaria/concorrentes.mjs";

const IDS_PLATAFORMA = PLATAFORMAS.map((p) => p.id);
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpar = (t) => String(t || "").replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "").trim();
const cap = (t) => { const x = limpar(t); return x ? x[0].toUpperCase() + x.slice(1) : x; };
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Parâmetros ──────────────────────────────────────────────────────────────

const itemSchema = s.object({
  tipo: s.enum(TIPOS_ITEM),
  nome: s.string({ min: 1, max: 160 }),
  preco: s.number({ min: 0, max: 99999.99 }),
  categoria: s.opcional(s.string({ max: 80 })),
  grupo: s.opcional(s.string({ max: 80 })),
  descricao: s.opcional(s.string({ max: 600 })),
  componentes: s.opcional(s.array(s.string({ min: 1, max: 80 }), { max: 30 })),
  peso_g: s.opcional(s.number({ min: 1, max: 20000 })),
  serve_pessoas: s.opcional(s.number({ min: 1, max: 50, inteiro: true })),
  preco_original: s.opcional(s.number({ min: 0, max: 99999.99 })),
});

export const cardapioSchema = s.object({
  concorrente: s.opcional(s.string({ max: 120 })),
  plataforma: s.opcional(s.enum(IDS_PLATAFORMA)),
  taxa_entrega: s.opcional(s.number({ min: 0, max: 999 })),
  pedido_minimo: s.opcional(s.number({ min: 0, max: 9999 })),
  tempo_entrega: s.opcional(s.string({ max: 40 })),
  avaliacao: s.opcional(s.number({ min: 0, max: 5 })),
  itens: s.array(itemSchema, { min: 1, max: MAX_ITENS_CARDAPIO }),
});

export const paramsSchema = s.object({
  cardapio: cardapioSchema,
  concorrente: s.opcional(s.string({ min: 2, max: 120 })),
  plataforma: s.opcional(s.enum(IDS_PLATAFORMA)),
  pendente: s.opcional(s.object({ tipo: s.string({ max: 20 }) })),
  aviso: s.opcional(s.string({ max: 200 })),
  resposta: s.opcional(s.string({ min: 1, max: 120 })),
});

export function aplicarResposta(params, campo, valor) {
  const p = { ...params, aviso: null, resposta: null };
  const v = limpar(valor);
  switch (params.pendente?.tipo) {
    case "concorrente":
      if (v.length >= 2 && v.length <= 120) p.concorrente = cap(v);
      else p.aviso = "Não entendi o nome.";
      break;
    case "plataforma": {
      const id = IDS_PLATAFORMA.includes(v) ? v : plataformaDoTexto(v);
      if (id) p.plataforma = id; else p.aviso = "Não reconheci o app.";
      break;
    }
    default:
      break;
  }
  return p;
}

const pergunta = (tipo, texto, { opcoes = null, aviso = null } = {}) => ({
  faltando: {
    campo: "resposta", texto: aviso ? `${aviso} ${texto}` : texto, opcoes, livre: true,
    persistir: { pendente: { tipo }, aviso: null },
  },
});

/** Linha curta de um item para a prévia: "Frango grelhado (500 g) — R$ 24,90". */
export function linhaDoItem(i) {
  const extra = [i.peso_g ? `${Number(i.peso_g).toLocaleString("pt-BR")} g` : null, i.serve_pessoas > 1 ? `serve ${i.serve_pessoas}` : null].filter(Boolean).join(", ");
  return `${i.nome}${extra ? ` (${extra})` : ""} — ${brl(i.preco)}`;
}

// ─── Preparar ────────────────────────────────────────────────────────────────
async function preparar(ctx, params) {
  const p = params || {};
  const cardapio = p.cardapio;
  if (!cardapio?.itens?.length) return { erro: "Não li nenhum item com preço nesse cardápio. Mande um print mais nítido, mostrando nome e preço." };
  const aviso = p.aviso || null;

  const nome = limpar(p.concorrente || cardapio.concorrente);
  if (!nome || nome.length < 2) {
    // concorrentes já guardados viram botões (mesmo nome = mesmo histórico)
    const ja = (await ler(ctx.dbe.from("delivery_concorrentes").select("id, nome, plataforma").order("nome").limit(8), "delivery_concorrentes")) || [];
    const opcoes = ja.map((c) => ({ id: c.nome.slice(0, 120), rotulo: `${c.nome} (${rotuloPlataforma(c.plataforma)})` }));
    return pergunta("concorrente", "De qual concorrente é esse cardápio? Diga o nome do restaurante como aparece no app.", { opcoes: opcoes.length ? opcoes : null, aviso });
  }
  const plataforma = p.plataforma || cardapio.plataforma || null;
  if (!plataforma) {
    return pergunta("plataforma", `Esse cardápio da ${nome} é de qual app?`, { opcoes: PLATAFORMAS.map((x) => ({ id: x.id, rotulo: x.rotulo })), aviso });
  }

  const hoje = hojeNoFuso(new Date(), ctx.escopo?.fuso || "America/Sao_Paulo");
  const r = resumoDoCardapio(cardapio);
  const pratos = cardapio.itens.filter((i) => i.tipo === "prato" || i.tipo === "combo");
  const adicionais = cardapio.itens.filter((i) => i.tipo === "adicional");
  const contagem = TIPOS_ITEM.filter((t) => r[t] > 0).map((t) => `${r[t]} ${ROTULO_TIPO[t][r[t] === 1 ? 0 : 1]}`).join(", ");
  const linhas = [
    { rotulo: "Concorrente", valor: nome },
    { rotulo: "App", valor: rotuloPlataforma(plataforma) },
    { rotulo: "Visto em", valor: ddmm(hoje) },
    { rotulo: "Itens lidos", valor: contagem || String(r.total) },
    ...(r.faixaPratos ? [{ rotulo: "Pratos", valor: `${brl(r.faixaPratos.min)} a ${brl(r.faixaPratos.max)} (mediana ${brl(r.faixaPratos.mediana)})` }] : []),
    ...(cardapio.taxa_entrega != null ? [{ rotulo: "Taxa de entrega", valor: cardapio.taxa_entrega === 0 ? "grátis" : brl(cardapio.taxa_entrega) }] : []),
    ...(cardapio.pedido_minimo != null ? [{ rotulo: "Pedido mínimo", valor: brl(cardapio.pedido_minimo) }] : []),
    ...pratos.slice(0, 4).map((i) => ({ rotulo: i.tipo === "combo" ? "Combo" : "Prato", valor: linhaDoItem(i) })),
    ...(adicionais.length ? [{ rotulo: "Adicionais", valor: adicionais.slice(0, 4).map((i) => `${i.nome} ${brl(i.preco)}`).join(" · ") + (adicionais.length > 4 ? ` e mais ${adicionais.length - 4}` : "") }] : []),
  ];
  const dados = {
    concorrente: nome, plataforma, fonte: "foto", observado_em: hoje,
    ...(cardapio.taxa_entrega != null ? { taxa_entrega: cardapio.taxa_entrega } : {}),
    ...(cardapio.pedido_minimo != null ? { pedido_minimo: cardapio.pedido_minimo } : {}),
    ...(cardapio.tempo_entrega ? { tempo_entrega: cardapio.tempo_entrega } : {}),
    ...(cardapio.avaliacao != null ? { avaliacao: cardapio.avaliacao } : {}),
    itens: cardapio.itens,
  };
  return {
    pronto: {
      preview: { titulo: `Guardar o cardápio da ${nome}`, linhas, entidade: { tipo: "concorrente", id: null, nome } },
      payload: { unidade_id: ctx.escopo.unidadeId, dados, resumo: { concorrente: nome, plataforma, data: hoje, total: r.total, pratos: r.prato + r.combo, adicionais: r.adicional } },
    },
  };
}

const ROTULO_TIPO = {
  prato: ["prato", "pratos"], combo: ["combo", "combos"], adicional: ["adicional", "adicionais"],
  bebida: ["bebida", "bebidas"], sobremesa: ["sobremesa", "sobremesas"], outro: ["outro", "outros"],
};

// ─── Executar ────────────────────────────────────────────────────────────────
async function executar(ctx, payload, { chave } = {}) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const { data, error } = await ctx.dbUsuario.rpc("hefisto_salvar_leitura_concorrente", {
    p_unidade: ctx.escopo.unidadeId,
    p_dados: { ...payload.dados, chave: String(chave || "").slice(0, 80) || null },
  });
  if (error) {
    const ausente = /does not exist|could not find the function|PGRST202/i.test(`${error.message} ${error.code}`);
    return { ok: false, erro: ausente ? "O banco ainda não tem a parte de concorrentes (migração CONC-1). Nada foi guardado." : `Não consegui guardar o cardápio: ${error.message}` };
  }
  if (!data?.ok) return { ok: false, erro: data?.erro || "O banco não confirmou a gravação." };
  if (data.leitura_id && !UUID.test(data.leitura_id)) return { ok: false, erro: "Resposta inesperada do banco." };
  return { ok: true, resultado: { ...payload.resumo, leituraId: data.leitura_id, gravados: data.itens ?? null, repetida: !!data.idempotente }, antes: null, depois: { leituraId: data.leitura_id } };
}

function resumoResultado(rec) {
  const r = rec.resultado || {};
  return {
    texto: r.repetida
      ? `Esse cardápio da ${r.concorrente} já estava guardado.`
      : `Cardápio da ${r.concorrente} guardado com a data de hoje. Quando quiser, eu comparo com as nossas marmitas.`,
    linhas: [
      { rotulo: "Concorrente", valor: r.concorrente },
      { rotulo: "App", valor: rotuloPlataforma(r.plataforma) },
      { rotulo: "Visto em", valor: ddmm(r.data) },
      { rotulo: "Itens guardados", valor: String(r.gravados ?? r.total) },
    ],
    acoes: [{ rotulo: "Abrir concorrentes", rota: "/dashboard/marmitaria/concorrentes" }],
    sugestoes: [`Compare o cardápio da ${r.concorrente} com as nossas marmitas`, "Compare os adicionais dos concorrentes com os nossos"],
    referencia: { intencao: "marmitaria.concorrentes" },
  };
}

export const lerCardapioConcorrente = Object.freeze({
  id: "competitor.menu",
  nome: "Guardar cardápio de concorrente",
  descricao: "Lê os prints do cardápio de um concorrente do delivery e guarda pratos, componentes, preços e adicionais com a data.",
  modulo: "marmitaria",
  capacidade: "concorrentes_gravar",
  risco: "MEDIUM",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["cardapio", "concorrente", "plataforma", "pendente", "aviso", "resposta"],
  validacoes: [
    "só entra item com nome e preço lidos (nada de preço inventado)",
    "nome do concorrente e app confirmados antes de gravar",
    "mesmo concorrente no mesmo app = mesmo histórico (leitura nova a cada print)",
    "a mesma chave de envio não grava duas vezes",
    "gravação pela função hefisto_salvar_leitura_concorrente (permissão marmitaria.competitors.create)",
  ],
  rollback: "Apagar a leitura na tela Concorrentes do delivery (permissão marmitaria.competitors.delete).",
  paramsSchema,
  aplicarResposta,
  preparar,
  executar,
  resumoResultado,
});
