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
    const secretParam = searchParams.get("secret");

    // Sem CRON_SECRET não existe segredo esperado: nada casa e a rota recusa.
    // O valor de reserva que estava aqui ("hefisto_cron_secret_dev") era
    // público no repositório — quem o conhecesse disparava o scheduler.
    const expectedSecret = String(process.env.CRON_SECRET || "").trim();
    const isValidSecret = !!expectedSecret
      && (authHeader === `Bearer ${expectedSecret}` || secretParam === expectedSecret);

    // Em desenvolvimento local, permite execução para testes
    const isDev = process.env.NODE_ENV !== "production";

    if (!isValidSecret && !isDev) {
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
