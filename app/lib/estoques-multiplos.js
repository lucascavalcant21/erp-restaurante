import { supabase, isSupabaseReady } from "./supabase";
import { ESTOQUES_PADRAO, slugEstoque, tiposCompativeis } from "./estoques-multiplos-utils.mjs";

const erroMensagem = error => error?.message || null;

export async function garantirEstoquesPadrao(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [], error: "Unidade inválida." };
  const registros = ESTOQUES_PADRAO.map((item, ordem) => ({
    unidade_id: unidadeId,
    nome: item.nome,
    slug: item.slug,
    tipo: item.tipo,
    descricao: `Estoque de ${item.nome.toLowerCase()}`,
    status: "ativo",
    cor: item.cor,
    controla_validade: item.controla_validade,
    controla_minimo: item.controla_minimo,
    locais_internos: [],
    permissoes: [],
    ordem,
  }));
  const { error } = await supabase.from("estoques").upsert(registros, {
    onConflict: "unidade_id,slug",
    ignoreDuplicates: true,
  });
  return { error: erroMensagem(error) };
}

export async function fetchEstoques(unidadeId, incluirInativos = false) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [], error: null };
  let query = supabase.from("estoques").select("*").eq("unidade_id", unidadeId).order("ordem").order("nome");
  if (!incluirInativos) query = query.eq("status", "ativo");
  let { data: estoques, error } = await query;
  if (error) return { data: [], error: erroMensagem(error) };

  if (!estoques?.length) {
    await garantirEstoquesPadrao(unidadeId);
    const resposta = await supabase.from("estoques").select("*").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem").order("nome");
    estoques = resposta.data || [];
    error = resposta.error;
  }
  if (error || !estoques.length) return { data: estoques || [], error: erroMensagem(error) };

  const ids = estoques.map(item => item.id);
  const [{ data: saldos }, { data: movimentos }, { data: todosInsumos }] = await Promise.all([
    supabase.from("estoque_itens").select("estoque_id, quantidade_atual, estoque_minimo, custo_unitario").in("estoque_id", ids),
    supabase.from("estoque_movimentacoes_multi").select("estoque_id, estoque_destino_id, tipo, data_movimento").in("estoque_id", ids).order("data_movimento", { ascending: false }).limit(500),
    supabase.from("insumos").select("id, departamento, categoria, nome").eq("unidade_id", unidadeId),
  ]);

  const metricas = new Map(ids.map(id => [id, { itens: 0, valor_total: 0, abaixo_minimo: 0, ultima_reposicao: null }]));
  for (const saldo of saldos || []) {
    const metrica = metricas.get(saldo.estoque_id);
    if (!metrica) continue;
    metrica.itens += 1;
    metrica.valor_total += (Number(saldo.quantidade_atual) || 0) * (Number(saldo.custo_unitario) || 0);
    const minimo = Number(saldo.estoque_minimo);
    if (Number.isFinite(minimo) && minimo > 0 && Number(saldo.quantidade_atual || 0) < minimo) metrica.abaixo_minimo += 1;
  }
  for (const movimento of movimentos || []) {
    if (movimento.tipo !== "entrada" && movimento.tipo !== "transferencia_entrada") continue;
    const metrica = metricas.get(movimento.estoque_id);
    if (metrica && !metrica.ultima_reposicao) metrica.ultima_reposicao = movimento.data_movimento;
  }

  // Contagem de fallback por departamento se o estoque_itens ainda não tiver vínculos explícitos
  const insumoContagem = new Map();
  for (const ins of todosInsumos || []) {
    const d = (ins.departamento || "cozinha").toLowerCase();
    insumoContagem.set(d, (insumoContagem.get(d) || 0) + 1);
  }

  return {
    data: estoques.map(item => {
      const met = metricas.get(item.id) || {};
      const slug = (item.slug || item.nome || "").toLowerCase();
      if (!met.itens) {
        met.itens = insumoContagem.get(slug) || 0;
      }
      return { ...item, ...met };
    }),
    error: null,
  };
}

