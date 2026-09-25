import { getSupabaseServerClient } from "./supabase-server.mjs";

// QUEM PODE VER OS DADOS DESTA UNIDADE — verificação de servidor.
//
// Nasceu do incidente SEC-RH-1: /exportar-afd e /exportar-aej eram GET
// públicos, sem sessão nenhuma, que exportavam o registro de ponto legal com
// CPF a partir de um `unidadeId` na URL. Qualquer pessoa com o link tinha o
// arquivo.
//
// As três regras que este módulo aplica:
//
// 1. Sessão é obrigatória, e é verificada CONTRA O SUPABASE — não basta o
//    token existir, ele tem de resolver num usuário.
// 2. A unidade pedida na URL não vale nada por si. O que vale é o vínculo do
//    auth.uid() com aquela unidade, lido de usuarios_erp e usuario_escopos.
// 3. `user_metadata` NÃO é consultado em lugar nenhum. É campo que o próprio
//    usuário escreve pela API do Supabase; usá-lo para autorizar é o mesmo que
//    deixar a pessoa preencher o próprio crachá.
//
// Server-only: importa o cliente de service_role, que nunca pode ir ao
// navegador. O guarda em supabase-server.mjs derruba se isso acontecer.

export const CODIGO = Object.freeze({
  SEM_CONFIG: "sem_configuracao",
  SEM_SESSAO: "sessao_ausente",
  SESSAO_INVALIDA: "sessao_invalida",
  SEM_CADASTRO: "sem_cadastro",
  SEM_ACESSO_UNIDADE: "sem_acesso_a_unidade",
  PARAMETRO: "parametro_invalido",
});

const tokenDoPedido = (request) =>
  (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

// `data_scope = 'todos'` é o escopo de quem enxerga a rede inteira.
const ESCOPO_TOTAL = "todos";

/**
 * Só a sessão: devolve { db, usuario, authUserId } de quem está logado E tem
 * cadastro ativo no ERP, ou { erro }.
 *
 * Existe separado porque nem toda rota recebe a unidade na entrada — o
 * comprovante de ponto, por exemplo, descobre a unidade só depois de carregar
 * a marcação. Nesses casos: exigirSessao primeiro, carrega, depois
 * verificarAcessoAUnidade.
 */
export async function exigirSessao(request) {
  let db;
  try {
    db = getSupabaseServerClient();
  } catch {
    // Sem service_role o servidor não consegue nem verificar quem é quem.
    // Falha fechada: nada sai.
    return { erro: { codigo: CODIGO.SEM_CONFIG, status: 503,
      mensagem: "Servidor sem credencial para verificar a sessão. Configure SUPABASE_SERVICE_ROLE_KEY." } };
  }

  const token = tokenDoPedido(request);
  if (!token) {
    return { erro: { codigo: CODIGO.SEM_SESSAO, status: 401, mensagem: "Sessão ausente." } };
  }
  const { data: sessao, error: erroSessao } = await db.auth.getUser(token);
  if (erroSessao || !sessao?.user?.id) {
    return { erro: { codigo: CODIGO.SESSAO_INVALIDA, status: 401, mensagem: "Sessão inválida ou expirada." } };
  }
  const authUserId = sessao.user.id;

  // Sessão do Supabase sozinha não prova nada: alguém pode ter conta de
  // autenticação e nenhum vínculo com este ERP.
  const { data: usuario } = await db
    .from("usuarios_erp")
    .select("id, nome, unidade_id, status, super_admin")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!usuario || usuario.status !== "ativo") {
    return { erro: { codigo: CODIGO.SEM_CADASTRO, status: 403,
      mensagem: "Este login não tem cadastro ativo no ERP." } };
  }

  return { db, usuario, authUserId };
}

/**
 * Esta pessoa pode ver os dados desta unidade? Devolve { via } ou { erro }.
 * Consulta usuario_escopos e, como fallback, a unidade do próprio cadastro.
 */
export async function verificarAcessoAUnidade(db, usuario, unidadeId) {
  const unidade = String(unidadeId || "").trim();
  if (!unidade || unidade === "todas") {
    return { erro: { codigo: CODIGO.PARAMETRO, status: 400, mensagem: "Informe uma unidade específica." } };
  }
  if (usuario?.super_admin === true) return { via: "super_admin" };

  const { data: escopos } = await db
    .from("usuario_escopos")
    .select("unidade_id, data_scope")
    .eq("usuario_id", usuario.id);

  const lista = escopos || [];
  const veTudo = lista.some((e) => e.data_scope === ESCOPO_TOTAL);
  const naUnidade = lista.some((e) => String(e.unidade_id || "") === unidade);
  const unidadeDoCadastro = String(usuario.unidade_id || "") === unidade;

  if (!veTudo && !naUnidade && !unidadeDoCadastro) {
    // Mesma resposta para unidade de outra empresa e para unidade que não
    // existe: quem sonda não aprende nada com a diferença.
    return { erro: { codigo: CODIGO.SEM_ACESSO_UNIDADE, status: 403,
      mensagem: "Você não tem acesso aos dados desta unidade." } };
  }
  return { via: veTudo ? "escopo_todos" : naUnidade ? "escopo_unidade" : "unidade_do_cadastro" };
}

/**
 * As duas coisas, para as rotas que já recebem a unidade na entrada.
 * Devolve { db, usuario, authUserId, via } ou { erro }.
 */
export async function autorizarLeituraDaUnidade(request, unidadeId) {
  const sessao = await exigirSessao(request);
  if (sessao.erro) return sessao;

  const acesso = await verificarAcessoAUnidade(sessao.db, sessao.usuario, unidadeId);
  if (acesso.erro) return { erro: acesso.erro };

  return { ...sessao, via: acesso.via };
}
