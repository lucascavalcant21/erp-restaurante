// SQL REAL da MARM-PROD-1 em Postgres local (PGlite), com um estoque_movimentar
// de teste. Rode com PGLITE=<caminho de @electric-sql/pglite>. Sem PGLITE, sai com 2.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clienteSupabase } from "../teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
if (!process.env.PGLITE) { console.log("PGLITE não informado: testes NÃO executados."); process.exit(2); }
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : ` obtido ${JSON.stringify(obtido)} esperado ${JSON.stringify(esperado)}`}`);
};
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
const U1 = "11111111-1111-1111-1111-111111111111"; const U2 = "22222222-2222-2222-2222-222222222222";
const [TOM, MOLHO, FICHA, M, E_COZ] = ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002", "b0000000-0000-4000-8000-000000000001", "c0000000-0000-4000-8000-000000000001", "c0000000-0000-4000-8000-000000000002"];
const LOTE = "d0000000-0000-4000-8000-000000000001";
await pg.exec(`
  create role anon nologin; create role authenticated nologin; create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
  create table public.acesso_teste (uid uuid, unidade text);
  insert into public.acesso_teste values ('${U1}', 'sel'), ('${U2}', 'outra');
  create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer set search_path = public as $$ select coalesce(array_agg(unidade), '{}') from public.acesso_teste where uid = auth.uid() $$;
  create function public.hefisto_ve_todas_unidades() returns boolean language sql stable as $$ select false $$;
  create table public.estoques (id uuid primary key default gen_random_uuid(), unidade_id text, nome text, slug text, tipo text, descricao text, cor text, status text default 'ativo', permissoes jsonb default '[]', controla_minimo boolean, controla_validade boolean, locais_internos jsonb default '[]', ordem int);
  insert into public.estoques (id, unidade_id, nome, slug, tipo) values ('${M}', 'sel', 'Marmitaria', 'marmitaria', 'alimentos'), ('${E_COZ}', 'sel', 'Cozinha', 'cozinha', 'alimentos');
  create table public.fichas_tecnicas (id uuid primary key, unidade_id text, eh_base boolean);
  insert into public.fichas_tecnicas values ('${FICHA}', 'sel', true);
  create table public.insumos (id uuid primary key, unidade_id text, ficha_tecnica_id uuid);
  insert into public.insumos values ('${TOM}', 'sel', null), ('${MOLHO}', 'sel', '${FICHA}');
  create table public.saldo_teste (estoque_id uuid, insumo_id uuid, qtd numeric, primary key (estoque_id, insumo_id));
  insert into public.saldo_teste values ('${M}', '${TOM}', 10), ('${E_COZ}', '${TOM}', 100);
  create table public.marmitaria_producao_lotes (id uuid primary key, unidade_id text not null, codigo text not null, tipo_demanda text, status text, ficha_id uuid, quantidade_planejada numeric, quantidade_produzida numeric, data_producao date, data_validade date, custo_total numeric, baixou_ingredientes boolean, rendimento_real_dados jsonb);
  create table public.estoque_movimentacoes_multi (estoque_id uuid);
  create table public.estoque_itens (estoque_id uuid);
  create function public.estoque_movimentar(p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_tipo text, p_motivo text, p_quantidade numeric, p_validade date default null, p_quantidade_informada numeric default null, p_unidade_informada text default null, p_detalhe jsonb default null, p_observacao text default null, p_responsavel_nome text default null, p_chave text default null, p_pin text default null, p_justificativa text default null, p_origem text default 'movimentacao')
  returns jsonb language plpgsql security definer set search_path = public as $$
  declare v numeric;
  begin
    if p_tipo = 'entrada' then
      insert into public.saldo_teste values (p_estoque_id, p_insumo_id, p_quantidade) on conflict (estoque_id, insumo_id) do update set qtd = saldo_teste.qtd + excluded.qtd;
    else
      select qtd into v from public.saldo_teste where estoque_id = p_estoque_id and insumo_id = p_insumo_id;
      if coalesce(v, 0) < p_quantidade then raise exception 'Saldo insuficiente.'; end if;
      update public.saldo_teste set qtd = qtd - p_quantidade where estoque_id = p_estoque_id and insumo_id = p_insumo_id;
    end if;
    return jsonb_build_object('ok', true);
  end $$;
  grant execute on function public.estoque_movimentar(text,uuid,uuid,text,text,numeric,date,numeric,text,jsonb,text,text,text,text,text,text) to authenticated;
  grant select on all tables in schema public to authenticated;
  grant insert on public.marmitaria_producao_lotes to authenticated;
