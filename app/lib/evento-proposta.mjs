// PROPOSTA DO EVENTO PARA O CLIENTE (pedido do dono, 05/11/2026, com o PDF de
// referência de coffee break): mesma organização do modelo — cabeçalho com logo
// e fotos, dados do evento, cardápio por parte com QUANTIDADE + item agrupado
// por categoria, serviços inclusos, total do orçamento e condições gerais.
// Identidade do Seldeestrela (branco e dourado); o texto das condições é do
// restaurante: modelo salvo uma vez em config_sistema.params.proposta_eventos e
// usado em todas as propostas. Sem custo, margem ou ficha: só o que o cliente vê.
// Valores vêm do resumo do orçamento (resumoDoOrcamento); nada é recalculado aqui
// além de quantidades e da divisão entrada/restante.

import { SECOES, tipoDoEvento, secaoDoItem } from "./evento-orcamento.mjs";

const pos = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const linhas = (t) => String(t || "").split("\n").map((l) => l.trim()).filter(Boolean);

/** Modelo padrão das condições (texto neutro; o dono ajusta ao dele). */
export const MODELO_PROPOSTA_PADRAO = Object.freeze({
  logo_url: "",
  boas_vindas: "Ficamos muito felizes com o seu pedido de orçamento e será um prazer fazer parte do seu evento.",
  aviso_reserva: "Este orçamento não garante a reserva da data.",
  empresa: { razao_social: "", cnpj: "", endereco: "", representante: "" },
  assinatura: { nome: "", telefone: "" },
  pagamento: { entrada_pct: 30, restante_dias: 7, parcelas: 1, extras_dias: 15 },
  secoes: [
    { id: "convidados", titulo: "Número de convidados", texto: [
      "O número de convidados informado neste orçamento é o mínimo contratado.",
      "A confirmação final deve ser feita até 7 dias antes do evento; depois disso só é possível aumentar as quantidades.",
      "Convidados além do combinado não estão cobertos: comida e bebida são calculadas para o número contratado.",
    ].join("\n") },
    { id: "material", titulo: "Material, danos e quebras", texto: [
      "Danos causados pelos participantes do evento às instalações, móveis e utensílios são de responsabilidade do contratante.",
      "Material quebrado ou extraviado é cobrado pelo valor de reposição.",
    ].join("\n") },
    { id: "atendimento", titulo: "Atendimento", texto: [
      "O horário de atendimento é o descrito neste orçamento. Se o evento passar do horário, cada hora extra da equipe é cobrada à parte.",
    ].join("\n") },
    { id: "observacoes", titulo: "Observações", texto: [
      "Alimentação de prestadores de serviço de terceiros (fotografia, som, segurança) não está incluída, salvo se combinado.",
      "Produtos de outros fornecedores servidos no evento devem ser informados com antecedência.",
      "O contratante pode conferir os produtos e materiais com o responsável no início e no fim do evento.",
    ].join("\n") },
    { id: "bebidas", titulo: "Bebidas", texto: "" },
    { id: "obrigacoes", titulo: "Obrigações do contratante", texto: [
      "Informar com antecedência os dados necessários para o evento (endereço, acesso, horário de montagem).",
      "Providenciar ponto de energia e água corrente no local, quando necessário para o cardápio contratado.",
    ].join("\n") },
  ],
});

/** Lê o modelo salvo sem quebrar com dado velho ou incompleto. */
export function normalizarModeloProposta(salvo) {
  const p = MODELO_PROPOSTA_PADRAO;
  const s = salvo && typeof salvo === "object" ? salvo : {};
  const secoesSalvas = Array.isArray(s.secoes) ? s.secoes : null;
  return {
    logo_url: String(s.logo_url || ""),
    boas_vindas: s.boas_vindas != null ? String(s.boas_vindas) : p.boas_vindas,
    aviso_reserva: s.aviso_reserva != null ? String(s.aviso_reserva) : p.aviso_reserva,
    empresa: { ...p.empresa, ...(s.empresa || {}) },
    assinatura: { ...p.assinatura, ...(s.assinatura || {}) },
    pagamento: { ...p.pagamento, ...(s.pagamento || {}) },
    secoes: (secoesSalvas || p.secoes).map((x, i) => ({ id: String(x.id || `s${i}`), titulo: String(x.titulo || ""), texto: String(x.texto || "") })),
  };
}

const CATEGORIA_SEM = "Outros";

