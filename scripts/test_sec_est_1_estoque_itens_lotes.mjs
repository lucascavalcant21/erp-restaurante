// Teste LOCAL (PGlite) de db/security/SEC_EST_1_*.sql. Nada toca produção.
// Reproduz as policies de estoque_itens/estoque_lotes e os grants exatamente
// como auditados em 01/10/2026 e as funções auth_unidade_id()/pode_ver_todas()
// da SEC-RH-1.4. Usuários e itens são sintéticos.
// Uso: PGLITE=<caminho de @electric-sql/pglite> node scripts/test_sec_est_1_estoque_itens_lotes.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const PREVIA = fs.readFileSync(path.join(raiz, "db/security/SEC_EST_1_PREVIA_ESTOQUE_ITENS_LOTES.sql"), "utf8");
const CORRECAO = fs.readFileSync(path.join(raiz, "db/security/SEC_EST_1_ESTOQUE_ITENS_LOTES_POR_UNIDADE.sql"), "utf8");
const ROLLBACK = CORRECAO.match(/\/\* ── ROLLBACK[^\n]*\n([\s\S]*?)\n\s*─+ \*\//)[1];

let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};
const U = { gerenteA: "aaaaaaaa-0000-0000-0000-00000000000a", garcomA: "aaaaaaaa-0000-0000-0000-00000000000b",
  gerenteB: "bbbbbbbb-0000-0000-0000-00000000000a", rede: "cccccccc-0000-0000-0000-00000000000a", semUnidade: "dddddddd-0000-0000-0000-00000000000a" };

