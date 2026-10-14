// CONEXÃO DO iFOOD POR UNIDADE — só no servidor.
//
// O dono cadastra Merchant ID, Client ID e Client Secret do aplicativo que
// ele criou no Portal do Desenvolvedor do iFood. O Client Secret:
//   - chega pela rota /api/ifood/conexao (sessão + unidade + permissão);
//   - é cifrado aqui com a chave do ambiente (INTEGRATION_MASTER_KEY) e só o
//     envelope cifrado vai ao banco (integration_secrets, sem acesso pelo
//     navegador);
//   - nunca volta para a tela, nem mascarado.
// "Conectado" só depois de um teste real: token no iFood + o Merchant ID
// aparecendo na lista de lojas que essas credenciais enxergam.
//
// Tudo que fala com fora (banco, cofre, iFood) entra por parâmetro, para os
// testes rodarem sem rede (ifood-conexao.test.mjs).

export const PROVEDOR = "IFOOD";
export const IFOOD_API = "https://merchant-api.ifood.com.br";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MSG = Object.freeze({
  SEM_TABELAS: "O banco ainda não tem as tabelas de integração (IFOOD-1). Avise o administrador.",
  SEM_COFRE: "O servidor ainda não tem a chave do cofre (INTEGRATION_MASTER_KEY). Sem ela o Client Secret não pode ser guardado com segurança.",
  SEM_CADASTRO: "Cadastre o Merchant ID, o Client ID e o Client Secret antes de testar.",
});

const tabelaAusente = (e) => /does not exist|schema cache|could not find the table|relation .*integration_/i.test(String(e?.message || e || ""));

