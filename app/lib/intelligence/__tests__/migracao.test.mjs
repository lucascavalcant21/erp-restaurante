// IC-01 — a migração aplicada num Postgres real em memória (PGlite), com os
// papéis do Supabase (anon, authenticated, service_role) e auth.uid().
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/intelligence/__tests__/migracao.test.mjs
// Sem PGLITE os testes são pulados (e aparecem como "skipped", não como aprovados).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SQL = fs.readFileSync(path.join(raiz, "db", "intelligence", "IC_01_INTELLIGENCE_CORE.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role;
    create table public.unidades (id text primary key);
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid, nome text);
    insert into public.unidades values ('loja-a'), ('loja-b');
    -- controle de acesso (stubs com a mesma assinatura): auditor só se test.auditor = uid
    create function public.hefisto_user_can(p text, u text) returns boolean language sql stable security definer as $$
      select p = 'relatorios.audit.view' and current_setting('test.auditor', true) = auth.uid()::text and u = 'loja-a' $$;
    create function public.hefisto_user_in_unit(uid uuid, u text) returns boolean language sql stable security definer as $$
      select (uid = '${A}'::uuid and u = 'loja-a') or (uid = '${B}'::uuid and u = 'loja-b') $$;
    grant execute on function public.hefisto_user_can(text, text) to authenticated;
    grant execute on function public.hefisto_user_in_unit(uuid, text) to authenticated;
    -- padrão do Supabase: tudo novo concedido ao authenticated (a migração precisa revogar)
    alter default privileges in schema public grant all on tables to authenticated, anon;
  `);
  await pg.exec(SQL);
  return pg;
}

async function como(pg, papel, uid, fn) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  await pg.exec(`set role ${papel}`);
  try { return await fn(); } finally { await pg.exec("reset role"); }
}

const evento = (uid, unidade, etapa = "pedido") => `insert into public.intelligence_eventos (correlation_id, unidade_id, auth_user_id, etapa, comando)
  values ('corr-1', '${unidade}', '${uid}', '${etapa}', 'Quanto vendi hoje?') returning id`;

test("migração aplica numa transação, é reexecutável e liga RLS", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(SQL); // segunda vez: idempotente
  const r = await pg.query("select relname, relrowsecurity from pg_class where relname like 'intelligence_%' and relkind = 'r' order by 1");
  assert.deepEqual(r.rows.map((x) => [x.relname, x.relrowsecurity]), [
    ["intelligence_acoes", true], ["intelligence_eventos", true], ["intelligence_feedback", true], ["intelligence_preferencias", true],
  ]);
});

test("auditoria é imutável até para a service role", { skip: pular }, async () => {
  const pg = await banco();
  const id = (await como(pg, "service_role", null, () => pg.query(evento(A, "loja-a")))).rows[0].id;
  // 1ª camada: a service role não tem privilégio de alterar/apagar
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("update public.intelligence_eventos set comando = 'x' where id = $1", [id])), /permission denied/);
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("delete from public.intelligence_eventos where id = $1", [id])), /permission denied/);
  // 2ª camada: nem o dono do banco altera (trigger)
  await assert.rejects(() => pg.query("update public.intelligence_eventos set comando = 'x' where id = $1", [id]), /imutável/);
  await assert.rejects(() => pg.query("delete from public.intelligence_eventos where id = $1", [id]), /imutável/);
  await assert.rejects(() => pg.query("truncate public.intelligence_eventos"), /imutável/);
});

test("usuário do app não escreve; lê só o próprio (empresa B não vê A)", { skip: pular }, async () => {
  const pg = await banco();
  await como(pg, "service_role", null, async () => { await pg.query(evento(A, "loja-a")); await pg.query(evento(B, "loja-b")); });
  await assert.rejects(() => como(pg, "authenticated", A, () => pg.query(evento(A, "loja-a"))), /permission denied/);
  const deA = await como(pg, "authenticated", A, () => pg.query("select unidade_id from public.intelligence_eventos"));
  assert.deepEqual(deA.rows.map((x) => x.unidade_id), ["loja-a"]);
  const deB = await como(pg, "authenticated", B, () => pg.query("select unidade_id from public.intelligence_eventos"));
  assert.deepEqual(deB.rows.map((x) => x.unidade_id), ["loja-b"]);
  const anon = await como(pg, "anon", null, () => pg.query("select count(*)::int as n from public.intelligence_eventos").catch((e) => ({ erro: e.message })));
  assert.match(anon.erro || "", /permission denied/);
});

test("ações: chave de idempotência única por usuário/unidade e CRITICAL não passa de rascunho", { skip: pular }, async () => {
  const pg = await banco();
  const ins = (chave, risco = "MEDIUM", status = "rascunho") => pg.query(`insert into public.intelligence_acoes (unidade_id, auth_user_id, chave_idempotencia, tipo, risco, status, expira_em)
    values ('loja-a', '${A}', '${chave}', 'stock.registerLoss', '${risco}', '${status}', now() + interval '10 minutes') returning id`);
  await como(pg, "service_role", null, () => ins("envio-0001"));
  await assert.rejects(() => como(pg, "service_role", null, () => ins("envio-0001")), /duplicate key|unique/i);
  await assert.rejects(() => como(pg, "service_role", null, () => ins("envio-0002", "CRITICAL", "executada")), /check constraint/);
  // troca de status atômica: só um "proposta → executando" vence
  const id = (await como(pg, "service_role", null, () => ins("envio-0003", "MEDIUM", "proposta"))).rows[0].id;
  const upd = () => pg.query("update public.intelligence_acoes set status = 'executando' where id = $1 and status = 'proposta' returning id", [id]);
  const [u1, u2] = [await como(pg, "service_role", null, upd), await como(pg, "service_role", null, upd)];
  assert.deepEqual([u1.rows.length, u2.rows.length], [1, 0]);
});

test("feedback limita comentário e preferências são lidas só na própria unidade", { skip: pular }, async () => {
  const pg = await banco();
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query(`insert into public.intelligence_feedback (unidade_id, auth_user_id, insight_id, insight_tipo, resposta, comentario) values ('loja-a', '${A}', 'x:00000000', 'x', 'opcao', repeat('a', 301))`)), /check constraint/);
  await como(pg, "service_role", null, () => pg.query(`insert into public.intelligence_preferencias (unidade_id, limiares) values ('loja-a', '{"precoVariacaoPct": 5}'), ('loja-b', '{}')`));
  const deA = await como(pg, "authenticated", A, () => pg.query("select unidade_id from public.intelligence_preferencias"));
  assert.deepEqual(deA.rows.map((x) => x.unidade_id), ["loja-a"]);
});
