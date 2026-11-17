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

// "vamos montar 3 marmitas" (montagem de várias marmitas pelo Jhon, 17/11/2026)
const NUMEROS_LOTE = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "duas", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

export const PERIODOS = Object.freeze(["hoje", "ontem", "semana", "semana_passada", "ultimos_7_dias", "mes", "mes_passado", "ultimos_30_dias"]);
export const UNIDADES = Object.freeze(["kg", "g", "l", "ml", "un"]);
export const MOTIVOS_PERDA = Object.freeze(["limpeza", "validade", "erro_producao", "dano", "outro"]);

export const DESTINOS = Object.freeze({
  estoque: { rota: "/dashboard/operacao/estoque", rotulo: "Estoque" },
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
    id: "estoque.registrar_entrada", tipo: "acao", acao: "stock.registerEntry", agentes: ["estoque"],
    descricao: "Dar entrada de um produto no estoque (ex.: 'dei entrada de 10 kg de batata', 'chegaram 3 caixas de coca', 'produzi 5 kg de molho').",
    frases: [["dei entrada", "dar entrada", "da entrada", "de entrada", "lanca entrada", "lancar entrada", "registra entrada", "registrar entrada", "registre entrada", "lance entrada", "lance uma entrada", "entrada de", "chegou", "chegaram", "recebi", "recebemos", "produzi", "produzimos", "poe no estoque", "por no estoque", "coloca no estoque", "colocar no estoque", "coloque no estoque", "adiciona no estoque", "adicionar no estoque", "adicione no estoque", "bota no estoque", "botar no estoque",
      // "Adicione 3 kg de picanha, 4 kg de xarope" (Assistente Héfisto): verbo sozinho também vale
      "adicione", "adiciona", "adicionar", "acrescente", "acrescenta", "coloque", "coloca", "bota", "bote", "ponha", "poe", "entrou", "entraram", "veio", "vieram"]],
    // receita/ficha é o fluxo da ficha técnica; "era pra pedir" é conferência de recebimento
    proibidas: ["quanto", "quais", "qual", "quantas", "quando", "receita", "ficha", "prato", "era pra", "era para", "pedi", "pedido", "pedimos",
      "etiqueta", "etiquetas", "nota fiscal", "danfe", "nfe", "xml", "a nota", "nota do fornecedor",
      "horario", "atrasado", "atrasados", "atrasada", "atrasou", "funcionario", "funcionarios", "equipe", "pontual", "ponto",
      // "chegou o fechamento, o que eu tenho que fazer?" é rotina, não entrada de estoque (14/11/2026)
      "fechamento", "abertura", "tenho que fazer", "que eu faco", "faco agora"], peso: 10,
  },
  {
    id: "empresa.resumo_dia", tipo: "pergunta", agentes: ["operacoes", "vendas", "financeiro", "estoque"],
    descricao: "Resumo de como foi/está a empresa hoje (faturamento, alertas, contas, estoque).",
    frases: [["como foi", "como esta", "como estamos", "resumo", "o que precisa", "merece minha atencao", "situacao"], ["empresa", "restaurante", "loja", "hoje", "dia", "casa", "minha atencao", "operacao"]], peso: 4,
  },
  {
    id: "empresa.problemas", tipo: "pergunta", agentes: ["operacoes", "vendas", "financeiro", "estoque"],
    descricao: "O que está errado/fora do padrão agora (ex.: 'tem alguma coisa errada?', 'algum problema?'): só os alertas que merecem atenção.",
    frases: [["errado", "errada", "errados", "erradas", "problema", "problemas", "anormal", "preocupar", "preocupante", "alerta", "alertas", "fora do normal", "fora do padrao"]], peso: 5,
  },
  {
    id: "conversa.por_que", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "'Por quê?' sobre o que acabou de ser dito ou sobre o registro aberto na tela (ex.: 'por que?', 'explica', 'por que aumentou?' olhando um produto).",
    frases: [["por que", "porque", "pq", "por qual motivo", "explica", "explique", "como assim", "qual o motivo", "qual motivo"]], peso: 1,
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
    id: "compras.ultimo_preco", tipo: "pergunta", agentes: ["compras"],
    descricao: "Quanto pagou num produto na última compra (ex.: 'quanto paguei na picanha da última vez?', 'qual o preço da última compra de óleo?').",
    frases: [["ultima vez", "ultima compra", "quanto paguei", "paguei no", "paguei na", "paguei o", "paguei a", "comprei por", "preco da ultima"]], peso: 9,
  },
  {
    id: "compras.maior_aumento_preco", tipo: "pergunta", agentes: ["compras"],
    descricao: "Quais produtos tiveram maior aumento (ou queda) de preço de compra.",
    frases: [["preco", "precos", "mais caro", "mais cara", "encareceu", "encareceram", "mais aumentaram", "que aumentaram"], ["aumento", "aumentaram", "aumentou", "subiu", "subiram", "maior", "mais caro", "mais cara", "encareceu", "encareceram", "variacao"]],
    // "por que o preço da picanha subiu?" é explicação de UM produto
    proibidas: ["por que", "porque", "pq"], peso: 7,
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
    frases: [["quanto tenho", "quanto tem", "quanto temos", "quanto e que eu tenho", "quanto e que tem", "quanto e que temos", "quanto eu tenho", "quanto que eu tenho", "quanto que tem", "quanto que temos", "quanto ainda tenho", "quanto ainda tem", "quanto sobrou", "quanto resta", "saldo", "tenho de", "temos de"]], peso: 6,
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
    id: "fichas.preparo", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Ficha técnica de um prato ou drink: ingredientes, quantidades e modo de preparo (ex.: 'como faz o vatapá?', 'ficha do risoto', 'ingredientes da caipirinha').",
    frases: [["como faz", "como fazer", "como se faz", "como faco", "como prepara", "como preparar", "modo de preparo", "receita do", "receita da", "receita de", "ficha do", "ficha da", "ficha de", "ficha tecnica", "ingredientes do", "ingredientes da", "o que vai no", "o que vai na", "preparo do", "preparo da",
      "como monta", "como montar", "como se monta", "como monto", "montagem do", "montagem da", "montagem de", "como serve", "como servir", "passo a passo",
      // "eu quero fazer um vatapá" (funcionário que vai preparar agora)
      "quero fazer", "vou fazer", "preciso fazer", "quero preparar", "vou preparar", "preciso preparar", "preparar o", "preparar a", "preparar um", "preparar uma"]],
    proibidas: ["compra", "pedido", "entrada", "contagem", "inventario", "perda", "transferencia", "etiqueta", "receita nova", "nova receita", "ficha nova", "nova ficha", "montar uma receita", "pagamento", "conta"], peso: 6,
  },
  {
    id: "fichas.onde_vai", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Em quais pratos, drinks e receitas base vai um ingrediente (ex.: 'onde vai leite de coco?', 'quais pratos levam camarão?').",
    frases: [["onde vai", "onde usa", "onde uso", "onde entra", "quais pratos levam", "quais pratos usam", "que pratos levam", "que pratos usam", "quais receitas levam", "quais receitas usam", "quais drinks levam", "quais drinks usam", "em que prato vai", "em quais pratos", "o que leva", "pratos que levam", "pratos com"]], peso: 8,
  },
  {
    id: "fichas.listar", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Lista de fichas para escolher com um toque: receitas da cozinha, drinks do bar, receitas base (ex.: 'receitas da cozinha', 'drinks do bar', 'bases do bar').",
    frases: [["receitas da cozinha", "pratos da cozinha", "drinks do bar", "drinques do bar", "bebidas do bar", "bases do bar", "bases da cozinha", "receitas base", "lista de receitas", "lista de drinks", "quais receitas", "quais drinks", "todas as receitas", "todos os drinks", "xaropes do bar"]], peso: 9,
  },
  {
    id: "assistente.menu", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Atalhos clicáveis por área (cozinha, bar, salão, estoque): o que o assistente faz em cada uma.",
    frases: [["atalhos da cozinha", "atalhos do bar", "atalhos do salao", "atalhos do estoque", "atalhos", "menu do assistente", "o que voce faz", "o que voce sabe fazer", "como voce ajuda", "me ajuda", "ajuda"]], peso: 5,
  },
  {
    id: "salao.orientacao", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Procedimento da casa: situação ou montagem no salão, abertura e fechamento, limpeza (chapa, fogão, piso) e uso de equipamento (voltagem, higienização, onde fica): passo a passo com fotos e vídeos.",
    frases: [["situacao no salao", "montagem no salao", "montar a mesa", "montar uma mesa", "monto a mesa", "montar o salao", "montar o jardim", "montar a varanda", "montar o ambiente", "como resolvo", "como eu resolvo", "o que eu faco", "o que faco agora",
      // 14/11/2026: rotina, limpeza e equipamento (procedimentos da casa com foto e vídeo)
      "procedimento da casa", "fechamento do restaurante", "fechamento da cozinha", "fechamento do bar", "fechamento do salao", "chegou o fechamento", "hora do fechamento", "fazer o fechamento",
      "fechar o restaurante", "fechar a cozinha", "abertura da cozinha", "abertura do restaurante", "abrir o restaurante", "abrir a cozinha", "cheguei na cozinha", "cheguei no bar",
      "o que eu tenho que fazer", "o que tenho que fazer", "como limpar", "como limpo", "como higienizar", "como higienizo", "como lavar", "como lavo",
      "como usar", "como usa", "como uso", "como ligar", "como ligo", "como manusear", "qual a voltagem", "e 110 ou 220", "e 220 ou 110"]], peso: 9,
    proibidas: ["caixa", "folha", "mes", "dre", "imposto"],
  },
  {
    id: "rh.escala_dia", tipo: "pergunta", agentes: ["rh"],
    descricao: "Escala do dia: quem trabalha hoje (ou amanhã), em que horário e quem está de folga.",
    frases: [["escala", "quem trabalha", "quem esta trabalhando", "quem vem", "quem entra", "quem esta de folga", "quem folga", "de folga hoje", "turno de hoje", "equipe de hoje", "equipe hoje"]], peso: 7,
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
  // ── Assistente Héfisto ──
  {
    id: "compras.conferir_recebimento", tipo: "pergunta", agentes: ["compras"], usaQuantidade: true,
    descricao: "Conferir o que chegou contra o que foi pedido (ex.: 'chegou 3 kg de picanha, só que era para pedir 2').",
    frases: [["chegou", "chegaram", "veio", "vieram", "recebi", "recebemos", "entregaram", "entregou"], ["era pra", "era para", "pedi", "pedido", "pedimos", "encomendei", "encomendamos", "a mais", "a menos", "sobrou", "faltou"]], peso: 12,
  },
  {
    id: "rh.pontualidade", tipo: "pergunta", agentes: ["rh"],
    descricao: "Se a equipe chegou no horário combinado hoje: quem atrasou (minutos), quem ainda não chegou (ex.: 'meus funcionários chegaram no horário?').",
    frases: [["funcionario", "funcionarios", "equipe", "pessoal", "galera", "colaborador", "colaboradores", "quem", "alguem", "todo mundo", "todos", "ninguem", "pontualidade", "ponto de hoje"],
      ["chegou", "chegaram", "atrasado", "atrasados", "atrasada", "atrasadas", "atrasou", "atrasaram", "atraso", "atrasos", "pontual", "pontuais", "pontualidade", "no horario", "bateu o ponto", "bateram o ponto", "bateu ponto", "bateram ponto", "faltou", "faltaram", "ponto de hoje"]],
    proibidas: ["kg", "gramas", "quilos", "litros", "pedido", "era pra", "era para"], peso: 9,
  },
  {
    id: "fichas.custo_quantidade", tipo: "pergunta", agentes: ["operacoes"], usaQuantidade: true,
    descricao: "Custo de uma quantidade de uma receita/ficha (ex.: 'quanto custa 200 g do molho de tomate?', 'qual o valor de 200 gramas dessa receita?'); sem quantidade, o custo total.",
    frases: [["quanto custa", "quanto sai", "quanto fica", "quanto da", "qual o valor", "qual valor", "qual o custo", "qual custo", "qual e o custo", "qual e o valor", "custo de", "custo do", "custo da", "valor de"],
      ["g", "kg", "gramas", "grama", "ml", "l", "litro", "litros", "quilo", "quilos", "porcao", "porcoes", "receita", "ficha", "base", "prato"]],
    proibidas: ["paguei", "ultima vez", "ultima compra", "conta", "contas", "boleto"], peso: 9,
  },
  {
    id: "fichas.lucro_preco", tipo: "pergunta", agentes: ["operacoes"], usaQuantidade: true,
    descricao: "Lucro de um prato a um preço de venda (ex.: 'vou vender esse prato por 50 reais', 'se eu vender o risoto a 48, quanto lucro?').",
    frases: [["vender", "vendo", "vende", "vendendo", "cobrar", "cobro", "cobrando", "preco de venda"], ["por", "lucro", "margem", "reais", "a"]], peso: 9,
  },
  {
    id: "fichas.criar", tipo: "acao", acao: "recipe.create", agentes: ["operacoes"],
    descricao: "Montar uma ficha técnica conversando: receita/base ou prato, com ingredientes, rendimento, preço (ex.: 'vamos montar uma receita, o nome vai ser molho de tomate, vai tomate, sal, alho', 'montar um prato com essa base').",
    frases: [["montar uma receita", "montar receita", "monta uma receita", "criar uma receita", "criar receita", "cria uma receita", "nova receita", "nova ficha", "criar ficha", "criar uma ficha", "cria uma ficha", "cadastrar ficha", "cadastrar uma ficha", "cadastrar receita", "cadastrar uma receita", "montar uma ficha", "montar ficha", "montar um prato", "monta um prato", "montar o prato", "criar um prato", "criar prato", "cadastrar um prato", "novo prato", "fazer uma ficha", "fazer uma receita", "montar uma base", "criar uma base", "nova base"]],
    proibidas: ["como monta", "como montar", "como se monta", "como faz", "como fazer", "como se faz", "ficha tecnica de", "ficha tecnica do", "ficha tecnica da"], peso: 12,
  },
  // 16/11/2026: "Jhon, vamos montar uma marmita" (conversa: componentes, gramas, embalagem, app, preço, combo, montagem)
  {
    id: "marmitaria.criar", tipo: "acao", acao: "marmita.create", agentes: ["operacoes"],
    descricao: "Montar uma ou várias marmitas novas conversando com o Jhon (quantas, em qual unidade, nome de cada uma): componentes, gramas, ficha do que é feito aqui, embalagem, app, preço pela calculadora, combo e montagem (ex.: 'Jhon, vamos montar uma marmita', 'criar uma marmita nova').",
    frases: [["montar uma marmita", "monta uma marmita", "montar a marmita nova", "montar marmita nova", "criar uma marmita", "criar marmita", "cria uma marmita", "nova marmita", "marmita nova", "cadastrar uma marmita", "cadastrar marmita", "vamos montar uma marmita", "montar uma quentinha", "nova quentinha", "montar umas marmitas", "montar marmitas", "montar as marmitas", "montar algumas marmitas", "montar a marmita", "marmitas agora", ...NUMEROS_LOTE.flatMap((n) => [`montar ${n} marmitas`, `montar mais ${n} marmitas`, `fazer ${n} marmitas`])]],
    proibidas: ["como monta", "como montar", "como se monta", "guia"], peso: 15,
  },
  // 16/11/2026: raio-x do preço da marmita (quem leva quanto, componente mais caro)
  {
    id: "marmitaria.raio_x", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Raio-x do preço das marmitas: para onde vai cada real (ingredientes, embalagem, app, imposto, equipe, pró-labore, aluguel, energia), o lucro e o componente mais caro (ex.: 'como são nossas marmitas?', 'quem está ganhando quanto na marmita de frango?', 'qual o componente mais caro da marmita?').",
    frases: [["marmita", "marmitas", "quentinha", "quentinhas"], ["raio x", "raio-x", "ganhando quanto", "quem ganha", "quem esta ganhando", "quanto sobra", "quanto ta sobrando", "quanto esta sobrando", "sobrando", "lucro", "lucrando", "componente mais caro", "mais caro", "mais cara", "quanto custa", "custo da", "custo de", "custo do", "como sao nossas", "como estao nossas", "como esta a", "como ta a", "margem", "pra onde vai", "para onde vai", "reajustar", "tirando"]],
    proibidas: ["montar", "monta", "como monta", "como montar", "cadastrar", "criar", "vender hoje", "produzir"], peso: 12,
  },
  {
    id: "marmitaria.montagem", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Guia de montagem de uma marmita: o que vai, quanto (g/un/ml), embalagens e o passo a passo (ex.: 'Nico, como monta a marmita de frango?', 'montagem da marmita de carne').",
    frases: [["marmita", "marmitas", "quentinha"], ["como monta", "como montar", "como se monta", "como monto", "montagem", "guia", "o que vai na", "o que vai no", "quanto vai", "quantas gramas", "passo a passo"]],
    proibidas: ["vamos montar", "montar uma", "montar a ficha", "criar", "cadastrar", "lucro", "mais caro", "ganhando"], peso: 10,
  },
  // 17/11/2026 (HDEV-015): produção do dia pelo Jhon — conta pelas fichas e programa o plano
  {
    id: "marmitaria.producao_planejar", tipo: "acao", acao: "production.plan", agentes: ["operacoes"],
    descricao: "Planejar a produção de um dia pelas fichas: quanto de cada ingrediente, o que fabricar antes (molho), a limpeza com os materiais e o que falta comprar; confirma e vira o plano do dia (ex.: 'Jhon, amanhã precisamos produzir 300 filés de frango empanado, 150 vão ser parmegianas', 'amanhã é dia de limpar as fritadeiras').",
    frases: [["produzir", "vamos produzir", "precisamos produzir", "precisa produzir", "temos que produzir", "tem que produzir", "fabricar", "vamos fabricar", "limpar as", "limpar a", "limpar o", "limpar os", "dia de limpar", "dia de limpeza"]],
    proibidas: ["quanto tenho", "quanto eu tenho", "quanto temos", "quanto custa", "como faz", "como fazer", "como se faz", "comprei", "marmita nova", "montar uma marmita"], peso: 13,
  },
  {
    id: "marmitaria.comparar_apps", tipo: "pergunta", agentes: ["financeiro"],
    descricao: "Comparar os apps de delivery (iFood, 99Food, Rappi, balcão…): quanto cada marmita deixa de lucro em cada app e qual app é melhor (ex.: 'qual app dá mais lucro?', 'compare os apps', 'vale mais vender no iFood ou no 99?').",
    frases: [["app", "apps", "aplicativo", "aplicativos", "ifood", "99food", "99", "rappi", "keeta", "aiqfome", "plataforma", "plataformas"], ["compara", "comparar", "compare", "comparativo", "comparacao", "qual app", "qual aplicativo", "qual plataforma", "melhor app", "vale mais", "da mais lucro", "mais lucro", "ou no"]],
    proibidas: ["concorrente", "concorrentes", "concorrencia", "cardapio da", "cardapio do"], peso: 12,
  },
  {
    id: "marmitaria.estoque_pronto", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Quanto tem pronto no estoque da marmitaria (empanado, molho, batata porcionada e não porcionada) e, para o que é produzido aqui, quantas marmitas dá e quanto rende vendendo (ESTIMATIVA).",
    frases: [["quanto tenho", "quanto eu tenho", "quanto temos", "quanto tem", "quanto que eu tenho", "quanto e que eu tenho", "mostra quanto", "me mostra quanto", "mostra para mim quanto", "mostra pra mim quanto"], ["pronto", "prontos", "pronta", "prontas", "porcionada", "porcionado", "porcionadas", "porcionados", "vender", "ganhar", "lucro", "produzido", "produzidos", "empanado", "empanados", "empanada", "empanadas"]],
    proibidas: ["produzir", "fabricar"], peso: 9,
  },
  // 17/11/2026: cardápios dos concorrentes do delivery (o Jhon lê o print, guarda e compara)
  {
    id: "marmitaria.concorrente_ler", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Mandar os prints do cardápio de um concorrente do delivery para o Jhon ler e guardar (ex.: 'Jhon, vou te mandar o cardápio de um concorrente', 'lê esse cardápio do concorrente').",
    frases: [["concorrente", "concorrentes", "concorrencia"], ["mandar", "mando", "vou mandar", "te mandar", "enviar", "envio", "vou enviar", "ler", "le", "leia", "le esse", "analisar", "analisa", "analise", "guardar", "guarda", "salvar", "salva", "cadastrar", "cadastra", "print", "prints", "foto", "fotos"]],
    proibidas: ["compara", "comparar", "compare", "comparando", "comparacao", "versus", "contra"], peso: 14,
  },
  {
    id: "marmitaria.concorrentes", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Comparar o cardápio guardado dos concorrentes do delivery com as nossas marmitas e adicionais: o que vem em cada prato, preço, preço por 100 g e adicionais que eles têm e nós não (ex.: 'compare o cardápio da Marmitaria X com as nossas', 'estamos mais caros que os concorrentes?', 'quais adicionais os concorrentes oferecem?').",
    frases: [["concorrente", "concorrentes", "concorrencia", "compare o cardapio", "comparar o cardapio", "compara o cardapio", "compare os cardapios", "comparar os cardapios"], ["compara", "comparar", "compare", "comparando", "comparacao", "versus", "contra", "mais caro", "mais cara", "mais caros", "mais caras", "mais barato", "mais barata", "mais baratos", "mais baratas", "preco", "precos", "adicional", "adicionais", "cardapio", "cardapios", "o que vem", "como estamos", "como esta", "quanto cobra", "quanto cobram"]],
    proibidas: ["vou mandar", "te mandar", "vou enviar", "mandar o cardapio", "print", "prints", "foto", "fotos"], peso: 13,
  },
  {
    id: "marmitaria.organizador", tipo: "pergunta", agentes: ["operacoes"],
    descricao: "Organizar a vitrine do app de entrega no Organizador de plataforma (categoria, foto, nome, descrição, preço e preço com cupom) e ver o que falta (ex.: 'Jhon, vamos organizar a nossa tela', 'monta a tela do iFood', 'o que falta na nossa vitrine?').",
    frases: [["organizar a tela", "organizar a nossa tela", "organizar nossa tela", "organizar a plataforma", "organizador", "simulador de tela", "nossa vitrine", "a vitrine", "tela do ifood", "tela do app", "tela da plataforma", "montar a tela", "monta a tela", "organizar o ifood", "organizar o cardapio do app"]],
    proibidas: ["concorrente", "concorrentes"], peso: 14,
  },
  // 14/11/2026: lista de compras pelo Jhon e "comprei tudo, faltou isso"
  {
    id: "compras.lista_comprei", tipo: "pergunta", agentes: ["compras"],
    descricao: "Conferir a compra contra a lista salva: o que veio e o que faltou (ex.: 'comprei tudo, faltou o tomate', 'comprei só o arroz').",
    frases: [["comprei tudo", "comprei so", "comprei apenas", "comprei somente", "acabei de comprar", "ja comprei", "fiz as compras", "fiz a compra", "voltei das compras", "voltei do mercado", "voltei do atacado"]], peso: 13,
  },
  {
    id: "compras.lista_montar", tipo: "pergunta", agentes: ["compras"],
    descricao: "Montar a lista de compras para mandar no WhatsApp de quem compra (ex.: 'minha lista de compras para hoje é 10 kg de arroz, 5 kg de feijão').",
    frases: [["lista de compras", "lista de compra", "preciso comprar", "tem que comprar", "temos que comprar", "precisamos comprar", "montar a lista", "monta a lista"]],
    proibidas: ["comprei", "faltou", "abrir", "abre", "tela"], peso: 11,
  },
  {
    id: "compras.foto_nota", tipo: "pergunta", agentes: ["compras"],
    descricao: "Lançar uma compra pela foto da nota fiscal/DANFE ou pelo XML da NF-e (ex.: 'quero lançar uma nota', 'vou mandar a foto da danfe', 'chegou a nota do fornecedor', 'tenho o XML').",
    frases: [["danfe", "foto da nota", "lancar nota", "lancar a nota", "lancar uma nota", "nota fiscal da compra", "foto da danfe", "mandar a nota", "mandar foto da nota", "ler a nota",
      "nota fiscal", "nfe", "nf e", "xml da nota", "xml", "nota pra lancar", "nota para lancar", "chegou a nota", "chegou nota", "nota do fornecedor",
      "lancar compra", "lancar a compra", "lanca a compra", "lance a compra", "registrar compra", "registrar a compra", "registra a compra", "registre a compra"]],
    proibidas: ["quanto", "quantas", "quais"], peso: 11,
  },
  {
    id: "etiquetas.imprimir", tipo: "pergunta", agentes: ["estoque"],
    descricao: "Imprimir/gerar etiquetas de produtos e preparos (ex.: 'quero 20 etiquetas de maniçoba e 30 de jambu', 'imprime 5 etiquetas de alho'): monta a fila e abre a tela de Etiquetas.",
    frases: [["etiqueta", "etiquetas"]],
    // "quantas etiquetas vencem?" é pergunta de validade (estoque.vencimentos)
    proibidas: ["quantas", "quais", "vencidas", "vencida", "vencendo", "vencer", "vence", "vencem", "validade", "ativas", "ativa"], peso: 13,
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