export function mascarar(valor) {
  const v = String(valor || "");
  if (!v) return "";
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export function validarCadastro({ merchantId, clientId, clientSecret } = {}, { temSegredoSalvo = false } = {}) {
  const erros = [];
  const m = String(merchantId || "").trim();
  const c = String(clientId || "").trim();
  const s = String(clientSecret || "");
  if (!UUID.test(m)) erros.push("Merchant ID inválido: é um código no formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (Portal do Parceiro → Loja).");
  if (c.length < 8 || /\s/.test(c)) erros.push("Client ID inválido: copie do aplicativo no Portal do Desenvolvedor do iFood.");
  if (!s && !temSegredoSalvo) erros.push("Informe o Client Secret.");
  if (s && (s.length < 8 || /\s/.test(s))) erros.push("Client Secret inválido: copie de novo, sem espaços.");
  return erros;
}

async function ler(db, unidadeId) {
  const [conn, sec] = await Promise.all([
    db.from("integration_connections").select("*").eq("unidade_id", unidadeId).eq("provider", PROVEDOR).maybeSingle(),
    db.from("integration_secrets").select("credentials_payload, updated_at").eq("unidade_id", unidadeId).eq("provider", PROVEDOR).maybeSingle(),
  ]);
  const erro = conn.error || sec.error;
  if (erro) return { erro: tabelaAusente(erro) ? MSG.SEM_TABELAS : erro.message, semTabelas: tabelaAusente(erro) };
  return { conn: conn.data || null, sec: sec.data || null };
}

/** Situação para a tela. Nunca devolve segredo. */
export async function lerConexao(db, unidadeId, { cofreConfigurado = false } = {}) {
  const r = await ler(db, unidadeId);
  if (r.erro) return { ok: false, erro: r.erro, semTabelas: !!r.semTabelas, cofreConfigurado };
  const { conn, sec } = r;
  return {
    ok: true,
    cofreConfigurado,
    status: conn?.status || "NOT_CONFIGURED",
    merchantId: conn?.external_merchant_id || "",
    clientIdMascarado: mascarar(conn?.config_json?.clientId),
    temClientId: !!conn?.config_json?.clientId,
    temSegredo: !!sec?.credentials_payload?.isEncrypted,
    lojaNome: conn?.config_json?.lojaNome || null,
    ultimoTeste: conn?.config_json?.ultimoTeste || null,
    ultimoErro: conn?.last_error || null,
    atualizadoEm: conn?.updated_at || null,
  };
}

/**
 * Grava o cadastro. Client Secret vazio = mantém o que já está guardado.
 * Qualquer mudança volta o estado para "não verificado" até novo teste.
 */
export async function salvarConexao(db, unidadeId, dados = {}, { cifrar, cofreConfigurado = false, quem = null, agora = () => new Date().toISOString() } = {}) {
  const r = await ler(db, unidadeId);
  if (r.erro) return { ok: false, erro: r.erro };
  const temSegredoSalvo = !!r.sec?.credentials_payload?.isEncrypted;
  const clientIdAtual = r.conn?.config_json?.clientId || "";
  const merchantId = String(dados.merchantId || "").trim().toLowerCase();
  // Client ID vazio na tela = manter o salvo (a tela só mostra mascarado)
  const clientId = String(dados.clientId || "").trim() || clientIdAtual;
  const clientSecret = String(dados.clientSecret || "");
  const trocouClientId = clientIdAtual && clientId !== clientIdAtual;
  if (trocouClientId && !clientSecret) return { ok: false, erro: "Trocou o Client ID: informe também o Client Secret desse aplicativo." };
  const erros = validarCadastro({ merchantId, clientId, clientSecret }, { temSegredoSalvo });
  if (erros.length) return { ok: false, erro: erros.join(" ") };

  if (clientSecret) {
    if (!cofreConfigurado || typeof cifrar !== "function") return { ok: false, erro: MSG.SEM_COFRE };
    const envelope = cifrar({ clientSecret });
    if (!envelope?.isEncrypted) return { ok: false, erro: MSG.SEM_COFRE };
    const s = await db.from("integration_secrets").upsert({
      unidade_id: unidadeId, provider: PROVEDOR, credentials_payload: envelope, security_state: "ENCRYPTED", updated_at: agora(),
    }, { onConflict: "unidade_id,provider" });
    if (s.error) return { ok: false, erro: s.error.message };
  }
  const c = await db.from("integration_connections").upsert({
    unidade_id: unidadeId, provider: PROVEDOR, auth_flow: "CENTRALIZED", external_merchant_id: merchantId,
    status: "CONFIGURED_UNVERIFIED", last_error: null,
    config_json: { clientId, atualizadoPor: quem, atualizadoEm: agora() },
    updated_at: agora(),
  }, { onConflict: "unidade_id,provider" });
  if (c.error) return { ok: false, erro: c.error.message };
  // até o teste passar, a unidade não aparece como conectada em lugar nenhum
  await db.from("unidades").update({ ifood_conectado: false, ifood_merchant_id: merchantId }).eq("id", unidadeId);
  return { ok: true };
}

/** Chamadas reais ao iFood (injetável). Token por client_credentials e lista de lojas. */
export function clienteIfood(fetchFn = fetch, base = IFOOD_API) {
  // Token + validade. A documentação manda reaproveitar o token até perto de
  // expirar; sem `expiresIn` na resposta, vale 1 h (conservador).
  async function autenticar(clientId, clientSecret) {
    const res = await fetchFn(`${base}/authentication/v1.0/oauth/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grantType: "client_credentials", clientId, clientSecret }).toString(),
    });
    if (!res.ok) {
      const e = new Error(res.status === 401 || res.status === 400 ? "O iFood recusou o Client ID ou o Client Secret." : `O iFood respondeu com erro ${res.status} ao autenticar.`);
      e.http = res.status;
      throw e;
    }
    const d = await res.json();
    const t = d.accessToken || d.access_token;
    if (!t) throw new Error("O iFood não devolveu o token de acesso.");
    const seg = Number(d.expiresIn || d.expires_in) > 0 ? Number(d.expiresIn || d.expires_in) : 3600;
    return { token: t, expiraEm: Date.now() + seg * 1000 };
  }
  return {
    autenticar,
    async token(clientId, clientSecret) { return (await autenticar(clientId, clientSecret)).token; },
    async lojas(token) {
      const res = await fetchFn(`${base}/merchant/v1.0/merchants`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status === 403 ? "As credenciais não têm permissão para listar lojas (módulo Merchant)." : `O iFood respondeu com erro ${res.status} ao listar as lojas.`);
      const d = await res.json();
      return (Array.isArray(d) ? d : d?.data || []).map((m) => ({ id: String(m.id || ""), nome: m.name || m.corporateName || "Loja" }));
    },
  };
}

/** Teste real. Só marca CONNECTED se o Merchant ID estiver entre as lojas que as credenciais enxergam. */
export async function testarConexao(db, unidadeId, { decifrar, ifood, agora = () => new Date().toISOString() } = {}) {
  const r = await ler(db, unidadeId);
  if (r.erro) return { ok: false, erro: r.erro };
  const { conn, sec } = r;
  const clientId = conn?.config_json?.clientId;
  const merchantId = conn?.external_merchant_id;
  if (!conn || !clientId || !merchantId || !sec?.credentials_payload?.isEncrypted) return { ok: false, erro: MSG.SEM_CADASTRO };

  let resultado;
  try {
    const { clientSecret } = decifrar(sec.credentials_payload) || {};
    if (!clientSecret) throw new Error("Não foi possível abrir o Client Secret guardado: cadastre de novo.");
    const token = await ifood.token(clientId, clientSecret);
    const lojas = await ifood.lojas(token);
    const loja = lojas.find((l) => l.id.toLowerCase() === String(merchantId).toLowerCase());
    resultado = loja
      ? { ok: true, status: "CONNECTED", mensagem: `Conectado à loja "${loja.nome}".`, loja }
      : { ok: false, status: "ERROR", mensagem: lojas.length
        ? `As credenciais funcionam, mas o Merchant ID informado não está entre as ${lojas.length} loja(s) liberadas para este aplicativo. Confira o ID ou libere a loja no Portal do Parceiro.`
        : "As credenciais funcionam, mas nenhuma loja está liberada para este aplicativo. Vincule a loja no Portal do Parceiro do iFood." };
  } catch (e) {
    resultado = { ok: false, status: e.http === 401 || e.http === 400 ? "AUTH_EXPIRED" : "ERROR", mensagem: e.message || "Falha ao falar com o iFood." };
  }

  const quando = agora();
  await db.from("integration_connections").update({
    status: resultado.status, last_error: resultado.ok ? null : resultado.mensagem, updated_at: quando,
    config_json: { ...(conn.config_json || {}), ultimoTeste: quando, lojaNome: resultado.loja?.nome || null },
  }).eq("unidade_id", unidadeId).eq("provider", PROVEDOR);
  await db.from("unidades").update({ ifood_conectado: resultado.ok }).eq("id", unidadeId);
  return { ok: resultado.ok, status: resultado.status, mensagem: resultado.mensagem };
}

/** Desconectar: apaga o segredo guardado (é do dono) e marca a conexão como desligada. */
export async function desconectar(db, unidadeId, { agora = () => new Date().toISOString() } = {}) {
  const r = await ler(db, unidadeId);
  if (r.erro) return { ok: false, erro: r.erro };
  await db.from("integration_secrets").delete().eq("unidade_id", unidadeId).eq("provider", PROVEDOR);
  if (r.conn) {
    await db.from("integration_connections").update({ status: "DISABLED", last_error: null, updated_at: agora() })
      .eq("unidade_id", unidadeId).eq("provider", PROVEDOR);
  }
  await db.from("unidades").update({ ifood_conectado: false }).eq("id", unidadeId);
  return { ok: true };
}
