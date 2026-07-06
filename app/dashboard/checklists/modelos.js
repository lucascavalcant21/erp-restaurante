// Biblioteca de modelos prontos de checklist para restaurante.
// Cada modelo já vem com tarefas reais — 1 clique cria o checklist completo.

export const MODELOS_CHECKLIST = {
  cozinha: {
    abertura: {
      titulo: "Abertura da Cozinha",
      itens: [
        "Conferir uniforme, touca e higiene das mãos",
        "Ligar equipamentos (fogão, forno, chapa, fritadeira)",
        "Verificar temperatura das câmaras e geladeiras (0–4°C)",
        "Checar validade e etiquetas dos produtos abertos",
        "Conferir nível de gás e óleo da fritadeira",
        "Repor bancadas com utensílios e temperos",
        "Higienizar bancadas e tábuas antes do serviço",
        "Conferir mise en place do dia (pré-preparos prontos)",
        "Testar torneiras, ralos e iluminação",
      ],
    },
    mise_en_place: {
      titulo: "Mise en Place",
      itens: [
        "Separar e pesar ingredientes das fichas do dia",
        "Cortar legumes e proteínas conforme padrão",
        "Preparar molhos e bases da casa",
        "Porcionar e etiquetar (produto, data, responsável)",
        "Organizar estações de trabalho por prato",
        "Repor gelo e potes de conservação",
        "Conferir quantidade x previsão de movimento",
      ],
    },
    pre_preparos: {
      titulo: "Pré-preparos para o dia seguinte",
      itens: [
        "Deixar carnes/peixes descongelando na geladeira (nunca à temperatura ambiente)",
        "Preparar bases e molhos que rendem para o outro dia",
        "Marinar proteínas conforme ficha",
        "Porcionar e etiquetar tudo com data de validade",
        "Anotar o que precisa ser produzido pela manhã",
        "Conferir estoque para o dia seguinte e avisar compras",
      ],
    },
    fechamento: {
      titulo: "Fechamento da Cozinha",
      itens: [
        "Guardar e etiquetar todos os produtos abertos",
        "Descartar o que venceu (registrar perdas)",
        "Desligar equipamentos e fechar o gás",
        "Limpar chapa, fogão, fritadeira e coifa",
        "Higienizar bancadas, tábuas e utensílios",
        "Recolher e lavar louça e panelas",
        "Retirar o lixo e trocar sacos",
        "Conferir câmaras fechadas e temperatura",
        "Registrar sobras e faltas para compras",
      ],
    },
    limpeza_organizacao: {
      titulo: "Limpeza e Organização (Semanal)",
      itens: [
        "Limpeza profunda das câmaras frias e geladeiras",
        "Descongelar e higienizar freezers",
        "Limpeza da coifa e troca/limpeza dos filtros",
        "Higienizar prateleiras e organizar estoque (FEFO)",
        "Limpar ralos e caixas de gordura",
        "Verificar e limpar equipamentos por dentro",
        "Conferir dedetização e armadilhas",
      ],
    },
  },
  bar: {
    abertura: {
      titulo: "Abertura do Bar",
      itens: [
        "Conferir uniforme e higiene",
        "Abastecer gelo e conferir máquina de gelo",
        "Repor frutas, xaropes e mixes",
        "Conferir estoque de bebidas e destilados",
        "Checar validade de sucos e polpas abertas",
        "Higienizar bancada, coqueteleiras e utensílios",
        "Testar chopeira e pressão do CO2",
        "Organizar copos e taças por tipo",
        "Conferir caixa/comanda e cardápio de drinks",
      ],
    },
    fechamento: {
      titulo: "Fechamento do Bar",
      itens: [
        "Guardar e tampar frutas, xaropes e mixes",
        "Descartar o que venceu (registrar perdas)",
        "Lavar coqueteleiras, dosadores e utensílios",
        "Higienizar bancada e pia",
        "Limpar bico da chopeira e higienizar",
        "Conferir e repor estoque para o dia seguinte",
        "Desligar equipamentos não essenciais",
        "Retirar lixo e trocar sacos",
        "Conferir fechamento de caixa/comandas",
      ],
    },
  },
  salao: {
    abertura: {
      titulo: "Abertura do Salão",
      itens: [
        "Conferir uniforme e apresentação da equipe",
        "Ligar luzes, som e ar-condicionado",
        "Higienizar e organizar mesas e cadeiras",
        "Montar mise en place das mesas (talheres, guardanapos)",
        "Repor menus e limpar cardápios",
        "Conferir banheiros (limpeza e reposição)",
        "Abastecer estação de apoio (água, gelo, guardanapos)",
        "Verificar reservas do dia e distribuição de mesas",
        "Alinhar promoções e avisos do dia com a equipe",
      ],
    },
    fechamento: {
      titulo: "Fechamento do Salão",
      itens: [
        "Limpar e organizar todas as mesas",
        "Recolher talheres, louças e enxovais para lavagem",
        "Higienizar estações de apoio",
        "Repor itens para a abertura seguinte",
        "Conferir e limpar banheiros",
        "Desligar luzes, som e ar-condicionado",
        "Conferir fechamento de comandas e caixa",
        "Trancar portas e conferir segurança",
      ],
    },
  },
};

// Retorna os modelos disponíveis para um setor+tipo (0, 1 ou o modelo)
export function modeloDe(dept, tipo) {
  return MODELOS_CHECKLIST[dept]?.[tipo] || null;
}
