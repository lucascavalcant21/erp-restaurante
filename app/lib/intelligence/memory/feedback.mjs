// APRENDIZADO POR DADOS PERSISTIDOS — o modelo não muda o próprio código nem
// as regras. O que "aprende" é o que fica gravado por unidade:
//   - respostas às perguntas dos insights ("era evento", "erro de contagem")
//     → reordenam as hipóteses do mesmo tipo de anomalia naquela unidade;
//   - insights dispensados → somem por 7 dias; respondidos → não voltam
//     (a impressão digital inclui o caso específico; um caso novo é outro);
//   - limiares personalizados da unidade (preferências).
// O comentário digitado é texto NÃO CONFIÁVEL: guardado limitado, nunca
// reinterpretado como instrução.

import { s } from "../schemas/schema.mjs";
import { OPCOES } from "../insights/catalogo.mjs";

export const DIAS_DISPENSADO = 7;

export const feedbackSchema = s.object({
  insightId: s.string({ min: 3, max: 80, padrao: /^[a-z_]+:[0-9a-f]{8}$/ }),
  insightTipo: s.string({ min: 3, max: 40, padrao: /^[a-z_]+$/ }),
  resposta: s.enum(["opcao", "dispensar", "util", "nao_util"]),
  opcao: s.opcional(s.enum(Object.keys(OPCOES))),
  comentario: s.opcional(s.string({ max: 300 })),
});

/** { tipo: { opcao: vezes } } — só respostas com opção conhecida (≠ "não sei"). */
export function aprendizadoDe(registros = []) {
  const out = {};
  for (const r of registros) {
    if (r.resposta !== "opcao" || !r.opcao_id || r.opcao_id === "nao_sei") continue;
    out[r.insight_tipo] ||= {};
    out[r.insight_tipo][r.opcao_id] = (out[r.insight_tipo][r.opcao_id] || 0) + 1;
  }
  return out;
}

/** Ids de insight que não devem aparecer agora. */
export function suprimidos(registros = [], agora = new Date()) {
  const limite = agora.getTime() - DIAS_DISPENSADO * 86400000;
  const out = new Set();
  for (const r of registros) {
    if (r.resposta === "opcao") out.add(r.insight_id);
    else if (r.resposta === "dispensar" && Date.parse(r.created_at) >= limite) out.add(r.insight_id);
  }
  return out;
}

/**
 * Evidência da pergunta no momento da resposta, tirada do insight RECALCULADO
 * no servidor (nunca do que o cliente mandou): qual pergunta, sobre qual
 * entidade e o que a tela mostrava. Fica para análises posteriores.
 */
export function estruturaDoInsight(insight) {
  if (!insight) return null;
  const contexto = {
    titulo: String(insight.titulo || "").slice(0, 160),
    evidencias: (insight.evidencias || []).slice(0, 6).map((e) => ({ rotulo: String(e.rotulo).slice(0, 60), valor: String(e.valor).slice(0, 80) })),
    periodo: insight.periodo ? { de: insight.periodo.de, ate: insight.periodo.ate } : null,
    impacto: insight.impacto?.valor != null ? { valor: insight.impacto.valor, natureza: insight.impacto.natureza || null } : null,
  };
  return {
    pergunta_id: insight.id,
    entidade_tipo: insight.entidade?.tipo ? String(insight.entidade.tipo).slice(0, 30) : null,
    entidade_id: insight.entidade?.id != null ? String(insight.entidade.id).slice(0, 64) : null,
    contexto: JSON.stringify(contexto).length <= 3500 ? contexto : { titulo: contexto.titulo },
  };
}

/** Linha a gravar, com tenant vindo do ESCOPO (servidor), nunca do pedido. */
export function linhaDeFeedback(escopo, f, agora = new Date(), estrutura = null) {
  return {
    ...(estrutura || {}),
    unidade_id: escopo.unidadeId,
    empresa_id: escopo.empresaId,
    auth_user_id: escopo.userId,
    insight_id: f.insightId,
    insight_tipo: f.insightTipo,
    resposta: f.resposta,
    opcao_id: f.resposta === "opcao" ? f.opcao : null,
    comentario: f.comentario || null,
    created_at: agora.toISOString(),
  };
}
