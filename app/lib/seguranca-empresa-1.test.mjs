// SEC-EMPRESA-1: isolamento entre empresas nas funções de permissão.
// SQL REAL no PGlite. O "hoje" é montado pelo próprio arquivo de rollback
// (que traz os textos exatos lidos do banco real); o preflight da migração
// confere por hash que é o mesmo texto. Duas empresas, papéis anon,
// authenticated e service_role, e o antes/depois/rollback.
//   PGLITE=… node --test app/lib/seguranca-empresa-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f) => fs.readFileSync(path.join(raiz, "db", "security", f), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

const U = {
  superA: "00000000-0000-0000-0000-00000000aa01",
  gerA: "00000000-0000-0000-0000-00000000aa02",   // unidade a1 + escopo "empresa" sem empresa_id
  todosA: "00000000-0000-0000-0000-00000000aa03", // escopo "todos" sem empresa_id
  funcA: "00000000-0000-0000-0000-00000000aa04",  // só a1
  travado: "00000000-0000-0000-0000-00000000aa05",
  funcB: "00000000-0000-0000-0000-00000000bb01",  // só b1 (outra empresa)
  adminB: "00000000-0000-0000-0000-00000000bb02", // unidade b1 + escopo empresa B (com empresa_id)
};

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.empresas (id text primary key);
    create table public.unidades (id text primary key, empresa_id text references public.empresas(id), nome text);
    create table public.perfis_acesso (id uuid primary key default gen_random_uuid(), codigo text);
    create table public.perfil_permissoes (perfil_id uuid, permission_key text);
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, status text default 'ativo',
      super_admin boolean default false, perfil_id uuid, unidade_principal_id text, locked_until timestamptz, valid_from timestamptz,
      valid_until timestamptz, timezone text, allowed_days smallint[], allowed_start_time time, allowed_end_time time,
      exigir_troca_senha boolean, senha_alterada_em timestamptz, failed_attempts int);
    create table public.usuario_permissoes (usuario_id uuid, permission_key text, effect text);
    create table public.usuario_escopos (usuario_id uuid, data_scope text, unidade_id text, empresa_id text);
    grant select, update on public.unidades to authenticated, service_role;
    create function public.hefisto_permission_match(granted text, wanted text) returns boolean language sql immutable as $$
      select granted = '*' or granted = wanted or granted = split_part(wanted,'.',1) || '.*'
        or granted = split_part(wanted,'.',1) || '.' || split_part(wanted,'.',2) || '.*' $$;
    create function public.pode_ver_todas() returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo'
                       and (u.locked_until is null or u.locked_until <= now()) and u.super_admin) $$;
    create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer set search_path to 'public' as $function$
  with eu as (
    select u.id, u.unidade_principal_id from public.usuarios_erp u
     where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now())
  )
  select coalesce(array_agg(distinct x.unidade_id), '{}'::text[]) from (
    select eu.unidade_principal_id as unidade_id from eu where eu.unidade_principal_id is not null
    union
    select e.unidade_id from public.usuario_escopos e join eu on eu.id = e.usuario_id where e.unidade_id is not null
    union  -- escopo de empresa com empresa_id: as unidades dessa empresa
    select un.id from public.usuario_escopos e join eu on eu.id = e.usuario_id join public.unidades un on un.empresa_id = e.empresa_id
     where e.data_scope in ('empresa', 'todos') and e.empresa_id is not null
    union  -- escopo de empresa sem empresa_id: a empresa da unidade principal (nunca as outras)
    select un.id from public.usuario_escopos e join eu on eu.id = e.usuario_id
      join public.unidades up on up.id = eu.unidade_principal_id join public.unidades un on un.empresa_id = up.empresa_id
     where e.data_scope in ('empresa', 'todos') and e.empresa_id is null and up.empresa_id is not null
  ) x
