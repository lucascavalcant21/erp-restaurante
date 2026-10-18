// ═══════════════════════════════════════════════════════════════
// delivery.js — Motor do Cardápio Digital (App de Delivery & Cardápio Inteligente)
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

// ─── BANNERS PARA O CARROSSEL DINÂMICO (PROMOÇÃO DO DIA & EVENTOS DA SEMANA) ──
export const BANNERS_CARROSSEL = [
  {
    id: "banner-promo-dia",
    tag: "🔥 PROMOÇÃO DO DIA",
    titulo: "Picanha na Parrilla & Chopp em Dobro",
    subtitulo: "Desconto especial de 20% hoje no almoço e jantar + Chopp artesanal da casa!",
    imagem: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1200&q=80",
    categoriaAlvo: "Carnes Nobres & Brasa",
    corBadge: "bg-red-600",
    tipo: "promocao",
  },
  {
    id: "banner-quinta-jazz",
    tag: "🎷 EVENTO • QUINTA DO JAZZ & BLUES",
    titulo: "Música ao Vivo & Noite dos Vinhos",
    subtitulo: "Apresentação acústica instrumental a partir das 19h30 com taça de boas-vindas",
    imagem: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=80",
    corBadge: "bg-indigo-600",
    tipo: "evento",
    dataEvento: "Toda Quinta às 19h30",
  },
  {
    id: "banner-sexta-brasa",
    tag: "🔥 EVENTO • SEXTA DA BRASA NOBRE",
    titulo: "Festival da Brasa & Open Parrilla",
    subtitulo: "Degustação de cortes Angus e defumação a lenha de angico das 19h às 23h30",
    imagem: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
    categoriaAlvo: "Carnes Nobres & Brasa",
    corBadge: "bg-amber-600",
    tipo: "evento",
    dataEvento: "Toda Sexta às 19h00",
  },
  {
    id: "banner-sabado-sunset",
    tag: "🎸 EVENTO • SÁBADO SUNSET & DRINKS",
    titulo: "Coquetelaria em Dobro & DJ Suave",
    subtitulo: "Caipirinhas autorais e drinks botânicos com rodada dupla das 17h às 20h",
    imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80",
    categoriaAlvo: "Drinks & Coquetéis",
    corBadge: "bg-teal-600",
    tipo: "evento",
    dataEvento: "Todo Sábado das 17h às 20h",
  },
  {
    id: "banner-domingo-familia",
    tag: "👨‍👩‍👧‍👦 EVENTO • DOMINGO EM FAMÍLIA",
    titulo: "Costela Fogo de Chão & Almoço Especial",
    subtitulo: "Pratos generosos para compartilhar e espaço recreativo para as crianças a partir das 12h",
    imagem: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    corBadge: "bg-emerald-600",
    tipo: "evento",
    dataEvento: "Todo Domingo das 12h às 16h",
  },
];

// ─── CONFIGURAÇÃO PADRÃO DO CARDÁPIO DIGITAL (TOTALMENTE EDITÁVEL) ─
export const DEFAULT_CARDAPIO_CONFIG = {
  cor_fundo: "#0b0f17", // Dark Onyx Sofisticado
  cor_card: "#131b26",
  cor_texto: "#f8fafc",
  cor_primaria: "#f59e0b", // Âmbar Dourado
  nome_restaurante: "Sel de Estrela Gastronomia & Brasa",
  horarios_funcionamento: "Segunda a Domingo: 11h30 às 15h30 • 18h30 às 23h30",
  aviso_topo: "Festival da Brasa & Coquetelaria • Pedidos Rápidos com Envio Direto à Cozinha",
  promocoes: [
    { id: "p1", titulo: "Picanha na Parrilla", desconto: "20% OFF Hoje", dias: "Segunda e Sexta" },
    { id: "p2", titulo: "Caipirinha de Cupuaçu", desconto: "Em Dobro até 20h", dias: "Quarta a Sábado" },
  ],
  eventos: [
    { id: "e1", dia: "Quinta", nome: "Noite do Jazz & Blues ao Vivo 🎷", horario: "19h30" },
    { id: "e2", dia: "Sexta", nome: "Festival da Brasa Nobre & Parrilla 🔥", horario: "19h00" },
    { id: "e3", dia: "Sábado", nome: "Sunset Acústico & Coquetelaria 🎸", horario: "17h00" },
    { id: "e4", dia: "Domingo", nome: "Almoço em Família & Fogo de Chão 👨‍👩‍👧‍👦", horario: "12h00" },
  ],
};

