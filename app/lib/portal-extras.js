import { supabase, isSupabaseReady } from "./supabase";

// Portal público de cadastro de extras. O candidato preenche sem ter conta e
// cai num banco separado (extras_cadastros) — não entra direto na folha.
// Quem marca interesse em CLT é levado ao portal de vagas com os dados já
// preenchidos, buscados por uma função que devolve só o necessário.

// Funções mais comuns num restaurante — viram a "categoria" do banco.
// Em ordem alfabética: a lista é longa e o candidato procura pelo nome.
export const FUNCOES_EXTRA = [
  "Garçom", "Cumim", "Copeiro", "Barman", "Bartender", "Barista",
  "Cozinheiro", "Auxiliar de cozinha", "Chapeiro", "Pizzaiolo", "Sushiman",
  "Churrasqueiro", "Confeiteiro", "Padeiro", "Salgadeiro",
  "Auxiliar de limpeza", "Steward", "Recepcionista", "Hostess",
  "Segurança", "Manobrista", "Estoquista", "Motoboy", "Caixa",
].sort((a, b) => a.localeCompare(b, "pt-BR"));

export const NACIONALIDADES = [
  "Brasileira", "Argentina", "Boliviana", "Chilena", "Colombiana", "Cubana",
  "Equatoriana", "Espanhola", "Haitiana", "Italiana", "Paraguaia", "Peruana",
  "Portuguesa", "Uruguaia", "Venezuelana", "Outra",
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

// Coluna ainda não migrada? Tira do envio e tenta de novo — o portal é público
// e não pode falhar na cara do candidato por causa de um ALTER TABLE pendente.
async function envioRetrySemColuna(error, tentar, campos, n = 0) {
  const m = error?.message || "";
  const achou = m.match(/column "?([a-z_]+)"? (?:of relation "extras_cadastros" )?does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && achou && n < 6 && achou[1] in campos) {
    delete campos[achou[1]];
    return envioRetrySemColuna(await tentar(), tentar, campos, n + 1);
  }
  return error;
}

export async function enviarCadastroExtra(unidadeId, form, respostas) {
  if (!isSupabaseReady()) return { error: "Sem conexão." };
  const payload = {
    unidade_id: String(unidadeId),
    nome: String(form.nome || "").trim(),
    telefone: String(form.telefone || "").trim(),
    data_nascimento: form.data_nascimento || null,
    nacionalidade: form.nacionalidade || null,
    estado_civil: form.estado_civil || null,
    genero: form.genero || null,
    escolaridade: form.escolaridade || null,
    tem_filhos: !!form.tem_filhos,
    qtd_filhos: form.tem_filhos ? (Number(form.qtd_filhos) || 0) : null,
    endereco: form.endereco || null,      // rua
    numero: form.numero || null,
    bairro: form.bairro || null,
    cidade: form.cidade || null,
    funcao_principal: form.funcao_principal,
    funcao_secundaria: form.funcao_secundaria || null,
    dias_disponiveis: Array.isArray(form.dias_disponiveis) ? form.dias_disponiveis : [],
    hora_inicio: form.hora_inicio || null,
    hora_fim: form.hora_fim || null,
    experiencia: form.experiencia || null,
    interesse: form.interesse || "extra",
    respostas: respostas || {},
    observacoes: form.observacoes || null,
  };
  let res = await supabase.from("extras_cadastros").insert([payload]).select("id").single();
  const error = await envioRetrySemColuna(res.error, async () => {
    const r = await supabase.from("extras_cadastros").insert([payload]).select("id").single();
    res = r; return r.error;
  }, payload);
  return { id: res.data?.id, error: erroMsg(error) };
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

// ── CONFIGURAÇÃO EDITÁVEL DO PORTAL ─────────────────────────────────────────
// Mesmo padrão do portal de vagas: fica em config_sistema.params.portal_extras
// e a leitura pública passa por função que expõe só este bloco.

export const PORTAL_EXTRAS_PADRAO = {
  titulo: "Cadastro de Prestadores de Serviço",
  subtitulo: "Faça seu cadastro e entre no nosso banco de profissionais. Quando precisarmos de reforço, chamamos você.",
  mensagem_sucesso: "Você entrou no nosso banco de prestadores de serviço. Quando precisarmos, chamamos pelo WhatsApp.",
  mostrar_endereco: true,
  funcoes: FUNCOES_EXTRA,
  perguntas: PERGUNTAS_EXTRA,
};

function normalizarPortalExtras(config) {
  const base = config && typeof config === "object" ? config : {};
  const funcoes = (Array.isArray(base.funcoes) && base.funcoes.length
    ? base.funcoes.map(f => String(f).trim()).filter(Boolean)
    : PORTAL_EXTRAS_PADRAO.funcoes
  ).slice().sort((a, b) => a.localeCompare(b, "pt-BR"));
  const perguntas = Array.isArray(base.perguntas)
    ? base.perguntas
        .map((p, i) => ({
          id: p.id || `p${i + 1}`,
          pergunta: String(p.pergunta || "").trim(),
          opcoes: (Array.isArray(p.opcoes) ? p.opcoes : []).map(o => String(o).trim()).filter(Boolean),
        }))
        .filter(p => p.pergunta && p.opcoes.length >= 2)
    : PORTAL_EXTRAS_PADRAO.perguntas;
  return {
    ...PORTAL_EXTRAS_PADRAO,
    ...base,
    funcoes,
    perguntas,
    mostrar_endereco: base.mostrar_endereco !== false,
  };
}

export async function fetchPortalExtrasConfig(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { data: normalizarPortalExtras(null) };
  }
  // Página pública: função devolve só este bloco, sem expor o resto.
  try {
    const { data, error } = await supabase.rpc("portal_extras_publico", { p_unidade_id: String(unidadeId) });
    if (!error && data && Object.keys(data).length > 0) return { data: normalizarPortalExtras(data) };
  } catch { /* função ainda não criada — leitura direta abaixo */ }

  const { data, error } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
  return { data: normalizarPortalExtras(data?.[0]?.params?.portal_extras), error: erroMsg(error) };
}

export async function salvarPortalExtrasConfig(unidadeId, config) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade específica." };
  const portal_extras = normalizarPortalExtras(config);

  try {
    const { error } = await supabase.rpc("merge_config_sistema_params", {
      p_unidade_id: unidadeId, p_patch: { portal_extras },
    });
    if (!error) return { data: portal_extras, error: null };
  } catch { /* usa o caminho direto abaixo */ }

  const { data: registros, error: erroLeitura } = await supabase
    .from("config_sistema").select("id, params").eq("unidade_id", unidadeId).limit(1);
  if (erroLeitura) return { error: erroLeitura.message };

  const registro = registros?.[0];
  const params = { ...(registro?.params || {}), portal_extras };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { data: portal_extras, error: erroMsg(error) };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { data: portal_extras, error: erroMsg(error) };
}
