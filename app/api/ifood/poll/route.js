import { NextResponse } from "next/server";
import { supabase, isSupabaseReady } from "../../../lib/supabase";
import {
  ifoodConfigurado, pollEventos, acknowledgeEventos, getPedido, isPedidoColocado,
} from "../../../lib/ifood";

export const dynamic = "force-dynamic";

// Normaliza texto pra casar nome de produto (fallback de mapeamento)
const norm = (s) => String(s || "").trim().toLowerCase();

// Acha o produto do ERP equivalente ao item do iFood.
// Prioridade: codigo_barras == externalCode do iFood; senão, nome igual.
async function acharProduto(unidadeId, item, cacheProdutos) {
  const ext = item.externalCode || item.uniqueId;
  if (ext) {
    const porCodigo = cacheProdutos.find((p) => p.codigo_barras && p.codigo_barras === String(ext));
    if (porCodigo) return porCodigo;
  }
  return cacheProdutos.find((p) => norm(p.nome_produto) === norm(item.name)) || null;
}

async function processarPedido(order, naoMapeados) {
  // 1. Descobrir a unidade pelo merchant do iFood
  const merchantId = order.merchant?.id || order.merchantId;
  const { data: unidade } = await supabase
    .from("unidades").select("id").eq("ifood_merchant_id", merchantId).maybeSingle();
  if (!unidade) {
    naoMapeados.push(`Merchant ${merchantId} não vinculado a nenhuma loja (configure em Canais → iFood).`);
    return;
  }
  const unidadeId = unidade.id;

  // 2. Cria o cabeçalho do pedido (schema real da tabela `pedidos`)
  const { data: pedido, error: errPed } = await supabase.from("pedidos").insert([{
    unidade_id: unidadeId,
    status: "novo_online",
    tipo_pedido: "ifood",
    cliente_nome: order.customer?.name || "Cliente iFood",
    cliente_telefone: order.customer?.phone?.number || null,
    endereco_entrega: order.delivery?.deliveryAddress?.formattedAddress || null,
    valor_total: order.total?.orderAmount ?? order.totalPrice ?? 0,
    forma_pagamento: "ifood",
    identificacao: order.displayId || null, // número curto que a cozinha vê
  }]).select().single();
  if (errPed) throw new Error(`Insert pedido iFood: ${errPed.message}`);

  // 3. Mapeia os itens -> produtos do ERP e insere (inner join do KDS exige produto_id)
  const { data: cacheProdutos } = await supabase
    .from("produtos").select("id, nome_produto, codigo_barras").eq("unidade_id", unidadeId);

  const itensDB = [];
  for (const item of (order.items || [])) {
    const prod = await acharProduto(unidadeId, item, cacheProdutos || []);
    const obsIfood = [item.observations, item.name].filter(Boolean).join(" — ");
    if (!prod) {
      naoMapeados.push(`Item "${item.name}" (loja ${unidadeId}) sem produto correspondente.`);
      continue; // sem produto, não aparece no KDS — precisa mapear o cardápio
    }
    itensDB.push({
      pedido_id: pedido.id,
      produto_id: prod.id,
      quantidade: item.quantity || 1,
      valor_unitario: item.unitPrice ?? item.price ?? 0,
      observacao: obsIfood,
      status_kds: "pendente",
    });
  }
  if (itensDB.length) {
    const { error: errItens } = await supabase.from("pedidos_itens").insert(itensDB);
    if (errItens) throw new Error(`Insert itens iFood: ${errItens.message}`);
  }
}

export async function GET(request) {
  // Proteção: só o Vercel Cron (ou chamadas com o segredo) podem acionar
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!ifoodConfigurado()) {
    return NextResponse.json({ skip: "IFOOD_CLIENT_ID/SECRET não configurados" }, { status: 200 });
  }
  if (!isSupabaseReady()) {
    return NextResponse.json({ error: "banco offline" }, { status: 500 });
  }

  try {
    const eventos = await pollEventos();
    const naoMapeados = [];
    let processados = 0;

    for (const ev of eventos) {
      if (isPedidoColocado(ev)) {
        const orderId = ev.orderId || ev.correlationId;
        try {
          const order = await getPedido(orderId);
          await processarPedido(order, naoMapeados);
          processados++;
        } catch (e) {
          naoMapeados.push(`Pedido ${orderId}: ${e.message}`);
        }
      }
    }

    // ACK de TODOS os eventos (mesmo os não-PLC) pra não receber de novo
    await acknowledgeEventos(eventos);

    return NextResponse.json({
      ok: true, eventos: eventos.length, pedidos_criados: processados, avisos: naoMapeados,
    });
  } catch (e) {
    console.error("[iFood poll]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
