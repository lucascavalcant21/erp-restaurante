// ASSISTENTE DE CADASTRO — 8 etapas curtas (HDEV-RH-001, Fase 5).
//
// Regras puras: quais etapas e campos aparecem para cada modalidade, o que é
// obrigatório, recomendado ou opcional, e o que falta antes de salvar. A tela
// (app/dashboard/rh/CadastroAssistente.js) só desenha; quem grava é o mesmo
// handleSalvar do formulário completo (validarCadastro, duplicados) e o banco
// abre o vínculo (RH-6) a partir de tipo_contrato/status_contrato.
//
// Modalidades oferecidas no cadastro: experiência, prazo indeterminado e
// trabalho eventual. Intermitente e outras entram pela aba "Contratos e
// vínculos" (mudança de modalidade), que exige aprovação.

import { cpfValido } from "./colaborador-cadastro.mjs";

const txt = (v) => String(v ?? "").trim();
const so = (v) => String(v ?? "").replace(/\D/g, "");

export const MODALIDADES = {
  clt_experiencia: { rotulo: "CLT — contrato de experiência", ajuda: "Período de teste de até 90 dias (CLT art. 445). Depois vira prazo indeterminado." },
  clt_indeterminado: { rotulo: "CLT — prazo indeterminado", ajuda: "Contratação direta, sem período de experiência." },
  eventual: { rotulo: "Trabalho eventual (extra)", ajuda: "Serviço avulso pago por diária, sem jornada fixa. Se virar rotina, revise com o contador." },
};
export const DIAS_EXPERIENCIA = [30, 45];

/** Modalidade a partir dos campos do cadastro. */
export function modalidadeDe(form = {}) {
  if (form.tipo_contrato === "Freelancer") return "eventual";
  if (/experi/i.test(String(form.status_contrato || ""))) return "clt_experiencia";
  return "clt_indeterminado";
}

/** Grava a modalidade nos campos que o banco lê (RH-6). */
export function aplicarModalidade(form, modalidade, dias = 45) {
  if (modalidade === "eventual") return { ...form, tipo_contrato: "Freelancer", status_contrato: "Definitivo" };
  if (modalidade === "clt_experiencia") return { ...form, tipo_contrato: "Fixo", status_contrato: `Experiência ${DIAS_EXPERIENCIA.includes(Number(dias)) ? Number(dias) : 45}` };
  return { ...form, tipo_contrato: "Fixo", status_contrato: "Definitivo" };
}
export const diasExperienciaDe = (form) => Number(String(form.status_contrato || "").match(/\d+/)?.[0]) || 45;

const CLT = ["clt_experiencia", "clt_indeterminado"];
const nivel = (porMod) => (m) => porMod[m] ?? porMod.padrao ?? "opcional";

