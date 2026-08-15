import { supabase, isSupabaseReady } from "./supabase";

// Portal público de cadastro de extras. O candidato preenche sem ter conta e
// cai num banco separado (extras_cadastros) — não entra direto na folha.
// Quem marca interesse em CLT é levado ao portal de vagas com os dados já
// preenchidos, buscados por uma função que devolve só o necessário.

// Funções mais comuns num restaurante — viram a "categoria" do banco de extras.
export const FUNCOES_EXTRA = [
  "Garçom", "Cumim", "Copeiro", "Barman", "Bartender", "Barista",
  "Cozinheiro", "Auxiliar de cozinha", "Chapeiro", "Pizzaiolo", "Sushiman",
  "Churrasqueiro", "Confeiteiro", "Padeiro", "Salgadeiro",
  "Auxiliar de limpeza", "Steward", "Recepcionista", "Hostess",
  "Segurança", "Manobrista", "Estoquista", "Motoboy", "Caixa",
];

export const DIAS_SEMANA = [
  { valor: "seg", rotulo: "Seg" }, { valor: "ter", rotulo: "Ter" },
  { valor: "qua", rotulo: "Qua" }, { valor: "qui", rotulo: "Qui" },
  { valor: "sex", rotulo: "Sex" }, { valor: "sab", rotulo: "Sáb" },
  { valor: "dom", rotulo: "Dom" },
];

export const PERGUNTAS_EXTRA = [
  {
    id: "experiencia_eventos",
    pergunta: "Você já trabalhou em eventos ou casas com movimento alto?",
    opcoes: ["Sim, tenho bastante experiência", "Já trabalhei algumas vezes", "Ainda não, seria minha primeira vez"],
  },
  {
    id: "chamado_ultima_hora",
    pergunta: "Costuma conseguir atender chamado de última hora (no mesmo dia)?",
    opcoes: ["Sim, quase sempre", "Às vezes, depende do dia", "Não, preciso de aviso com antecedência"],
  },
  {
    id: "uniforme",
    pergunta: "Tem uniforme próprio (calça preta e sapato fechado)?",
    opcoes: ["Sim, tenho completo", "Tenho parte do uniforme", "Não tenho"],
  },
];

const erroMsg = (e) => e?.message || null;

// Dados públicos do restaurante (endereço) para mostrar nos portais.
export async function fetchUnidadePublica(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: null };
  try {
    const { data, error } = await supabase.rpc("unidade_publica", { p_unidade_id: String(unidadeId) });
    if (error || !data) return { data: null };
    return { data };
  } catch { return { data: null }; }
}

export async function enviarCadastroExtra(unidadeId, form, respostas) {
  if (!isSupabaseReady()) return { error: "Sem conexão." };
  const payload = {
    unidade_id: String(unidadeId),
    nome: String(form.nome || "").trim(),
    telefone: String(form.telefone || "").trim(),
    data_nascimento: form.data_nascimento || null,
    estado_civil: form.estado_civil || null,
    genero: form.genero || null,
    escolaridade: form.escolaridade || null,
    tem_filhos: !!form.tem_filhos,
    qtd_filhos: form.tem_filhos ? (Number(form.qtd_filhos) || 0) : null,
    endereco: form.endereco || null,
    bairro: form.bairro || null,
    cidade: form.cidade || null,
    funcao_principal: form.funcao_principal,
    funcao_secundaria: form.funcao_secundaria || null,
    dias_disponiveis: Array.isArray(form.dias_disponiveis) ? form.dias_disponiveis : [],
    periodo_disponivel: form.periodo_disponivel || null,
    experiencia: form.experiencia || null,
    valor_diaria_pretendido: form.valor_diaria_pretendido ? Number(form.valor_diaria_pretendido) : null,
    chave_pix: form.chave_pix || null,
    interesse: form.interesse || "extra",
    respostas: respostas || {},
    observacoes: form.observacoes || null,
  };
  const { data, error } = await supabase.from("extras_cadastros").insert([payload]).select("id").single();
  return { id: data?.id, error: erroMsg(error) };
}

// Usado pelo portal de vagas para preencher a candidatura de quem já se
// cadastrou como extra e marcou interesse em CLT.
export async function fetchExtraParaVaga(extraId) {
  if (!isSupabaseReady() || !extraId) return { data: null };
  try {
    const { data, error } = await supabase.rpc("extra_cadastro_publico", { p_id: extraId });
    if (error || !data) return { data: null };
    return { data };
  } catch { return { data: null }; }
}

// ── Uso interno (RH) ────────────────────────────────────────────────────────
export async function fetchBancoExtras(unidadeId, { funcao = "", status = "" } = {}) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let q = supabase.from("extras_cadastros").select("*").eq("unidade_id", String(unidadeId));
  if (funcao) q = q.or(`funcao_principal.eq.${funcao},funcao_secundaria.eq.${funcao}`);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  return { data: data || [], error: erroMsg(error) };
}

export async function atualizarStatusExtraCadastro(id, status, colaboradorId = null) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const patch = { status };
  if (colaboradorId) patch.colaborador_id = colaboradorId;
  const { error } = await supabase.from("extras_cadastros").update(patch).eq("id", id);
  return { error: erroMsg(error) };
}

// Correção do cadastro pelo RH antes de aprovar (telefone errado, função
// trocada, diária combinada diferente...).
export async function atualizarCadastroExtra(id, campos) {
  if (!isSupabaseReady() || !id) return { error: "Registro inválido." };
  const permitidos = {
    nome: campos.nome,
    telefone: campos.telefone,
    funcao_principal: campos.funcao_principal,
    funcao_secundaria: campos.funcao_secundaria || null,
    valor_diaria_pretendido: campos.valor_diaria_pretendido === "" || campos.valor_diaria_pretendido == null
      ? null : Number(campos.valor_diaria_pretendido),
    chave_pix: campos.chave_pix || null,
    bairro: campos.bairro || null,
    cidade: campos.cidade || null,
    observacoes: campos.observacoes || null,
  };
  const { error } = await supabase.from("extras_cadastros").update(permitidos).eq("id", id);
  return { error: erroMsg(error) };
}
