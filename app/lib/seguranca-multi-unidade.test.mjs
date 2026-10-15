// SEC-MULTI-1 (achado A3): estoque e financeiro de várias unidades com acesso
// EXPLÍCITO, com o SQL real da migração, do rollback e das funções de escopo
// (SEC-RLS-2) no PGlite. Duas empresas: E1 (seldeestrela + marmitaria) e E2.
//   PGLITE=… node --test app/lib/seguranca-multi-unidade.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f) => fs.readFileSync(path.join(raiz, "db", "security", f), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";
const funcao = (sql, nome) => { const i = sql.indexOf(`create or replace function public.${nome}(`); return sql.slice(i, sql.indexOf("$$;", sql.indexOf("$$", i) + 2) + 3); };

const TABELAS = [["compras", "compras_unidade_f21", "all"], ["compras_itens", "compras_itens_unidade_f21", "all"], ["contas_pagar", "contas_pagar_unidade", "all"],
  ["estoque_contagens", "estoque_contagens_unidade_f21", "all"], ["estoque_contagens_itens", "estoque_contagens_itens_unidade_f21", "all"],
  ["estoque_custos", "estoque_custos_unidade_f21", "all"], ["estoque_custos_historico", "estoque_custos_historico_unidade", "select"],
  ["estoque_itens", "estoque_itens_unidade", "all"], ["estoque_lotes", "estoque_lotes_unidade", "all"], ["estoque_movimentacoes_multi", "estoque_mov_ler_unidade", "select"],
  ["fin_contas_financeiras", "fin_contas_financeiras_unidade_f21", "all"], ["fin_contas_receber", "fin_contas_receber_unidade_f21", "all"],
  ["fin_faturamento_diario", "fin_faturamento_diario_unidade", "all"], ["fin_pagamentos", "fin_pagamentos_unidade_f21", "all"],
  ["fin_recebimentos", "fin_recebimentos_unidade_f21", "all"], ["fin_taxas_meio_pagamento", "fin_taxas_meio_pagamento_unidade_f21", "all"]];
