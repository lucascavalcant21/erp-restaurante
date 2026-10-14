import { NextResponse } from 'next/server';
import { integrationRegistry } from '../../../../lib/integrations/core/registry.mjs';
import { autorizarLeituraDaUnidade } from '../../../../lib/server/autorizacao-unidade.mjs';

export async function POST(request, context) {
  try {
    const params = await context.params;
    const provider = params?.provider;

    if (!provider) {
      return NextResponse.json({ ok: false, error: 'Provedor não informado na rota' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const unidadeId = body.unidadeId || body.unidade_id;

    // SEC-API-1: sessão obrigatória e vínculo com a unidade. Antes, sem token,
    // getUser() voltava vazio e a checagem era PULADA (falha aberta).
    const acesso = await autorizarLeituraDaUnidade(request, unidadeId);
    if (acesso.erro) return NextResponse.json({ ok: false, error: acesso.erro.mensagem, codigo: acesso.erro.codigo }, { status: acesso.erro.status });

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