$function$;
    create function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text) returns boolean language sql as $$ select false $$;
    create function public.hefisto_user_in_unit(p_auth_user_id uuid, p_unidade_id text) returns boolean language sql as $$ select false $$;
    create function public.hefisto_mark_password_changed() returns void language sql as $$ select $$;
    create function public.hefisto_user_can(p_permission text, p_unidade_id text) returns boolean language sql stable security definer set search_path to 'public' as $$
      select hefisto_user_has_permission(auth.uid(), p_permission) and hefisto_user_in_unit(auth.uid(), p_unidade_id) $$;
    insert into public.empresas values ('A'), ('B');
    insert into public.unidades values ('a1', 'A', 'A1'), ('a2', 'A', 'A2'), ('b1', 'B', 'B1');
    insert into public.perfis_acesso (codigo) values ('estoque');
    insert into public.perfil_permissoes select id, 'estoque.*' from public.perfis_acesso;
  `);
  const perfil = (await pg.query("select id from public.perfis_acesso")).rows[0].id;
  const add = async (uid, { principal, superAdmin = false, travado = false }) => {
    await pg.query(`insert into public.usuarios_erp (auth_user_id, super_admin, perfil_id, unidade_principal_id, locked_until)
      values ($1, $2, $3, $4, $5)`, [uid, superAdmin, perfil, principal, travado ? new Date(Date.now() + 3600e3).toISOString() : null]);
  };
  await add(U.superA, { principal: "a1", superAdmin: true });
  await add(U.gerA, { principal: "a1" });
  await add(U.todosA, { principal: "a2" });
  await add(U.funcA, { principal: "a1" });
  await add(U.travado, { principal: "a1", travado: true });
  await add(U.funcB, { principal: "b1" });
  await add(U.adminB, { principal: "b1" });
  const esc = (uid, scope, unidade, empresa) => pg.query(`insert into public.usuario_escopos select id, $2, $3, $4 from public.usuarios_erp where auth_user_id = $1`, [uid, scope, unidade, empresa]);
  await esc(U.gerA, "empresa", null, null);
  await esc(U.todosA, "todos", null, null);
  await esc(U.adminB, "empresa", null, "B");
  // "hoje": os textos exatos do banco real, pelo arquivo de rollback
  await pg.exec(ler("SEC_EMPRESA_1_ROLLBACK.sql").replace("drop function if exists public.hefisto_unidade_empresa_imutavel();", "").replace(/drop trigger if exists[^;]*;/, ""));
  return pg;
}

async function como(pg, papel, uid, fn) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [uid || "", papel]);
  await pg.exec(`set role ${papel}`);
  try { return await fn(); } finally { await pg.exec("reset role"); }
}
const q1 = async (pg, papel, uid, sql, params = []) => como(pg, papel, uid, async () => {
  try { return (await pg.query(sql, params)).rows[0]?.r; } catch (e) { return "ERRO: " + e.message; }
});
const inUnit = (pg, quem, unidade) => q1(pg, "authenticated", quem, "select public.hefisto_user_in_unit(auth.uid(), $1) r", [unidade]);
const pode = (pg, quem, unidade) => q1(pg, "authenticated", quem, "select public.hefisto_user_can('estoque.overview.view', $1) r", [unidade]);

test("SEC-EMPRESA-1: antes, depois e rollback", { skip: pular }, async () => {
  const pg = await banco();
  const UNIDADES = ["a1", "a2", "b1"];
  const mapa = async () => {
    const m = {};
    for (const [nome, uid] of Object.entries(U)) for (const un of UNIDADES) m[`${nome}@${un}`] = await pode(pg, uid, un);
    return m;
  };

  // ANTES: os furos
  assert.equal(await inUnit(pg, U.gerA, "b1"), true, "antes: escopo 'empresa' alcança a outra empresa");
  assert.equal(await inUnit(pg, U.todosA, "b1"), true, "antes: escopo 'todos' alcança a outra empresa");
  assert.equal(await q1(pg, "anon", null, "select public.hefisto_user_has_permission($1, 'estoque.overview.view') r", [U.funcA]), true, "antes: anônimo sonda permissão de terceiro");
  assert.equal(await q1(pg, "authenticated", U.funcB, "select public.hefisto_user_has_permission($1, 'estoque.overview.view') r", [U.funcA]), true, "antes: usuário sonda outro");
  await q1(pg, "authenticated", U.travado, "select public.hefisto_mark_password_changed() r");
  assert.equal((await pg.query("select locked_until from public.usuarios_erp where auth_user_id = $1", [U.travado])).rows[0].locked_until, null, "antes: travado se destrava");
  await pg.query("update public.usuarios_erp set locked_until = now() + interval '1 hour' where auth_user_id = $1", [U.travado]);
  const antes = await mapa();

  await pg.exec(ler("SEC_EMPRESA_1_ISOLAMENTO.sql"));
  await assert.rejects(pg.exec(ler("SEC_EMPRESA_1_ISOLAMENTO.sql")), /SEC-EMPRESA-1/, "preflight recusa reaplicar");
  await pg.exec("rollback");

  // DEPOIS: S-23 — escopo amplo só na própria empresa
  assert.equal(await inUnit(pg, U.gerA, "b1"), false);
  assert.equal(await inUnit(pg, U.gerA, "a2"), true, "escopo empresa continua valendo na própria empresa");
  assert.equal(await inUnit(pg, U.todosA, "b1"), false);
  assert.equal(await inUnit(pg, U.todosA, "a1"), true);
  assert.equal(await inUnit(pg, U.adminB, "b1"), true);
  assert.equal(await inUnit(pg, U.adminB, "a1"), false, "admin da empresa B não entra na A");
  assert.equal(await inUnit(pg, U.superA, "b1"), true, "super admin: visão consolidada");
  assert.equal(await inUnit(pg, U.funcA, null), true, "unidade nula continua como antes");

  // impacto: só mudam as combinações de escopo amplo em outra empresa
  const depois = await mapa();
  const mudou = Object.keys(antes).filter((k) => antes[k] !== depois[k]).sort();
  assert.deepEqual(mudou, ["adminB@a1", "adminB@a2", "gerA@b1", "todosA@b1"], "só mudam acessos de escopo amplo a OUTRA empresa");

  // S-24 — ninguém sonda terceiro; anônimo não executa
  assert.match(String(await q1(pg, "anon", null, "select public.hefisto_user_has_permission($1, 'estoque.overview.view') r", [U.funcA])), /ERRO: permission denied/);
  assert.match(String(await q1(pg, "anon", null, "select public.hefisto_user_in_unit($1, 'a1') r", [U.funcA])), /ERRO: permission denied/);
  assert.match(String(await q1(pg, "anon", null, "select public.hefisto_user_can('estoque.overview.view', 'a1') r")), /ERRO: permission denied/);
  assert.equal(await q1(pg, "authenticated", U.funcB, "select public.hefisto_user_has_permission($1, 'estoque.overview.view') r", [U.funcA]), false, "usuário não sonda outro");
  assert.equal(await q1(pg, "authenticated", U.funcB, "select public.hefisto_user_in_unit($1, 'a1') r", [U.funcA]), false);
  assert.equal(await q1(pg, "authenticated", U.funcA, "select public.hefisto_user_has_permission(auth.uid(), 'estoque.overview.view') r"), true, "a si mesmo continua");
  assert.equal(await q1(pg, "service_role", null, "select public.hefisto_user_has_permission($1, 'estoque.overview.view') r", [U.funcA]), true, "servidor (access-control) continua perguntando por outro uid");
  assert.equal(await q1(pg, "authenticated", U.superA, "select public.hefisto_user_has_permission($1, 'estoque.overview.view') r", [U.funcA]), true, "super admin pergunta por outro");
  assert.match(String(await q1(pg, "authenticated", U.funcA, "select public.hefisto_unidades_de($1) r", [U.funcA])), /ERRO: permission denied/, "hefisto_unidades_de é só do servidor");

  // S-29b — trocar a senha não destrava
  await q1(pg, "authenticated", U.travado, "select public.hefisto_mark_password_changed() r");
  assert.notEqual((await pg.query("select locked_until from public.usuarios_erp where auth_user_id = $1", [U.travado])).rows[0].locked_until, null);

  // S-30 — unidade não muda de empresa
  assert.match(String(await q1(pg, "authenticated", U.gerA, "update public.unidades set empresa_id = 'B' where id = 'a1' returning 1 r")), /administrador da plataforma/);
  assert.equal(await q1(pg, "authenticated", U.gerA, "update public.unidades set nome = 'A1 nova' where id = 'a1' returning 1 r"), 1, "editar outros campos continua");
  assert.equal(await q1(pg, "service_role", null, "update public.unidades set empresa_id = 'A' where id = 'a2' returning 1 r"), 1, "servidor pode");
  assert.equal(await q1(pg, "authenticated", U.superA, "update public.unidades set empresa_id = 'A' where id = 'a2' returning 1 r"), 1, "super admin pode");

  // ROLLBACK: comportamento antigo de volta
  await pg.exec(ler("SEC_EMPRESA_1_ROLLBACK.sql"));
  assert.equal(await inUnit(pg, U.gerA, "b1"), true);
  assert.equal(await q1(pg, "anon", null, "select public.hefisto_user_has_permission($1, 'estoque.overview.view') r", [U.funcA]), true);
  assert.deepEqual(await mapa(), antes, "rollback devolve exatamente o mapa de acessos de antes");
});