const E1 = "e1e1e1e1-0000-0000-0000-000000000001";
const E2 = "e2e2e2e2-0000-0000-0000-000000000002";
const U = {
  super: "00000000-0000-0000-0000-0000000000a1",
  rest: "00000000-0000-0000-0000-0000000000a2",       // só o restaurante (principal)
  marm: "00000000-0000-0000-0000-0000000000a3",       // só a marmitaria (principal)
  duplo: "00000000-0000-0000-0000-0000000000a4",      // principal restaurante + escopo explícito na marmitaria
  dono: "00000000-0000-0000-0000-0000000000a5",       // principal restaurante + escopo empresa (sem empresa_id)
  outra: "00000000-0000-0000-0000-0000000000a6",      // outra empresa, escopo empresa
  bloqueado: "00000000-0000-0000-0000-0000000000a7",  // restaurante, bloqueado
  semPrincipal: "00000000-0000-0000-0000-0000000000a8", // sem principal, escopos marmitaria e seldeestrela
  semChave: "00000000-0000-0000-0000-0000000000a9",   // como o duplo, mas sem nenhuma chave financeira
};
const FIN = new Set(["contas_pagar", "fin_contas_financeiras", "fin_contas_receber", "fin_faturamento_diario", "fin_pagamentos", "fin_recebimentos", "fin_taxas_meio_pagamento"]);
// policies EXATAS da SEC-FIN-3 (a SEC-MULTI-1 roda depois dela nas financeiras)
const FIN3 = ler("SEC_FIN_3_PERMISSAO_FINANCEIRA.sql").replace(/\r\n/g, "\n");
const policiesFin3 = (t) => ["ler", "incluir", "alterar", "excluir"].map((a) => { const i = FIN3.indexOf(`create policy ${t}_${a} on public.${t} `); assert.ok(i >= 0, `FIN-3 tem ${t}_${a}`); return FIN3.slice(i, FIN3.indexOf(";\n", i) + 1); }).join("\n");

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  const fase2 = ler("SEC_RLS_2_FASE2.sql");
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
    create table public.empresas (id uuid primary key);
    insert into public.empresas values ('${E1}'), ('${E2}');
    create table public.unidades (id text primary key, empresa_id uuid references public.empresas(id));
    insert into public.unidades values ('seldeestrela', '${E1}'), ('marmitaria', '${E1}'), ('outra', '${E2}');
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, status text default 'ativo',
      super_admin boolean default false, unidade_principal_id text, locked_until timestamptz);
    create table public.usuario_escopos (id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuarios_erp(id), empresa_id uuid, unidade_id text, data_scope text);
    insert into public.usuarios_erp (auth_user_id, super_admin, unidade_principal_id, locked_until) values
      ('${U.super}', true, 'seldeestrela', null), ('${U.rest}', false, 'seldeestrela', null), ('${U.marm}', false, 'marmitaria', null),
      ('${U.duplo}', false, 'seldeestrela', null), ('${U.dono}', false, 'seldeestrela', null), ('${U.outra}', false, 'outra', null),
      ('${U.bloqueado}', false, 'seldeestrela', now() + interval '1 day'), ('${U.semPrincipal}', false, null, null),
      ('${U.semChave}', false, 'seldeestrela', null);
    insert into public.usuario_escopos (usuario_id, unidade_id, data_scope) select id, 'marmitaria', 'unidade' from public.usuarios_erp where auth_user_id in ('${U.duplo}', '${U.semChave}');
    -- dublê da permissão por chave: todos têm as chaves financeiras, menos o semChave
    create function public.hefisto_user_has_permission(p_uid uuid, p_chave text) returns boolean language sql stable as $$ select p_uid <> '${U.semChave}' $$;
    insert into public.usuario_escopos (usuario_id, data_scope) select id, 'empresa' from public.usuarios_erp where auth_user_id in ('${U.dono}', '${U.outra}');
    insert into public.usuario_escopos (usuario_id, unidade_id, data_scope) select id, u, 'unidade' from public.usuarios_erp, unnest(array['marmitaria', 'seldeestrela']) u where auth_user_id = '${U.semPrincipal}';
    -- auth_unidade_id como em produção (principal; sem ela, a 1ª unidade de escopo)
    create function public.auth_unidade_id() returns text language sql stable security definer set search_path = public as $$
      select coalesce((select u.unidade_principal_id from usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' and u.unidade_principal_id is not null limit 1),
        (select e.unidade_id from usuario_escopos e join usuarios_erp u on u.id = e.usuario_id where u.auth_user_id = auth.uid() and u.status = 'ativo' and e.unidade_id is not null order by e.unidade_id limit 1), '') $$;
  `);
  // funções de escopo REAIS (SEC-RLS-2)
  for (const f of ["pode_ver_todas", "hefisto_ve_todas_unidades", "hefisto_unidades_do_usuario"]) await pg.exec(funcao(fase2, f));
  await pg.exec(funcao(FIN3, "hefisto_tem_alguma")); // verificador REAL da SEC-FIN-3
  for (const [t, p, cmd] of TABELAS) {
    await pg.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
      alter table public.${t} enable row level security;
      ${FIN.has(t) ? policiesFin3(t) : cmd === "select"
        ? `create policy ${p} on public.${t} for select to authenticated using (pode_ver_todas() or unidade_id = auth_unidade_id());`
        : `create policy ${p} on public.${t} for all to authenticated using (pode_ver_todas() or unidade_id = auth_unidade_id()) with check (pode_ver_todas() or unidade_id = auth_unidade_id());`}
      grant select, insert, update, delete on public.${t} to authenticated;
      insert into public.${t} (unidade_id, nome) values ('seldeestrela', 'R'), ('marmitaria', 'M'), ('outra', 'O');`);
  }
  return pg;
}

