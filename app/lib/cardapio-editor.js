// Dados do editor do cardápio digital (painel do dono). Lê com a sessão do
// usuário (RLS por unidade) e grava em três lugares, cada coisa no seu dono:
//   - vitrine (cores, abertura, seções, selos, promoções, textos):
//     config_sistema.params.cardapio_digital;
//   - nome comercial e descrição do prato: na FICHA TÉCNICA (fichas_tecnicas),
//     a mesma que a cozinha usa — o cardápio é ligado a ela;
//   - foto do prato: no produto de venda (produtos.imagem_url).
// Preço não se edita aqui: é o do produto (Produtos / ficha técnica).

import { supabase, isSupabaseReady } from "./supabase";
import { salvarParams } from "./parametros";
import { salvarProduto } from "./vendas";
import { normalizarConfigCardapio } from "./cardapio-digital.mjs";

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

export async function carregarEditorCardapio(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { erro: "Escolha uma unidade para editar o cardápio dela." };
  }
  const [rU, rP, rF, rC, rM] = await Promise.all([
    supabase.from("unidades").select("nome, nome_fantasia, delivery_aberto, taxa_entrega_padrao").eq("id", unidadeId).maybeSingle(),
    supabase.from("produtos").select("id, nome_produto, preco_venda, categoria, departamento, imagem_url, ficha_id, ativo")
      .eq("unidade_id", unidadeId).eq("ativo", true).order("nome_produto"),
    supabase.from("fichas_tecnicas")
      .select("id, nome_receita, nome_comercial, descricao_comercial, categoria, departamento, ativo, status, alergenicos_pode_conter, preco_venda, eh_base")
      .eq("unidade_id", unidadeId),
    supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1),
    supabase.from("mesas").select("numero").eq("unidade_id", unidadeId).order("numero"),
  ]);
  if (rP.error) return { erro: "Não foi possível ler os produtos de venda." };
  const fichas = rF.error ? [] : (rF.data || []);
  const ids = fichas.map((f) => f.id);
  const [rFoto, rA] = await Promise.all([
    emLotes(ids, (lote) => supabase.from("fichas_tecnicas").select("id").eq("unidade_id", unidadeId).in("id", lote).not("imagem", "is", null).neq("imagem", "")),
    emLotes(ids, (lote) => supabase.from("fichas_alergenicos").select("ficha_id, alergenico").eq("unidade_id", unidadeId).in("ficha_id", lote)),
  ]);
  const params = rC.error ? null : rC.data?.[0]?.params;
  const u = rU.error ? null : rU.data;
  return {
    erro: null,
    unidade: { nome: u?.nome_fantasia || u?.nome || "", delivery_aberto: u?.delivery_aberto !== false, taxa_entrega: Number(u?.taxa_entrega_padrao) || 0 },
    produtos: rP.data || [],
    fichas,
    fichasComFoto: rFoto.error ? [] : rFoto.data.map((f) => f.id),
    alergenicos: rA.error ? [] : rA.data,
    config: params && typeof params === "object" && params.cardapio_digital ? params.cardapio_digital : {},
    mesas: rM.error ? [] : (rM.data || []).map((m) => m.numero).filter(Boolean),
  };
}

const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const TIPOS_VIDEO = ["video/mp4", "video/webm"];
export const LIMITE_IMAGEM_MB = 8;
export const LIMITE_VIDEO_MB = 50;

