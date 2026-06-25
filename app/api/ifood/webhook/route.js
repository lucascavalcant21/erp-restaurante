import { NextResponse } from 'next/server';
import { supabase, isSupabaseReady } from '../../../lib/supabase';

// Recebe os eventos de webhook (Polling) do iFood
export async function POST(request) {
  try {
    const body = await request.json();
    
    // O iFood geralmente envia um array de eventos no webhook
    const eventos = Array.isArray(body) ? body : [body];

    if (!isSupabaseReady()) {
       return NextResponse.json({ error: "Banco offline" }, { status: 500 });
    }

    for (const evento of eventos) {
      console.log(`[iFood Webhook] Evento Recebido: ${evento.code} - Pedido: ${evento.correlationId}`);

      // Exemplo de fluxo real:
      if (evento.code === 'PLC') {
         // PLC = Pedido Colocado
         // 1. Fazer GET na API do iFood (/order/v1.0/orders/{evento.correlationId}) para pegar os detalhes
         // 2. Inserir no Supabase:
         /*
         await supabase.from("pedidos").insert([{
            unidade_id: 'ID_DA_UNIDADE', // Mapeado pelas credenciais
            status: 'novo_online',
            tipo_pedido: 'ifood',
            cliente_nome: 'Cliente iFood',
            valor_total: 50.00
         }]);
         */
      }
      
      // ACK (Acknowledge) do iFood exigirá que a gente marque o evento como recebido na API deles
    }

    // Retorna 200 pro iFood parar de reenviar
    return NextResponse.json({ received: true, count: eventos.length }, { status: 200 });

  } catch (error) {
    console.error("[iFood Webhook] Erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "iFood Webhook Endpoint está online e aguardando eventos POST." });
}
