import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade } from "./unidades";

export async function fetchRelatorioPerdas(unidadeId, dias = 30) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase não configurado" };

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  // Busca as saídas dos últimos X dias
  let query = supabase
    .from("estoque_movimentacoes")
    .select(`
      id, tipo, quantidade, obs, created_at,
      estoque:estoque_id ( id, nome, categoria, preco_unit )
    `)
    .eq("tipo", "saida")
    .gte("created_at", dataLimite.toISOString());

  const { data, error } = await escoparPorUnidade(query, unidadeId);
  if (error) {
    console.error("[auditoria] fetchRelatorioPerdas erro:", error.message);
    return { data: [], error: error.message };
  }

  // Agrupamento
  const agregados = {};

  for (const mov of (data || [])) {
    if (!mov.estoque) continue; // Item já deletado do catálogo base
    // Tratamento p/ lidar com arrays (dependendo de como o Supabase retorna relacionamentos únicos)
    const est = Array.isArray(mov.estoque) ? mov.estoque[0] : mov.estoque;
    
    if (!agregados[est.id]) {
      agregados[est.id] = {
        estoque_id: est.id,
        nome: est.nome,
        categoria: est.categoria,
        custo_unitario: Number(est.preco_unit) || 0,
        teorico_vendas: 0,
        perda_manual: 0,
      };
    }

    const item = agregados[est.id];
    const qtd = Number(mov.quantidade) || 0;
    const obsStr = String(mov.obs || "");
    const obsLow = obsStr.toLowerCase();

    // Ignorar transferências (são movimentações válidas que não são perdas nem vendas para cliente)
    if (obsLow.includes("transferência") || obsLow.includes("transferencia")) {
      continue; 
    }

    // Se for Venda no PDV, entra no Teórico (deveria ter saído).
    if (obsLow === "venda pdv") {
      item.teorico_vendas += qtd;
    } else {
      // Qualquer outra saída que não for transferência ou venda PDV (ex: baixas manuais, perdas registradas) 
      // é classificada como perda_manual
      item.perda_manual += qtd;
    }
  }

  // Calcula indicadores e formata retorno
  const resultado = Object.values(agregados).map(item => {
    const total_saida = item.teorico_vendas + item.perda_manual;
    const taxa_perda = total_saida > 0 ? (item.perda_manual / total_saida) * 100 : 0;
    const prejuizo = item.perda_manual * item.custo_unitario;

    return {
      ...item,
      total_saida,
      taxa_perda,
      prejuizo,
      status: taxa_perda > 5 ? "critico" : taxa_perda > 2 ? "alerta" : "ok"
    };
  });

  // Ordenar por maior prejuízo financeiro primeiro, e em caso de empate, maior taxa de perda
  resultado.sort((a, b) => b.prejuizo - a.prejuizo || b.taxa_perda - a.taxa_perda);

  return { data: resultado, error: null };
}
