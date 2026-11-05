// Leitura e ações do treinamento. Tudo que grava passa por funções do banco:
// permissão, unidade e correção da prova são conferidas lá (db/treinamento).
import { supabase, isSupabaseReady } from "./supabase";
import { fetchComSessao } from "./api-sessao";

const rpc = async (nome, args) => {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.rpc(nome, args);
  return { data, error: error?.message || null };
};
const lista = async (consulta) => {
  const { data, error } = await consulta;
  return { data: data || [], error: error?.message || null };
};

// Sem custo nem preço: treinamento mostra a receita, não a margem.
const CAMPOS_FICHA = "id, nome_receita, nome_comercial, descricao_comercial, departamento, categoria, eh_base, ativo, modo_preparo, copo, metodo_bar, tipo_gelo, guarnicao, temperatura_servico, validade_dias, imagem, montagem_foto, alergenicos_pode_conter, rendimento_porcoes, rendimento_unidade, fichas_ingredientes!ficha_id(id, quantidade, insumos(nome, unidade_medida))";

export async function fetchPratos(unidadeId, departamento) {
  if (!isSupabaseReady()) return { fichas: [], guias: [], error: "Offline" };
  const consulta = supabase.from("fichas_tecnicas").select(CAMPOS_FICHA).eq("unidade_id", unidadeId).order("nome_receita");
  const [fichas, guias] = await Promise.all([
    lista(departamento ? consulta.eq("departamento", departamento) : consulta),
    lista(supabase.from("montagem").select("nome, descritivo, foto_url, departamento").eq("unidade_id", unidadeId)),
  ]);
  return { fichas: fichas.data, guias: guias.data, error: fichas.error || guias.error };
}

/** Tudo que a pessoa precisa para ver as próprias trilhas. A RLS filtra o resto. */
export async function fetchMeuTreinamento() {
  if (!isSupabaseReady()) return { error: "Offline" };
  const eu = await rpc("trein_meu_usuario", {});
  if (eu.error) return { error: eu.error };
  const usuarioId = eu.data;
  const matriculas = await lista(supabase.from("trein_matriculas").select("*").eq("usuario_id", usuarioId).neq("status", "cancelado").order("iniciado_em", { ascending: false }));
  if (matriculas.error) return { error: matriculas.error };
  const ids = matriculas.data.map((m) => m.id);
  const trilhaIds = matriculas.data.map((m) => m.trilha_id);
  if (!ids.length) return { matriculas: [], trilhas: [], ligacoes: [], modulos: [], aulas: [], concluidas: [], tentativas: [], pratos: [] };
  const [trilhas, ligacoes, modulos, aulas, concluidas, tentativas, pratos] = await Promise.all([
    lista(supabase.from("trein_trilhas").select("*").in("id", trilhaIds)),
    lista(supabase.from("trein_trilha_modulos").select("*").in("trilha_id", trilhaIds).order("ordem")),
    lista(supabase.from("trein_modulos").select("*").order("ordem")),
    lista(supabase.from("trein_aulas").select("*").order("ordem")),
    lista(supabase.from("trein_aulas_concluidas").select("*").in("matricula_id", ids)),
    lista(supabase.from("trein_tentativas").select("id, matricula_id, modulo_id, acertos, total, aprovada, criado_em").in("matricula_id", ids).order("criado_em", { ascending: false })),
    lista(supabase.from("trein_pratos_validados").select("*").in("matricula_id", ids)),
  ]);
  return {
    matriculas: matriculas.data, trilhas: trilhas.data, ligacoes: ligacoes.data, modulos: modulos.data,
    aulas: aulas.data, concluidas: concluidas.data, tentativas: tentativas.data, pratos: pratos.data,
    error: trilhas.error || ligacoes.error || modulos.error || aulas.error || concluidas.error || tentativas.error || pratos.error,
  };
}

export const fetchQuestoes = (moduloId) => lista(supabase.from("trein_questoes").select("id, tipo, ordem, enunciado, opcoes, aula_id").eq("modulo_id", moduloId).order("ordem"));
export const concluirAula = (matricula, aula) => rpc("trein_concluir_aula", { p_matricula: matricula, p_aula: aula });
export const corrigirProva = (matricula, modulo, respostas) => rpc("trein_corrigir_prova", { p_matricula: matricula, p_modulo: modulo, p_respostas: respostas });

export const fetchEquipe = (unidade) => rpc("trein_equipe", { p_unidade_id: unidade });
export const fetchTrilhas = (unidade) => lista(supabase.from("trein_trilhas").select("*").eq("unidade_id", unidade).eq("ativa", true).order("ordem"));
export const matricular = (usuario, trilha) => rpc("trein_matricular", { p_usuario: usuario, p_trilha: trilha });
export const cancelarMatricula = (matricula) => rpc("trein_cancelar_matricula", { p_matricula: matricula });
export const avaliarPratica = (matricula, item, aprovado, observacao = "") => rpc("trein_avaliar_pratica", { p_matricula: matricula, p_item: item, p_aprovado: aprovado, p_observacao: observacao });
export const validarPrato = (matricula, ficha, etapa, validado) => rpc("trein_validar_prato", { p_matricula: matricula, p_ficha: ficha, p_etapa: etapa, p_validado: validado });
export const concluirTrilha = (matricula) => rpc("trein_concluir_trilha", { p_matricula: matricula });

