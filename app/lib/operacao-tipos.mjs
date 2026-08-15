// TIPOS DE ITEM da Operação Inteligente.
// Vocabulário único: o construtor só oferece o que a execução guiada sabe
// responder, e o motor (operacao-agenda.mjs) sabe julgar. Mudou aqui, mudou
// nos três lugares.

export const TIPOS_ITEM = [
  {
    grupo: "Verificação",
    tipos: [
      { valor: "FEITO_NAO_FEITO", rotulo: "Feito / Não feito", ajuda: "Duas opções. Não feito reprova." },
      { valor: "CONFORME_NAO_CONFORME", rotulo: "Conforme / Não conforme", ajuda: "Para padrões de qualidade e higiene." },
      { valor: "SIM_NAO", rotulo: "Sim / Não", ajuda: "Pergunta direta. Não reprova." },
    ],
  },
  {
    grupo: "Medição",
    tipos: [
      { valor: "TEMPERATURA", rotulo: "Temperatura", ajuda: "Reprova fora da faixa que você definir.", numerico: true, unidadePadrao: "°C" },
      { valor: "NUMERO", rotulo: "Número", ajuda: "Contagem simples.", numerico: true },
      { valor: "DECIMAL", rotulo: "Número com vírgula", ajuda: "Peso, litros, medidas.", numerico: true },
      { valor: "QUANTIDADE", rotulo: "Quantidade", ajuda: "Quanto tem em estoque, quantas unidades.", numerico: true },
      { valor: "PERCENTUAL", rotulo: "Porcentagem", ajuda: "Reprova fora da faixa.", numerico: true, unidadePadrao: "%" },
      { valor: "MOEDA", rotulo: "Valor em R$", ajuda: "Caixa, sangria, conferência.", numerico: true, unidadePadrao: "R$" },
    ],
  },
  {
    grupo: "Escolha",
    tipos: [
      { valor: "SELECAO_UNICA", rotulo: "Escolher uma opção", ajuda: "Você define as opções e qual delas é a certa.", escolha: true },
      { valor: "MULTIPLA_ESCOLHA", rotulo: "Escolher várias", ajuda: "Marca mais de uma opção.", escolha: true },
    ],
  },
  {
    grupo: "Texto e datas",
    tipos: [
      { valor: "TEXTO_CURTO", rotulo: "Texto curto", ajuda: "Uma linha: lote, nome, código." },
      { valor: "TEXTO_LONGO", rotulo: "Texto longo", ajuda: "Relato, observação do turno." },
      { valor: "DATA", rotulo: "Data", ajuda: "Validade, fabricação." },
      { valor: "HORA", rotulo: "Hora", ajuda: "Horário de uma etapa." },
      { valor: "DATA_HORA", rotulo: "Data e hora", ajuda: "Momento exato." },
    ],
  },
  {
    grupo: "Evidência",
    tipos: [
      { valor: "FOTO", rotulo: "Foto", ajuda: "Uma foto comprovando." },
      { valor: "MULTIPLAS_FOTOS", rotulo: "Várias fotos", ajuda: "Antes e depois, por exemplo." },
      { valor: "FOTO_COM_IA", rotulo: "Foto conferida por IA", ajuda: "A IA olha a foto e compara com o critério escrito." },
      { valor: "ASSINATURA", rotulo: "Assinatura", ajuda: "Quem executou assina na tela." },
    ],
  },
];

// Lista achatada, para lookup por valor.
export const TIPOS_LISTA = TIPOS_ITEM.flatMap(g => g.tipos.map(t => ({ ...t, grupo: g.grupo })));

export function tipoInfo(valor) {
  const v = String(valor || "").toUpperCase();
  return TIPOS_LISTA.find(t => t.valor === v) || TIPOS_LISTA[0];
}

export const ehNumerico = (valor) => !!tipoInfo(valor).numerico;
export const ehEscolha = (valor) => !!tipoInfo(valor).escolha;
export const ehBooleano = (valor) =>
  ["FEITO_NAO_FEITO", "CONFORME_NAO_CONFORME", "SIM_NAO", "BOOLEAN"].includes(String(valor || "").toUpperCase());
export const ehFoto = (valor) =>
  ["FOTO", "MULTIPLAS_FOTOS", "FOTO_COM_IA", "ASSINATURA"].includes(String(valor || "").toUpperCase());

// Respostas possíveis de um item booleano — usado no item condicional
// ("só mostre esta pergunta se a anterior for Não feito").
export function valoresPossiveis(item) {
  const tipo = String(item?.tipo || "").toUpperCase();
  if (tipo === "FEITO_NAO_FEITO") return [{ v: "feito", r: "Feito" }, { v: "nao_feito", r: "Não feito" }];
  if (tipo === "CONFORME_NAO_CONFORME") return [{ v: "conforme", r: "Conforme" }, { v: "nao_conforme", r: "Não conforme" }];
  if (tipo === "SIM_NAO" || tipo === "BOOLEAN") return [{ v: "sim", r: "Sim" }, { v: "nao", r: "Não" }];
  if (ehEscolha(tipo)) return (item?.opcoes || []).map(o => ({ v: String(o), r: String(o) }));
  return [];
}

// ── AGENDAMENTO ─────────────────────────────────────────────────────────────
export const FREQUENCIAS = [
  { valor: "diaria", rotulo: "Todo dia" },
  { valor: "dias_semana", rotulo: "Em dias da semana" },
  { valor: "semanal", rotulo: "Uma vez por semana" },
  { valor: "quinzenal", rotulo: "A cada 15 dias" },
  { valor: "mensal", rotulo: "Uma vez por mês" },
  { valor: "datas", rotulo: "Em datas específicas" },
];

export const DIAS_SEMANA_OP = [
  { valor: 1, rotulo: "Seg" }, { valor: 2, rotulo: "Ter" }, { valor: 3, rotulo: "Qua" },
  { valor: 4, rotulo: "Qui" }, { valor: 5, rotulo: "Sex" }, { valor: 6, rotulo: "Sáb" },
  { valor: 0, rotulo: "Dom" },
];

export const SETORES = ["cozinha", "bar", "salao", "limpeza", "estoque", "recepcao", "administrativo"];
export const CRITICIDADES = [
  { valor: "baixa", rotulo: "Baixa" }, { valor: "normal", rotulo: "Normal" },
  { valor: "alta", rotulo: "Alta" }, { valor: "critica", rotulo: "Crítica" },
];

// Frase legível da recorrência, para mostrar no cartão do processo.
export function descreverAgenda(agenda) {
  if (!agenda) return "Sem agendamento";
  const hora = String(agenda.hora_inicio || "").slice(0, 5);
  const dias = (agenda.dias_semana || [])
    .map(d => DIAS_SEMANA_OP.find(x => x.valor === Number(d))?.rotulo)
    .filter(Boolean).join(", ");
  switch (agenda.frequencia) {
    case "diaria": return `Todo dia às ${hora}`;
    case "dias_semana": return dias ? `${dias} às ${hora}` : `Sem dias marcados`;
    case "semanal": return dias ? `Toda ${dias} às ${hora}` : `Semanal às ${hora}`;
    case "quinzenal": return `A cada 15 dias${dias ? ` (${dias})` : ""} às ${hora}`;
    case "mensal": return `Todo dia ${agenda.dia_mes || 1} às ${hora}`;
    case "datas": return `${(agenda.datas || []).length} data(s) marcada(s) às ${hora}`;
    default: return `Às ${hora}`;
  }
}
