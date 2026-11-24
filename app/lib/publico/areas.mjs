// ÁREAS DA PÁGINA INICIAL — a lista única dos cards de "/" e do pedido de
// cadastro (/cadastro?area=…).
//
// Pedido do dono (21/11/2026): "página inicial do Héfisto, sua gestão pessoal e
// de negócios", com cards de áreas que levam ao cadastro. Decisão do dono: o
// cadastro é um PEDIDO (o administrador cria a conta), guardado pela função
// hefisto_pedir_cadastro (db/publico/PUB_1_PEDIDOS_CADASTRO.sql).
//
// `disponivel: false` = a área ainda não existe no app: o card diz "Em breve" e
// o pedido entra como lista de espera. Nada de prometer o que não está pronto.

import { CONSULTORIO_NA_TELA } from "../negocios.mjs";

const TODAS_AREAS = Object.freeze([
  Object.freeze({
    id: "restaurante",
    nome: "Restaurante",
    icone: "ChefHat",
    disponivel: true,
    chamada: "Cozinha, bar e salão no mesmo sistema.",
    pontos: Object.freeze(["Fichas técnicas e custo de cada prato", "Estoque, compras e CMV real", "Comandas, KDS e cardápio digital"]),
  }),
  Object.freeze({
    id: "delivery",
    nome: "Delivery",
    icone: "Bike",
    disponivel: true,
    chamada: "Marmitas e delivery com preço que dá lucro.",
    pontos: Object.freeze(["Precificação com todos os custos", "Produção, porcionamento e etiquetas", "DRE e projeção do mês"]),
  }),
  Object.freeze({
    id: "eventos",
    nome: "Eventos",
    icone: "PartyPopper",
    disponivel: true,
    chamada: "Orçamento, buffet e calendário de recebimentos.",
    pontos: Object.freeze(["Orçamento em etapas com DRE do evento", "Ponto de equilíbrio e sobras do buffet", "Calendário com parcelas e atrasos"]),
  }),
  Object.freeze({
    id: "consultorio",
    nome: "Consultório",
    icone: "Stethoscope",
    disponivel: true,
    chamada: "Agenda, pacientes, teleconsulta e o preço certo da consulta.",
    pontos: Object.freeze(["Agenda da secretária e fila do médico", "Ficha, retornos e portal do paciente", "Quanto cobrar para ter lucro"]),
  }),
  Object.freeze({
    id: "pessoal",
    nome: "Gestão pessoal",
    icone: "PiggyBank",
    disponivel: false,
    chamada: "Suas contas pessoais separadas das do negócio.",
    pontos: Object.freeze(["Contas a pagar da casa", "Quanto sobra no mês", "Pró-labore que vem dos negócios"]),
  }),
]);

// Consultório quieto por enquanto (dono, 24/11/2026): fora da página inicial e do cadastro.
export const AREAS = Object.freeze(TODAS_AREAS.filter((a) => CONSULTORIO_NA_TELA || a.id !== "consultorio"));

export const areaPorId = (id) => TODAS_AREAS.find((a) => a.id === String(id || "").toLowerCase()) || null;

export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Confere o pedido antes de mandar (as mesmas regras da função do banco, que
 * continua sendo quem decide). Devolve { ok, erros: { campo: mensagem } }.
 */
export function conferirPedido(p = {}) {
  const erros = {};
  if (!areaPorId(p.area)) erros.area = "Escolha uma área.";
  const nome = String(p.nome || "").trim();
  if (nome.length < 2 || nome.length > 120) erros.nome = "Informe seu nome.";
  const w = soDigitos(p.whatsapp);
  if (w.length < 10 || w.length > 13) erros.whatsapp = "Informe o WhatsApp com DDD.";
  const e = String(p.email || "").trim();
  if (!EMAIL.test(e) || e.length > 160) erros.email = "Informe um e-mail válido.";
  if (!p.aceite) erros.aceite = "Marque a autorização de contato.";
  return { ok: Object.keys(erros).length === 0, erros };
}

/** Resposta da função do banco em texto para a pessoa. */
export function mensagemDoPedido(r) {
  if (r?.ok) return null;
  return {
    aceite: "Marque a autorização de contato.",
    area: "Escolha uma área.",
    plano: "Escolha um plano.",
    nome: "Informe seu nome.",
    whatsapp: "Informe o WhatsApp com DDD.",
    email: "Informe um e-mail válido.",
    ocupado: "Recebemos muitos pedidos agora. Tente de novo em alguns minutos.",
  }[r?.erro] || "Não foi possível enviar agora. Tente de novo em instantes.";
}

/** (81) 99999-0000 enquanto a pessoa digita. */
export function mascaraWhatsApp(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const STATUS_PEDIDO = Object.freeze([
  Object.freeze({ id: "novo", nome: "Novo" }),
  Object.freeze({ id: "em_contato", nome: "Em contato" }),
  Object.freeze({ id: "conta_criada", nome: "Conta criada" }),
  Object.freeze({ id: "descartado", nome: "Descartado" }),
]);

/** Link do WhatsApp para responder a quem pediu cadastro (o número veio do pedido). */
export function linkResposta(pedido) {
  const d = soDigitos(pedido?.whatsapp);
  if (d.length < 10) return null;
  const numero = d.length <= 11 ? `55${d}` : d;
  const area = areaPorId(pedido?.area)?.nome || "Héfisto";
  const texto = `Olá, ${String(pedido?.nome || "").split(" ")[0]}! Aqui é do Héfisto. Recebemos seu pedido de cadastro (${area}).`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
