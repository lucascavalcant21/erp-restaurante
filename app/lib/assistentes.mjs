// OS DOIS ASSISTENTES DO HÉFISTO (decisão do dono, 14/11/2026)
//
//   · Nico — o assistente da EQUIPE: ficha técnica e "como faz", etiquetas,
//     procedimentos do salão, treinamento e ponto. Mais tocar do que digitar.
//   · Jhon — o assistente do DONO: tudo o que o Nico sabe e também a gestão
//     (CMV, custo, margem, produtos, contas, equipe).
//
// "O Jhon pode perguntar coisas para o Nico, mas o Nico não pergunta para o
// Jhon": o Jhon enxerga a operação inteira; o Nico nunca fala de dinheiro,
// custo ou gestão. Os dados que cada um recebe já vêm filtrados pelas
// permissões de quem pergunta (o "sim" é do banco); este arquivo só decide
// o NOME e o PAPEL de cada um.
//
// Os dois fazem parte do plano Completo (app/lib/planos.mjs).

export const NICO = Object.freeze({
  id: "nico",
  nome: "Nico",
  publico: "equipe",
  descricao: "Assistente da equipe: fichas, etiquetas, salão, treinamento e ponto",
});

export const JHON = Object.freeze({
  id: "jhon",
  nome: "Jhon",
  publico: "dono",
  descricao: "Assistente do dono: CMV, custos, produtos e tudo o que o Nico sabe",
});

/** A sessão do navegador é do dono (administrador da empresa)? */
export function sessaoEhDono(sessao) {
  if (!sessao || sessao.is_app) return false;
  return !sessao.gerenciado
    || sessao.papel === "admin"
    || sessao.super_admin === true
    || sessao.tipo_acesso === "administrador"
    || sessao.permissions === "*";
}

/** Assistente de quem está logado no navegador. App de tablet é sempre o Nico. */
export const assistenteDaSessao = (sessao) => (sessaoEhDono(sessao) ? JHON : NICO);

/**
 * Assistente do lado do servidor, pelo contexto da inteligência (usuario e
 * permissões efetivas do banco).
 */
export function assistenteDoContexto(ic) {
  const perms = Array.isArray(ic?.permissoes) ? ic.permissoes : [];
  const dono = ic?.usuario?.superAdmin === true
    || perms.includes("*")
    || ["administrador", "administrador-geral"].includes(String(ic?.usuario?.perfil || ""));
  return dono ? JHON : NICO;
}

/** Como cada um se apresenta ao modelo de linguagem (o resto das regras é do agente). */
export function identidadeNoPrompt(assistente) {
  if (assistente?.id === "jhon") {
    return "Você é o Jhon, o assistente do DONO do restaurante dentro do ERP Héfisto. Você sabe tudo o que o Nico (o assistente da equipe) sabe — fichas técnicas, procedimentos, etiquetas, treinamento — e também a gestão: CMV, custos, margens, produtos, contas e equipe.";
  }
  return "Você é o Nico, o assistente da EQUIPE do restaurante dentro do ERP Héfisto: fichas técnicas e como fazer, etiquetas, procedimentos do salão, treinamento e ponto. Você NÃO fala de custo, CMV, margem, preço de compra, vendas, contas, salários nem de outros assuntos de gestão: se perguntarem, diga com educação que isso é com o dono e volte para a operação.";
}