// tipo: texto | cpf | telefone | email | data | hora | numero | dinheiro | escolha | dias | supervisor | sim_nao
export const ETAPAS_ASSISTENTE = [
  { id: "identificacao", rotulo: "Identificação e contato", campos: [
    { k: "nome", rotulo: "Nome completo", tipo: "texto", nivel: () => "obrigatorio" },
    { k: "cpf", rotulo: "CPF", tipo: "cpf", nivel: nivel({ clt_experiencia: "obrigatorio", clt_indeterminado: "obrigatorio", eventual: "recomendado" }), ajuda: "Na CLT é exigido para o registro (eSocial)." },
    { k: "telefone", rotulo: "Telefone / WhatsApp", tipo: "telefone", nivel: () => "recomendado" },
    { k: "email", rotulo: "E-mail", tipo: "email", nivel: () => "opcional" },
    { k: "data_nascimento", rotulo: "Data de nascimento", tipo: "data", nivel: nivel({ clt_experiencia: "recomendado", clt_indeterminado: "recomendado", eventual: "opcional" }) },
  ] },
  { id: "funcao", rotulo: "Função, setor e hierarquia", campos: [
    { k: "cargo", rotulo: "Função / cargo", tipo: "cargo", nivel: () => "obrigatorio" },
    { k: "setor_entrega", rotulo: "Setor", tipo: "texto", nivel: () => "opcional" },
    { k: "supervisor_id", rotulo: "Supervisor direto", tipo: "supervisor", nivel: nivel({ clt_experiencia: "recomendado", clt_indeterminado: "recomendado", eventual: "opcional" }) },
  ] },
  { id: "vinculo", rotulo: "Modalidade e contrato", campos: [
    { k: "modalidade", rotulo: "Modalidade", tipo: "modalidade", nivel: () => "obrigatorio" },
    { k: "dias_experiencia", rotulo: "1º período de experiência", tipo: "dias_experiencia", so: ["clt_experiencia"], nivel: () => "obrigatorio", ajuda: "A prorrogação, se houver, é registrada depois com o contrato assinado." },
    { k: "data_admissao", rotulo: "Data de início", tipo: "data", nivel: nivel({ clt_experiencia: "obrigatorio", clt_indeterminado: "obrigatorio", eventual: "recomendado" }), ajuda: "Primeiro dia de trabalho." },
  ] },
  { id: "jornada", rotulo: "Jornada de trabalho", so: CLT, campos: [
    { k: "horario_entrada", rotulo: "Entrada", tipo: "hora", nivel: () => "recomendado" },
    { k: "horario_saida", rotulo: "Saída", tipo: "hora", nivel: () => "recomendado" },
    { k: "tempo_intervalo", rotulo: "Intervalo (minutos)", tipo: "numero", nivel: () => "recomendado", ajuda: "Jornada acima de 6h: mínimo de 1 hora (CLT art. 71)." },
    { k: "dias_trabalho", rotulo: "Dias de trabalho", tipo: "dias", nivel: () => "recomendado" },
  ] },
  { id: "salario", rotulo: "Salário e pagamento", campos: [
    { k: "salario", rotulo: (m) => (m === "eventual" ? "Diária combinada (R$)" : "Salário mensal (R$)"), tipo: "dinheiro",
      nivel: nivel({ clt_experiencia: "obrigatorio", clt_indeterminado: "obrigatorio", eventual: "recomendado" }) },
    { k: "chave_pix", rotulo: "Chave Pix", tipo: "texto", nivel: () => "recomendado" },
    { k: "forma_pagamento", rotulo: "Forma de pagamento", tipo: "escolha", opcoes: ["Pix", "Dinheiro", "Transferência"], nivel: () => "opcional" },
  ] },
  { id: "beneficios", rotulo: "Benefícios e descontos", so: CLT, campos: [
    { k: "vale_alimentacao", rotulo: "Vale-alimentação (R$/mês)", tipo: "dinheiro", nivel: () => "opcional" },
    { k: "usa_vale_transporte", rotulo: "Usa vale-transporte", tipo: "sim_nao", nivel: () => "opcional", ajuda: "Desconto de até 6% do salário-base (Lei 7.418/85)." },
    { k: "pontos_taxa", rotulo: "Pontos na taxa de serviço", tipo: "escolha", opcoes: ["", "0.5", "1", "1.5", "2"], nivel: () => "opcional" },
  ] },
  { id: "documentos", rotulo: "Documentos obrigatórios", campos: [] },
  { id: "revisao", rotulo: "Revisão e confirmação", campos: [] },
];

/** Documentos por modalidade: anexados no prontuário depois de salvar. */
export function documentosExigidos(modalidade) {
  if (modalidade === "eventual") return [
    { doc: "Documento com foto (RG ou CNH)", nivel: "recomendado" },
    { doc: "Recibo de cada serviço prestado, assinado", nivel: "obrigatorio", quando: "a cada serviço" },
  ];
  return [
    { doc: "Carteira de Trabalho Digital (consulta do número)", nivel: "obrigatorio" },
    { doc: "Documento com foto (RG ou CNH) e CPF", nivel: "obrigatorio" },
    { doc: "Atestado de saúde ocupacional (ASO) admissional", nivel: "obrigatorio", quando: "antes de começar (NR-7)" },
    { doc: "Contrato de trabalho assinado", nivel: "obrigatorio", quando: modalidade === "clt_experiencia" ? "com o prazo da experiência e a cláusula de prorrogação" : null },
    { doc: "Comprovante de residência", nivel: "recomendado" },
    { doc: "Certidão de nascimento dos filhos menores de 14 anos (salário-família)", nivel: "opcional" },
  ];
}

