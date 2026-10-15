import { NextResponse } from 'next/server';
import { exportarDadosTenant } from '../../../lib/saas-export.js';
import { sessaoOuNegar } from '../../../lib/server/sessao-rota.mjs';

export async function GET(request) {
  // SEC-API-1: exportar uma empresa inteira é coisa do dono da plataforma.
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;
  if (sessao.usuario?.super_admin !== true) {
    return NextResponse.json({ sucesso: false, erro: 'Só o administrador da plataforma exporta dados de uma empresa.' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresa_id');

    if (!empresaId) {
      return NextResponse.json(
        { sucesso: false, erro: 'Parâmetro empresa_id é obrigatório.' },
        { status: 400 }
      );
    }

    const payload = await exportarDadosTenant(empresaId);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="hefisto_export_${empresaId}_${Date.now()}.json"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { sucesso: false, erro: error.message || 'Erro ao exportar dados do tenant.' },
      { status: 500 }
    );
  }
}
