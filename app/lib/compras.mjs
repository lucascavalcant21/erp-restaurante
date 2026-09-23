// COMPRAS DO MÊS — Arquitetura Integrada do HÉFISTO ERP
import { supabase, isSupabaseReady } from "./supabase.js";

export const CATEGORIAS_COMPRA = [
  "Cozinha", "Bar", "Embalagens", "Limpeza", "Materiais gerais", "Outros",
];

const POR_SLUG = {
  "cozinha": "Cozinha",
  "pre-preparos-cozinha": "Cozinha",
  "bar": "Bar",
  "pre-preparos-bar": "Bar",
  "embalagens-cozinha": "Embalagens",
  "embalagens-bar": "Embalagens",
  "limpeza": "Limpeza",
  "materiais-variados": "Materiais gerais",
  "deposito": "Materiais gerais",
};

const semAcento = (v) => {
  const d = String(v || "").normalize("NFD");
  let out = "";
  for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
  return out.toLowerCase().trim();
};

export function categoriaDaCompra(movimento, estoques = []) {
  const estoque = estoques.find(e => e.id === movimento?.estoque_id);
  const slug = String(estoque?.slug || movimento?.estoque?.slug || "").toLowerCase();
  if (POR_SLUG[slug]) return POR_SLUG[slug];
  const nome = semAcento(estoque?.nome || movimento?.estoque?.nome);
  if (nome.includes("embalagem")) return "Embalagens";
  if (nome.includes("limpeza")) return "Limpeza";
  if (nome.includes("bar") || nome.includes("bebida")) return "Bar";
  if (nome.includes("cozinha") || nome.includes("aliment")) return "Cozinha";
  if (nome.includes("material") || nome.includes("deposito")) return "Materiais gerais";
  return "Outros";
}

export function valorDaCompra(movimento) {
  const gravado = Number(movimento?.valor_total);
  if (Number.isFinite(gravado) && gravado > 0) return gravado;
  const qtd = Number(movimento?.quantidade) || 0;
  const unitario = Number(movimento?.valor_unitario);
  if (Number.isFinite(unitario) && unitario > 0) return qtd * unitario;
  const custo = Number(movimento?.insumo?.custo_compra ?? movimento?.insumo?.custo_unitario) || 0;
  return qtd * custo;
}

export const ehCompra = (m) => m?.tipo === "entrada";

const p2 = (n) => String(n).padStart(2, "0");
export const isoData = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export function faixaCompras(referencia, modo, mesesJuntos = 3) {
  const base = new Date(referencia);
  base.setHours(0, 0, 0, 0);
  if (modo === "dia") return { de: new Date(base), ate: new Date(base) };
  if (modo === "semana") {
    const de = new Date(base);
    de.setDate(base.getDate() - base.getDay());
    const ate = new Date(de);
    ate.setDate(de.getDate() + 6);
    return { de, ate };
  }
  if (modo === "meses") {
    const quantos = Math.max(1, Number(mesesJuntos) || 1);
    return {
      de: new Date(base.getFullYear(), base.getMonth() - (quantos - 1), 1),
      ate: new Date(base.getFullYear(), base.getMonth() + 1, 0),
    };
  }
  return {
    de: new Date(base.getFullYear(), base.getMonth(), 1),
    ate: new Date(base.getFullYear(), base.getMonth() + 1, 0),
  };
}

export function andarPeriodo(referencia, modo, passo, mesesJuntos = 3) {
  const d = new Date(referencia);
  if (modo === "dia") d.setDate(d.getDate() + passo);
  else if (modo === "semana") d.setDate(d.getDate() + passo * 7);
  else if (modo === "meses") d.setMonth(d.getMonth() + passo * Math.max(1, Number(mesesJuntos) || 1));
  else d.setMonth(d.getMonth() + passo);
  return d;
}

export function rotuloPeriodo({ de, ate }, modo) {
  const curta = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (modo === "dia") return de.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  if (modo === "semana") return `${curta(de)} a ${curta(ate)}`;
  if (modo === "meses") {
    const mes = (d) => d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    return `${mes(de)} até ${mes(ate)}`;
  }
  return de.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function totaisPorCategoria(compras, estoques = []) {
  const mapa = new Map(CATEGORIAS_COMPRA.map(c => [c, { total: 0, itens: 0 }]));
  compras.forEach(m => {
    const cat = categoriaDaCompra(m, estoques);
    const alvo = mapa.get(cat) || { total: 0, itens: 0 };
    alvo.total += valorDaCompra(m);
    alvo.itens += 1;
    mapa.set(cat, alvo);
  });
  return [...mapa.entries()]
    .filter(([, v]) => v.itens > 0)
    .sort((a, b) => b[1].total - a[1].total);
}

// ─── API SUPABASE: PEDIDOS, RECEBIMENTOS & DEVOLUÇÕES ────────────────────────

export async function fetchPedidosCompra(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("pedidos_compra")
    .select("*, fornecedor:fornecedores(id, nome, telefone), itens:pedidos_compra_itens(*, insumo:insumos(id, nome, unidade_medida))")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false });

  if (error && error.code === "42P01") return { data: [], error: "sem_migracao" };
  return { data: data || [], error: error?.message || null };
}