/** Etapas visíveis para a modalidade (eventual não tem jornada fixa nem benefícios). */
export function etapasPara(modalidade) {
  return ETAPAS_ASSISTENTE.filter((e) => !e.so || e.so.includes(modalidade));
}
export function camposDaEtapa(etapaId, modalidade) {
  const e = ETAPAS_ASSISTENTE.find((x) => x.id === etapaId);
  return (e?.campos || []).filter((c) => !c.so || c.so.includes(modalidade))
    .map((c) => ({ ...c, rotulo: typeof c.rotulo === "function" ? c.rotulo(modalidade) : c.rotulo, nivel: c.nivel(modalidade) }));
}

function valorDe(form, k) {
  if (k === "modalidade") return modalidadeDe(form);
  if (k === "dias_experiencia") return diasExperienciaDe(form);
  return form[k];
}
const vazio = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Erros (bloqueiam avançar) e avisos (não bloqueiam) da etapa. */
export function validarEtapa(form, etapaId, { piso = null } = {}) {
  const m = modalidadeDe(form);
  const erros = {}, avisos = {};
  for (const c of camposDaEtapa(etapaId, m)) {
    const v = valorDe(form, c.k);
    if (vazio(v) || (c.tipo === "sim_nao" && v == null)) {
      if (c.nivel === "obrigatorio") erros[c.k] = `${c.rotulo}: obrigatório.`;
      else if (c.nivel === "recomendado") avisos[c.k] = `${c.rotulo}: recomendado.`;
      continue;
    }
    if (c.tipo === "cpf" && !cpfValido(v)) erros[c.k] = "CPF inválido: confira os 11 dígitos.";
    if (c.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(txt(v))) erros[c.k] = "E-mail inválido.";
    if (c.tipo === "telefone" && (so(v).length < 10 || so(v).length > 13)) erros[c.k] = "Telefone incompleto: use DDD + número.";
    if (c.tipo === "dinheiro" && !(Number(v) >= 0)) erros[c.k] = "Valor inválido.";
    if (c.tipo === "data" && Number.isNaN(Date.parse(v))) erros[c.k] = "Data inválida.";
  }
  if (etapaId === "identificacao" && txt(form.data_nascimento) && txt(form.data_admissao) && form.data_nascimento >= form.data_admissao) {
    erros.data_nascimento = "Nascimento depois da data de início.";
  }
  if (etapaId === "salario" && CLT.includes(m) && piso && Number(form.salario) > 0 && Number(form.salario) < piso.valor) {
    avisos.salario = `Abaixo do piso (${piso.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, ${piso.fonte}). Confirme se é jornada parcial ou aprendiz.`;
  }
  if (etapaId === "jornada" && Number(form.tempo_intervalo) > 0 && Number(form.tempo_intervalo) < 60 && duracaoMin(form) > 360) {
    avisos.tempo_intervalo = "Jornada acima de 6h com intervalo menor que 1 hora (CLT art. 71).";
  }
  return { ok: Object.keys(erros).length === 0, erros, avisos };
}

function duracaoMin(form) {
  const m = (h) => { const [a, b] = String(h || "").split(":").map(Number); return Number.isFinite(a) ? a * 60 + (b || 0) : null; };
  const e = m(form.horario_entrada), s = m(form.horario_saida);
  if (e == null || s == null) return 0;
  return (s > e ? s - e : s + 1440 - e) - (Number(form.tempo_intervalo) || 0);
}

/** Resumo para a revisão: erros por etapa (bloqueiam salvar) e avisos. */
export function revisarCadastro(form, opcoes = {}) {
  const m = modalidadeDe(form);
  const porEtapa = etapasPara(m).filter((e) => e.campos.length).map((e) => ({ etapa: e, ...validarEtapa(form, e.id, opcoes) }));
  const bloqueios = porEtapa.filter((x) => !x.ok);
  return { modalidade: m, ok: bloqueios.length === 0, porEtapa, bloqueios, avisos: porEtapa.flatMap((x) => Object.values(x.avisos)) };
}
