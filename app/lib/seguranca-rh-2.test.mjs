// SEC-RH-2 (S-22): dado pessoal de RH só para o próprio funcionário ou para
// quem tem a chave do módulo. SQL REAL da migração e do rollback no PGlite,
// com a policy "sec_unidade" exatamente como em produção (o preflight confere
// o texto). Papéis: cozinheiro, somente-consulta, gerente (rh.*, ponto.*),
// funcionário com login vinculado, tablet do ponto (ponto.kiosk.*),
// recrutador, gerente de outra unidade, super admin e anônimo.
//   PGLITE=… node --test app/lib/seguranca-rh-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f) => fs.readFileSync(path.join(raiz, "db", "security", f), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

const C1 = "c0000000-0000-0000-0000-0000000000c1", C2 = "c0000000-0000-0000-0000-0000000000c2", C3 = "c0000000-0000-0000-0000-0000000000c3";
const U = {
  super: ["00000000-0000-0000-0000-0000000000a1", "u1", ["*"], true],
  gerente: ["00000000-0000-0000-0000-0000000000a2", "u1", ["rh.*", "ponto.*"]],
  cozinheiro: ["00000000-0000-0000-0000-0000000000a3", "u1", ["cozinha.*", "estoque.overview.view"]],
  consulta: ["00000000-0000-0000-0000-0000000000a4", "u1", ["dashboard.overview.view", "relatorios.reports.view"]],
  func: ["00000000-0000-0000-0000-0000000000a5", "u1", ["checklist.execution.view"], false, C1],
  tablet: ["00000000-0000-0000-0000-0000000000a6", "u1", ["ponto.kiosk.view", "ponto.kiosk.create"]],
  recrutador: ["00000000-0000-0000-0000-0000000000a7", "u1", ["rh.recruiting.*"]],
  gerenteU2: ["00000000-0000-0000-0000-0000000000a8", "u2", ["rh.*", "ponto.*"]],
};
const TABELAS = ["candidatos", "rh_atestados", "rh_advertencias_colab", "ponto_marcacao", "registro_ponto", "rh_banco_horas", "rh_espelho_fechado"];
const COM_COLAB = TABELAS.filter((t) => t !== "candidatos");

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, super_admin boolean default false,
      unidade_principal_id text, colaborador_id uuid, funcionario_id uuid, status text default 'ativo', locked_until timestamptz);
    create table public.permissoes (auth_user_id uuid, chave text);
    create function public.hefisto_ve_todas_unidades() returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.super_admin) $$;
    create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer set search_path = public as $$
      select coalesce(array_agg(u.unidade_principal_id), '{}') from public.usuarios_erp u where u.auth_user_id = auth.uid() $$;
    create function public.hefisto_meus_colaboradores() returns uuid[] language sql stable security definer set search_path = public as $$
      select coalesce(array_agg(distinct c), '{}'::uuid[]) from (
        select unnest(array[u.colaborador_id, u.funcionario_id]) c from public.usuarios_erp u
         where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now())) x where c is not null $$;
    create function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text) returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.usuarios_erp u where u.auth_user_id = p_auth_user_id and u.super_admin)
          or exists (select 1 from public.permissoes p where p.auth_user_id = p_auth_user_id and (p.chave = '*' or p.chave = p_permission
               or p.chave = split_part(p_permission, '.', 1) || '.*' or p.chave = split_part(p_permission, '.', 1) || '.' || split_part(p_permission, '.', 2) || '.*')) $$;
    create function public.extra_cadastro_publico(p_id uuid) returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
    revoke all on function public.extra_cadastro_publico(uuid) from public;
    grant execute on function public.extra_cadastro_publico(uuid) to authenticated;
  `);
  for (const t of TABELAS) {
    await pg.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), unidade_id text,
        ${t === "candidatos" ? "cpf text" : "colaborador_id uuid"}, info text default 'x');
      alter table public.${t} enable row level security;
      create policy sec_unidade on public.${t} for all to authenticated
        using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
        with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));
      grant select, insert, update, delete on public.${t} to authenticated;`);
    if (t === "candidatos") await pg.exec(`insert into public.candidatos (unidade_id, cpf) values ('u1', '111'), ('u1', '222'), ('u2', '333');`);
    else await pg.query(`insert into public.${t} (unidade_id, colaborador_id) values ('u1', $1), ('u1', $2), ('u2', $3)`, [C1, C2, C3]);
  }
  for (const [uid, unidade, chaves, superAdmin, colab] of Object.values(U)) {
    await pg.query("insert into public.usuarios_erp (auth_user_id, unidade_principal_id, super_admin, colaborador_id) values ($1, $2, $3, $4)", [uid, unidade, !!superAdmin, colab || null]);
    for (const k of chaves) await pg.query("insert into public.permissoes values ($1, $2)", [uid, k]);
  }
  return pg;
}

async function como(pg, quem, fn) {
  const uid = quem ? U[quem][0] : "";
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await pg.exec(quem ? "set role authenticated" : "set role anon");
  try { return await fn(); } finally { await pg.exec("reset role"); }
}
const contar = (pg, quem, t) => como(pg, quem, async () => {
  try { return (await pg.query(`select count(*)::int n from public.${t}`)).rows[0].n; } catch { return "erro"; }
});
const tentar = (pg, quem, sql, params = []) => como(pg, quem, async () => {
  try { const r = await pg.query(sql, params); return { ok: true, n: r.affectedRows ?? r.rows.length, rows: r.rows }; } catch (e) { return { ok: false, erro: e.message }; }
});

