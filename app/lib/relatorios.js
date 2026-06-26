import { supabase, isSupabaseReady } from "./supabase";

export async function fetchEstatisticasDashboard(unidadeId, dias = 30) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);
  const dataIso = dataInicio.toISOString();

  // 1. Buscar Pedidos (Faturamento, Canais, Formas de Pagamento)
  const { data: pedidos, error: erroPedidos } = await supabase
    .from("pedidos")
    .select("id, valor_total, tipo_pedido, forma_pagamento, created_at, status")
    .eq("unidade_id", unidadeId)
    .in("status", ["pago", "finalizado", "entregue"])
    .gte("created_at", dataIso);

  if (erroPedidos) return { error: erroPedidos.message };

  // 2. Buscar Itens Vendidos (Para Top Produtos)
  let itensMaisVendidos = [];
  if (pedidos && pedidos.length > 0) {
     const { data: itens, error: erroItens } = await supabase
       .from("pedidos_itens")
       .select(`
         quantidade,
         valor_unitario,
         pedidos!inner(unidade_id, status, created_at),
         produtos(nome_produto)
       `)
       .eq("pedidos.unidade_id", unidadeId)
       .in("pedidos.status", ["pago", "finalizado", "entregue"])
       .gte("pedidos.created_at", dataIso);

     if (!erroItens && itens) {
        const ranking = {};
        itens.forEach(it => {
           const nome = it.produtos?.nome_produto || "Produto Excluído";
           if(!ranking[nome]) ranking[nome] = { nome, qtd: 0, valor: 0 };
           ranking[nome].qtd += it.quantidade;
           ranking[nome].valor += (it.quantidade * it.valor_unitario);
        });
        itensMaisVendidos = Object.values(ranking).sort((a,b) => b.qtd - a.qtd).slice(0, 5);
     }
  }

  // --- Processamento dos Pedidos ---
  let faturamentoTotal = 0;
  const canais = {};
  const pagamentos = {};
  const faturamentoPorDia = {};

  (pedidos || []).forEach(p => {
     const valor = Number(p.valor_total || 0);
     faturamentoTotal += valor;

     // Canais
     const canal = (p.tipo_pedido || "balcao").toUpperCase();
     canais[canal] = (canais[canal] || 0) + valor;

     // Formas Pagamento
     const pg = (p.forma_pagamento || "DINHEIRO").toUpperCase();
     pagamentos[pg] = (pagamentos[pg] || 0) + valor;

     // Por dia (para gráfico de linhas)
     const dataFormatada = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
     faturamentoPorDia[dataFormatada] = (faturamentoPorDia[dataFormatada] || 0) + valor;
  });

  const qtdPedidos = pedidos?.length || 0;
  const ticketMedio = qtdPedidos > 0 ? (faturamentoTotal / qtdPedidos) : 0;

  const arrFaturamentoDia = Object.keys(faturamentoPorDia)
     .map(data => ({ data, valor: faturamentoPorDia[data] }))
     .sort((a,b) => {
        const [d1, m1] = a.data.split('/');
        const [d2, m2] = b.data.split('/');
        // Sorteia cronologicamente dentro do mesmo ano
        return (m1 - m2) || (d1 - d2);
     });

  const arrCanais = Object.keys(canais).map(name => ({ name, value: canais[name] })).sort((a,b) => b.value - a.value);
  const arrPagamentos = Object.keys(pagamentos).map(name => ({ name, value: pagamentos[name] })).sort((a,b) => b.value - a.value);

  return {
     data: {
        faturamentoTotal,
        qtdPedidos,
        ticketMedio,
        faturamentoPorDia: arrFaturamentoDia,
        canais: arrCanais,
        pagamentos: arrPagamentos,
        itensMaisVendidos
     }
  };
}
