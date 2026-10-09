// Os cinco níveis da inteligência e as etapas obrigatórias do pipeline.
//
//   DADOS → NORMALIZAÇÃO → MÉTRICAS → DETECÇÃO → ANÁLISE → EXPLICAÇÃO →
//   RECOMENDAÇÃO → AÇÃO → RESULTADO → APRENDIZADO
//
// Cada resposta do Intelligence Core declara até que nível chegou e quais
// etapas percorreu, para a auditoria mostrar o caminho do dado até a tela.

export const NIVEL = Object.freeze({
  OBSERVAR: 1,    // lê acontecimentos (consultas)
  ANALISAR: 2,    // cruza informações (métricas, comparações)
  DETECTAR: 3,    // identifica desvios contra o próprio histórico
  RECOMENDAR: 4,  // sugere ação, com hipóteses — nunca causalidade como certeza
  AGIR: 5,        // executa ação autorizada, com confirmação e auditoria
});

export const ROTULO_NIVEL = Object.freeze({
  1: "Observar", 2: "Analisar", 3: "Detectar", 4: "Recomendar", 5: "Agir",
});

export const ETAPAS = Object.freeze([
  "dados", "normalizacao", "metricas", "deteccao", "analise",
  "explicacao", "recomendacao", "acao", "resultado", "aprendizado",
]);

/** Registro das etapas percorridas numa requisição (ordem preservada, sem repetição). */
export function criarTrilha() {
  const etapas = [];
  let nivel = 0;
  return {
    passar(etapa, n = null) {
      if (!ETAPAS.includes(etapa)) throw new Error(`Etapa desconhecida: ${etapa}`);
      if (!etapas.includes(etapa)) etapas.push(etapa);
      if (n && n > nivel) nivel = n;
    },
    get etapas() { return [...etapas]; },
    get nivel() { return nivel; },
    resumo() { return { etapas: [...etapas], nivel, nivelRotulo: ROTULO_NIVEL[nivel] || null }; },
  };
}
