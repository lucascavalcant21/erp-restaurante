// CATÁLOGO DE INTENÇÕES — fonte única do que o Héfisto entende.
//
// Cada intenção declara: tipo (pergunta = só consulta; acao = altera estado;
// navegacao; simulacao), os agentes especialistas que respondem, e a
// GRAMÁTICA declarativa usada pelo interpretador por regras (frases que
// indicam a intenção). O interpretador de IA recebe a mesma lista e devolve
// a intenção no esquema abaixo — validado no servidor nos dois casos.
//
// PERGUNTA e AÇÃO são separadas aqui: só intenção do tipo "acao" chega ao
// ActionRegistry; pergunta nunca escreve nada.

import { s } from "../schemas/schema.mjs";

export const PERIODOS = Object.freeze(["hoje", "ontem", "semana", "semana_passada", "ultimos_7_dias", "mes", "mes_passado", "ultimos_30_dias"]);
export const UNIDADES = Object.freeze(["kg", "g", "l", "ml", "un"]);
export const MOTIVOS_PERDA = Object.freeze(["limpeza", "validade", "erro_producao", "dano", "outro"]);

export const DESTINOS = Object.freeze({
  estoque: { rota: "/dashboard/operacao/estoque?gestao=1", rotulo: "Estoque" },
  compras: { rota: "/dashboard/operacao/estoque/compras", rotulo: "Compras" },
  contas_pagar: { rota: "/dashboard/financeiro/contas", rotulo: "Contas a pagar" },
  financeiro: { rota: "/dashboard/financeiro", rotulo: "Financeiro" },
  cmv: { rota: "/dashboard/operacao/estoque/cmv", rotulo: "CMV real" },
  dre: { rota: "/dashboard/financeiro/dre", rotulo: "DRE" },
  validade: { rota: "/dashboard/operacao/validade", rotulo: "Controle de validade" },
  fichas: { rota: "/dashboard/operacao/fichas", rotulo: "Fichas técnicas" },
  contagens: { rota: "/dashboard/operacao/estoque/contagens", rotulo: "Contagem de estoque" },
  fornecedores: { rota: "/dashboard/operacao/fornecedores", rotulo: "Fornecedores" },
  rh: { rota: "/dashboard/rh", rotulo: "RH" },
  eventos: { rota: "/dashboard/reservas-eventos", rotulo: "Eventos e reservas" },
  inteligencia: { rota: "/dashboard/inteligencia", rotulo: "Central de Inteligência" },
});

/**
 * frases: listas de alternativas; a intenção casa quando TODOS os grupos têm
 * pelo menos uma alternativa presente no texto normalizado (por palavra).
 * peso: desempate quando duas intenções casam.
 */
