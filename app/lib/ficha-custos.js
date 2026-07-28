import { supabase, isSupabaseReady } from "./supabase";

// Histórico de custos por ficha técnica. Enquanto a migração
// (db/migracao_ficha_custo_historico.sql) não for rodada, estas funções
// degradam em silêncio: a tela continua funcionando, só sem histórico.

const erro = e => e?.message || null;

// Erro típico de tabela ausente (migração ainda não rodada).
function tabelaAusente(e) {
  const m = (e?.message || e || "").toString().toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("relation");
}

export async function fetchHistoricoCustoFicha(unidadeId, fichaId) {
  if (!isSupabaseReady() || !fichaId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("fichas_custo_historico")
    .select("*")
    .eq("ficha_id", fichaId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { data: [], error: tabelaAusente(error) ? "sem_tabela" : erro(error) };
  return { data: data || [], error: null };
}

// Registra um retrato do custo — só insere se mudou em relação ao último
// (evita linhas duplicadas). Retorna { data, error, pulado }.
export async function registrarCustoFicha({
  unidadeId, fichaId, custoTotal, custoPorcao = null,
  ingredienteGatilho = null, origem = "edicao_ficha",
  usuarioId = null, usuarioNome = "",
}) {
  if (!isSupabaseReady() || !fichaId) return { error: null, pulado: true };
  const total = Number(custoTotal) || 0;

  // Último custo registrado, para calcular a diferença e deduplicar.
  const { data: ultimos, error: erroLeitura } = await supabase
    .from("fichas_custo_historico")
    .select("custo_total")
    .eq("ficha_id", fichaId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (erroLeitura) {
    if (tabelaAusente(erroLeitura)) return { error: "sem_tabela", pulado: true };
    return { error: erro(erroLeitura), pulado: true };
  }

  const anterior = ultimos && ultimos.length ? Number(ultimos[0].custo_total) : null;
  // Nada mudou desde o último retrato → não registra de novo.
  if (anterior !== null && Math.abs(anterior - total) < 0.005) return { error: null, pulado: true };

  const diferenca = anterior !== null ? +(total - anterior).toFixed(4) : null;
  const diferencaPct = anterior && anterior > 0 ? +(((total - anterior) / anterior) * 100).toFixed(4) : null;

  const { data, error } = await supabase.from("fichas_custo_historico").insert({
    unidade_id: unidadeId || null,
    ficha_id: fichaId,
    custo_total: total,
    custo_porcao: custoPorcao != null ? Number(custoPorcao) : null,
    custo_anterior: anterior,
    diferenca,
    diferenca_pct: diferencaPct,
    ingrediente_gatilho: ingredienteGatilho,
    origem,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome || null,
  }).select("*").single();

  if (error) return { error: tabelaAusente(error) ? "sem_tabela" : erro(error), pulado: true };
  return { data, error: null, pulado: false };
}
