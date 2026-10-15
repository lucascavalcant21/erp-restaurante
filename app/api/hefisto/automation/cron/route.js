import { NextResponse } from "next/server";
import { triggerScheduledAutomations } from "../../../../lib/hefisto-automations.js";

/**
 * Endpoint Seguro de Cron / Scheduler Héfisto (F9)
 * Chamado pelo Vercel Cron ou Trigger de Servidor
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { searchParams } = new URL(request.url);

    // SEC-API-1: sem CRON_SECRET configurado, ninguém entra (antes valia um
    // segredo padrão fixo, escrito no código). Só pelo cabeçalho: segredo na
    // URL fica gravado em log.
    const expectedSecret = (process.env.CRON_SECRET || "").trim();
    const isValidSecret = Boolean(expectedSecret) && authHeader === `Bearer ${expectedSecret}`;

    if (!isValidSecret) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado ao scheduler de automações." },
        { status: 401 }
      );
    }

    const tenantId = request.headers.get("x-tenant-id") || searchParams.get("tenantId") || "unidade-padrao";

    const results = await triggerScheduledAutomations({ tenantId });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tenantId,
      executedCount: results.length,
      results
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
