import { supabase, isSupabaseReady } from "./supabase";

// Categorias do estoque, por departamento.
//
// As da casa vêm embutidas no código e nunca somem — são o esqueleto que as
// telas de relatório esperam encontrar. O que a unidade cria fica em
// config_sistema.params.categorias_estoque, seguindo a regra do projeto:
// configuração que não exige tabela nova mora ali.
//
// "Excluir" só vale para categoria criada pela unidade. Apagar uma embutida
// deixaria itens órfãos de uma categoria que o código ainda menciona.

const limpar = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

const chave = (v) => limpar(v)
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("pt-BR");

// Junta embutidas + criadas, sem repetir e em ordem alfabética. A comparação
// ignora acento e caixa: "Destilados" e "destilados" são a mesma coisa, e ter
// as duas na lista faz o mesmo produto ser classificado de dois jeitos.
export function mesclarCategorias(embutidas = [], criadas = []) {
  const vistas = new Map();
  for (const nome of [...embutidas, ...criadas]) {
    const limpo = limpar(nome);
    if (!limpo) continue;
    const k = chave(limpo);
    if (!vistas.has(k)) vistas.set(k, limpo);
  }
  return [...vistas.values()].sort((a, b) => chave(a).localeCompare(chave(b)));
}

export const ehEmbutida = (nome, embutidas = []) =>
  embutidas.some(e => chave(e) === chave(nome));

export async function fetchCategoriasCriadas(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: {} };
  const { data, error } = await supabase.from("config_sistema")
    .select("params").eq("unidade_id", unidadeId).limit(1);
  return { data: data?.[0]?.params?.categorias_estoque || {}, error: error?.message || null };
}

// Grava a lista completa de criadas do departamento. Recebe o mapa inteiro para
// não perder o outro departamento numa gravação concorrente.
export async function salvarCategoriasCriadas(unidadeId, mapa) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade específica." };

  const categorias_estoque = {};
  for (const [dept, lista] of Object.entries(mapa || {})) {
    const limpas = mesclarCategorias([], Array.isArray(lista) ? lista : []);
    if (limpas.length) categorias_estoque[dept] = limpas;
  }

  try {
    const { error } = await supabase.rpc("merge_config_sistema_params", {
      p_unidade_id: unidadeId, p_patch: { categorias_estoque },
    });
    if (!error) return { data: categorias_estoque, error: null };
  } catch { /* segue pelo caminho direto */ }

  const { data: registros, error: erroLeitura } = await supabase
    .from("config_sistema").select("id, params").eq("unidade_id", unidadeId).limit(1);
  if (erroLeitura) return { error: erroLeitura.message };

  const registro = registros?.[0];
  const params = { ...(registro?.params || {}), categorias_estoque };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { data: categorias_estoque, error: error?.message || null };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { data: categorias_estoque, error: error?.message || null };
}

// Quantos itens ainda usam a categoria. Apagar categoria em uso deixaria os
// produtos sem classificação sem ninguém perceber.
export async function contarItensNaCategoria(unidadeId, departamento, categoria) {
  if (!isSupabaseReady() || !unidadeId || !categoria) return 0;
  const { count } = await supabase.from("insumos")
    .select("id", { count: "exact", head: true })
    .eq("unidade_id", unidadeId)
    .eq("departamento", departamento)
    .eq("categoria", categoria);
  return count || 0;
}
