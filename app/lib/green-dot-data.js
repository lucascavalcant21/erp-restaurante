// Base de conhecimento operacional, motor de recálculo proporcional de receitas,
// catálogo visual de equipamentos (110V/220V, encaixe, uso, limpeza) e persistência de cadastros.

export const TOPICOS_INICIAIS = {
  producao: [
    { id: "vatapa-baiano", label: "Vatapá da Casa (Passo a Passo + Vídeo)", prompt: "Como se faz um vatapá?" },
    { id: "recalculo-vatapa", label: "Recalcular Vatapá (Só tenho 2L de Leite de Coco)", prompt: "Tenho todos os ingredientes do vatapá, só o leite de coco que era para ser 3L e só tenho 2L" },
    { id: "risoto-camarao", label: "Risoto de Camarão Trufado", prompt: "Quero aprender a fazer o Risoto de Camarão Trufado perfeito." },
    { id: "moscow-mule", label: "Moscow Mule da Casa", prompt: "Como preparar o Moscow Mule Artesanal com espuma de gengibre?" },
    { id: "file-parmegiana", label: "Filé à Parmegiana", prompt: "Mostre a ficha técnica e montagem do Filé à Parmegiana da Casa." },
  ],
  equipamentosDuvidas: [
    { id: "qual-voltagem-liq", label: "Liquidificador é 110V ou 220V?", prompt: "Esse liquidificador é 110V ou 220V?" },
    { id: "encaixar-copo-liq", label: "Como encaixar copo e tampa do Liquidificador", prompt: "Como encaixar o copo e a tampa do liquidificador, como usar e como limpar?" },
    { id: "forno-vapor", label: "Forno Combinado Oscilando", prompt: "O Forno Combinado não está mantendo o vapor e a temperatura constantes. Como consertar?" },
    { id: "chopeira-espuma", label: "Chopeira Tirando Muita Espuma", prompt: "A chopeira de 2 vias está saindo só espuma. Qual o diagnóstico?" },
  ],
  estoque: [
    { id: "pull-to-thaw", label: "Descongelamento (Pull-to-Thaw)", prompt: "Qual a tabela e procedimento de descongelamento seguro (Pull-to-Thaw) para o turno?" },
    { id: "organizacao-camara", label: "Organização de Câmara & PVPS", prompt: "Como organizar a câmara fria e aplicar a regra PVPS na cozinha?" },
  ],
  escala: [
    { id: "escala-organograma", label: "Organograma por Área & Horários", prompt: "Qual a escala de hoje? Mostre por área em formato de organograma as pessoas e seus horários de trabalho." },
    { id: "mapa-pracas", label: "Mapa de Praças (Play Caller)", prompt: "Mostre o posicionamento da equipe nas praças para o horário de pico." },
    { id: "escala-turno", label: "Escala do Dia & Picos (Gantt)", prompt: "Abrir a escala horária do turno e previsão de pico." },
  ],
  limpeza: [
    { id: "limpeza-chao", label: "Limpar Chão (ml & Produto)", prompt: "Qual produto usar no chão, quantas ml e como limpar?" },
    { id: "limpeza-panos", label: "Higienizar Panos (Cloro & Cores)", prompt: "Como limpar e desinfetar um pano de cozinha, qual produto e quantas ml?" },
    { id: "lavagem-maos", label: "Lavar as Mãos (ANVISA)", prompt: "Qual o procedimento correto para lavar as mãos e qual produto usar?" },
  ],
  checklists: [
    { id: "checklist-abertura", label: "☀️ Checklist de Abertura da Praça", prompt: "Abrir o checklist de abertura e mise en place da cozinha e bar." },
    { id: "checklist-fechamento", label: "🌙 Checklist de Saída / Fechamento", prompt: "Abrir o checklist de saída e fechamento de turno da cozinha e bar." },
    { id: "etiqueta-validade", label: "🏷️ Gerar Etiqueta ANVISA", prompt: "Quero gerar uma etiqueta de validade para um produto manipulado." },
  ],
  rastreio: [
    { id: "rastreio-vatapa", label: "📍 Onde está o Vatapá?", prompt: "Onde está o vatapá produzido?" },
    { id: "rastreio-camarao", label: "🦐 Onde está o Camarão?", prompt: "Onde guardaram o camarão para o turno?" },
    { id: "rastreio-leite-coco", label: "🥥 Onde fica o Leite de Coco?", prompt: "Onde está o leite de coco no estoque?" },
    { id: "rastreio-bar", label: "🍸 Onde está a Espuma do Bar?", prompt: "Onde está a espuma de gengibre do Moscow Mule?" },
  ],
};

