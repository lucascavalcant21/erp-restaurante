// Base de conhecimento operacional e dados estruturados do Green Dot Assist (Edição Restaurante - Héfisto)

export const TOPICOS_INICIAIS = {
  producao: [
    { id: "risoto-camarao", label: "Risoto de Camarão Trufado", prompt: "Quero aprender a fazer o Risoto de Camarão Trufado perfeito." },
    { id: "rotina-forno", label: "Rotina de Cocção & Forno", prompt: "Qual é a rotina padrão de aquecimento e regeneração no Forno Combinado?" },
    { id: "moscow-mule", label: "Moscow Mule da Casa", prompt: "Como preparar o Moscow Mule Artesanal com espuma de gengibre?" },
    { id: "file-parmegiana", label: "Filé à Parmegiana", prompt: "Mostre a ficha técnica e montagem do Filé à Parmegiana da Casa." },
  ],
  estoque: [
    { id: "pull-to-thaw", label: "Descongelamento (Pull-to-Thaw)", prompt: "Qual a tabela e procedimento de descongelamento seguro (Pull-to-Thaw) para o turno?" },
    { id: "organizacao-camara", label: "Organização de Câmara & PVPS", prompt: "Como organizar a câmara fria e aplicar a regra PVPS na cozinha?" },
  ],
  manutencao: [
    { id: "forno-vapor", label: "Forno Combinado Oscilando", prompt: "O Forno Combinado não está mantendo o vapor e a temperatura constantes. Como consertar?" },
    { id: "chopeira-espuma", label: "Chopeira Tirando Muita Espuma", prompt: "A chopeira de 2 vias está saindo só espuma. Qual o diagnóstico?" },
  ],
  escala: [
    { id: "mapa-pracas", label: "Mapa de Praças (Play Caller)", prompt: "Mostre o posicionamento da equipe nas praças para o horário de pico." },
    { id: "escala-turno", label: "Escala do Dia & Picos", prompt: "Abrir a escala horária do turno e previsão de pico." },
  ],
};

export const RECEITAS_GREEN_DOT = [
  {
    id: "risoto-camarao",
    codigo: "RCT-01",
    nome: "Risoto de Camarão* Trufado",
    subtituloNota: "*Camarão Rosa GG limpo sem casca (16/20)",
    setor: "Cozinha Quente",
    tempoPreparo: "14 min",
    temperaturaServico: "68°C – 72°C",
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
      { titulo: "Prateleira 2 (Meio-Alto): Pré-Preparos Cozidos & Vegetais Higienizados", desc: "Bases de risoto pré-cocidas, caldos reduzidos e folhas sanitizadas em caixas herméticas." },
      { titulo: "Prateleira 3 (Meio-Baixo): Carnes Bovinas e Suínas Cruas", desc: "Sempre em GNs com grade coletora de exsudato e etiqueta visível na face frontal." },
      { titulo: "Prateleira 4 (Base): Pescados, Crustáceos e Aves Cruas", desc: "Camarões, salmão e frango na parte mais fria e inferior, evitando qualquer gotejamento sobre outros itens." },
    ],
  },
};

