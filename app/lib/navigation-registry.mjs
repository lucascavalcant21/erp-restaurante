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
    id: "inteligencia-central",
    title: "Central de Inteligência",
    shortTitle: "Inteligência",
    description: "Análises e respostas com IA",
    route: "/dashboard/inteligencia",
    domain: "Operação",
    section: "Início",
    icon: "BarChart",
    keywords: ["inteligencia", "hefisto", "alertas", "insights", "resumo do dia", "pergunte", "assistente", "cmv", "divergencia", "vencimento"],
    synonyms: ["central de inteligencia", "resumo diario", "o que precisa de mim", "copiloto"],
    permission: "dashboard.intelligence.view",
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
  {
    id: "saude-hefisto",
    // telemetria em MEMÓRIA do copilot antigo (hefisto-telemetry): não mede o
    // Intelligence Core. Fora da busca; a página continua acessível pela URL.
    title: "Saúde do Sistema & Observabilidade do Héfisto",
    shortTitle: "Saúde Héfisto",
    description: "Métricas de produção, latência, erros, traces e eval release gate",
    route: "/dashboard/gestao/saude-hefisto",
    domain: "Gestão",
    section: "Governança & IA",
    icon: "Activity",
    keywords: ["saude", "observabilidade", "hefisto", "telemetria", "traces", "erros", "desempenho", "latencia", "evals", "metrics"],
    synonyms: ["saude do hefisto", "painel de saude", "monitoramento hefisto"],
    permission: "gestao.operational_center.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: false,
  },
  {
    id: "piloto-hefisto",
    // Governava o copilot ANTIGO (substituído pelo Intelligence Core): sai da busca
    // para não parecer uma segunda IA. A página continua no ar para o admin (URL).
    title: "Piloto Operacional do Héfisto",
    shortTitle: "Piloto Héfisto",
    description: "Adoção controlada, matriz de capacidades liberadas e sinais de valor do piloto",
    route: "/dashboard/gestao/piloto-hefisto",
    domain: "Gestão",
    section: "Governança & IA",
    icon: "Compass",
    keywords: ["piloto", "hefisto", "capacidades", "rollout", "adocao", "eficiencia", "qualidade", "baseline", "atrito", "problemas"],
    synonyms: ["piloto do hefisto", "modo piloto", "controle do piloto"],
    permission: "gestao.operational_center.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: false,
  },

  {
    id: "auditoria-hefisto",
    // Auditoria em MEMÓRIA e "modo seguro"/"kill switch" do copilot antigo: não
    // valem para o Intelligence Core (auditoria em intelligence_eventos). Sai da
    // busca para não induzir o admin a erro; a página continua acessível pela URL.
    title: "Auditoria & Governança do Héfisto",
    shortTitle: "Auditoria Héfisto",
    description: "Rastreabilidade de solicitações, modo seguro e permissões",
    route: "/dashboard/gestao/auditoria-hefisto",
    domain: "Gestão",
    section: "Governança & IA",
    icon: "ShieldCheck",
    keywords: ["auditoria", "governanca", "hefisto", "logs", "modo seguro", "kill switch", "seguranca"],
    synonyms: ["auditoria do hefisto", "logs de ia"],
    permission: "gestao.operational_center.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: false,
  },

  // --- OPERAÇÃO & COZINHA & BAR ---
  {
    id: "op-etiquetas",
    title: "Impressão de Etiquetas",
    shortTitle: "Etiquetas",
    description: "Impressão e controle de etiquetas",
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
    id: "hub-cozinha",
    title: "Ambiente Operacional da Cozinha",
    shortTitle: "Cozinha",
    description: "Painel de ação rápida da cozinha: produção, estoque crítico, checklists e etiquetas",
    route: "/dashboard/cozinha",
    domain: "Operação",
    section: "Cozinha & Validades",
    icon: "ChefHat",
    keywords: ["cozinha", "hub", "operacao", "preparo", "cozinheiro", "comida", "chef"],
    synonyms: ["ambiente da cozinha", "modulo da cozinha", "painel da cozinha"],
    permission: "cozinha.sector.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "op-producao",
    title: "Produção do Dia",
    shortTitle: "Produção",
    description: "Planejamento e execução da produção",
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
    keywords: ["ficha", "fichas", "drink", "drinks", "coquetel", "coquetéis", "bebidas", "bar", "receita bar", "dosagem"],
    synonyms: ["receita de drink", "ficha de drink", "fichas de drinks", "cocktails"],
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
    id: "hefisto-auditoria",
    // mesma página da auditoria em memória do copilot antigo: fora da busca (ver auditoria-hefisto)
    title: "Auditoria & Governança do Héfisto",
    shortTitle: "Auditoria Héfisto",
    description: "Trilha de auditoria, eventos de segurança e controle de Modo Seguro",
    route: "/dashboard/gestao/auditoria-hefisto",
    domain: "Gestão",
    section: "Segurança & Governança",
    icon: "ShieldCheck",
    keywords: ["auditoria hefisto", "governanca", "modo seguro", "kill switch", "logs hefisto", "trilha de auditoria"],
    synonyms: ["auditoria de IA", "logs do assistente"],
    permission: "hefisto.audit.view",
    mobilePriority: 3,
    adminOnly: true,
    searchable: false,
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
    title: "Eventos e Reservas",
    shortTitle: "Orçamento Eventos",
    description: "Simulação de custos e cardápios para reservas e eventos",
    route: "/dashboard/reservas-eventos/eventos",
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
    title: "Estoque — entrada e retirada",
    shortTitle: "Estoque",
    description: "Entrada, retirada, transferência e saldo por local",
    route: "/dashboard/operacao/estoque",
    domain: "Estoque & Compras",
    section: "Estoque",
    icon: "Package",
    keywords: ["estoque", "saldo", "entrada", "retirada", "baixa", "transferencia", "insumos", "produtos", "deposito", "quantidade"],
    synonyms: ["estoque geral", "ver saldo", "baixa de estoque", "retirar insumo", "dar entrada"],
    permission: "estoque.movements.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "est-painel",
    title: "Painel do Estoque",
    shortTitle: "Painel do Estoque",
    description: "Não conferido, zerado, abaixo do mínimo e valor em estoque",
    route: "/dashboard/operacao/estoque/painel",
    domain: "Estoque & Compras",
    section: "Estoque",
    icon: "Package",
    keywords: ["estoque", "painel", "minimo", "zerado", "conferido", "valor", "curva abc", "baixo"],
    synonyms: ["posicao do estoque", "estoque baixo", "o que falta"],
    permission: "estoque.overview.view",
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
    description: "Registro e acompanhamento de ponto",
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
    keywords: ["bater ponto", "registrar ponto", "registro de ponto", "marcar ponto", "bater meu ponto", "quiosque", "terminal", "ponto", "relatorio", "entrada", "saida"],
    synonyms: ["marcar ponto", "registrar ponto", "relatorio de ponto", "relógio de ponto", "batida de ponto"],
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
    title: "Fluxo de Caixa",
    shortTitle: "Fluxo de Caixa",
    description: "Contas a pagar, receber, conciliação bancária e saldo diário",
    route: "/dashboard/financeiro",
    domain: "Financeiro & Fiscal",
    section: "Gestão Financeira",
    icon: "Wallet",
    keywords: ["fluxo de caixa", "banco", "saldo", "caixa", "entradas", "saidas"],
    synonyms: ["movimentacao de caixa", "entradas e saidas"],
    permission: "financeiro.cashflow.view",
    mobilePriority: 1,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "fin-contas",
    title: "Contas a Pagar & Receber",
    shortTitle: "Contas",
    description: "Despesas, vencimentos e pagamentos",
    route: "/dashboard/financeiro/contas",
    domain: "Financeiro & Fiscal",
    section: "Gestão Financeira",
    icon: "ReceiptText",
    keywords: ["contas", "contas a pagar", "contas a receber", "contas vencidas", "vencidas", "boletos", "vencimento", "pendentes", "pagar"],
    synonyms: ["contas vencidas", "boletos a pagar", "vencimentos do dia", "contas pendentes"],
    permission: "financeiro.cashflow.view",
    mobilePriority: 2,
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
    description: "Análise de CMV, custo e margem",
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
  },

  // --- MARMITARIA & DELIVERY ---
  {
    id: "marmitaria-overview",
    title: "Marmitaria & Delivery — Visão Geral",
    shortTitle: "Marmitaria",
    description: "Painel de controle, metas e KPIs da operação Marmitaria & Delivery",
    route: "/dashboard/marmitaria",
    domain: "Marmitaria & Delivery",
    section: "Operação",
    icon: "Package",
    keywords: ["marmitaria", "delivery", "marmitas", "visao geral", "painel", "kpis"],
    synonyms: ["painel da marmitaria", "inicio marmitaria"],
    permission: "marmitaria.overview.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-pedidos",
    title: "Pedidos & iFood — Marmitaria",
    shortTitle: "Pedidos Marmitaria",
    description: "Gestão e conciliação de pedidos da Marmitaria no iFood, WhatsApp e balcão",
    route: "/dashboard/marmitaria/pedidos",
    domain: "Marmitaria & Delivery",
    section: "Vendas",
    icon: "ShoppingBag",
    keywords: ["marmitaria", "pedidos", "ifood", "whatsapp", "balcao", "repasses"],
    synonyms: ["pedidos de marmita", "ifood marmitaria"],
    permission: "marmitaria.orders.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-cardapio",
    title: "Cardápio de Marmitas",
    shortTitle: "Cardápio Marmitas",
    description: "Tabela de marmitas comercializadas, fotos, tamanhos e preços por canal",
    route: "/dashboard/marmitaria/cardapio",
    domain: "Marmitaria & Delivery",
    section: "Cardápio",
    icon: "BookOpen",
    keywords: ["cardapio", "marmitas", "tamanhos", "precos", "delivery"],
    synonyms: ["cardapio marmitaria", "produtos marmitaria"],
    permission: "marmitaria.menu.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-fichas",
    title: "Fichas Técnicas de Marmitas",
    shortTitle: "Fichas de Marmitas",
    description: "Composição por pré-preparos, gramaturas, embalagens, sequências e custo técnico",
    route: "/dashboard/marmitaria/fichas",
    domain: "Marmitaria & Delivery",
    section: "Engenharia",
    icon: "UtensilsCrossed",
    keywords: ["fichas tecnicas", "marmitas", "custo tecnico", "montagem", "receita", "embalagem"],
    synonyms: ["ficha da marmita", "receita de marmita"],
    permission: "marmitaria.recipes.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-precificacao",
    title: "Precificação Inteligente de Marmitas",
    shortTitle: "Precificação Marmitas",
    description: "Formação de preços por canal, taxas contratuais, tributos e margem de contribuição",
    route: "/dashboard/marmitaria/precificacao",
    domain: "Marmitaria & Delivery",
    section: "Financeiro",
    icon: "Calculator",
    keywords: ["precificacao", "preco sugerido", "marmitas", "margem", "ifood taxas", "cmv"],
    synonyms: ["preço de venda marmitas", "calculadora de preco"],
    permission: "marmitaria.pricing.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-simulador",
    title: "Simulador de Vendas da Marmitaria",
    shortTitle: "Simulador de Vendas",
    description: "Simulação de metas diárias, cenários de 20 a 200 marmitas/dia, CMV, CMO e breakeven",
    route: "/dashboard/marmitaria/simulador",
    domain: "Marmitaria & Delivery",
    section: "Planejamento",
    icon: "BarChart3",
    keywords: ["simulador", "metas", "cenarios", "ponto de equilibrio", "breakeven", "projecao"],
    synonyms: ["simular vendas", "previsao de vendas marmitaria"],
    permission: "marmitaria.simulator.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-producao",
    title: "Produção de Marmitas & Rendimento",
    shortTitle: "Produção Marmitaria",
    description: "Kanban de produção diária, rendimento real na cocção, comandas e KDS",
    route: "/dashboard/marmitaria/producao",
    domain: "Marmitaria & Delivery",
    section: "Produção",
    icon: "ChefHat",
    keywords: ["producao", "marmitas", "lotes", "rendimento real", "cozinha", "kds"],
    synonyms: ["painel de producao marmitaria", "preparo de marmitas"],
    permission: "marmitaria.production.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-estoque",
    title: "Estoque & Embalagens da Marmitaria",
    shortTitle: "Estoque Marmitaria",
    description: "Gestão operacional de insumos, embalagens, conversão de caixas e transferências",
    route: "/dashboard/marmitaria/estoque",
    domain: "Marmitaria & Delivery",
    section: "Estoque",
    icon: "Boxes",
    keywords: ["estoque", "embalagens", "transferencias", "potes", "marmitaria"],
    synonyms: ["estoque de embalagens", "transferencia de insumos"],
    permission: "marmitaria.stock.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-compras",
    title: "Lista de Compras Inteligente",
    shortTitle: "Compras Marmitaria",
    description: "Explosão de necessidades de compras conectada ao simulador e estoque atual",
    route: "/dashboard/marmitaria/compras",
    domain: "Marmitaria & Delivery",
    section: "Suprimentos",
    icon: "ShoppingCart",
    keywords: ["compras", "pedidos de compra", "fornecedores", "cotacao", "marmitaria"],
    synonyms: ["o que comprar", "lista de compras marmitaria"],
    permission: "marmitaria.purchases.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-rh",
    title: "RH & Escalas da Marmitaria",
    shortTitle: "RH Marmitaria",
    description: "Colaboradores alocados, escalas, jornadas e cálculo auditável de CMO sem duplicidade",
    route: "/dashboard/marmitaria/rh",
    domain: "Marmitaria & Delivery",
    section: "Equipe",
    icon: "Users",
    keywords: ["rh", "escalas", "cmo", "colaboradores", "equipe", "marmitaria"],
    synonyms: ["equipe da marmitaria", "funcionarios marmitaria"],
    permission: "marmitaria.hr.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-financeiro",
    title: "Financeiro & Repasses da Marmitaria",
    shortTitle: "Financeiro Marmitaria",
    description: "Centro de resultado próprio, receitas por canal, repasses iFood e custos rateados",
    route: "/dashboard/marmitaria/financeiro",
    domain: "Marmitaria & Delivery",
    section: "Financeiro",
    icon: "DollarSign",
    keywords: ["financeiro", "repasses", "centro de resultado", "contas", "marmitaria"],
    synonyms: ["financeiro marmitaria", "repasses ifood"],
    permission: "marmitaria.financial.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-cmv-cmo",
    title: "CMV & CMO da Marmitaria",
    shortTitle: "CMV & CMO",
    description: "Indicadores de custo de mercadoria vendida e custo de mão de obra da operação",
    route: "/dashboard/marmitaria/cmv-cmo",
    domain: "Marmitaria & Delivery",
    section: "Controladoria",
    icon: "PieChart",
    keywords: ["cmv", "cmo", "indicadores", "custos", "marmitaria"],
    synonyms: ["cmv marmitaria", "cmo marmitaria"],
    permission: "marmitaria.cmv_cmo.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-dre",
    title: "DRE & Resultados da Marmitaria",
    shortTitle: "DRE Marmitaria",
    description: "Demonstrativo do Resultado do Exercício gerencial exclusivo da operação",
    route: "/dashboard/marmitaria/dre",
    domain: "Marmitaria & Delivery",
    section: "Controladoria",
    icon: "TrendingUp",
    keywords: ["dre", "resultado", "lucro", "margem de contribuicao", "marmitaria"],
    synonyms: ["dre marmitaria", "lucro da marmitaria"],
    permission: "marmitaria.dre.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-configuracoes",
    title: "Configurações da Marmitaria",
    shortTitle: "Configurações",
    description: "Taxas padrões, canais ativos, capacidade diária e percentuais de rateio",
    route: "/dashboard/marmitaria/configuracoes",
    domain: "Marmitaria & Delivery",
    section: "Ajustes",
    icon: "Sliders",
    keywords: ["configuracoes", "parametros", "taxas", "canais", "marmitaria"],
    synonyms: ["ajustes marmitaria", "parametros marmitaria"],
    permission: "marmitaria.settings.view",
    mobilePriority: 4,
    adminOnly: true,
    searchable: true,
  },
  {
    id: "marmitaria-planejamento",
    title: "Planejamento Inteligente 360º — Marmitaria",
    shortTitle: "Planejamento 360º",
    description: "Central diária e semanal conectando metas de vendas a insumos, estoque, equipe e capacidade",
    route: "/dashboard/marmitaria/planejamento",
    domain: "Marmitaria & Delivery",
    section: "Operação",
    icon: "Calendar",
    keywords: ["planejamento", "meta", "360", "insumos", "equipe", "capacidade", "marmitaria"],
    synonyms: ["planejamento diario", "plano de marmitas", "planejamento inteligente"],
    permission: "marmitaria.overview.view",
    mobilePriority: 1,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-combos",
    title: "Combos & Engenharia de Cardápio",
    shortTitle: "Combos & Margem",
    description: "Simulador de combos, cupom, frete subsidiado e matriz BCG de rentabilidade",
    route: "/dashboard/marmitaria/combos",
    domain: "Marmitaria & Delivery",
    section: "Cardápio",
    icon: "Tag",
    keywords: ["combos", "promocoes", "frete", "descontos", "engenharia de cardapio", "matriz bcg"],
    synonyms: ["combos marmitaria", "rentabilidade comercial"],
    permission: "marmitaria.pricing.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-assinaturas",
    title: "Assinaturas & Planos Recorrentes",
    shortTitle: "Assinaturas",
    description: "Planos semanais e mensais de marmitas, entregas programadas e receita recorrente",
    route: "/dashboard/marmitaria/assinaturas",
    domain: "Marmitaria & Delivery",
    section: "Vendas",
    icon: "Repeat",
    keywords: ["assinaturas", "planos", "recorrencia", "semanal", "mensal", "fidelidade"],
    synonyms: ["marmitas por assinatura", "planos de marmitas"],
    permission: "marmitaria.orders.view",
    mobilePriority: 2,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-qualidade",
    title: "Qualidade, Atendimento & ANVISA RDC 216",
    shortTitle: "Qualidade & ANVISA",
    description: "Não-conformidades, taxa de defeito operacional, reembolsos e controle térmico sanitário",
    route: "/dashboard/marmitaria/qualidade",
    domain: "Marmitaria & Delivery",
    section: "Operação",
    icon: "ShieldCheck",
    keywords: ["qualidade", "anvisa", "temperatura", "reclamacoes", "atrasos", "erros"],
    synonyms: ["controle de qualidade marmitaria", "atendimento e ocorrencias"],
    permission: "marmitaria.production.view",
    mobilePriority: 3,
    adminOnly: false,
    searchable: true,
  },
  {
    id: "marmitaria-ia-otimizador",
    title: "Copiloto IA — Otimizador de Lucro da Marmitaria",
    shortTitle: "Copiloto IA",
    description: "Consultoria preditiva e simulações determinísticas de compras, vendas, equipe e custos",
    route: "/dashboard/marmitaria/ia-otimizador",
    domain: "Marmitaria & Delivery",
    section: "Inteligência",
    icon: "Bot",
    keywords: ["ia", "copiloto", "otimizador", "lucro", "consultoria", "simulacao"],
    synonyms: ["ia marmitaria", "otimizador de marmitas"],
    permission: "marmitaria.overview.view",
    mobilePriority: 1,
    adminOnly: false,
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
  // Se for admin, super_admin, sem restrições ou conta não gerenciada (proprietário/gestor), retorna todas as rotas pesquisáveis
  if (session.papel === "admin" || session.super_admin || session.permissions === "*" || session.gerenciado === false) {
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
        } else if (normKw.length >= 3 && normQuery.includes(normKw)) {
          score += 280;
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
        } else if (normSyn.length >= 3 && normQuery.includes(normSyn)) {
          score += 230;
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

/**
 * Retorna o item do Registry por ID.
 */
export function getRegistryItemById(id) {
  return NAVIGATION_REGISTRY.find(item => item.id === id) || null;
}

/**
 * Resolve qualquer URL física ou sub-rota para o item do Registry correspondente.
 */
export function getRegistryItemByRoute(pathname = "", search = "") {
  if (!pathname) return null;
  const fullPath = search ? `${pathname}?${search}` : pathname;

  // 1. Tenta correspondência exata de rota + query
  const exact = NAVIGATION_REGISTRY.find(item => item.route === fullPath);
  if (exact) return exact;

  // 2. Tenta correspondência por pathname base
  const matchPath = NAVIGATION_REGISTRY.filter(item => {
    const base = item.route.split("?")[0];
    return pathname === base || (base !== "/dashboard" && pathname.startsWith(`${base}/`));
  }).sort((a, b) => b.route.length - a.route.length);

  return matchPath[0] || null;
}

/**
 * Retorna os 5 atalhos estáveis e previsíveis da Bottom Navigation adaptativa baseada em perfil + permissões.
 * Posição 1: Sempre Início (/dashboard)
 * Posição 5: Sempre Menu (Command Center)
 * Posições 2, 3 e 4: Definidas por presets previsíveis de perfil com fallback garantido.
 */
export function getBottomNavPreset(session) {
  const accessible = getAccessibleNavigation(session);
  const accessibleMap = new Map(accessible.map(item => [item.id, item]));

  const papel = session?.papel || "admin";

  // Presets previsíveis por papel (IDs do Registry)
  const ROLE_PRESETS = {
    cozinha: ["hub-cozinha", "op-producao", "op-etiquetas"],
    bar: ["op-producao-bar", "op-fichas-bar", "op-etiquetas"],
    rh: ["rh-ponto", "rh-gestao", "rh-banco-horas"],
    estoque: ["est-visao-geral", "op-etiquetas", "est-compras"],
    salao: ["op-mesas", "op-checklists", "rh-ponto-kiosk"],
    caixa: ["op-mesas", "op-checklists", "fin-fluxo-caixa"],
    gerente: ["hub-cozinha", "op-producao", "rh-ponto"],
    admin: ["dash-inteligente", "hub-cozinha", "fin-fluxo-caixa"]
  };

  const candidateIds = ROLE_PRESETS[papel] || ROLE_PRESETS.admin;

  // Filtra candidatos permitidos
  const selectedContextual = candidateIds
    .map(id => accessibleMap.get(id))
    .filter(Boolean);

  // Fallback: se o perfil tiver menos de 3 itens permitidos no preset, completa com outros itens permitidos
  if (selectedContextual.length < 3) {
    const usedIds = new Set(["dash-home", ...selectedContextual.map(i => i.id)]);
    for (const item of accessible) {
      if (!usedIds.has(item.id)) {
        selectedContextual.push(item);
        usedIds.add(item.id);
        if (selectedContextual.length === 3) break;
      }
    }
  }

  // Posição 1: Início
  const homeItem = accessibleMap.get("dash-home") || NAVIGATION_REGISTRY[0];

  // Estrutura fixa de 5 itens: Início + 3 Contextuais + Menu
  return [
    { ...homeItem, isHome: true },
    ...selectedContextual.slice(0, 3),
    { id: "action-menu", title: "Menu", shortTitle: "Menu", route: "#menu", icon: "Menu", isMenu: true }
  ];
}