export async function criarPedidoCompra({ unidadeId, fornecedorId, itens = [], observacoes = "" }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId || !itens.length) return { error: "Informe a unidade e pelo menos um item." };

  const numPedido = `PED-${Date.now().toString().slice(-6)}`;
  let valTotalEst = 0;

  const itensFormatados = itens.map(item => {
    const qtdEmb = Number(item.quantidade_sugerida_embalagem || item.quantidade_pedida_embalagem || 1);
    const tamEmb = Number(item.tamanho_embalagem || 1);
    const precoEst = Number(item.preco_unitario_estimado || 0);
    const totalEst = qtdEmb * precoEst;
    valTotalEst += totalEst;

    return {
      insumo_id: item.insumo_id,
      quantidade_pedida_embalagem: qtdEmb,
      quantidade_pedida_base: qtdEmb * tamEmb,
      unidade_embalagem: item.unidade_medida || "un",
      preco_unitario_estimado: precoEst,
      valor_total_estimado: totalEst,
      status_item: "PENDENTE"
    };
  });

  const { data: ped, error: errPed } = await supabase
    .from("pedidos_compra")
    .insert([{
      unidade_id: unidadeId,
      fornecedor_id: fornecedorId || null,
      numero_pedido: numPedido,
      status: "RASCUNHO",
      valor_total_estimado: valTotalEst,
      observacoes: observacoes
    }])
    .select()
    .single();

  if (errPed) return { error: errPed.message };

  const itensComPedId = itensFormatados.map(i => ({ ...i, pedido_id: ped.id }));
  const { error: errItens } = await supabase.from("pedidos_compra_itens").insert(itensComPedId);
  if (errItens) return { error: errItens.message };

  return { success: true, data: ped };
}

export async function atualizarStatusPedidoCompra(pedidoId, status) {
  if (!isSupabaseReady() || !pedidoId) return { error: "Inválido" };
  const { error } = await supabase
    .from("pedidos_compra")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", pedidoId);
  return { error: error?.message || null };
}

export async function fetchRecebimentosCompra(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("recebimentos_compra")
    .select("*, fornecedor:fornecedores(id, nome), itens:recebimentos_compra_itens(*, insumo:insumos(id, nome, unidade_medida))")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false });

  if (error && error.code === "42P01") return { data: [], error: "sem_migracao" };
  return { data: data || [], error: error?.message || null };
}

export async function executarConfirmacaoRecebimentoIntegrado({
  unidadeId, pedidoId = null, fornecedorId = null, numeroNF = "", comprovanteUrl = null, itens = [], chaveIdempotencia = null
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId || !itens.length) return { error: "Selecione pelo menos um item para receber." };

  const chave = chaveIdempotencia || `REC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const { data, error } = await supabase.rpc("confirmar_recebimento_integrado", {
    p_unidade_id: unidadeId,
    p_pedido_id: pedidoId || null,
    p_fornecedor_id: fornecedorId || null,
    p_numero_nf: numeroNF || null,
    p_comprovante_url: comprovanteUrl || null,
    p_itens: itens,
    p_chave_idempotencia: chave
  });

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function registrarDevolucaoFornecedor({ unidadeId, recebimentoId = null, fornecedorId = null, motivo, itens = [] }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId || !motivo || !itens.length) return { error: "Preencha a unidade, motivo e selecione ao menos 1 item." };

  let totalDevolucao = 0;
  const itensDev = itens.map(i => {
    const valTotal = (Number(i.quantidade_devolvida_base) || 1) * (Number(i.valor_unitario) || 0);
    totalDevolucao += valTotal;
    return {
      insumo_id: i.insumo_id,
      quantidade_devolvida_base: Number(i.quantidade_devolvida_base) || 1,
      valor_unitario: Number(i.valor_unitario) || 0,
      motivo_item: i.motivo_item || motivo
    };
  });

  const { data: dev, error: errDev } = await supabase.from("devolucoes_fornecedor").insert([{
    unidade_id: unidadeId,
    recebimento_id: recebimentoId || null,
    fornecedor_id: fornecedorId || null,
    motivo: motivo,
    valor_total_devolucao: totalDevolucao,
    status: "CONCLUIDO"
  }]).select().single();

  if (errDev) return { error: errDev.message };

  const itensComDevId = itensDev.map(i => ({ ...i, devolucao_id: dev.id }));
  await supabase.from("devolucoes_fornecedor_itens").insert(itensComDevId);

  // Dar baixa no estoque para ajustar devolução
  for (const item of itensDev) {
    const { data: est } = await supabase.from("estoque_atual").select("quantidade_atual").eq("unidade_id", unidadeId).eq("insumo_id", item.insumo_id).maybeSingle();
    const saldoAtual = Number(est?.quantidade_atual) || 0;
    const novoSaldo = Math.max(0, saldoAtual - item.quantidade_devolvida_base);

    await supabase.from("estoque_atual").upsert({
      unidade_id: unidadeId,
      insumo_id: item.insumo_id,
      quantidade_atual: novoSaldo,
      updated_at: new Date().toISOString()
    }, { onConflict: "unidade_id,insumo_id" });

    await supabase.from("estoque_movimentos").insert([{
      unidade_id: unidadeId,
      insumo_id: item.insumo_id,
      departamento: "cozinha",
      tipo: "saida",
      quantidade_unidades: item.quantidade_devolvida_base,
      conteudo_por_unidade: 1,
      quantidade_base: item.quantidade_devolvida_base,
      saldo_anterior: saldoAtual,
      saldo_posterior: novoSaldo,
      responsavel: "Devolução ao Fornecedor",
      motivo: `Devolução: ${motivo}`,
      data_movimento: new Date().toISOString()
    }]);
  }

  return { success: true, data: dev };
}
