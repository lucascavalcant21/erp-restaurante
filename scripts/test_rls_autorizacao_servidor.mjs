/* Prova, num Postgres local descartável, que a autorização do Héfisto fecha as
   escaladas conhecidas. Classificação: UNIT_TESTED (PGlite), não STAGING.

   Nada aqui toca banco de verdade: sobe um Postgres em memória (PGlite), monta
   um esqueleto de empresas/unidades/usuarios_erp/usuario_escopos como o do
   RBAC, instala primeiro as funções ANTIGAS (para o teste mostrar o furo) e
   depois o hotfix, e por fim aplica a proposta de proteção das tabelas.

   Uso: node scripts/test_rls_autorizacao_servidor.mjs <caminho do @electric-sql/pglite>

   A última linha diz RESULTADO: OK ou RESULTADO: FALHOU. É por ela que se
   confere — no Windows o PGlite suja o código de saída ao encerrar.
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
const PROTECAO = path.join(RAIZ, "db", "security", "0002_proteger_tabelas_autorizacao.sql");

let total = 0, falhas = 0;
const conferir = (titulo, obtido, esperado) => {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${titulo}${ok ? "" : `\n      esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
};

/* ── Esqueleto: papéis do Supabase, auth.uid()/auth.jwt() e o cadastro ────── */
await db.exec(`
  create role authenticated;
  create role service_role bypassrls;
  create role anon;
  create schema auth;

  /* auth.uid() e auth.jwt() controlados pelo teste, como no Supabase */
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('teste.uid', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('teste.jwt', true), '')::jsonb, '{}'::jsonb)
  $$;
  grant usage on schema auth to authenticated, service_role, anon;
  grant execute on function auth.uid() to authenticated, service_role, anon;
  grant execute on function auth.jwt() to authenticated, service_role, anon;
  grant usage on schema public to authenticated, service_role, anon;

  create table empresas (id uuid primary key default gen_random_uuid(), nome text not null);
  insert into empresas (id, nome) values
    ('aaaa0000-0000-0000-0000-00000000000a','Empresa A'),
    ('bbbb0000-0000-0000-0000-00000000000b','Empresa B');

  create table unidades (
    id text primary key,
    nome text,
    empresa_id uuid references empresas(id)
  );
  insert into unidades values
    ('A','Loja A','aaaa0000-0000-0000-0000-00000000000a'),
    ('B','Loja B','aaaa0000-0000-0000-0000-00000000000a'),
    ('C','Loja C','bbbb0000-0000-0000-0000-00000000000b');

  create table perfis_acesso (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    permissoes jsonb not null default '[]'::jsonb
  );
  create table usuarios_erp (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique,
    nome text not null,
    login text not null unique,
    unidade_principal_id text references unidades(id),
    perfil_id uuid references perfis_acesso(id),
    status text not null default 'ativo',
    tipo_acesso text not null default 'funcionario',
    super_admin boolean not null default false
  );
  create table usuario_escopos (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references usuarios_erp(id) on delete cascade,
    empresa_id uuid references empresas(id),
    unidade_id text references unidades(id),
    data_scope text not null default 'setor'
  );
  create table permissoes_auditoria (id uuid primary key default gen_random_uuid(), evento text);
  insert into perfis_acesso (nome, permissoes) values ('Somente consulta', '["dashboard.overview.view"]'::jsonb);

  /* Como está hoje em produção, segundo db/migracao_controle_acesso.sql:
     RLS ligado e uma policy de SELECT liberando tudo para quem está logado. */
  grant select, insert, update, delete on perfis_acesso, usuarios_erp, usuario_escopos, permissoes_auditoria to authenticated;
  grant all on perfis_acesso, usuarios_erp, usuario_escopos, permissoes_auditoria, unidades, empresas to service_role;
  grant select on unidades, empresas to authenticated;
  alter table perfis_acesso enable row level security;
  alter table usuarios_erp enable row level security;
  alter table usuario_escopos enable row level security;
  alter table permissoes_auditoria enable row level security;
  create policy usuarios_erp_leitura on usuarios_erp for select to authenticated using (true);
  create policy usuario_escopos_leitura on usuario_escopos for select to authenticated using (true);
  create policy perfis_acesso_leitura on perfis_acesso for select to authenticated using (true);
  create policy permissoes_auditoria_leitura on permissoes_auditoria for select to authenticated using (true);
`);

