// Fidelidade no painel da equipe: saldo de um cliente pelo WhatsApp, prêmio,
// cashback no balcão, selo de compra no balcão/ajuste e os cadastros do QR.
// Lê com a sessão do usuário (RLS: clientes.loyalty.view na unidade). Toda
// escrita passa pelas funções da FIDELIDADE-1, que conferem a permissão no
// banco (clientes.loyalty.confirm / .edit) e o saldo sob trava.

import { supabase, isSupabaseReady } from "./supabase";
import { normalizarFidelidade, normalizarTelefone, saldoDoCliente } from "./fidelidade.mjs";

const SEM_LIVRO = /fidelidade_movimentos|does not exist|could not find|schema cache/i;
const mensagem = (error, padrao) => {
  const m = String(error?.message || "");
  if (/permission denied|Sem permissão/i.test(m)) return m.startsWith("Sem permissão") ? m : "Sem permissão para isso nesta unidade.";
  // As funções do banco já respondem em português ("Faltam 2 selo(s)…", "Saldo de cashback insuficiente…").
  if (/^(Faltam|Saldo|Telefone|Escreva|Lance|Valor|Cartão|Cashback)/.test(m)) return m;
  return padrao;
};

export async function carregarFidelidadePainel(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { erro: "Escolha uma unidade." };
  const [rC, rL, rCad] = await Promise.all([
    supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1),
    supabase.from("fidelidade_movimentos").select("id", { count: "exact", head: true }).eq("unidade_id", unidadeId),
    supabase.from("clientes").select("id, nome, tel, cadastro_em, aceita_novidades, aniversario")
      .eq("unidade_id", unidadeId).not("cadastro_em", "is", null).order("cadastro_em", { ascending: false }).limit(20),
  ]);
  return {
    erro: null,
    config: normalizarFidelidade(rC.error ? null : rC.data?.[0]?.params?.fidelidade),
    livro: !rL.error,
    lancamentos: rL.error ? 0 : rL.count || 0,
    cadastros: rCad.error ? [] : rCad.data || [],
  };
}

/** Saldo e histórico de um cliente pelo WhatsApp (qualquer formato). */
export async function buscarClienteFidelidade(unidadeId, telefone, config) {
  const tel = normalizarTelefone(telefone);
  if (!tel) return { erro: "Digite o WhatsApp com DDD." };
  const [rM, rCli] = await Promise.all([
    supabase.from("fidelidade_movimentos").select("id, tipo, cartao_id, selos, valor, pedido_id, origem, observacao, created_at")
      .eq("unidade_id", unidadeId).eq("cliente_tel", tel).order("created_at", { ascending: true }).limit(2000),
    // O telefone pode estar gravado com máscara ("(91) 98888-7777"): busca pelos 4 últimos dígitos e confere inteiro aqui.
    supabase.from("clientes").select("*").eq("unidade_id", unidadeId).ilike("tel", `%${tel.slice(-4)}%`).limit(50),
  ]);
  if (rM.error) return { erro: SEM_LIVRO.test(rM.error.message || "") ? "sem_livro" : "Não foi possível ler a fidelidade agora." };
  const cliente = (rCli.data || []).filter((c) => normalizarTelefone(c.tel) === tel)
    .sort((a, b) => Number(Boolean(b.cadastro_em)) - Number(Boolean(a.cadastro_em)))[0] || null;
  const movimentos = rM.data || [];
  return { erro: null, tel, cliente, movimentos, saldo: saldoDoCliente(movimentos, config) };
}

export async function resgatarSelos(unidadeId, telefone, cartaoId, observacao) {
  const { data, error } = await supabase.rpc("fidelidade_resgatar_selos", { p_unidade: unidadeId, p_telefone: telefone, p_cartao: cartaoId, p_observacao: observacao || null });
  return error ? { erro: mensagem(error, "Não foi possível entregar o prêmio.") } : { erro: null, dados: data };
}

export async function usarCashbackNoBalcao(unidadeId, telefone, valor, observacao) {
  const { data, error } = await supabase.rpc("fidelidade_usar_cashback", { p_unidade: unidadeId, p_telefone: telefone, p_valor: valor, p_observacao: observacao || null });
  return error ? { erro: mensagem(error, "Não foi possível usar o cashback.") } : { erro: null, dados: data };
}

export async function lancarFidelidade(unidadeId, telefone, { cartaoId = null, selos = 0, valor = 0, motivo }) {
  const { error } = await supabase.rpc("fidelidade_lancar", {
    p_unidade: unidadeId, p_telefone: telefone, p_cartao: cartaoId, p_selos: selos, p_valor: valor, p_motivo: motivo,
  });
  return error ? { erro: mensagem(error, "Não foi possível lançar.") } : { erro: null };
}
