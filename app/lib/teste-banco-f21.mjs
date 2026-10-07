// APOIO DE TESTE (não é usado pelo app): Postgres em memória (PGlite) com o
// SQL REAL da F2.1 e um adaptador mínimo no formato do supabase-js
// (from/select/insert/update/eq/in/gte/lte/order/single + rpc), rodando com
// papel `authenticated`, auth.uid() e RLS por unidade — como em produção.
// Nada aqui toca o banco de produção.
//
// Privilégios: por padrão reproduz o MECANISMO do Supabase em produção — ALL
// ao authenticated em toda tabela/view nova e EXECUTE de função a anon e
// authenticated (o anon já não ganha tabelas desde a SEC-DADOS-3). Os revokes
// da F2.1 rodam por cima, chegando ao estado auditado em 01/10/2026.
// `secFin2: true` aplica db/security/SEC_FIN_2_MENOR_PRIVILEGIO_F23.sql depois;
// `f24b: true` aplica db/F2_4B_COMPRAS_CUSTO_MEDIO.sql (compras → custo médio).
// `pgcrypto: true` carrega a extensão no schema extensions, como no Supabase.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function criarBancoF21(raiz, extraSql = "", { padraoSupabase = true, secFin2 = false, f24b = false, pgcrypto = false } = {}) {
  if (!process.env.PGLITE) return null;
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const extensoes = {};
  if (pgcrypto) extensoes.pgcrypto = (await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "contrib", "pgcrypto.js")).href)).pgcrypto;
  const pg = new PGlite({ extensions: extensoes });
  if (pgcrypto) await pg.exec("create schema extensions; create extension pgcrypto schema extensions;");
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
    create table public.unidades (id text primary key, nome text);
    create table public.fornecedores (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
    create table public.insumos (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
    create table public.estoques (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
    create table public.vendas (id uuid primary key default gen_random_uuid(), unidade_id text, total numeric);
    create table public.contas_pagar (id uuid primary key default gen_random_uuid(), unidade_id text, descricao text, valor numeric,
      data_vencimento date, data_pagamento date, categoria text, status text, created_at timestamptz default now(),
      updated_at timestamptz default now(), recorrente boolean default false);
    alter table public.contas_pagar enable row level security;
    grant select, insert, update, delete on public.contas_pagar to authenticated;
    create function public.auth_unidade_id() returns text language sql stable security definer as $$ select coalesce(current_setting('test.unidade', true), '') $$;
    create function public.pode_ver_todas() returns boolean language sql stable security definer as $$ select coalesce(current_setting('test.rede', true), 'false') = 'true' $$;
    -- policy de contas_pagar como ficou depois da SEC-FIN-1 (01/10/2026)
    create policy contas_pagar_unidade on public.contas_pagar for all to authenticated
      using (public.pode_ver_todas() or unidade_id = public.auth_unidade_id())
      with check (public.pode_ver_todas() or unidade_id = public.auth_unidade_id());
    insert into public.unidades values ('seldeestrela','Unidade'), ('outra','Outra');
    ${extraSql}
  `);
  if (padraoSupabase) {
    await pg.exec(`
      alter default privileges in schema public grant all on tables to authenticated;
      alter default privileges in schema public grant all on functions to anon, authenticated;
    `);
  }
  await pg.exec(fs.readFileSync(path.join(raiz, "db", "F2_1_FUNDACAO_FINANCEIRA.sql"), "utf8"));
  if (secFin2) await pg.exec(fs.readFileSync(path.join(raiz, "db", "security", "SEC_FIN_2_MENOR_PRIVILEGIO_F23.sql"), "utf8"));
  if (f24b) await pg.exec(fs.readFileSync(path.join(raiz, "db", "F2_4B_COMPRAS_CUSTO_MEDIO.sql"), "utf8"));
  return pg;
}

export function clienteSupabase(pg, { uid = "33333333-3333-3333-3333-333333333333", unidade = "seldeestrela", rede = false, quebrar = null } = {}) {
  const sessao = async () => {
    await pg.exec("reset role");
    await pg.query(`select set_config('request.jwt.claim.sub',$1,false), set_config('test.unidade',$2,false), set_config('test.rede',$3,false)`, [uid || "", unidade, String(rede)]);
    await pg.exec(uid ? "set role authenticated" : "set role anon");
  };
  const executar = async (sql, params) => {
    if (quebrar) return { data: null, error: { message: quebrar, code: "XX000" } };
    await sessao();
    try { return { data: (await pg.query(sql, params)).rows, error: null }; }
    catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
    finally { await pg.exec("reset role"); }
  };
  return {
    from(tabela) {
      const st = { op: "select", cols: "*", rows: null, patch: null, where: [], params: [], ret: null, order: [], single: false };
      const p = (v) => { st.params.push(v); return `$${st.params.length}`; };
      const b = {
        select(cols = "*") { if (st.op === "select") st.cols = cols; else st.ret = cols; return b; },
        insert(rows) { st.op = "insert"; st.rows = Array.isArray(rows) ? rows : [rows]; return b; },
        update(patch) { st.op = "update"; st.patch = patch; return b; },
        delete() { st.op = "delete"; return b; },
        eq(c, v) { st.where.push(() => `${c} = ${p(v)}`); return b; },
        in(c, vs) { st.where.push(() => `${c} = any(${p(vs)})`); return b; },
        gte(c, v) { st.where.push(() => `${c} >= ${p(v)}`); return b; },
        lte(c, v) { st.where.push(() => `${c} <= ${p(v)}`); return b; },
        gt(c, v) { st.where.push(() => `${c} > ${p(v)}`); return b; },
        lt(c, v) { st.where.push(() => `${c} < ${p(v)}`); return b; },
        order(c, o = {}) { st.order.push(`${c} ${o.ascending === false ? "desc" : "asc"}`); return b; },
        maybeSingle() { st.single = true; return b; },
        single() { st.single = true; return b; },
        then(res, rej) {
          const run = async () => {
            st.params = [];
            let sql;
            if (st.op === "insert") {
              const cols = [...new Set(st.rows.flatMap(Object.keys))];
              const valores = st.rows.map((r) => `(${cols.map((c) => (r[c] === undefined ? "default" : p(r[c]))).join(", ")})`).join(", ");
              sql = `insert into public.${tabela} (${cols.join(", ")}) values ${valores}${st.ret ? ` returning ${st.ret}` : ""}`;
            } else if (st.op === "delete") {
              const where = st.where.map((f) => f()).join(" and ");
              sql = `delete from public.${tabela}${where ? ` where ${where}` : ""}${st.ret ? ` returning ${st.ret}` : ""}`;
            } else if (st.op === "update") {
              const sets = Object.entries(st.patch).map(([c, v]) => `${c} = ${p(v)}`).join(", ");
              const where = st.where.map((f) => f()).join(" and ");
              sql = `update public.${tabela} set ${sets}${where ? ` where ${where}` : ""}${st.ret ? ` returning ${st.ret}` : ""}`;
            } else {
              const where = st.where.map((f) => f()).join(" and ");
              sql = `select ${st.cols} from public.${tabela}${where ? ` where ${where}` : ""}${st.order.length ? ` order by ${st.order.join(", ")}` : ""}`;
            }
            const r = await executar(sql, st.params);
            if (r.error) return r;
            if (st.op !== "select" && !st.ret) return { data: null, error: null };
            return { data: st.single ? (r.data[0] || null) : r.data, error: null };
          };
          return run().then(res, rej);
        },
      };
      return b;
    },
    async rpc(nome, params) {
      const chaves = Object.keys(params);
      const r = await executar(`select public.${nome}(${chaves.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, chaves.map((k) => params[k]));
      return r.error ? r : { data: r.data[0].r, error: null };
    },
  };
}