const UIDS = {
  soA: "11111111-1111-1111-1111-111111111111",
  AeB: "22222222-2222-2222-2222-222222222222",
  dono: "33333333-3333-3333-3333-333333333333",
  rede: "44444444-4444-4444-4444-444444444444",
  empresaA: "55555555-5555-5555-5555-555555555555",
  bloqueado: "66666666-6666-6666-6666-666666666666",
  forasteiro: "99999999-9999-9999-9999-999999999999",
};

await db.exec(`
  insert into usuarios_erp (auth_user_id, nome, login, unidade_principal_id, status, tipo_acesso, super_admin) values
    ('${UIDS.soA}',      'So A',      'soa',      'A',  'ativo',     'gerente',       false),
    ('${UIDS.AeB}',      'A e B',     'aeb',      'A',  'ativo',     'supervisor',    false),
    ('${UIDS.dono}',     'Dono',      'dono',     null, 'ativo',     'administrador', true),
    ('${UIDS.rede}',     'Rede',      'rede',     null, 'ativo',     'funcionario',   false),
    ('${UIDS.empresaA}', 'Empresa A', 'empresaa', null, 'ativo',     'gerente',       false),
    ('${UIDS.bloqueado}','Bloqueado', 'bloq',     'A',  'bloqueado', 'gerente',       false);

  /* quem atende duas lojas */
  insert into usuario_escopos (usuario_id, unidade_id, data_scope)
    select id, 'B', 'unidade' from usuarios_erp where login = 'aeb';
  /* visão de rede inteira */
  insert into usuario_escopos (usuario_id, data_scope)
    select id, 'todos' from usuarios_erp where login = 'rede';
  /* escopo de empresa: só as lojas da Empresa A */
  insert into usuario_escopos (usuario_id, empresa_id, data_scope)
    select id, 'aaaa0000-0000-0000-0000-00000000000a', 'empresa' from usuarios_erp where login = 'empresaa';
`);

async function entrar(uid, metadata = {}) {
  await db.exec(`select set_config('teste.uid', '${uid || ""}', false);`);
  await db.exec(`select set_config('teste.jwt', '${JSON.stringify({ user_metadata: metadata }).replace(/'/g, "''")}', false);`);
}
async function estado() {
  const r = await db.query("select auth_papel() as papel, auth_unidade_id() as unidade, pode_ver_todas() as ve_todas");
  return r.rows[0];
}
async function podeVer(uid, unidade) {
  const r = await db.query("select hefisto_user_in_unit_strict($1::uuid, $2::text) as pode", [uid, unidade]);
  return r.rows[0].pode;
}
/* Executa algo como um papel do Supabase e devolve "ok" ou o código do erro. */
async function comoPapel(papel, sql) {
  try {
    await db.exec(`set role ${papel};`);
    await db.exec(sql);
    return "ok";
  } catch (e) {
    return String(e?.message || e).slice(0, 60);
  } finally {
    await db.exec("reset role;");
  }
}
const contouLinhas = async (papel, sql) => {
  await db.exec(`set role ${papel};`);
  const r = await db.query(sql);
  await db.exec("reset role;");
  return r.rows.length;
};
/* O que interessa numa tentativa de escrita é o EFEITO, não se deu erro.
   UPDATE sem policy de UPDATE não estoura: ele simplesmente não acha linha
   nenhuma para alterar. INSERT sem policy, esse sim, estoura. */
async function tentouEscrever(papel, sqlEscrita, sqlConferencia) {
  await comoPapel(papel, sqlEscrita);
  const r = await db.query(sqlConferencia);
  return r.rows[0]?.mudou === true || r.rows[0]?.mudou === "t" ? "MUDOU" : "sem efeito";
}

/* ── 1. Versão ANTIGA: o furo existe mesmo ────────────────────────────────── */
console.log("\nANTES DO HOTFIX (funções lendo user_metadata)");
await db.exec(fs.readFileSync(ANTIGO, "utf8").replace(/grant execute[\s\S]*?;/g, "").replace(/drop function[\s\S]*?;/g, ""));

