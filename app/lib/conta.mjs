// MINHA CONTA — regras puras da tela de conta e do cartão de perfil do Menu
// (pedido do dono, 14/11/2026, visual inspirado no app da Medway).

import { SITUACOES, planoPorId, precoTexto } from "./planos.mjs";

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
 * Situação da assinatura da empresa, a partir do que hefisto_minha_assinatura()
 * devolve ({ plano, situacao, proximo_vencimento }). Sem dado (migração
 * SAAS_PLANOS_1 não aplicada ou empresa sem linha), a tela diz "Não
 * registrado", nunca inventa plano.
 */
export function situacaoAssinatura(assinatura) {
  const plano = planoPorId(assinatura?.plano);
  if (!plano) {
    return { registrado: false, plano: null, rotulo: "Não registrado", detalhe: "DADOS INSUFICIENTES: a assinatura desta empresa ainda não foi registrada." };
  }
  const situacao = SITUACOES[assinatura?.situacao] || null;
  const partes = [situacao ? `Situação: ${situacao.toLowerCase()}` : "Situação não informada"];
  if (plano.precoCentavos > 0 && assinatura?.situacao !== "cortesia") partes.push(`${precoTexto(plano)} por mês`);
  if (assinatura?.proximo_vencimento) {
    const [a, m, d] = String(assinatura.proximo_vencimento).slice(0, 10).split("-");
    if (a && m && d) partes.push(`próximo vencimento ${d}/${m}/${a}`);
  }
  return { registrado: true, plano, rotulo: plano.nome, detalhe: partes.join(" · ") };
}