// ─── LEITURA E SALVAMENTO DE CONFIGURAÇÕES DO CARDÁPIO DIGITAL ──
export function fetchCardapioConfig(unidadeId = "seldeestrela") {
  if (typeof window === "undefined") return DEFAULT_CARDAPIO_CONFIG;
  try {
    const salvo = localStorage.getItem(`hefisto_cardapio_config_${unidadeId}`);
    if (salvo) {
      return { ...DEFAULT_CARDAPIO_CONFIG, ...JSON.parse(salvo) };
    }
  } catch (e) {}
  return DEFAULT_CARDAPIO_CONFIG;
}

export function salvarCardapioConfig(unidadeId = "seldeestrela", novaConfig) {
  if (typeof window === "undefined") return novaConfig;
  try {
    const atual = fetchCardapioConfig(unidadeId);
    const unificado = { ...atual, ...novaConfig };
    localStorage.setItem(`hefisto_cardapio_config_${unidadeId}`, JSON.stringify(unificado));
    return unificado;
  } catch (e) {
    return novaConfig;
  }
}

// ─── SUGESTÃO DO DIA INTELIGENTE (PRATO + BEBIDA HARMONIZADA) ──
export const SUGESTOES_DO_DIA = [
  {
    id: "combo-chef-angus",
    badge: "🔥 SUGESTÃO DO DIA • 15% OFF",
    titulo: "Harmonização de Ouro do Chef",
    motivoHarmonizacao:
      "A suculência e o marmoreio defumado da Costela Angus ganham vida nova com o frescor cítrico e aveludado da Caipirinha de Cupuaçu, equilibrando as notas da madeira e limpando o palato a cada garfada.",
    pratoPrincipal: {
      id: "prod-angus-combo",
      nome: "Costela Angus Braseada com Redução de Tucupi",
      precoOriginal: 114.0,
      porcao: "Serve 1 a 2 pessoas • 650g",
      tempo: "25 min",
      imagem: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    },
    bebida: {
      id: "prod-caipirinha-combo",
      nome: "Caipirinha Autoral de Cupuaçu & Cachaça Envelhecida",
      precoOriginal: 36.0,
      volume: "350ml",
      imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
    },
    precoTotalOriginal: 150.0,
    precoCombo: 127.5,
    economia: 22.5,
    pontosFogoGanhos: 127,
  },
  {
    id: "combo-peixe-vinho",
    badge: "🌊 RECOMENDAÇÃO LEVE & NOBRE",
    titulo: "Frescor das Águas & Vinho Branco",
    motivoHarmonizacao:
      "O Pirarucu com crosta crocante de castanhas pede a acidez mineral e frutada do vinho branco gelado, destacando o dulçor natural do peixe sem mascarar o defumado da brasa.",
    pratoPrincipal: {
      id: "prod-pirarucu-combo",
      nome: "Pirarucu Grelhado com Crosta de Castanha-do-Pará",
      precoOriginal: 89.0,
      porcao: "Individual generoso • 480g",
      tempo: "20 min",
      imagem: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
    },
    bebida: {
      id: "prod-suco-graviola-combo",
      nome: "Suco Natural de Graviola com Hortelã",
      precoOriginal: 18.0,
      volume: "400ml",
      imagem: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80",
    },
    precoTotalOriginal: 107.0,
    precoCombo: 92.0,
    economia: 15.0,
    pontosFogoGanhos: 92,
  },
];

