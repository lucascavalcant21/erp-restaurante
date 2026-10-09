// GET /api/intelligence/brief — resumo do dia da Central de Inteligência
// (generateDailyBrief): só dados reais da unidade validada no servidor.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { handlerBrief } from "../../../lib/intelligence/server/handlers.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  return atenderInteligencia(request, handlerBrief(), { limitePorMinuto: 12 });
}
