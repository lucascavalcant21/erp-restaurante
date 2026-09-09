// Biblioteca de modelos prontos de checklist para restaurante (Cozinha, Bar e Salão).
// Estrutura completa de 18 fases operacionais (Chegada, Abastecimento, Porcionados, Pré-Abertura, Expediente, Fechamento, Ralos, Baldeamento e Conferência).

export const MODELOS_CHECKLIST = {
  cozinha: {
    abertura: {
      titulo: "1. Chegada e Abertura da Cozinha",
      itens: [
        { texto: "Bater o ponto no sistema ao chegar", categoria: "1. Chegada e Higiene Pessoal", fase_turno: "abertura", horario_previsto: "07:30", tempo_minutos: 2 },
        { texto: "Retirar todos os adornos (anéis, pulseiras, relógios, brincos)", categoria: "1. Chegada e Higiene Pessoal", fase_turno: "abertura", horario_previsto: "07:32", tempo_minutos: 2 },
        { texto: "Lavar e sanitizar corretamente as mãos", categoria: "1. Chegada e Higiene Pessoal", fase_turno: "abertura", horario_previsto: "07:34", tempo_minutos: 3 },
        { texto: "Pegar o pano individual de trabalho", categoria: "1. Chegada e Higiene Pessoal", fase_turno: "abertura", horario_previsto: "07:37", tempo_minutos: 1 },
        { texto: "Verificar se o uniforme está limpo e adequado (touca, dólmã, avental)", categoria: "1. Chegada e Higiene Pessoal", fase_turno: "abertura", horario_previsto: "07:38", tempo_minutos: 2 },
        
        { texto: "Ligar o exaustor da cozinha", categoria: "2. Preparação Inicial", fase_turno: "abertura", horario_previsto: "07:40", tempo_minutos: 1 },
        { texto: "Conferir a cozinha e verificar se tudo está em ordem", categoria: "2. Preparação Inicial", fase_turno: "abertura", horario_previsto: "07:41", tempo_minutos: 4 },
        { texto: "Conferir geladeiras e freezers (temperatura entre 0°C e 4°C / -18°C)", categoria: "2. Preparação Inicial", fase_turno: "abertura", horario_previsto: "07:45", tempo_minutos: 5 },
        { texto: "Conferir as comidas e preparações disponíveis na câmara/geladeira", categoria: "2. Preparação Inicial", fase_turno: "abertura", horario_previsto: "07:50", tempo_minutos: 5 },
        { texto: "Conferir as reservas armazenadas na geladeira", categoria: "2. Preparação Inicial", fase_turno: "abertura", horario_previsto: "07:55", tempo_minutos: 5 },

        { texto: "Retirar para descongelamento/aquecimento: Arroz branco, Baião e Arroz paraense", categoria: "3. Preparação dos Alimentos", fase_turno: "abertura", horario_previsto: "08:00", tempo_minutos: 10 },
        { texto: "Retirar para aquecimento: Vatapá e Maniçoba", categoria: "3. Preparação dos Alimentos", fase_turno: "abertura", horario_previsto: "08:10", tempo_minutos: 10 },
        { texto: "Após o aquecimento, colocar as preparações no réchaud", categoria: "3. Preparação dos Alimentos", fase_turno: "abertura", horario_previsto: "08:20", tempo_minutos: 5 },
        { texto: "Conferir se há potes e reservas suficientes na geladeira", categoria: "3. Preparação dos Alimentos", fase_turno: "abertura", horario_previsto: "08:25", tempo_minutos: 5 },
        { texto: "Manter todas as preparações identificadas e etiquetadas", categoria: "3. Preparação dos Alimentos", fase_turno: "abertura", horario_previsto: "08:30", tempo_minutos: 5 },

        { texto: "Retirar 10 kg de açaí para descongelar", categoria: "4. Produção do Açaí", fase_turno: "abertura", horario_previsto: "08:35", tempo_minutos: 5 },
        { texto: "Descongelar por ~10 minutos para cada 2 kg conforme procedimento", categoria: "4. Produção do Açaí", fase_turno: "abertura", horario_previsto: "08:40", tempo_minutos: 10 },
        { texto: "Separar o açaí restante que já estiver disponível", categoria: "4. Produção do Açaí", fase_turno: "abertura", horario_previsto: "08:50", tempo_minutos: 3 },
        { texto: "Bater o açaí descongelado junto com o restante (ou 4 litros por liquidificador)", categoria: "4. Produção do Açaí", fase_turno: "abertura", horario_previsto: "08:53", tempo_minutos: 12 },
        { texto: "Conferir textura e padrão do açaí e armazenar nos potes do serviço", categoria: "4. Produção do Açaí", fase_turno: "abertura", horario_previsto: "09:05", tempo_minutos: 5 },

        { texto: "Abastecer potes de serviço: Farinha de mandioca, Açúcar e Tapioca", categoria: "5. Abastecimento e Condimentos", fase_turno: "abertura", horario_previsto: "09:10", tempo_minutos: 8 },
        { texto: "Encher copinhos de serviço: Mandioca, Tapioca e Açúcar", categoria: "5. Abastecimento e Condimentos", fase_turno: "abertura", horario_previsto: "09:18", tempo_minutos: 7 },
        { texto: "Abastecer óleos e temperos: Óleo vegetal, Dendê, Colorau e condimentos contínuos", categoria: "5. Abastecimento e Condimentos", fase_turno: "abertura", horario_previsto: "09:25", tempo_minutos: 5 },

        { texto: "Limpar potes de colheres, prateleiras, bancadas, pias, utensílios e louças", categoria: "6. Organização e Higienização Inicial", fase_turno: "abertura", horario_previsto: "09:30", tempo_minutos: 15 },

        { texto: "Corte de hortaliças: Tomate em cubos brunoise, Cebola chicélê e brunoise", categoria: "7. Pré-Preparo de Hortaliças", fase_turno: "abertura", horario_previsto: "09:45", tempo_minutos: 20 },
        { texto: "Picar cheiro-verde e pimenta-de-cheiro e armazenar identificados", categoria: "7. Pré-Preparo de Hortaliças", fase_turno: "abertura", horario_previsto: "10:05", tempo_minutos: 15 },

        { texto: "Conferir porcionados: Costelinha de tambaqui, Pirarucu, Mandioca, Batata frita, Frango kids, Moqueca, Molhos e Camarões", categoria: "8. Conferência de Porcionados", fase_turno: "abertura", horario_previsto: "10:20", tempo_minutos: 15 },

        { texto: "Às 17h30: Ligar fritadeiras (160°C), cronômetro, chapa, réchaud e lâmpada de aquecimento", categoria: "9. Preparação para Abertura (17h30)", fase_turno: "abertura", horario_previsto: "17:30", tempo_minutos: 15 },
        { texto: "Até 18h: Cozinha 100% pronta, bancadas e pisos limpos, geladeiras/freezers conferidos", categoria: "9. Preparação para Abertura (17h30)", fase_turno: "abertura", horario_previsto: "17:45", tempo_minutos: 15 },
      ],
    },
    durante_turno: {
      titulo: "2. Operação Durante o Expediente",
      itens: [
        { texto: "REGRA OBRIGATÓRIA: Lavar o pano individual imediatamente a cada utilização", categoria: "Higiene de Panos", fase_turno: "durante_turno", horario_previsto: "18:00", tempo_minutos: 2 },
        { texto: "Manter bancadas, pias e utensílios limpos e organizados continuamente", categoria: "Organização Contínua", fase_turno: "durante_turno", horario_previsto: "18:30", tempo_minutos: 5 },
        { texto: "Conferir estoque de farinhas, açúcar, tapioca e embalagens de entrega", categoria: "Reposições Operacionais", fase_turno: "durante_turno", horario_previsto: "19:30", tempo_minutos: 5 },
        { texto: "Controle dos Pedidos: Fazer marcação com caneta nos pedidos enviados e conferidos", categoria: "Controle de Pedidos", fase_turno: "durante_turno", horario_previsto: "20:00", tempo_minutos: 3 },
        { texto: "Panelas de molhos (tapioca, vatapá): Colocar água de molho imediatamente após o uso", categoria: "Controle de Pedidos", fase_turno: "durante_turno", horario_previsto: "20:30", tempo_minutos: 3 },
      ],
    },
    fechamento: {
      titulo: "3. Fechamento e Encerramento da Cozinha",
      itens: [
        { texto: "A partir das 22h: Retirar comidas do réchaud, etiquetar com data/hora e guardar adequadamente", categoria: "1. Encerramento do Serviço (22h)", fase_turno: "fechamento", horario_previsto: "22:00", tempo_minutos: 15 },
        { texto: "Guardar açaí, camarões e demais preparações sensíveis no freezer/geladeira", categoria: "1. Encerramento do Serviço (22h)", fase_turno: "fechamento", horario_previsto: "22:15", tempo_minutos: 10 },
        { texto: "A partir das 22h30: Fazer limpeza profunda da chapa e exaustor", categoria: "2. Limpeza da Chapa e Equipamentos (22h30)", fase_turno: "fechamento", horario_previsto: "22:30", tempo_minutos: 20 },
        { texto: "Limpar Cozinha 1, Cozinha 2, bancadas, pias e utensílios de produção", categoria: "2. Limpeza da Chapa e Equipamentos (22h30)", fase_turno: "fechamento", horario_previsto: "22:50", tempo_minutos: 15 },
        { texto: "LIMPEZA DOS RALOS (A CADA 2 DIAS): Retirar ralos, lavar por dentro e higienizar", categoria: "3. Ralos e Higienização Profunda", fase_turno: "fechamento", horario_previsto: "23:05", tempo_minutos: 10 },
        { texto: "Baldeamento Geral: Lavar com água, sabão em pó, detergente e Clearon (Cozinha 1, 2, Freezers e Corredores)", categoria: "4. Baldeamento Geral", fase_turno: "fechamento", horario_previsto: "23:15", tempo_minutos: 20 },
        { texto: "Limpeza embaixo de prateleiras, geladeiras e equipamentos sem deixar resíduos", categoria: "4. Baldeamento Geral", fase_turno: "fechamento", horario_previsto: "23:35", tempo_minutos: 10 },
        { texto: "Abastecimento para o dia seguinte: Farinha de mandioca, tapioca, açúcar e embalagens", categoria: "5. Abastecimento para Dia Seguinte", fase_turno: "fechamento", horario_previsto: "23:45", tempo_minutos: 10 },
        { texto: "Conferir geladeiras e freezers (fechados, tampados, etiquetados e organizados)", categoria: "6. Conferência de Frio", fase_turno: "fechamento", horario_previsto: "23:55", tempo_minutos: 5 },
        { texto: "Desligar equipamentos da TOMADA: Liquidificadores, Micro-ondas e Fritadeiras", categoria: "7. Desligamento e Segurança", fase_turno: "fechamento", horario_previsto: "00:00", tempo_minutos: 3 },
        { texto: "Desligar exaustor e lâmpada de aquecimento", categoria: "7. Desligamento e Segurança", fase_turno: "fechamento", horario_previsto: "00:03", tempo_minutos: 2 },
        { texto: "Conferência Final: Luzes apagadas, portas trancadas, nada exposto, cozinha 100% limpa", categoria: "8. Conferência Final", fase_turno: "fechamento", horario_previsto: "00:05", tempo_minutos: 5 },
      ],
    },
    limpeza_organizacao: {
      titulo: "4. Limpeza e Organização Semanal (Cozinha)",
      itens: [
        { texto: "Limpeza profunda das câmaras frias e geladeiras", categoria: "Câmaras e Frio", fase_turno: "fechamento", horario_previsto: "14:00", tempo_minutos: 40 },
        { texto: "Descongelar e higienizar freezers verticais e horizontais", categoria: "Câmaras e Frio", fase_turno: "fechamento", horario_previsto: "14:40", tempo_minutos: 30 },
        { texto: "Limpeza da coifa e lavagem/troca dos filtros de gordura", categoria: "Exaustão", fase_turno: "fechamento", horario_previsto: "15:10", tempo_minutos: 45 },
        { texto: "Higienizar prateleiras e organizar estoque pelo método FEFO (Primeiro que Vence, Primeiro que Sai)", categoria: "Estoque", fase_turno: "fechamento", horario_previsto: "15:55", tempo_minutos: 30 },
        { texto: "Limpar caixas de gordura e ralos gerais", categoria: "Instalações", fase_turno: "fechamento", horario_previsto: "16:25", tempo_minutos: 20 },
      ],
    },
  },
  bar: {
    abertura: {
      titulo: "1. Chegada e Abertura do Bar",
      itens: [
        { texto: "Bater ponto, vestir uniforme limpo e lavar as mãos", categoria: "1. Chegada e Higiene", fase_turno: "abertura", horario_previsto: "16:30", tempo_minutos: 5 },
        { texto: "Conferir máquina de gelo e abastecer os silos de gelo", categoria: "2. Insumos e Bebidas", fase_turno: "abertura", horario_previsto: "16:35", tempo_minutos: 10 },
        { texto: "Cortar e porcionar frutas (limão, laranja, abacaxi, hortelã) e colocar nos organizadores", categoria: "2. Insumos e Bebidas", fase_turno: "abertura", horario_previsto: "16:45", tempo_minutos: 20 },
        { texto: "Conferir xaropes, polpas, mixes de drinks e sucos (validade e etiquetas)", categoria: "2. Insumos e Bebidas", fase_turno: "abertura", horario_previsto: "17:05", tempo_minutos: 10 },
        { texto: "Abastecer condimentos do bar: açúcar, sal, especiarias e canudos", categoria: "3. Abastecimento e Estação", fase_turno: "abertura", horario_previsto: "17:15", tempo_minutos: 10 },
        { texto: "Testar chopeira, checar pressão do CO2 e temperatura do pré-resfriador", categoria: "4. Equipamentos (17h30)", fase_turno: "abertura", horario_previsto: "17:25", tempo_minutos: 10 },
        { texto: "Higienizar bancada, coqueteleiras, dosadores, bailarinas e coadores", categoria: "4. Equipamentos (17h30)", fase_turno: "abertura", horario_previsto: "17:35", tempo_minutos: 15 },
        { texto: "Polir e organizar copos e taças por tipo (Tulipa, On the Rocks, Long Drink, Taça Gin)", categoria: "4. Equipamentos (17h30)", fase_turno: "abertura", horario_previsto: "17:50", tempo_minutos: 10 },
      ],
    },
    durante_turno: {
      titulo: "2. Operação Durante o Expediente (Bar)",
      itens: [
        { texto: "Regra do Pano: Lavar o pano de bancada imediatamente a cada uso", categoria: "Higiene", fase_turno: "durante_turno", horario_previsto: "18:00", tempo_minutos: 2 },
        { texto: "Manter coqueteleiras e dosadores lavados entre o preparo de cada drink", categoria: "Preparo de Drinks", fase_turno: "durante_turno", horario_previsto: "18:30", tempo_minutos: 3 },
        { texto: "Repor gelo, frutas e taças polidas conforme o movimento", categoria: "Reposições", fase_turno: "durante_turno", horario_previsto: "20:00", tempo_minutos: 5 },
        { texto: "Conferir comandas e lançamentos de bebidas no sistema", categoria: "Controle", fase_turno: "durante_turno", horario_previsto: "21:00", tempo_minutos: 3 },
      ],
    },
    fechamento: {
      titulo: "3. Fechamento e Encerramento do Bar",
      itens: [
        { texto: "A partir das 22h: Guardar e tampar frutas, xaropes, sucos e mixes na geladeira com etiqueta", categoria: "1. Recolhimento e Frio (22h)", fase_turno: "fechamento", horario_previsto: "22:00", tempo_minutos: 15 },
        { texto: "Lavar coqueteleiras, dosadores, maceradores e utensílios do bar", categoria: "2. Higienização e Limpeza", fase_turno: "fechamento", horario_previsto: "22:15", tempo_minutos: 15 },
        { texto: "Higienizar bicos da chopeira e passar água quente nas linhas", categoria: "2. Higienização e Limpeza", fase_turno: "fechamento", horario_previsto: "22:30", tempo_minutos: 15 },
        { texto: "Limpar e secar bancadas de inox, pias e tapetes de borracha do bar", categoria: "2. Higienização e Limpeza", fase_turno: "fechamento", horario_previsto: "22:45", tempo_minutos: 15 },
        { texto: "Limpar ralos e baldeamento do piso do bar", categoria: "3. Ralos e Piso", fase_turno: "fechamento", horario_previsto: "23:00", tempo_minutos: 15 },
        { texto: "Desligar da TOMADA liquidificadores, cortadores e luzes do bar", categoria: "4. Desligamento e Segurança", fase_turno: "fechamento", horario_previsto: "23:15", tempo_minutos: 5 },
        { texto: "Conferir trancamento de geladeiras, armários de destilados e caixa", categoria: "4. Desligamento e Segurança", fase_turno: "fechamento", horario_previsto: "23:20", tempo_minutos: 5 },
      ],
    },
  },
  salao: {
    abertura: {
      titulo: "1. Chegada e Abertura do Salão",
      itens: [
        { texto: "Bater ponto, conferir uniforme completo e apresentação pessoal", categoria: "1. Chegada e Apresentação", fase_turno: "abertura", horario_previsto: "16:30", tempo_minutos: 5 },
        { texto: "Ligar luzes do salão, som ambiente e ar-condicionado na temperatura padrão", categoria: "2. Climatização e Ambiente", fase_turno: "abertura", horario_previsto: "16:35", tempo_minutos: 5 },
        { texto: "Higienizar e alinhar mesas, cadeiras e sofás do salão", categoria: "3. Mesas e Salão", fase_turno: "abertura", horario_previsto: "16:40", tempo_minutos: 20 },
        { texto: "Montar mise en place das mesas: talheres polidos, guardanapos, jogo americano e galheteiros", categoria: "3. Mesas e Salão", fase_turno: "abertura", horario_previsto: "17:00", tempo_minutos: 20 },
        { texto: "Limpar e organizar cardápios físicos e checar QRCodes de mesa", categoria: "4. Cardápios e Apoio", fase_turno: "abertura", horario_previsto: "17:20", tempo_minutos: 10 },
        { texto: "Abastecer estações de apoio: água da casa, copos, talheres extras, guardanapos e sachês", categoria: "4. Cardápios e Apoio", fase_turno: "abertura", horario_previsto: "17:30", tempo_minutos: 15 },
        { texto: "Conferir banheiros (limpeza, sabonete líquido, papel toalha e papel higiênico)", categoria: "5. Banheiros e Finalização", fase_turno: "abertura", horario_previsto: "17:45", tempo_minutos: 10 },
        { texto: "Verificar mapa de reservas do dia e alinhar briefing da equipe antes da abertura (18h)", categoria: "5. Banheiros e Finalização", fase_turno: "abertura", horario_previsto: "17:55", tempo_minutos: 5 },
      ],
    },
    durante_turno: {
      titulo: "2. Operação Durante o Expediente (Salão)",
      itens: [
        { texto: "Manter mesas limpas e recolher pratos e copos vazios rapidamente", categoria: "Atendimento", fase_turno: "durante_turno", horario_previsto: "18:30", tempo_minutos: 5 },
        { texto: "Manter estações de apoio abastecidas com talheres, guardanapos e água", categoria: "Estações de Apoio", fase_turno: "durante_turno", horario_previsto: "19:30", tempo_minutos: 5 },
        { texto: "Verificar banheiros a cada hora (limpeza e reposição de papel)", categoria: "Banheiros", fase_turno: "durante_turno", horario_previsto: "20:30", tempo_minutos: 5 },
      ],
    },
    fechamento: {
      titulo: "3. Fechamento e Encerramento do Salão",
      itens: [
        { texto: "A partir das 22h: Recolher galheteiros, cardápios e enxovais das mesas vagadas", categoria: "1. Encerramento das Mesas (22h)", fase_turno: "fechamento", horario_previsto: "22:00", tempo_minutos: 15 },
        { texto: "Limpar e higienizar todas as mesas, cadeiras e sofás do salão", categoria: "2. Higienização e Limpeza", fase_turno: "fechamento", horario_previsto: "22:15", tempo_minutos: 20 },
        { texto: "Recolher talheres e louças para lavagem e organizar estação de apoio", categoria: "2. Higienização e Limpeza", fase_turno: "fechamento", horario_previsto: "22:35", tempo_minutos: 15 },
        { texto: "Varrer e passar pano no piso do salão e recepção", categoria: "2. Higienização e Limpeza", fase_turno: "fechamento", horario_previsto: "22:50", tempo_minutos: 20 },
        { texto: "Higienizar banheiros e esvaziar lixeiras", categoria: "3. Banheiros", fase_turno: "fechamento", horario_previsto: "23:10", tempo_minutos: 15 },
        { texto: "Desligar ar-condicionado, som ambiente e iluminação do salão", categoria: "4. Desligamento e Segurança", fase_turno: "fechamento", horario_previsto: "23:25", tempo_minutos: 5 },
        { texto: "Conferir fechamento de comandas/caixa e trancar portas e janelas", categoria: "4. Desligamento e Segurança", fase_turno: "fechamento", horario_previsto: "23:30", tempo_minutos: 10 },
      ],
    },
  },
};

// Retorna os modelos disponíveis para um setor+tipo (null se não houver)
export function modeloDe(dept, tipo) {
  return MODELOS_CHECKLIST[dept]?.[tipo] || null;
}
