import test from "node:test";
import assert from "node:assert/strict";

// O módulo é server-only e monta o cliente de service_role na importação do
// supabase-server. Aqui o que importa é a REGRA, então as consultas são
// dubladas e só a decisão é exercitada.
//
// Cenário fixo: Ana é da unidade A, Bruno é da B, Carla vê a rede toda,
// Dedé tem login mas está inativo no ERP, Eva tem sessão do Supabase e
// nenhum cadastro.

const USUARIOS = {
  "auth-ana":   { id: "u-ana",   nome: "Ana",   unidade_id: "A", status: "ativo",   super_admin: false },
  "auth-bruno": { id: "u-bruno", nome: "Bruno", unidade_id: "B", status: "ativo",   super_admin: false },
  "auth-carla": { id: "u-carla", nome: "Carla", unidade_id: "A", status: "ativo",   super_admin: false },
  "auth-dede":  { id: "u-dede",  nome: "Dedé",  unidade_id: "A", status: "inativo", super_admin: false },
  "auth-sofia": { id: "u-sofia", nome: "Sofia", unidade_id: null, status: "ativo",  super_admin: true },
};
const ESCOPOS = {
  "u-ana":   [{ unidade_id: "A", data_scope: "unidade" }],
  "u-bruno": [{ unidade_id: "B", data_scope: "unidade" }],
  "u-carla": [{ unidade_id: null, data_scope: "todos" }],
  "u-dede":  [{ unidade_id: "A", data_scope: "unidade" }],
  "u-sofia": [],
};

function dbFalso() {
  return {
    auth: {
      getUser: async (token) => (USUARIOS[token]
        ? { data: { user: { id: token } }, error: null }
        : { data: null, error: { message: "invalid" } }),
    },
    from(tabela) {
      const alvo = { tabela, filtros: {} };
      const api = {
        select: () => api,
        eq: (c, v) => { alvo.filtros[c] = v; return api; },
        maybeSingle: async () => ({ data: USUARIOS[alvo.filtros.auth_user_id] || null }),
        then: undefined,
      };
      // usuario_escopos é lido sem maybeSingle: a promise resolve na própria
      // chamada encadeada.
      if (tabela === "usuario_escopos") {
        api.eq = (c, v) => { alvo.filtros[c] = v; return Promise.resolve({ data: ESCOPOS[v] || [] }); };
      }
      return api;
    },
  };
}

const pedido = (token) => ({
  headers: { get: (h) => (h.toLowerCase() === "authorization" && token ? `Bearer ${token}` : null) },
});

// Injeta o db dublado sem carregar o supabase-server real.
const mod = await import("./autorizacao-unidade.mjs").catch(() => null);
const temModulo = Boolean(mod?.verificarAcessoAUnidade);

test("o módulo existe e exporta as três peças", () => {
  assert.ok(temModulo, "autorizacao-unidade.mjs não exportou verificarAcessoAUnidade");
  assert.equal(typeof mod.exigirSessao, "function");
  assert.equal(typeof mod.autorizarLeituraDaUnidade, "function");
});

test("F. quem é da unidade A não lê a unidade B", async () => {
  const db = dbFalso();
  const ana = USUARIOS["auth-ana"];
  assert.equal((await mod.verificarAcessoAUnidade(db, ana, "A")).via, "escopo_unidade");
  const negado = await mod.verificarAcessoAUnidade(db, ana, "B");
  assert.equal(negado.erro.status, 403);
  assert.equal(negado.erro.codigo, mod.CODIGO.SEM_ACESSO_UNIDADE);
});

test("escopo 'todos' abre a rede inteira; super_admin também", async () => {
  const db = dbFalso();
  assert.equal((await mod.verificarAcessoAUnidade(db, USUARIOS["auth-carla"], "B")).via, "escopo_todos");
  assert.equal((await mod.verificarAcessoAUnidade(db, USUARIOS["auth-sofia"], "Z")).via, "super_admin");
});

test("sem escopo explícito, vale a unidade do próprio cadastro", async () => {
  const db = dbFalso();
  const semEscopo = { id: "u-nova", unidade_id: "C", status: "ativo", super_admin: false };
  assert.equal((await mod.verificarAcessoAUnidade(db, semEscopo, "C")).via, "unidade_do_cadastro");
  assert.equal((await mod.verificarAcessoAUnidade(db, semEscopo, "D")).erro.status, 403);
});

test("parâmetro ausente ou 'todas' é 400, não 403", async () => {
  const db = dbFalso();
  const ana = USUARIOS["auth-ana"];
  for (const valor of [null, "", "   ", "todas"]) {
    const r = await mod.verificarAcessoAUnidade(db, ana, valor);
    assert.equal(r.erro.status, 400, `esperava 400 para ${JSON.stringify(valor)}`);
    assert.equal(r.erro.codigo, mod.CODIGO.PARAMETRO);
  }
});

test("nenhuma decisão consulta user_metadata", async () => {
  const fonte = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("./autorizacao-unidade.mjs", import.meta.url), "utf8"));
  // O termo só pode aparecer no comentário que explica por que NÃO é usado.
  const linhasComUso = fonte.split("\n")
    .filter((l) => l.includes("user_metadata") && !l.trim().startsWith("//"));
  assert.deepEqual(linhasComUso, []);
  assert.ok(fonte.includes("usuarios_erp") && fonte.includes("usuario_escopos"),
    "a autorização tem de sair das tabelas do servidor");
});

test("a ordem é sessão antes de parâmetro: quem não está logado recebe 401", async () => {
  // Sem token, nem chega a olhar a unidade — nem para dizer que faltou.
  const fonte = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("./autorizacao-unidade.mjs", import.meta.url), "utf8"));
  const posSessao = fonte.indexOf("SEM_SESSAO, status: 401");
  const posParam = fonte.indexOf("CODIGO.PARAMETRO, status: 400");
  assert.ok(posSessao > 0 && posParam > 0);
  assert.ok(posSessao < posParam, "a checagem de sessão tem de vir antes da de parâmetro");
});
