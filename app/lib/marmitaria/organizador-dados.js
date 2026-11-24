// Dados do Organizador de plataforma (app/lib/marmitaria/organizador.mjs).
// Lê e grava em config_sistema.params.organizador_plataforma com a sessão do
// usuário (RLS por unidade). Antes de gravar relê o que está no banco e troca
// só a vitrine da plataforma aberta: o que o Jhon gravou em outra plataforma
// (ou outro aparelho) não se perde. Fotos vão para o armazenamento "anexos"
// (o mesmo do cardápio digital).

import { supabase, isSupabaseReady } from "../supabase";
import { salvarParams } from "../parametros";
import { enviarArquivoCardapio } from "../cardapio-editor";
import { CHAVE_PARAMS, comVitrine, normalizarOrganizador } from "./organizador.mjs";

export async function carregarOrganizador(unidadeId) {
  if (!isSupabaseReady()) return { erro: "Sem conexão com o banco.", organizador: normalizarOrganizador(null) };
  if (!unidadeId || unidadeId === "todas") return { erro: "Escolha uma unidade.", organizador: normalizarOrganizador(null) };
  const { data, error } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
  if (error) return { erro: "Não consegui ler a vitrine agora. Tente de novo.", organizador: normalizarOrganizador(null) };
  return { erro: null, organizador: normalizarOrganizador(data?.[0]?.params?.[CHAVE_PARAMS]) };
}

export async function salvarVitrine(unidadeId, plataforma, vitrine) {
  const atual = await carregarOrganizador(unidadeId);
  if (atual.erro) return { erro: atual.erro };
  const novo = comVitrine(atual.organizador, plataforma, vitrine);
  const r = await salvarParams(unidadeId, { [CHAVE_PARAMS]: novo });
  if (r?.error) return { erro: "Não consegui guardar a vitrine. Tente de novo." };
  return { erro: null, organizador: novo };
}

export const enviarFotoDoPrato = (unidadeId, arquivo) => enviarArquivoCardapio(unidadeId, arquivo, "organizador");