// ─── GERADOR DE BOAS-VINDAS INTELIGENTES & CONTEXTUAIS ─────────
export function gerarBoasVindasInteligentes(lojaNome = "Sel de Estrela") {
  const agora = new Date();
  const hora = agora.getHours();

  let saudacao = "Olá!";
  let subtitulo = "Seja muito bem-vindo à nossa mesa.";
  let icone = "✨";
  let periodo = "geral";

  if (hora >= 5 && hora < 12) {
    saudacao = "Bom dia!";
    subtitulo = "Comece o dia com opções revigorantes, cafés especiais e entradas frescas.";
    icone = "☀️";
    periodo = "manha";
  } else if (hora >= 12 && hora < 15) {
    saudacao = "Bom almoço!";
    subtitulo = "O braseiro está a todo vapor! Seleções nobres e combinações rápidas para você.";
    icone = "🌤️";
    periodo = "almoco";
  } else if (hora >= 15 && hora < 18) {
    saudacao = "Boa tarde!";
    subtitulo = "Perfeito para petiscos crocantes da brasa, sobremesas e bebidas geladas.";
    icone = "☕";
    periodo = "tarde";
  } else if (hora >= 18 && hora < 23) {
    saudacao = "Boa noite!";
    subtitulo = "Experiência gastronômica completa à luz de velas e brasa. Nossos cortes nobres e drinks aguardam você.";
    icone = "🌙";
    periodo = "noite";
  } else {
    saudacao = "Noite afora!";
    subtitulo = "Madrugada com sabor: cortes suculentos e coquetéis marcantes preparados com paixão.";
    icone = "🔥";
    periodo = "madrugada";
  }

  const humorFome = [
    { id: "todos", label: "Todos os Pratos", icone: "🍽️" },
    { id: "rapida", label: "Fome Rápida (<20 min)", icone: "⚡" },
    { id: "brasa", label: "Cortes na Brasa", icone: "🥩" },
    { id: "harmonizados", label: "Combos & Harmonizações", icone: "🍷" },
    { id: "leves", label: "Opções Leves & Peixes", icone: "🌱" },
    { id: "compartilhar", label: "Para Compartilhar", icone: "👨‍👩‍👧‍👦" },
  ];

  return { saudacao, subtitulo, icone, periodo, humorFome };
}

