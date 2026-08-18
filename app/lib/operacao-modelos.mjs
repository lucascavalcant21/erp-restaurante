// MODELOS PRONTOS de processo. Servem de ponto de partida no construtor:
// o processo é criado já com seções, itens e um horário sugerido, e daí o
// gestor edita à vontade. Nada aqui é obrigatório.

export const MODELOS_PROCESSO = [
  {
    id: "abertura_cozinha",
    nome: "Abertura da cozinha",
    descricao: "Conferência antes do primeiro pedido do dia.",
    categoria: "Cozinha", setor: "cozinha", criticidade: "alta",
    agenda: { frequencia: "diaria", hora_inicio: "08:00", minutos_tolerancia: 15, minutos_prazo: 120 },
    secoes: [
      {
        titulo: "Equipamentos",
        itens: [
          { titulo: "Temperatura da câmara fria", tipo: "TEMPERATURA", unidade_medida: "°C", valor_min: 0, valor_max: 4, critico: true, exige_foto: true },
          { titulo: "Temperatura do freezer", tipo: "TEMPERATURA", unidade_medida: "°C", valor_min: -22, valor_max: -12, critico: true },
          { titulo: "Chapa e fogões acesos e sem vazamento", tipo: "CONFORME_NAO_CONFORME", critico: true },
          { titulo: "Coifa e exaustão funcionando", tipo: "FEITO_NAO_FEITO" },
        ],
      },
      {
        titulo: "Higiene e equipe",
        itens: [
          { titulo: "Bancadas e utensílios higienizados", tipo: "CONFORME_NAO_CONFORME", exige_foto: true },
          { titulo: "Equipe de uniforme completo e unhas aparadas", tipo: "CONFORME_NAO_CONFORME" },
          { titulo: "Álcool 70 e sabonete abastecidos", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Observações da abertura", tipo: "TEXTO_LONGO", obrigatorio: false },
        ],
      },
      {
        titulo: "Insumos",
        itens: [
          { titulo: "Pré-preparos do dia conferidos", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Produtos vencidos ou sem etiqueta", tipo: "SIM_NAO", resposta_esperada: "nao", exige_comentario: true },
        ],
      },
    ],
  },
  {
    id: "fechamento_salao",
    nome: "Fechamento do salão",
    descricao: "O que precisa estar pronto antes de apagar as luzes.",
    categoria: "Salão", setor: "salao", criticidade: "normal",
    agenda: { frequencia: "diaria", hora_inicio: "23:00", minutos_tolerancia: 20, minutos_prazo: 120 },
    secoes: [
      {
        titulo: "Salão",
        itens: [
          { titulo: "Mesas e cadeiras limpas e organizadas", tipo: "CONFORME_NAO_CONFORME", exige_foto: true },
          { titulo: "Piso varrido e passado", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Lixeiras esvaziadas", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Ar-condicionado, som e TVs desligados", tipo: "FEITO_NAO_FEITO" },
        ],
      },
      {
        titulo: "Caixa e segurança",
        itens: [
          { titulo: "Valor em caixa no fechamento", tipo: "MOEDA", unidade_medida: "R$", critico: true },
          { titulo: "Diferença de caixa", tipo: "MOEDA", unidade_medida: "R$", valor_min: -20, valor_max: 20, exige_comentario: true },
          { titulo: "Portas e janelas trancadas", tipo: "CONFORME_NAO_CONFORME", critico: true },
          { titulo: "Foto do salão fechado", tipo: "FOTO" },
        ],
      },
    ],
  },
  {
    id: "higiene_boas_praticas",
    nome: "Checklist de boas práticas",
    descricao: "Conferência semanal de higiene e manipulação de alimentos.",
    categoria: "Qualidade", setor: "cozinha", criticidade: "critica",
    agenda: { frequencia: "dias_semana", dias_semana: [1], hora_inicio: "10:00", minutos_tolerancia: 30, minutos_prazo: 240 },
    secoes: [
      {
        titulo: "Armazenamento",
        itens: [
          { titulo: "Todos os produtos etiquetados com data", tipo: "CONFORME_NAO_CONFORME", critico: true, exige_foto: true },
          { titulo: "Alimentos crus separados dos prontos", tipo: "CONFORME_NAO_CONFORME", critico: true },
          { titulo: "Nada armazenado direto no chão", tipo: "CONFORME_NAO_CONFORME" },
          { titulo: "Produtos vencidos encontrados", tipo: "QUANTIDADE", valor_min: 0, valor_max: 0, exige_comentario: true },
        ],
      },
      {
        titulo: "Manipulação",
        itens: [
          { titulo: "Lavagem de mãos sendo feita corretamente", tipo: "CONFORME_NAO_CONFORME", critico: true },
          { titulo: "Panos e esponjas trocados", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Diluição do sanitizante", tipo: "PERCENTUAL", unidade_medida: "%", valor_min: 0.5, valor_max: 2 },
        ],
      },
      {
        titulo: "Registro",
        itens: [
          { titulo: "Responsável pela conferência", tipo: "TEXTO_CURTO" },
          { titulo: "Assinatura", tipo: "ASSINATURA", obrigatorio: false },
        ],
      },
    ],
  },
  {
    id: "conferencia_bar",
    nome: "Conferência do bar",
    descricao: "Estoque de bebidas e preparo do bar antes do serviço.",
    categoria: "Bar", setor: "bar", criticidade: "normal",
    agenda: { frequencia: "diaria", hora_inicio: "16:00", minutos_tolerancia: 15, minutos_prazo: 120 },
    secoes: [
      {
        titulo: "Bebidas e gelo",
        itens: [
          { titulo: "Chope: temperatura da torneira", tipo: "TEMPERATURA", unidade_medida: "°C", valor_min: -2, valor_max: 4 },
          { titulo: "Gelo suficiente para o serviço", tipo: "SIM_NAO", resposta_esperada: "sim" },
          { titulo: "Garrafas em falta", tipo: "TEXTO_LONGO", obrigatorio: false },
        ],
      },
      {
        titulo: "Bancada",
        itens: [
          { titulo: "Frutas e guarnições cortadas", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Copos limpos e sem manchas", tipo: "CONFORME_NAO_CONFORME", exige_foto: true },
          { titulo: "Bancada higienizada", tipo: "CONFORME_NAO_CONFORME" },
        ],
      },
    ],
  },
  {
    id: "abertura_salao",
    nome: "Abertura do salão",
    descricao: "O salão pronto antes do primeiro cliente sentar.",
    categoria: "Salão", setor: "salao", criticidade: "normal",
    agenda: { frequencia: "diaria", hora_inicio: "10:00", minutos_tolerancia: 15, minutos_prazo: 120 },
    secoes: [
      {
        titulo: "Ambiente",
        itens: [
          { titulo: "Mesas postas e alinhadas", tipo: "CONFORME_NAO_CONFORME", exige_foto: true },
          { titulo: "Piso e banheiros limpos", tipo: "CONFORME_NAO_CONFORME", critico: true },
          { titulo: "Ar-condicionado, som e iluminação ligados", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Temperatura do salão", tipo: "TEMPERATURA", unidade_medida: "°C", valor_min: 20, valor_max: 26 },
        ],
      },
      {
        titulo: "Atendimento",
        itens: [
          { titulo: "Cardápios limpos e sem página faltando", tipo: "CONFORME_NAO_CONFORME" },
          { titulo: "Maquininhas carregadas e com bobina", tipo: "FEITO_NAO_FEITO", critico: true },
          { titulo: "Troco conferido no caixa", tipo: "MOEDA", unidade_medida: "R$" },
          { titulo: "Equipe uniformizada e escalada", tipo: "CONFORME_NAO_CONFORME" },
        ],
      },
    ],
  },
  {
    id: "fechamento_cozinha",
    nome: "Fechamento da cozinha",
    descricao: "O que precisa estar feito antes de desligar as luzes da cozinha.",
    categoria: "Cozinha", setor: "cozinha", criticidade: "alta",
    agenda: { frequencia: "diaria", hora_inicio: "23:30", minutos_tolerancia: 20, minutos_prazo: 120 },
    secoes: [
      {
        titulo: "Alimentos",
        itens: [
          { titulo: "Sobras etiquetadas e guardadas", tipo: "CONFORME_NAO_CONFORME", critico: true, exige_foto: true },
          { titulo: "Temperatura da câmara fria no fechamento", tipo: "TEMPERATURA", unidade_medida: "°C", valor_min: 0, valor_max: 4, critico: true },
          { titulo: "Descarte do dia (kg)", tipo: "QUANTIDADE", unidade_medida: "kg", exige_comentario: true },
        ],
      },
      {
        titulo: "Equipamentos e limpeza",
        itens: [
          { titulo: "Fogões, chapa e fritadeira desligados", tipo: "CONFORME_NAO_CONFORME", critico: true },
          { titulo: "Coifa e filtros limpos", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Bancadas higienizadas e piso lavado", tipo: "CONFORME_NAO_CONFORME", exige_foto: true },
          { titulo: "Lixo retirado", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Gás fechado no registro", tipo: "CONFORME_NAO_CONFORME", critico: true },
        ],
      },
    ],
  },
  {
    id: "fechamento_bar",
    nome: "Fechamento do bar",
    descricao: "Bebida guardada, bar limpo e caixa conferido.",
    categoria: "Bar", setor: "bar", criticidade: "normal",
    agenda: { frequencia: "diaria", hora_inicio: "23:30", minutos_tolerancia: 20, minutos_prazo: 120 },
    secoes: [
      {
        titulo: "Bebidas",
        itens: [
          { titulo: "Garrafas abertas tampadas e guardadas", tipo: "CONFORME_NAO_CONFORME", critico: true },
          { titulo: "Chope: torneira limpa e fechada", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Expositor e balcão refrigerado repostos", tipo: "CONFORME_NAO_CONFORME", exige_foto: true },
          { titulo: "Frutas e guarnições descartadas ou guardadas", tipo: "FEITO_NAO_FEITO" },
        ],
      },
      {
        titulo: "Bar e caixa",
        itens: [
          { titulo: "Bancada e pia higienizadas", tipo: "CONFORME_NAO_CONFORME" },
          { titulo: "Copos lavados e guardados", tipo: "FEITO_NAO_FEITO" },
          { titulo: "Valor em caixa do bar", tipo: "MOEDA", unidade_medida: "R$", critico: true },
          { titulo: "Observações do turno", tipo: "TEXTO_LONGO", obrigatorio: false },
        ],
      },
    ],
  },
];

// Converte o modelo no formato que o construtor usa em memória.
export function modeloParaProcesso(modelo, unidadeId) {
  return {
    processo: {
      unidade_id: String(unidadeId),
      nome: modelo.nome,
      descricao: modelo.descricao,
      categoria: modelo.categoria,
      setor: modelo.setor,
      criticidade: modelo.criticidade || "normal",
      exige_todos_obrigatorios: true,
      permite_concluir_com_nc: true,
    },
    secoes: modelo.secoes.map(s => ({
      titulo: s.titulo,
      descricao: s.descricao || "",
      itens: s.itens.map(i => ({
        titulo: i.titulo,
        instrucao: i.instrucao || "",
        tipo: i.tipo || "FEITO_NAO_FEITO",
        obrigatorio: i.obrigatorio !== false,
        permite_na: !!i.permite_na,
        peso: i.peso || 1,
        critico: !!i.critico,
        exige_foto: !!i.exige_foto,
        exige_comentario: !!i.exige_comentario,
        exige_gps: !!i.exige_gps,
        valor_min: i.valor_min ?? "",
        valor_max: i.valor_max ?? "",
        unidade_medida: i.unidade_medida || "",
        opcoes: i.opcoes || [],
        resposta_esperada: i.resposta_esperada || "",
        acao_reprovar: i.acao_reprovar || "nao_conformidade",
        criterios_ia: i.criterios_ia || "",
      })),
    })),
    agenda: modelo.agenda || null,
  };
}
