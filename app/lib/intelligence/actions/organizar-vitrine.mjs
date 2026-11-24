// AÇÃO platform.screen — pôr na vitrine do Organizador de plataforma o que o
// Jhon leu dos prints da tela do app (pedido do dono, 17/11/2026: "mando tudo
// pelo Jhon: vamos organizar a nossa tela, e ele vai montando").
//
//   prints da tela do app → /api/ocr/cardapio → cardapioDoOcr → esta ação:
//     de qual app é a vitrine (se a leitura não pegou) → prévia (categorias,
//     itens novos e atualizados) → confirmar → grava em
//     config_sistema.params.organizador_plataforma (só a vitrine desse app).
//
// Os preços são os ESCRITOS no print (REAL lido). A foto não vem do print: o
// dono põe na tela. Nada é gravado antes de confirmar. Gravação com o cliente
// do usuário (RLS por unidade).

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { cardapioSchema } from "./ler-cardapio-concorrente.mjs";
import { brl, plataformaDoTexto } from "../../marmitaria/concorrentes.mjs";
import {
  CHAVE_PARAMS, PLATAFORMAS_VITRINE, comVitrine, mesclarLeitura, normalizarOrganizador, plataformaValida, resumoDaVitrine, rotuloPlataforma, vitrineDe,
} from "../../marmitaria/organizador.mjs";

export const ROTA_ORGANIZADOR = "/dashboard/marmitaria/marmitas/organizador";
const IDS = PLATAFORMAS_VITRINE.map((p) => p.id);
const limpar = (t) => String(t || "").replace(/\s+/g, " ").trim();

export const paramsSchema = s.object({
  cardapio: cardapioSchema,
  plataforma: s.opcional(s.enum(IDS)),
  pendente: s.opcional(s.object({ tipo: s.string({ max: 20 }) })),
  aviso: s.opcional(s.string({ max: 200 })),
  resposta: s.opcional(s.string({ min: 1, max: 120 })),
});

export function aplicarResposta(params, campo, valor) {
  const p = { ...params, aviso: null, resposta: null };
  if (params.pendente?.tipo === "plataforma") {
    const v = limpar(valor);
    const id = IDS.includes(v) ? v : plataformaDoTexto(v);
    if (id && IDS.includes(id)) p.plataforma = id; else p.aviso = "Não reconheci o app.";
  }
  return p;
}

const precoDoItem = (i) => (i.preco_original && i.preco_original > i.preco ? `${brl(i.preco_original)} (cupom ${brl(i.preco)})` : brl(i.preco));

async function lerOrganizador(dbe) {
  const linhas = await ler(dbe.from("config_sistema").select("params").limit(1), "config_sistema");
  return normalizarOrganizador(linhas?.[0]?.params?.[CHAVE_PARAMS]);
}

async function preparar(ctx, params) {
  const p = params || {};
  const itens = p.cardapio?.itens || [];
  if (!itens.length) return { erro: "Não li nenhum item com preço nesses prints. Mande prints em que apareçam o nome e o preço de cada prato." };
  const plataforma = p.plataforma || (plataformaValida(p.cardapio?.plataforma) && IDS.includes(p.cardapio.plataforma) ? p.cardapio.plataforma : null);
  if (!plataforma) {
    return {
      faltando: {
        campo: "resposta", texto: `${p.aviso ? `${p.aviso} ` : ""}Essa tela é de qual app?`, livre: true,
        opcoes: PLATAFORMAS_VITRINE.map((x) => ({ id: x.id, rotulo: x.rotulo })),
        persistir: { pendente: { tipo: "plataforma" }, aviso: null },
      },
    };
  }
  const org = await lerOrganizador(ctx.dbe);
  const antes = vitrineDe(org, plataforma);
  const r = mesclarLeitura(antes, itens);
  const depois = resumoDaVitrine(r.vitrine);
  const categorias = [...new Set(itens.map((i) => (i.tipo === "adicional" ? i.grupo || "Adicionais" : i.categoria || "Sem categoria")))];
  const linhas = [
    { rotulo: "App", valor: rotuloPlataforma(plataforma) },
    { rotulo: "Itens lidos", valor: String(itens.length) },
    { rotulo: "Novos na vitrine", valor: String(r.novos) },
    { rotulo: "Atualizados", valor: String(r.atualizados) },
    { rotulo: "Categorias", valor: categorias.slice(0, 6).join(" · ") + (categorias.length > 6 ? ` e mais ${categorias.length - 6}` : "") },
    ...itens.slice(0, 5).map((i) => ({ rotulo: i.categoria || "Item", valor: `${i.nome} — ${precoDoItem(i)}` })),
    { rotulo: "Vitrine depois", valor: depois.texto },
  ];
  return {
    pronto: {
      preview: { titulo: `Montar a vitrine do ${rotuloPlataforma(plataforma)}`, linhas, entidade: { tipo: "vitrine", id: null, nome: rotuloPlataforma(plataforma) } },
      payload: { unidade_id: ctx.escopo.unidadeId, plataforma, itens, resumo: { plataforma, lidos: itens.length } },
    },
  };
}