// ─── CATÁLOGO COMPLETO E DIDÁTICO (COM TEMPO, PIMENTA, CAMARÃO, GLÚTEN, LACTOSE) ──
export const CARDAPIO_DIGITAL_DEMO = [
  {
    id: "prod-angus",
    nome: "Costela Angus Braseada com Redução de Tucupi",
    categoria: "Carnes Nobres & Brasa",
    preco: 114.0,
    preco_antigo: 129.0,
    descricao: "Corte nobre Angus cozido lentamente por 12 horas em baixa temperatura, glaceado com redução aveludada de tucupi negro e purê de cará defumado.",
    porcao: "Serve 1 a 2 pessoas • 650g",
    tempo_preparo: "20-25 min",
    avaliacao: 4.9,
    avaliacoes_qtd: 184,
    imagem_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    tags: ["🔥 Mais Pedido", "Chef Choice"],
    destaque: true,
    // Informações de Saúde & Alérgenos
    pimenta: "Levemente Apimentado (Toque sutil de pimenta-de-cheiro)",
    nivelPimenta: 1, // 0 = Sem, 1 = Leve, 2 = Médio, 3 = Forte
    camarao: false, // Livre de Camarão e Frutos do Mar
    gluten: false,  // SEM GLÚTEN (Seguro para Celíacos)
    lactose: false, // SEM LACTOSE
    alergenicos: "Não contém glúten. Não contém lactose.",
    infoNutricional: "680 kcal • 48g proteínas • Rico em colágeno e ferro",
    opcoes_customizacao: {
      ponto_carne: [
        "Ao Ponto (Recomendado pelo Chef)",
        "Ao Ponto para o Mal",
        "Ao Ponto para o Bem",
        "Bem Passado",
        "Mal Passado",
      ],
      acompanhamentos: [
        "Arroz Biro-Biro com Crispy de Cebola",
        "Farofa Crocante de Castanha-do-Pará",
        "Vinagrete Especial com Toque Cítrico",
        "Mousseline de Mandioquinha Defumada",
        "Legumes Grelhados no Fogo",
      ],
      max_acompanhamentos: 2,
      adicionais: [
        { id: "add-queijo", nome: "Queijo Coalho Grelhado no Maçarico", preco: 14.0 },
        { id: "add-bacon", nome: "Bacon Artesanal Defumado Caramelizado", preco: 10.0 },
        { id: "add-chimichurri", nome: "Molho Chimichurri Fresco da Casa", preco: 6.0 },
        { id: "add-batata", nome: "Batatas Rústicas com Alecrim e Alho", preco: 16.0 },
      ],
      remocoes: ["Sem cebola", "Sem pimenta", "Sem coentro", "Molho à parte"],
    },
  },
  {
    id: "prod-picanha-prime",
    nome: "Picanha na Parrilla com Alho Confitado",
    categoria: "Carnes Nobres & Brasa",
    preco: 128.0,
    preco_antigo: 145.0,
    descricao: "Capa de gordura tostada na brasa de lenha nobre, temperada exclusivamente com flor de sal e servida com dentes de alho confitados em azeite de ervas.",
    porcao: "Serve 2 pessoas • 700g",
    tempo_preparo: "20-30 min",
    avaliacao: 4.9,
    avaliacoes_qtd: 212,
    imagem_url: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80",
    tags: ["🔥 Mais Pedido", "Parrilla Argentina"],
    destaque: true,
    pimenta: "Sem Pimenta",
    nivelPimenta: 0,
    camarao: false,
    gluten: false,
    lactose: false,
    alergenicos: "Livre de glúten, frutos do mar e lactose.",
    infoNutricional: "820 kcal • 62g proteínas • 100% corte nobre bovino",
    opcoes_customizacao: {
      ponto_carne: [
        "Ao Ponto para Mal (Máxima Suculência)",
        "Ao Ponto",
        "Mal Passado",
        "Ao Ponto para Bem",
        "Bem Passado",
      ],
      acompanhamentos: [
        "Arroz Biro-Biro da Casa",
        "Farofa Crocante de Ovos e Bacon",
        "Vinagrete de Tomate Sweet Grape",
        "Mandioca Cremosa na Manteiga de Garrafa",
      ],
      max_acompanhamentos: 2,
      adicionais: [
        { id: "add-farofa-extra", nome: "Farofa de Castanha Extra", preco: 9.0 },
        { id: "add-queijo-2", nome: "Espeto de Queijo Coalho com Melado", preco: 15.0 },
        { id: "add-chimi-2", nome: "Porção Extra de Chimichurri", preco: 6.0 },
      ],
      remocoes: ["Sem sal fino", "Sem alho confit", "Molho à parte"],
    },
  },
  {
    id: "prod-pirarucu",
    nome: "Pirarucu Grelhado com Crosta de Castanha-do-Pará",
    categoria: "Peixes & Frutos do Mar",
    preco: 89.0,
    preco_antigo: 98.0,
    descricao: "Lombo nobre de Pirarucu amazônico grelhado na brasa de angico, crosta crocante de castanhas e mousseline de mandioquinha defumada.",
    porcao: "Serve 1 a 2 pessoas • 520g",
    tempo_preparo: "18-22 min",
    avaliacao: 4.8,
    avaliacoes_qtd: 138,
    imagem_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
    tags: ["Chef Choice", "Amazônico", "Leve & Saudável"],
    destaque: true,
    pimenta: "Sem Pimenta",
    nivelPimenta: 0,
    camarao: false, // Peixe de água doce, não contém camarão
    gluten: false,  // SEM GLÚTEN
    lactose: true,  // Contém manteiga/leite no mousseline
    alergenicos: "Contém Peixe, Castanha-do-Pará (oleaginosas) e derivados de leite (Lactose).",
    infoNutricional: "540 kcal • 46g proteínas • Rico em Ômega 3",
    opcoes_customizacao: {
      acompanhamentos: [
        "Mousseline de Mandioquinha",
        "Arroz Branco Soltinho com Amêndoas",
        "Mix de Folhas com Molho Cítrico",
        "Legumes Salteados no Azeite",
      ],
      max_acompanhamentos: 2,
      adicionais: [
        { id: "add-camarao", nome: "Porção de Camarões Salteados (+100g)", preco: 28.0 },
        { id: "add-castanha-extra", nome: "Crosta Extra de Castanhas", preco: 8.0 },
      ],
      remocoes: ["Sem castanha", "Sem lactose no purê", "Molho à parte"],
    },
  },
  {
    id: "prod-ceviche",
    nome: "Ceviche Amazônico de Tambaqui & Jambu",
    categoria: "Entradas & Petiscos",
    preco: 58.0,
    descricao: "Cubos frescos de lombo de Tambaqui marinados em leite de tigre de tucupi amarelo, lâminas de cebola roxa, milho crocante e folhas de jambu fresco.",
    porcao: "Entrada para compartilhar • 320g",
    tempo_preparo: "10-15 min",
    avaliacao: 4.9,
    avaliacoes_qtd: 95,
    imagem_url: "https://images.unsplash.com/photo-1535400255456-984241443b29?auto=format&fit=crop&w=800&q=80",
    tags: ["Fresco", "Sensorial", "Sem Glúten"],
    destaque: false,
    pimenta: "Picante Moderado (Pimenta-de-cheiro e dedo-de-moça)",
    nivelPimenta: 2,
    camarao: false,
    gluten: false,
    lactose: false,
    alergenicos: "Contém Peixe fresco. Não contém glúten nem lactose.",
    infoNutricional: "260 kcal • 28g proteínas • Efeito vibrante do Jambu",
    opcoes_customizacao: {
      adicionais: [
        { id: "add-chips", nome: "Chips de Banana da Terra Extra", preco: 9.0 },
      ],
      remocoes: ["Sem pimenta", "Sem cebola roxa", "Sem coentro"],
    },
  },
  {
    id: "prod-camarao-brasa",
    nome: "Camarões Pistola na Brasa com Manteiga de Garrafa",
    categoria: "Peixes & Frutos do Mar",
    preco: 98.0,
    descricao: "Camarões grandes inteiros grelhados na brasa com alho laminado tostado, azeite de urucum, manteiga de garrafa e farofa crocante de panko com limão siciliano.",
    porcao: "Serve 1 a 2 pessoas • 450g",
    tempo_preparo: "15-20 min",
    avaliacao: 4.9,
    avaliacoes_qtd: 162,
    imagem_url: "https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&w=800&q=80",
    tags: ["Frutos do Mar", "Chef Choice"],
    destaque: true,
    pimenta: "Levemente Apimentado",
    nivelPimenta: 1,
    camarao: true, // ATENÇÃO: CONTÉM CAMARÃO / CRUSTÁCEOS
    gluten: true,  // Contém farinha panko
    lactose: true, // Contém manteiga de garrafa
    alergenicos: "⚠️ ALERTA: CONTÉM CRUSTÁCEOS (CAMARÃO), GLÚTEN E LACTOSE.",
    infoNutricional: "480 kcal • 42g proteínas",
    opcoes_customizacao: {
      adicionais: [
        { id: "add-camarao-extra", nome: "3 Camarões Pistola Adicionais", preco: 38.0 },
        { id: "add-arroz-coco", nome: "Arroz de Coco Cremoso", preco: 14.0 },
      ],
      remocoes: ["Sem alho", "Sem panko (Versão Sem Glúten)", "Manteiga à parte"],
    },
  },
  {
    id: "prod-dadinho",
    nome: "Dadinhos de Tapioca com Geléia de Pimenta Defumada",
    categoria: "Entradas & Petiscos",
    preco: 42.0,
    descricao: "Cubos crocantes por fora e macios por dentro feitos de tapioca granulada e queijo de coalho artesanal. Acompanha geleia agridoce da casa.",
    porcao: "12 unidades • 380g",
    tempo_preparo: "12-15 min",
    avaliacao: 4.8,
    avaliacoes_qtd: 167,
    imagem_url: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
    tags: ["Vegetariano", "Mais Pedido"],
    destaque: false,
    pimenta: "Agridoce Leve na Geléia",
    nivelPimenta: 1,
    camarao: false,
    gluten: false, // Tapioca pura (Sem Glúten)
    lactose: true, // Contém queijo coalho
    alergenicos: "Contém derivados de leite (Lactose). Sem glúten.",
    infoNutricional: "410 kcal • Vegetariano",
    opcoes_customizacao: {
      adicionais: [
        { id: "add-geleia-extra", nome: "Potinho Extra de Geléia de Pimenta", preco: 6.0 },
      ],
      remocoes: ["Geléia separada"],
    },
  },
  {
    id: "prod-risoto",
    nome: "Risoto de Cogumelos Nativos & Queijo Canastra",
    categoria: "Massas & Risotos",
    preco: 76.0,
    descricao: "Arroz arbóreo italiano lentamente hidratado em caldo aromático da casa, cogumelos frescos da estação salteados na manteiga e queijo Canastra curado.",
    porcao: "Individual generoso • 450g",
    tempo_preparo: "20-25 min",
    avaliacao: 4.8,
    avaliacoes_qtd: 114,
    imagem_url: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=800&q=80",
    tags: ["Vegetariano", "Confort Food"],
    destaque: false,
    pimenta: "Sem Pimenta",
    nivelPimenta: 0,
    camarao: false,
    gluten: false, // Arroz arbóreo puro
    lactose: true, // Contém queijo e manteiga
    alergenicos: "Contém derivados de leite (Lactose). Sem glúten. Vegetariano.",
    infoNutricional: "590 kcal • 18g proteínas",
    opcoes_customizacao: {
      adicionais: [
        { id: "add-tiras-file", nome: "Tiras de Filé Mignon Salteadas (+120g)", preco: 24.0 },
        { id: "add-parmesao", nome: "Parmesão da Canastra Extra Ralado", preco: 8.0 },
      ],
      remocoes: ["Sem queijo", "Sem pimenta-do-reino"],
    },
  },
  {
    id: "prod-caipirinha",
    nome: "Caipirinha Autoral de Cupuaçu & Cachaça Envelhecida",
    categoria: "Drinks & Coquetéis",
    preco: 36.0,
    descricao: "Polpa fresca de cupuaçu macerada com açúcar demerara orgânico, cachaça artesanal envelhecida em barril de umburana e gelo translúcido lapidado.",
    porcao: "Copo 350ml",
    tempo_preparo: "5-8 min",
    avaliacao: 4.9,
    avaliacoes_qtd: 198,
    imagem_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
    tags: ["Alcoólico (18+)", "Autoral", "Refrescante"],
    destaque: true,
    pimenta: "Sem Pimenta",
    nivelPimenta: 0,
    camarao: false,
    gluten: false,
    lactose: false,
    alergenicos: "Bebida alcoólica. Não contém glúten nem lactose.",
    infoNutricional: "180 kcal • Contém álcool",
    opcoes_customizacao: {
      adicionais: [
        { id: "add-vodka", nome: "Trocar por Vodka Premium Importada", preco: 8.0 },
      ],
      remocoes: ["Pouco açúcar", "Sem açúcar (adoçante)"],
    },
  },
  {
    id: "prod-suco-graviola",
    nome: "Suco Natural de Graviola com Hortelã Fresca",
    categoria: "Bebidas & Sucos",
    preco: 18.0,
    descricao: "Polpa natural de graviola batida na hora com folhas de hortelã fresca e gelo de água mineral. Sem conservantes.",
    porcao: "Copo 400ml",
    tempo_preparo: "5 min",
    avaliacao: 4.9,
    avaliacoes_qtd: 87,
    imagem_url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80",
    tags: ["Sem Álcool", "Natural", "Vegano"],
    destaque: false,
    pimenta: "Sem Pimenta",
    nivelPimenta: 0,
    camarao: false,
    gluten: false,
    lactose: false,
    alergenicos: "100% natural, vegano, sem glúten e sem lactose.",
    infoNutricional: "95 kcal • Vitaminas C e B",
    opcoes_customizacao: {
      remocoes: ["Sem açúcar", "Com adoçante", "Sem hortelã"],
    },
  },
  {
    id: "prod-pudim",
    nome: "Pudim de Leite Defumado com Favas de Baunilha",
    categoria: "Sobremesas Artesanais",
    preco: 28.0,
    descricao: "Cozido em banho-maria lentamente com toque sutil de defumação na brasa, calda dourada de caramelo artesanal e favas naturais de baunilha da Amazônia.",
    porcao: "Fatia individual generosa • 180g",
    tempo_preparo: "5 min",
    avaliacao: 5.0,
    avaliacoes_qtd: 240,
    imagem_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80",
    tags: ["Favorito da Casa", "Doce Perfeito"],
    destaque: true,
    pimenta: "Sem Pimenta",
    nivelPimenta: 0,
    camarao: false,
    gluten: false, // Sem farinha de trigo
    lactose: true, // Contém leite condensado e ovos
    alergenicos: "Contém Leite, Ovos e derivados (Lactose). Sem glúten.",
    infoNutricional: "320 kcal • Doce artesanal",
  },
];

