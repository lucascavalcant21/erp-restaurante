// MINHA CONTA — regras puras da tela de conta e do cartão de perfil do Menu
// (pedido do dono, 14/11/2026, visual inspirado no app da Medway).

/** Até duas iniciais do nome ("Lucas Cavalcante Guedes" → "LG"). */
export function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return `${primeira}${ultima}`.toUpperCase();
}

/** O e-mail é de verdade (dá para recuperar a senha por ele)? Login de app usa @hefisto.app. */
export function emailReal(email) {
  const e = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.endsWith("@hefisto.app");
}

export const TEXTO_INDICACAO =
  "Conheça o Héfisto, o sistema de gestão para restaurantes que eu uso: estoque, fichas técnicas, comandas, equipe e financeiro em um lugar só.";

/** Link do WhatsApp para indicar o Héfisto (a pessoa escolhe o contato). */
export function linkIndicacao(nomeQuemIndica) {
  const assinatura = String(nomeQuemIndica || "").trim();
  const texto = assinatura ? `${TEXTO_INDICACAO}\n\nIndicação de ${assinatura}.` : TEXTO_INDICACAO;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

/**
 * Situação da assinatura da empresa. O banco de produção ainda não tem plano
 * nem cobrança (a migração do Control Plane SaaS não foi aplicada em
 * 14/11/2026): sem dado, a tela diz "Não registrado", nunca inventa plano.
 */
export function situacaoAssinatura(empresa) {
  const plano = empresa?.plano_id ? String(empresa.plano_id) : null;
  if (!plano) {
    return { registrado: false, rotulo: "Não registrado", detalhe: "DADOS INSUFICIENTES: a cobrança do Héfisto ainda não foi ativada nesta empresa." };
  }
  const NOMES = { BASIC: "Essencial", PRO: "Profissional", PILOT_PRO: "Piloto Profissional", MULTIUNIT: "Multiunidades" };
  const status = String(empresa?.status || "").toUpperCase();
  const SITUACAO = { ACTIVE: "Ativa", SUSPENDED: "Suspensa", CANCELLED: "Cancelada", TRIAL: "Em teste" };
  return {
    registrado: true,
    rotulo: NOMES[plano] || plano,
    detalhe: SITUACAO[status] ? `Assinatura ${SITUACAO[status].toLowerCase()}` : "Situação não informada",
  };
}
