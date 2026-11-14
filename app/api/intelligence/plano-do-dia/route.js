// POST /api/intelligence/plano-do-dia — o Jhon conversa com o Nico (duas IAs)
// e devolve o plano do dia combinado, para o dono aprovar. Só o dono.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { handlerPlanoDoDia } from "../../../lib/intelligence/server/plano-do-dia.mjs";

export const dynamic = "force-dynamic";
// até 3 rodadas, duas chamadas de IA por rodada
export const maxDuration = 120;

export async function POST(request) {
  return atenderInteligencia(request, handlerPlanoDoDia(), { limitePorMinuto: 4 });
}