await entrar(UIDS.soA, { papel: "gerente", unidade: "A" });
conferir("gerente honesto vê só a unidade dele", await estado(), { papel: "gerente", unidade: "A", ve_todas: false });
await entrar(UIDS.soA, { papel: "admin", unidade: "A" });
conferir("ESCALADA: o mesmo gerente se declara admin e passa a ver tudo", await estado(), { papel: "admin", unidade: "A", ve_todas: true });
await entrar(UIDS.forasteiro, {});
conferir("ESCALADA: login sem metadata nenhum já vê tudo", await estado(), { papel: "", unidade: "", ve_todas: true });
await entrar(UIDS.soA, { papel: "gerente", unidade: "todas" });
conferir("ESCALADA: unidade 'todas' vira string vazia e libera tudo", await estado(), { papel: "gerente", unidade: "", ve_todas: true });
await entrar(UIDS.soA, { papel: "gerente", unidade: "B" });
conferir("ESCALADA: metadata aponta para a loja B e a função obedece", await estado(), { papel: "gerente", unidade: "B", ve_todas: false });

/* ── 2. Hotfix aplicado ───────────────────────────────────────────────────── */
console.log("\nDEPOIS DO HOTFIX (cadastro do servidor manda)");
await db.exec(fs.readFileSync(HOTFIX, "utf8"));

/* 1 e 2 — metadata forjado não escala */
await entrar(UIDS.soA, { papel: "admin", unidade: "todas" });
conferir("1. metadata papel=admin não escala", await estado(), { papel: "gerente", unidade: "A", ve_todas: false });
conferir("2. metadata unidade=todas não escala", await podeVer(UIDS.soA, "B"), false);
/* 3 — metadata apontando para outra loja não dá acesso a ela */
await entrar(UIDS.soA, { papel: "gerente", unidade: "B" });
conferir("3. metadata unidade=B não ganha a loja B", [(await estado()).unidade, await podeVer(UIDS.soA, "B")], ["A", false]);
/* 4 — sem cadastro */
await entrar(UIDS.forasteiro, { papel: "admin", unidade: "todas" });
conferir("4. login sem cadastro não tem acesso nenhum", [await estado(), await podeVer(UIDS.forasteiro, "A")], [{ papel: "", unidade: "", ve_todas: false }, false]);
/* 5 — inativo */
await entrar(UIDS.bloqueado, { papel: "admin" });
conferir("5. usuário bloqueado não tem acesso nenhum", [await estado(), await podeVer(UIDS.bloqueado, "A")], [{ papel: "", unidade: "", ve_todas: false }, false]);
/* 6 — uma unidade */
conferir("6. usuário da loja A: A sim, B não", [await podeVer(UIDS.soA, "A"), await podeVer(UIDS.soA, "B")], [true, false]);
/* 7 — multiunidade de verdade */
conferir("7. usuário de A e B: A sim, B sim, C não", [await podeVer(UIDS.AeB, "A"), await podeVer(UIDS.AeB, "B"), await podeVer(UIDS.AeB, "C")], [true, true, false]);
/* 8 — nulos */
conferir("8. unidade nula e usuário nulo devolvem false", [await podeVer(UIDS.soA, null), await podeVer(null, "A"), await podeVer(null, null)], [false, false, false]);
/* 12 — empresa não é global */
conferir("12. escopo de empresa alcança A e B da mesma empresa, nunca a C", [await podeVer(UIDS.empresaA, "A"), await podeVer(UIDS.empresaA, "B"), await podeVer(UIDS.empresaA, "C")], [true, true, false]);
/* 13 — super admin e escopo 'todos' */
conferir("13. super_admin verdadeiro alcança todas as lojas", [await podeVer(UIDS.dono, "A"), await podeVer(UIDS.dono, "C")], [true, true]);
conferir("13b. escopo 'todos' alcança todas as lojas", [await podeVer(UIDS.rede, "A"), await podeVer(UIDS.rede, "C")], [true, true]);

/* ── 3. As tabelas de autorização, como estão hoje ────────────────────────── */
console.log("\nTABELAS DE AUTORIZAÇÃO (estado atual: RLS ligado, SELECT liberado)");
await entrar(UIDS.soA, {});
conferir("9. usuário comum não consegue se promover em usuarios_erp",
  await tentouEscrever("authenticated",
    `update usuarios_erp set super_admin = true, tipo_acesso = 'administrador' where auth_user_id = '${UIDS.soA}'`,
    `select bool_or(super_admin) as mudou from usuarios_erp where auth_user_id = '${UIDS.soA}'`),
  "sem efeito");
