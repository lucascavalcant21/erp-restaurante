import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/server/supabase-server.mjs';
import { sanitizeLastError } from '../../../lib/integrations/sanitizer.mjs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const unidadeId = searchParams.get('unidade_id') || searchParams.get('unidadeId');

    if (!unidadeId) {
      return NextResponse.json({ ok: false, error: 'Parâmetro unidade_id é obrigatório' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServerClient();
    const { data: authUser } = await supabaseServer.auth.getUser();

    // Em produção/autenticado, exige membership do usuário na unidade
    if (authUser?.user) {
      const { data: membership } = await supabaseServer
        .from('usuario_unidades')
        .select('unidade_id')
        .eq('usuario_id', authUser.user.id)
        .eq('unidade_id', unidadeId)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json({ ok: false, error: 'Acesso negado: Usuário não possui permissão para visualizar eventos desta unidade' }, { status: 403 });
      }
    }

    // Consulta segura via Backend (service_role)
    const { data: events, error } = await supabaseServer
      .from('integration_events')
      .select('id, unidade_id, provider, provider_event_id, event_type, status, attempts, last_error, received_at, processed_at')
      .eq('unidade_id', unidadeId)
      .order('received_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ ok: false, error: `Erro ao buscar eventos: ${error.message}` }, { status: 500 });
    }

    // Retorna superfície estritamente sanitizada (SEM payload raw e SEM dados sensíveis)
    const sanitizedEvents = (events || []).map((ev) => ({
      id: ev.id,
      unidade_id: ev.unidade_id,
      provider: ev.provider,
      provider_event_id: ev.provider_event_id,
      event_type: ev.event_type,
      status: ev.status,
      attempts: ev.attempts,
      received_at: ev.received_at,
      processed_at: ev.processed_at,
      last_error_sanitized: sanitizeLastError(ev.last_error),
    }));

    return NextResponse.json({ ok: true, events: sanitizedEvents });

  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: `Falha interna no endpoint de eventos: ${error.message}`,
    }, { status: 500 });
  }
}