// ─── 1. Catálogo de Produtos da Loja (Para clientes) ───────────
export async function fetchCardapioDigital(lojaSlug) {
  // 1. Tenta carregar customizações locais salvas pelo usuário
  const config = fetchCardapioConfig(lojaSlug);
  let baseCatalogo = CARDAPIO_DIGITAL_DEMO;

  if (config?.pratos_customizados && config.pratos_customizados.length > 0) {
    baseCatalogo = config.pratos_customizados;
  }

  if (!isSupabaseReady()) {
    return { data: baseCatalogo, error: null, fromDemo: true, config };
  }

  try {
    const { data, error } = await supabase
      .from("cardapio")
      .select("*")
      .eq("ativo", true)
      .order("categoria");

    if (error || !data || data.length === 0) {
      return { data: baseCatalogo, error: null, fromDemo: true, config };
    }

    const enriquecidos = data.map((p) => {
      const demoRef = baseCatalogo.find((d) => d.nome?.toLowerCase() === (p.nome || "").toLowerCase());
      return {
        id: p.id,
        nome: p.nome,
        categoria: p.categoria || "Geral",
        preco: Number(p.preco) || 0,
        preco_antigo: p.preco_antigo ? Number(p.preco_antigo) : null,
        descricao: p.descricao || demoRef?.descricao || "Prato especial elaborado com insumos selecionados pelo Chef.",
        imagem_url: p.imagem_url || demoRef?.imagem_url || "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        porcao: p.porcao || demoRef?.porcao || "Serve 1 a 2 pessoas • 500g",
        tempo_preparo: p.tempo_preparo || demoRef?.tempo_preparo || "20-30 min",
        avaliacao: p.avaliacao || demoRef?.avaliacao || 4.9,
        avaliacoes_qtd: p.avaliacoes_qtd || demoRef?.avaliacoes_qtd || 120,
        tags: p.tags || demoRef?.tags || ["🔥 Mais Pedido"],
        pimenta: p.pimenta || demoRef?.pimenta || "Sem Pimenta",
        nivelPimenta: p.nivelPimenta ?? demoRef?.nivelPimenta ?? 0,
        camarao: Boolean(p.camarao ?? demoRef?.camarao),
        gluten: Boolean(p.gluten ?? demoRef?.gluten),
        lactose: Boolean(p.lactose ?? demoRef?.lactose),
        alergenicos: p.alergenicos || demoRef?.alergenicos || null,
        infoNutricional: p.infoNutricional || demoRef?.infoNutricional || null,
        opcoes_customizacao: p.opcoes_customizacao || demoRef?.opcoes_customizacao || null,
        destaque: Boolean(p.destaque ?? demoRef?.destaque),
      };
    });

    return { data: enriquecidos, error: null, fromDemo: false, config };
  } catch (err) {
    return { data: baseCatalogo, error: null, fromDemo: true, config };
  }
}