export const INTENCOES = Object.freeze([
  {
    id: "estoque.registrar_perda", tipo: "acao", acao: "stock.registerLoss", agentes: ["estoque"],
    descricao: "Registrar perda/descarte de um produto do estoque (ex.: 'perdi 2 kg de picanha', 'lança perda de 500 g de camarão').",
    frases: [["perdi", "perdemos", "lanca perda", "lancar perda", "registra perda", "registrar perda", "registre perda", "registre uma perda", "lance perda", "lance uma perda", "da perda", "dar perda", "joguei fora", "jogamos fora", "descartei", "descartamos", "estragou", "estragaram", "venceu e joguei"]],
    proibidas: ["quanto", "quais", "qual", "quantas"], peso: 10,
  },
  {
    id: "empresa.resumo_dia", tipo: "pergunta", agentes: ["operacoes", "vendas", "financeiro", "estoque"],
    descricao: "Resumo de como foi/está a empresa hoje (faturamento, alertas, contas, estoque).",
    frases: [["como foi", "como esta", "como estamos", "resumo", "o que precisa", "merece minha atencao", "situacao"], ["empresa", "restaurante", "loja", "hoje", "dia", "casa", "minha atencao", "operacao"]], peso: 4,
  },
  {
    id: "vendas.faturamento", tipo: "pergunta", agentes: ["vendas"],
    descricao: "Quanto vendeu/faturou em um período (hoje, ontem, semana, mês).",
    frases: [["vendi", "vendemos", "vendeu", "faturei", "faturamos", "faturou", "faturamento", "vendas", "receita"]], peso: 5,
  },
  {
    id: "vendas.ticket_medio", tipo: "pergunta", agentes: ["vendas"],
    descricao: "Ticket médio das vendas.",
    frases: [["ticket", "tiquete"]], peso: 8,
  },
  {
    id: "compras.total", tipo: "pergunta", agentes: ["compras"],
    descricao: "Quanto comprou em um período, ou compras de um produto.",
    frases: [["comprei", "compramos", "comprou", "compras", "gastei com compra", "gastos com compra"]], proibidas: ["preco", "precos", "caro", "cara", "caros", "aumento", "aumentaram", "subiu"], peso: 5,
  },
  {
    id: "compras.maior_aumento_preco", tipo: "pergunta", agentes: ["compras"],
    descricao: "Quais produtos tiveram maior aumento (ou queda) de preço de compra.",
    frases: [["preco", "precos", "mais caro", "mais cara", "encareceu", "encareceram", "mais aumentaram", "que aumentaram"], ["aumento", "aumentaram", "aumentou", "subiu", "subiram", "maior", "mais caro", "mais cara", "encareceu", "encareceram", "variacao"]], peso: 7,
  },
  {
    id: "estoque.vencimentos", tipo: "pergunta", agentes: ["estoque"],
    descricao: "Produtos vencidos ou próximos do vencimento.",
    frases: [["vencimento", "vencendo", "vencer", "vencidos", "vencido", "validade", "vence"]], proibidas: ["conta", "contas", "boleto", "boletos", "pagar"], peso: 6,
  },
  {
    id: "estoque.divergencias", tipo: "pergunta", agentes: ["estoque"],
    descricao: "Diferenças estranhas no estoque: contado × esperado, saldo × lotes, inconsistências.",
    frases: [["diferenca", "divergencia", "divergencias", "diferencas", "estranho", "estranha", "inconsistencia", "furo", "furos", "sumiu", "sumindo", "batendo"]], peso: 6,
  },
  {
    id: "estoque.perdas", tipo: "pergunta", agentes: ["estoque"],
    descricao: "Quanto perdeu/quais perdas foram registradas no período.",
    frases: [["quanto", "quais", "qual", "mostre", "mostra"], ["perdi", "perdemos", "perda", "perdas", "desperdicio"]], peso: 9,
  },
  {
    id: "estoque.saldo_produto", tipo: "pergunta", agentes: ["estoque"],
    descricao: "Quanto tem de um produto no estoque agora.",
    frases: [["quanto tenho", "quanto tem", "quanto temos", "quanto sobrou", "quanto resta", "saldo", "tenho de", "temos de"]], peso: 6,
  },
  {
    id: "estoque.abaixo_minimo", tipo: "pergunta", agentes: ["estoque"],
    descricao: "O que está acabando / abaixo do estoque mínimo.",
    frases: [["acabando", "abaixo do minimo", "estoque baixo", "faltando", "precisa comprar", "repor"]], peso: 6,
  },
  {
    id: "produto.explicar_variacao", tipo: "pergunta", agentes: ["compras", "estoque"],
    descricao: "Por que um produto aumentou/diminuiu (preço ou consumo) — usa o produto aberto na tela quando não é citado.",
    frases: [["por que", "porque", "pq"], ["aumentou", "subiu", "diminuiu", "caiu", "mudou"]], requerProduto: true, peso: 7,
  },
  {
    id: "financeiro.contas_a_vencer", tipo: "pergunta", agentes: ["financeiro"],
    descricao: "Contas a pagar vencidas ou que vencem nos próximos dias.",
    frases: [["conta", "contas", "boleto", "boletos", "pagar", "pagamentos"], ["vence", "vencem", "vencer", "vencidas", "vencida", "vencendo", "pagar", "atrasada", "atrasadas", "amanha", "proximos dias", "semana"]], peso: 7,
  },
  {
    id: "custos.cmv", tipo: "pergunta", agentes: ["financeiro"],
    descricao: "Como está o CMV (custo da mercadoria vendida).",
    frases: [["cmv", "custo da mercadoria", "custo de mercadoria"]], proibidas: ["por que", "porque", "pq"], peso: 6,
  },
  {
    id: "custos.por_que_cmv", tipo: "pergunta", agentes: ["financeiro", "compras", "estoque"],
    descricao: "Por que o CMV subiu/mudou — decomposição com compras, estoque, faturamento.",
    frases: [["por que", "porque", "pq", "motivo"], ["cmv", "custo da mercadoria"]], peso: 8,
  },
  {
    id: "custos.cmo", tipo: "pergunta", agentes: ["rh"],
    descricao: "Como está o CMO (custo de mão de obra / folha).",
    frases: [["cmo", "mao de obra", "custo de pessoal", "folha"]], peso: 6,
  },
  {
    id: "rh.hora_extra", tipo: "pergunta", agentes: ["rh"],
    descricao: "Hora extra por funcionário.",
    frases: [["hora extra", "horas extras", "hora-extra", "horas extra"]], peso: 8,
  },
  {
    id: "financeiro.lucro", tipo: "pergunta", agentes: ["financeiro"],
    descricao: "Lucro / resultado do período, ou quanto faturar para um lucro-alvo.",
    frases: [["lucro", "resultado", "margem"]], peso: 5,
  },
  {
    id: "compras.criar", tipo: "acao", acao: "purchase.create", agentes: ["compras"],
    descricao: "Criar uma compra/pedido de compra (ex.: 'crie uma compra de 5 kg de filé').",
    frases: [["crie uma compra", "criar compra", "criar uma compra", "cria uma compra", "faca uma compra", "nova compra", "crie um pedido", "fazer pedido", "faz um pedido", "lanca uma compra", "lance uma compra"]], peso: 10,
  },
  {
    id: "navegar", tipo: "navegacao", agentes: [],
    descricao: "Abrir uma tela do ERP (estoque, compras, contas, CMV, fichas, validade…).",
    // Só vale com um destino reconhecido (DESTINOS) — senão cai para outra intenção.
    frases: [["abra", "abre", "abrir", "ir para", "va para", "mostre a tela", "me leva", "leve me", "mostre minhas", "mostrar minhas", "ver minhas", "mostre meus", "ver meus"]], requerDestino: true, peso: 11,
  },
]);

export const IDS_INTENCAO = Object.freeze([...INTENCOES.map((i) => i.id), "desconhecido"]);
export const intencaoPorId = (id) => INTENCOES.find((i) => i.id === id) || null;

/** Esquema da interpretação — o MESMO para regras e IA. */
export const interpretacaoSchema = s.object({
  intencao: s.enum(IDS_INTENCAO),
  periodo: s.opcional(s.enum(PERIODOS)),
  dias: s.opcional(s.number({ min: 1, max: 60, inteiro: true })),
  produto: s.opcional(s.string({ min: 1, max: 80 })),
  quantidade: s.opcional(s.number({ min: 0.001, max: 100000 })),
  unidade: s.opcional(s.enum(UNIDADES)),
  motivo: s.opcional(s.enum(MOTIVOS_PERDA)),
  destino: s.opcional(s.enum(Object.keys(DESTINOS))),
  confianca: s.enum(["alta", "media", "baixa"]),
});
