import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/server/supabase-server.mjs";
import { IFoodAdapter } from "../../../lib/integrations/ifood/adapter.mjs";

export const dynamic = "force-dynamic";

const ifoodAdapter = new IFoodAdapter();

export async function GET(request) {
  // 1. Proteção Vercel Cron ou Secret com Fail-Closed para Produção
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        ok: false,
        error: "CRON_SECRET não configurado no ambiente de produção.",
        code: "CONFIGURATION_ERROR",
      }, { status: 503 });
    }
  } else if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const supabaseServer = getSupabaseServerClient();

  try {
    // 2. Buscar conexões ativas ou fallback
    const { data: conexoes } = await supabaseServer
      .from('integration_connections')
      .select('unidade_id, status, config_json')
      .eq('provider', 'IFOOD');

    const conexoesAtivas = (conexoes || []).filter(c => c.status === 'CONNECTED');
    const targetConfigs = conexoesAtivas.length > 0 
      ? conexoesAtivas.map(c => ({ unidadeId: c.unidade_id }))
      : [{}]; // Contexto padrão/env

    let totalEventosGeral = 0;
    let processadosGeral = 0;
    let ignoradosSaiposGeral = 0;
    let quarentenadosGeral = 0;
    let ackEnviadosGeral = 0;

    for (const config of targetConfigs) {
      const statusConexao = await ifoodAdapter.getStatus(config);
      if (statusConexao.status !== 'CONNECTED') continue;

      // 3. Polling Oficial via GET /order/v1.0/orders:polling
      const listaEventos = await ifoodAdapter.pollEvents(config);
      if (!listaEventos || !listaEventos.length) continue;

      totalEventosGeral += listaEventos.length;
      const ackEventIds = [];

      for (const ev of listaEventos) {
        // Validação Estrita de ID do Evento (Sem fallbacks Date.now())
        const rawEventId = ev.id || ev.eventId;
        if (!rawEventId) {
          quarentenadosGeral++;
          await supabaseServer.from("integration_events").upsert([{
            unidade_id: config.unidadeId || null,
            provider: 'IFOOD',
            provider_event_id: `QUARANTINE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            event_type: String(ev.code || ev.fullCode || 'INVALID'),
            payload: ev,
            status: 'QUARANTINED_INVALID_EVENT',
            processed_at: new Date().toISOString(),
          }]);
          continue;
        }

        const eventId = String(rawEventId);
        const merchantId = ev.merchantId;

        // Buscar unidade associada
        const { data: unidade } = await supabaseServer
          .from("unidades")
          .select("id, order_source")
          .eq(config.unidadeId ? "id" : "ifood_merchant_id", config.unidadeId || merchantId)
          .maybeSingle();

        const unidadeId = unidade?.id || config.unidadeId || null;
        const orderSource = unidade?.order_source || 'SAIPOS';

        if (orderSource === 'SAIPOS') {
          // Arquitetura Canônica: Saipos como PDV operacional
          // Evento consumido com sucesso (intencionalmente ignorado para vendas operacionais), adicionado ao ACK
          await supabaseServer.from("integration_events").upsert([{
            unidade_id: unidadeId,
            provider: 'IFOOD',
            provider_event_id: eventId,
            event_type: String(ev.code || ev.fullCode || 'UNKNOWN'),
            payload: ev,
            status: 'IGNORADO_FONTE_OPERACIONAL_SAIPOS',
            processed_at: new Date().toISOString(),
          }], { onConflict: 'provider,provider_event_id' });

          ignoradosSaiposGeral++;
          ackEventIds.push(eventId);
        } else {
          // Processamento completo via iFood
          try {
            await supabaseServer.from("integration_events").upsert([{
              unidade_id: unidadeId,
              provider: 'IFOOD',
              provider_event_id: eventId,
              event_type: String(ev.code || ev.fullCode || 'UNKNOWN'),
              payload: ev,
              status: 'PROCESSADO',
              processed_at: new Date().toISOString(),
            }], { onConflict: 'provider,provider_event_id' });

            processadosGeral++;
            ackEventIds.push(eventId);
          } catch (procErr) {
            console.error(`[iFood Poll Route] Falha ao processar evento ${eventId}:`, procErr.message);
            await supabaseServer.from("integration_events").upsert([{
              unidade_id: unidadeId,
              provider: 'IFOOD',
              provider_event_id: eventId,
              event_type: String(ev.code || ev.fullCode || 'UNKNOWN'),
              payload: ev,
              status: 'ERRO_PROCESSAMENTO',
              processed_at: new Date().toISOString(),
            }], { onConflict: 'provider,provider_event_id' });
            // NÃO adiciona ao ackEventIds em caso de falha de processamento
          }
        }
      }

      // 4. Envio de ACK Parcial (Apenas eventos com sucesso / consumo intencional)
      if (ackEventIds.length > 0) {
        const ackRes = await ifoodAdapter.acknowledgeEvents(ackEventIds, config);
        ackEnviadosGeral += ackRes.acknowledged;
      }
    }

    return NextResponse.json({
      ok: true,
      totalEventos: totalEventosGeral,
      processados: processadosGeral,
      ignoradosSaipos: ignoradosSaiposGeral,
      quarentenados: quarentenadosGeral,
      ackEnviados: ackEnviadosGeral,
      mensagem: `Sincronização concluída. ACK enviado para ${ackEnviadosGeral} eventos.`,
    }, { status: 200 });

  } catch (error) {
    console.error("[iFood Poll Route] Erro ao sincronizar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
