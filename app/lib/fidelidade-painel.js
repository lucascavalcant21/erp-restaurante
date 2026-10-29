// Fidelidade no painel da equipe: saldo de um cliente pelo WhatsApp, prêmio,
// cashback no balcão, selo de compra no balcão/ajuste e os cadastros do QR.
// Lê com a sessão do usuário (RLS: clientes.loyalty.view na unidade). Toda
// escrita passa pelas funções da FIDELIDADE-1, que conferem a permissão no
// banco (clientes.loyalty.confirm / .edit) e o saldo sob trava.

import { supabase, isSupabaseReady } from "./supabase";
import { normalizarFidelidade, normalizarTelefone, saldoDoCliente } from "./fidelidade.mjs";
import { salvarParams } from "./parametros";

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

// ─── Painel → Fidelidade e selos (protótipo PainelFidelidade) ──────────────

const SEM_PREMIOS = /fidelidade_premios|fidelidade_validar_premio|fidelidade_confirmar_premio|does not exist|could not find|schema cache/i;

/** Retiradas recentes (código, prêmio, quando) e números de cada cartão. Sem a FIDELIDADE-2: só os números do livro. */
export async function carregarPainelFidelidade(unidadeId) {
  const base = await carregarFidelidadePainel(unidadeId);
  if (base.erro) return base;
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const [rP, rM] = await Promise.all([
    supabase.from("fidelidade_premios").select("codigo, cartao_id, recompensa, cliente_tel, completo_em, retirado_em, retirado_por")
      .eq("unidade_id", unidadeId).order("completo_em", { ascending: false }).limit(200),
    supabase.from("fidelidade_movimentos").select("cliente_tel, cartao_id, selos, tipo, created_at").eq("unidade_id", unidadeId)
      .like("tipo", "selo%").limit(5000),
  ]);
  const premios = rP.error ? [] : rP.data || [];
  // Selos por cliente e cartão: quantos cartões estão em andamento (tem selo, ainda não completou).
  const saldo = new Map();
  for (const m of rM.error ? [] : rM.data || []) {
    const k = `${m.cartao_id}|${m.cliente_tel}`;
    saldo.set(k, (saldo.get(k) || 0) + (Number(m.selos) || 0));
  }
  const numeros = {};
  for (const c of base.config.cartoes) {
    let andamento = 0;
    for (const [k, v] of saldo) if (k.startsWith(`${c.id}|`) && v > 0 && v < c.selos) andamento += 1;
    numeros[c.id] = { andamento, completosMes: premios.filter((p) => p.cartao_id === c.id && new Date(p.completo_em) >= inicioMes).length };
  }
  const retiradas = premios.filter((p) => p.retirado_em).sort((a, b) => String(b.retirado_em).localeCompare(String(a.retirado_em))).slice(0, 20);
  const tels = [...new Set(retiradas.map((p) => p.cliente_tel))];
  const quem = [...new Set(retiradas.map((p) => p.retirado_por).filter(Boolean))];
  const [rCli, rU] = await Promise.all([
    tels.length ? supabase.from("clientes").select("nome, tel").eq("unidade_id", unidadeId).limit(500) : { data: [] },
    quem.length ? supabase.from("usuarios_erp").select("auth_user_id, nome").in("auth_user_id", quem) : { data: [] },
  ]);
  const nomeDoTel = new Map((rCli.data || []).map((c) => [normalizarTelefone(c.tel), c.nome]));
  const nomeDoUsuario = new Map((rU.error ? [] : rU.data || []).map((u) => [u.auth_user_id, u.nome]));
  return {
    ...base,
    premiosLigados: !rP.error,
    numeros,
    retiradas: retiradas.map((p) => ({
      quando: p.retirado_em, cliente: abreviar(nomeDoTel.get(p.cliente_tel)) || `final ${p.cliente_tel.slice(-4)}`,
      premio: p.recompensa || "", codigo: p.codigo, quem: nomeDoUsuario.get(p.retirado_por) || "Equipe",
    })),
  };
}
const abreviar = (nome) => {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || "";
};

/** Código que o cliente mostrou: confere sem dar baixa. */
export async function validarPremio(unidadeId, codigo) {
  const { data, error } = await supabase.rpc("fidelidade_validar_premio", { p_unidade: unidadeId, p_codigo: String(codigo || "").replace(/[^A-Za-z0-9]/g, "") });
  if (error) return { erro: SEM_PREMIOS.test(error.message || "") ? "sem_premios" : mensagem(error, "Não foi possível conferir o código.") };
  return { erro: null, dados: data };
}

export async function confirmarPremio(unidadeId, codigo) {
  const { data, error } = await supabase.rpc("fidelidade_confirmar_premio", { p_unidade: unidadeId, p_codigo: String(codigo || "").replace(/[^A-Za-z0-9]/g, "") });
  if (error) {
    const m = String(error.message || "");
    return { erro: /^(Código|Este|O cliente)/.test(m) ? m : mensagem(error, "Não foi possível confirmar a retirada.") };
  }
  return { erro: null, dados: data };
}

/** Regras de pontos/cashback e canais (config_sistema.params.fidelidade), relendo antes de gravar. */
export async function salvarRegrasFidelidade(unidadeId, mudar) {
  const { data, error } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
  if (error) return { erro: "Não foi possível ler a configuração." };
  const atual = normalizarFidelidade(data?.[0]?.params?.fidelidade);
  const nova = normalizarFidelidade(mudar(atual));
  const r = await salvarParams(unidadeId, { fidelidade: nova });
  if (r?.error) return { erro: "Não foi possível salvar. Confira sua permissão e tente de novo." };
  return { erro: null, config: nova };
}