export const RECEITAS_GREEN_DOT = [
  {
    id: "vatapa-baiano",
    codigo: "VTP-01",
    nome: "Vatapá* Tradicional da Casa",
    subtituloNota: "*Base oficial de 3L de Leite de Coco — Rende 30 porções (6,5 kg)",
    setor: "Cozinha Quente & Regional",
    tempoPreparo: "35 min",
    temperaturaServico: "72°C – 78°C",
    rendimentoPorcoes: 30,
    rendimentoPeso: "6,5 kg",
    imagem: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=80",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    descricao:
      "Vatapá cremoso e aveludado preparado com leite de coco puro, camarão seco defumado, castanha de caju, amendoim torrado, pão hidratado, gengibre fresco e finalizado no azeite de dendê.",
    perfilSensorial: {
      sabor: "Intenso de camarão seco, castanhas & dendê",
      aroma: "Leite de coco fresco, coentro & gengibre",
      textura: "Cremoso estruturado que desgruda da panela",
    },
    basePrincipal: "Leite de Coco (3L) + Camarão Seco + Castanha & Amendoim",
    colunasTamanho: ["P", "M", "G", "PAN"],
    legendaTamanhos: "P = Acarajé/Acomp. (120g) · M = Individual (220g) · G = Duplo (450g) · PAN = Panela Base (6,5kg)",
    ingredientesBase: [
      { id: "leite-coco", nome: "Leite de coco", quantidade: 3, unidade: "L", sinonimos: ["leite de coco", "coco"] },
      { id: "pao-amanhecido", nome: "Pão francês amanhecido (ou farinha de pão)", quantidade: 1.8, unidade: "kg", sinonimos: ["pão", "pao", "farinha"] },
      { id: "camarao-seco", nome: "Camarão seco dessalgado e limpo", quantidade: 1.5, unidade: "kg", sinonimos: ["camarão", "camarao"] },
      { id: "azeite-dende", nome: "Azeite de dendê puro", quantidade: 900, unidade: "ml", sinonimos: ["dendê", "dende", "azeite"] },
      { id: "cebola-roxa", nome: "Cebola roxa picada", quantidade: 900, unidade: "g", sinonimos: ["cebola"] },
      { id: "castanha-caju", nome: "Castanha de caju torrada sem sal", quantidade: 600, unidade: "g", sinonimos: ["castanha"] },
      { id: "amendoim", nome: "Amendoim torrado sem pele", quantidade: 600, unidade: "g", sinonimos: ["amendoim"] },
      { id: "gengibre", nome: "Gengibre fresco ralado", quantidade: 90, unidade: "g", sinonimos: ["gengibre"] },
      { id: "alho", nome: "Alho descascado", quantidade: 60, unidade: "g", sinonimos: ["alho"] },
      { id: "cheiro-verde", nome: "Coentro e cebolinha fresca", quantidade: 3, unidade: "maço", sinonimos: ["coentro", "cheiro verde"] },
    ],
    majorSteps: [
      { id: 1, etapa: "Leite de coco puro para hidratar e bater (Litros)", valores: ["0.1", "0.2", "0.5", "3"] },
      { id: 2, etapa: "Mix de Castanha + Amendoim + Camarão seco (g)", valores: ["90", "180", "450", "2700"] },
      { id: 3, etapa: "Pão amanhecido hidratado no leite de coco (g)", valores: ["60", "120", "300", "1800"] },
      { id: 4, etapa: "Azeite de dendê para apurar o ponto (ml)", valores: ["30", "60", "150", "900"] },
    ],
    videoSteps: [
      {
        ordem: 1,
        titulo: "Hidratar o pão em 1,5L do leite de coco por 10 min",
        detalhe: "Rasgue os pães em pedaços médios e mergulhe na metade do leite de coco até amolecer completamente.",
        imagem: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 2,
        titulo: "Bater no Liquidificador Industrial (Castanhas, Camarão e Temperos)",
        detalhe: "Bata o restante do leite de coco com o amendoim, castanha de caju, metade do camarão seco, cebola, alho, gengibre e o pão hidratado até formar um creme liso.",
        imagem: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 3,
        titulo: "Cozinhar em fogo médio mexendo sempre + Fio de Dendê",
        detalhe: "Leve ao fogo com o restante dos camarões inteiros. Mexa sem parar com colher longa por 20 min. Adicione o azeite de dendê aos poucos até soltar do fundo da panela e brilhar.",
        imagem: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
      },
    ],
    customizacoes: [
      {
        id: "adaptacao-vatapa",
        label: "Adaptações de preparo e restrições",
        opcoes: [
          { id: "sem-gluten-fuba", label: "Versão Sem Glúten: substituir pão por creme de arroz ou fubá fino (1,2 kg)" },
          { id: "menos-dende", label: "Versão Suave: reduzir azeite de dendê em 30%" },
          { id: "vegetariano", label: "Versão Vegana: substituir camarão por palmito pupunha e alga nori tostada" },
        ],
      },
      { id: "camarao-topo", label: "Finalizar com 3 camarões grelhados inteiros no topo" },
      { id: "molho-pimenta", label: "Enviar pimenta malagueta no dendê à parte" },
    ],
    dicasCategorias: {
      customizacao: "Se o vatapá começar a empelotar na panela, retire do fogo por 1 minuto e bata vigorosamente com um fouet antes de adicionar o dendê.",
      sabor: "O gengibre fresco ralado na hora é o segredo que equilibra a potência do dendê e evita que o prato fique enjoativo.",
      substituicoes: "Caso tenha menos leite de coco no estoque, toque em 'Recalcular Receita' ou digite quanto você tem que eu ajusto todos os pesos na hora!",
    },
    harmonizacoes: [
      {
        id: "moqueca-peixe",
        nome: "Combo Baiano: Moqueca de Robalo + Arroz de Coco",
        preco: "R$ 89,90",
        calorias: "640 kcal · 2 pessoas",
        motivo: "O Vatapá da Casa é a guarnição indispensável da nossa Moqueca. Sugira como acompanhamento extra na mesa!",
        imagem: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "caipirinha-caju",
        nome: "Caipirinha Autoral de Caju com Limão Cravo",
        preco: "R$ 32,00",
        calorias: "195 kcal · 300ml",
        motivo: "A acidez e tanino do caju limpam o paladar entre cada garfada do vatapá.",
        imagem: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "risoto-camarao",
    codigo: "RCT-01",
    nome: "Risoto de Camarão* Trufado",
    subtituloNota: "*Camarão Rosa GG limpo sem casca (16/20)",
    setor: "Cozinha Quente",
    tempoPreparo: "14 min",
    temperaturaServico: "68°C – 72°C",
    rendimentoPorcoes: 4,
    rendimentoPeso: "1,28 kg",
    imagem: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=1000&q=80",
    descricao:
      "Arroz Carnaroli italiano cozido lentamente em caldo artesanal de crustáceos, finalizado com manteiga de trufas brancas, camarões rosa grelhados no ponto perfeito e raspas de limão siciliano.",
    perfilSensorial: {
      sabor: "Umami marinho & notas amanteigadas de trufa",
      aroma: "Trufa branca suave & limão siciliano fresco",
      textura: "Cremoso (all'onda) com grão al dente",
    },
    basePrincipal: "Arroz Carnaroli & Caldo de Camarão Reduzido",
    colunasTamanho: ["P", "M", "G", "FAM"],
    legendaTamanhos: "P = Executivo (220g) · M = Individual (320g) · G = Duplo (580g) · FAM = Família (950g)",
    ingredientesBase: [
      { id: "arroz-carnaroli", nome: "Arroz Carnaroli", quantidade: 400, unidade: "g", sinonimos: ["arroz", "carnaroli", "arbório", "arborio"] },
      { id: "camarao-rosa", nome: "Camarão Rosa GG limpo", quantidade: 600, unidade: "g", sinonimos: ["camarão", "camarao"] },
      { id: "caldo-crustaceos", nome: "Caldo de crustáceos artesanal", quantidade: 1.5, unidade: "L", sinonimos: ["caldo"] },
      { id: "manteiga-sem-sal", nome: "Manteiga extra sem sal gelada", quantidade: 120, unidade: "g", sinonimos: ["manteiga"] },
      { id: "parmesao", nome: "Queijo Parmesão ralado fino", quantidade: 100, unidade: "g", sinonimos: ["parmesão", "parmesao", "queijo"] },
      { id: "vinho-branco", nome: "Vinho branco seco", quantidade: 120, unidade: "ml", sinonimos: ["vinho"] },
      { id: "azeite-trufado", nome: "Azeite de trufas brancas", quantidade: 20, unidade: "ml", sinonimos: ["trufa", "azeite trufado"] },
    ],
    majorSteps: [
      { id: 1, etapa: "Porções de base de arroz Carnaroli pré-cocido (100g)", valores: ["1", "1.5", "3", "5"] },
      { id: 2, etapa: "Camarão Rosa GG selado na manteiga clarificada (unid.)", valores: ["4", "6", "12", "20"] },
      { id: 3, etapa: "Conchas de caldo de crustáceos fervente (90ml)", valores: ["2", "3", "5", "8"] },
      { id: 4, etapa: "Doses de azeite/manteiga trufada na mantecatura (5ml)", valores: ["1", "2", "3", "5"] },
    ],
    videoSteps: [
      {
        ordem: 1,
        titulo: "Selar camarões em alta temperatura (220°C)",
        detalhe: "Sele os camarões secos em papel absorvente por 45 segundos de cada lado até dourar, sem cozinhar demais. Reserve aquecido.",
        imagem: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 2,
        titulo: "Deglaçar com vinho branco e incorporar caldo",
        detalhe: "Adicione 30ml de vinho branco seco, deixe evaporar o álcool e adicione o caldo fervente aos poucos mexendo constantemente.",
        imagem: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 3,
        titulo: "Mantecatura fora do fogo (Ponto All'Onda)",
        detalhe: "Desligue o fogo, adicione a manteiga gelada em cubos, o parmesão maturado e a pasta de trufas. Bata vigorosamente.",
        imagem: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=900&q=80",
      },
    ],
    customizacoes: [
      {
        id: "trocar-base",
        label: "Substituir base ou laticínio (Alergênicos)",
        opcoes: [
          { id: "ghee", label: "Manteiga Ghee sem lactose" },
          { id: "azeite-extra", label: "Emulsão de Azeite Extra Virgem (100% Sem Leite)" },
          { id: "arroz-negro", label: "Arroz Negro Integral (+4 min de cocção)" },
        ],
      },
      { id: "extra-camarao", label: "Adicionar porção extra de Camarão GG (+4 unid.)" },
      { id: "sem-trufa", label: "Retirar azeite de trufas (finalizar apenas com ervas e limão)" },
      { id: "crocante-alho", label: "Adicionar pangrattato crocante de ervas no topo" },
    ],
    dicasCategorias: {
      customizacao: "Para pedidos Sem Lactose, substitua a manteiga tradicional e o parmesão por 25ml de azeite extravirgem batido com gelo na mantecatura — mantém a cremosidade perfeita.",
      sabor: "Raspas de limão siciliano frescas (nunca a parte branca) entram apenas no empratamento final para cortar a riqueza da trufa.",
      substituicoes: "Se o Camarão 16/20 estiver em ruptura, utilize Polvo grelhado (140g) ou Vieira Canadense selada seguindo a mesma base.",
    },
    harmonizacoes: [
      {
        id: "vinho-sauvignon",
        nome: "Taça Sauvignon Blanc Reserva",
        preco: "R$ 34,90",
        calorias: "125 kcal · 150ml",
        motivo: "As notas cítricas e a acidez viva deste Sauvignon Blanc equilibram perfeitamente a untuosidade da manteiga trufada! Ótima sugestão para o garçom oferecer na mesa.",
        imagem: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "bruschetta-brie",
        nome: "Entrada: Bruschetta de Brie com Mel Trufado",
        preco: "R$ 29,50",
        calorias: "310 kcal · 4 unid.",
        motivo: "Prepara o paladar com notas florais e crocância antes do prato principal, aumentando o ticket médio da mesa.",
        imagem: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "torta-limao",
        nome: "Sobremesa: Tartelette de Limão Siciliano",
        preco: "R$ 24,00",
        calorias: "380 kcal · 130g",
        motivo: "Conecta-se com o toque cítrico do risoto e limpa o paladar após uma refeição intensa.",
        imagem: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "moscow-mule",
    codigo: "MMA-03",
    nome: "Moscow Mule* Artesanal da Casa",
    subtituloNota: "*Receita oficial com espuma autoral de gengibre no sifão",
    setor: "Bar & Coquetelaria",
    tempoPreparo: "2 min",
    temperaturaServico: "2°C – 4°C",
    rendimentoPorcoes: 1,
    rendimentoPeso: "320 ml",
    imagem: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1000&q=80",
    descricao:
      "Vodka tridestilada combinada com suco de limão taiti espremido na hora, xarope artesanal de gengibre fresco e coroado com nossa espuma cremosa de gengibre e limão siciliano na caneca de cobre gelada.",
    perfilSensorial: {
      sabor: "Picante de gengibre & cítrico equilibrado",
      aroma: "Gengibre fresco & hortelã recém-batida",
      textura: "Corpo leve gaseificado com topo aveludado",
    },
    basePrincipal: "Vodka Premium + Xarope de Gengibre da Casa",
    colunasTamanho: ["P", "T", "G", "JAR"],
    legendaTamanhos: "P = Degustação (180ml) · T = Caneca Cobre (320ml) · G = Double (450ml) · JAR = Jarra Mesa (1L)",
    ingredientesBase: [
      { id: "vodka", nome: "Vodka Premium", quantidade: 50, unidade: "ml", sinonimos: ["vodka"] },
      { id: "xarope-gengibre", nome: "Xarope artesanal de gengibre", quantidade: 30, unidade: "ml", sinonimos: ["xarope", "gengibre"] },
      { id: "suco-limao", nome: "Suco de limão taiti fresco", quantidade: 20, unidade: "ml", sinonimos: ["limão", "limao", "suco"] },
      { id: "agua-gas", nome: "Água com gás alta pressão", quantidade: 60, unidade: "ml", sinonimos: ["água", "agua"] },
      { id: "espuma-gengibre", nome: "Espuma de gengibre (sifão)", quantidade: 40, unidade: "ml", sinonimos: ["espuma"] },
    ],
    majorSteps: [
      { id: 1, etapa: "Doses de Vodka Premium (dosador 50ml)", valores: ["0.5", "1", "1.5", "3"] },
      { id: 2, etapa: "Pumps de xarope artesanal de gengibre (15ml)", valores: ["1", "2", "3", "6"] },
      { id: 3, etapa: "Suco de limão taiti fresco filtrado (20ml)", valores: ["0.5", "1", "1.5", "3"] },
      { id: 4, etapa: "Coroa de espuma de gengibre do sifão (cm)", valores: ["2", "3", "3", "4"] },
    ],
    videoSteps: [
      {
        ordem: 1,
        titulo: "Gelar a caneca de cobre e dosar a base alcoólica",
        detalhe: "Preencha a caneca de cobre com gelo cubo cristal até 3/4, adicione a vodka, o limão taiti e o xarope de gengibre.",
        imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 2,
        titulo: "Completar com água com gás alta pressão e mexer",
        detalhe: "Adicione 60ml de água com gás bem gelada e dê apenas 2 voltas suaves com a colher bailarina para não perder gás.",
        imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 3,
        titulo: "Aplicar espuma de sifão em espiral e decorar",
        detalhe: "Agite o sifão 3 vezes de cabeça para baixo, aplique a espuma formando colarinho alto e finalize com chip de gengibre desidratado.",
        imagem: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80",
      },
    ],
    customizacoes: [
      {
        id: "trocar-destilado",
        label: "Trocar destilado base",
        opcoes: [
          { id: "gin", label: "London Dry Gin (London Mule)" },
          { id: "bourbon", label: "Bourbon Whiskey (Kentucky Mule)" },
          { id: "zero", label: "Versão Mocktail Sem Álcool (Água tônica + infusão cítrica)" },
        ],
      },
      { id: "extra-gengibre", label: "Adicionar dose extra de picância (Xarope de Gengibre)" },
      { id: "frutas-vermelhas", label: "Infusão de Frutas Vermelhas na base" },
      { id: "sem-espuma", label: "Servir sem espuma (completar com Ginger Beer)" },
    ],
    dicasCategorias: {
      customizacao: "Se o cliente pedir menos doce, reduza o xarope para 1 pump e adicione 3 gotas de Angostura Bitters.",
      sabor: "Bata a folha de hortelã na palma da mão antes de posicionar na borda da caneca para liberar os óleos essenciais no nariz.",
      substituicoes: "Caso o sifão perca pressão no meio do pico, carregue uma segunda cápsula de N2O e agite vigorosamente por 8 segundos.",
    },
    harmonizacoes: [
      {
        id: "croqueta-costela",
        nome: "Croquetas de Costela Defumada (6 unid.)",
        preco: "R$ 38,00",
        calorias: "420 kcal",
        motivo: "A refrescância cítrica e picante do Moscow Mule corta a suculência da costela defumada com aioli de alho assado!",
        imagem: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "dadinho-tapioca",
        nome: "Dadinhos de Tapioca com Geleia de Pimenta",
        preco: "R$ 32,00",
        calorias: "390 kcal",
        motivo: "Harmonização por semelhança com o toque picante da geleia e textura crocante irresistível para happy hour.",
        imagem: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "file-parmegiana",
    codigo: "FPC-02",
    nome: "Filé à Parmegiana* Clássico",
    subtituloNota: "*Mignon limpo no padrão borboleta empanado na Panko",
    setor: "Grelha & Forno",
    tempoPreparo: "16 min",
    temperaturaServico: "75°C",
    rendimentoPorcoes: 4,
    rendimentoPeso: "1,8 kg",
    imagem: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=1000&q=80",
    descricao:
      "Filé mignon alto batido suavemente, empanado em farinha Panko crocante, coberto com molho de tomates San Marzano assados na casa e gratinado com mix de muçarela de búfala e parmesão.",
    perfilSensorial: {
      sabor: "Tomate rústico adocicado & queijo gratinado",
      aroma: "Manjericão fresco & manteiga dourada",
      textura: "Crosta ultra crocante com carne macia ao centro",
    },
    basePrincipal: "Filé Mignon + Molho Pelati Artesanal + Panko",
    colunasTamanho: ["EXEC", "IND", "DUPLO", "FAM"],
    legendaTamanhos: "EXEC = Almoço (160g carne) · IND = Padrão (220g) · DUPLO = 2 Pessoas (400g) · FAM = 4 Pessoas (750g)",
    ingredientesBase: [
      { id: "file-mignon", nome: "Filé Mignon limpo em escalopes", quantidade: 800, unidade: "g", sinonimos: ["filé", "file", "mignon", "carne"] },
      { id: "molho-tomate", nome: "Molho de tomate pelati artesanal", quantidade: 600, unidade: "ml", sinonimos: ["molho", "tomate", "pelati"] },
      { id: "mucarela", nome: "Queijo muçarela fatiado", quantidade: 400, unidade: "g", sinonimos: ["muçarela", "mussarela", "queijo"] },
      { id: "farinha-panko", nome: "Farinha Panko crocante", quantidade: 250, unidade: "g", sinonimos: ["panko", "farinha"] },
      { id: "ovos", nome: "Ovos batidos para empanar", quantidade: 4, unidade: "un", sinonimos: ["ovo", "ovos"] },
    ],
    majorSteps: [
      { id: 1, etapa: "Escalopes de Filé Mignon empanados na Panko (unid.)", valores: ["1", "1", "2", "4"] },
      { id: 2, etapa: "Conchas de Molho Pelati San Marzano quente (110ml)", valores: ["1", "1.5", "3", "5"] },
      { id: 3, etapa: "Porção de Mix Muçarela + Parmesão para gratinar (80g)", valores: ["1", "1.5", "2.5", "4"] },
      { id: 4, etapa: "Tempo de Salamandra / Forno Combinado 240°C (min)", valores: ["3", "3", "4", "5"] },
    ],
    videoSteps: [
      {
        ordem: 1,
        titulo: "Empanamento triplo seco (Trigo -> Ovo -> Panko)",
        detalhe: "Pressione a farinha Panko com a palma da mão para criar escamas aeradas que não encharcam no molho.",
        imagem: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 2,
        titulo: "Fritura de imersão a 180°C por 2m15s",
        detalhe: "Frite em óleo limpo estabilizado a 180°C até atingir dourado médio e escorra em grade metálica por 30s.",
        imagem: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 3,
        titulo: "Montagem e Gratinado na Salamandra",
        detalhe: "Coloque molho na base do prato refratário, apoie o filé para preservar a borda crocante, cubra o centro com queijo e gratine.",
        imagem: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
      },
    ],
    customizacoes: [
      {
        id: "trocar-guarnicao",
        label: "Trocar acompanhamento padrão",
        opcoes: [
          { id: "fritas-rusticas", label: "Batata Rústica com Alecrim e Páprica" },
          { id: "pure-cabotia", label: "Purê Aveludado de Cabotiá" },
          { id: "fettuccine", label: "Fettuccine na Manteiga e Sálvia" },
        ],
      },
      { id: "molho-parte", label: "Servir molho e queijo à parte (máxima crocância)" },
      { id: "sem-gluten", label: "Empanar em farinha de arroz e flocos de milho (Sem Glúten)" },
      { id: "extra-queijo", label: "Cobertura extra de Catupiry Original sob a muçarela" },
    ],
    dicasCategorias: {
      customizacao: "Para delivery, nunca cubra 100% da borda do filé com molho — deixe 2cm de borda Panko aparente para chegar crocante na casa do cliente.",
      sabor: "Finalize com um fio de azeite infusionado com manjericão fresco assim que sair da salamandra.",
      substituicoes: "Pode ser executado na versão Berinjela à Parmegiana (Vegetariano) usando a mesma proporção de molho e queijo.",
    },
    harmonizacoes: [
      {
        id: "malbec-reserva",
        nome: "Taça Malbec Argentino Reserva",
        preco: "R$ 36,00",
        calorias: "130 kcal · 150ml",
        motivo: "Taninos macios e notas de ameixa madura que abraçam a acidez do molho de tomate artesanal e o queijo gratinado!",
        imagem: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "pudim-leite",
        nome: "Pudim de Leite Condensado sem Furinhos",
        preco: "R$ 22,00",
        calorias: "410 kcal",
        motivo: "O clássico favorito de 8 em cada 10 clientes que pedem Parmegiana no almoço ou jantar.",
        imagem: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
];

// ── MOTOR INTELIGENTE DE RECÁLCULO PROPORCIONAL POR INGREDIENTE LIMITANTE ────
function normalizarTexto(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function converterParaMesmaUnidade(valor, unOrigem, unDestino) {
  const u1 = normalizarTexto(unOrigem);
  const u2 = normalizarTexto(unDestino);
  if (!u1 || !u2 || u1 === u2) return valor;
  if ((u1 === "l" || u1 === "litro" || u1 === "litros") && u2 === "ml") return valor * 1000;
  if (u1 === "ml" && (u2 === "l" || u2 === "litro" || u2 === "litros")) return valor / 1000;
  if ((u1 === "kg" || u1 === "quilo" || u1 === "quilos") && u2 === "g") return valor * 1000;
  if (u1 === "g" && (u2 === "kg" || u2 === "quilo" || u2 === "quilos")) return valor / 1000;
  return valor;
}

export function recalcularReceitaPorIngrediente(receita, ingredienteIdOuNome, qtdDisponivel, unidadeInformada = "") {
  if (!receita || !Array.isArray(receita.ingredientesBase) || !receita.ingredientesBase.length) {
    return null;
  }

  const busca = normalizarTexto(ingredienteIdOuNome);
  const ingAlvo =
    receita.ingredientesBase.find((i) => i.id === ingredienteIdOuNome) ||
    receita.ingredientesBase.find((i) => normalizarTexto(i.nome).includes(busca)) ||
    receita.ingredientesBase.find((i) =>
      (i.sinonimos || []).some((sin) => busca.includes(normalizarTexto(sin)))
    ) ||
    receita.ingredientesBase[0];

  const qtdConvertida = converterParaMesmaUnidade(
    Number(qtdDisponivel),
    unidadeInformada || ingAlvo.unidade,
    ingAlvo.unidade
  );

  if (!qtdConvertida || qtdConvertida <= 0 || !ingAlvo.quantidade) return null;

  const fator = qtdConvertida / Number(ingAlvo.quantidade);
  const percentual = Math.round(fator * 1000) / 10;

  const ingredientesRecalculados = receita.ingredientesBase.map((item) => {
    const novaQtdBruta = Number(item.quantidade) * fator;
    const novaQtd =
      novaQtdBruta >= 10
        ? Math.round(novaQtdBruta * 10) / 10
        : Math.round(novaQtdBruta * 100) / 100;

    return {
      ...item,
      quantidadeOriginal: item.quantidade,
      quantidadeNova: novaQtd,
      isLimitante: item.id === ingAlvo.id,
    };
  });

  const porcoesOriginais = Number(receita.rendimentoPorcoes || 10);
  const porcoesNovas = Math.max(1, Math.round(porcoesOriginais * fator * 10) / 10);

  return {
    receita,
    ingredienteLimitante: ingAlvo,
    quantidadeOriginalLimitante: ingAlvo.quantidade,
    quantidadeDisponivelLimitante: Math.round(qtdConvertida * 100) / 100,
    fator,
    percentual,
    porcoesOriginais,
    porcoesNovas,
    ingredientesRecalculados,
  };
}

// Interpreta frases como:
// "tenho todos os ingredientes do vatapá so o leite de coco que era para ser 3L e so tenho 2L"
// "só tenho 2L de leite de coco"
// "tenho apenas 500g de camarão"
export function detectarIntencaoRecalculo(frase, receitaEmContexto, todasReceitas = RECEITAS_GREEN_DOT) {
  const q = normalizarTexto(frase);

  const temPalavraRecalculo =
    q.includes("so tenho") ||
    q.includes("tenho so") ||
    q.includes("apenas") ||
    q.includes("era para ser") ||
    q.includes("era pra ser") ||
    q.includes("recalcul") ||
    q.includes("proporc") ||
    (q.includes("tenho") && /\d/.test(q));

  if (!temPalavraRecalculo) return null;

  // Identifica a receita citada na frase ou usa a receita ativa na conversa
  let receitaAlvo =
    todasReceitas.find((r) => {
      const nomeLimpo = normalizarTexto(r.nome.replace("*", ""));
      return (
        q.includes(nomeLimpo) ||
        (q.includes("vatapa") && r.id.includes("vatapa")) ||
        (q.includes("risoto") && r.id.includes("risoto")) ||
        (q.includes("parmegiana") && r.id.includes("parmegiana")) ||
        (q.includes("moscow") && r.id.includes("moscow"))
      );
    }) ||
    receitaEmContexto ||
    todasReceitas[0];

  if (!receitaAlvo || !Array.isArray(receitaAlvo.ingredientesBase)) return null;

  // Descobre qual ingrediente da receita foi mencionado na frase
  const ingMencionado =
    receitaAlvo.ingredientesBase.find((ing) => {
      const n = normalizarTexto(ing.nome);
      if (q.includes(n)) return true;
      return (ing.sinonimos || []).some((s) => q.includes(normalizarTexto(s)));
    }) || receitaAlvo.ingredientesBase[0];

  // Extrai números com unidades da frase (ex: "era para ser 3L e so tenho 2L" -> pega o último número ou o que vem após "so tenho")
  const matchSoTenho = q.match(
    /(?:so tenho|tenho so|tenho apenas|com apenas|fazer com)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|litros|litro|quilos|quilo|un|maco)?/i
  );

  let qtdAlvo = null;
  let unAlvo = ingMencionado.unidade;

  if (matchSoTenho) {
    qtdAlvo = Number(String(matchSoTenho[1]).replace(",", "."));
    if (matchSoTenho[2]) unAlvo = matchSoTenho[2];
  } else {
    const todosNumeros = [
      ...q.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|litros|litro|quilos|quilo|un|maco)?/gi),
    ];
    if (todosNumeros.length > 0) {
      const ultimo = todosNumeros[todosNumeros.length - 1];
      qtdAlvo = Number(String(ultimo[1]).replace(",", "."));
      if (ultimo[2]) unAlvo = ultimo[2];
    }
  }

  const calculo = recalcularReceitaPorIngrediente(receitaAlvo, ingMencionado.id, qtdAlvo, unAlvo);
  if (!calculo) return null;

  return {
    receita: receitaAlvo,
    calculo,
    ...calculo,
  };
}

export const ROTINAS_OPERACIONAIS = {
  "rotina-forno": {
    id: "rotina-forno",
    titulo: "Rotina de Cocção, Regeneração & Forno Combinado",
    categoria: "Produção de Alimentos & Padrão Térmico",
    resumo:
      "Procedimento oficial para pré-aquecimento, cocção mista e regeneração rápida sem ressecar proteínas no horário de pico.",
    etapas: [
      { titulo: "1. Pré-aquecimento de Abertura (10h30 / 18h00)", desc: "Ative o modo Vapor Combinado a 195°C com 40% de umidade por 8 minutos antes de carregar as GNs." },
      { titulo: "2. Regeneração de Guarnições e Molhos", desc: "Utilize GNs perfuradas para frituras/empanados (210°C, 0% umidade, 3 min) e GNs fechadas para arroz/purês (130°C, 60% umidade, 4 min)." },
      { titulo: "3. Segurança Alimentar (Sonda de Núcleo)", desc: "Toda proteína regenerada deve atingir no mínimo 74°C no centro geométrico por 15 segundos antes de ir ao Pass." },
    ],
  },
  "pull-to-thaw": {
    id: "pull-to-thaw",
    titulo: "Descongelamento Seguro (Pull-to-Thaw) — Câmara 0°C a 4°C",
    categoria: "Gestão de Estoque & Segurança Alimentar (ANVISA RDC 216)",
    resumo:
      "Retirada programada do freezer (-18°C) para a câmara de resfriados (2°C a 4°C) com etiqueta de validade secundária automática.",
    tabela: [
      { insumo: "Camarão Rosa GG (Pacote 1kg)", tempoDescongelamento: "12 horas", validadeApos: "48 horas (2 dias)", prateleira: "Prateleira Inferior (Bandeja Drenada)" },
      { insumo: "Filé Mignon Porcionado (220g)", tempoDescongelamento: "18 horas", validadeApos: "72 horas (3 dias)", prateleira: "Prateleira Central Carnes" },
      { insumo: "Polpa de Maracujá / Frutas Bar", tempoDescongelamento: "8 horas", validadeApos: "72 horas (3 dias)", prateleira: "Câmara do Bar - Superior" },
      { insumo: "Pão Brioche Artesanal", tempoDescongelamento: "2 horas (Ambiente)", validadeApos: "24 horas", prateleira: "Estante Seca Fechada" },
    ],
  },
  "organizacao-camara": {
    id: "organizacao-camara",
    titulo: "Organização de Câmara Fria & Regra PVPS (Primeiro que Vence, Primeiro que Sai)",
    categoria: "Gestão de Estoque & Prevenção de Perdas",
    resumo:
      "Ordem vertical obrigatória de armazenamento para evitar contaminação cruzada e garantir giro perfeito de lotes.",
    etapas: [
      { titulo: "Prateleira 1 (Topo): Prontos para Consumo & Laticínios", desc: "Sobremesas finalizadas, queijos fatiados, manteiga trufada e molhos frios já higienizados." },
      { titulo: "Prateleira 2 (Meio-Alto): Pré-Preparos Cozidos & Vegetais Higienizados", desc: "Bases de risoto pré-cocidas, vatapá porcionado, caldos reduzidos e folhas sanitizadas em caixas herméticas." },
      { titulo: "Prateleira 3 (Meio-Baixo): Carnes Bovinas e Suínas Cruas", desc: "Sempre em GNs com grade coletora de exsudato e etiqueta visível na face frontal." },
      { titulo: "Prateleira 4 (Base): Pescados, Crustáceos e Aves Cruas", desc: "Camarões, salmão e frango na parte mais fria e inferior, evitando qualquer gotejamento sobre outros itens." },
    ],
  },
};

// ── ROTINAS DE LIMPEZA, HIGIENIZAÇÃO, PRODUTOS QUÍMICOS E DILUIÇÃO EM ML (ANVISA) ──
export const ROTINAS_LIMPEZA_HIGIENIZACAO = {
  "limpeza-chao": {
    id: "limpeza-chao",
    titulo: "Limpeza & Desengorduramento do Chão (Cozinha e Bar)",
    categoria: "Higienização de Pisos & Prevenção de Quedas",
    produtoPrincipal: "Desengordurante Alcalino / Clorado Industrial para Pisos",
    mlPorLitro: 10,
    diluicaoPadrao: "50 ml para cada 5 Litros de água morna (1:100)",
    diluicaoPesada: "150 ml a 200 ml para cada 5 Litros de água quente (1:25)",
    tempoAcaoQuimica: "10 minutos de ação antes de esfregar e puxar",
    episObrigatorios: ["Bota de borracha antiderrapante", "Luva nitrílica de cano longo", "Avental impermeável"],
    passos: [
      {
        passo: 1,
        titulo: "Varrição a Seco e Remoção de Sólidos",
        desc: "Nunca jogue água direto com restos de comida no chão. Varrer a seco e recolher restos de alimentos, farinhas e plásticos com a pá.",
        foto: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 2,
        titulo: "Diluição Correta do Desengordurante no Balde",
        desc: "Coloque 5 Litros de água morna no balde e adicione 50 ml de Desengordurante (10 ml por Litro). Para áreas de fritadeira muito engorduradas, use 150 ml a 200 ml em água bem quente.",
        foto: "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 3,
        titulo: "Espalhamento e Ação Química de 10 Minutos",
        desc: "Espalhe a solução de desengordurante com o escovão. REGRA DE OURO: Deixe o produto agir por 10 minutos sem enxaguar. A química precisa desse tempo para quebrar as moléculas de gordura incrustadas no piso e rejuntes.",
        foto: "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 4,
        titulo: "Esfregação Focada nas Áreas Críticas",
        desc: "Esfregue com vigor embaixo de fogões, fritadeiras, coifas, calhas e ao redor de todos os ralos com vassoura de cerdas duras.",
        foto: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 5,
        titulo: "Enxágue e Secagem Imediata com Rodo",
        desc: "Puxe toda a água em direção aos ralos usando o rodo exclusivo de chão. Finalize passando pano embebido em solução clorada (20 ml de cloro por Litro) e deixe secar com boa ventilação.",
        foto: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
  "limpeza-panos": {
    id: "limpeza-panos",
    titulo: "Higienização & Desinfecção de Panos de Cozinha (Cloro & Cores)",
    categoria: "Segurança Microbiológica ANVISA RDC 216",
    produtoPrincipal: "Hipoclorito de Sódio / Água Sanitária (Cloro ativo 2,0% a 2,5%)",
    mlPorLitro: 25,
    diluicaoPadrao: "25 ml de Cloro para cada 1 Litro de água limpa (100 ml para balde de 4L)",
    tempoAcaoQuimica: "20 a 30 minutos de molho imerso (não exceder 1h)",
    coresPadrao: [
      { cor: "Verde / Branco", uso: "Exclusivo para Bancadas de Manipulação e Corte de Alimentos" },
      { cor: "Azul", uso: "Exclusivo para Salão, Bandejas de Garçom e Mesas de Clientes" },
      { cor: "Laranja / Vermelho", uso: "Exclusivo para Chão, Rodapés e Lixeiras (NUNCA sobe para bancada!)" },
    ],
    codigoCores: [
      { cor: "Verde / Branco", uso: "Exclusivo para Bancadas de Manipulação e Corte de Alimentos" },
      { cor: "Azul", uso: "Exclusivo para Salão, Bandejas de Garçom e Mesas de Clientes" },
      { cor: "Laranja / Vermelho", uso: "Exclusivo para Chão, Rodapés e Lixeiras (NUNCA sobe para bancada!)" },
    ],
    passos: [
      {
        passo: 1,
        titulo: "Pré-lavagem com Detergente Neutro",
        desc: "Lave os panos primeiro com água corrente e detergente neutro para remover a gordura grossa e restos de alimentos. O cloro não tem poder desengordurante e perde efeito se o pano estiver engordurado.",
        foto: "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 2,
        titulo: "Preparo da Solução Clorada",
        desc: "Em bacia higienizada, coloque 4 Litros de água fria e adicione 100 ml de cloro (25 ml por Litro). NUNCA use água quente no cloro, pois evapora o gás ativo e anula a desinfecção.",
        foto: "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 3,
        titulo: "Molho Imerso de 20 a 30 Minutos",
        desc: "Mergulhe os panos de forma que fiquem 100% cobertos pela solução. Deixe agir por 20 a 30 minutos cronometrados.",
        foto: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 4,
        titulo: "Enxágue Abundante e Secagem em Local Arejado",
        desc: "Enxágue em água corrente até eliminar qualquer odor forte de cloro. Torça bem e estenda em varal ventilado exclusivo. É terminantemente proibido estender panos sobre fornos ou caldeirões.",
        foto: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
  "lavagem-maos": {
    id: "lavagem-maos",
    titulo: "Protocolo Oficial ANVISA de Lavagem e Antissepsia das Mãos",
    categoria: "Controle de Contaminação Cruzada & Boas Práticas",
    produtoPrincipal: "Sabonete Líquido Bactericida Inodoro + Álcool em Gel 70%",
    mlPorLitro: 3,
    diluicaoPadrao: "Uso puro direto da saboneteira (2 a 3 ml de sabonete líquido)",
    tempoAcaoQuimica: "40 a 60 segundos cronometrados de fricção mecânica",
    tempoMinimo: "40 a 60 segundos cronometrados de fricção mecânica",
    passos: [
      {
        passo: 1,
        titulo: "Molhar Mãos e Aplicar Sabonete Inodoro",
        desc: "Abra a torneira com o cotovelo ou sensor. Molhe mãos e punhos com água corrente e aplique 2 a 3 ml de sabonete bactericida inodoro (sem fragrância, para não contaminar alimentos).",
        foto: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 2,
        titulo: "Fricção de Palmas e Dorso com Dedos Entrelaçados",
        desc: "Esfregue as palmas uma na outra. Depois, esfregue o dorso da mão esquerda com a palma direita entrelaçando os dedos, e repita do outro lado.",
        foto: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 3,
        titulo: "Polegares, Unhas e Pontas dos Dedos",
        desc: "Esfregue o polegar esquerdo com a mão direita em rotação, e vice-versa. Friccione as pontas dos dedos e unhas contra a palma da mão oposta com movimentos circulares.",
        foto: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 4,
        titulo: "Punhos e Enxágue sem Tocar na Pia",
        desc: "Friccione os punhos. Enxágue completamente em água corrente das pontas dos dedos em direção aos punhos.",
        foto: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 5,
        titulo: "Secagem com Papel Toalha Descartável e Álcool 70%",
        desc: "Seque as mãos com 2 folhas de papel toalha não reciclado. USE O PAPEL TOALHA PARA FECHAR A TORNEIRA! Finalize aplicando 2 ml de álcool 70% e deixe secar naturalmente ao ar.",
        foto: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80",
      },
    ],
    momentosObrigatorios: [
      "Ao chegar ao restaurante e entrar na cozinha ou bar",
      "Antes de manipular qualquer alimento cru ou cozido",
      "Depois de tocar em carnes cruas, peixes, frutos do mar ou ovos",
      "Depois de manusear lixo, vassouras, panos de chão ou caixas de papelão",
      "Depois de tocar no celular, dinheiro, comandas ou maçanetas",
      "Depois de espirrar, tossir, assoar o nariz ou usar o sanitário",
      "Sempre que trocar de função na praça ou vestir luvas novas",
    ],
  },
  "sanitizacao-hortifruti": {
    id: "sanitizacao-hortifruti",
    titulo: "Sanitização de Frutas, Folhas e Legumes (Bar & Cozinha)",
    categoria: "Segurança de Alimentos Crus",
    produtoPrincipal: "Sanitizante Clorado para Alimentos (Pastilha ou Hipoclorito)",
    mlPorLitro: 10,
    diluicaoPadrao: "10 ml (1 colher de sopa) para cada 1 Litro de água potável",
    tempoAcaoQuimica: "15 minutos de imersão total",
    passos: [
      {
        passo: 1,
        titulo: "Lavagem em Água Corrente Folha a Folha",
        desc: "Lave folhas e frutas em água corrente potável retirando sujidades e terra visíveis.",
        foto: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 2,
        titulo: "Molho na Solução Clorada por 15 Minutos",
        desc: "Mergulhe os vegetais em 10 ml de sanitizante por litro de água por 15 minutos.",
        foto: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
      },
      {
        passo: 3,
        titulo: "Enxágue Final e Secagem na Centrífuga",
        desc: "Enxágue em água corrente para eliminar o cloro e seque na centrífuga de folhas.",
        foto: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
};

export function calcularDiluicaoLimpeza(rotinaId, litrosAgua = 5) {
  const rotina = ROTINAS_LIMPEZA_HIGIENIZACAO[rotinaId] || ROTINAS_LIMPEZA_HIGIENIZACAO["limpeza-chao"];
  const litros = Number(litrosAgua) || 5;
  const mlCalculada = Math.round(rotina.mlPorLitro * litros);
  return {
    rotina,
    litrosAgua: litros,
    mlNecessaria: mlCalculada,
    mlCalculado: mlCalculada,
    colheresSopaAprox: Math.round(mlCalculada / 15),
    coposCafeAprox: Math.round((mlCalculada / 50) * 10) / 10,
  };
}

// ── CHECKLISTS DE ABERTURA (MISE EN PLACE) & SAÍDA (FECHAMENTO SEGURO) ──
export const CHECKLISTS_PRACA = {
  abertura: [
    {
      id: "chk-ab-cq",
      setor: "Cozinha Quente",
      icone: "Flame",
      cor: "#A43E2B",
      itens: [
        { id: "ab-cq-1", texto: "Registro geral de gás aberto e sem cheiro de vazamento", critico: true },
        { id: "ab-cq-2", texto: "Fritadeiras abastecidas com óleo novo/filtrado no nível e ligadas a 180°C", critico: true },
        { id: "ab-cq-3", texto: "Banho-maria ligado e água atingindo 65°C a 75°C", critico: true },
        { id: "ab-cq-4", texto: "Mise en place de bases, caldos e proteínas pesadas conferido", critico: false },
        { id: "ab-cq-5", texto: "Potes etiquetados com data e validade PVPS", critico: false },
        { id: "ab-cq-6", texto: "Termômetro digital de espeto higienizado com álcool 70%", critico: false },
      ],
    },
    {
      id: "chk-ab-cf",
      setor: "Cozinha Fria / Garde Manger",
      icone: "Salad",
      cor: "#2E6F4E",
      itens: [
        { id: "ab-cf-1", texto: "Temperatura da câmara fria e geladeiras conferida (0°C a 4°C)", critico: true },
        { id: "ab-cf-2", texto: "Folhas, hortaliças e frutas sanitizadas em solução clorada", critico: true },
        { id: "ab-cf-3", texto: "Molhos frios, queijos e ceviches porcionados nas GNs", critico: false },
        { id: "ab-cf-4", texto: "Tábuas de corte coloridas limpas e secas na bancada", critico: false },
      ],
    },
    {
      id: "chk-ab-bar",
      setor: "Bar & Coquetelaria",
      icone: "GlassWater",
      cor: "#9E6412",
      itens: [
        { id: "ab-bar-1", texto: "Máquina de gelo filtrado cheia e pá higienizada", critico: true },
        { id: "ab-bar-2", texto: "Chopeira ligada, pressão do CO2 ajustada (2.0 a 2.2 bar) e bicos purgados", critico: true },
        { id: "ab-bar-3", texto: "Frutas de corte (limão taiti, siciliano, laranja) fatiadas e guardadas em pote", critico: false },
        { id: "ab-bar-4", texto: "Xaropes, bitters e garrafas do Speed Rail abastecidas", critico: false },
        { id: "ab-bar-5", texto: "Copos e taças limpos, polidos e sem cheiro de pano", critico: false },
      ],
    },
    {
      id: "chk-ab-pass",
      setor: "Expedição, Pass & Salão",
      icone: "BellRing",
      cor: "#69387D",
      itens: [
        { id: "ab-pass-1", texto: "Lâmpada térmica do Pass ligada e bancada de inox sanitizada com álcool 70%", critico: true },
        { id: "ab-pass-2", texto: "Bobinas de impressoras de comanda cheias e testadas", critico: true },
        { id: "ab-pass-3", texto: "Embalagens de delivery montadas e sacolas organizadas", critico: false },
        { id: "ab-pass-4", texto: "Galheteiros, cardápios e mesas do salão alinhadas", critico: false },
      ],
    },
  ],
  fechamento: [
    {
      id: "chk-fc-cq",
      setor: "Cozinha Quente",
      icone: "Flame",
      cor: "#A43E2B",
      itens: [
        { id: "fc-cq-1", texto: "Registro geral de gás FECHADO e travado com chave", critico: true },
        { id: "fc-cq-2", texto: "Fritadeiras, chapa e fornos DESLIGADOS da tomada", critico: true },
        { id: "fc-cq-3", texto: "Sobras quentes resfriadas em banho de gelo (choque térmico) e guardadas na câmara", critico: true },
        { id: "fc-cq-4", texto: "Chapa raspada e higienizada; coifa limpa", critico: false },
        { id: "fc-cq-5", texto: "Chão lavado com desengordurante e clorado, sem acúmulo de água", critico: false },
        { id: "fc-cq-6", texto: "Lixo orgânico retirado e lixeira lavada com saco novo", critico: false },
      ],
    },
    {
      id: "chk-fc-cf",
      setor: "Cozinha Fria / Garde Manger",
      icone: "Salad",
      cor: "#2E6F4E",
      itens: [
        { id: "fc-cf-1", texto: "Todos os potes e GNs tampados e com etiqueta ANVISA / PVPS", critico: true },
        { id: "fc-cf-2", texto: "Portas de câmaras e geladeiras travadas e vedadas", critico: true },
        { id: "fc-cf-3", texto: "Bancadas de inox e pias lavadas e sanitizadas com álcool 70%", critico: false },
        { id: "fc-cf-4", texto: "Panos colocados de molho no cloro e lixo recolhido", critico: false },
      ],
    },
    {
      id: "chk-fc-bar",
      setor: "Bar & Coquetelaria",
      icone: "GlassWater",
      cor: "#9E6412",
      itens: [
        { id: "fc-bar-1", texto: "Válvulas de CO2 e chopp fechadas; bicos escovados e vedados com tampa de silicone", critico: true },
        { id: "fc-bar-2", texto: "Perecíveis (frutas abertas, sucos) etiquetados na geladeira", critico: true },
        { id: "fc-bar-3", texto: "Tapetes de borracha (bar mats) lavados com água quente e sabão", critico: false },
        { id: "fc-bar-4", texto: "Pia, cubas e ralo do bar desinfetados com cloro", critico: false },
      ],
    },
    {
      id: "chk-fc-pass",
      setor: "Expedição, Pass & Salão",
      icone: "BellRing",
      cor: "#69387D",
      itens: [
        { id: "fc-pass-1", texto: "Lâmpadas do Pass e aquecedores DESLIGADOS", critico: true },
        { id: "fc-pass-2", texto: "Comandas do dia conferidas e arquivadas no sistema", critico: false },
        { id: "fc-pass-3", texto: "Salão varrido, mesas higienizadas e cadeiras empilhadas/alinhadas", critico: false },
        { id: "fc-pass-4", texto: "Luzes apagadas, ar-condicionado desligado e portas trancadas", critico: true },
      ],
    },
  ],
};
export const EQUIPAMENTOS_MANUTENCAO = [
  {
    id: "liq-skymsen-4l",
    categoriaTipo: "liquidificador",
    nome: "Liquidificador Industrial Skymsen 4 Litros Inox",
    nomeCurto: "Liquidificador Inox 4L (Cozinha)",
    codigoSerie: "SN: SKY-4000-220V",
    setor: "Cozinha Quente (Bancada de Molhos & Vatapá)",
    voltagem: "220V",
    corTomada: "Tomada Vermelha 20A (220V)",
    alertaVoltagem:
      "ATENÇÃO: Este equipamento é 220V monofásico. Ligue EXCLUSIVAMENTE nas tomadas vermelhas da bancada de cocção. Se ligado em 110V, o motor perde 70% de força e pode queimar o capacitor com massas pesadas como Vatapá.",
    falhaPrincipal: "Copo vazando / Pino de arraste ou encaixe da tampa",
    imagem: "https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guiaEncaixe: {
      titulo: "Como Encaixar o Copo Inox e a Tampa com Segurança",
      resumo: "O encaixe correto evita desgaste da castanha de arraste e impede vazamentos de preparos quentes.",
      foto: "https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Com o motor 100% desligado (chave em OFF), verifique se o anel de borracha de vedação está firme na base da lâmina.",
        "2. Posicione o copo inox de 4L sobre o gabinete alinhando o sextavado inferior com a castanha de borracha do motor.",
        "3. Gire levemente o copo 1cm para a esquerda/direita até sentir que ele desceu e assentou por completo nos 4 apoios de borracha.",
        "4. Coloque a tampa principal de borracha atóxica pressionando toda a borda externa até ouvir o clique de vedação.",
        "5. Encaixe a sobretampa transparente central e gire em sentido horário para travar antes de ligar.",
      ],
    },
    guiaUso: {
      titulo: "Como Usar no Dia a Dia (Cremes Pesados, Vatapá e Caldos)",
      resumo: "Capacidade máxima útil de 3,2 Litros para líquidos quentes.",
      foto: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Sempre coloque primeiro os ingredientes líquidos (ex: Leite de Coco ou Caldo) e depois os sólidos (pão, castanhas, camarão).",
        "2. Para líquidos quentes acima de 60°C, retire a sobretampa central e cubra com um pano limpo dobrado para liberar a pressão do vapor.",
        "3. Dê 3 toques no botão PULSAR para quebrar os sólidos antes de virar a chave para rotação contínua.",
        "4. Nunca utilize colheres ou espátulas dentro do copo com o motor em movimento.",
      ],
    },
    guiaLimpeza: {
      titulo: "Como Limpar e Higienizar sem Acidentes",
      resumo: "Procedimento obrigatório ao final de cada batelada para evitar contaminação cruzada (camarão/amendoim).",
      foto: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Pré-lavagem rápida: adicione 1,5L de água morna + 5ml de detergente neutro no copo, tampe e pulse por 15 segundos.",
        "2. Descarte a água, retire o copo da base e lave a parte interna com esponja macia (evite colocar a mão direto na lâmina no fundo).",
        "3. Retire a borracha da tampa para lavar o sulco interno onde acumula resíduo de leite de coco/dendê.",
        "4. Sanitização: borrife álcool 70% ou solução clorada ANVISA, deixe secar emborcado em grade inox. O gabinete do motor deve ser limpo apenas com pano úmido (nunca jogue água!).",
      ],
    },
    hotspots: [
      { id: "sobretampa", label: "Sobretampa Dosadora de Vapor", x: "24%", y: "22%" },
      { id: "tampa-vedacao", label: "Tampa de Borracha Atóxica", x: "74%", y: "26%" },
      { id: "copo-inox", label: "Copo Monobloco Inox 4L", x: "22%", y: "46%" },
      { id: "pino-arraste", label: "Acoplamento & Pino de Arraste", x: "76%", y: "54%" },
      { id: "chave-pulsar", label: "Chave Liga/Desliga + Pulsar", x: "24%", y: "72%" },
      { id: "cabo-220", label: "Cabo 20A — 220V (Plugue Vermelho)", x: "75%", y: "76%" },
    ],
    pecasReposicao: [
      { sku: "SKY-ARR-04", nome: "Kit Arraste Completo (Castanha do Motor + Pino do Copo)", preco: "R$ 58,00", estoque: "Em estoque loja (3 kits)" },
      { sku: "SKY-TMP-4L", nome: "Tampa de Borracha Atóxica Original 4L", preco: "R$ 42,00", estoque: "Em estoque loja (2 un)" },
      { sku: "SKY-LAM-01", nome: "Conjunto Lâmina 6 Facas Inox Temperado", preco: "R$ 135,00", estoque: "Entrega em 24h" },
    ],
    passosTroubleshooting: [
      {
        passo: 1,
        total: 4,
        instrucao: "Verifique se o plugue está conectado na tomada 220V (Vermelha) e se o disjuntor da bancada está armado.",
        detalhe: "Se ligado em tomada 110V por engano, o motor apenas ronca e não atinge rotação.",
      },
      {
        passo: 2,
        total: 4,
        instrucao: "Retire o copo e cheque se a castanha de arraste preta no topo do motor não está com as aletas gastas.",
        detalhe: "Encaixar o copo com o motor ainda girando corrói os dentes da castanha.",
      },
      {
        passo: 3,
        total: 4,
        instrucao: "Gire a base da lâmina por baixo do copo com a mão para garantir que o eixo não está travado por fibra de alimento.",
        detalhe: "O eixo deve girar livremente sem folga vertical.",
      },
      {
        passo: 4,
        total: 4,
        instrucao: "Pressione o botão de Rearme Térmico ( Overload ) embaixo da base do motor caso tenha desligado batendo massa pesada.",
        detalhe: "Aguarde 5 minutos para o motor esfriar antes de apertar o botão de rearme.",
      },
    ],
    checklistPreChamado: [
      {
        titulo: "Rearmar protetor térmico na base inferior do liquidificador",
        passos: [
          "Tire o liquidificador da tomada 220V.",
          "Incline o gabinete do motor e localize o botão preto de reset térmico no fundo.",
          "Pressione até ouvir o clique e aguarde 5 minutos antes de religar.",
        ],
      },
      {
        titulo: "Inspecionar acoplamento do copo e tensão da tomada",
        causaProvavel: "Causa provável: Desarme térmico por excesso de peso sem líquido suficiente ou desgaste do pino de arraste.",
        passos: [
          "Confirme que o copo não ultrapassou o limite de 3,2L de massa densa.",
          "Verifique se a lâmina gira quando acionada apenas com água.",
        ],
      },
    ],
  },
  {
    id: "liq-vitamix-bar",
    categoriaTipo: "liquidificador",
    nome: "Liquidificador de Bar Vitamix Drink Machine 2L",
    nomeCurto: "Liquidificador Vitamix 2L (Bar)",
    codigoSerie: "SN: VTX-110-BAR",
    setor: "Bar & Coquetelaria (Drinks Frozen & Frutas)",
    voltagem: "110V (127V)",
    corTomada: "Tomada Preta Padrão 110V (Balcão do Bar)",
    alertaVoltagem:
      "ATENÇÃO CRÍTICA: Este liquidificador do Bar é 110V (127V)! NUNCA ligue nas tomadas vermelhas 220V da cozinha sob risco de queima imediata da placa eletrônica.",
    falhaPrincipal: "Sobrecarga com gelo / Encaixe da jarra de policarbonato",
    imagem: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guiaEncaixe: {
      titulo: "Como Encaixar o Copo de Policarbonato e a Tampa Dupla",
      resumo: "A jarra do Vitamix encaixa por gravidade sobre o tapete centralizador de borracha.",
      foto: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Certifique-se de que o tapete de borracha amortecedor (centering pad) está encaixado na base do motor.",
        "2. Apoie o copo de policarbonato alinhando o bico vertedor para a frente ou lateral de preferência do barman.",
        "3. Pressione a tampa de borracha preta e trave as 2 abas laterais sobre a borda superior do copo até estalar.",
        "4. Insira o plugue medidor transparente no centro da tampa e gire 45° no sentido horário para travar.",
      ],
    },
    guiaUso: {
      titulo: "Como Usar no Bar (Drinks com Gelo, Polpas e Xaropes)",
      resumo: "Use sempre a alavanca em LOW ao iniciar e passe para HIGH após 3 segundos.",
      foto: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Ordem obrigatória no copo: 1º Líquidos/Destilados, 2º Xaropes/Açúcar, 3º Frutas/Polpas e por último o Gelo.",
        "2. Inicie com a chave de velocidade na posição LOW (Baixa) por 3 segundos e depois suba para HIGH (Alta) para triturar o gelo sem criar bolsão de ar.",
        "3. Se necessário, use apenas o bastão socador (Tamper) oficial COM a tampa colocada (ele tem trava de altura que não encosta na lâmina).",
      ],
    },
    guiaLimpeza: {
      titulo: "Como Limpar e Sanitizar o Copo de Policarbonato",
      resumo: "Não use esponja abrasiva verde no policarbonato para não fosquear o visor de medidas.",
      foto: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Encha o copo até a metade com água morna e 2 gotas de detergente neutro.",
        "2. Bata em velocidade ALTA por 20 segundos e enxágue em água corrente no lavador de copos.",
        "3. Retire o tapete de borracha da base do motor e lave em água corrente para tirar caldas açucaradas.",
      ],
    },
    hotspots: [
      { id: "abas-tampa", label: "Abas Laterais de Trava da Tampa", x: "24%", y: "24%" },
      { id: "copo-poli", label: "Jarra Policarbonato 2L", x: "75%", y: "34%" },
      { id: "pad-borracha", label: "Tapete Amortecedor (Centering Pad)", x: "22%", y: "54%" },
      { id: "chave-high-low", label: "Seletor High / Low", x: "76%", y: "62%" },
      { id: "tomada-110", label: "Alimentação 110V (Tomada Preta)", x: "24%", y: "76%" },
    ],
    pecasReposicao: [
      { sku: "VTX-JAR-2L", nome: "Copo Completo Policarbonato 2L com Lâmina Ice", preco: "R$ 690,00", estoque: "Disponível na Central" },
      { sku: "VTX-SOC-01", nome: "Bastão Socador (Tamper) com Colar de Segurança", preco: "R$ 120,00", estoque: "Em estoque loja (1 un)" },
    ],
    passosTroubleshooting: [
      {
        passo: 1,
        total: 3,
        instrucao: "Confirme se está ligado na tomada 110V preta do balcão do bar.",
        detalhe: "Este modelo possui proteção eletrônica contra sobretensão.",
      },
      {
        passo: 2,
        total: 3,
        instrucao: "Se a lâmina girar em falso sem puxar o gelo (bolsão de ar), desligue e use o bastão Tamper pelo furo da tampa.",
        detalhe: "Adicione mais 30ml de líquido base para destravar o vórtex.",
      },
      {
        passo: 3,
        total: 3,
        instrucao: "Verifique a engrenagem metálica (Drive Socket) no centro do motor usando a chave Allen de manutenção.",
        detalhe: "Caso os dentes internos estejam gastos, a troca leva 2 minutos.",
      },
    ],
    checklistPreChamado: [
      {
        titulo: "Aguardar resfriamento automático do sensor térmico",
        passos: [
          "Desligue a chave frontal e tire da tomada por 15 minutos.",
          "Retire o copo de cima da base para ventilar o motor.",
        ],
      },
      {
        titulo: "Checar soquete de acionamento (Drive Socket)",
        causaProvavel: "Causa provável: Desgaste natural do soquete ou bloqueio por excesso de gelo seco sem líquido.",
        passos: [
          "Inspecione os dentes internos do soquete no topo da base.",
          "Teste o acionamento sem o copo por 2 segundos para ouvir o giro do motor.",
        ],
      },
    ],
  },
  {
    id: "forno-combinado",
    categoriaTipo: "forno",
    nome: "Forno Combinado Rational iCombi",
    nomeCurto: "Forno Combinado",
    codigoSerie: "SN: RC-8840-2025",
    setor: "Cozinha Quente",
    voltagem: "380V Trifásico (Comando 220V)",
    corTomada: "Quadro Disjuntor Trifásico Dedicado",
    alertaVoltagem:
      "Equipamento industrial ligado direto no quadro elétrico 380V Trifásico com disjuntor DR exclusivo.",
    falhaPrincipal: "Oscilação de Vapor / Temperatura Inconsistente",
    imagem: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guiaEncaixe: {
      titulo: "Como Encaixar GNs, Grelhas e Sonda de Núcleo",
      resumo: "Deixe sempre 2cm de espaço entre as GNs para circulação uniforme do ar quente.",
      foto: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Deslize as cubas GN nos trilhos laterais em U certificando-se de que a borda traseira passou pela trava antiqueda.",
        "2. Ao usar a sonda térmica de núcleo, espete na parte mais espessa da proteína em ângulo de 45°.",
        "3. Nunca deixe o cabo da sonda pendurado para fora da borracha da porta ao fechar.",
      ],
    },
    guiaUso: {
      titulo: "Como Operar nos 3 Modos (Vapor, Ar Quente e Combinado)",
      resumo: "Pré-aqueça sempre a câmara antes de inserir os alimentos.",
      foto: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Modo Vapor (30°C–130°C): ideal para legumes no vapor, arroz e pudins.",
        "2. Modo Ar Quente Seco (30°C–300°C): ideal para gratinar Parmegiana e dourar empanados.",
        "3. Modo Combinado: mantém a suculência interna das carnes reduzindo a perda de peso em até 25%.",
      ],
    },
    guiaLimpeza: {
      titulo: "Como Rodar a Lavagem Automática Noturna (iCareSystem)",
      resumo: "Utilize EPI (luvas térmicas e óculos) ao manusear as pastilhas detergentes.",
      foto: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Retire todas as GNs e limpe o ralo coletor no fundo da câmara.",
        "2. Toque no ícone de Lavagem no painel e aguarde a câmara resfriar abaixo de 70°C.",
        "3. Insira as pastilhas de detergente (vermelha) no cesto central e pastilhas Care (azul) na gaveta inferior.",
        "4. Feche a porta e inicie o ciclo automático.",
      ],
    },
    hotspots: [
      { id: "seletor", label: "Seletor de Clima / Vapor", x: "18%", y: "32%" },
      { id: "painel", label: "Painel de Controle Touch", x: "22%", y: "48%" },
      { id: "dreno", label: "Bandeja e Filtro de Drenagem", x: "24%", y: "66%" },
      { id: "sonda", label: "Sonda Térmica de Núcleo", x: "76%", y: "32%" },
      { id: "manometro", label: "Sensor de Pressão d'Água", x: "78%", y: "48%" },
      { id: "chave", label: "Interruptor Geral / Reset", x: "76%", y: "66%" },
    ],
    pecasReposicao: [
      { sku: "RAT-4099-B", nome: "Borracha de Vedação da Porta (Guarnição Térmica)", preco: "R$ 380,00", estoque: "Entrega em 24h" },
      { sku: "RAT-1102-S", nome: "Sonda de Núcleo Multiponto (6 sensores)", preco: "R$ 620,00", estoque: "Disponível na Central" },
      { sku: "RAT-0088-C", nome: "Caixa de Pastilhas Descalcificadoras CareControl", preco: "R$ 290,00", estoque: "Em estoque loja (2 cx)" },
    ],
    passosTroubleshooting: [
      {
        passo: 1,
        total: 5,
        instrucao: "Verifique se a borracha de vedação da porta está limpa e sem folgas laterais.",
        detalhe: "Resíduos de gordura na borracha deixam o vapor escapar e causam queda de 15°C a 25°C na câmara.",
      },
      {
        passo: 2,
        total: 5,
        instrucao: "Confirme se o registro de entrada de água filtrada na parede traseira está 100% aberto.",
        detalhe: "O manômetro lateral deve indicar entre 1,5 e 6,0 bar para o gerador de vapor operar sem falha.",
      },
      {
        passo: 3,
        total: 5,
        instrucao: "Realize 5 ciclos rápidos de purga de vapor e verifique o filtro do ralo interno.",
        detalhe: "Se o coletor do fundo da câmara estiver obstruído por alimentos, o sensor de umidade trava por segurança.",
      },
      {
        passo: 4,
        total: 5,
        instrucao: "Desligue o interruptor luminoso frontal por 10 segundos e religue para recalibrar as sondas.",
        detalhe: "Aguarde o autoteste eletrônico concluir no visor antes de abrir a porta.",
      },
      {
        passo: 5,
        total: 5,
        instrucao: "Execute um teste de vapor a 100°C por 2 minutos com a câmara vazia.",
        detalhe: "Observe se o visor estabiliza em 100% de umidade sem exibir o código de alerta Service 20.",
      },
    ],
    checklistPreChamado: [
      {
        titulo: "Reiniciar o controlador térmico do equipamento",
        passos: [
          "Pressione o interruptor iluminado na base frontal direita do Forno para a posição OFF.",
          "Aguarde 10 segundos completos para descarregar os capacitores da placa.",
          "Ligue o Forno Combinado novamente e aguarde o autodiagnóstico.",
        ],
      },
      {
        titulo: "Purgar gerador de vapor e checar calibragem",
        causaProvavel: "Causa provável: Calcário acumulado no gerador de vapor ou baixa pressão na linha hidráulica.",
        passos: [
          "Certifique-se de que a gaveta CareControl possui pastilhas suficientes.",
          "Limpe o filtro metálico de drenagem na base interna da câmara.",
          "Execute 3 jatos de ducha manual para confirmar vazão de água.",
          "Rode o ciclo rápido de enxágue de 5 minutos.",
          "Verifique no painel se a temperatura mantém estabilidade.",
        ],
      },
    ],
  },
  {
    id: "chopeira-torre",
    categoriaTipo: "chopeira",
    nome: "Chopeira & Torre 2 Vias Glycol",
    nomeCurto: "Chopeira 2 Vias",
    codigoSerie: "SN: CH-2091-BREW",
    setor: "Bar",
    voltagem: "220V",
    corTomada: "Tomada Vermelha 20A (Sob o Balcão do Bar)",
    alertaVoltagem: "O pré-resfriador do banco de gelo opera em 220V contínuo (nunca desligar à noite).",
    falhaPrincipal: "Excesso de Espuma (Chopp Quente ou Pressão de CO2)",
    imagem: "https://images.unsplash.com/photo-1575037614876-c38a4d44f5b8?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guiaEncaixe: {
      titulo: "Como Engatar o Barril (Válvula Extratora) e o Cilindro de CO2",
      resumo: "Engate rápido padrão Tipo S com trava de segurança.",
      foto: "https://images.unsplash.com/photo-1575037614876-c38a4d44f5b8?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Retire o lacre plástico do bocal do barril e passe papel toalha com álcool 70%.",
        "2. Com a alavanca da válvula extratora levantada (fechada), encaixe no bocal e gire 1/4 de volta em sentido horário.",
        "3. Puxe a alavanca para fora e empurre para baixo até travar para liberar a passagem do chopp.",
      ],
    },
    guiaUso: {
      titulo: "Como Tirar o Chopp Perfeito com 3 Dedos de Cremes",
      resumo: "Nunca encoste o bico da torneira dentro do líquido do copo.",
      foto: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Enxágue a tulipa no rinser de água gelada para baixar o atrito térmico do vidro.",
        "2. Incline o copo a 45° e puxe a torneira 100% para frente de uma só vez.",
        "3. Ao atingir 80% do copo, feche e empurre a torneira para trás para aplicar o creme denso.",
      ],
    },
    guiaLimpeza: {
      titulo: "Como Higienizar as Torneiras e Pingadeira Diariamente",
      resumo: "Evita contaminação bacteriana e moscas de fruta no bar.",
      foto: "https://images.unsplash.com/photo-1575037614876-c38a4d44f5b8?auto=format&fit=crop&w=900&q=80",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      passos: [
        "1. Ao fechar o bar, esguiche água morna no bico das torneiras e tampe com o protetor de silicone.",
        "2. Retire a grelha da pingadeira inox e lave com detergente neutro.",
      ],
    },
    hotspots: [
      { id: "torneira", label: "Torneira Compensadora Italiana", x: "20%", y: "30%" },
      { id: "medalhao", label: "Linha de Glicol Congelante", x: "22%", y: "50%" },
      { id: "pingadeira", label: "Pingadeira & Ralo Inox", x: "24%", y: "68%" },
      { id: "manometro", label: "Manômetro de Pressão CO2", x: "75%", y: "34%" },
      { id: "extratora", label: "Válvula Extratora do Barril", x: "78%", y: "52%" },
      { id: "termostato", label: "Termostato do Banco de Gelo", x: "76%", y: "68%" },
    ],
    pecasReposicao: [
      { sku: "CHP-901", nome: "Kit Anéis O-Ring de Vedação da Extratora", preco: "R$ 45,00", estoque: "Em estoque loja (4 kits)" },
      { sku: "CHP-402", nome: "Manômetro Duplo Regulador de CO2", preco: "R$ 310,00", estoque: "Entrega em 24h" },
    ],
    passosTroubleshooting: [
      {
        passo: 1,
        total: 4,
        instrucao: "Verifique a temperatura do banco de gelo no visor digital (deve estar entre -1,5°C e 0,5°C).",
        detalhe: "Acima de 3°C o CO2 se desprende do líquido e gera espuma contínua na torneira.",
      },
      {
        passo: 2,
        total: 4,
        instrucao: "Ajuste a alavanca compensadora lateral da torneira para a posição mais fechada e abra gradualmente.",
        detalhe: "Sempre abra a torneira principal de uma só vez (100% aberta) — abrir pela metade gera turbulência.",
      },
      {
        passo: 3,
        total: 4,
        instrucao: "Cheque o manômetro do cilindro de CO2: a pressão ideal de trabalho é entre 1,8 e 2,2 kgf/cm².",
        detalhe: "Se o barril acabou de ser trocado, aguarde 15 minutos de repouso refrigerado caso tenha sido movimentado.",
      },
      {
        passo: 4,
        total: 4,
        instrucao: "Tire 3 copos de purga rápida descartando o primeiro jato aquecido da serpentina.",
        detalhe: "Verifique se o colarinho estabiliza em 2 a 3 dedos cremosos.",
      },
    ],
    checklistPreChamado: [
      {
        titulo: "Destravar e religar válvula extratora do barril",
        passos: [
          "Puxe a trava da válvula extratora para cima para interromper o fluxo do barril.",
          "Verifique se a borracha de vedação do bocal do barril não está mordida ou ressecada.",
          "Engate novamente até ouvir o clique firme.",
        ],
      },
      {
        titulo: "Estabilizar pressão de CO2 e linha de resfriamento",
        causaProvavel: "Causa provável: Entrada de ar falso no engate do barril ou pressão de CO2 desregulada.",
        passos: [
          "Confirme se o cilindro de CO2 possui carga (manômetro de alta pressão fora da faixa vermelha).",
          "Regule a pressão de saída para exatamente 2,0 bar.",
          "Descarte 2 copos de 300ml seguidos com a torneira totalmente aberta.",
          "Teste o terceiro copo inclinando a 45 graus.",
        ],
      },
    ],
  },
];

// ── PERSISTÊNCIA DE RECEITAS E EQUIPAMENTOS CADASTRADOS PELO GESTOR ─────────
const STORAGE_KEY_RECEITAS = "hefisto_greendot_receitas_custom_v1";
const STORAGE_KEY_EQUIPAMENTOS = "hefisto_greendot_equipamentos_custom_v1";

export function carregarReceitasCustom(unidadeId = "geral") {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_RECEITAS}_${unidadeId || "geral"}`);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function salvarReceitaCustom(receita, unidadeId = "geral") {
  if (typeof window === "undefined") return [];
  try {
    const atuais = carregarReceitasCustom(unidadeId);
    const filtradas = atuais.filter((r) => r.id !== receita.id);
    const novaLista = [receita, ...filtradas];
    localStorage.setItem(`${STORAGE_KEY_RECEITAS}_${unidadeId || "geral"}`, JSON.stringify(novaLista));
    return novaLista;
  } catch {
    return [];
  }
}

export function removerReceitaCustom(id, unidadeId = "geral") {
  if (typeof window === "undefined") return [];
  try {
    const novaLista = carregarReceitasCustom(unidadeId).filter((r) => r.id !== id);
    localStorage.setItem(`${STORAGE_KEY_RECEITAS}_${unidadeId || "geral"}`, JSON.stringify(novaLista));
    return novaLista;
  } catch {
    return [];
  }
}

export function carregarEquipamentosCustom(unidadeId = "geral") {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_EQUIPAMENTOS}_${unidadeId || "geral"}`);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function salvarEquipamentoCustom(equipamento, unidadeId = "geral") {
  if (typeof window === "undefined") return [];
  try {
    const atuais = carregarEquipamentosCustom(unidadeId);
    const filtrados = atuais.filter((e) => e.id !== equipamento.id);
    const novaLista = [equipamento, ...filtrados];
    localStorage.setItem(
      `${STORAGE_KEY_EQUIPAMENTOS}_${unidadeId || "geral"}`,
      JSON.stringify(novaLista)
    );
    return novaLista;
  } catch {
    return [];
  }
}

export function removerEquipamentoCustom(id, unidadeId = "geral") {
  if (typeof window === "undefined") return [];
  try {
    const novaLista = carregarEquipamentosCustom(unidadeId).filter((e) => e.id !== id);
    localStorage.setItem(
      `${STORAGE_KEY_EQUIPAMENTOS}_${unidadeId || "geral"}`,
      JSON.stringify(novaLista)
    );
    return novaLista;
  } catch {
    return [];
  }
}

export const CHAMADOS_MANUTENCAO_INICIAIS = [
  {
    id: "16095232",
    equipamento: "Forno Combinado Rational: Oscilação de Vapor",
    categoria: "EQUIPAMENTOS",
    status: "Chamado Aberto",
    corStatus: "emerald",
    atualizado: "Atualizado hoje às 12:05",
    recente: true,
    serie: "SN: RC-8840-2025",
    detalheProblema:
      "Oscilação de vapor e queda de 20°C durante o pico de almoço. Procedimentos de purga e reinicialização realizados sem sucesso definitivo.",
    fornecedor: "TecFood Assistência Autorizada Rational",
    ordemServico: "17370565",
    janelaChegada: "Hoje, 14h00 – 17h00",
    telefoneSuporte: "0800-770-4110",
  },
  {
    id: "16094810",
    equipamento: "Predial: Dedetização Preventiva & Controle de Pragas",
    categoria: "MANUTENÇÃO",
    status: "Agendado",
    corStatus: "indigo",
    atualizado: "Atualizado hoje às 09:55",
    recente: true,
    serie: "CONTRATO-MENSAL-09",
    detalheProblema: "Visita preventiva mensal pós-fechamento da cozinha e área de recebimento de mercadorias.",
    fornecedor: "BioSafe Controle Ambiental",
    ordemServico: "17368812",
    janelaChegada: "Amanhã, 00h30 – 02h00",
    telefoneSuporte: "0800-555-0199",
  },
  {
    id: "16093104",
    equipamento: "Refrigeração: Borracha da Porta Câmara Fria #2",
    categoria: "EQUIPAMENTOS",
    status: "Chamado Aberto",
    corStatus: "emerald",
    atualizado: "Atualizado hoje às 09:30",
    recente: true,
    serie: "SN: CF-1120-GELOPAR",
    detalheProblema: "Desgaste no canto inferior direito da gaxeta magnética. Solicitada substituição em garantia.",
    fornecedor: "FrioService Refrigeração Comercial",
    ordemServico: "17365001",
    janelaChegada: "Amanhã, 09h00 – 11h30",
    telefoneSuporte: "0800-770-4110",
  },
  {
    id: "16089920",
    equipamento: "Exaustão: Limpeza de Coifas e Filtros Inox",
    categoria: "ESTRUTURA",
    status: "Técnico A",
    corStatus: "emerald",
    atualizado: "Atualizado ontem às 17:43",
    recente: false,
    serie: "SN: EX-4400-AR",
    detalheProblema: "Inspeção do motor do exaustor central e tensionamento de correia.",
    fornecedor: "ClimaPro Engenharia Térmica",
    ordemServico: "17359100",
    janelaChegada: "Quinta-feira, 08h00 – 10h00",
    telefoneSuporte: "0800-770-4110",
  },
];

export const ESCALA_TURNO_GANTT = [
  {
    id: "c1",
    iniciais: "GK",
    nome: "Gabriel K.",
    horario: "08:00 – 16:20",
    tag: "Chef de Partida",
    cargo: "Chef de Partida / Fogão",
    areaId: "cozinha-quente",
    areaNome: "Cozinha Quente",
    praca: "Fogão, Risotos & Massas",
    status: "em-turno",
    statusLabel: "Em turno agora",
    avatar: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=200&q=80",
    inicio: 8,
    fim: 16.3,
    intervalos: [{ h: "11:30", ok: true }],
  },
  {
    id: "c2",
    iniciais: "FA",
    nome: "Fernando A.",
    horario: "08:00 – 16:20",
    tag: "Emprestado Filial",
    cargo: "Cozinheiro 1 / Grelha & Fritura",
    areaId: "cozinha-quente",
    areaNome: "Cozinha Quente",
    praca: "Grelha, Proteínas & Fritadeira",
    status: "em-turno",
    statusLabel: "Em turno agora",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    inicio: 8,
    fim: 16.3,
    intervalos: [{ h: "11:00", ok: true }, { h: "14:00", ok: true }],
  },
  {
    id: "c3",
    iniciais: "IB",
    nome: "Ingrid B.",
    horario: "08:00 – 17:00",
    tag: "Líder de Turno Geral",
    cargo: "Líder de Turno Geral",
    areaId: "gestao",
    areaNome: "Gestão & Liderança",
    praca: "Pass Central & Coordenação Geral",
    status: "em-turno",
    statusLabel: "Em turno agora",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    padrao: "dots",
    inicio: 8,
    fim: 17,
    intervalos: [{ h: "10:30", ok: true }, { h: "14:30", label: "14:30" }],
  },
  {
    id: "c4",
    iniciais: "CG",
    nome: "Carlos G.",
    horario: "09:15 – 17:35",
    tag: "Barman Sênior",
    cargo: "Barman Sênior",
    areaId: "bar",
    areaNome: "Bar & Coquetelaria",
    praca: "Drinks Autorais, Xaropes & Vinhos",
    status: "em-turno",
    statusLabel: "Em turno agora",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    inicio: 9.25,
    fim: 17.6,
    intervalos: [{ h: "11:45", ok: true }, { h: "15:00", ok: true }],
  },
  {
    id: "c5",
    iniciais: "JG",
    nome: "Júlia G.",
    horario: "10:30 – 18:50",
    tag: "Garde Manger",
    cargo: "Garde Manger / Saladas & Sobremesas",
    areaId: "cozinha-fria",
    areaNome: "Cozinha Fria",
    praca: "Saladas, Entradas Frias & Sobremesas",
    status: "em-turno",
    statusLabel: "Em turno agora",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    padrao: "stripes",
    inicio: 10.5,
    fim: 18.8,
    intervalos: [{ h: "15:15", label: "15:15" }, { h: "17:45", label: "17:45" }],
  },
  {
    id: "c6",
    iniciais: "RH",
    nome: "Rita H.",
    horario: "11:30 – 18:30",
    tag: "Líder Salão",
    cargo: "Líder de Salão & Maître",
    areaId: "salao",
    areaNome: "Salão & Hospitalidade",
    praca: "Salão Principal, Recepção & Atendimento",
    status: "em-turno",
    statusLabel: "Em turno agora",
    avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=200&q=80",
    inicio: 11.5,
    fim: 18.5,
    intervalos: [{ h: "14:30", label: "14:30" }, { h: "16:30", label: "16:30" }],
  },
  {
    id: "c7",
    iniciais: "CA",
    nome: "Caio G.",
    horario: "12:00 – 21:15",
    tag: "Grelha & Forno",
    cargo: "Cozinheiro 2 / Forno & Grelha Noturno",
    areaId: "cozinha-quente",
    areaNome: "Cozinha Quente",
    praca: "Forno Combinado & Grelha Noturna",
    status: "inicia-mais-tarde",
    statusLabel: "Inicia às 12:00",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
    padrao: "circles",
    inicio: 12,
    fim: 21.25,
    intervalos: [{ h: "15:30", label: "15:30" }, { h: "18:00", label: "18:00" }],
  },
  {
    id: "c8",
    iniciais: "AH",
    nome: "Amanda H.",
    horario: "14:45 – 22:15",
    tag: "Expedição / Pass",
    cargo: "Expedição / Pass & Controle de Qualidade",
    areaId: "pass",
    areaNome: "Expedição & Pass",
    praca: "Pass de Saída, Conferência & Delivery",
    status: "inicia-mais-tarde",
    statusLabel: "Inicia às 14:45",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    inicio: 14.75,
    fim: 22.25,
    intervalos: [{ h: "18:45", label: "18:45" }],
  },
  {
    id: "c9",
    iniciais: "JS",
    nome: "João S.",
    horario: "15:30 – 23:45",
    tag: "Bar Noturno",
    cargo: "Bartender Noturno",
    areaId: "bar",
    areaNome: "Bar & Coquetelaria",
    praca: "Chopeira Torre, Drinks Noturnos & Fechamento",
    status: "inicia-mais-tarde",
    statusLabel: "Inicia às 15:30",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    padrao: "dots",
    inicio: 15.5,
    fim: 23.75,
    intervalos: [{ h: "19:15", label: "19:15" }],
  },
];

// ── ORGANOGRAMA HIERÁRQUICO POR ÁREA DO DIA (COZINHA, BAR, SALÃO, PASS, GESTÃO) ──
export const ESCALA_ORGANOGRAMA_DO_DIA = {
  data: "Segunda-feira, 19 de Outubro",
  turno: "Almoço & Jantar (Contínuo)",
  totalColaboradores: 9,
  emTurnoAgoraCount: 6,
  iniciamMaisTardeCount: 3,
  horarioPicoAlmoco: "12:00 – 14:00",
  horarioPicoJantar: "19:30 – 21:30",
  liderGeral: {
    id: "c3",
    iniciais: "IB",
    nome: "Ingrid B.",
    cargo: "Líder de Turno Geral",
    areaId: "gestao",
    areaNome: "Gestão & Coordenação Geral",
    horario: "08:00 – 17:00",
    status: "em-turno",
    statusLabel: "Em turno agora",
    praca: "Pass Central & Caixa",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    responsabilidade:
      "Abertura de turno, coordenação entre cozinha, bar e salão, liberação de tempos no Pass e gestão de imprevistos.",
  },
  areas: [
    {
      id: "cozinha-quente",
      nome: "Cozinha Quente & Cocção",
      sigla: "CQ",
      cor: "#A43E2B",
      bgCor: "#FBEBE8",
      bordaCor: "#E3A397",
      liderArea: "Gabriel K. (Chef de Partida)",
      descricao: "Cocção de massas, caldos, risotos, fritura e grelha de carnes",
      colaboradores: [
        ESCALA_TURNO_GANTT[0], // Gabriel K.
        ESCALA_TURNO_GANTT[1], // Fernando A.
        ESCALA_TURNO_GANTT[6], // Caio G.
      ],
    },
    {
      id: "cozinha-fria",
      nome: "Cozinha Fria & Garde Manger",
      sigla: "CF",
      cor: "#2E6F4E",
      bgCor: "#EBF5EF",
      bordaCor: "#A9D4BC",
      liderArea: "Júlia G. (Garde Manger)",
      descricao: "Mise en place de saladas, carpaccios, ceviches e sobremesas",
      colaboradores: [
        ESCALA_TURNO_GANTT[4], // Júlia G.
      ],
    },
    {
      id: "pass",
      nome: "Expedição & Pass (Controle de Qualidade)",
      sigla: "PASS",
      cor: "#69387D",
      bgCor: "#F5EDF8",
      bordaCor: "#D2B2DE",
      liderArea: "Amanda H. (Pass)",
      descricao: "Conferência de comanda, temperatura de pratos e embalagem Delivery",
      colaboradores: [
        ESCALA_TURNO_GANTT[7], // Amanda H.
      ],
    },
    {
      id: "bar",
      nome: "Bar & Coquetelaria",
      sigla: "BAR",
      cor: "#9E6412",
      bgCor: "#FAF1DF",
      bordaCor: "#E8CD96",
      liderArea: "Carlos G. (Barman Sênior)",
      descricao: "Tiragem de chopp, coquetéis clássicos e autorais, vinhos e xaropes",
      colaboradores: [
        ESCALA_TURNO_GANTT[3], // Carlos G.
        ESCALA_TURNO_GANTT[8], // João S.
      ],
    },
    {
      id: "salao",
      nome: "Salão & Hospitalidade",
      sigla: "SALÃO",
      cor: "#235B7E",
      bgCor: "#E8F3FA",
      bordaCor: "#A2CBE4",
      liderArea: "Rita H. (Líder Salão)",
      descricao: "Acolhimento de clientes, gestão de praças de mesas e serviço de salão",
      colaboradores: [
        ESCALA_TURNO_GANTT[5], // Rita H.
      ],
    },
  ],
};

export const EXTRAS_DISPONIVEIS = [
  {
    id: "bruno-s",
    nome: "Bruno S.",
    funcao: "Forno & Grelha / Cozinha Quente",
    pracaCodigo: "FORNO & GRELHA",
    iniciais: "BS",
    rotinas: ["Rotina de Forno Combinado", "Apoio Grelha & Parmegiana"],
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    tempoChegada: "6 min",
  },
  {
    id: "viviane-w",
    nome: "Viviane W.",
    funcao: "Bar & Coquetelaria / Salão",
    pracaCodigo: "BAR & DRINKS",
    iniciais: "VW",
    rotinas: ["Rotina de Coquetéis", "Reposição de Copos & Gelo"],
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    tempoChegada: "12 min",
  },
  {
    id: "katia-s",
    nome: "Kátia S.",
    funcao: "Garde Manger & Sobremesas",
    pracaCodigo: "GARDE MANGER",
    iniciais: "KS",
    rotinas: ["Rotina de Pratos Frios", "Finalização de Sobremesas"],
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
    tempoChegada: "15 min",
  },
  {
    id: "natan-d",
    nome: "Natan D.",
    funcao: "Expedição (Pass) & Delivery",
    pracaCodigo: "PASS / EXPEDIÇÃO",
    iniciais: "ND",
    rotinas: ["Conferência de Comandas", "Embalagem Delivery"],
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    tempoChegada: "9 min",
  },
];

export const FORMACAO_PRACAS_BASE = [
  {
    id: "gk",
    iniciais: "GK",
    nome: "Gabriel K.",
    praca: "FOGÃO & RISOTOS",
    estacaoMapa: "fogao",
    rotinas: ["Rotina de Risotos & Massas", "Controle de Caldos"],
  },
  {
    id: "fa",
    iniciais: "FA",
    nome: "Fernando A.",
    praca: "GRELHA & FRITURA",
    estacaoMapa: "grelha",
    rotinas: ["Rotina de Proteínas", "Empanados & Fritadeira"],
  },
  {
    id: "ib",
    iniciais: "IB",
    nome: "Ingrid B.",
    praca: "PASS & CAIXA / PDV",
    estacaoMapa: "pdv",
    rotinas: ["Chamada de Comandas", "Conferência de Padrão"],
  },
  {
    id: "cg",
    iniciais: "CG",
    nome: "Carlos G.",
    praca: "BAR & COQUETELARIA",
    estacaoMapa: "bar",
    rotinas: ["Rotina de Drinks Autorais", "Tiragem de Chopp"],
  },
];

// ── LOCAIS HOMOLOGADOS DE ARMAZENAMENTO & RASTREAMENTO EM PRODUÇÃO (GREEN DOT) ──
export const LOCAIS_ARMAZENAMENTO_PADRAO = [
  {
    id: "camara-fria-prat-2",
    nome: "Câmara Fria 1 — Prateleira 2 (Bases & Pré-Preparos)",
    setor: "Cozinha Quente / Fria",
    tipo: "camara-fria",
    temperatura: "2°C a 4°C",
    capacidadeGns: "8 cubas GN 1/2 ou 4 cubas GN 1/1",
    icone: "Snowflake",
  },
  {
    id: "camara-fria-prat-1",
    nome: "Câmara Fria 1 — Prateleira 1 (Laticínios, Molhos & Sobremesas)",
    setor: "Cozinha Fria / Garde Manger",
    tipo: "camara-fria",
    temperatura: "2°C a 4°C",
    capacidadeGns: "10 caixas herméticas",
    icone: "Milk",
  },
  {
    id: "camara-fria-prat-4",
    nome: "Câmara Fria 1 — Prateleira 4 (Pescados, Frutos do Mar & Carnes)",
    setor: "Cozinha Quente / Açougue",
    tipo: "camara-fria",
    temperatura: "0°C a 2°C",
    capacidadeGns: "Bandejas drenadas exclusivas",
    icone: "Fish",
  },
  {
    id: "freezer-proteinas",
    nome: "Câmara Congelados / Freezer — Gaveta 3 (Proteínas Brutas)",
    setor: "Estoque Central",
    tipo: "freezer",
    temperatura: "-18°C a -22°C",
    capacidadeGns: "Estoque em caixas",
    icone: "IceCream",
  },
  {
    id: "geladeira-bar",
    nome: "Geladeira do Bar — Prateleira Superior (Frutas, Xaropes & Purês)",
    setor: "Bar & Coquetelaria",
    tipo: "refrigerador-bar",
    temperatura: "4°C a 6°C",
    capacidadeGns: "Sifões iSi e bisnagas dosadoras",
    icone: "GlassWater",
  },
  {
    id: "bancada-banho-maria",
    nome: "Bancada Quente — Banho-Maria GN 1/3 (Pronto para Empratamento)",
    setor: "Cozinha Quente / Fogão",
    tipo: "aquecido",
    temperatura: "68°C a 75°C",
    capacidadeGns: "4 cubas GN 1/3 aquecidas",
    icone: "Flame",
  },
  {
    id: "garde-manger-gaveta",
    nome: "Garde Manger — Gaveta Refrigerada 1 (Saladas & Folhas Lavadas)",
    setor: "Cozinha Fria",
    tipo: "gaveta-refrigerada",
    temperatura: "3°C a 5°C",
    capacidadeGns: "Caixas perfuradas com papel toalha",
    icone: "Salad",
  },
  {
    id: "estoque-seco-estante-a",
    nome: "Estoque Seco — Estante A, Prateleira 2 (Secos & Condimentos)",
    setor: "Almoxarifado Geral",
    tipo: "estoque-seco",
    temperatura: "Ambiente (20°C a 24°C)",
    capacidadeGns: "Potes plásticos atóxicos vedados",
    icone: "Box",
  },
  {
    id: "pass-aquecido",
    nome: "Pass & Expedição — Estufa Aquecida de Pratos Prontos",
    setor: "Expedição / Salão",
    tipo: "estufa",
    temperatura: "65°C constante",
    capacidadeGns: "Bancada de saída",
    icone: "BellRing",
  },
];

// Lotes de pré-preparo e estoque ativos no sistema com rastreamento de localização
export const LOTES_RASTREIO_INICIAIS = [
  {
    id: "rastreio-vtp-01",
    produto: "Vatapá da Casa (Pré-Preparo Produzido)",
    produtoId: "vatapa-baiano",
    lote: "LOTE-VTP-8921",
    localizacao: "Câmara Fria 1 — Prateleira 2 (Bases & Pré-Preparos)",
    setor: "Cozinha Quente / Câmaras",
    temperatura: "2°C a 4°C",
    quantidade: "6,5 kg (2 cubas GN 1/2)",
    conservacao: "Resfriado",
    manipuladoEm: "Hoje às 08:30",
    validadeEm: "Vence em 3 dias (22/10 às 08:30)",
    responsavel: "Gabriel K.",
    statusPvps: "🟢 1º QUE SAI (Usar este lote antes do novo)",
    dicaLocalizacao:
      "Ao entrar na câmara fria principal, olhe na estante de inox à direita, 2ª prateleira de cima para baixo. Cuba de inox com tampa verde e etiqueta térmica 60x40mm com QR Code de rastreio.",
    tags: ["vatapa", "vatapá", "molho", "pre-preparo", "base", "baiano"],
  },
  {
    id: "rastreio-cmr-02",
    produto: "Camarão Rosa GG Dessalgado & Limpo",
    produtoId: "camarao-seco",
    lote: "LOTE-CMR-4410",
    localizacao: "Câmara Fria 1 — Prateleira 4 (Pescados, Frutos do Mar & Carnes)",
    setor: "Cozinha Quente / Açougue",
    temperatura: "0°C a 2°C",
    quantidade: "4,5 kg porcionados em sacos a vácuo (1kg cada)",
    conservacao: "Resfriado (Descongelamento seguro Pull-to-Thaw)",
    manipuladoEm: "Ontem às 22:00",
    validadeEm: "Vence amanhã às 18:00 (Restam 28h)",
    responsavel: "Fernando A.",
    statusPvps: "🟢 1º QUE SAI (Lote em processo de degelo concluído)",
    dicaLocalizacao:
      "Na prateleira inferior da câmara fria (regra ANVISA: pescados sempre na base), em bandeja plástica branca perfurada com coletor de líquido.",
    tags: ["camarao", "camarão", "frutos do mar", "pescado", "proteina"],
  },
  {
    id: "rastreio-coco-03",
    produto: "Leite de Coco Puro (Garrafas 1L)",
    produtoId: "leite-coco",
    lote: "LOTE-LCO-3012",
    localizacao: "Estoque Seco — Estante A, Prateleira 2 (Secos & Condimentos)",
    setor: "Almoxarifado Geral",
    temperatura: "Ambiente (22°C)",
    quantidade: "12 Litros fechados (Caixa lacrada) + 2 Litros abertos na Câmara 1",
    conservacao: "Ambiente fechado / Resfriado após aberto",
    manipuladoEm: "Lote de fábrica SIF 8802",
    validadeEm: "Validade industrial: 15/12/2026",
    responsavel: "Almoxarife / Recebimento",
    statusPvps: "⚪ Estoque Geral de Insumos",
    dicaLocalizacao:
      "Caixa lacrada na estante A do almoxarifado seco. Garrafas abertas em uso ficam na Prateleira 1 da Câmara Fria 1 etiquetadas.",
    tags: ["leite de coco", "coco", "leite coco", "garrafa"],
  },
  {
    id: "rastreio-bar-04",
    produto: "Espuma de Gengibre Artesanal (Moscow Mule)",
    produtoId: "moscow-mule",
    lote: "LOTE-ESP-1104",
    localizacao: "Geladeira do Bar — Prateleira Superior (Frutas, Xaropes & Purês)",
    setor: "Bar & Coquetelaria",
    temperatura: "4°C a 6°C",
    quantidade: "2 Sifões iSi de 1 Litro abastecidos e pressurizados",
    conservacao: "Resfriado",
    manipuladoEm: "Hoje às 10:15",
    validadeEm: "Vence em 2 dias (21/10 às 10:15)",
    responsavel: "Carlos G.",
    statusPvps: "🟢 Pronto para Serviço no Bar",
    dicaLocalizacao:
      "Dentro da geladeira sob a bancada do bar, na porta esquerda, prateleira superior. Sifões prateados com anel de identificação verde.",
    tags: ["espuma", "gengibre", "moscow", "mule", "bar", "drink", "sifao"],
  },
  {
    id: "rastreio-rst-05",
    produto: "Massa de Risoto Pré-Cozida (Arroz Carnaroli)",
    produtoId: "risoto-camarao",
    lote: "LOTE-RST-5520",
    localizacao: "Câmara Fria 1 — Prateleira 2 (Bases & Pré-Preparos)",
    setor: "Cozinha Quente / Fogão",
    temperatura: "2°C a 4°C",
    quantidade: "12 porções de 160g em sacos ziploc identificados",
    conservacao: "Resfriado (Após choque térmico em banho de gelo)",
    manipuladoEm: "Hoje às 09:00",
    validadeEm: "Vence em 48 horas (21/10 às 09:00)",
    responsavel: "Gabriel K.",
    statusPvps: "🟢 1º QUE SAI",
    dicaLocalizacao:
      "Câmara Fria 1, prateleira 2 ao lado da cuba de vatapá. Porções embaladas individualmente para regeneração rápida em 6 minutos.",
    tags: ["risoto", "arroz", "carnaroli", "massa de risoto", "base risoto"],
  },
];

const STORAGE_KEY_RASTREIO = "hefisto_rastreio_etiquetas";

export function obterTodosRastreios(unidadeId = "geral") {
  if (typeof window === "undefined") return LOTES_RASTREIO_INICIAIS;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_RASTREIO}_${unidadeId || "geral"}`);
    const dinamicos = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(dinamicos) || dinamicos.length === 0) return LOTES_RASTREIO_INICIAIS;
    return [...dinamicos, ...LOTES_RASTREIO_INICIAIS];
  } catch {
    return LOTES_RASTREIO_INICIAIS;
  }
}

export function salvarRastreioEtiqueta(dados, unidadeId = "geral") {
  if (typeof window === "undefined" || !dados) return null;
  try {
    const novoRastreio = {
      id: `rastreio-din-${Date.now()}`,
      produto: dados.produto || "Pré-Preparo",
      produtoId: normalizarTexto(dados.produto || "").replace(/\s+/g, "-"),
      lote: dados.lote || `LOTE-${(dados.codigo || "").slice(0, 4) || "AUTO"}`,
      localizacao: dados.localizacao || "Câmara Fria 1 — Prateleira 2 (Bases & Pré-Preparos)",
      setor: dados.departamento || "Cozinha & Produção",
      temperatura: dados.conservacao === "Congelado" ? "-18°C" : dados.conservacao === "Resfriado" ? "2°C a 4°C" : "Ambiente",
      quantidade: `${dados.quantidade || 1} ${dados.unidade || "kg"}`,
      conservacao: dados.conservacao || "Resfriado",
      manipuladoEm: new Date().toLocaleDateString("pt-BR") + " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      validadeEm: `Vence em ${dados.validade_dias || 3} dias`,
      responsavel: dados.responsavel || "Líder de Turno",
      statusPvps: "🟢 Lote Etiquetado Recentemente",
      dicaLocalizacao: `Armazenado em: ${dados.localizacao || "Câmara Fria 1"}. Procure pela etiqueta com lote ${dados.lote || "do dia"}.`,
      tags: normalizarTexto(dados.produto || "").split(/\s+/).filter(Boolean),
    };

    const atuais = obterTodosRastreios(unidadeId).filter((r) => !r.id.startsWith("rastreio-vtp"));
    const novaLista = [novoRastreio, ...atuais.filter((r) => r.id.startsWith("rastreio-din"))];
    localStorage.setItem(`${STORAGE_KEY_RASTREIO}_${unidadeId || "geral"}`, JSON.stringify(novaLista));
    return novoRastreio;
  } catch {
    return null;
  }
}

// Busca tolerante a erros de digitação e variações de fala: "onde ta o vatapa", "kd o camarao", "onde guardou", etc.
export function buscarLocalizacaoProduto(fraseOuNome, unidadeId = "geral") {
  const q = normalizarTexto(fraseOuNome || "");
  const lista = obterTodosRastreios(unidadeId);

  // 1. Match exato ou por tags
  const encontrado = lista.find((item) => {
    const nomeNorm = normalizarTexto(item.produto);
    if (q.includes(nomeNorm) || nomeNorm.includes(q)) return true;
    return (item.tags || []).some((tag) => q.includes(normalizarTexto(tag)));
  });

  if (encontrado) return encontrado;

  // 2. Se a frase menciona ingredientes ou pratos conhecidos
  if (q.includes("vatapa") || q.includes("baiano")) {
    return lista.find((r) => r.tags?.includes("vatapa")) || lista[0];
  }
  if (q.includes("camarao") || q.includes("camarão")) {
    return lista.find((r) => r.tags?.includes("camarao")) || lista[1];
  }
  if (q.includes("coco") || q.includes("leite")) {
    return lista.find((r) => r.tags?.includes("coco")) || lista[2];
  }
  if (q.includes("espuma") || q.includes("mule") || q.includes("bar") || q.includes("drink")) {
    return lista.find((r) => r.tags?.includes("espuma")) || lista[3];
  }
  if (q.includes("risoto") || q.includes("arroz")) {
    return lista.find((r) => r.tags?.includes("risoto")) || lista[4];
  }

  // 3. Fallback inteligente: se for carne/pescado ou legume genérico
  if (q.includes("carne") || q.includes("bife") || q.includes("frango") || q.includes("peixe")) {
    return {
      produto: "Proteínas Cruas / Carnes",
      lote: "LOTE-ESTOQUE-CENTRAL",
      localizacao: "Câmara Fria 1 — Prateleira 4 (Pescados, Frutos do Mar & Carnes)",
      setor: "Cozinha Quente / Açougue",
      temperatura: "0°C a 2°C (Carnes Resfriadas) ou -18°C (Congelados)",
      quantidade: "Ver saldo em Estoque",
      conservacao: "Resfriado / Congelado",
      manipuladoEm: "Conforme etiqueta PVPS",
      validadeEm: "Regra ANVISA: 72h após descongelamento",
      responsavel: "Açougue / Cozinha",
      statusPvps: "Regra PVPS: Sempre na prateleira inferior",
      dicaLocalizacao:
        "Segundo a ANVISA RDC 216, todas as carnes, pescados e aves cruas devem ficar obrigatoriamente na prateleira inferior (base) da câmara fria para evitar gotejamento sobre alimentos prontos.",
    };
  }

  return lista[0];
}

// Interpretador adaptativo de perguntas de colaboradores de restaurante.
// O sistema se adapta a gírias, erros de digitação, frases incompletas e
// SEMPRE fornece uma resposta clara e uma solução prática em 3 passos!
export function interpretarPerguntaColaborador(pergunta, {
  todasAsReceitas = RECEITAS_GREEN_DOT,
  ultimaReceitaAtiva = null,
  todosOsEquipamentos = EQUIPAMENTOS_MANUTENCAO,
  unidadeId = "geral",
} = {}) {
  const p = String(pergunta || "").trim();
  const q = normalizarTexto(p);

  // 1. RASTREABILIDADE & ONDE ESTÁ O PRODUTO (Cadê, Onde tá, Onde guardaram, Onde fica, Onde acho, Onde coloco)
  const isPerguntaOndeEsta =
    q.includes("onde ta") ||
    q.includes("onde esta") ||
    q.includes("onde fica") ||
    q.includes("onde guard") ||
    q.includes("onde bot") ||
    q.includes("onde enfia") ||
    q.includes("onde acho") ||
    q.includes("onde achar") ||
    q.includes("onde coloco") ||
    q.includes("kd ") ||
    q.startsWith("kd") ||
    q.includes("cade ") ||
    q.startsWith("cade") ||
    q.includes("localizacao") ||
    q.includes("localizac") ||
    q.includes("rastre") ||
    (q.includes("tem ") && (q.includes("pronto") || q.includes("pronta") || q.includes("sobrando") || q.includes("feito")));

  if (isPerguntaOndeEsta) {
    const itemRastreio = buscarLocalizacaoProduto(q, unidadeId);
    return {
      tipo: "rastreio-localizacao",
      item: itemRastreio,
      respostaVoz: `O ${itemRastreio.produto} está em: ${itemRastreio.localizacao}, lote ${itemRastreio.lote}. Quantidade: ${itemRastreio.quantidade}.`,
      solucaoTexto: `Localizado no sistema de rastreio! Vá até ${itemRastreio.localizacao}. ${itemRastreio.dicaLocalizacao}`,
    };
  }

  // 2. RECÁLCULO PROPORCIONAL ("só tenho 2L", "era pra ser 3L", "tenho pouco ingrediente")
  const intencaoRecalculo = detectarIntencaoRecalculo(p, ultimaReceitaAtiva, todasAsReceitas);
  if (intencaoRecalculo && intencaoRecalculo.calculo) {
    return {
      tipo: "receita-recalculada",
      receita: intencaoRecalculo.receita,
      calculo: intencaoRecalculo.calculo,
      respostaVoz: `Recalculei ${intencaoRecalculo.receita.nome} para ${intencaoRecalculo.calculo.percentual}% da receita original, com base em ${intencaoRecalculo.calculo.quantidadeDisponivelLimitante} ${intencaoRecalculo.calculo.ingredienteLimitante.unidade} de ${intencaoRecalculo.calculo.ingredienteLimitante.nome}.`,
      solucaoTexto: `Receita recalculada com sucesso! Todos os insumos foram reduzidos proporcionalmente para manter o ponto e sabor da casa.`,
    };
  }

  // 3. EQUIPAMENTOS, VOLTAGEM 110V/220V, ENCAIXE, USO E LIMPEZA
  const isPerguntaEquip =
    q.includes("110") ||
    q.includes("220") ||
    q.includes("voltagem") ||
    q.includes("tensao") ||
    q.includes("tomada") ||
    q.includes("liquidificador") ||
    q.includes("forno") ||
    q.includes("chopeira") ||
    q.includes("fritadeira") ||
    q.includes("encaixar") ||
    q.includes("copo") ||
    q.includes("tampa") ||
    (q.includes("como usar") && !q.includes("sistema")) ||
    (q.includes("como limpar") && (q.includes("maquina") || q.includes("aparelho") || q.includes("equipamento") || q.includes("liquidificador") || q.includes("forno")));

  if (isPerguntaEquip) {
    const filtroCategoria = q.includes("liquidificador")
      ? "liquidificador"
      : q.includes("forno")
      ? "forno"
      : q.includes("fritadeira")
      ? "fritadeira"
      : q.includes("chopeira")
      ? "chopeira"
      : null;

    const abaSugerida =
      q.includes("encaixar") || q.includes("encaixe") || q.includes("copo") || q.includes("tampa")
        ? "encaixe"
        : q.includes("limpar") || q.includes("higienizar") || q.includes("lavar")
        ? "limpeza"
        : q.includes("como usar") || q.includes("bater") || q.includes("operar")
        ? "uso"
        : "voltagem";

    return {
      tipo: "equipamento-visual-guia",
      filtroCategoria,
      abaInicial: abaSugerida,
      respostaVoz: "Aqui estão as fotos dos equipamentos cadastrados da loja. Toque no seu aparelho para ver voltagem 110V ou 220V, como encaixar o copo e como usar.",
      solucaoTexto: "Selecione o equipamento que você está operando na bancada para ver o guia visual completo.",
    };
  }

  // 4. HIGIENIZAÇÃO, LIMPEZA & QUÍMICA ANVISA (Chão, Panos, Mãos, Hortifrúti, Quantas ml)
  const isPerguntaLimpeza =
    q.includes("chao") ||
    q.includes("pano") ||
    q.includes("opano") ||
    q.includes("lavar a mao") ||
    q.includes("lavar as maos") ||
    q.includes("lavar mao") ||
    q.includes("quantas ml") ||
    q.includes("quanto produto") ||
    q.includes("qual produto") ||
    q.includes("desengordurante") ||
    q.includes("sanitiz") ||
    q.includes("desinfet") ||
    q.includes("cloro") ||
    q.includes("balde");

  if (isPerguntaLimpeza) {
    const rotinaId =
      q.includes("pano") || q.includes("opano")
        ? "limpeza-panos"
        : q.includes("mao")
        ? "lavagem-maos"
        : q.includes("fruta") || q.includes("salada") || q.includes("hortali")
        ? "sanitizacao-hortifruti"
        : "limpeza-chao";

    return {
      tipo: "guia-limpeza",
      rotinaInicialId: rotinaId,
      respostaVoz:
        rotinaId === "limpeza-chao"
          ? "Para o chão, use 50 ml de desengordurante para 5 litros de água morna e deixe agir 10 minutos."
          : rotinaId === "limpeza-panos"
          ? "Para panos, use 25 ml de cloro por litro de água fria por 20 a 30 minutos."
          : "Para as mãos, use sabonete bactericida inodoro por 40 a 60 segundos e finalize com álcool 70%.",
      solucaoTexto: "Guia oficial ANVISA e calculadora de diluição química em ml pronta para uso.",
    };
  }

  // 5. CHECKLISTS DE PRAÇA (Abertura, Saída, Fechamento, Passar turno)
  const isPerguntaChecklist =
    q.includes("checklist") ||
    q.includes("abertura") ||
    q.includes("fechamento") ||
    q.includes("saida") ||
    q.includes("passar o turno") ||
    q.includes("mise en place");

  if (isPerguntaChecklist) {
    const tipoCheck = q.includes("fechamento") || q.includes("saida") ? "fechamento" : "abertura";
    return {
      tipo: "checklist-turno",
      tipoInicial: tipoCheck,
      respostaVoz:
        tipoCheck === "abertura"
          ? "Aqui está o checklist de abertura da praça. Marque cada item antes do restaurante abrir."
          : "Aqui está o checklist de saída e fechamento de turno com conferência obrigatória de gás e equipamentos.",
      solucaoTexto: "Conferência digital da praça para não esquecer nenhum procedimento crítico.",
    };
  }

  // 6. ETIQUETA DE VALIDADE / ANVISA COM RASTREIO OBRIGATÓRIO
  const isPerguntaEtiqueta =
    q.includes("etiqueta") ||
    q.includes("rotulo") ||
    q.includes("validade") ||
    q.includes("etiquetar");

  if (isPerguntaEtiqueta) {
    return {
      tipo: "etiqueta-rapida",
      produtoInicial: ultimaReceitaAtiva?.nome || "Vatapá Tradicional da Casa",
      respostaVoz: "Abri o gerador rápido de etiqueta térmica ANVISA com local de armazenamento obrigatório para rastreio em produção.",
      solucaoTexto: "Gere a etiqueta 60x40mm informando onde o pote será guardado para rastrear no sistema.",
    };
  }

  // 7. ESCALA DO DIA, HORÁRIOS E ORGANOGRAMA
  const isPerguntaEscala =
    q.includes("escala") ||
    q.includes("organograma") ||
    q.includes("quem trabalha") ||
    q.includes("quem esta trabalhando") ||
    q.includes("horario de trabalho") ||
    q.includes("horarios");

  if (isPerguntaEscala) {
    return {
      tipo: "escala-organograma",
      respostaVoz: "Aqui está o organograma de hoje por área com as 5 praças, líderes e horários de trabalho.",
      solucaoTexto: "Visualize a distribuição da equipe hoje e quem apoia cada praça no pico.",
    };
  }

  // 8. RECEITAS ESPECÍFICAS PELO NOME OU PALAVRA-CHAVE
  const receita = todasAsReceitas.find((r) => {
    const nomeNorm = normalizarTexto(r.nome || "");
    if (q.includes(nomeNorm)) return true;
    if ((q.includes("vatapa") || q.includes("baiano")) && r.id.includes("vatapa")) return true;
    if (q.includes("risoto") && r.id.includes("risoto")) return true;
    if ((q.includes("mule") || q.includes("moscow")) && r.id.includes("moscow")) return true;
    if (q.includes("parmegiana") && r.id.includes("parmegiana")) return true;
    return false;
  });

  if (receita) {
    return {
      tipo: "receita-completa",
      receita,
      respostaVoz: `Aqui está a receita de ${receita.nome} com fotos, vídeo e ingredientes ligados ao estoque.`,
      solucaoTexto: `Modo de preparo padronizado da casa pronto para consulta em bancada.`,
    };
  }

  // 9. SITUAÇÕES DE APURO / RUSH / DÚVIDAS GENÉRICAS / COLABORADOR PERDIDO (SEMPRE TER RESPOSTA E SOLUÇÃO)
  const isSituacaoEmergenciaOuDuvida =
    q.includes("perdido") ||
    q.includes("socorro") ||
    q.includes("ajuda") ||
    q.includes("deu ruim") ||
    q.includes("o que eu faco") ||
    q.includes("o que faco") ||
    q.includes("atrasad") ||
    q.includes("acumul") ||
    q.includes("queim") ||
    q.includes("estranho") ||
    q.includes("cliente") ||
    q.includes("rush");

  if (isSituacaoEmergenciaOuDuvida) {
    return {
      tipo: "plano-solucao-imediato",
      titulo: "🚨 Plano de Solução Operacional Imediato",
      situacao: p,
      passosSolucao: [
        {
          ordem: 1,
          acao: "Respira e organiza a bancada (PVPS)",
          detalhe: "Priorize as comandas por ordem de chegada (a mais antiga primeiro). Não tente fazer tudo de uma vez.",
        },
        {
          ordem: 2,
          acao: "Acione o Líder de Turno ou Apoio Extra",
          detalhe: "Ingrid B. está na liderança geral no Pass. Bruno S. está disponível para apoio imediato em 6 minutos.",
        },
        {
          ordem: 3,
          acao: "Alinhe o tempo de saída com o Salão",
          detalhe: "Avise Rita H. (Salão) sobre eventuais pratos com tempo estendido para acalmar a mesa com entrada ou couvert.",
        },
      ],
      respostaVoz: "Fique calmo! Organizei um plano de ação em 3 passos para resolver o seu rush agora. Você também pode acionar o apoio do Bruno ou falar com a Ingrid no Pass.",
      solucaoTexto: "Solução imediata para destravar o serviço da praça sem erros nem estresse.",
    };
  }

  // 10. RESPOSTA PADRÃO RESOLUTIVA (NUNCA DIZ "NÃO SEI", SEMPRE APRESENTA SOLUÇÕES E ENCAMINHAMENTOS)
  return {
    tipo: "plano-solucao-imediato",
    titulo: `💡 Assistência & Solução para: "${p}"`,
    situacao: p,
    passosSolucao: [
      {
        ordem: 1,
        acao: "Localização & Rastreio de Insumos",
        detalhe: "Verifique os pré-preparos e cubas etiquetadas na Câmara Fria 1 (Prateleira 2) ou no Estoque Seco.",
      },
      {
        ordem: 2,
        acao: "Fichas Técnicas & Recálculo",
        detalhe: "Consulte o modo de preparo oficial com fotos e vídeos, ou recalcule as quantidades caso falte algum ingrediente.",
      },
      {
        ordem: 3,
        acao: "Manuais de Equipamentos & Procedimentos",
        detalhe: "Confira a voltagem correta (110V/220V), modo de encaixe e higienização aprovada pela ANVISA.",
      },
    ],
    respostaVoz: "Entendido! Aqui estão as soluções imediatas para a sua dúvida na bancada. Você pode rastrear produtos, abrir receitas ou checar equipamentos.",
    solucaoTexto: "Selecione uma das opções abaixo para resolver sua dúvida com segurança.",
  };
}
