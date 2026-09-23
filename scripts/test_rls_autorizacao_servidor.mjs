/* Prova, num Postgres local descartável, que o hotfix de autorização fecha a
   escalada de privilégio que as funções antigas permitiam.

   Nada aqui toca banco de verdade: sobe um Postgres em memória (PGlite), monta
   um esqueleto de usuarios_erp/usuario_escopos, instala primeiro as funções
   ANTIGAS (para o teste mostrar o furo) e depois as do hotfix.

   Uso: node scripts/test_rls_autorizacao_servidor.mjs <caminho do @electric-sql/pglite>
*/
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const PGLITE = process.argv[2];
if (!PGLITE) {
  console.error("Informe o caminho do pacote @electric-sql/pglite.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(PGLITE, "dist/index.js")).href);
const db = await PGlite.create();

const ANTIGO = path.join(RAIZ, "db", "rollback_rls_autorizacao_servidor.sql");
const HOTFIX = path.join(RAIZ, "db", "migracao_rls_autorizacao_servidor.sql");

let falhas = 0;
const conferir = (titulo, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${titulo}${ok ? "" : `\n      esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
};

/* ── Esqueleto: papéis do Supabase, auth.uid()/auth.jwt() e o cadastro ────── */
await db.exec(`
  create role authenticated;
  create role service_role;
  create role anon;
  create schema auth;

  /* auth.uid() e auth.jwt() controlados pelo teste, como no Supabase */
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('teste.uid', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('teste.jwt', true), '')::jsonb, '{}'::jsonb)
  $$;

  create table unidades (id text primary key, nome text);
  insert into unidades values ('seldeestrela','Seldeestrela'), ('burguer','Burguer');

  create table usuarios_erp (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique,
    nome text not null,
    login text not null unique,
    unidade_principal_id text references unidades(id),
    status text not null default 'ativo',
    tipo_acesso text not null default 'funcionario',
    super_admin boolean not null default false
  );
  create table usuario_escopos (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references usuarios_erp(id) on delete cascade,
    unidade_id text references unidades(id),
    data_scope text not null default 'setor'
  );
`);

const UIDS = {
  gerente: "11111111-1111-1111-1111-111111111111",
  dono: "22222222-2222-2222-2222-222222222222",
  financeiro: "33333333-3333-3333-3333-333333333333",
  bloqueado: "44444444-4444-4444-4444-444444444444",
  doisEscopos: "55555555-5555-5555-5555-555555555555",
  forasteiro: "99999999-9999-9999-9999-999999999999",
};

await db.exec(`
  insert into usuarios_erp (auth_user_id, nome, login, unidade_principal_id, status, tipo_acesso, super_admin) values
    ('${UIDS.gerente}',    'Gerente',    'gerente',    'seldeestrela', 'ativo',     'gerente',       false),
    ('${UIDS.dono}',       'Dono',       'dono',       null,           'ativo',     'administrador', true),
    ('${UIDS.financeiro}', 'Financeiro', 'financeiro', null,           'ativo',     'funcionario',   false),
    ('${UIDS.bloqueado}',  'Bloqueado',  'bloqueado',  'seldeestrela', 'bloqueado', 'gerente',       false),
    ('${UIDS.doisEscopos}','Dois',       'dois',       null,           'ativo',     'supervisor',    false);

  insert into usuario_escopos (usuario_id, unidade_id, data_scope)
    select id, null, 'todos' from usuarios_erp where login = 'financeiro';
  insert into usuario_escopos (usuario_id, unidade_id, data_scope)
    select id, 'burguer', 'unidade' from usuarios_erp where login = 'dois';
  insert into usuario_escopos (usuario_id, unidade_id, data_scope)
    select id, 'seldeestrela', 'unidade' from usuarios_erp where login = 'dois';
`);

/* Sessão do teste: quem está logado e o que ele mandou no metadata do JWT. */
async function entrar(uid, metadata = {}) {
  await db.exec(`select set_config('teste.uid', '${uid || ""}', false);`);
  await db.exec(`select set_config('teste.jwt', '${JSON.stringify({ user_metadata: metadata }).replace(/'/g, "''")}', false);`);
}
async function estado() {
  const r = await db.query("select auth_papel() as papel, auth_unidade_id() as unidade, pode_ver_todas() as ve_todas");
  return r.rows[0];
}

/* ── 1. Versão ANTIGA: o furo existe mesmo ────────────────────────────────── */
console.log("\nANTES DO HOTFIX (funções lendo user_metadata)");
await db.exec(fs.readFileSync(ANTIGO, "utf8").replace(/grant execute[\s\S]*?;/g, ""));

await entrar(UIDS.gerente, { papel: "gerente", unidade: "seldeestrela" });
conferir("gerente honesto vê só a unidade dele", await estado(), { papel: "gerente", unidade: "seldeestrela", ve_todas: false });

await entrar(UIDS.gerente, { papel: "admin", unidade: "seldeestrela" });
conferir("ESCALADA: o mesmo gerente se declara admin e passa a ver tudo", await estado(), { papel: "admin", unidade: "seldeestrela", ve_todas: true });

await entrar(UIDS.forasteiro, {});
conferir("ESCALADA: login sem metadata nenhum já vê tudo", await estado(), { papel: "", unidade: "", ve_todas: true });

await entrar(UIDS.gerente, { papel: "gerente", unidade: "todas" });
conferir("ESCALADA: unidade 'todas' vira string vazia e libera tudo", await estado(), { papel: "gerente", unidade: "", ve_todas: true });

/* ── 2. Versão do HOTFIX ──────────────────────────────────────────────────── */
console.log("\nDEPOIS DO HOTFIX (funções lendo usuarios_erp/usuario_escopos)");
await db.exec(fs.readFileSync(HOTFIX, "utf8"));

await entrar(UIDS.gerente, { papel: "gerente", unidade: "seldeestrela" });
conferir("gerente honesto continua igual", await estado(), { papel: "gerente", unidade: "seldeestrela", ve_todas: false });

await entrar(UIDS.gerente, { papel: "admin", unidade: "todas" });
conferir("metadata forjado não muda mais nada", await estado(), { papel: "gerente", unidade: "seldeestrela", ve_todas: false });

await entrar(UIDS.forasteiro, { papel: "admin", unidade: "todas" });
conferir("login sem cadastro no ERP fica fechado", await estado(), { papel: "", unidade: "", ve_todas: false });

await entrar(UIDS.dono, {});
conferir("super_admin vê todas as unidades", await estado(), { papel: "admin", unidade: "", ve_todas: true });

await entrar(UIDS.financeiro, {});
conferir("escopo 'todos' vê todas as unidades", await estado(), { papel: "funcionario", unidade: "", ve_todas: true });

await entrar(UIDS.bloqueado, { papel: "admin", unidade: "todas" });
conferir("usuário bloqueado não vê nada", await estado(), { papel: "", unidade: "", ve_todas: false });

await entrar(UIDS.doisEscopos, {});
conferir("sem unidade principal, cai no primeiro escopo (sempre o mesmo)", await estado(), { papel: "supervisor", unidade: "burguer", ve_todas: false });

/* ── 3. O código das funções não pode mais citar o JWT ────────────────────── */
const fontes = await db.query(`
  select proname, prosrc ilike '%user_metadata%' as le_jwt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and proname in ('auth_papel','auth_unidade_id','pode_ver_todas')
  order by 1
`);
conferir("nenhuma das três lê user_metadata", fontes.rows, [
  { proname: "auth_papel", le_jwt: false },
  { proname: "auth_unidade_id", le_jwt: false },
  { proname: "pode_ver_todas", le_jwt: false },
]);

/* ── 4. Rodar de novo não muda nada (idempotência) ────────────────────────── */
await db.exec(fs.readFileSync(HOTFIX, "utf8"));
await entrar(UIDS.gerente, { papel: "admin", unidade: "todas" });
conferir("rodar a migração duas vezes dá o mesmo resultado", await estado(), { papel: "gerente", unidade: "seldeestrela", ve_todas: false });

console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTodas as verificações passaram.");
await db.close();
process.exit(falhas ? 1 : 0);
