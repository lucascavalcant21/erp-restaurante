// PLANOS DO HÉFISTO — a única lista de planos, preços e do que cada um libera.
//
// Decisão do dono (14/11/2026): "Plano grátis e plano pago com tudo por 59,90".
//   · Grátis: a operação do dia a dia de um restaurante.
//   · Completo: tudo, por R$ 59,90 por mês.
//
// O que entra no Grátis é SUGESTÃO desta sessão (o dono decidiu os dois
// planos e o preço, não a lista): para mudar, mexa só em AREAS_GRATIS e nos
// limites. A página pública /planos, a tela de assinatura e o cadeado do menu
// saem daqui. Preço é valor em centavos (inteiro), nunca número quebrado.

export const PLANOS = Object.freeze({
  gratis: Object.freeze({
    id: "gratis",
    nome: "Grátis",
    precoCentavos: 0,
    resumo: "Para organizar a operação do dia a dia, sem pagar nada.",
    limites: Object.freeze({ unidades: 1, usuarios: 3 }),
    destaques: Object.freeze([
      "Cozinha, Bar e Salão com cards de cada área",
      "Comandas, caixa e cardápio digital com QR Code",
      "Estoque com entrada, retirada e contagem",
      "Fichas técnicas e etiquetas de produção",
      "Checklists de abertura, fechamento e limpeza",
      "1 unidade e até 3 usuários",
    ]),
  }),
  completo: Object.freeze({
    id: "completo",
    nome: "Completo",
    precoCentavos: 5990,
    resumo: "Tudo o que o Héfisto faz, para administrar o restaurante inteiro.",
    limites: Object.freeze({ unidades: null, usuarios: null }),
    destaques: Object.freeze([
      "Tudo do Grátis",
      "Assistente Héfisto com inteligência (texto e áudio)",
      "Financeiro: contas a pagar e receber, caixa, DRE e CMV real",
      "Equipe: ponto, escala, folha, banco de horas e treinamento",
      "Eventos, reservas e orçamentos",
      "Marmitaria com precificação e painel gerencial",
      "Compras, notas fiscais, fornecedores e custo médio",
      "Integrações (iFood, pagamentos) e TVs do restaurante",
      "Usuários e unidades sem limite",
    ]),
  }),
});

export const PLANO_PAGO = PLANOS.completo;

/** Áreas do menu (ids de menu-principal.mjs) que o plano Grátis abre. */
export const AREAS_GRATIS = Object.freeze(["cozinha", "bar", "salao", "estoque", "cardapio", "operacao"]);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 59,90" (ou "R$ 0,00"). */
export const precoTexto = (plano) => brl.format((plano?.precoCentavos || 0) / 100).replace(/ /g, " ");

/** Plano conhecido pelo id, ou null (sem dado não se presume plano). */
export const planoPorId = (id) => PLANOS[String(id || "").toLowerCase()] || null;

/**
 * A área está liberada para este plano? Plano desconhecido (empresa sem
 * assinatura registrada, banco sem a migração) NÃO tranca nada: o cliente
 * de hoje não pode perder tela por falta de dado de cobrança.
 */
export function areaLiberada(planoId, areaId) {
  const plano = planoPorId(planoId);
  if (!plano || plano.id === "completo") return true;
  return AREAS_GRATIS.includes(areaId);
}

/** Situações da assinatura gravadas no banco (db/SAAS_PLANOS_1.sql). */
export const SITUACOES = Object.freeze({
  ativa: "Ativa",
  em_teste: "Em teste",
  atrasada: "Pagamento atrasado",
  cancelada: "Cancelada",
  cortesia: "Cortesia",
});
