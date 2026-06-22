// ═══════════════════════════════════════════════════════════════
// engenharia.js — Engenharia de Cardápio (Matriz BCG)
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

export async function fetchEngenharia(unidadeId, departamento = null) {
  if (!isSupabaseReady()) return { data: [], error: "Sistema offline" };

  // 1. Busca os itens do cardápio ativos
  let queryCardapio = supabase.from("cardapio").select("id, nome, departamento, preco, custo").eq("status", "ativo");
  if (unidadeId && unidadeId !== "todas") queryCardapio = queryCardapio.eq("unidade_id", unidadeId);
  if (departamento) queryCardapio = queryCardapio.eq("departamento", departamento);

  const { data: cardapio } = await queryCardapio;
  if (!cardapio || cardapio.length === 0) return { data: [] };

  // 2. Busca histórico de itens vendidos (Volume)
  // Vamos buscar os itens dos pedidos que estão concluídos (pago)
  let queryPedidos = supabase.from("pedidos").select("id, status").eq("status", "pago");
  if (unidadeId && unidadeId !== "todas") queryPedidos = queryPedidos.eq("unidade_id", unidadeId);
  const { data: pedidos } = await queryPedidos;
  
  let mapVolumes = {};
  if (pedidos && pedidos.length > 0) {
      const pedidoIds = pedidos.map(p => p.id);
      const { data: itensPedidos } = await supabase.from("pedidos_itens")
         .select("nome_item, quantidade")
         .in("pedido_id", pedidoIds);
      
      if (itensPedidos) {
         itensPedidos.forEach(it => {
            const qty = Number(it.quantidade) || 0;
            const nome = it.nome_item.trim();
            mapVolumes[nome] = (mapVolumes[nome] || 0) + qty;
         });
      }
  }

  // 3. Monta os dados mesclando Margem e Volume
  let itensProcessados = cardapio.map(item => {
      const prc = Number(item.preco) || 0;
      const cst = Number(item.custo) || 0;
      const margemAbsoluta = prc - cst;
      const volume = mapVolumes[item.nome.trim()] || 0;

      return {
          id: item.id,
          nome: item.nome,
          departamento: item.departamento,
          preco: prc,
          custo: cst,
          margem: margemAbsoluta,
          volume: volume
      };
  });

  // Remove itens que não tiveram NENHUMA venda para não distorcer as médias?
  // Na verdade, itens sem venda são puros "Cachorros". É bom manter.
  
  // 4. Calcula Médias do Quadrante
  const totalItens = itensProcessados.length;
  if (totalItens === 0) return { data: [] };

  const sumMargem = itensProcessados.reduce((acc, i) => acc + i.margem, 0);
  const sumVolume = itensProcessados.reduce((acc, i) => acc + i.volume, 0);
  
  const avgMargem = sumMargem / totalItens;
  const avgVolume = sumVolume / totalItens;

  // 5. Classifica (Matriz BCG Kasavana/Smith)
  itensProcessados = itensProcessados.map(i => {
      let classificacao = "";
      if (i.margem >= avgMargem && i.volume >= avgVolume) classificacao = "Estrela";
      else if (i.margem < avgMargem && i.volume >= avgVolume) classificacao = "Burro de Carga";
      else if (i.margem >= avgMargem && i.volume < avgVolume) classificacao = "Quebra-Cabeça";
      else classificacao = "Cachorro";

      return { ...i, classificacao };
  });

  // Ordena por maior margem e maior volume
  itensProcessados.sort((a, b) => (b.margem * b.volume) - (a.margem * a.volume));

  return { data: itensProcessados, medias: { avgMargem, avgVolume } };
}
