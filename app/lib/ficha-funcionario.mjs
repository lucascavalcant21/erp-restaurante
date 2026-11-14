// Ficha do funcionário (pedido do dono, 14/11/2026): advertências, ocorrências,
// quebras, uniformes, reuniões, observações e documentos, cada um com a cópia
// assinada. Módulo puro: regras, validação e contagens, com teste.
//
// O que este módulo NÃO faz: punir. Ele conta e mostra a recorrência; a
// decisão (conversar, advertir, suspender) é sempre de uma pessoa. A sugestão
// de passo seguinte é SUGESTÃO, nunca ação automática.

export const TIPOS = Object.freeze([
  { id: "advertencia_verbal", rotulo: "Advertência verbal", curto: "Adv. verbal", grupo: "disciplina", gravidade: true, assinatura: true },
  { id: "advertencia_escrita", rotulo: "Advertência por escrito", curto: "Adv. escrita", grupo: "disciplina", gravidade: true, assinatura: true },
  { id: "suspensao", rotulo: "Suspensão", curto: "Suspensão", grupo: "disciplina", gravidade: true, assinatura: true },
  { id: "ocorrencia", rotulo: "Ocorrência", curto: "Ocorrência", grupo: "dia", gravidade: true, assinatura: false },
  { id: "observacao", rotulo: "Observação do dia", curto: "Observação", grupo: "dia", gravidade: false, assinatura: false },
  { id: "quebra", rotulo: "Quebra ou perda de produto", curto: "Quebra", grupo: "dia", item: true, quantidade: true, valor: true, assinatura: true },
  { id: "uniforme", rotulo: "Entrega de uniforme", curto: "Uniforme", grupo: "entregas", item: true, quantidade: true, tamanho: true, assinatura: true },
  { id: "reuniao", rotulo: "Reunião", curto: "Reunião", grupo: "documentos", assinatura: true },
  { id: "documento", rotulo: "Documento", curto: "Documento", grupo: "documentos", assinatura: true },
  { id: "elogio", rotulo: "Elogio", curto: "Elogio", grupo: "dia", assinatura: false },
]);

export const tipoPorId = (id) => TIPOS.find((t) => t.id === id) || null;

export const FILTROS = Object.freeze([
  { id: "todos", rotulo: "Tudo" },
  { id: "disciplina", rotulo: "Advertências" },
  { id: "dia", rotulo: "Ocorrências" },
  { id: "entregas", rotulo: "Uniformes" },
  { id: "documentos", rotulo: "Reuniões e documentos" },
]);

export const GRAVIDADES = Object.freeze([
  { id: "leve", rotulo: "Leve" },
  { id: "media", rotulo: "Média" },
  { id: "grave", rotulo: "Grave" },
]);

// Títulos prontos: o gerente toca em vez de digitar.
export const TITULOS_RAPIDOS = Object.freeze({
  advertencia_verbal: ["Atraso", "Falta sem aviso", "Uso de celular no turno", "Uniforme incompleto", "Desrespeito a colega", "Não cumpriu o checklist"],
  advertencia_escrita: ["Atraso repetido", "Falta sem justificativa", "Desrespeito a cliente", "Descumprimento de norma de higiene", "Não cumpriu ordem do gestor"],
  suspensao: ["Falta grave"],
  ocorrencia: ["Discussão no turno", "Acidente de trabalho", "Reclamação de cliente", "Saiu sem avisar", "Equipamento danificado"],
  observacao: ["Chegou indisposto", "Ótimo atendimento hoje", "Precisa de treinamento", "Pediu para trocar de turno"],
  quebra: ["Copo quebrado", "Prato quebrado", "Garrafa quebrada", "Produto estragado por erro", "Comida descartada por erro"],
  uniforme: ["Entrega de uniforme", "Troca de uniforme", "Devolução de uniforme"],
  reuniao: ["Reunião de equipe", "Reunião individual (feedback)", "Treinamento"],
  documento: ["Contrato de trabalho", "Regulamento interno", "Termo de confidencialidade", "Documento pessoal (RG/CPF)", "Exame admissional"],
  elogio: ["Elogio de cliente", "Ajudou um colega", "Superou a meta"],
});

export const ITENS_UNIFORME = Object.freeze(["Dólmã", "Avental", "Calça", "Camiseta", "Touca", "Boné", "Bota antiderrapante", "Crachá"]);

const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const reaisParaCentavos = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

/**
 * Formulário → linha para gravar. Devolve { erros } ou { registro }.
 * A unidade não entra: o banco põe a do funcionário.
 */
