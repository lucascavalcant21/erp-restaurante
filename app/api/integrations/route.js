import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../lib/server/supabase-server.mjs';
import { integrationRegistry } from '../../lib/integrations/core/registry.mjs';
import { sanitizeLastError } from '../../lib/integrations/sanitizer.mjs';

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
        return NextResponse.json({ ok: false, error: 'Acesso negado: Usuário não possui permissão para visualizar integrações desta unidade' }, { status: 403 });
      }
    }

    // Consulta segura via Backend (service_role)
    const { data: connections, error } = await supabaseServer
      .from('integration_connections')
      .select('id, unidade_id, provider, auth_flow, external_account_id, external_merchant_id, status, last_sync_at, last_error, created_at, updated_at')
      .eq('unidade_id', unidadeId);

    if (error) {
      return NextResponse.json({ ok: false, error: `Erro ao buscar conexões de integrações: ${error.message}` }, { status: 500 });
    }

    // Mapeia provedores registrados combinando com conexões do banco
    const registeredProviders = integrationRegistry.listProviders();
    const connectionsMap = new Map((connections || []).map((conn) => [conn.provider.toUpperCase(), conn]));

    const result = registeredProviders.map((prov) => {
      const adapter = integrationRegistry.getAdapter(prov.id);
      const conn = connectionsMap.get(prov.id.toUpperCase());

      return {
        id: conn?.id || null,
        unidade_id: unidadeId,
        provider: prov.id,
        provider_name: prov.name,
        auth_flow: conn?.auth_flow || 'DISTRIBUTED',
        external_account_id: conn?.external_account_id || null,
        external_merchant_id: conn?.external_merchant_id || null,
        status: conn?.status || 'NOT_CONFIGURED',
        last_sync_at: conn?.last_sync_at || null,
        last_error_sanitized: sanitizeLastError(conn?.last_error),
        capabilities: adapter ? adapter.getCapabilities() : {},
      };
    });

    return NextResponse.json({ ok: true, integrations: result });

  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: `Falha interna no endpoint de integrações: ${error.message}`,
    }, { status: 500 });
  }
}
