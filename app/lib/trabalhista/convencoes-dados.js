// Leitura da convenção coletiva ATIVA de uma unidade (HDEV-RH-001).
//
// O banco (rh_convencoes, RH-3) diz QUAL convenção vale, para quais unidades,
// desde quando e se está ativa (revisada + ativada). Os NÚMEROS vêm sempre do
// módulo versionado em código (cct-foz-2026-2027.mjs), achado pelo código da
// convenção: ninguém muda percentual editando uma linha do banco.

import { supabase, isSupabaseReady } from "../supabase";
import { CCT_FOZ_2026_2027 } from "./cct-foz-2026-2027.mjs";

export const CONVENCOES_EM_CODIGO = Object.freeze({ [CCT_FOZ_2026_2027.id]: CCT_FOZ_2026_2027 });

/** { status: "ativa", codigo, aplicar_desde, cct } da unidade, ou null. */
export async function fetchConvencaoAtiva(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return null;
  const { data, error } = await supabase.from("rh_convencoes")
    .select("id, codigo, versao, status, vigencia_inicio, vigencia_fim, parametros, unidades")
    .eq("status", "ativa").contains("unidades", [unidadeId])
    .order("versao", { ascending: false }).limit(1);
  if (error || !data?.length) return null;
  const linha = data[0];
  const cct = CONVENCOES_EM_CODIGO[linha.codigo];
  if (!cct) return null; // convenção sem módulo em código: não aplica número nenhum
  return { status: "ativa", codigo: linha.codigo, aplicar_desde: linha.parametros?.aplicar_desde || null, cct };
}