/**
 * Cardápio do cliente com quantidade: por parte do evento (Mesa montada, Buffet,
 * Bar…) e, dentro dela, por categoria da ficha (Salgados, Doces, Bebidas…).
 * Quantidade: item em quantidade fechada → o total informado (e as fatias, se
 * dividido); por pessoa → porções × pessoas (arredonda para cima).
 * @param {object} resumo  resultado de resumoDoOrcamento(orc, fichas)
 */
export function cardapioComQuantidades(orc = {}, resumo = {}) {
  const tipo = tipoDoEvento(orc.tipo);
  const pessoas = pos(resumo.pessoasConsumo) || pos(resumo.convidados);
  const partes = [];
  for (const s of tipo.secoes) {
    const itens = (resumo.itens || []).filter((i) => (i.secao || secaoDoItem(i, orc.tipo)) === s);
    if (!itens.length) continue;
    const porCategoria = new Map();
    for (const i of itens) {
      const categoria = String(i.ficha?.categoria || "").trim() || (s === "bar" ? "Bebidas" : CATEGORIA_SEM);
      let qtd; let detalhe = "";
      if (i.emTotal) {
        qtd = i.fatias != null ? i.fatias : pos(i.quantidadeTotal);
        if (i.fatias != null) detalhe = `${s === "bar" ? "copos" : "fatias"}`;
      } else if (i.dividido) {
        qtd = Math.ceil(pos(i.porPessoa) * pessoas * (i.porcoesPorFicha || 1) - 1e-9);
      } else {
        qtd = Math.ceil(pos(i.porPessoa) * pessoas - 1e-9);
      }
      if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
      porCategoria.get(categoria).push({ quantidade: qtd || null, nome: i.nome || "Item", descricao: i.descricao || "", detalhe, foto: i.ficha?.imagem || null });
    }
    const categorias = [...porCategoria.entries()]
      .sort(([a], [b]) => (a === CATEGORIA_SEM) - (b === CATEGORIA_SEM) || a.localeCompare(b, "pt-BR"))
      .map(([categoria, lista]) => ({ categoria, itens: lista }));
    partes.push({ secao: s, rotulo: tipo.secoes.length === 1 || orc.tipo === "ticket" ? tipo.rotulo : SECOES[s].rotulo, categorias });
  }
  return partes;
}

/** Fotos para o cabeçalho: as primeiras fotos de fichas do cardápio (até 2). */
export function fotosDoCardapio(resumo = {}, max = 2) {
  const urls = [];
  for (const i of resumo.itens || []) {
    const u = i.ficha?.imagem;
    if (u && /^https?:\/\//.test(u) && !urls.includes(u)) urls.push(u);
    if (urls.length >= max) break;
  }
  return urls;
}

/** Linhas de valor que o cliente vê. soTotal: só o total do orçamento. */
export function valoresDaProposta(resumo = {}, { soTotal = false } = {}) {
  const linhasValor = [];
  if (!soTotal) {
    if (resumo.precoPorPessoa > 0 && resumo.adultos > 0) linhasValor.push({ rotulo: `${resumo.adultos} pessoa(s) × ${brl(resumo.precoPorPessoa)}`, valor: r2(resumo.adultos * resumo.precoPorPessoa) });
    if (resumo.criancas > 0 && resumo.precoCrianca > 0) linhasValor.push({ rotulo: `${resumo.criancas} criança(s) × ${brl(resumo.precoCrianca)}`, valor: r2(resumo.criancas * resumo.precoCrianca) });
    if (resumo.precoMesa > 0) linhasValor.push({ rotulo: "Mesa montada (pacote fechado)", valor: r2(resumo.precoMesa) });
    if (resumo.desconto > 0) linhasValor.push({ rotulo: "Desconto", valor: -r2(resumo.desconto) });
  }
  return { linhas: linhasValor, total: resumo.receita > 0 ? r2(resumo.receita) : null };
}

/** Entrada e restante pelo modelo: valores e prazos para a tabela de pagamento. */
export function pagamentoDaProposta(total, pagamento = {}) {
  const pct = Math.min(100, pos(pagamento.entrada_pct));
  const t = pos(total);
  return {
    entradaPct: pct,
    entrada: t ? r2(t * pct / 100) : null,
    restantePct: r2(100 - pct),
    restante: t ? r2(t - r2(t * pct / 100)) : null,
    restanteDias: Math.round(pos(pagamento.restante_dias)),
    parcelas: Math.max(1, Math.round(pos(pagamento.parcelas) || 1)),
    extrasDias: Math.round(pos(pagamento.extras_dias)),
  };
}

export const textoEmLinhas = linhas;
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
