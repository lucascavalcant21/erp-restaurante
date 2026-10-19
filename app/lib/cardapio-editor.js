// Dados do editor do cardápio digital (painel do dono). Lê com a sessão do
// usuário (RLS por unidade) e grava em três lugares, cada coisa no seu dono:
//   - vitrine (cores, abertura, seções, selos, promoções, textos):
//     config_sistema.params.cardapio_digital;
//   - nome comercial e descrição do prato: na FICHA TÉCNICA (fichas_tecnicas),
//     a mesma que a cozinha usa — o cardápio é ligado a ela;
//   - foto do prato: no produto de venda (produtos.imagem_url);
//   - delivery aberto e taxa de entrega: na unidade (unidades), que é de onde
//     o servidor tira a taxa cobrada no pedido;
//   - regras da fidelidade (cartões de selo e cashback):
//     config_sistema.params.fidelidade — os SALDOS ficam no banco
//     (fidelidade_movimentos, FIDELIDADE-1), nunca aqui.
// Preço não se edita aqui: é o do produto (Produtos / ficha técnica).

import { supabase, isSupabaseReady } from "./supabase";
import { salvarParams } from "./parametros";
import { salvarProduto } from "./vendas";
import { normalizarConfigCardapio } from "./cardapio-digital.mjs";
import { normalizarFidelidade } from "./fidelidade.mjs";

const LOTE = 100;
const COLUNA_FALTANDO = /column .* does not exist|could not find the .* column|schema cache/i;
const COLUNAS_UNIDADE = [
  "nome, nome_fantasia, delivery_aberto, taxa_entrega_padrao, cidade, uf, bairro, endereco, numero, horario_funcionamento, telefone_contato",
  "nome, nome_fantasia, delivery_aberto, taxa_entrega_padrao",
];

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

// Banco sem as colunas de endereço/horário: lê só o básico.
async function lerUnidade(unidadeId) {
  let r = null;
  for (const colunas of COLUNAS_UNIDADE) {
    r = await supabase.from("unidades").select(colunas).eq("id", unidadeId).maybeSingle();
    if (!r.error || !COLUNA_FALTANDO.test(r.error.message || "")) return r;
  }
  return r;
}

export async function carregarEditorCardapio(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { erro: "Escolha uma unidade para editar o cardápio dela." };
  }
  const [rU, rP, rF, rC, rM, rL] = await Promise.all([
    lerUnidade(unidadeId),
    supabase.from("produtos").select("id, nome_produto, preco_venda, categoria, departamento, imagem_url, ficha_id, ativo")
      .eq("unidade_id", unidadeId).eq("ativo", true).order("nome_produto"),
    supabase.from("fichas_tecnicas")
      .select("id, nome_receita, nome_comercial, descricao_comercial, categoria, departamento, ativo, status, alergenicos_pode_conter, preco_venda, eh_base")
      .eq("unidade_id", unidadeId),
    supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1),
    supabase.from("mesas").select("numero").eq("unidade_id", unidadeId).order("numero"),
    // Só para saber se o livro da fidelidade já existe no banco (FIDELIDADE-1 aplicada).
    supabase.from("fidelidade_movimentos").select("id", { count: "exact", head: true }).eq("unidade_id", unidadeId),
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
    // Os mesmos campos que o servidor monta (negocio-publico.mjs), para a prévia mostrar o que o cliente vê.
    unidade: {
      nome: u?.nome_fantasia || u?.nome || "",
      delivery_aberto: u?.delivery_aberto !== false,
      taxa_entrega: Number(u?.taxa_entrega_padrao) || 0,
      cidade: u?.cidade || "",
      uf: u?.uf || "",
      horario: u?.horario_funcionamento || "",
      endereco: [[u?.endereco, u?.numero].filter(Boolean).join(", "), u?.bairro].filter((x) => String(x || "").trim()).join(" · "),
      telefone: u?.telefone_contato || "",
    },
    produtos: rP.data || [],
    fichas,
    fichasComFoto: rFoto.error ? [] : rFoto.data.map((f) => f.id),
    alergenicos: rA.error ? [] : rA.data,
    config: params && typeof params === "object" && params.cardapio_digital ? params.cardapio_digital : {},
    fidelidade: params && typeof params === "object" && params.fidelidade ? params.fidelidade : {},
    livroFidelidade: !rL.error,
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
  const nome = (arquivo.name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "arquivo");
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
export async function salvarEditorCardapio(unidadeId, { config, fichas = {}, produtos = {}, unidade = {}, fidelidade }) {
  if (!isSupabaseReady()) return { erros: ["Sem conexão com o banco."] };
  const erros = [];
  const mudancaUnidade = {};
  if ("delivery_aberto" in unidade) mudancaUnidade.delivery_aberto = unidade.delivery_aberto !== false;
  if ("taxa_entrega" in unidade) {
    const taxa = Math.round(Number(unidade.taxa_entrega) * 100) / 100;
    if (Number.isFinite(taxa) && taxa >= 0 && taxa <= 500) mudancaUnidade.taxa_entrega_padrao = taxa;
    else erros.push("A taxa de entrega precisa ficar entre R$ 0 e R$ 500.");
  }
  if (Object.keys(mudancaUnidade).length) {
    const { data, error } = await supabase.from("unidades").update(mudancaUnidade).eq("id", unidadeId)
      .select("delivery_aberto, taxa_entrega_padrao");
    const g = data?.[0];
    const confere = g && (!("delivery_aberto" in mudancaUnidade) || (g.delivery_aberto !== false) === mudancaUnidade.delivery_aberto)
      && (!("taxa_entrega_padrao" in mudancaUnidade) || Math.abs(Number(g.taxa_entrega_padrao || 0) - mudancaUnidade.taxa_entrega_padrao) < 0.005);
    if (error || !confere) erros.push("O delivery (aberto/fechado e taxa) não foi gravado. Confira sua permissão para alterar a unidade.");
  }
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
  const regras = fidelidade === undefined ? undefined : normalizarFidelidade(fidelidade);
  const r = await salvarParams(unidadeId, regras === undefined ? { cardapio_digital: vitrine } : { cardapio_digital: vitrine, fidelidade: regras });
  if (r?.error) erros.push("A aparência do cardápio não foi salva.");
  else {
    const { data } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
    const gravado = data?.[0]?.params;
    if (estavel(normalizarConfigCardapio(gravado?.cardapio_digital)) !== estavel(vitrine)) {
      erros.push("A aparência do cardápio não foi confirmada no banco. Confira sua permissão e tente de novo.");
    }
    if (regras !== undefined && estavel(normalizarFidelidade(gravado?.fidelidade)) !== estavel(regras)) {
      erros.push("As regras da fidelidade não foram confirmadas no banco. Confira sua permissão e tente de novo.");
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