export function montarRegistro(form, { colaboradorId, registradoPor } = {}) {
  const tipo = tipoPorId(form?.tipo);
  const erros = {};
  if (!tipo) erros.tipo = "Escolha o tipo de registro.";
  if (!colaboradorId) erros.colaborador = "Falta o funcionário.";
  const titulo = limpo(form?.titulo);
  if (titulo.length < 2) erros.titulo = "Dê um título (ex.: Atraso).";
  const data = String(form?.data || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erros.data = "Informe a data.";

  let quantidade = null;
  if (tipo?.quantidade) {
    quantidade = Number(String(form?.quantidade ?? "").replace(",", "."));
    if (!Number.isFinite(quantidade) || quantidade <= 0) erros.quantidade = "Informe a quantidade.";
  }
  if (tipo?.item && !limpo(form?.item)) erros.item = tipo.id === "uniforme" ? "Qual peça foi entregue?" : "O que quebrou ou se perdeu?";

  let valor = null;
  if (tipo?.valor) {
    valor = reaisParaCentavos(form?.valor);
    if (Number.isNaN(valor)) erros.valor = "Valor inválido (ex.: 12,50).";
  }

  if (Object.keys(erros).length) return { erros };
  return {
    registro: {
      colaborador_id: colaboradorId,
      tipo: tipo.id,
      data,
      titulo: titulo.slice(0, 160),
      descricao: limpo(form?.descricao).slice(0, 4000) || null,
      gravidade: tipo.gravidade && GRAVIDADES.some((g) => g.id === form?.gravidade) ? form.gravidade : null,
      item: tipo.item ? limpo(form.item).slice(0, 160) : null,
      quantidade: tipo.quantidade ? quantidade : null,
      tamanho: tipo.tamanho ? limpo(form?.tamanho).slice(0, 20) || null : null,
      valor_centavos: tipo.valor ? valor : null,
      registrado_por: limpo(registradoPor) || null,
    },
  };
}

const dentroDe = (dataIso, hoje, dias) => {
  const d = new Date(`${String(dataIso).slice(0, 10)}T12:00:00Z`).getTime();
  const h = new Date(`${String(hoje).slice(0, 10)}T12:00:00Z`).getTime();
  return Number.isFinite(d) && h - d >= 0 && h - d <= dias * 86400000;
};

/**
 * Recorrência: quantas vezes cada tipo (e cada título) aparece nos últimos
 * 12 meses, sem contar os anulados. Advertências antigas
 * (rh_advertencias_colab) entram como "advertencia_escrita" quando não se sabe.
 */
export function recorrencias(registros, { hoje, dias = 365 } = {}) {
  const validos = (registros || []).filter((r) => r && !r.anulado_em && dentroDe(r.data, hoje, dias));
  const porTipo = {};
  const porTitulo = {};
  for (const r of validos) {
    porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
    const chave = `${r.tipo}|${limpo(r.titulo).toLowerCase()}`;
    porTitulo[chave] = (porTitulo[chave] || 0) + 1;
  }
  const advertencias = (porTipo.advertencia_verbal || 0) + (porTipo.advertencia_escrita || 0);
  const repetidos = Object.entries(porTitulo)
    .filter(([, n]) => n >= 2)
    .map(([chave, n]) => {
      const [tipo, titulo] = chave.split("|");
      return { tipo, titulo, vezes: n };
    })
    .sort((a, b) => b.vezes - a.vezes);
  return { porTipo, advertencias, suspensoes: porTipo.suspensao || 0, quebras: porTipo.quebra || 0, repetidos };
}

/**
 * Passo seguinte que o RH costuma dar (gradação da pena). SUGESTÃO: quem decide
 * é o dono. Nunca devolve "demitir": justa causa é decisão jurídica.
 */
export function sugestaoDisciplinar(rec) {
  if (!rec) return null;
  if (rec.suspensoes >= 1 && rec.advertencias >= 2) {
    return { natureza: "SUGESTÃO", texto: "Já teve suspensão e advertências no último ano. Antes de qualquer nova medida, converse com o contador ou advogado." };
  }
  if ((rec.porTipo.advertencia_escrita || 0) >= 2) {
    return { natureza: "SUGESTÃO", texto: "Duas ou mais advertências por escrito no último ano. Na próxima falta igual, a gradação usual é a suspensão." };
  }
  if ((rec.porTipo.advertencia_verbal || 0) >= 2) {
    return { natureza: "SUGESTÃO", texto: "Advertências verbais repetidas. Se acontecer de novo, a gradação usual é a advertência por escrito." };
  }
  return null;
}

/** Uniformes com o funcionário: entregue e ainda não devolvido, por peça e tamanho. */
export function uniformesComFuncionario(registros) {
  const mapa = new Map();
  for (const r of registros || []) {
    if (!r || r.tipo !== "uniforme" || r.anulado_em || r.devolvido_em) continue;
    const chave = `${limpo(r.item)}|${limpo(r.tamanho)}`;
    const atual = mapa.get(chave) || { item: limpo(r.item), tamanho: limpo(r.tamanho) || null, quantidade: 0, ultimaEntrega: null };
    atual.quantidade += Number(r.quantidade) || 0;
    if (!atual.ultimaEntrega || r.data > atual.ultimaEntrega) atual.ultimaEntrega = r.data;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => a.item.localeCompare(b.item, "pt-BR"));
}

/** Registros que pedem assinatura e ainda não têm cópia assinada nem recusa com testemunhas. */
export function faltaAssinatura(r) {
  const tipo = tipoPorId(r?.tipo);
  return Boolean(tipo?.assinatura && !r.anulado_em && !r.arquivo_url && !r.recusou_assinar);
}

/**
 * Linha do tempo: os registros novos e o que já existia em outras tabelas
 * (advertências antigas, documentos, atas), do mais novo para o mais velho.
 * Os antigos vêm marcados `legado` e não têm ações.
 */
export function linhaDoTempo({ registros = [], advertenciasAntigas = [], documentos = [], atas = [] } = {}) {
  const itens = [
    ...(registros || []).map((r) => ({ ...r, origem: "ficha" })),
    ...(advertenciasAntigas || []).map((a) => ({
      id: `adv:${a.id}`, origem: "legado", tipo: "advertencia_escrita", data: a.data,
      titulo: a.motivo || "Advertência", descricao: a.descricao || null, gravidade: a.gravidade || null,
    })),
    ...(documentos || []).map((d) => ({
      id: `doc:${d.id}`, origem: "legado", fonteArquivo: "documento", arquivoId: d.id, tipo: "documento",
      data: String(d.created_at || "").slice(0, 10), titulo: d.tipo || "Documento", descricao: d.nome_arquivo || null, arquivo_url: d.url_arquivo || null,
    })),
    ...(atas || []).map((a) => ({
      id: `ata:${a.id}`, origem: "legado", fonteArquivo: "ata_funcionario", arquivoId: a.id, tipo: "reuniao",
      data: String(a.data || a.created_at || "").slice(0, 10), titulo: a.assunto || "Reunião", descricao: a.descricao || null, arquivo_url: a.arquivo_url || null,
    })),
  ];
  return itens.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

export function filtrar(itens, filtro) {
  if (!filtro || filtro === "todos") return itens || [];
  return (itens || []).filter((i) => tipoPorId(i.tipo)?.grupo === filtro);
}

export const reais = (centavos) => (centavos == null ? null
  : (Number(centavos) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

const dataBR = (iso) => String(iso || "").slice(0, 10).split("-").reverse().join("/");

/**
 * Texto do termo para imprimir e o funcionário assinar. Puro: a tela monta o
 * HTML (com escape) e imprime. Não é modelo jurídico: é o registro do fato,
 * para o dono revisar com o contador se for usar em processo.
 */
export function termoParaAssinar(registro, { funcionario = {}, empresa = "" } = {}) {
  const tipo = tipoPorId(registro?.tipo);
  const nome = limpo(funcionario.nome) || "Funcionário";
  const cargo = limpo(funcionario.cargo);
  const quem = cargo ? `${nome}, ${cargo}` : nome;
  const dia = dataBR(registro?.data);
  const paragrafos = [];
  switch (registro?.tipo) {
    case "uniforme":
      paragrafos.push(`Eu, ${quem}, declaro ter recebido de ${empresa || "a empresa"}, em ${dia}, ${registro.quantidade} unidade(s) de ${registro.item}${registro.tamanho ? `, tamanho ${registro.tamanho}` : ""}, para uso exclusivo no trabalho.`);
      paragrafos.push("Comprometo-me a zelar pelo uniforme e a devolvê-lo quando deixar a empresa ou quando for substituído.");
      break;
    case "quebra":
      paragrafos.push(`Registro de ${dia}: ${registro.quantidade} × ${registro.item} (${registro.titulo}), sob responsabilidade de ${quem}.`);
      if (registro.valor_centavos != null) paragrafos.push(`Valor informado do item: ${reais(registro.valor_centavos)}.`);
      paragrafos.push("Este registro não autoriza desconto em salário. Desconto só com acordo prévio ou dolo, conforme o art. 462 da CLT.");
      break;
    case "reuniao":
      paragrafos.push(`Eu, ${quem}, participei em ${dia} de: ${registro.titulo}.`);
      break;
    case "documento":
      paragrafos.push(`Eu, ${quem}, recebi e li em ${dia} o documento: ${registro.titulo}.`);
      break;
    default:
      paragrafos.push(`${tipo?.rotulo || "Registro"} aplicada a ${quem} em ${dia}.`);
      paragrafos.push(`Motivo: ${registro?.titulo}.`);
  }
  if (registro?.descricao) paragrafos.push(`Detalhes: ${registro.descricao}`);
  if (tipo?.grupo === "disciplina") {
    paragrafos.push("A assinatura confirma o recebimento desta comunicação, não a concordância com o conteúdo. Se o funcionário se recusar a assinar, duas testemunhas assinam abaixo.");
  }
  return {
    titulo: tipo?.id === "uniforme" ? "Termo de entrega de uniforme" : tipo?.rotulo || "Registro",
    empresa: limpo(empresa),
    paragrafos,
    assinaturas: [
      { rotulo: nome },
      { rotulo: limpo(registro?.registrado_por) || "Responsável pela empresa" },
      ...(tipo?.grupo === "disciplina" ? [{ rotulo: "Testemunha 1" }, { rotulo: "Testemunha 2" }] : []),
    ],
    data: dia,
  };
}