export async function fetchDetalheMatricula(id) {
  const m = await supabase.from("trein_matriculas").select("*").eq("id", id).maybeSingle();
  if (m.error || !m.data) return { error: m.error?.message || "Matrícula não encontrada." };
  const [trilha, ligacoes, modulos, itens, avaliacoes, tentativas, pratos] = await Promise.all([
    supabase.from("trein_trilhas").select("*").eq("id", m.data.trilha_id).maybeSingle(),
    lista(supabase.from("trein_trilha_modulos").select("*").eq("trilha_id", m.data.trilha_id).order("ordem")),
    lista(supabase.from("trein_modulos").select("*").order("ordem")),
    lista(supabase.from("trein_pratica_itens").select("*").eq("trilha_id", m.data.trilha_id).order("ordem")),
    lista(supabase.from("trein_pratica_avaliacoes").select("*").eq("matricula_id", id)),
    lista(supabase.from("trein_tentativas").select("id, modulo_id, acertos, total, aprovada, criado_em").eq("matricula_id", id).order("criado_em", { ascending: false })),
    lista(supabase.from("trein_pratos_validados").select("*").eq("matricula_id", id)),
  ]);
  return {
    matricula: m.data, trilha: trilha.data, ligacoes: ligacoes.data, modulos: modulos.data, itens: itens.data,
    avaliacoes: avaliacoes.data, tentativas: tentativas.data, pratos: pratos.data,
    error: ligacoes.error || modulos.error || itens.error || avaliacoes.error || tentativas.error || pratos.error,
  };
}

export async function fetchEstudio(unidade) {
  const [modulos, aulas, questoes, trilhas, ligacoes] = await Promise.all([
    lista(supabase.from("trein_modulos").select("*").eq("unidade_id", unidade).order("ordem")),
    lista(supabase.from("trein_aulas").select("*").eq("unidade_id", unidade).order("ordem")),
    lista(supabase.from("trein_questoes").select("*").eq("unidade_id", unidade).order("ordem")),
    lista(supabase.from("trein_trilhas").select("*").eq("unidade_id", unidade).order("ordem")),
    lista(supabase.from("trein_trilha_modulos").select("*").eq("unidade_id", unidade).order("ordem")),
  ]);
  return { modulos: modulos.data, aulas: aulas.data, questoes: questoes.data, trilhas: trilhas.data, ligacoes: ligacoes.data, error: modulos.error || aulas.error || questoes.error || trilhas.error || ligacoes.error };
}
export const fetchGabarito = (modulo) => rpc("trein_gabarito_do_modulo", { p_modulo: modulo });
export const salvarAula = (aula, { titulo, conteudo, video_url, duracao_minutos }) => rpc("trein_salvar_aula", { p_aula: aula, p_titulo: titulo, p_conteudo: conteudo, p_video_url: video_url || "", p_duracao: Number(duracao_minutos) || 5 });
export const salvarQuestao = (questao, { enunciado, opcoes, correta, explicacao }) => rpc("trein_salvar_questao", { p_questao: questao, p_enunciado: enunciado, p_opcoes: opcoes, p_correta: Number(correta), p_explicacao: explicacao || "" });
export const aprovarModulo = (modulo, aprovar) => rpc("trein_aprovar_modulo", { p_modulo: modulo, p_aprovar: aprovar });
export const salvarCenas = (aula, cenas) => rpc("trein_salvar_cenas", { p_aula: aula, p_cenas: cenas });
export const criarModulo = (unidade, area, titulo, descricao) => rpc("trein_criar_modulo", { p_unidade_id: unidade, p_area: area, p_titulo: titulo, p_descricao: descricao });
export const salvarModulo = (modulo, titulo, descricao) => rpc("trein_salvar_modulo", { p_modulo: modulo, p_titulo: titulo, p_descricao: descricao });
export const criarAula = (modulo, titulo, conteudo) => rpc("trein_criar_aula", { p_modulo: modulo, p_titulo: titulo, p_conteudo: conteudo });
export const criarQuestao = (aula, tipo, { enunciado, opcoes, correta, explicacao }) => rpc("trein_criar_questao", { p_aula: aula, p_tipo: tipo, p_enunciado: enunciado, p_opcoes: opcoes, p_correta: Number(correta), p_explicacao: explicacao || "" });
export const removerAula = (aula) => rpc("trein_remover_aula", { p_aula: aula });
export const removerQuestao = (questao) => rpc("trein_remover_questao", { p_questao: questao });
export const ligarModulo = (modulo, trilha, ligar) => rpc("trein_ligar_modulo", { p_modulo: modulo, p_trilha: trilha, p_ligar: ligar });

export async function gerarFalasComIA(aulaId, instrucao = "") {
  try {
    const r = await fetchComSessao("/api/ia-treinamento-falas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aula_id: aulaId, instrucao }),
    });
    const json = await r.json().catch(() => ({}));
    return r.ok ? { data: json.cenas, error: null } : { data: null, error: json.error || "Não foi possível gerar as falas." };
  } catch {
    return { data: null, error: "Sem conexão." };
  }
}
