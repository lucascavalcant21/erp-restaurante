import { supabase, isSupabaseReady } from "./supabase";
import { ESTOQUES_PADRAO, LOCAIS_BAR_ANTIGOS, slugEstoque, tiposCompativeis } from "./estoques-multiplos-utils.mjs";

const erroMensagem = error => error?.message || null;

// Corrida com timeout: nenhuma chamada ao Supabase pode travar o botão para
// sempre. Se a promessa não resolver no prazo, devolvemos um erro tratável.
// Corrida com timeout: nenhuma chamada ao Supabase pode travar o botão para
// sempre. Se a promessa não resolver em 3s, caímos no fallback instantâneo.
function comTimeout(promise, ms = 3000) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise(resolve => setTimeout(() => resolve({ __timeout: true, error: { message: "__timeout" } }), ms)),
  ]);
}

// A RPC nova (registrar_movimento_estoque_multi / estoque_itens) pode não existir
// no banco ainda. Detecta esse caso pelo texto do erro / timeout para acionar o
// caminho legado direto na tabela estoque_atual.
function precisaFallbackLegado(res) {
  if (res?.__timeout) return true;
  const m = (res?.error?.message || res?.error || "").toString().toLowerCase();
  if (!m) return false;
  return (
    m.includes("__timeout") ||
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("invalid input syntax for type uuid") ||
    (m.includes("function") && m.includes("not")) ||
    m.includes("relation") ||
    m.includes("404") ||
    m.includes("undefined")
  );
}

