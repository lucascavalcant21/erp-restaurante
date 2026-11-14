// PLANO DO DIA (dono, 14/11/2026): o dono manda para o Jhon, o Jhon conversa
// com o Nico (duas IAs) e devolve o plano combinado para o dono aprovar.
// Roda DENTRO de atenderInteligencia: sessão, unidade, permissão e auditoria
// já resolvidas. Os FATOS saem do banco escopado da unidade; nada é gravado.
import { conversarJhonNico } from "../agents/conversa-jhon-nico.mjs";
import { procedimentosDaUnidade } from "../agents/procedimentos.mjs";
import { assistenteDoContexto, JHON } from "../../assistentes.mjs";
import { auditar, ETAPA_AUDITORIA } from "../audit/auditoria.mjs";

const MAX_FICHAS = 120;

/** Junta os fatos do dia. Cada fonte que falha fica vazia e entra em `faltando`. */
export async function fatosDoDia({ motor, agora = new Date(), fuso = "America/Sao_Paulo" }) {
  const faltando = [];
  const [esc, fic, proc] = await Promise.all([
    motor.getSchedule().catch(() => null),
    motor.listRecipes({}).catch(() => null),
    procedimentosDaUnidade(motor.ambiente.dbe).catch(() => ({ status: "falha", lista: [] })),
  ]);
  const equipe = (esc?.detalhes?.trabalham || []).map((p) => ({ id: p.id, nome: p.nome, funcao: p.cargo || p.area || null, entrada: p.entrada || null, saida: p.saida || null }));
  if (!equipe.length) faltando.push(esc?.motivo || "Escala de hoje: ninguém com horário no cadastro.");
  const fichas = (fic?.detalhes?.fichas || []).slice(0, MAX_FICHAS).map((f) => ({ id: f.id, nome: f.nome }));
  if (!fichas.length) faltando.push("Fichas técnicas: nenhuma encontrada.");
  const procedimentos = (proc?.lista || []).map((p) => ({ nome: p.nome, tipo: p.tipo || null }));
  if (proc?.status === "falha") faltando.push("Procedimentos da casa: não consegui ler.");
  const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(agora);
  return { fatos: { agora: quando, equipe, fichas, procedimentos }, faltando };
}

export function handlerPlanoDoDia() {
  return async ({ ic, motor, store, corpo, correlationId, provedor }) => {
    if (assistenteDoContexto(ic) !== JHON) {
      return { corpo: { erro: "Só o dono combina o plano do dia com o Jhon.", codigo: "SO_DONO" }, status: 403 };
    }
    const pedido = String(corpo?.pedido || "").replace(/\s+/g, " ").trim().slice(0, 2000);
    if (pedido.length < 3) return { corpo: { erro: "Diga ao Jhon o que precisa ser feito hoje.", codigo: "PEDIDO_VAZIO" }, status: 400 };

    const inicio = Date.now();
    const { fatos, faltando } = await fatosDoDia({ motor, fuso: ic.fuso || "America/Sao_Paulo" });
    const r = await conversarJhonNico({ pedido, fatos, provedor });
    await auditar(store, ic.escopo, {
      correlationId, etapa: ETAPA_AUDITORIA.RECOMENDACAO, consultas: motor.ambiente.dbe.consultas, latenciaMs: Date.now() - inicio,
      resultado: { tipo: "plano_do_dia", status: r.status, rodadas: r.rodadas || 0, tarefas: (r.plano || []).length, pendencias: (r.pendencias || []).length },
    });
    return { corpo: { resultado: { ...r, faltando, pedido }, correlationId } };
  };
}