async function banco() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
    create table public.unidades (id text primary key);
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, nome text,
      status text, super_admin boolean default false, tipo_acesso text, unidade_principal_id text);
    create table public.usuario_escopos (usuario_id uuid, unidade_id text, data_scope text);
    create function public.auth_unidade_id() returns text language sql stable security definer set search_path = public as $$
      select coalesce((select u.unidade_principal_id from usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' and u.unidade_principal_id is not null limit 1),
        (select e.unidade_id from usuario_escopos e join usuarios_erp u on u.id = e.usuario_id where u.auth_user_id = auth.uid() and u.status = 'ativo' and e.unidade_id is not null order by e.unidade_id limit 1), ''); $$;
    create function public.pode_ver_todas() returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo'
        and (u.super_admin or exists (select 1 from usuario_escopos e where e.usuario_id = u.id and e.data_scope in ('todos','empresa')))); $$;
    create table public.estoque_itens (id uuid primary key default gen_random_uuid(), unidade_id text not null references public.unidades(id),
      estoque_id uuid not null, insumo_id uuid not null, quantidade_atual numeric not null default 0);
    create table public.estoque_lotes (id uuid primary key default gen_random_uuid(), unidade_id text not null references public.unidades(id),
      estoque_id uuid not null, insumo_id uuid not null, validade date, quantidade numeric not null default 0);
    alter table public.estoque_itens enable row level security;
    alter table public.estoque_lotes enable row level security;
    -- policies e grants como estão em produção (auditoria de 01/10/2026)
    create policy auth_all on public.estoque_itens as permissive for all to authenticated using (true) with check (true);
    create policy estoque_itens_auth_full on public.estoque_itens as permissive for all to authenticated using (true) with check (true);
    create policy estoque_lotes_all on public.estoque_lotes as permissive for all to public using (true) with check (true);
    grant select, insert, update, delete, truncate, references, trigger on public.estoque_itens, public.estoque_lotes to authenticated;
    grant references, trigger, truncate on public.estoque_itens, public.estoque_lotes to anon;
    insert into public.unidades values ('seldeestrela'), ('filial');
    insert into public.usuarios_erp (auth_user_id, nome, status, tipo_acesso, super_admin, unidade_principal_id) values
      ('${U.gerenteA}','Gerente A','ativo','gerente',false,'seldeestrela'),
      ('${U.garcomA}','Garçom A','ativo','garcom',false,'seldeestrela'),
      ('${U.gerenteB}','Gerente B','ativo','gerente',false,'filial'),
      ('${U.rede}','Dono','ativo','administrador',true,null),
      ('${U.semUnidade}','Sem unidade','ativo','garcom',false,null);
    insert into public.estoque_itens (unidade_id, estoque_id, insumo_id, quantidade_atual) values
      ('seldeestrela', gen_random_uuid(), gen_random_uuid(), 5), ('seldeestrela', gen_random_uuid(), gen_random_uuid(), 3), ('filial', gen_random_uuid(), gen_random_uuid(), 7);
    insert into public.estoque_lotes (unidade_id, estoque_id, insumo_id, quantidade) values
      ('seldeestrela', gen_random_uuid(), gen_random_uuid(), 1), ('filial', gen_random_uuid(), gen_random_uuid(), 2);
  `);
  return db;
}
const como = async (db, uid) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  await db.exec(`set role ${uid ? "authenticated" : "anon"}`);
};
const dono = async (db) => db.exec("reset role");
const ve = async (db, uid, tabela) => { await como(db, uid); try { return (await db.query(`select count(*)::int n from public.${tabela}`)).rows[0].n; } catch { return "negado"; } finally { await dono(db); } };
const tenta = async (db, uid, sql) => { await como(db, uid); try { const r = await db.query(sql); return r.affectedRows ?? r.rows.length; } catch (e) { return `erro: ${e.message.slice(0, 50)}`; } finally { await dono(db); } };
const policies = async (db) => (await db.query(`select tablename || '/' || policyname p from pg_policies where tablename in ('estoque_itens','estoque_lotes') order by 1`)).rows.map((r) => r.p);
const grants = async (db) => (await db.query(`select table_name || '→' || grantee || ':' || string_agg(privilege_type, ',' order by privilege_type) g
  from information_schema.role_table_grants where table_name in ('estoque_itens','estoque_lotes') and grantee in ('anon','authenticated') group by table_name, grantee order by 1`)).rows.map((r) => r.g);

// ── antes ────────────────────────────────────────────────────────────────────
const db = await banco();
conferir("ANTES: gerente A vê os itens da filial também (3 de 3)", await ve(db, U.gerenteA, "estoque_itens"), 3);
conferir("ANTES: gerente B altera item da outra unidade", await tenta(db, U.gerenteB, `update public.estoque_itens set quantidade_atual = 0 where unidade_id = 'seldeestrela'`), 2);
await db.exec(`update public.estoque_itens set quantidade_atual = 5 where unidade_id = 'seldeestrela'`);
const policiesAntes = await policies(db);
const grantsAntes = await grants(db);

// ── prévia ───────────────────────────────────────────────────────────────────
const previa = (await db.query(PREVIA)).rows;
const linha = (prefixo) => previa.filter((r) => r.item.startsWith(prefixo)).map((r) => r.resultado);
conferir("prévia: total", linha("01 total"), ["estoque_itens=3 | estoque_lotes=2"]);
conferir("prévia: 3 policies de hoje listadas", previa.filter((r) => r.ord === 4).length, 3);
conferir("prévia: quem perde (gerentes A/garçom A/gerente B perdem a outra unidade; sem unidade perde tudo; dono mantém)",
  previa.filter((r) => r.ord === 9).map((r) => `${r.item.slice(3, 9).trim()} ${r.resultado}`).sort(), [
    "PERDE unidade=(nenhuma) | itens hoje=3 depois=0 | lotes hoje=2 depois=0",
    "PERDE unidade=filial | itens hoje=3 depois=1 | lotes hoje=2 depois=1",
    "PERDE unidade=seldeestrela | itens hoje=3 depois=2 | lotes hoje=2 depois=1",
    "PERDE unidade=seldeestrela | itens hoje=3 depois=2 | lotes hoje=2 depois=1",
    "mantém unidade=REDE | itens hoje=3 depois=3 | lotes hoje=2 depois=2",
  ]);
conferir("prévia não altera nada", [await policies(db), await grants(db)], [policiesAntes, grantsAntes]);

// ── correção ─────────────────────────────────────────────────────────────────
await db.exec(CORRECAO);
conferir("DEPOIS: só as policies por unidade", await policies(db), ["estoque_itens/estoque_itens_unidade", "estoque_lotes/estoque_lotes_unidade"]);
conferir("DEPOIS: anon sem nada; authenticated só DML", await grants(db), ["estoque_itens→authenticated:DELETE,INSERT,SELECT,UPDATE", "estoque_lotes→authenticated:DELETE,INSERT,SELECT,UPDATE"]);
conferir("DEPOIS: gerente A vê só a própria unidade (2 itens, 1 lote)", [await ve(db, U.gerenteA, "estoque_itens"), await ve(db, U.gerenteA, "estoque_lotes")], [2, 1]);
conferir("DEPOIS: gerente B não altera item da outra unidade (0 linhas)", await tenta(db, U.gerenteB, `update public.estoque_itens set quantidade_atual = 0 where unidade_id = 'seldeestrela'`), 0);
conferir("DEPOIS: gerente B não cria item na outra unidade", String(await tenta(db, U.gerenteB, `insert into public.estoque_itens (unidade_id, estoque_id, insumo_id) values ('seldeestrela', gen_random_uuid(), gen_random_uuid())`)).startsWith("erro"), true);
conferir("DEPOIS: gerente A continua alterando a própria unidade", await tenta(db, U.gerenteA, `update public.estoque_itens set quantidade_atual = 6 where unidade_id = 'seldeestrela'`), 2);
conferir("DEPOIS: dono (rede) vê tudo", [await ve(db, U.rede, "estoque_itens"), await ve(db, U.rede, "estoque_lotes")], [3, 2]);
conferir("DEPOIS: sem unidade vê nada", await ve(db, U.semUnidade, "estoque_itens"), 0);
conferir("DEPOIS: anon negado", await ve(db, null, "estoque_lotes"), "negado");
conferir("backup das 3 policies guardado e ilegível pelo app", [(await db.query(`select count(*)::int n from public.sec_backup_policies_sec_est_1`)).rows[0].n, await ve(db, U.gerenteA, "sec_backup_policies_sec_est_1")], [3, "negado"]);
let erroRepetir = null; try { await db.exec(CORRECAO); } catch (e) { erroRepetir = e.message; await db.exec("rollback"); }
conferir("rodar de novo não quebra (idempotente)", [erroRepetir, await policies(db)], [null, ["estoque_itens/estoque_itens_unidade", "estoque_lotes/estoque_lotes_unidade"]]);

// ── rollback ─────────────────────────────────────────────────────────────────
await db.exec(ROLLBACK);
conferir("rollback: policies e grants exatamente como em produção", [await policies(db), await grants(db)], [policiesAntes, grantsAntes]);

// ── aborta sem as funções / com policy desconhecida ─────────────────────────
{
  const d2 = await banco();
  await d2.exec(`create policy outra_aberta on public.estoque_lotes for select to authenticated using (true)`);
  let e2 = null; try { await d2.exec(CORRECAO); } catch (e) { e2 = e.message; await d2.exec("rollback"); }
  conferir("policy desconhecida aberta → aborta e nada muda", [/outra policy/.test(e2 || ""), (await policies(d2)).length], [true, 4]);
  const d3 = await banco();
  await d3.exec(`drop function public.pode_ver_todas()`);
  let e3 = null; try { await d3.exec(CORRECAO); } catch (e) { e3 = e.message; await d3.exec("rollback"); }
  conferir("sem a função pode_ver_todas → aborta e nada muda", [/funções/.test(e3 || ""), (await policies(d3)).length], [true, 3]);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
