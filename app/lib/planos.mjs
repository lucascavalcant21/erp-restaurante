// PLANOS DO HÉFISTO — a única lista de planos, preços e do que cada um libera.
//
// Decisões do dono (14/11/2026):
//   · "Plano grátis e plano pago com tudo" — Grátis e Completo;
//   · "o Héfisto vai ser 89,90" — o Completo custa R$ 89,90 por mês (antes
//     ele tinha dito 59,90; vale o último);
//   · "crédito, débito e Pix; semestral com 20% de desconto e anual com 40%".
//
// O que entra no Grátis foi aprovado pelo dono (14/11/2026, "pode ser; usar
// o sistema de comandas tá bloqueado"): ingredientes e produtos, até 5 fichas
// técnicas, estoque simples, checklists, 1 unidade e 1 usuário. O resto
// aparece com cadeado e leva ao checkout (/dashboard/assinar). Nico e Jhon
// (os assistentes) só no Completo. A página pública /planos, a tela de assinatura e o cadeado do menu
// saem daqui. Preço é valor em centavos (inteiro), nunca número quebrado.

export const PLANOS = Object.freeze({
  gratis: Object.freeze({
    id: "gratis",
    nome: "Grátis",
    precoCentavos: 0,
    resumo: "Para organizar a operação do dia a dia, sem pagar nada.",
    limites: Object.freeze({ unidades: 1, usuarios: 1, fichas: 5 }),
    destaques: Object.freeze([
      "Cadastro de ingredientes e produtos",
      "Até 5 fichas técnicas",
      "Estoque com entrada, retirada e contagem",
      "Checklists de abertura e fechamento",
      "1 unidade e 1 usuário (o dono)",
    ]),
  }),
  completo: Object.freeze({
    id: "completo",
    nome: "Completo",
    precoCentavos: 8990,
    resumo: "Tudo o que o Héfisto faz, para administrar o restaurante inteiro.",
    limites: Object.freeze({ unidades: null, usuarios: null, fichas: null }),
    destaques: Object.freeze([
      "Tudo do Grátis, sem limite de fichas técnicas",
      "Comandas, caixa, KDS, etiquetas e cardápio digital",
      "Jhon, o assistente do dono (CMV, custo e produtos), e Nico, o da equipe (fichas, etiquetas, salão e ponto)",
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

/**
 * Períodos de cobrança do plano pago. O desconto vale sobre o preço mensal
 * vezes os meses; o total é pago de uma vez no período.
 */
export const PERIODOS = Object.freeze([
  Object.freeze({ id: "mensal", nome: "Mensal", meses: 1, descontoPct: 0 }),
  Object.freeze({ id: "semestral", nome: "Semestral", meses: 6, descontoPct: 20 }),
  Object.freeze({ id: "anual", nome: "Anual", meses: 12, descontoPct: 40 }),
]);

export const periodoPorId = (id) => PERIODOS.find((p) => p.id === id) || null;

/**
 * Formas de pagamento (valem para os três períodos). Dono, 14/11/2026: "por
 * enquanto vai ser no Nubank, chave Pix" — crédito e débito entram quando o
 * meio de cobrança online for contratado (BLQ-020).
 */
export const FORMAS_PAGAMENTO = Object.freeze([
  Object.freeze({ id: "credito", nome: "Cartão de crédito", disponivel: false }),
  Object.freeze({ id: "debito", nome: "Cartão de débito", disponivel: false }),
  Object.freeze({ id: "pix", nome: "Pix", disponivel: true }),
]);

/**
 * Preço do plano no período, em centavos inteiros (conta determinística):
 * total = mensal × meses × (100 − desconto) / 100, arredondado ao centavo.
 */
export function precoNoPeriodo(plano, periodoId = "mensal") {
  const periodo = periodoPorId(periodoId);
  if (!plano || !periodo) return null;
  const cheio = plano.precoCentavos * periodo.meses;
  const total = Math.round((cheio * (100 - periodo.descontoPct)) / 100);
  return {
    periodo,
    totalCentavos: total,
    cheioCentavos: cheio,
    economiaCentavos: cheio - total,
    porMesCentavos: Math.round(total / periodo.meses),
  };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos em reais: 8990 → "R$ 89,90". */
export const reais = (centavos) => brl.format((centavos || 0) / 100).replace(/\u00a0/g, " ");

/** Preço mensal do plano: "R$ 89,90" (ou "R$ 0,00"). */
export const precoTexto = (plano) => reais(plano?.precoCentavos);

/** Plano conhecido pelo id, ou null (sem dado não se presume plano). */
export const planoPorId = (id) => PLANOS[String(id || "").toLowerCase()] || null;

/**
 * Telas que o plano Grátis abre (rota exata ou filhas). Tudo o mais dentro de
 * /dashboard fica com cadeado. As telas de cards de Cozinha, Bar e Salão
 * abrem para mostrar o que existe, com cadeado em cada card pago.
 */
export const ROTAS_GRATIS = Object.freeze([
  "/dashboard/operacao/ingredientes",
  "/dashboard/operacao/fichas",
  "/dashboard/operacao/estoque",
  "/dashboard/operacao/rotina",
  "/dashboard/tarefas",
  "/dashboard/cozinha",
  "/dashboard/bar",
  "/dashboard/salao",
  "/dashboard/configuracoes",
  "/dashboard/notificacoes",
  "/dashboard/menu",
  "/dashboard/conta",
  "/dashboard/assinar",
]);

/** Dentro de telas liberadas, o que continua pago (custo e valores do estoque, logins de equipe e tablets). */
export const ROTAS_PAGAS_DENTRO = Object.freeze([
  "/dashboard/operacao/estoque/painel",
  "/dashboard/operacao/estoque/cmv",
  "/dashboard/operacao/estoque/compras",
  "/dashboard/operacao/estoque/calendario",
  "/dashboard/cozinha/kds",
  "/dashboard/salao/mesas",
  "/dashboard/salao/online",
  "/dashboard/configuracoes/usuarios",
  "/dashboard/configuracoes/perfis",
  "/dashboard/configuracoes/apps",
  "/dashboard/configuracoes/integracoes",
  "/dashboard/configuracoes/automacoes",
]);

const casa = (p, r) => p === r || p.startsWith(`${r}/`);

/**
 * A tela abre neste plano? Plano desconhecido (empresa sem assinatura
 * registrada) NÃO tranca nada: o cliente de hoje não pode perder tela por
 * falta de dado de cobrança. A tela inicial sempre abre.
 */
export function rotaLiberada(planoId, href) {
  const plano = planoPorId(planoId);
  if (!plano || plano.id === "completo") return true;
  const p = String(href || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/dashboard" || !p.startsWith("/dashboard")) return true;
  if (ROTAS_PAGAS_DENTRO.some((r) => casa(p, r))) return false;
  return ROTAS_GRATIS.some((r) => casa(p, r));
}

/** A área do menu abre? Cozinha, Bar e Salão abrem (cards trancados um a um). */
export function areaLiberada(planoId, area) {
  const href = typeof area === "string" ? null : area?.href;
  if (!href) return rotaLiberada(planoId, area ? `/dashboard/${area}` : "/dashboard");
  return rotaLiberada(planoId, href);
}

/** Endereço do checkout, lembrando de onde a pessoa veio. */
export const linkCheckout = (deRota) => `/dashboard/assinar${deRota ? `?de=${encodeURIComponent(String(deRota).slice(0, 200))}` : ""}`;

/** Ainda cabe mais uma ficha técnica neste plano? (sem plano registrado, sim) */
export function podeCriarFicha(planoId, totalFichas) {
  const plano = planoPorId(planoId);
  const limite = plano?.limites?.fichas;
  if (!plano || limite == null) return true;
  return Number(totalFichas) < limite;
}

/** Situações da assinatura gravadas no banco (db/SAAS_PLANOS_1.sql). */
export const SITUACOES = Object.freeze({
  ativa: "Ativa",
  em_teste: "Em teste",
  atrasada: "Pagamento atrasado",
  cancelada: "Cancelada",
  cortesia: "Cortesia",
});

/** Só dígitos, com DDI do Brasil quando faltar (WhatsApp comercial). */
export function numeroWhatsApp(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : `55${d}`;
}

/**
 * Link para falar com o comercial do Héfisto pelo WhatsApp. Enquanto a
 * cobrança online não existe, "Assinar" e "Começar grátis" passam por aqui.
 * Sem número configurado (NEXT_PUBLIC_HEFISTO_WHATSAPP_COMERCIAL), null.
 */
export function linkComercial(numeroBruto, { plano = null, empresa = null, periodo = "mensal" } = {}) {
  const numero = numeroWhatsApp(numeroBruto);
  if (!numero) return null;
  const preco = plano?.precoCentavos ? precoNoPeriodo(plano, periodo) : null;
  const condicao = preco
    ? preco.periodo.meses === 1
      ? `${reais(preco.totalCentavos)} por mês`
      : `${preco.periodo.nome.toLowerCase()}, ${reais(preco.totalCentavos)} com ${preco.periodo.descontoPct}% de desconto`
    : "";
  const texto = preco
    ? `Olá! Quero assinar o plano ${plano.nome} do Héfisto (${condicao})${empresa ? ` para ${empresa}` : ""}.`
    : `Olá! Quero começar a usar o Héfisto no plano ${plano?.nome || "Grátis"}${empresa ? ` no ${empresa}` : ""}.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Link do WhatsApp comercial para mandar o comprovante do Pix, já com a
 * empresa, o plano, o período e o valor. Sem número configurado, null.
 */
export function linkComprovante(numeroBruto, { plano, periodo = "mensal", empresa = null } = {}) {
  const numero = numeroWhatsApp(numeroBruto);
  const preco = plano?.precoCentavos > 0 ? precoNoPeriodo(plano, periodo) : null;
  if (!numero || !preco) return null;
  const texto = `Olá! Paguei por Pix a assinatura do Héfisto: plano ${plano.nome}, ${preco.periodo.nome.toLowerCase()}, ${reais(preco.totalCentavos)}${empresa ? `, empresa ${empresa}` : ""}. Segue o comprovante.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