async function executar(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  if (!plataformaValida(payload.plataforma)) return { ok: false, erro: "App inválido." };
  const db = ctx.dbUsuario;
  const uid = ctx.escopo.unidadeId;
  const lido = await db.from("config_sistema").select("id, params").eq("unidade_id", uid).limit(1);
  if (lido.error) return { ok: false, erro: "Não consegui ler a vitrine agora. Nada foi gravado." };
  const linha = lido.data?.[0] || null;
  const org = normalizarOrganizador(linha?.params?.[CHAVE_PARAMS]);
  const r = mesclarLeitura(vitrineDe(org, payload.plataforma), payload.itens || []);
  const novo = comVitrine(org, payload.plataforma, r.vitrine);
  const patch = { [CHAVE_PARAMS]: novo };

  // 1) junção no banco, quando existe; 2) senão, relê-e-grava com conferência da linha
  const m = await db.rpc("merge_config_sistema_params", { p_unidade_id: uid, p_patch: patch });
  if (m.error) {
    const params = { ...(linha?.params || {}), ...patch };
    const g = linha
      ? await db.from("config_sistema").update({ params }).eq("id", linha.id).eq("unidade_id", uid).select("id")
      : await db.from("config_sistema").insert([{ unidade_id: uid, params }]).select("id");
    if (g.error || !g.data?.length) return { ok: false, erro: "Não consegui gravar a vitrine (sem permissão ou sem conexão). Nada foi alterado." };
  }
  return {
    ok: true,
    resultado: { plataforma: payload.plataforma, novos: r.novos, atualizados: r.atualizados, resumo: resumoDaVitrine(r.vitrine).texto },
    antes: null,
    depois: { plataforma: payload.plataforma },
  };
}

function resumoResultado(rec) {
  const r = rec.resultado || {};
  return {
    texto: `Vitrine do ${rotuloPlataforma(r.plataforma)} atualizada: ${r.novos} ${r.novos === 1 ? "item novo" : "itens novos"} e ${r.atualizados} ${r.atualizados === 1 ? "atualizado" : "atualizados"}. Agora ponha as fotos tocando em cada prato no Organizador e copie para o app.`,
    linhas: [
      { rotulo: "App", valor: rotuloPlataforma(r.plataforma) },
      { rotulo: "Vitrine", valor: r.resumo },
    ],
    acoes: [{ rotulo: "Abrir o organizador", rota: ROTA_ORGANIZADOR }],
    sugestoes: ["Mande mais prints da tela", "O que falta na nossa vitrine?"],
    referencia: { intencao: "marmitaria.organizador" },
  };
}

export const organizarVitrine = Object.freeze({
  id: "platform.screen",
  nome: "Montar a vitrine da plataforma",
  descricao: "Lê os prints da tela do app de entrega e põe categorias, nomes, descrições e preços no Organizador de plataforma.",
  modulo: "marmitaria",
  capacidade: "organizador_gravar",
  risco: "LOW",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["cardapio", "plataforma", "pendente", "aviso", "resposta"],
  validacoes: [
    "só entra item com nome e preço lidos (nada de preço inventado)",
    "app confirmado antes de gravar",
    "item com o mesmo nome é atualizado, não duplicado; a foto que já estava fica",
    "grava só a vitrine desse app; as outras não mudam",
  ],
  rollback: "Tirar os itens na tela Organizador de plataforma.",
  paramsSchema,
  aplicarResposta,
  preparar,
  executar,
  resumoResultado,
});
