// GET /api/intelligence/brief — resumo do dia da Central de Inteligência
// (generateDailyBrief): só dados reais da unidade validada no servidor.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { generateDailyBrief } from "../../../lib/intelligence/insights/daily-brief.mjs";
import { auditar, ETAPA_AUDITORIA } from "../../../lib/intelligence/audit/auditoria.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  return atenderInteligencia(request, async ({ ic, motor, store, correlationId, nomeUsuario }) => {
    const inicio = Date.now();
    const brief = await generateDailyBrief({ motor, store, nomeUsuario });
    await auditar(store, ic.escopo, {
      correlationId, etapa: ETAPA_AUDITORIA.BRIEF, consultas: motor.ambiente.dbe.consultas, latenciaMs: Date.now() - inicio,
      resultado: { criticos: brief.critical.length, importantes: brief.warnings.length, oportunidades: brief.opportunities.length },
    });
    return { corpo: { brief, correlationId } };
  }, { limitePorMinuto: 12 });
}