export async function salvarEstoque(estoque) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, created_at, itens, valor_total, abaixo_minimo, ultima_reposicao, ...campos } = estoque;
  const payload = {
    ...campos,
    slug: slugEstoque(campos.slug || campos.nome),
    nome: String(campos.nome || "").trim(),
    status: campos.status || "ativo",
    tipo: campos.tipo || "materiais",
    cor: campos.cor || "#059669",
    controla_validade: !!campos.controla_validade,
    controla_minimo: campos.controla_minimo !== false,
    locais_internos: Array.isArray(campos.locais_internos) ? campos.locais_internos.filter(Boolean) : [],
    permissoes: Array.isArray(campos.permissoes) ? campos.permissoes : [],
    updated_at: new Date().toISOString(),
  };
  if (!payload.nome) return { error: "Informe o nome do estoque." };
  if (id) {
    const { data, error } = await supabase.from("estoques").update(payload).eq("id", id).select("*").single();
    return { data, error: erroMensagem(error) };
  }
  const { data, error } = await supabase.from("estoques").insert([payload]).select("*").single();
  return { data, error: erroMensagem(error) };
}

export async function fetchItensEstoque(estoqueId) {
  if (!isSupabaseReady() || !estoqueId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("estoque_itens")
    .select("*, insumo:insumos(*)")
    .eq("estoque_id", estoqueId)
    .order("updated_at", { ascending: false });
  return {
    data: (data || []).map(registro => ({
      ...registro.insumo,
      id: registro.id,
      estoque_item_id: registro.id,
      insumo_id: registro.insumo_id,
      estoque_id: registro.estoque_id,
      quantidade_atual: Number(registro.quantidade_atual) || 0,
      estoque_minimo: registro.estoque_minimo,
      estoque_maximo: registro.estoque_maximo,
      local_interno: registro.local_interno || "",
      validade: registro.validade,
      custo_unitario: Number(registro.custo_unitario ?? registro.insumo?.custo_unitario) || 0,
      ultima_movimentacao_em: registro.ultima_movimentacao_em,
      permite_transferencia: registro.permite_transferencia !== false,
    })),
    error: erroMensagem(error),
  };
}

export async function vincularItemEstoque({
  unidadeId,
  estoqueId,
  insumoId,
  minimo = null,
  maximo = null,
  local = null,
  validade = null,
  custoUnitario = null,
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = {
    unidade_id: unidadeId,
    estoque_id: estoqueId,
    insumo_id: insumoId,
    estoque_minimo: minimo === "" ? null : minimo,
    estoque_maximo: maximo === "" ? null : maximo,
    local_interno: local || null,
    validade: validade || null,
    custo_unitario: custoUnitario === "" ? null : custoUnitario,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("estoque_itens").upsert(payload, {
    onConflict: "estoque_id,insumo_id",
  }).select("*").single();
  return { data, error: erroMensagem(error) };
}

export async function atualizarItemEstoque(estoqueItemId, campos) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const permitidos = {
    estoque_minimo: campos.estoque_minimo === "" ? null : campos.estoque_minimo,
    estoque_maximo: campos.estoque_maximo === "" ? null : campos.estoque_maximo,
    local_interno: campos.local_interno || null,
    validade: campos.validade || null,
    custo_unitario: campos.custo_unitario === "" ? null : campos.custo_unitario,
    permite_transferencia: campos.permite_transferencia !== false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("estoque_itens").update(permitidos).eq("id", estoqueItemId);
  return { error: erroMensagem(error) };
}

async function sincronizarSaldoLegado(unidadeId, insumoId) {
  const { data } = await supabase.from("estoque_itens").select("quantidade_atual").eq("unidade_id", unidadeId).eq("insumo_id", insumoId);
  const total = (data || []).reduce((soma, item) => soma + (Number(item.quantidade_atual) || 0), 0);
  await supabase.from("estoque_atual").upsert({
    unidade_id: unidadeId,
    insumo_id: insumoId,
    quantidade_atual: total,
    updated_at: new Date().toISOString(),
  }, { onConflict: "unidade_id,insumo_id" });
}

export async function registrarMovimentoMulti({
  unidadeId,
  estoqueId,
  insumoId,
  tipo,
  quantidade,
  usuarioId = null,
  usuarioNome = "",
  observacao = "",
  dataMovimento = null,
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const valor = Number(quantidade);
  if (!["entrada", "saida"].includes(tipo) || !Number.isFinite(valor) || valor <= 0) {
    return { error: "Informe uma movimentação válida." };
  }
  const { data, error } = await supabase.rpc("registrar_movimento_estoque_multi", {
    p_unidade_id: unidadeId,
    p_estoque_id: estoqueId,
    p_insumo_id: insumoId,
    p_tipo: tipo,
    p_quantidade: valor,
    p_usuario_id: usuarioId,
    p_usuario_nome: usuarioNome || null,
    p_observacao: observacao || null,
    p_data_movimento: dataMovimento ? new Date(dataMovimento).toISOString() : new Date().toISOString(),
  });
  if (!error) await sincronizarSaldoLegado(unidadeId, insumoId);
  return { data: Array.isArray(data) ? data[0] : data, error: erroMensagem(error) };
}

export async function registrarContagemMulti({
  unidadeId,
  estoqueId,
  insumoId,
  saldoContado,
  usuarioId = null,
  usuarioNome = "",
  observacao = "",
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const saldo = Number(saldoContado);
  if (!Number.isFinite(saldo) || saldo < 0) return { error: "Informe um saldo válido." };
  const { data, error } = await supabase.rpc("registrar_contagem_estoque_multi", {
    p_unidade_id: unidadeId,
    p_estoque_id: estoqueId,
    p_insumo_id: insumoId,
    p_saldo_contado: saldo,
    p_usuario_id: usuarioId,
    p_usuario_nome: usuarioNome || null,
    p_observacao: observacao || null,
  });
  if (!error) await sincronizarSaldoLegado(unidadeId, insumoId);
  return { data: Array.isArray(data) ? data[0] : data, error: erroMensagem(error) };
}

export async function transferirEntreEstoques({
  unidadeId,
  estoqueOrigem,
  estoqueDestino,
  item,
  quantidade,
  usuarioId = null,
  usuarioNome = "",
  observacao = "",
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!item?.permite_transferencia) return { error: "Este item não permite transferência." };
  if (!tiposCompativeis(estoqueOrigem?.tipo, estoqueDestino?.tipo)) {
    return { error: "Os tipos destes estoques não permitem transferência entre si." };
  }
  const valor = Number(quantidade);
  if (!Number.isFinite(valor) || valor <= 0) return { error: "Informe uma quantidade válida." };
  const { data, error } = await supabase.rpc("transferir_item_entre_estoques", {
    p_unidade_id: unidadeId,
    p_estoque_origem_id: estoqueOrigem.id,
    p_estoque_destino_id: estoqueDestino.id,
    p_insumo_id: item.insumo_id,
    p_quantidade: valor,
    p_usuario_id: usuarioId,
    p_usuario_nome: usuarioNome || null,
    p_observacao: observacao || null,
  });
  if (!error) await sincronizarSaldoLegado(unidadeId, item.insumo_id);
  return { data: Array.isArray(data) ? data[0] : data, error: erroMensagem(error) };
}

export async function fetchMovimentosMulti(unidadeId, estoqueId, limite = 500) {
  if (!isSupabaseReady() || !unidadeId || !estoqueId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("estoque_movimentacoes_multi")
    .select("*, insumo:insumos(nome, marca, unidade_medida), estoque:estoques!estoque_id(nome), destino:estoques!estoque_destino_id(nome)")
    .eq("unidade_id", unidadeId)
    .or(`estoque_id.eq.${estoqueId},estoque_destino_id.eq.${estoqueId}`)
    .order("data_movimento", { ascending: false })
    .limit(limite);
  return { data: data || [], error: erroMensagem(error) };
}