/** Sobe foto ou vídeo para o armazenamento público e devolve o endereço https. */
export async function enviarArquivoCardapio(unidadeId, arquivo, pasta = "geral") {
  if (!isSupabaseReady()) return { erro: "Sem conexão com o banco." };
  if (!arquivo) return { erro: "Nenhum arquivo escolhido." };
  const video = TIPOS_VIDEO.includes(arquivo.type);
  if (!video && !TIPOS_IMAGEM.includes(arquivo.type)) return { erro: "Use foto (JPG, PNG, WEBP) ou vídeo (MP4, WEBM)." };
  const limite = (video ? LIMITE_VIDEO_MB : LIMITE_IMAGEM_MB) * 1024 * 1024;
  if (arquivo.size > limite) return { erro: `Arquivo grande demais: até ${video ? LIMITE_VIDEO_MB : LIMITE_IMAGEM_MB} MB.` };
  const ext = (arquivo.name.split(".").pop() || (video ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const nome = (arquivo.name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "arquivo");
  const caminho = `cardapio/${unidadeId}/${pasta}/${Date.now()}-${nome}.${ext}`;
  const { error } = await supabase.storage.from("anexos").upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) return { erro: "Não foi possível enviar o arquivo. Tente de novo." };
  const { data } = supabase.storage.from("anexos").getPublicUrl(caminho);
  return { erro: null, url: data?.publicUrl || "", video };
}

/**
 * Grava tudo de uma vez: fichas (nome comercial, descrição), fotos dos
 * produtos e a vitrine. Cada escrita confere que a linha foi mesmo alterada
 * (UPDATE barrado por RLS volta sem erro e sem linha) e a vitrine é relida
 * depois de gravada.
 */
export async function salvarEditorCardapio(unidadeId, { config, fichas = {}, produtos = {} }) {
  if (!isSupabaseReady()) return { erros: ["Sem conexão com o banco."] };
  const erros = [];
  for (const [id, campos] of Object.entries(fichas)) {
    const limpo = {};
    if ("descricao_comercial" in campos) limpo.descricao_comercial = String(campos.descricao_comercial || "").trim().slice(0, 280) || null;
    if ("nome_comercial" in campos) limpo.nome_comercial = String(campos.nome_comercial || "").trim().slice(0, 80) || null;
    if (!Object.keys(limpo).length) continue;
    const { data, error } = await supabase.from("fichas_tecnicas").update(limpo).eq("id", id).eq("unidade_id", unidadeId).select("id");
    if (error || !data?.length) erros.push("Uma ficha técnica não foi alterada (sem permissão ou ficha removida).");
  }
  for (const [id, campos] of Object.entries(produtos)) {
    if (!("imagem_url" in campos)) continue;
    const { data, error } = await supabase.from("produtos").update({ imagem_url: campos.imagem_url || null })
      .eq("id", id).eq("unidade_id", unidadeId).select("id");
    if (error || !data?.length) erros.push("A foto de um prato não foi gravada (sem permissão ou produto removido).");
  }
  const vitrine = normalizarConfigCardapio(config);
  const r = await salvarParams(unidadeId, { cardapio_digital: vitrine });
  if (r?.error) erros.push("A aparência do cardápio não foi salva.");
  else {
    const { data } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
    const gravado = data?.[0]?.params?.cardapio_digital;
    if (estavel(normalizarConfigCardapio(gravado)) !== estavel(vitrine)) {
      erros.push("A aparência do cardápio não foi confirmada no banco. Confira sua permissão e tente de novo.");
    }
  }
  return { erros: [...new Set(erros)], config: vitrine };
}

/** Ficha de venda sem produto: cria o produto de venda ligado a ela (aparece no PDV e no cardápio). */
export async function criarProdutoDaFicha(unidadeId, ficha, preco) {
  const valor = Math.round(Number(preco) * 100) / 100;
  if (!(valor > 0)) return { erro: "Informe o preço de venda." };
  const departamento = String(ficha.departamento || "").toLowerCase() === "bar" ? "bar" : "cozinha";
  const r = await salvarProduto({
    unidade_id: unidadeId,
    nome_produto: String(ficha.nome_comercial || ficha.nome_receita || "").trim().slice(0, 120),
    preco_venda: valor,
    categoria: ficha.categoria || (departamento === "bar" ? "Drinks" : "Pratos Principais"),
    departamento,
    ficha_id: ficha.id,
    ativo: true,
  });
  return r.error ? { erro: r.error } : { erro: null, id: r.id };
}
