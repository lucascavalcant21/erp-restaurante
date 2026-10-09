// HEFISTO ORCHESTRATOR — um orquestrador central, não várias IAs soltas.
// Recebe a intenção já validada, escolhe o especialista que a atende e devolve
// a resposta com os agentes consultados e o nível alcançado. Um pedido pode
// envolver vários domínios (ex.: resumo do dia = vendas + financeiro +
// estoque); o catálogo declara quais.

import { AGENTES } from "./especialistas.mjs";
import { NIVEL } from "../core/niveis.mjs";

const NOMES = Object.fromEntries(AGENTES.map((a) => [a.id, a.nome]));

export function agenteDaIntencao(id) {
  return AGENTES.find((a) => typeof a[id] === "function") || null;
}

/**
 * @param {object} p { intencao (catálogo), params, ic, motor, store, nomeUsuario, trilha }
 */
export async function responderPergunta({ intencao, params, ic, motor, store, nomeUsuario, trilha }) {
  const agente = agenteDaIntencao(intencao.id);
  if (!agente) {
    return { texto: "Ainda não sei responder isso pela conversa.", blocos: [], acoes: [], nivel: NIVEL.OBSERVAR, agentes: [] };
  }
  trilha?.passar("dados", NIVEL.OBSERVAR);
  trilha?.passar("normalizacao");
  trilha?.passar("metricas", NIVEL.ANALISAR);
  const out = await agente[intencao.id]({ motor, params, ic, store, nomeUsuario });
  if (out.nivel >= NIVEL.DETECTAR) trilha?.passar("deteccao", NIVEL.DETECTAR);
  if (out.nivel >= NIVEL.ANALISAR) trilha?.passar("analise");
  trilha?.passar("explicacao");
  if (out.nivel >= NIVEL.RECOMENDAR) trilha?.passar("recomendacao", NIVEL.RECOMENDAR);
  return { ...out, agentes: (intencao.agentes || [agente.id]).map((id) => NOMES[id] || id) };
}
