// CADASTRO DO COLABORADOR — regras puras do formulário (HDEV-RH-001, Fase 1).
//
// Um formulário só para criar e editar (app/dashboard/rh/page.js). Aqui ficam,
// sem Supabase, as partes que decidem se o cadastro está certo:
//   - formularioDeEdicao: linha do banco → estado do formulário (nulos viram
//     "" e listas vazias; nada é inventado);
//   - validarCadastro: obrigatórios, recomendados e formato, por etapa;
//   - progressoCadastro: quanto do cadastro está preenchido de verdade;
//   - acharDuplicado: impede criar a mesma pessoa duas vezes (CPF, ou nome +
//     telefone), inclusive desligada.

const so = (v) => String(v ?? "").replace(/\D/g, "");
const txt = (v) => String(v ?? "").trim();
const norm = (v) => txt(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");

/** Linha de `colaboradores` → estado do formulário de edição. */
export function formularioDeEdicao(f = {}) {
  return {
    foto: f.foto || "",
    nome: f.nome || "",
    cargo: f.cargo || "",
    salario: f.salario ?? "",
    horario_entrada: f.horario_entrada || "",
    horario_saida: f.horario_saida || "",
    horario_dom_entrada: f.horario_dom_entrada || "",
    horario_dom_saida: f.horario_dom_saida || "",
    horario_por_dia: !!f.horario_por_dia,
    horarios_dia: (f.horarios_dia && typeof f.horarios_dia === "object") ? f.horarios_dia : {},
    dias_trabalho: f.dias_trabalho || "1,2,3,4,5,6",
    tempo_intervalo: f.tempo_intervalo || 60,
    intervalo_inicio: f.intervalo_inicio || "",
    intervalo_fim: f.intervalo_fim || "",
    intervalo_dom_inicio: f.intervalo_dom_inicio || "",
    intervalo_dom_fim: f.intervalo_dom_fim || "",
    tipo_contrato: f.tipo_contrato || "Fixo",
    telefone: f.telefone || "",
    email: f.email || "",
    cpf: f.cpf || "",
    rg: f.rg || "",
    rua_av: f.rua_av || f.rua || "",
    numero_casa: f.numero_casa || f.numero || "",
    bairro: f.bairro || "",
    cidade_uf: f.cidade_uf || f.cidade || "",
    chave_pix: f.chave_pix || "",
    avaliacao_estrelas: f.avaliacao_estrelas || 0,
    data_admissao: f.data_admissao || "",
    status_contrato: f.status_contrato || "Definitivo",
    supervisor_id: f.supervisor_id || "",
    supervisores_ids: Array.isArray(f.supervisores_ids) ? f.supervisores_ids : (f.supervisor_id ? [f.supervisor_id] : []),
    vale_alimentacao: f.vale_alimentacao || "",
    taxa_servico_mes: f.taxa_servico_mes || "",
    endereco: f.endereco || "",
    cep: f.cep || "",
    cidade_nascimento: f.cidade_nascimento || "",
    nome_pai: f.nome_pai || "",
    nome_mae: f.nome_mae || "",
    filhos: Array.isArray(f.filhos) ? f.filhos : [],
    data_nascimento: f.data_nascimento || "",
    tem_transporte: !!f.tem_transporte,
    tipo_transporte: f.tipo_transporte || "",
    usa_vale_transporte: !!f.usa_vale_transporte,
    pontos_taxa: f.pontos_taxa != null ? String(f.pontos_taxa) : "",
    genero: f.genero || "",
    escolaridade: f.escolaridade || "",
    estado_civil: f.estado_civil || "",
    // dados que alimentam o recibo de trabalho extra
    topicos_funcao: f.topicos_funcao || "",
    itens_emprestados: f.itens_emprestados || "",
    forma_pagamento: f.forma_pagamento || "Pix",
    vale_transporte_val: f.vale_transporte_val ?? "",
    setor_entrega: f.setor_entrega || "",
    janta_ofertada: f.janta_ofertada !== false,
  };
}

/** CPF com 11 dígitos e dígitos verificadores certos. */
export function cpfValido(cpf) {
  const d = so(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Campos por etapa do formulário. nivel: obrigatorio | recomendado. */
export const CAMPOS = [
  { k: "nome", rotulo: "Nome completo", etapa: "identificacao", nivel: "obrigatorio" },
  { k: "cargo", rotulo: "Função / cargo", etapa: "funcao", nivel: "obrigatorio" },
  { k: "telefone", rotulo: "Telefone", etapa: "identificacao", nivel: "recomendado" },
  { k: "cpf", rotulo: "CPF", etapa: "identificacao", nivel: "recomendado" },
  { k: "data_admissao", rotulo: "Data de início", etapa: "vinculo", nivel: "recomendado" },
  { k: "horario_entrada", rotulo: "Horário de entrada", etapa: "jornada", nivel: "recomendado" },
  { k: "horario_saida", rotulo: "Horário de saída", etapa: "jornada", nivel: "recomendado" },
  { k: "chave_pix", rotulo: "Chave Pix", etapa: "pagamento", nivel: "recomendado" },
];

export const ETAPAS = [
  { id: "identificacao", rotulo: "Identificação e contato" },
  { id: "funcao", rotulo: "Função e hierarquia" },
  { id: "vinculo", rotulo: "Vínculo" },
  { id: "jornada", rotulo: "Jornada" },
  { id: "pagamento", rotulo: "Pagamento" },
];

const preenchido = (form, k) => (k === "horario_entrada" || k === "horario_saida") && form.horario_por_dia
  ? Object.values(form.horarios_dia || {}).some((h) => h && h.e && h.s)
  : txt(form[k]) !== "";

/**
 * Valida o formulário. erros bloqueiam salvar; avisos não.
 * Retorna { ok, erros: {campo: msg}, avisos: {campo: msg}, porEtapa: {etapa: n de erros} }.
 */
export function validarCadastro(form = {}) {
  const erros = {}, avisos = {};
  for (const c of CAMPOS) {
    if (preenchido(form, c.k)) continue;
    if (c.nivel === "obrigatorio") erros[c.k] = `${c.rotulo} é obrigatório.`;
    else avisos[c.k] = `${c.rotulo} não preenchido.`;
  }
  if (txt(form.cpf) && !cpfValido(form.cpf)) erros.cpf = "CPF inválido: confira os 11 dígitos.";
  if (txt(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(txt(form.email))) erros.email = "E-mail inválido.";
  const tel = so(form.telefone);
  if (tel && (tel.length < 10 || tel.length > 13)) erros.telefone = "Telefone incompleto: use DDD + número.";
  if (txt(form.salario) && !(Number(form.salario) >= 0)) erros.salario = "Salário não pode ser negativo.";
  for (const k of ["data_admissao", "data_nascimento"]) {
    if (txt(form[k]) && Number.isNaN(Date.parse(form[k]))) erros[k] = "Data inválida.";
  }
  if (txt(form.data_nascimento) && txt(form.data_admissao) && form.data_nascimento >= form.data_admissao) {
    erros.data_nascimento = "Nascimento depois da data de início.";
  }
  const etapaDe = Object.fromEntries(CAMPOS.map((c) => [c.k, c.etapa]));
  const porEtapa = {};
  for (const k of Object.keys(erros)) { const e = etapaDe[k] || "identificacao"; porEtapa[e] = (porEtapa[e] || 0) + 1; }
  return { ok: Object.keys(erros).length === 0, erros, avisos, porEtapa };
}

/** Progresso real: obrigatórios e recomendados preenchidos e válidos. */
export function progressoCadastro(form = {}) {
  const { erros } = validarCadastro(form);
  const feitos = CAMPOS.filter((c) => preenchido(form, c.k) && !erros[c.k]).length;
  return { feitos, total: CAMPOS.length, pct: Math.round((feitos / CAMPOS.length) * 100) };
}

/**
 * Outra pessoa já cadastrada com o mesmo CPF, ou com o mesmo nome e telefone.
 * Considera desligados (voltar a contratar = reabrir o cadastro, não criar outro).
 */
export function acharDuplicado(form = {}, lista = [], editandoId = null) {
  const cpf = so(form.cpf), nome = norm(form.nome), tel = so(form.telefone);
  for (const c of lista || []) {
    if (!c || (editandoId && c.id === editandoId)) continue;
    if (cpf.length === 11 && so(c.cpf) === cpf) return { colaborador: c, motivo: "cpf" };
    if (nome && tel.length >= 10 && norm(c.nome) === nome && so(c.telefone) === tel) return { colaborador: c, motivo: "nome_telefone" };
  }
  return null;
}