`);
const sql = fs.readFileSync(path.join(raiz, "db", "marmitaria", "MARM_PROD_1_PREPAROS.sql"), "utf8");
await pg.exec(sql);
conferir("cria os locais de produção e limpeza", (await pg.query(`select string_agg(slug, ',' order by slug) s from public.estoques where slug like '%-marmitaria'`)).rows[0].s, "limpeza-marmitaria,producao-marmitaria");
await pg.exec(sql);
conferir("rodar de novo não duplica", (await pg.query(`select count(*)::int n from public.estoques where slug = 'producao-marmitaria'`)).rows[0].n, 1);
const db1 = clienteSupabase(pg, { uid: U1 }); const db2 = clienteSupabase(pg, { uid: U2 });
const dados = { lote_id: LOTE, unidade_id: "sel", ficha_id: FICHA, quantidade: 5, quantidade_saldo: 5, baixas: [{ estoque_id: M, insumo_id: TOM, quantidade: 8 }], para_o_dia: "2026-11-06" };
const saldos = async () => (await pg.query(`select s.qtd::float8 q, e.slug from public.saldo_teste s join public.estoques e on e.id = s.estoque_id order by e.slug, s.insumo_id`)).rows.map((r) => `${r.slug}:${r.q}`);
let r = await db1.rpc("marmitaria_produzir_preparo", { p_dados: dados });
conferir("baixa o ingrediente e entra o subproduto", [r.error, r.data?.baixas, await saldos()], [null, 1, ["cozinha:100", "marmitaria:2", "producao-marmitaria:5"]]);
r = await db1.rpc("marmitaria_produzir_preparo", { p_dados: dados });
conferir("reenviar não baixa de novo", [r.data?.idempotente, await saldos()], [true, ["cozinha:100", "marmitaria:2", "producao-marmitaria:5"]]);
r = await db1.rpc("marmitaria_produzir_preparo", { p_dados: { ...dados, lote_id: "d0000000-0000-4000-8000-000000000002", baixas: [{ estoque_id: E_COZ, insumo_id: TOM, quantidade: 1 }] } });
conferir("recusa baixar do estoque do restaurante", [/só usa o estoque da marmitaria/.test(r.error?.message || ""), await saldos()], [true, ["cozinha:100", "marmitaria:2", "producao-marmitaria:5"]]);
r = await db1.rpc("marmitaria_produzir_preparo", { p_dados: { ...dados, lote_id: "d0000000-0000-4000-8000-000000000003", baixas: [{ estoque_id: M, insumo_id: TOM, quantidade: 3 }] } });
conferir("falta de saldo desfaz tudo", [/Saldo insuficiente/.test(r.error?.message || ""), (await pg.query(`select count(*)::int n from public.marmitaria_producao_lotes`)).rows[0].n, await saldos()], [true, 1, ["cozinha:100", "marmitaria:2", "producao-marmitaria:5"]]);
r = await db2.rpc("marmitaria_produzir_preparo", { p_dados: { ...dados, lote_id: "d0000000-0000-4000-8000-000000000004" } });
conferir("outra empresa não produz na unidade alheia", r.error?.message, "Você não tem acesso a esta unidade.");
conferir("anon não executa", (await pg.query(`select has_function_privilege('anon', 'public.marmitaria_produzir_preparo(jsonb)', 'execute') p`)).rows[0].p, false);
const rb = fs.readFileSync(path.join(raiz, "db", "marmitaria", "MARM_PROD_1_ROLLBACK.sql"), "utf8");
await pg.exec("delete from public.estoque_itens");
await pg.exec(rb);
conferir("rollback tira a função e o local", (await pg.query(`select to_regprocedure('public.marmitaria_produzir_preparo(jsonb)') is null f, (select count(*)::int from public.estoques where slug like '%-marmitaria') n`)).rows[0], { f: true, n: 0 });
console.log(falhas ? `${falhas} falha(s)` : "Todos os casos passaram.");
process.exit(falhas ? 1 : 0);
