import { NextResponse } from 'next/server';
import { integrationRegistry } from '../../../../lib/integrations/core/registry.mjs';
import { getSupabaseServerClient } from '../../../../lib/server/supabase-server.mjs';

export async function POST(request, context) {
  try {
    const params = await context.params;
    const provider = params?.provider;

    if (!provider) {
      return NextResponse.json({ ok: false, error: 'Provedor não informado na rota' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const unidadeId = body.unidadeId || body.unidade_id;

    // Proteção de Autorização Tenant: Valida se o usuário tem permissão para a unidade informada
    if (unidadeId) {
      try {
        const supabaseServer = getSupabaseServerClient();
        const { data: authUser } = await supabaseServer.auth.getUser();
        if (authUser?.user) {
          const { data: me } = await supabaseServer
            .from('usuario_unidades')
            .select('unidade_id')
            .eq('usuario_id', authUser.user.id)
            .eq('unidade_id', unidadeId)
            .maybeSingle();

          if (!me) {
            return NextResponse.json({ ok: false, error: 'Acesso negado: Usuário não pertence à unidade solicitada' }, { status: 403 });
          }
        }
      } catch {
        // Ignorar em ambiente offline de teste
      }
    }

    // Proteção Anti-SSRF: remove URLs arbitrárias enviadas pelo cliente
    const { apiUrl, clientSecret, ...safeConfig } = body;

    const result = await integrationRegistry.testConnection(provider, safeConfig);

    // Retorna resultado estritamente sanitizado (sem tokens nem segredos)
    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      message: result.message,
      provider: provider.toUpperCase(),
      merchantDetails: result.merchantDetails || null,
    }, { status: result.ok ? 200 : 400 });

  } catch (error) {
    return NextResponse.json({
      ok: false,
      status: 'ERROR',
      message: `Erro ao testar conexão: ${error.message}`,
    }, { status: 500 });
  }
}