test("SEC-RH-2: antes, depois e rollback", { skip: pular }, async () => {
  const pg = await banco();
  assert.equal(await contar(pg, "cozinheiro", "rh_atestados"), 2, "antes: cozinheiro lê atestados da unidade");
  assert.equal(await contar(pg, "consulta", "candidatos"), 2, "antes: somente-consulta lê CPF de candidatos");

  await pg.exec(ler("SEC_RH_2_DADOS_PESSOAIS.sql"));
  await assert.rejects(pg.exec(ler("SEC_RH_2_DADOS_PESSOAIS.sql")), /SEC-RH-2/, "preflight recusa reaplicar");
  await pg.exec("rollback");

  for (const t of TABELAS) {
    for (const quem of ["cozinheiro", "consulta"]) assert.equal(await contar(pg, quem, t), 0, `${quem} não lê ${t}`);
    assert.equal(await contar(pg, null, t), "erro", `anônimo não lê ${t}`);
    assert.equal(await contar(pg, "super", t), 3, `super admin vê ${t} (consolidado)`);
  }
  for (const t of COM_COLAB) {
    assert.equal(await contar(pg, "gerente", t), 2, `gerente lê ${t} da unidade`);
    assert.equal(await contar(pg, "gerenteU2", t), 1, `gerente da outra unidade só a dela (${t})`);
    assert.equal(await contar(pg, "func", t), 1, `funcionário lê só o próprio registro em ${t}`);
    const proprio = await tentar(pg, "func", `select colaborador_id from public.${t}`);
    assert.deepEqual(proprio.rows.map((r) => r.colaborador_id), [C1]);
  }
  assert.equal(await contar(pg, "func", "candidatos"), 0, "funcionário não lê candidatos");
  assert.equal(await contar(pg, "recrutador", "candidatos"), 2, "recrutador lê candidatos da unidade");
  for (const t of COM_COLAB) assert.equal(await contar(pg, "recrutador", t), 0, `recrutador não lê ${t}`);

  // escrita
  assert.equal((await tentar(pg, "func", "insert into public.rh_atestados (unidade_id, colaborador_id) values ('u1', $1)", [C1])).ok, false, "funcionário não lança atestado (nem o próprio)");
  assert.equal((await tentar(pg, "func", "update public.rh_banco_horas set info = 'y' where colaborador_id = $1", [C1])).n, 0, "funcionário não altera o próprio banco de horas");
  assert.equal((await tentar(pg, "cozinheiro", "insert into public.rh_advertencias_colab (unidade_id, colaborador_id) values ('u1', $1)", [C2])).ok, false);
  assert.equal((await tentar(pg, "gerente", "insert into public.rh_atestados (unidade_id, colaborador_id) values ('u1', $1)", [C2])).ok, true, "gerente lança atestado");
  assert.equal((await tentar(pg, "gerente", "insert into public.rh_atestados (unidade_id, colaborador_id) values ('u2', $1)", [C3])).ok, false, "gerente não lança em outra unidade");

  // tablet do ponto: grava a batida e recebe a linha de volta; lê o resumo do dia; não lê o resto
  const batida = await tentar(pg, "tablet", "insert into public.ponto_marcacao (unidade_id, colaborador_id) values ('u1', $1) returning id", [C2]);
  assert.equal(batida.ok, true, "tablet grava a batida com retorno: " + batida.erro);
  assert.equal((await tentar(pg, "tablet", "insert into public.registro_ponto (unidade_id, colaborador_id) values ('u1', $1) returning id", [C2])).ok, true);
  assert.equal((await tentar(pg, "tablet", "update public.registro_ponto set info = 'saida' where colaborador_id = $1", [C2])).n > 0, true, "tablet atualiza o resumo do dia");
  assert.equal(await contar(pg, "tablet", "registro_ponto"), 3, "tablet lê o resumo do dia da unidade");
  for (const t of ["rh_atestados", "rh_advertencias_colab", "rh_banco_horas", "rh_espelho_fechado", "candidatos"]) assert.equal(await contar(pg, "tablet", t), 0, `tablet não lê ${t}`);
  assert.equal((await tentar(pg, "tablet", "insert into public.ponto_marcacao (unidade_id, colaborador_id) values ('u2', $1)", [C3])).ok, false, "tablet não bate ponto em outra unidade");

  assert.equal((await tentar(pg, "func", "select public.extra_cadastro_publico(gen_random_uuid())")).ok, false, "RPC antiga do portal só no servidor");

  await pg.exec(ler("SEC_RH_2_ROLLBACK.sql"));
  assert.equal(await contar(pg, "cozinheiro", "rh_atestados") > 0, true, "rollback: comportamento antigo de volta");
  assert.equal((await tentar(pg, "func", "select public.extra_cadastro_publico(gen_random_uuid())")).ok, true);
  await pg.exec(ler("SEC_RH_2_DADOS_PESSOAIS.sql").replace(/^begin;$/m, "begin;").replace(/^commit;$/m, "rollback;"));
});