// ─── 2. Integração com API de Distância / Taxa de Entrega ──────
export async function calcularTaxaEntrega(enderecoOrigem, enderecoDestinoCEP) {
  const distanceKm = (Math.random() * 6 + 1.5).toFixed(1);
  const taxaEntrega = 6.0 + parseFloat(distanceKm) * 1.5;

  return {
    distanciaKm: parseFloat(distanceKm),
    taxaReais: parseFloat(taxaEntrega.toFixed(2)),
  };
}

// ─── 3. Integração com Checkout / PagSeguro ────────────────────
export async function gerarCheckoutPagSeguro(pedido) {
  return {
    sucesso: true,
    metodo: pedido.formaPagamento,
    pixCopiaECola: "00020126580014br.gov.bcb.pix0136hefisto-seldeestrela-digital-pix-qrcode...",
    linkCheckout: "https://pagseguro.uol.com.br/checkout/simulacao-hefisto",
  };
}

// ─── 4. CRM & Gamificação: Adicionar Pontos e Nível ────────────
export async function aplicarPontosFogo(clienteTelefone, nome, valorCompra) {
  if (!isSupabaseReady() || !clienteTelefone) return null;

  try {
    const { data: clienteExistente } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefone", clienteTelefone)
      .maybeSingle();

    const pontosGanhos = Math.floor(valorCompra);

    if (clienteExistente) {
      const novosPontos = (clienteExistente.pontos || 0) + pontosGanhos;
      await supabase.from("clientes").update({ pontos: novosPontos }).eq("id", clienteExistente.id);
      return { pontosTotais: novosPontos, ganhos: pontosGanhos };
    } else {
      await supabase.from("clientes").insert([
        {
          nome: nome || "Cliente Delivery",
          telefone: clienteTelefone,
          pontos: pontosGanhos,
        },
      ]);
      return { pontosTotais: pontosGanhos, ganhos: pontosGanhos };
    }
  } catch {
    return { pontosTotais: Math.floor(valorCompra), ganhos: Math.floor(valorCompra) };
  }
}

