// Catálogo determinístico de HIPÓTESES, PERGUNTAS e RECOMENDAÇÕES por tipo de
// anomalia. Hipótese é hipótese: o texto da tela diz "Possível causa", nunca
// afirma causalidade. A ordem das hipóteses aprende com as respostas
// anteriores da própria unidade (memory/feedback).

export const OPCOES = Object.freeze({
  perda: "Perda",
  producao: "Produção",
  consumo_interno: "Consumo interno",
  evento: "Evento",
  transferencia: "Transferência",
  erro_contagem: "Erro de contagem",
  erro_ficha: "Erro de ficha técnica",
  compra_nao_lancada: "Compra não lançada",
  retirada_duplicada: "Retirada lançada duas vezes",
  devolucao: "Devolução",
  feriado: "Feriado / data especial",
  clima: "Clima / movimento fraco",
  lancamento_incompleto: "Lançamento incompleto",
  problema_operacional: "Problema na operação",
  reajuste: "Reajuste do fornecedor",
  troca_fornecedor: "Troca de fornecedor",
  produto_diferente: "Produto diferente (marca/corte)",
  ja_paga: "Já foi paga",
  vai_pagar: "Vou pagar",
  renegociada: "Renegociada",
  nao_sei: "Não sei",
});

const op = (...ids) => ids.map((id) => ({ id, rotulo: OPCOES[id] }));

export const CATALOGO = Object.freeze({
  contagem_falta: {
    causas: [
      ["perda", "Perda não registrada"], ["producao", "Produção ou pré-preparo não registrado"], ["erro_ficha", "Ficha técnica com quantidade errada"],
      ["consumo_interno", "Consumo interno (refeição da equipe)"], ["evento", "Uso em evento"], ["transferencia", "Transferência não lançada"], ["erro_contagem", "Erro de contagem"],
    ],
    pergunta: "O que ocorreu com aproximadamente {quantidade} de {produto}?",
    opcoes: op("perda", "producao", "consumo_interno", "evento", "transferencia", "erro_contagem", "nao_sei"),
    recomendacao: "Confirme o que aconteceu: se foi perda, registre-a; se foi erro de contagem, recontar antes do próximo fechamento.",
  },
  contagem_sobra: {
    causas: [["compra_nao_lancada", "Entrada de compra não lançada"], ["erro_contagem", "Erro de contagem"], ["retirada_duplicada", "Retirada lançada em duplicidade"], ["devolucao", "Devolução não registrada"]],
    pergunta: "De onde veio a sobra de {quantidade} de {produto}?",
    opcoes: op("compra_nao_lancada", "erro_contagem", "retirada_duplicada", "devolucao", "nao_sei"),
    recomendacao: "Confira as entradas do período: compra recebida e não lançada distorce custo médio e CMV.",
  },
  faturamento_queda: {
    causas: [["clima", "Movimento menor (clima, feriado, concorrência)"], ["lancamento_incompleto", "Faturamento do dia lançado incompleto"], ["problema_operacional", "Problema na operação (falta de produto, equipe)"], ["feriado", "Feriado ou data atípica"]],
    pergunta: "Algo diferente aconteceu nesse dia?",
    opcoes: op("feriado", "clima", "lancamento_incompleto", "problema_operacional", "nao_sei"),
    recomendacao: "Confira se o lançamento do dia está completo (cancelamentos e descontos inclusive) antes de tirar conclusões.",
  },
  faturamento_alta: {
    causas: [["evento", "Evento ou data comemorativa"], ["lancamento_incompleto", "Lançamento somando mais de um dia"]],
    recomendacao: "Se foi um movimento real, vale entender o que trouxe o público e repetir.",
  },
  preco_alta: {
    causas: [["reajuste", "Reajuste do fornecedor"], ["troca_fornecedor", "Troca de fornecedor"], ["produto_diferente", "Produto diferente (marca, corte, embalagem)"]],
    pergunta: "Por que o preço de {produto} subiu?",
    opcoes: op("reajuste", "troca_fornecedor", "produto_diferente", "nao_sei"),
    recomendacao: "Cote com outros fornecedores e revise o preço das fichas técnicas que usam {produto}.",
  },
  preco_queda: {
    causas: [["reajuste", "Redução de preço do fornecedor"], ["troca_fornecedor", "Fornecedor mais barato"]],
    recomendacao: "Se o preço se mantiver, avalie comprar mais respeitando validade e espaço de armazenamento.",
  },
  compras_alta: {
    causas: [["evento", "Preparação para evento"], ["reajuste", "Aumento de preços"], ["compra_nao_lancada", "Compras atrasadas lançadas juntas"]],
    recomendacao: "Confira se as compras desta semana estão casadas com a demanda prevista (eventos, reservas).",
  },
  perdas_alta: {
    causas: [["perda", "Produto vencendo antes do uso"], ["producao", "Produção acima da demanda"], ["lancamento_incompleto", "Perdas antigas lançadas juntas"]],
    recomendacao: "Revise as quantidades de produção e a rotação (FEFO) dos produtos com mais perda.",
  },
  produto_vencido: {
    causas: [],
    recomendacao: "Retire do estoque e registre a perda com motivo vencimento.",
  },
  produto_vencendo: {
    causas: [],
    recomendacao: "Use primeiro (FEFO): planeje produção, prato do dia ou promoção com esses itens.",
  },
  contas_vencidas: {
    causas: [["ja_paga", "Conta paga e não baixada no sistema"], ["vai_pagar", "Pagamento atrasado"]],
    pergunta: "Essas contas já foram pagas?",
    opcoes: op("ja_paga", "vai_pagar", "renegociada", "nao_sei"),
    recomendacao: "Pague ou renegocie; se já foi pago, registre o pagamento em Contas a Pagar para o fluxo de caixa ficar certo.",
  },
  contas_hoje: { causas: [], recomendacao: "Confirme o saldo disponível para os pagamentos de hoje." },
  cmv_alta: {
    causas: [],
    recomendacao: "Abra o detalhamento: compare compras, estoque final e faturamento contra o período anterior.",
  },
  estoque_abaixo_minimo: { causas: [], recomendacao: "Inclua esses itens na próxima compra." },
  saldo_lotes_divergente: { causas: [], recomendacao: "O próximo lançamento desse produto sincroniza saldo e lotes; se persistir, avise o suporte." },
  faturamento_dias_faltando: { causas: [], recomendacao: "Lance o faturamento desses dias: sem eles, CMV % e DRE do período ficam sem apuração." },
});