conferir("10. usuário comum não consegue criar escopo para si",
  await tentouEscrever("authenticated",
    `insert into usuario_escopos (usuario_id, data_scope) select id, 'todos' from usuarios_erp where auth_user_id = '${UIDS.soA}'`,
    `select exists (select 1 from usuario_escopos e join usuarios_erp u on u.id = e.usuario_id where u.auth_user_id = '${UIDS.soA}') as mudou`),
  "sem efeito");
conferir("11. usuário comum não consegue mudar data_scope",
  await tentouEscrever("authenticated",
    `update usuario_escopos set data_scope = 'todos'`,
    `select count(*) > 1 as mudou from usuario_escopos where data_scope = 'todos'`),
  "sem efeito");
conferir("11b. usuário comum não consegue alterar perfil/permissões",
  await tentouEscrever("authenticated",
    `update perfis_acesso set permissoes = '["*"]'::jsonb`,
    `select bool_or(permissoes = '["*"]'::jsonb) as mudou from perfis_acesso`),
  "sem efeito");
conferir("11c. usuário comum não consegue apagar o próprio bloqueio",
  await tentouEscrever("authenticated",
    `update usuarios_erp set status = 'ativo' where auth_user_id = '${UIDS.bloqueado}'`,
    `select bool_or(status = 'ativo') as mudou from usuarios_erp where auth_user_id = '${UIDS.bloqueado}'`),
  "sem efeito");
/* O buraco que sobra hoje: ele LÊ o cadastro inteiro. */
conferir("ACHADO: hoje o usuário comum lê o cadastro inteiro (6 usuários)", await contouLinhas("authenticated", "select id from usuarios_erp"), 6);
/* 16 — o backend legítimo continua operando */
conferir("16. service_role continua escrevendo (é por ele que a rota administra)",
  await comoPapel("service_role", `update usuarios_erp set tipo_acesso = 'gerente' where auth_user_id = '${UIDS.soA}'`), "ok");

/* ── 4. Com a proteção proposta aplicada ──────────────────────────────────── */
console.log("\nCOM db/security/0002 APLICADA (proposta, ainda não rodada em lugar nenhum)");
await db.exec(fs.readFileSync(PROTECAO, "utf8"));
await entrar(UIDS.soA, {});
conferir("depois de 0002 o usuário comum só enxerga a própria linha", await contouLinhas("authenticated", "select id from usuarios_erp"), 1);
conferir("depois de 0002 continua sem conseguir escrever",
  (await comoPapel("authenticated", `update usuarios_erp set super_admin = true where auth_user_id = '${UIDS.soA}'`)).startsWith("ok") ? "ESCREVEU" : "bloqueado", "bloqueado");
conferir("depois de 0002 o service_role segue operando",
  await comoPapel("service_role", `update usuarios_erp set tipo_acesso = 'gerente' where auth_user_id = '${UIDS.soA}'`), "ok");
conferir("depois de 0002 o contexto de sessão do próprio usuário continua de pé",
  (await db.query(`select (hefisto_user_in_unit_strict('${UIDS.soA}','A')) as ok`)).rows[0].ok, true);

/* ── 5. Higiene do código das funções ─────────────────────────────────────── */
const fontes = await db.query(`
  select proname, prosrc ilike '%user_metadata%' as le_jwt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and proname in ('auth_papel','auth_unidade_id','pode_ver_todas','hefisto_user_in_unit_strict','hefisto_user_in_company')
  order by 1
`);
conferir("nenhuma função de autorização lê user_metadata", fontes.rows.map(r => r.le_jwt), [false, false, false, false, false]);

/* Rodar de novo não muda nada. */
await db.exec(fs.readFileSync(HOTFIX, "utf8"));
await entrar(UIDS.soA, { papel: "admin", unidade: "todas" });
conferir("rodar a migração duas vezes dá o mesmo resultado", await estado(), { papel: "gerente", unidade: "A", ve_todas: false });

console.log(`\n${total - falhas}/${total} verificações passaram.`);
/* No Windows o PGlite dispara uma asserção do libuv ao encerrar e o código de
   saída sai sujo, com ou sem db.close(). Quem automatizar isto deve olhar a
   linha RESULTADO abaixo, não o exit code. */
console.log(falhas ? "RESULTADO: FALHOU" : "RESULTADO: OK");
process.exit(falhas ? 1 : 0);