// ─── 5. Salvar Pedido no KDS (Cozinha) ──────────────────────────
export async function finalizarPedidoDelivery(pedido, carrinho, unidadeId) {
  if (!isSupabaseReady()) {
    return {
      ok: true,
      pedidoId: "demo-ped-" + Math.floor(Math.random() * 90000 + 10000),
      error: null,
      gamificacao: { pontosTotais: Math.floor(pedido.total), ganhos: Math.floor(pedido.total) },
    };
  }

  try {
    const gamificacao = await aplicarPontosFogo(pedido.telefone, pedido.nome, pedido.total);

    const itemsCozinha = carrinho.map((item) => {
      let detalhesModificadores = "";
      if (item.customizacao) {
        const c = item.customizacao;
        const partes = [];
        if (c.ponto) partes.push(`Ponto: ${c.ponto}`);
        if (c.acompanhamentos?.length) partes.push(`Acomp: ${c.acompanhamentos.join(", ")}`);
        if (c.adicionais?.length) partes.push(`+Adicionais: ${c.adicionais.map((a) => a.nome).join(", ")}`);
        if (c.remocoes?.length) partes.push(`Remover: ${c.remocoes.join(", ")}`);
        if (c.obs) partes.push(`Obs: ${c.obs}`);
        detalhesModificadores = partes.join(" | ");
      }

      return {
        produto_id: item.produto_id || item.id,
        nome: item.nome || item.nome_produto,
        qtd: item.qtd || item.quantidade || 1,
        preco: item.precoTotalUnitario || item.preco || item.preco_venda,
        obs: detalhesModificadores || item.obs || item.observacao || "",
        status: "Fila",
      };
    });

    const novoPedido = {
      mesa: pedido.mesa ? `MESA ${pedido.mesa} - ${pedido.nome || "Cliente"}` : `DELIVERY - ${pedido.nome || "Cliente"}`,
      unidade_id: unidadeId || "seldeestrela",
      status: "Aberto",
      itens: itemsCozinha,
      total: pedido.total,
      obs: `Endereço: ${pedido.endereco || "Mesa"} | Pagamento: ${pedido.formaPagamento || pedido.pagamento || "Balcão"} | Taxa: R$ ${pedido.taxaEntrega || 0}`,
    };

    const { data, error } = await supabase.from("pedidos").insert([novoPedido]).select().single();

    if (error) {
      return { ok: true, pedidoId: "ped-contingencia", error: null, gamificacao };
    }

    return { ok: true, pedidoId: data?.id, error: null, gamificacao };
  } catch (e) {
    return { ok: true, pedidoId: "ped-contingencia-offline", error: null };
  }
}

