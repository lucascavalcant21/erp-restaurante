import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/server/supabase-server.mjs';
import { verificarHmac } from '../../../lib/server/integracoes.mjs';

/**
 * Webhook oficial de recebimento de eventos do iFood.
 * Valida HMAC SHA-256 no payload bruto ANTES da desserialização JSON.
 * Ingestão Idempotente: Salva no Inbox (`integration_events`) com status `RECEBIDO`.
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const secret = process.env.IFOOD_WEBHOOK_SECRET;

    // 1. Validação Obrigatória de HMAC SHA-256 ANTES do JSON.parse
    if (!secret) {
      return NextResponse.json({ error: "Segredo de Webhook iFood não configurado no servidor" }, { status: 401 });
    }

    const signature = request.headers.get("x-ifood-signature");
    if (!signature) {
      return NextResponse.json({ error: "Cabeçalho x-ifood-signature ausente" }, { status: 401 });
    }

    const isValidHmac = verificarHmac({
      segredo: secret,
      corpoBruto: rawBody,
      assinatura: signature,
    });

    if (!isValidHmac) {
      return NextResponse.json({ error: "Assinatura de Webhook iFood inválida" }, { status: 401 });
    }

    // 2. Parsing de JSON após validação criptográfica do payload
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
    }

    const eventos = Array.isArray(body) ? body : [body];
    if (!eventos.length) {
      return NextResponse.json({ received: true, count: 0 }, { status: 202 });
    }

    const supabaseServer = getSupabaseServerClient();
    let inseridos = 0;
    let duplicados = 0;
    let quarentenados = 0;

    for (const ev of eventos) {
      const rawEventId = ev.id || ev.eventId;
      
      // Validação estrita de ID (Sem fallbacks `Date.now()`)
      if (!rawEventId) {
        quarentenados++;
        await supabaseServer.from('integration_events').insert([{
          provider: 'IFOOD',
          provider_event_id: `QUARANTINE_WEBHOOK_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          event_type: String(ev.code || ev.fullCode || 'INVALID'),
          payload: ev,
          status: 'QUARANTINED_INVALID_EVENT',
          received_at: new Date().toISOString(),
        }]);
        continue;
      }

      const eventId = String(rawEventId);
      const eventType = String(ev.code || ev.fullCode || 'UNKNOWN');

      const payloadEvent = {
        provider: 'IFOOD',
        provider_event_id: eventId,
        event_type: eventType,
        payload: ev,
        status: 'RECEBIDO',
        received_at: new Date().toISOString(),
      };

      const { error: errInsert } = await supabaseServer
        .from('integration_events')
        .insert([payloadEvent]);

      if (errInsert) {
        if (errInsert.code === '23505') { // Unique constraint
          duplicados++;
        } else {
          console.error(`[iFood Webhook] Erro ao gravar evento ${eventId}:`, errInsert.message);
        }
      } else {
        inseridos++;
      }
    }

    return NextResponse.json({
      received: true,
      count: eventos.length,
      inseridos,
      duplicados,
      quarentenados,
    }, { status: 202 });

  } catch (error) {
    console.error("[iFood Webhook] Erro de processamento:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ONLINE",
    provider: "IFOOD",
    message: "Endpoint iFood Webhook Inbox ativo com validação HMAC SHA-256 pré-parse.",
  });
}
