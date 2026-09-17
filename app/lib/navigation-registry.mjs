// Navigation Registry do Héfisto ERP.
// Fonte única de verdade de metadados para busca universal, Command Center e catálogo.

import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";

export const NAVIGATION_REGISTRY = [
  // --- INÍCIO & VISÃO GERAL ---
  {
    id: "dash-home",
    title: "Central de Comando",
    shortTitle: "Início",
    description: "Visão geral e itens operacionais que pedem atenção",
    route: "/dashboard",
    domain: "Operação",
    section: "Início",
    icon: "Home",
    keywords: ["inicio", "home", "dashboard", "visao geral", "resumo", "alerta", "tarefa"],
    synonyms: ["painel principal", "tela inicial", "boas vindas"],
    permission: "dashboard.overview.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "dash-inteligente",
    title: "Central Operacional Inteligente",
    shortTitle: "Central Operacional",
    description: "Monitoramento em tempo real de toda a operação",
    route: "/dashboard/operacao/inteligente",
    domain: "Operação",
    section: "Início",
    icon: "BarChart",
    keywords: ["inteligente", "monitoramento", "central", "operacional", "tv", "processos"],
    synonyms: ["painel da cozinha", "cockpit", "acompanhamento"],
    permission: "gestao.operational_center.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },

  // --- OPERAÇÃO & COZINHA & BAR ---
  {
    id: "op-etiquetas",
    title: "Impressão de Etiquetas",
    shortTitle: "Etiquetas",
    description: "Geração e impressão TSPL/WebUSB de etiquetas de validade",
    route: "/dashboard/operacao/etiquetas",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "Tag",
    keywords: ["etiqueta", "etiquetas", "imprimir", "impressora", "validade", "producao", "mdk022", "tspl", "lote", "rotulo", "acai"],
    synonyms: ["imprimir validade", "etiquetar produto", "rotulagem", "etiquetadora"],
    permission: "estoque.labels.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-etiquetas-tablet",
    title: "Impressão de Etiquetas (Tablet)",
    shortTitle: "Etiquetas Tablet",
    description: "Interface simplificada para impressão rápida na cozinha",
    route: "/dashboard/operacao/etiquetas/tablet",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "Tag",
    keywords: ["etiqueta", "tablet", "cozinha", "rapida", "touch"],
    synonyms: ["etiqueta cozinha", "etiquetas rapidas"],
    permission: "estoque.labels.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-producao",
    title: "Produção do Dia",
    shortTitle: "Produção",
    description: "Lançamento e controle das tarefas diárias de pré-preparo",
    route: "/dashboard/operacao/producao?dept=cozinha",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "ChefHat",
    keywords: ["producao", "cozinha", "preparo", "prato", "lote", "dia", "molho"],
    synonyms: ["producao do dia", "fazer preparo", "lista de producao"],
    permission: "cozinha.production.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-producao-bar",
    title: "Produção do Dia (Bar)",
    shortTitle: "Produção Bar",
    description: "Pré-preparos de xaropes, pré-misturas e insumos de bar",
    route: "/dashboard/operacao/producao?dept=bar",
    domain: "Operação",
    section: "Bar & Bebidas",
    icon: "GlassWater",
    keywords: ["bar", "drinks", "xarope", "preparo", "bebida", "producao bar"],
    synonyms: ["preparo de bebidas", "producao de bar"],
    permission: "bar.production.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-fichas-cozinha",
    title: "Fichas Técnicas (Cozinha)",
    shortTitle: "Fichas Técnicas",
    description: "Receituário padronizado, rendimentos e custos de pratos",
    route: "/dashboard/operacao/fichas?dept=cozinha",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "ClipboardList",
    keywords: ["ficha", "fichas", "tecnica", "receita", "ingrediente", "custo", "rendimento", "prato", "modo de preparo"],
    synonyms: ["receita de cozinha", "fichas tecnicas", "modo de fazer"],
    permission: "fichas.recipes.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-fichas-bar",
    title: "Fichas de Drinks (Bar)",
    shortTitle: "Fichas de Drinks",
    description: "Receitas de coquetéis, dosagens e custos de bebidas",
    route: "/dashboard/operacao/fichas?dept=bar",
    domain: "Operação",
    section: "Bar & Bebidas",
    icon: "GlassWater",
    keywords: ["drink", "drinks", "coquetel", "coquetéis", "bebidas", "bar", "receita bar", "dosagem"],
    synonyms: ["receita de drink", "ficha de drink", "cocktails"],
    permission: "bar.recipes.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-montagem",
    title: "Guia de Montagem de Pratos",
    shortTitle: "Guia de Montagem",
    description: "Fotos e passo a passo de empratamento para equipe de cozinha",
    route: "/dashboard/operacao/montagem?dept=cozinha",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "ChefHat",
    keywords: ["montagem", "empratamento", "foto", "guia", "padrao", "servir"],
    synonyms: ["como montar o prato", "foto do prato", "guia de empratamento"],
    permission: "cozinha.assembly.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-kds",
    title: "KDS — Telão da Cozinha",
    shortTitle: "KDS Cozinha",
    description: "Display de pedidos e tempos de preparo na cozinha",
    route: "/dashboard/cozinha/kds",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "ChefHat",
    keywords: ["kds", "pedidos", "cozinha", "telao", "comandas", "preparo", "tempo"],
    synonyms: ["monitor de pedidos", "tela da cozinha"],
    permission: "cozinha.kds.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-checklists",
    title: "Checklists & Rotinas",
    shortTitle: "Checklists",
    description: "Verificações de abertura, fechamento e higiene das áreas",
    route: "/dashboard/checklists",
    domain: "Operação",
    section: "Qualidade & Rotinas",
    icon: "CheckSquare",
    keywords: ["checklist", "checklists", "rotina", "limpeza", "abertura", "fechamento", "tarefa", "vistoria"],
    synonyms: ["verificacao diaria", "lista de checagem", "rotina de limpeza"],
    permission: "checklist.pick_area.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-controles",
    title: "Controles de Limpeza & Temperatura",
    shortTitle: "Controles Limpeza",
    description: "Aferição de geladeiras, registros sanitários e boas práticas",
    route: "/dashboard/operacao/controles",
    domain: "Operação",
    section: "Qualidade & Rotinas",
    icon: "ShieldCheck",
    keywords: ["limpeza", "temperatura", "sanitario", "geladeira", "freezer", "afericao", "anvisa"],
    synonyms: ["controle de geladeira", "afericao de temperatura", "controle sanitario"],
    permission: "cozinha.cleaning.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-validade",
    title: "Controle de Validade Geral",
    shortTitle: "Validades",
    description: "Painel de alertas de produtos e insumos próximos do vencimento",
    route: "/dashboard/operacao/validade",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "AlertTriangle",
    keywords: ["validade", "vencimento", "alerta", "estragar", "perda", "vencer"],
    synonyms: ["produtos a vencer", "alerta de validade"],
    permission: "cozinha.expiry.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-mesas",
    title: "Mesas & Atendimento",
    shortTitle: "Mesas",
    description: "Mapa de mesas, comandos e abertura de contas no salão",
    route: "/dashboard/salao/mesas",
    domain: "Operação",
    section: "Salão & Atendimento",
    icon: "Users",
    keywords: ["mesas", "comanda", "salao", "garcom", "atendimento", "conta", "ocupacao"],
    synonyms: ["mapa de mesas", "abrir mesa", "ver comandas"],
    permission: "salao.tables.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-orcamento",
    title: "Orçamento de Eventos",
    shortTitle: "Orçamento Eventos",
    description: "Simulação de custos e cardápios para reservas e eventos",
    route: "/dashboard/operacao/orcamento?dept=cozinha",
    domain: "Operação",
    section: "Eventos & Reservas",
    icon: "Calendar",
    keywords: ["orcamento", "evento", "festa", "reserva", "grupo", "proposta"],
    synonyms: ["cotacao de evento", "orcamento de festa"],
    permission: "eventos.budget.view",
    mobilePriority: 4,
    adminOnly: false,
    searchable: true,
  },

  // --- ESTOQUE & COMPRAS ---
  {
    id: "est-visao-geral",
    title: "Visão Geral do Estoque",
    shortTitle: "Estoque Geral",
    description: "Saldos, posição financeira, entradas e movimentações",
    route: "/dashboard/operacao/estoque",
    domain: "Estoque & Compras",
    section: "Estoque",
    icon: "Package",
    keywords: ["estoque", "saldo", "insumos", "produtos", "deposito", "quantidade", "curva abc", "baixo"],
    synonyms: ["estoque geral", "ver saldo", "posicao do estoque"],
    permission: "estoque.overview.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-modo-operacao",
    title: "Estoque (Modo Operação / Tablet)",
    shortTitle: "Estoque Operação",
    description: "Retirada e contagem simplificada de insumos para cozinha",
    route: "/dashboard/operacao/estoque/tablet",
    domain: "Estoque & Compras",
    section: "Estoque",
    icon: "Package",
    keywords: ["estoque", "tablet", "operacao", "baixa", "retirada", "cozinha"],
    synonyms: ["baixa de estoque", "retirar insumo", "saida rapida"],
    permission: "estoque.operation.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-ingredientes",
    title: "Cadastro de Ingredientes & Insumos",
    shortTitle: "Ingredientes",
    description: "Matérias-primas, unidades de medida, fatores de correção e custos",
    route: "/dashboard/operacao/ingredientes?dept=cozinha",
    domain: "Estoque & Compras",
    section: "Estoque",
    icon: "ShoppingBag",
    keywords: ["ingredientes", "insumos", "produtos", "materia prima", "fator de correcao", "unidade"],
    synonyms: ["cadastro de insumos", "lista de ingredientes"],
    permission: "estoque.products.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-compras",
    title: "Pedidos de Compras",
    shortTitle: "Compras",
    description: "Sugestões de pedido, cotação com fornecedores e aprovações",
    route: "/dashboard/operacao/compras?dept=cozinha",
    domain: "Estoque & Compras",
    section: "Compras",
    icon: "ShoppingCart",
    keywords: ["compras", "pedidos", "pedido", "cotacao", "comprar", "fornecedor", "reposicao"],
    synonyms: ["fazer compra", "compras do mes", "pedido de compra"],
    permission: "compras.orders.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-notas",
    title: "Entrada de Notas Fiscais",
    shortTitle: "Entrada NFe",
    description: "Importação de XML, conferencia de recebimento e atualização de estoque",
    route: "/dashboard/operacao/notas?dept=cozinha",
    domain: "Estoque & Compras",
    section: "Compras",
    icon: "FileText",
    keywords: ["nota", "notas", "nfe", "xml", "danfe", "entrada", "fornecedor", "recebimento"],
    synonyms: ["lancar nota", "importar xml", "entrada de nota"],
    permission: "compras.invoices.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-fornecedores",
    title: "Cadastro de Fornecedores",
    shortTitle: "Fornecedores",
    description: "Contatos, prazos de entrega, condições de pagamento e históricos",
    route: "/dashboard/operacao/fornecedores",
    domain: "Estoque & Compras",
    section: "Compras",
    icon: "Truck",
    keywords: ["fornecedor", "fornecedores", "contato", "cnpj", "distribuidor", "marca"],
    synonyms: ["lista de fornecedores", "contato de fornecedor"],
    permission: "estoque.suppliers.view",
    mobilePriority: 4,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-embalagens",
    title: "Gestão de Embalagens & Descartáveis",
    shortTitle: "Embalagens",
    description: "Estoque e consumo de caixas, copos, talheres e recipientes",
    route: "/dashboard/operacao/embalagens?dept=cozinha",
    domain: "Estoque & Compras",
    section: "Estoque",
    icon: "Box",
    keywords: ["embalagem", "embalagens", "descartavel", "copo", "sacola", "caixa"],
    synonyms: ["estoque de embalagens", "descartaveis"],
    permission: "cardapio.packaging.view",
    mobilePriority: 4,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-limpeza",
    title: "Produtos de Limpeza na Despensa",
    shortTitle: "Produtos Limpeza",
    description: "Estoque e consumo de detergente, sanitizantes e insumos de higiene",
    route: "/dashboard/operacao/limpeza",
    domain: "Estoque & Compras",
    section: "Estoque",
    icon: "Sparkles",
    keywords: ["limpeza", "despensa", "detergente", "quimico", "higiene", "sabao"],
    synonyms: ["produtos de higiene", "estoque de limpeza"],
    permission: "gestao.cleaning_supplies.view",
    mobilePriority: 4,
    adminOnly: false,
    searchable: true,
  },

  // --- RH & PESSOAS ---
  {
    id: "rh-painel",
    title: "Painel Geral de RH",
    shortTitle: "Painel RH",
    description: "Indicadores de equipe, turnover, presenças e ocorrências",
    route: "/dashboard/rh",
    domain: "RH & Pessoas",
    section: "Gestão de Pessoas",
    icon: "Users",
    keywords: ["rh", "recursos humanos", "equipe", "funcionarios", "colaboradores", "pessoas", "gestao"],
    synonyms: ["painel de pessoas", "modulo rh"],
    permission: "rh.overview.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "rh-gestao",
    title: "Gestão de Colaboradores",
    shortTitle: "Funcionários",
    description: "Cadastro de funcionários, documentos, cargos e salários",
    route: "/dashboard/rh/gestao",
    domain: "RH & Pessoas",
    section: "Gestão de Pessoas",
    icon: "UserCheck",
    keywords: ["funcionario", "funcionarios", "colaborador", "colaboradores", "cadastro", "cargo", "salario", "admissao"],
    synonyms: ["lista de funcionarios", "equipe", "colaborador"],
    permission: "rh.employees.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "rh-ponto",
    title: "Espelho / Registro de Ponto",
    shortTitle: "Espelho de Ponto",
    description: "Conferência de horários de entrada, almoço e saída da equipe",
    route: "/dashboard/rh/ponto",
    domain: "RH & Pessoas",
    section: "Ponto & Jornada",
    icon: "Clock",
    keywords: ["ponto", "bater ponto", "relatorio ponto", "espelho", "frequencia", "presenca", "atraso", "horario"],
    synonyms: ["registro de ponto", "batida de ponto", "folha de ponto"],
    permission: "ponto.clock.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "rh-ponto-kiosk",
    title: "Quiosque de Ponto Eletrônico",
    shortTitle: "Bater Ponto",
    description: "Tela para o colaborador registrar o ponto no estabelecimento",
    route: "/dashboard/ponto",
    domain: "RH & Pessoas",
    section: "Ponto & Jornada",
    icon: "Clock",
    keywords: ["bater ponto", "quiosque", "terminal", "ponto", "relatorio", "entrada", "saida"],
    synonyms: ["marcar ponto", "relatorio de ponto", "relógio de ponto"],
    permission: "ponto.kiosk.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "rh-ponto-corrigir",
    title: "Correção de Batidas de Ponto",
    shortTitle: "Corrigir Ponto",
    description: "Ajuste manual de esquecimentos ou erros de batida",
    route: "/dashboard/rh/ponto/corrigir",
    domain: "RH & Pessoas",
    section: "Ponto & Jornada",
    icon: "Edit3",
    keywords: ["corrigir", "ponto", "ajuste", "esqueceu", "batida", "justificativa"],
    synonyms: ["acerto de ponto", "ajustar ponto"],
    permission: "ponto.clock.edit",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "rh-banco-horas",
    title: "Banco de Horas & Extras",
    shortTitle: "Banco de Horas",
    description: "Saldo acumulado de horas extras, compensações e folgas",
    route: "/dashboard/rh/extra",
    domain: "RH & Pessoas",
    section: "Ponto & Jornada",
    icon: "Clock",
    keywords: ["banco de horas", "horas extras", "saldo", "compensa", "folga", "excesso"],
    synonyms: ["saldo de horas", "horas acumuladas", "atrasos"],
    permission: "rh.extras.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "rh-folha",
    title: "Fechamento da Folha de Pagamento",
    shortTitle: "Folha Pagamento",
    description: "Cálculo de salários, adicionais, DSR e holerites",
    route: "/dashboard/rh/fechamento",
    domain: "RH & Pessoas",
    section: "Folha & Benefícios",
    icon: "DollarSign",
    keywords: ["folha", "pagamento", "salario", "holerite", "fechamento", "dsr", "beneficio"],
    synonyms: ["folha de pagamento", "pagar funcionarios", "contracheque"],
    permission: "rh.payroll.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "rh-recrutamento",
    title: "Recrutamento & Seleção",
    shortTitle: "Recrutamento",
    description: "Vagas abertas, candidatos, entrevistas e processos seletivos",
    route: "/dashboard/rh/recrutamento",
    domain: "RH & Pessoas",
    section: "Gestão de Pessoas",
    icon: "UserPlus",
    keywords: ["recrutamento", "vagas", "candidatos", "contratacao", "entrevista", "curriculo"],
    synonyms: ["processo seletivo", "novas vagas"],
    permission: "rh.recruiting.view",
    mobilePriority: 4,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "rh-gastos-admin",
    title: "Compras & Despesas do Mês (RH)",
    shortTitle: "Compras do Mês",
    description: "Acompanhamento de compras administrativas e vales",
    route: "/dashboard/rh/gastos-admin",
    domain: "RH & Pessoas",
    section: "Folha & Benefícios",
    icon: "Receipt",
    keywords: ["compras do mes", "gastos", "vales", "reembolso", "despesas rh"],
    synonyms: ["gastos de rh", "compras administrativas"],
    permission: "rh.admin_expenses.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "rh-organograma",
    title: "Organograma da Empresa",
    shortTitle: "Organograma",
    description: "Hierarquia de setores, lideranças e subordinações",
    route: "/dashboard/rh/organograma",
    domain: "RH & Pessoas",
    section: "Gestão de Pessoas",
    icon: "GitFork",
    keywords: ["organograma", "hierarquia", "cargos", "estrutura", "liderança"],
    synonyms: ["mapa de cargos", "estrutura da equipe"],
    permission: "rh.orgchart.view",
    mobilePriority: 5,
    adminOnly: false,
    searchable: true,
  },

  // --- FINANCEIRO & FISCAL ---
  {
    id: "fin-fluxo-caixa",
    title: "Fluxo de Caixa & Contas",
    shortTitle: "Fluxo de Caixa",
    description: "Contas a pagar, receber, conciliação bancária e saldo diário",
    route: "/dashboard/financeiro",
    domain: "Financeiro & Fiscal",
    section: "Gestão Financeira",
    icon: "Wallet",
    keywords: ["fluxo de caixa", "contas", "pagar", "receber", "boleto", "banco", "saldo", "caixa", "vencimento"],
    synonyms: ["contas a pagar", "contas a receber", "boletos", "entradas e saidas"],
    permission: "financeiro.cashflow.view",
    mobilePriority: 1,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "fin-dre",
    title: "Demonstrativo de Resultado (DRE)",
    shortTitle: "DRE Gerencial",
    description: "Receita bruta, custos operacionais, margem e lucro líquido",
    route: "/dashboard/financeiro/dre",
    domain: "Financeiro & Fiscal",
    section: "Gestão Financeira",
    icon: "TrendingUp",
    keywords: ["dre", "resultado", "lucro", "prejuizo", "faturamento", "receita", "margem", "imposto"],
    synonyms: ["demonstrativo de resultado", "lucro do mes", "balancete"],
    permission: "financeiro.dre.view",
    mobilePriority: 2,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "fin-cmv",
    title: "Análise de CMV (Custo de Mercadoria)",
    shortTitle: "Análise de CMV",
    description: "Custo dos insumos em relação ao faturamento de vendas",
    route: "/dashboard/financeiro/cmv",
    domain: "Financeiro & Fiscal",
    section: "Custos & Margem",
    icon: "PieChart",
    keywords: ["cmv", "custo comida", "custo mercadoria", "porcentagem cmv", "margem", "desperdicio"],
    synonyms: ["custo de alimento", "porcentagem de custo", "indicador cmv"],
    permission: "financeiro.cmv.view",
    mobilePriority: 1,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "fin-pizza-lucro",
    title: "Pizza do Lucro (Distribuição de Custos)",
    shortTitle: "Pizza do Lucro",
    description: "Visão gráfica da divisão entre CMV, CMO, custos fixos e margem",
    route: "/dashboard/financeiro/pizza",
    domain: "Financeiro & Fiscal",
    section: "Custos & Margem",
    icon: "PieChart",
    keywords: ["pizza", "lucro", "divisao", "grafico", "cmo", "cmv", "custo fixo"],
    synonyms: ["divisao do faturamento", "pizza financeira"],
    permission: "financeiro.pizza_lucro.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "fin-fiscal",
    title: "Dados Fiscais & Impostos",
    shortTitle: "Dados Fiscais",
    description: "Configurações tributárias, NFe, NFCe e relatórios para contador",
    route: "/dashboard/gestao/fiscal",
    domain: "Financeiro & Fiscal",
    section: "Fiscal & Contábil",
    icon: "FileCheck",
    keywords: ["fiscal", "imposto", "impostos", "nfe", "nfce", "tributos", "contador", "fiscalizacao"],
    synonyms: ["dados para contador", "notas emitidas"],
    permission: "financeiro.fiscal.view",
    mobilePriority: 4,
    adminOnly: true,
    searchable: true,
  },

  // --- GESTÃO & AJUSTES ---
  {
    id: "ges-inventario",
    title: "Inventário Físico do Estoque",
    shortTitle: "Inventário",
    description: "Lançamento de contagens físicas e apuração de divergências",
    route: "/dashboard/gestao/inventario",
    domain: "Gestão & Ajustes",
    section: "Auditoria & Estoque",
    icon: "ClipboardCheck",
    keywords: ["inventario", "contagem", "estoque", "divergencia", "furto", "sobra", "falta"],
    synonyms: ["fazer contagem", "fechar inventario"],
    permission: "estoque.inventory.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "ges-manutencao",
    title: "Gestão de Manutenção de Equipamentos",
    shortTitle: "Manutenção",
    description: "Chamados técnicos para fogões, freezers, ar-condicionado e balcões",
    route: "/dashboard/gestao/manutencao",
    domain: "Gestão & Ajustes",
    section: "Operações",
    icon: "Wrench",
    keywords: ["manutencao", "quebrou", "conserto", "equipamento", "tecnico", "chamado", "freezer"],
    synonyms: ["consertar equipamento", "chamado tecnico"],
    permission: "gestao.maintenance.view",
    mobilePriority: 4,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "ges-relatorios",
    title: "Relatórios Executivos",
    shortTitle: "Relatórios",
    description: "Central de exportação de dados consolidados e histórico",
    route: "/dashboard/relatorios",
    domain: "Gestão & Ajustes",
    section: "Relatórios",
    icon: "FileSpreadsheet",
    keywords: ["relatorios", "relatorio", "exportar", "excel", "pdf", "historico", "dados"],
    synonyms: ["relatorio gerencial", "baixar dados"],
    permission: "relatorios.reports.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "ges-clientes",
    title: "Clientes & CRM",
    shortTitle: "Clientes (CRM)",
    description: "Histórico de compras dos clientes, NPS e hábitos de consumo",
    route: "/dashboard/clientes",
    domain: "Gestão & Ajustes",
    section: "Vendas & Clientes",
    icon: "Heart",
    keywords: ["clientes", "crm", "fidelidade", "nps", "historico", "consumidor"],
    synonyms: ["base de clientes", "cadastro de cliente"],
    permission: "clientes.overview.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "ges-configuracoes",
    title: "Configurações da Loja",
    shortTitle: "Configurações",
    description: "Parâmetros operacionais, empresa, horários e impressoras",
    route: "/dashboard/configuracoes",
    domain: "Gestão & Ajustes",
    section: "Sistema",
    icon: "Settings",
    keywords: ["configuracoes", "ajustes", "loja", "impressora", "parametro", "dados da empresa"],
    synonyms: ["ajustes da loja", "configurar sistema"],
    permission: "configuracoes.store.view",
    mobilePriority: 4,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "ges-usuarios",
    title: "Gestão de Usuários & Acessos",
    shortTitle: "Usuários e Acessos",
    description: "Criação de logins, senhas, vinculação de papéis e revogação",
    route: "/dashboard/configuracoes/usuarios",
    domain: "Gestão & Ajustes",
    section: "Segurança",
    icon: "ShieldAlert",
    keywords: ["usuarios", "usuario", "login", "senha", "acesso", "permissoes", "segurança"],
    synonyms: ["cadastrar usuario", "mudar senha"],
    permission: "configuracoes.users.view",
    mobilePriority: 4,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "ges-perfis",
    title: "Perfis de Acesso (Matriz de Permissões)",
    shortTitle: "Perfis de Acesso",
    description: "Definição fina das ações permitidas por função ou cargo",
    route: "/dashboard/configuracoes/perfis",
    domain: "Gestão & Ajustes",
    section: "Segurança",
    icon: "Lock",
    keywords: ["perfis", "perfil", "permissoes", "matriz", "cargo", "papeis", "segurança"],
    synonyms: ["modificar permissao", "regras de acesso"],
    permission: "configuracoes.profiles.view",
    mobilePriority: 5,
    adminOnly: true,
    searchable: true,
  }
];

/**
 * Normaliza strings para busca insensível a acentos, maiúsculas e múltiplos espaços.
 */
export function normalizeString(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Retorna todas as rotas registradas que o usuário tem permissão para acessar.
 */
export function getAccessibleNavigation(session) {
  if (!session) return [];
  // Se for admin ou tiver total acesso, retorna todas as rotas pesquisáveis
  if (session.papel === "admin" || session.super_admin || session.permissions === "*") {
    return NAVIGATION_REGISTRY.filter(item => item.searchable !== false);
  }
  return NAVIGATION_REGISTRY.filter(item => {
    if (item.searchable === false) return false;
    const [path, query = ""] = item.route.split("?");
    return canAccessRoute(session, path, query);
  });
}

/**
 * Executa a Busca Universal com algoritmo de pontuação e ranking de relevância.
 */
export function searchNavigationRegistry(query = "", session = null, options = {}) {
  const normQuery = normalizeString(query);
  const accessible = getAccessibleNavigation(session);

  if (!normQuery) {
    const limit = options.limit || 8;
    return accessible.slice(0, limit).map(item => ({ ...item, score: 100 }));
  }

  const scored = accessible.map(item => {
    let score = 0;
    const normTitle = normalizeString(item.title);
    const normShort = normalizeString(item.shortTitle);
    const normDesc = normalizeString(item.description);
    const normDomain = normalizeString(item.domain);
    const normSec = normalizeString(item.section);

    // 1. Correspondência exata de nome ou nome curto
    if (normTitle === normQuery || normShort === normQuery) {
      score += 1000;
    }
    // 2. Início do nome ou nome curto
    else if (normTitle.startsWith(normQuery) || normShort.startsWith(normQuery)) {
      score += 800;
    }
    // 3. Nome contém termo
    else if (normTitle.includes(normQuery) || normShort.includes(normQuery)) {
      score += 600;
    }

    // 4. Correspondência em Keywords
    if (item.keywords && Array.isArray(item.keywords)) {
      for (const kw of item.keywords) {
        const normKw = normalizeString(kw);
        if (normKw === normQuery) {
          score += 500;
        } else if (normKw.startsWith(normQuery)) {
          score += 400;
        } else if (normKw.includes(normQuery)) {
          score += 300;
        }
      }
    }

    // 5. Correspondência em Sinônimos
    if (item.synonyms && Array.isArray(item.synonyms)) {
      for (const syn of item.synonyms) {
        const normSyn = normalizeString(syn);
        if (normSyn === normQuery) {
          score += 450;
        } else if (normSyn.startsWith(normQuery)) {
          score += 350;
        } else if (normSyn.includes(normQuery)) {
          score += 250;
        }
      }
    }

    // 6. Descrição contém termo
    if (normDesc.includes(normQuery)) {
      score += 100;
    }

    // 7. Domínio ou Seção contém termo
    if (normDomain.includes(normQuery) || normSec.includes(normQuery)) {
      score += 80;
    }

    return { ...item, score };
  });

  const filtered = scored.filter(item => item.score > 0);
  filtered.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  if (options.limit && options.limit > 0) {
    return filtered.slice(0, options.limit);
  }
  return filtered;
}