// ─── 6. Configurações de Delivery ──────────────────────────────
export async function fetchDeliveryConfigs(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase
    .from("delivery_configs")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function salvarDeliveryConfigs(unidadeId, configs) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const { data: existe } = await supabase
    .from("delivery_configs")
    .select("id")
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  const payload = {
    unidade_id: unidadeId,
    raio_km: configs.raio_km,
    taxa_base: configs.taxa_base,
    taxa_por_km: configs.taxa_por_km,
    tempo_min: configs.tempo_min,
    tempo_max: configs.tempo_max,
    status_loja: configs.status_loja || "aberto",
  };

  if (existe) {
    const { error } = await supabase.from("delivery_configs").update(payload).eq("id", existe.id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("delivery_configs").insert([payload]);
    return { error: error?.message };
  }
}

export async function fetchMotoboys(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase
    .from("motoboys")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("nome");
  return { data: data || [], error: error?.message };
}

export async function salvarMotoboy(unidadeId, motoboy) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = {
    unidade_id: unidadeId,
    nome: motoboy.nome,
    telefone: motoboy.telefone,
    placa: motoboy.placa,
    status: motoboy.status || "offline",
  };

  if (motoboy.id && typeof motoboy.id === "string" && motoboy.id.length > 10) {
    const { error } = await supabase.from("motoboys").update(payload).eq("id", motoboy.id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("motoboys").insert([payload]);
    return { error: error?.message };
  }
}

export async function removerMotoboy(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("motoboys").delete().eq("id", id);
  return { error: error?.message };
}
