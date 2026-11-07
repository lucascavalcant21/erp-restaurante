// PRÓXIMOS PASSOS — as sugestões que aparecem embaixo de cada resposta do
// Assistente Héfisto (botões de resposta rápida, como no WhatsApp).
//
// Regras:
//   - só frases que o Héfisto SABE responder (o teste confere que cada uma é
//     entendida pelo interpretador);
//   - nunca um número inventado: uma sugestão com valor usa um número que
//     veio da própria resposta (ex.: preço já citado + 10%);
//   - no máximo 3, sem repetir o que acabou de ser perguntado;
//   - a resposta que já traz sugestões ou escolhas (pergunta com opções,
//     confirmação) fica como está.

export const MAX_SUGESTOES = 3;

const SEM_SUGESTOES = new Set(["fichas.preparo"]);

const GERAIS = Object.freeze([
  "Como foi minha empresa hoje?",
  "Meus funcionários chegaram no horário?",
  "Quais produtos estão abaixo do mínimo?",
  "Quais produtos estão próximos do vencimento?",
  "Quais contas vencem nos próximos dias?",
  "Como está meu CMV?",
]);

const reais = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Por assunto: o que normalmente vem depois. `p` = nome do produto citado, `f` = ficha citada. */
const POR_INTENCAO = {
  "estoque.saldo_produto": ({ p }) => (p ? [`Recebi ${p}`, `Quanto paguei em ${p} da última vez?`, "Quais produtos estão abaixo do mínimo?"] : ["Quais produtos estão abaixo do mínimo?"]),
  "estoque.abaixo_minimo": () => ["Quanto comprei esta semana?", "Qual produto teve maior aumento de preço?"],
  "estoque.registrar_entrada": ({ p }) => (p ? [`Quanto tenho de ${p}?`, "Quais produtos estão abaixo do mínimo?"] : ["Quais produtos estão abaixo do mínimo?"]),
  "estoque.registrar_perda": ({ p }) => (p ? [`Quanto tenho de ${p}?`, "Quais foram as perdas desta semana?"] : ["Quais foram as perdas desta semana?"]),
  "estoque.vencimentos": () => ["Quais foram as perdas desta semana?", "Quais produtos estão abaixo do mínimo?"],
  "estoque.divergencias": () => ["Quais foram as perdas desta semana?", "Como está meu CMV?"],
  "estoque.perdas": () => ["Tem alguma diferença estranha no estoque?", "Como está meu CMV?"],
  "compras.conferir_recebimento": ({ p }) => (p ? [`Quanto tenho de ${p}?`, `Quanto paguei em ${p} da última vez?`] : ["Quanto comprei esta semana?"]),
  "compras.ultimo_preco": ({ p }) => (p ? [`Quanto tenho de ${p}?`, "Qual produto teve maior aumento de preço?"] : ["Qual produto teve maior aumento de preço?"]),
  "compras.total": () => ["Qual produto teve maior aumento de preço?", "Como está meu CMV?"],
  "compras.maior_aumento_preco": () => ["Quanto comprei esta semana?", "Como está meu CMV?"],
  "rh.pontualidade": () => ["Quem trabalha hoje?", "Quanto de hora extra este mês?"],
  "rh.escala_dia": () => ["Meus funcionários chegaram no horário?", "Como está meu CMO?"],
  "rh.hora_extra": () => ["Como está meu CMO?", "Meus funcionários chegaram no horário?"],
  "custos.cmo": () => ["Quanto de hora extra este mês?", "Como está meu CMV?"],
  "custos.cmv": () => ["Por que meu CMV subiu?", "Qual produto teve maior aumento de preço?"],
  "custos.por_que_cmv": () => ["Qual produto teve maior aumento de preço?", "Quais foram as perdas desta semana?"],
  "vendas.faturamento": () => ["Qual é o meu ticket médio?", "Como está meu CMV?", "Qual foi meu lucro este mês?"],
  "vendas.ticket_medio": () => ["Quanto vendi esta semana?", "Como está meu CMV?"],
  "financeiro.lucro": () => ["Como está meu CMV?", "Como está meu CMO?", "Quais contas vencem nos próximos dias?"],
  "financeiro.contas_a_vencer": () => ["Qual foi meu lucro este mês?", "Quanto vendi esta semana?"],
  "empresa.resumo_dia": () => ["O que precisa da minha atenção?", "Meus funcionários chegaram no horário?", "Quais produtos estão abaixo do mínimo?"],
  "empresa.problemas": () => ["Como foi minha empresa hoje?", "Quais contas vencem nos próximos dias?"],
  // a folha do prato/drink já termina com "Abrir a ficha": sem botões extras (pedido do dono, 07/11/2026)
  "fichas.preparo": () => [],
  "fichas.custo_quantidade": ({ f, base }) => [
    f ? "Quanto custa 1 kg dessa receita?" : null,
    base ? "Vamos montar um prato com essa base" : null,
    "Vamos montar uma receita",
  ].filter(Boolean),
  "fichas.lucro_preco": ({ preco }) => [
    preco > 0 ? `E se eu vender esse prato por ${reais(Math.ceil(Math.round(preco * 110) / 100))} reais?` : null,
    "Como está meu CMV?",
  ].filter(Boolean),
  "fichas.criar": ({ base }) => [base ? "Vamos montar um prato com essa base" : null, "Quanto custa 200 g dessa receita?", "Vamos montar uma receita"].filter(Boolean),
};

/**
 * Sugestões para uma resposta já montada.
 * @param {object} p
 * @param {string|null} p.intencao     id da intenção respondida
 * @param {object} p.resposta          corpo da resposta (tipo, sugestoes, pergunta, confirmacao…)
 * @param {object|null} p.referencia   o que a resposta citou (produto, ficha)
 * @param {object|null} p.interpretacao
 * @param {string} p.texto             pedido original (para não sugerir a mesma coisa)
 * @returns {string[]}
 */
export function sugestoesDaResposta({ intencao = null, resposta = {}, referencia = null, interpretacao = null, texto = "" } = {}) {
  if (Array.isArray(resposta.sugestoes) && resposta.sugestoes.length) return resposta.sugestoes;
  // pergunta com escolhas, confirmação e lote já têm os próprios botões
  if (resposta.pergunta?.opcoes?.length || resposta.confirmacao || resposta.tipo === "lote" || resposta.tipo === "navegacao") return [];
  // pergunta aberta: a pessoa vai responder no campo
  if (resposta.pergunta) return [];
  const p = referencia?.produto?.nome || null;
  const f = referencia?.ficha?.nome || null;
  const base = resposta.tipo === "resultado_acao" ? /^Base criada/.test(resposta.texto || "") : false;
  const preco = intencao === "fichas.lucro_preco" ? Number(interpretacao?.quantidade) : null;
  const gerar = POR_INTENCAO[intencao];
  let lista = gerar ? gerar({ p, f, base, preco }) : [];
  // sem assunto conhecido (erro, bloqueio, assunto sem roteiro): as gerais
  if (!lista.length && !SEM_SUGESTOES.has(intencao)) lista = [...GERAIS];
  const pedido = normal(texto);
  const vistas = new Set();
  return lista.filter((s) => {
    const n = normal(s);
    if (!n || n === pedido || vistas.has(n)) return false;
    vistas.add(n);
    return true;
  }).slice(0, MAX_SUGESTOES);
}

const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
