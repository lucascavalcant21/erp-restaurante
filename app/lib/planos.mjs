// PLANOS DO HÉFISTO — a única lista de planos, preços e do que cada um libera.
//
// Decisões do dono (14/11/2026):
//   · "Plano grátis e plano pago com tudo" — Grátis e Completo;
//   · "o Héfisto vai ser 89,90" — o Completo custa R$ 89,90 por mês (antes
//     ele tinha dito 59,90; vale o último);
//   · "crédito, débito e Pix; semestral com 20% de desconto e anual com 40%".
//
// O que entra no Grátis é SUGESTÃO desta sessão (o dono decidiu os dois
// planos e o preço, não a lista): para mudar, mexa só em AREAS_GRATIS e nos
// limites. A página pública /planos, a tela de assinatura e o cadeado do menu
// saem daqui. Preço é valor em centavos (inteiro), nunca número quebrado.

import { areaDaRota } from "./menu-principal.mjs";

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
    precoCentavos: 8990,
    resumo: "Tudo o que o Héfisto faz, para administrar o restaurante inteiro.",
    limites: Object.freeze({ unidades: null, usuarios: null }),
    destaques: Object.freeze([
      "Tudo do Grátis",
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

/** Áreas do menu (ids de menu-principal.mjs) que o plano Grátis abre. */
export const AREAS_GRATIS = Object.freeze(["cozinha", "bar", "salao", "estoque", "cardapio", "operacao"]);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos em reais: 8990 → "R$ 89,90". */
export const reais = (centavos) => brl.format((centavos || 0) / 100).replace(/\u00a0/g, " ");

/** Preço mensal do plano: "R$ 89,90" (ou "R$ 0,00"). */
export const precoTexto = (plano) => reais(plano?.precoCentavos);

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

/**
 * A tela abre neste plano? A área dona da tela sai do menu (areaDaRota);
 * tela sem área (Início, Menu, Minha conta, Configurações) sempre abre.
 * Devolve o id da área trancada, ou null quando abre.
 */
export function areaTrancadaDaRota(planoId, pathname) {
  const area = areaDaRota(pathname);
  if (!area || areaLiberada(planoId, area.id)) return null;
  return area.id;
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