async function como(pg, uid, fn) {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const visiveis = (pg, uid, t = "contas_pagar") => como(pg, uid, async () => (await pg.query(`select string_agg(distinct unidade_id, ',' order by unidade_id) u from public.${t}`)).rows[0].u || "");
const grava = (pg, uid, unidade, t = "contas_pagar") => como(pg, uid, async () => { try { await pg.query(`insert into public.${t} (unidade_id, nome) values ($1, 'novo')`, [unidade]); return true; } catch { return false; } });

const ANTES = { super: "marmitaria,outra,seldeestrela", rest: "seldeestrela", marm: "marmitaria", duplo: "seldeestrela", dono: "seldeestrela",
  outra: "outra", bloqueado: "seldeestrela", semPrincipal: "marmitaria", semChave: "" };
const DEPOIS = { super: "marmitaria,outra,seldeestrela", rest: "seldeestrela", marm: "marmitaria", duplo: "marmitaria,seldeestrela", dono: "marmitaria,seldeestrela",
  outra: "outra", bloqueado: "", semPrincipal: "marmitaria,seldeestrela", semChave: "" };

test("SEC-MULTI-1: antes / depois / rollback, nas 16 tabelas", { skip: pular }, async () => {
  const pg = await banco();
  for (const [k, uid] of Object.entries(U)) assert.equal(await visiveis(pg, uid), ANTES[k], `antes: ${k}`);

  const sql = ler("SEC_MULTI_1_ACESSO_MULTIUNIDADE.sql");
  await pg.exec(sql);
  // preflight recusa rodar de novo (as policies já não estão no padrão antigo) — sem mudar nada
  await assert.rejects(pg.exec(sql), /não está como esperado/);
  await pg.exec("rollback");

  for (const [k, uid] of Object.entries(U)) assert.equal(await visiveis(pg, uid), DEPOIS[k], `depois: ${k}`);
  for (const [t] of TABELAS) {
    assert.equal(await visiveis(pg, U.duplo, t), "marmitaria,seldeestrela", `duplo em ${t}`);
    assert.equal(await visiveis(pg, U.outra, t), "outra", `outra empresa isolada em ${t}`);
    // sem chave do módulo: financeiro continua fechado nas DUAS unidades; estoque abre nas duas
    assert.equal(await visiveis(pg, U.semChave, t), FIN.has(t) ? "" : "marmitaria,seldeestrela", `semChave em ${t}`);
  }
  assert.equal(await grava(pg, U.semChave, "marmitaria"), false, "sem chave não grava financeiro na outra unidade");
  assert.equal(await grava(pg, U.semChave, "seldeestrela"), false, "sem chave não grava financeiro nem na principal");
  assert.equal(await grava(pg, U.semChave, "marmitaria", "estoque_itens"), true, "semChave opera estoque da unidade concedida");
  const comChave = (await pg.query("select count(*)::int n from pg_policies where coalesce(qual, with_check) ilike '%hefisto_tem_alguma%'")).rows[0].n;
  assert.equal(comChave, 28, "as 28 policies financeiras mantêm a chave do módulo");
  // escrita segue o mesmo escopo (with check)
  assert.equal(await grava(pg, U.duplo, "marmitaria"), true, "duplo grava na marmitaria");
  assert.equal(await grava(pg, U.duplo, "outra"), false, "duplo não grava em outra empresa");
  assert.equal(await grava(pg, U.marm, "seldeestrela"), false, "só marmitaria não grava no restaurante");
  assert.equal(await grava(pg, U.dono, "outra"), false, "escopo de empresa não passa para outra empresa");
  assert.equal(await grava(pg, U.bloqueado, "seldeestrela"), false, "bloqueado não grava");
  // anônimo continua sem nada
  await pg.exec("set role anon");
  await assert.rejects(pg.query("select * from public.contas_pagar"), /permission denied/);
  await pg.exec("reset role");

  // rollback devolve exatamente o comportamento antigo
  await pg.exec(ler("SEC_MULTI_1_ROLLBACK.sql"));
  for (const [k, uid] of Object.entries(U)) assert.equal(await visiveis(pg, uid), ANTES[k], `rollback: ${k}`);
  const nAntigas = (await pg.query(`select count(*)::int n from pg_policies where coalesce(qual, with_check) ilike '%auth_unidade_id%'`)).rows[0].n;
  assert.equal(nAntigas, 9 + 28, "9 de estoque no padrão F2.1 + 28 financeiras no estado da SEC-FIN-3");
  for (const t of FIN) {
    const pol = (await pg.query("select string_agg(policyname, ',' order by policyname) p from pg_policies where tablename = $1", [t])).rows[0].p;
    assert.equal(pol, [`${t}_alterar`, `${t}_excluir`, `${t}_incluir`, `${t}_ler`].join(","), `rollback devolve as policies da FIN-3 em ${t}`);
  }
});

test("SEC-MULTI-1: sem a SEC-FIN-3 aplicada, aborta sem mudar nada", { skip: pular }, async () => {
  const pg = await banco();
  // financeiro ainda no padrão F2.1 (SEC-FIN-3 não aplicada)
  await pg.exec(`drop policy contas_pagar_ler on public.contas_pagar; drop policy contas_pagar_incluir on public.contas_pagar;
    drop policy contas_pagar_alterar on public.contas_pagar; drop policy contas_pagar_excluir on public.contas_pagar;
    create policy contas_pagar_unidade on public.contas_pagar for all to authenticated using (pode_ver_todas() or unidade_id = auth_unidade_id()) with check (pode_ver_todas() or unidade_id = auth_unidade_id());`);
  await assert.rejects(pg.exec(ler("SEC_MULTI_1_ACESSO_MULTIUNIDADE.sql")), /não estão como a SEC-FIN-3 deixa/);
  await pg.exec("rollback");
  assert.equal(await visiveis(pg, U.duplo, "estoque_itens"), "seldeestrela", "estoque não mudou");
  assert.equal(await visiveis(pg, U.duplo), "seldeestrela", "financeiro não mudou");
});
