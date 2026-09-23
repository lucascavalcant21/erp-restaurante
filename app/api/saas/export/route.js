import { NextResponse } from 'next/server';
import { exportarDadosTenant } from '../../../lib/saas-export.js';

export async function GET(request) {
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
