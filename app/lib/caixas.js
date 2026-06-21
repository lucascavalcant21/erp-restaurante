import { supabase, isSupabaseReady } from "./supabase";
import { carimbarUnidade } from "./unidades";

// ── Obter Caixa Aberto ──────────────────────────────────────────────────────
export async function fetchCaixaAberto(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from("pdv_caixas")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("status", "aberto")
    .maybeSingle();
  
  if (error) {
    console.error("[caixas] fetchCaixaAberto:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

// ── Abrir Caixa ─────────────────────────────────────────────────────────────
export async function abrirCaixa(unidadeId, usuarioId, fundoInicial) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  
  // Verifica se já tem aberto
  const { data: atual } = await fetchCaixaAberto(unidadeId);
  if (atual) return { data: atual, error: "Já existe um caixa aberto." };

  const { data, error } = await supabase.from("pdv_caixas").insert([
    carimbarUnidade({
      usuario_id: usuarioId || "Operador",
      fundo_inicial: Number(fundoInicial) || 0,
      status: "aberto"
    }, unidadeId)
  ]).select("*").single();

  if (error) {
    console.error("[caixas] abrirCaixa:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

// ── Registrar Suprimento / Sangria ──────────────────────────────────────────
export async function registrarMovimentacao(caixaId, unidadeId, tipo, valor, descricao) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };

  const { error } = await supabase.from("pdv_movimentacoes").insert([
    carimbarUnidade({
      caixa_id: caixaId,
      tipo: tipo, // 'suprimento' ou 'sangria'
      valor: Number(valor) || 0,
      descricao: descricao || ""
    }, unidadeId)
  ]);

  return { error: error?.message || null };
}

// ── Gerar Resumo do Caixa (Leitura X / Z) ───────────────────────────────────
export async function fetchResumoCaixa(caixaId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };

  // Busca o caixa
  const { data: caixa, error: errC } = await supabase.from("pdv_caixas").select("*").eq("id", caixaId).single();
  if (errC) return { data: null, error: errC.message };

  // Busca as vendas (apenas as que não foram canceladas)
  const { data: vendas, error: errV } = await supabase.from("vendas")
    .select("total, forma_pagamento")
    .eq("caixa_id", caixaId)
    .neq("status", "cancelada");
  
  // Busca movimentacoes
  const { data: movs, error: errM } = await supabase.from("pdv_movimentacoes")
    .select("tipo, valor")
    .eq("caixa_id", caixaId);

  // Calcula
  const resumo = {
    fundo_inicial: Number(caixa.fundo_inicial) || 0,
    suprimentos: 0,
    sangrias: 0,
    vendas_dinheiro: 0,
    vendas_pix: 0,
    vendas_cartao: 0,
    vendas_outros: 0,
    total_vendas: 0,
    esperado_gaveta: 0
  };

  (movs || []).forEach(m => {
    const val = Number(m.valor);
    if (m.tipo === "suprimento") resumo.suprimentos += val;
    if (m.tipo === "sangria") resumo.sangrias += val;
  });

  (vendas || []).forEach(v => {
    const val = Number(v.total);
    resumo.total_vendas += val;
    if (v.forma_pagamento === "dinheiro") resumo.vendas_dinheiro += val;
    else if (v.forma_pagamento === "pix") resumo.vendas_pix += val;
    else if (v.forma_pagamento === "credito" || v.forma_pagamento === "debito") resumo.vendas_cartao += val;
    else resumo.vendas_outros += val;
  });

  // Dinheiro esperado na gaveta física = Fundo + Suprimentos - Sangrias + Vendas em Dinheiro
  resumo.esperado_gaveta = resumo.fundo_inicial + resumo.suprimentos - resumo.sangrias + resumo.vendas_dinheiro;

  return { data: resumo, error: null };
}

// ── Fechar Caixa ────────────────────────────────────────────────────────────
export async function fecharCaixa(caixaId, saldoInformado = null) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };

  const { data: resumo, error: errR } = await fetchResumoCaixa(caixaId);
  if (errR) return { error: errR };

  const { error } = await supabase.from("pdv_caixas").update({
    status: "fechado",
    fechado_em: new Date().toISOString(),
    saldo_final: saldoInformado !== null ? Number(saldoInformado) : resumo.esperado_gaveta,
    totais_fechamento: resumo
  }).eq("id", caixaId);

  return { error: error?.message || null, resumo };
}