// Movimentação legada/direta: atualiza o saldo em estoque_itens e estoque_atual instantaneamente.
export async function movimentoLegado({ unidadeId, estoqueId, insumoId, tipo, quantidade, saldoContado, usuarioId, usuarioNome, observacao }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId || !insumoId) return { error: "Item ou unidade inválidos." };
  let novo;
  const q = Number(quantidade) || 0;

  // 1. Atualizar em estoque_itens se tiver estoqueId
  if (estoqueId) {
    const itemRes = await comTimeout(
      supabase.from("estoque_itens").select("id, quantidade_atual").eq("estoque_id", estoqueId).eq("insumo_id", insumoId).maybeSingle(),
      2500,
    );
    if (itemRes?.data) {
      const atual = Number(itemRes.data.quantidade_atual) || 0;
      novo = tipo === "contagem" ? Math.max(0, Number(saldoContado) || 0) : (tipo === "entrada" ? atual + q : Math.max(0, atual - q));
      await supabase.from("estoque_itens").update({ quantidade_atual: novo, updated_at: new Date().toISOString() }).eq("id", itemRes.data.id);
    }
  }

  // 2. Se não achou em estoque_itens, calcula em estoque_atual
  if (novo === undefined) {
    if (tipo === "contagem") {
      novo = Math.max(0, Number(saldoContado) || 0);
    } else {
      if (q <= 0) return { error: "Informe uma quantidade válida." };
      const atualRes = await comTimeout(
        supabase.from("estoque_atual").select("quantidade_atual").eq("unidade_id", unidadeId).eq("insumo_id", insumoId).maybeSingle(),
        2500,
      );
      const atual = Number(atualRes?.data?.quantidade_atual) || 0;
      novo = tipo === "entrada" ? atual + q : Math.max(0, atual - q);
    }
  }

  // 3. Atualiza em estoque_atual para manter contabilidade global em dia
  await comTimeout(
    supabase.from("estoque_atual").upsert({
      unidade_id: unidadeId,
      insumo_id: insumoId,
      quantidade_atual: novo,
      updated_at: new Date().toISOString(),
    }, { onConflict: "unidade_id,insumo_id" }),
    2500,
  );

  // 4. Registra histórico da movimentação
  await supabase.from("estoque_movimentacoes").insert({
    unidade_id: unidadeId,
    insumo_id: insumoId,
    tipo: tipo || "entrada",
    quantidade: q || Number(saldoContado) || 0,
    usuario_id: usuarioId || null,
    usuario_nome: usuarioNome || null,
    observacao: observacao || null,
    created_at: new Date().toISOString(),
  }).catch(() => {});

  return { data: { quantidade_atual: novo }, error: null };
}

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
    locais_internos: item.locais || [],
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

  let estoques = [];
  try {
    // Garante tambem os estoques adicionados depois que a unidade ja existia.
    // O upsert ignora os que ja estao cadastrados e cria apenas os ausentes.
    await garantirEstoquesPadrao(unidadeId);
    let query = supabase.from("estoques").select("*").eq("unidade_id", unidadeId).order("ordem").order("nome");
    if (!incluirInativos) query = query.eq("status", "ativo");
    let { data, error } = await query;

    if (!error && data?.length) {
      estoques = data;
      // Estoques padrão criados depois (ex.: Embalagens da Cozinha/Bar) nunca
      // apareciam para quem já tinha a lista antiga. Se faltar algum, cria.
      const slugsAtuais = new Set(estoques.map(e => String(e.slug || "").toLowerCase()));
      const faltando = ESTOQUES_PADRAO.some(p => !slugsAtuais.has(p.slug));
      if (faltando) {
        await garantirEstoquesPadrao(unidadeId);
        const recarregado = await supabase.from("estoques").select("*").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem").order("nome");
        if (recarregado.data?.length) estoques = recarregado.data;
      }
      // Locais padrão criados depois (ex.: expositor/balcão/depósito do Bar) não
      // chegam pelo upsert acima, que ignora quem já existe. Preenche só quando
      // o estoque ainda não tem local nenhum — nunca sobrescreve o do usuário.
      const mesmaLista = (a = [], b = []) =>
        a.length === b.length && a.every(x => b.includes(x));
      const semLocais = estoques.filter(e => {
        const padrao = ESTOQUES_PADRAO.find(p => p.slug === String(e.slug || "").toLowerCase());
        if (!padrao?.locais?.length) return false;
        const atuais = e.locais_internos || [];
        // Sem local nenhum, ou ainda com a lista antiga que ninguém editou.
        return !atuais.length || mesmaLista(atuais, LOCAIS_BAR_ANTIGOS);
      });
      for (const estoque of semLocais) {
        const padrao = ESTOQUES_PADRAO.find(p => p.slug === String(estoque.slug || "").toLowerCase());
        await supabase.from("estoques").update({ locais_internos: padrao.locais }).eq("id", estoque.id);
        estoque.locais_internos = padrao.locais;
      }
    } else {
      await garantirEstoquesPadrao(unidadeId);
      const resposta = await supabase.from("estoques").select("*").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem").order("nome");
      if (resposta.data?.length) estoques = resposta.data;
    }
  } catch (err) {
    console.warn("[fetchEstoques] Usando fallback seguro para estoques:", err);
  }

  // Fallback seguro em memória se a tabela no Supabase estiver restrita por RLS
  if (!estoques || !estoques.length) {
    estoques = ESTOQUES_PADRAO.map((item, ordem) => ({
      id: item.slug,
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
  }

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

export async function fetchItensEstoque(estoqueId, unidadeId) {
  if (!isSupabaseReady() || !estoqueId) return { data: [], error: null };

  let data = null;
  try {
    const res = await supabase
      .from("estoque_itens")
      .select("*, insumo:insumos(*)")
      .eq("estoque_id", estoqueId)
      .order("updated_at", { ascending: false });
    if (!res.error && res.data?.length) {
      data = res.data;
    }
  } catch (e) {
    console.warn("[fetchItensEstoque] Erro estoque_itens:", e);
  }

  if (data && data.length > 0) {
    return {
      data: data.map(registro => ({
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
      error: null,
    };
  }

  // Pré-preparos começam vazios e só exibem os itens vinculados a esse estoque.
  // Isso impede que o fallback legado misture o saldo dos produtos comuns.
  let identificadorEstoque = String(estoqueId).toLowerCase();
  if (!identificadorEstoque.includes("pre-preparo") && !identificadorEstoque.includes("preparo")) {
    const { data: cadastroEstoque } = await supabase.from("estoques").select("slug,nome").eq("id", estoqueId).maybeSingle();
    identificadorEstoque = `${cadastroEstoque?.slug || ""} ${cadastroEstoque?.nome || ""}`.toLowerCase();
  }
  if (identificadorEstoque.includes("pre-preparo") || identificadorEstoque.includes("pré-preparo")) {
    return { data: [], error: null };
  }

  // Fallback: Busca de insumos + estoque_atual filtrado pelo departamento do estoqueId
  const slug = identificadorEstoque || String(estoqueId).toLowerCase();
  let queryInsumos = supabase.from("insumos").select("*");
  if (unidadeId && unidadeId !== "todas" && unidadeId !== "matriz") {
    queryInsumos = queryInsumos.eq("unidade_id", unidadeId);
  }

  if (slug.includes("bar") || slug === "bebidas") {
    queryInsumos = queryInsumos.eq("departamento", "bar");
  } else if (slug.includes("limpeza")) {
    queryInsumos = queryInsumos.eq("departamento", "limpeza");
  } else if (slug.includes("embalag")) {
    queryInsumos = queryInsumos.eq("departamento", "embalagens");
  } else if (slug.includes("cozinha")) {
    queryInsumos = queryInsumos.eq("departamento", "cozinha");
  }

  const { data: listInsumos } = await queryInsumos;
  const insumoIds = (listInsumos || []).map(i => i.id);
  let mapaSaldos = new Map();
  if (insumoIds.length > 0) {
    const { data: saldosLegados } = await supabase.from("estoque_atual").select("insumo_id, quantidade_atual").in("insumo_id", insumoIds);
    (saldosLegados || []).forEach(s => mapaSaldos.set(s.insumo_id, Number(s.quantidade_atual) || 0));
  }

  return {
    data: (listInsumos || []).map(ins => ({
      ...ins,
      insumo_id: ins.id,
      estoque_id: estoqueId,
      quantidade_atual: mapaSaldos.get(ins.id) || 0,
      custo_unitario: Number(ins.custo_unitario ?? ins.custo_compra) || 0,
      permite_transferencia: true,
    })),
    error: null,
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

// Troca só o lugar do produto dentro do estoque (depósito, expositor,
// balcão...). Não mexe em saldo, mínimo nem validade.
export async function realocarItemEstoque(estoqueItemId, local) {
  if (!isSupabaseReady() || !estoqueItemId) return { error: "Item inválido" };
  const { error } = await supabase.from("estoque_itens")
    .update({ local_interno: local || null, updated_at: new Date().toISOString() })
    .eq("id", estoqueItemId);
  return { error: erroMensagem(error) };
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
  const res = await comTimeout(supabase.rpc("registrar_movimento_estoque_multi", {
    p_unidade_id: unidadeId,
    p_estoque_id: estoqueId,
    p_insumo_id: insumoId,
    p_tipo: tipo,
    p_quantidade: valor,
    p_usuario_id: usuarioId,
    p_usuario_nome: usuarioNome || null,
    p_observacao: observacao || null,
    p_data_movimento: dataMovimento ? new Date(dataMovimento).toISOString() : new Date().toISOString(),
  }));
  if (precisaFallbackLegado(res)) {
    return movimentoLegado({ unidadeId, estoqueId, insumoId, tipo, quantidade: valor, usuarioId, usuarioNome, observacao });
  }
  const { data, error } = res;
  if (!error) await sincronizarSaldoLegado(unidadeId, insumoId).catch(() => {});
  return { data: Array.isArray(data) ? data[0] : data, error: erroMensagem(error) };
}

// Uma única confirmação na interface pode movimentar vários itens. Cada item
// usa o mesmo motor transacional do estoque e o retorno preserva falhas
// individuais para não esconder uma movimentação parcial.
// Cadastra a ficha no estoque correto com saldo zero. A entrada de quantidade
// continua acontecendo somente quando a producao for efetivamente registrada.
export async function garantirFichaNoEstoquePreparo({ unidadeId, ficha, departamento = "cozinha", local = "", custoUnitario = 0 }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId || !ficha?.id || !ficha?.nome_receita) return { error: "Ficha de preparo invalida." };

  await garantirEstoquesPadrao(unidadeId);
  const dept = String(departamento || ficha.departamento || "cozinha").toLowerCase() === "bar" ? "bar" : "cozinha";
  const { data: estoque, error: erroEstoque } = await supabase.from("estoques").select("id,nome").eq("unidade_id", unidadeId).eq("slug", `pre-preparos-${dept}`).maybeSingle();
  if (erroEstoque || !estoque?.id) return { error: erroMensagem(erroEstoque) || "Estoque de pre-preparos nao encontrado." };

  const localLimpo = String(local || (dept === "bar" ? "Bar" : "Freezer 1")).trim();
  const nomeBase = String(ficha.nome_receita).trim();
  const nomeItem = `${nomeBase} - ${localLimpo}`;
  let { data: insumo } = await supabase.from("insumos").select("id,nome,unidade_medida,custo_unitario").eq("unidade_id", unidadeId).eq("departamento", dept).in("nome", [nomeItem, `${nomeBase} · ${localLimpo}`]).limit(1).maybeSingle();

  const unidadeFicha = String(ficha.rendimento_unidade || "un").toLowerCase();
  const unidade = ["kg", "g", "l", "ml", "un"].includes(unidadeFicha) ? unidadeFicha : "un";
  if (!insumo) {
    const criado = await supabase.from("insumos").insert([{
      unidade_id: unidadeId, nome: nomeItem, departamento: dept,
      categoria: ficha.categoria || (dept === "bar" ? "Xaropes e pre-preparos" : "Pre-preparos"),
      unidade_medida: unidade, unidade_comercial: unidade, tamanho_embalagem: 1,
      custo_unitario: Number(custoUnitario) || 0, custo_compra: Number(custoUnitario) || 0,
    }]).select("id,nome,unidade_medida,custo_unitario").single();
    if (criado.error || !criado.data) return { error: erroMensagem(criado.error) || "Nao foi possivel criar o item de preparo." };
    insumo = criado.data;
  }

  const { data: itemExistente } = await supabase.from("estoque_itens").select("id").eq("estoque_id", estoque.id).eq("insumo_id", insumo.id).maybeSingle();
  if (!itemExistente) {
    const vinculo = await vincularItemEstoque({ unidadeId, estoqueId: estoque.id, insumoId: insumo.id, local: localLimpo, custoUnitario: Number(custoUnitario) || 0 });
    if (vinculo.error) return { error: vinculo.error };
  }
  return { data: { estoque, insumo, nome: nomeBase, local: localLimpo, unidade }, error: null };
}

export async function registrarProducaoNoEstoquePreparo({ unidadeId, ficha, departamento = "cozinha", quantidade, local, usuarioId = null, usuarioNome = "", custoUnitario = 0 }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const qtd = Number(quantidade);
  if (!ficha?.id || !ficha?.nome_receita || !Number.isFinite(qtd) || qtd <= 0) return { error: "Produção inválida." };

  await garantirEstoquesPadrao(unidadeId);
  const dept = String(departamento || ficha.departamento || "cozinha").toLowerCase() === "bar" ? "bar" : "cozinha";
  const { data: estoque, error: erroEstoque } = await supabase.from("estoques").select("id,nome").eq("unidade_id", unidadeId).eq("slug", `pre-preparos-${dept}`).maybeSingle();
  if (erroEstoque || !estoque?.id) return { error: erroMensagem(erroEstoque) || "Estoque de pré-preparos não encontrado." };

  const localLimpo = String(local || (dept === "bar" ? "Bar" : "Freezer 1")).trim();
  const nomeBase = String(ficha.nome_receita).trim();
  const nomeItem = `${nomeBase} · ${localLimpo}`;
  let { data: insumo } = await supabase.from("insumos").select("id,nome,unidade_medida,custo_unitario").eq("unidade_id", unidadeId).eq("departamento", dept).in("nome", [nomeItem, `${nomeBase} - ${localLimpo}`]).limit(1).maybeSingle();

  const unidadeFicha = String(ficha.rendimento_unidade || "un").toLowerCase();
  const unidade = ["kg", "g", "l", "ml", "un"].includes(unidadeFicha) ? unidadeFicha : "un";
  if (!insumo) {
    const criado = await supabase.from("insumos").insert([{
      unidade_id: unidadeId, nome: nomeItem, departamento: dept,
      categoria: ficha.categoria || (dept === "bar" ? "Xaropes e pré-preparos" : "Pré-preparos"),
      unidade_medida: unidade, unidade_comercial: unidade, tamanho_embalagem: 1,
      custo_unitario: Number(custoUnitario) || 0, custo_compra: Number(custoUnitario) || 0,
    }]).select("id,nome,unidade_medida,custo_unitario").single();
    if (criado.error || !criado.data) return { error: erroMensagem(criado.error) || "Não foi possível criar o item produzido." };
    insumo = criado.data;
  }

  const { data: itemExistente } = await supabase.from("estoque_itens").select("id").eq("estoque_id", estoque.id).eq("insumo_id", insumo.id).maybeSingle();
  if (!itemExistente) {
    const vinculo = await vincularItemEstoque({ unidadeId, estoqueId: estoque.id, insumoId: insumo.id, local: localLimpo, custoUnitario: Number(custoUnitario) || 0 });
    if (vinculo.error) return { error: vinculo.error };
  }

  const movimento = await registrarMovimentoMulti({
    unidadeId, estoqueId: estoque.id, insumoId: insumo.id, tipo: "entrada", quantidade: qtd,
    usuarioId, usuarioNome, observacao: `Produção de ${nomeBase} · armazenado em ${localLimpo}`,
  });
  if (movimento.error) return movimento;
  return { data: { ...movimento.data, nome: nomeBase, local: localLimpo, unidade, quantidadeProduzida: qtd, estoque: estoque.nome }, error: null };
}

export async function registrarLoteMovimentosMulti({ unidadeId, tipo, itens, usuarioId = null, usuarioNome = "", observacao = "" }) {
  const concluidos = [];
  const erros = [];

  for (const item of itens || []) {
    const resultado = await registrarMovimentoMulti({
      unidadeId,
      estoqueId: item.estoqueId,
      insumoId: item.insumoId,
      tipo,
      quantidade: Number(item.quantidade),
      usuarioId,
      usuarioNome,
      observacao,
    });

    if (resultado?.error) erros.push({ id: item.id, nome: item.nome, error: resultado.error });
    else concluidos.push({ id: item.id, nome: item.nome, resultado });
  }

  return { success: erros.length === 0, concluidos, erros };
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
  const res = await comTimeout(supabase.rpc("registrar_contagem_estoque_multi", {
    p_unidade_id: unidadeId,
    p_estoque_id: estoqueId,
    p_insumo_id: insumoId,
    p_saldo_contado: saldo,
    p_usuario_id: usuarioId,
    p_usuario_nome: usuarioNome || null,
    p_observacao: observacao || null,
  }));
  if (precisaFallbackLegado(res)) {
    return movimentoLegado({ unidadeId, insumoId, tipo: "contagem", saldoContado: saldo });
  }
  const { data, error } = res;
  if (!error) await sincronizarSaldoLegado(unidadeId, insumoId).catch(() => {});
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
    .select("*, insumo:insumos(nome, marca, unidade_medida, unidade_comercial, tamanho_embalagem, custo_unitario, custo_compra), estoque:estoques!estoque_id(nome, slug), destino:estoques!estoque_destino_id(nome)")
    .eq("unidade_id", unidadeId)
    .or(`estoque_id.eq.${estoqueId},estoque_destino_id.eq.${estoqueId}`)
    .order("data_movimento", { ascending: false })
    .limit(limite);
  return { data: data || [], error: erroMensagem(error) };
}
