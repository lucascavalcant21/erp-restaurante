import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";
import { registrarVenda } from "./vendas";

// ── Leitura de Mesas e Comandas ─────────────────────────────────────────────
export async function fetchMesasEComandas(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  
  // Buscar mesas
  const { data: mesas, error: errM } = await escoparPorUnidade(
    supabase.from("mesas").select("*").order("numero", { ascending: true }),
    unidadeId
  );
  if (errM) {
    console.error("[mesas] fetchMesas:", errM.message);
    return { data: [], error: errM.message };
  }
  
  const mesasMapeadas = (mesas || []).map(m => ({ ...m, numero_mesa: m.numero }));
  
  // Buscar comandas ativas (aberta, fechando)
  const { data: comandas, error: errC } = await escoparPorUnidade(
    supabase.from("comandas").select("*").neq("status", "paga").order("created_at", { ascending: true }),
    unidadeId
  );
  if (errC) {
    console.error("[mesas] fetchComandas:", errC.message);
  }

  const comandasPorMesa = (comandas || []).reduce((acc, c) => {
    if (!acc[c.mesa_id]) acc[c.mesa_id] = [];
    acc[c.mesa_id].push(c);
    return acc;
  }, {});

  // Ordenar mesas numericamente
  const ordenadas = (mesasMapeadas || []).sort((a, b) => {
    const numA = parseInt(a.numero.replace(/\D/g, ""), 10);
    const numB = parseInt(b.numero.replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.numero.localeCompare(b.numero);
  }).map(m => ({ ...m, comandas: comandasPorMesa[m.id] || [] }));

  return { data: ordenadas, error: null };
}

// ── Criação de Mesas em Lote ────────────────────────────────────────────────
export async function gerarMesas(unidadeId, quantidade = 20) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const linhas = Array.from({ length: quantidade }).map((_, i) =>
    carimbarUnidade({ numero: `Mesa ${i + 1}` }, unidadeId)
  );
  const { error } = await supabase.from("mesas").insert(linhas);
  if (error) console.error("[mesas] gerarMesas:", error.message);
  return { error: error?.message || null };
}

// ── Abrir Comanda ───────────────────────────────────────────────────────────
export async function abrirComanda(mesaId, nome_cliente, unidadeId) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("comandas").insert([
    carimbarUnidade({
      mesa_id: mesaId,
      nome_cliente: nome_cliente || "Cliente",
      status: "aberta",
      itens: []
    }, unidadeId)
  ]);
  return { error: error?.message || null };
}

// ── Gerenciar Itens na Comanda ──────────────────────────────────────────────
export async function adicionarItemComanda(comanda, produto) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  
  const itensAtuais = Array.isArray(comanda.itens) ? comanda.itens : [];
  const novoArray = [...itensAtuais];
  
  const idx = novoArray.findIndex(i => i.id === produto.id);
  if (idx >= 0) {
    novoArray[idx].quantidade += 1;
  } else {
    novoArray.push({
      id: produto.id,
      nome: produto.nome,
      preco: Number(produto.preco) || 0,
      custo: Number(produto.custo) || 0,
      categoria: produto.categoria,
      quantidade: 1
    });
  }

  const { error } = await supabase.from("comandas").update({ itens: novoArray }).eq("id", comanda.id);
  return { error: error?.message || null };
}

export async function removerItemComanda(comanda, produtoId) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const itensAtuais = Array.isArray(comanda.itens) ? comanda.itens : [];
  const novoArray = itensAtuais.map(i => i.id === produtoId ? { ...i, quantidade: i.quantidade - 1 } : i).filter(i => i.quantidade > 0);
  
  const { error } = await supabase.from("comandas").update({ itens: novoArray }).eq("id", comanda.id);
  return { error: error?.message || null };
}

// ── Fechar Comanda (Checkout Final) ─────────────────────────────────────────
export async function fecharComanda(comanda, pagamentoOpts, unidadeId) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  
  const itens = Array.isArray(comanda.itens) ? comanda.itens : [];
  if (itens.length === 0) {
    // Comanda vazia, apenas encerra/exclui status
    const { error } = await supabase.from("comandas").update({ status: "paga" }).eq("id", comanda.id);
    return { error: error?.message || null };
  }

  // 1. Registra a Venda
  const vendaOpts = {
    itens: itens,
    desconto: pagamentoOpts.desconto,
    taxa_servico: pagamentoOpts.taxa_servico,
    acrescimo: pagamentoOpts.acrescimo,
    forma_pagamento: pagamentoOpts.forma_pagamento,
    cliente: comanda.nome_cliente || pagamentoOpts.cliente || "",
    observacao: `Comanda ${comanda.id.slice(0,6)}`,
    caixa_id: pagamentoOpts.caixa_id || null
  };

  const { error: errVenda, baixaEstoque } = await registrarVenda(vendaOpts, unidadeId);
  if (errVenda) return { error: errVenda };

  // 2. Marca comanda como paga
  const { error: errC } = await supabase.from("comandas").update({ status: "paga" }).eq("id", comanda.id);
  if (errC) console.error("[mesas] Erro ao fechar comanda:", errC);

  return { error: null, baixaEstoque };
}
