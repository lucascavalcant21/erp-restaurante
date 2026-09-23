// Códigos de recusa que as rotas devolvem no campo `codigo`. Um lugar só, para
// o cliente, os testes e o futuro Tool Registry falarem a mesma língua.

export const CODIGOS = Object.freeze({
  SEM_SESSAO: "SEM_SESSAO",
  SESSAO_INVALIDA: "SESSAO_INVALIDA",
  SEM_PERMISSAO: "SEM_PERMISSAO",
  SEM_PERFIL: "SEM_PERFIL",
  UNIDADE_INVALIDA: "UNIDADE_INVALIDA",
  UNIDADE_FORA_DO_ESCOPO: "UNIDADE_FORA_DO_ESCOPO",
  PERMISSAO_DESCONHECIDA: "PERMISSAO_DESCONHECIDA",
  CANAL_INVALIDO: "CANAL_INVALIDO",
  CONTEXTO_INVALIDO: "CONTEXTO_INVALIDO",
  CONCESSAO_NEGADA: "CONCESSAO_NEGADA",
  INTEGRACAO_DESCONHECIDA: "INTEGRACAO_DESCONHECIDA",
  NAO_CONFIGURADO: "NAO_CONFIGURADO",
  ASSINATURA_INVALIDA: "ASSINATURA_INVALIDA",
  LIMITE: "LIMITE",
  VERIFICACAO_INDISPONIVEL: "VERIFICACAO_INDISPONIVEL",
});

/** Recusa padronizada: {ok:false, status, codigo, mensagem}. */
export function recusa(status, codigo, mensagem, extra = {}) {
  return { ok: false, status, codigo, mensagem, ...extra };
}
