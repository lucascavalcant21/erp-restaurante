// /api/intelligence/preferences — Inteligência > Configurações da UNIDADE da sessão.
//   GET  alertas, sensibilidade, metas e a distribuição SUGERIDA (nunca realizado)
//   PUT  { alertas?, sensibilidade?, metas? } — só com dashboard.intelligence.settings
// Tenant e usuário vêm da sessão + banco (atenderInteligencia), nunca do corpo.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { obterPreferencias, alterarPreferencias } from "../../../lib/intelligence/server/preferencias.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return atenderInteligencia(request, obterPreferencias);
}

export async function PUT(request) {
  return atenderInteligencia(request, alterarPreferencias);
}