export const EQUIPAMENTOS_MANUTENCAO = [
  {
    id: "forno-combinado",
    nome: "Forno Combinado Rational iCombi",
    nomeCurto: "Forno Combinado",
    codigoSerie: "SN: RC-8840-2025",
    setor: "Cozinha Quente",
    falhaPrincipal: "Oscilação de Vapor / Temperatura Inconsistente",
    imagem: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80",
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
    nome: "Chopeira & Torre 2 Vias Glycol",
    nomeCurto: "Chopeira 2 Vias",
    codigoSerie: "SN: CH-2091-BREW",
    setor: "Bar",
    falhaPrincipal: "Excesso de Espuma (Chopp Quente ou Pressão de CO2)",
    imagem: "https://images.unsplash.com/photo-1575037614876-c38a4d44f5b8?auto=format&fit=crop&w=800&q=80",
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
  {
    id: "fritadeira-vulcan",
    nome: "Fritadeira Industrial a Gás Vulcan 2 Cubas",
    nomeCurto: "Fritadeira Vulcan",
    codigoSerie: "SN: VL-5510-FRY",
    setor: "Fritura & Salgados",
    falhaPrincipal: "Piloto Apagando / Demora para Recuperar 180°C",
    imagem: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
    hotspots: [
      { id: "termostato", label: "Termostato Mecânico 90°C–200°C", x: "20%", y: "34%" },
      { id: "piloto", label: "Válvula e Chama Piloto", x: "22%", y: "52%" },
      { id: "dreno-oleo", label: "Válvula de Drenagem de Óleo", x: "24%", y: "68%" },
      { id: "cestos", label: "Suporte Duplo de Cestos", x: "75%", y: "32%" },
      { id: "termopar", label: "Sensor Termopar de Segurança", x: "78%", y: "50%" },
      { id: "hi-limit", label: "Botão Reset Hi-Limit (230°C)", x: "76%", y: "68%" },
    ],
    pecasReposicao: [
      { sku: "VUL-221", nome: "Termopar Sensor de Chama Piloto", preco: "R$ 145,00", estoque: "Em estoque loja (1 un)" },
      { sku: "VUL-889", nome: "Cesto Inox Malha Dupla Reforçada", preco: "R$ 210,00", estoque: "Disponível na Central" },
    ],
    passosTroubleshooting: [
      {
        passo: 1,
        total: 4,
        instrucao: "Verifique se o nível de óleo cobre no mínimo 3cm acima dos tubos trocadores de calor.",
        detalhe: "Nível baixo aciona a trava térmica de segurança Hi-Limit para evitar incêndio.",
      },
      {
        passo: 2,
        total: 4,
        instrucao: "Pressione o botão vermelho de Reset Hi-Limit localizado atrás da porta frontal inferior.",
        detalhe: "Aguarde o óleo baixar de 200°C antes de pressionar o botão até ouvir o estalo mecânico.",
      },
      {
        passo: 3,
        total: 4,
        instrucao: "Limpe a ponta do sensor termopar com esponja seca caso a chama piloto não segure acesa.",
        detalhe: "Mantenha o botão da válvula pressionado na posição PILOT por 30 segundos contínuos ao acender.",
      },
      {
        passo: 4,
        total: 4,
        instrucao: "Gire o termostato para 180°C e observe se os queimadores principais acendem com chama azul uniforme.",
        detalhe: "Chama amarela indica necessidade de limpeza dos injetores ou filtragem do óleo.",
      },
    ],
    checklistPreChamado: [
      {
        titulo: "Rearmar trava de segurança térmica (Hi-Limit)",
        passos: [
          "Abra a porta inferior da fritadeira.",
          "Localize o botão vermelho sob a caixa do termostato.",
          "Pressione firmemente até ouvir o clique de rearme.",
        ],
      },
      {
        titulo: "Reacender chama piloto e testar recuperação",
        causaProvavel: "Causa provável: Desarme por superaquecimento durante filtragem ou fuligem no termopar.",
        passos: [
          "Gire o botão da válvula de gás para OFF e aguarde 3 minutos.",
          "Gire para PILOT, pressione e acenda mantendo segurado por 30 segundos.",
          "Gire para ON e regule a temperatura em 180°C.",
        ],
      },
    ],
  },
];

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
  { id: "c1", iniciais: "GK", nome: "Gabriel K.", horario: "08:00 – 16:20", tag: "Chef de Partida", inicio: 8, fim: 16.3, intervalos: [{ h: "11:30", ok: true }] },
  { id: "c2", iniciais: "FA", nome: "Fernando A.", horario: "08:00 – 16:20", tag: "Emprestado Filial", inicio: 8, fim: 16.3, intervalos: [{ h: "11:00", ok: true }, { h: "14:00", ok: true }] },
  { id: "c3", iniciais: "IB", nome: "Ingrid B.", horario: "08:00 – 17:00", tag: "Líder de Turno", padrao: "dots", inicio: 8, fim: 17, intervalos: [{ h: "10:30", ok: true }, { h: "14:30", label: "14:30" }] },
  { id: "c4", iniciais: "CG", nome: "Carlos G.", horario: "09:15 – 17:35", tag: "Barman Sênior", inicio: 9.25, fim: 17.6, intervalos: [{ h: "11:45", ok: true }, { h: "15:00", ok: true }] },
  { id: "c5", iniciais: "JG", nome: "Júlia G.", horario: "10:30 – 18:50", tag: "Garde Manger", padrao: "stripes", inicio: 10.5, fim: 18.8, intervalos: [{ h: "15:15", label: "15:15" }, { h: "17:45", label: "17:45" }] },
  { id: "c6", iniciais: "RH", nome: "Rita H.", horario: "11:30 – 18:30", tag: "Líder Salão", inicio: 11.5, fim: 18.5, intervalos: [{ h: "14:30", label: "14:30" }, { h: "16:30", label: "16:30" }] },
  { id: "c7", iniciais: "CA", nome: "Caio G.", horario: "12:00 – 21:15", tag: "Grelha & Forno", padrao: "circles", inicio: 12, fim: 21.25, intervalos: [{ h: "15:30", label: "15:30" }, { h: "18:00", label: "18:00" }] },
  { id: "c8", iniciais: "AH", nome: "Amanda H.", horario: "14:45 – 22:15", tag: "Expedição / Pass", inicio: 14.75, fim: 22.25, intervalos: [{ h: "18:45", label: "18:45" }] },
  { id: "c9", iniciais: "JS", nome: "João S.", horario: "15:30 – 23:45", tag: "Bar Noturno", padrao: "dots", inicio: 15.5, fim: 23.75, intervalos: [{ h: "19:15", label: "19:15" }] },
];

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
