// Dados do Painel → Cardápio (lista de produtos com canais e "Esgotado hoje").
// Lê com a sessão do usuário (RLS por unidade). Grava só na vitrine do dono
// (config_sistema.params.cardapio_digital), o mesmo lugar do editor: cada
// mudança RELÊ a vitrine antes de gravar, para não apagar o que outra tela
// acabou de salvar, e confere no banco depois.

import { supabase, isSupabaseReady } from "./supabase";
import { salvarParams } from "./parametros";
import { aplicarFotosDaMontagem, categoriasEfetivas, juntarProdutosEFichas, normalizarConfigCardapio } from "./cardapio-digital.mjs";
import { reordenarCategorias } from "./cardapio-painel.mjs";

const LOTE = 100;

// O banco (jsonb) devolve as chaves em outra ordem: compara sem ligar para ela.
function estavel(v) {
  if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${estavel(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

async function emLotes(ids, consulta) {
  const data = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    const r = await consulta(ids.slice(i, i + LOTE));
    if (r.error) return { data: null, error: r.error };
    data.push(...(r.data || []));
  }
  return { data, error: null };
}

async function lerVitrine(unidadeId) {
  const { data, error } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
  if (error) return { erro: error };
  const params = data?.[0]?.params;
  return { config: params && typeof params === "object" && params.cardapio_digital ? params.cardapio_digital : {} };
}

export async function carregarPainelCardapio(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { erro: "Escolha uma unidade para ver o cardápio dela." };
  }
  const [rP, rF, rV] = await Promise.all([
    supabase.from("produtos").select("id, nome_produto, preco_venda, categoria, departamento, imagem_url, ficha_id, ativo")
      .eq("unidade_id", unidadeId).eq("ativo", true).order("nome_produto"),
    supabase.from("fichas_tecnicas")
      .select("id, nome_receita, nome_comercial, descricao_comercial, categoria, departamento, ativo, status, tempo_preparo, eh_base")
      .eq("unidade_id", unidadeId),
    lerVitrine(unidadeId),
  ]);
  if (rP.error) return { erro: "Não foi possível ler os produtos de venda." };
  if (rV.erro) return { erro: "Não foi possível ler a configuração do cardápio." };
  const fichas = rF.error ? [] : (rF.data || []);
  const usadas = [...new Set((rP.data || []).map((p) => p.ficha_id).filter(Boolean).map(String))];
  const [rFoto, rI, rM] = await Promise.all([
    emLotes(usadas, (lote) => supabase.from("fichas_tecnicas").select("id").eq("unidade_id", unidadeId).in("id", lote).not("imagem", "is", null).neq("imagem", "")),
    emLotes(usadas, (lote) => supabase.from("fichas_ingredientes").select("ficha_id, insumos(nome)").in("ficha_id", lote)),
    supabase.from("montagem").select("nome, foto_url").eq("unidade_id", unidadeId).not("foto_url", "is", null),
  ]);
  const fichasComFoto = rFoto.error ? [] : rFoto.data.map((f) => f.id);
  // Busca por ingrediente: nome dos insumos de cada ficha (sem dado, a busca fica só pelo nome).
  const ingredientes = {};
  for (const l of rI.error ? [] : rI.data || []) {
    const nome = l.insumos?.nome;
    if (!nome) continue;
    (ingredientes[String(l.ficha_id)] ||= []).push(nome);
  }
  return {
    erro: null,
    // Foto que está só na Montagem (mesmo nome do prato), igual ao cardápio do cliente.
    produtos: aplicarFotosDaMontagem(rP.data || [], { fichas, fichasComFoto, montagens: rM.error ? [] : rM.data || [] }),
    fichas,
    fichasComFoto,
    ingredientes,
    config: rV.config,
  };
}

async function gravarVitrine(unidadeId, alterar) {
  const atual = await lerVitrine(unidadeId);
  if (atual.erro) return { erro: "Não foi possível ler a configuração do cardápio." };
  const cfg = normalizarConfigCardapio(atual.config);
  const nova = normalizarConfigCardapio(alterar(cfg));
  const r = await salvarParams(unidadeId, { cardapio_digital: nova });
  if (r?.error) return { erro: "Não foi possível salvar. Confira sua permissão e tente de novo." };
  const conferido = await lerVitrine(unidadeId);
  if (conferido.erro || estavel(normalizarConfigCardapio(conferido.config)) !== estavel(nova)) {
    return { erro: "A mudança não foi confirmada no banco. Atualize a tela e tente de novo." };
  }
  return { erro: null, config: nova };
}

/** Muda um prato na vitrine (canais, esgotado hoje). `mudar(itemAtual) → itemNovo`. */
export function alterarItemDoCardapio(unidadeId, produtoId, mudar) {
  return gravarVitrine(unidadeId, (cfg) => {
    const itens = { ...cfg.itens };
    const novo = mudar(itens[produtoId] || {});
    if (novo && Object.keys(novo).length) itens[produtoId] = novo;
    else delete itens[produtoId];
    return { ...cfg, itens };
  });
}

/**
 * Nova ordem das seções. Sem seções gravadas (a vitrine usa as categorias das
 * fichas), grava a lista atual já na ordem nova.
 */
export function salvarOrdemDasSecoes(unidadeId, ids, { produtos = [], fichas = [] } = {}) {
  return gravarVitrine(unidadeId, (cfg) => {
    const atuais = categoriasEfetivas(cfg, juntarProdutosEFichas(produtos, fichas));
    return { ...cfg, categorias: reordenarCategorias(atuais, ids) };
  });
}

/** Alergênicos marcados na ficha (hoje só no nível da ficha; os dos ingredientes vêm depois). */
export async function lerAlergenicosDaFicha(unidadeId, fichaId) {
  if (!fichaId) return { alergenicos: [], podeConter: "" };
  const [rA, rF] = await Promise.all([
    supabase.from("fichas_alergenicos").select("alergenico").eq("unidade_id", unidadeId).eq("ficha_id", fichaId),
    supabase.from("fichas_tecnicas").select("alergenicos_pode_conter").eq("unidade_id", unidadeId).eq("id", fichaId).maybeSingle(),
  ]);
  return {
    alergenicos: rA.error ? null : [...new Set((rA.data || []).map((a) => a.alergenico).filter(Boolean))],
    podeConter: rF.error ? "" : rF.data?.alergenicos_pode_conter || "",
  };
}

/**
 * Salva o produto editado no painel, cada coisa no seu dono:
 *   - nome, descrição e tempo de preparo: na ficha técnica;
 *   - capa: em produtos.imagem_url (PDV e telas antigas usam);
 *   - fotos/vídeo, categoria, canais, horário, esgotado, grupos: na vitrine.
 * `ficha` = campos da ficha a gravar (só os que mudaram) ou null.
 */
export async function salvarProdutoDoPainel(unidadeId, { produtoId, fichaId, ficha, imagemUrl, mudarItem, grupos }) {
  const erros = [];
  if (fichaId && ficha && Object.keys(ficha).length) {
    const { data, error } = await supabase.from("fichas_tecnicas").update(ficha).eq("id", fichaId).eq("unidade_id", unidadeId).select("id");
    if (error || !data?.length) erros.push("Nome, descrição ou tempo não foram gravados na ficha técnica (sem permissão ou ficha removida).");
  }
  if (imagemUrl !== undefined) {
    const { data, error } = await supabase.from("produtos").update({ imagem_url: imagemUrl || null }).eq("id", produtoId).eq("unidade_id", unidadeId).select("id");
    if (error || !data?.length) erros.push("A capa não foi gravada no produto de venda.");
  }
  const r = await gravarVitrine(unidadeId, (cfg) => {
    const itens = { ...cfg.itens };
    const novo = mudarItem(itens[produtoId] || {});
    if (novo && Object.keys(novo).length) itens[produtoId] = novo;
    else delete itens[produtoId];
    return { ...cfg, itens, ...(grupos ? { grupos } : {}) };
  });
  if (r.erro) erros.push(r.erro);
  return { erros, config: r.config };
}
