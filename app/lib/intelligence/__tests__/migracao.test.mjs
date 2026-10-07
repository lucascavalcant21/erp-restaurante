// IC-01 — a migração aplicada num Postgres real em memória (PGlite), com os
// papéis do Supabase (anon, authenticated, service_role), auth.uid() e os
// privilégios PADRÃO do Supabase (tudo concedido em tabela nova do public).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/intelligence/__tests__/migracao.test.mjs
// Sem PGLITE os testes são pulados (e aparecem como "skipped", não como aprovados).
//
// TESTADO LOCAL (PGlite). Não substitui rodar IC_01_PREFLIGHT.sql e
// IC_01_VERIFICACAO.sql no Supabase real.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const SQL = ler("db", "intelligence", "IC_01_INTELLIGENCE_CORE.sql");
const ROLLBACK = ler("db", "intelligence", "IC_01_ROLLBACK.sql");
const PREFLIGHT = ler("db", "intelligence", "IC_01_PREFLIGHT.sql");
const VERIFICACAO = ler("db", "intelligence", "IC_01_VERIFICACAO.sql");
const PERMISSOES = ler("db", "intelligence", "IC_01_PERMISSOES.sql");
const pular = !process.env.PGLITE && "PGLITE não informado";

// Impressão digital das colunas da ic-01.2 (IC_01_VERIFICACAO.sql). Se mudar a
// migração, atualize aqui E em docs/intelligence/ATIVACAO.md.
const IMPRESSAO_IC01 = "d55eda66f4eddaf4d90ce66743131071";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

async function pglite() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  return new PGlite();
}

const PAPEIS_SUPABASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role;
  -- padrão do Supabase: tudo novo concedido a anon/authenticated/service_role (a migração precisa revogar)
  alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
`;

async function banco({ tipoUnidade = "text", antes = "" } = {}) {
  const pg = await pglite();
  await pg.exec(`
    ${PAPEIS_SUPABASE}
    create table public.unidades (id ${tipoUnidade} primary key);
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid, nome text);
    ${tipoUnidade === "text" ? "insert into public.unidades values ('loja-a'), ('loja-b');" : ""}
    -- controle de acesso (stubs com a mesma assinatura):
    --   relatorios.audit.view só para test.auditor na loja-a; demais chaves: A na loja-a, B na loja-b
    create function public.hefisto_user_can(p text, u text) returns boolean language sql stable security definer as $$
      select case when p = 'relatorios.audit.view' then current_setting('test.auditor', true) = auth.uid()::text and u = 'loja-a'
                  else (auth.uid() = '${A}'::uuid and u = 'loja-a') or (auth.uid() = '${B}'::uuid and u = 'loja-b') end $$;
    create function public.hefisto_user_in_unit(uid uuid, u text) returns boolean language sql stable security definer as $$
      select (uid = '${A}'::uuid and u = 'loja-a') or (uid = '${B}'::uuid and u = 'loja-b') $$;
    grant execute on function public.hefisto_user_can(text, text) to authenticated;
    grant execute on function public.hefisto_user_in_unit(uuid, text) to authenticated;
    ${antes}
  `);
  return pg;
}

async function aplicado() {
  const pg = await banco();
  await pg.exec(SQL);
  return pg;
}

async function como(pg, papel, uid, fn) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  await pg.exec(`set role ${papel}`);
  try { return await fn(); } finally { await pg.exec("reset role"); }
}

/** Roda um SELECT dentro de transação SOMENTE LEITURA (qualquer escrita falha). */
async function somenteLeitura(pg, sql) {
  await pg.exec("begin read only");
  try { return await pg.query(sql); } finally { await pg.exec("rollback"); }
}

const evento = (uid, unidade, etapa = "pedido") => `insert into public.intelligence_eventos (correlation_id, unidade_id, auth_user_id, etapa, comando)
  values ('corr-1', '${unidade}', '${uid}', '${etapa}', 'Quanto vendi hoje?') returning id`;

const intelligenceExiste = async (pg) => (await pg.query("select count(*)::int as n from pg_class where relname like 'intelligence_%'")).rows[0].n;

// ─── Preflight: o que a migração faria, sem rodar ────────────────────────────

test("a migração não tem operação destrutiva fora das próprias tabelas", () => {
  const semComentarios = SQL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''");
  const comandos = semComentarios.toLowerCase();
  assert.doesNotMatch(comandos, /\bdrop\s+(table|schema|view|function|index|extension)\b/, "não apaga tabela/função/índice");
  assert.doesNotMatch(comandos, /\bdelete\s+from\b/, "não apaga dados");
  assert.doesNotMatch(comandos, /\bupdate\s+(public\.)?\w+\s+set\b/, "não altera dados");
  assert.doesNotMatch(comandos, /\btruncate\s+(table\s+)?(?!on\b)\w/, "não trunca");
  // todo ALTER TABLE / DROP TRIGGER / DROP POLICY / DROP CONSTRAINT é em intelligence_*
  for (const m of comandos.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w.%I]+)/g)) assert.match(m[1], /^(public\.)?(intelligence_|%i$)/, m[0]);
  for (const m of comandos.matchAll(/\bdrop\s+(?:trigger|policy)\s+if\s+exists\s+\w+\s+on\s+([\w.]+)/g)) assert.match(m[1], /^public\.intelligence_/, m[0]);
  for (const m of comandos.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+([\w.]+)/g)) assert.equal(m[1], "public.intelligence_eventos_imutavel_trg", m[0]);
  for (const m of comandos.matchAll(/\b(?:revoke|grant)\b[^;]*?\bon\s+(?:function\s+)?(public\.[\w%I.]+)/g)) assert.match(m[1], /^public\.(intelligence_|%i)/, m[0]);
});

test("preflight é só leitura e não acusa nada numa base compatível", { skip: pular }, async () => {
  const pg = await banco();
  const r = await somenteLeitura(pg, PREFLIGHT);
  const bloqueios = r.rows.filter((x) => x.situacao === "BLOQUEIA");
  // a base de teste não tem as funções do contexto da 1B nem as tabelas do ERP: só isso pode bloquear
  assert.deepEqual(bloqueios.map((x) => x.item).sort(), ["public.empresas", "public.hefisto_contexto_requisicao(text)", "public.perfil_permissoes", "public.perfis_acesso", "public.usuario_escopos", "public.usuario_permissoes"]);
  assert.ok(r.rows.some((x) => x.item === "nomes intelligence_*" && x.situacao === "OK"));
  assert.ok(r.rows.some((x) => x.item === "public.unidades.id é text" && x.situacao === "OK"));
  assert.ok(r.rows.some((x) => x.item === "estoque_movimentar" && x.situacao === "ATENÇÃO"));
  assert.equal(await intelligenceExiste(pg), 0, "preflight não cria nada");
});

test("preflight acusa colisão de nome e unidade com tipo errado", { skip: pular }, async () => {
  const pg = await banco({ antes: "create table public.intelligence_feedback (x int); create index intelligence_acoes_usuario on public.usuarios_erp (nome);" });
  const r = await somenteLeitura(pg, PREFLIGHT);
  const bloqueia = r.rows.filter((x) => x.situacao === "BLOQUEIA").map((x) => x.item);
  assert.ok(bloqueia.includes("public.intelligence_feedback"));
  assert.ok(bloqueia.includes("public.intelligence_acoes_usuario"));
  const pg2 = await banco({ tipoUnidade: "uuid" });
  const r2 = await somenteLeitura(pg2, PREFLIGHT);
  assert.ok(r2.rows.some((x) => x.item === "public.unidades.id é text" && x.situacao === "BLOQUEIA" && x.detalhe === "uuid"));
});

test("migração aborta sem criar nada se o nome já é de outra tabela ou a unidade não é text", { skip: pular }, async () => {
  const pg = await banco({ antes: "create table public.intelligence_feedback (x int);" });
  await assert.rejects(() => pg.exec(SQL), /intelligence_feedback.*não é desta migração/);
  await pg.exec("rollback").catch(() => {});
  assert.equal(await intelligenceExiste(pg), 1, "só a tabela alheia continua lá");
  const pg2 = await banco({ tipoUnidade: "uuid" });
  await assert.rejects(() => pg2.exec(SQL), /unidades\.id é uuid/);
  await pg2.exec("rollback").catch(() => {});
  assert.equal(await intelligenceExiste(pg2), 0);
});

// ─── Migração aplicada ───────────────────────────────────────────────────────

test("migração aplica numa transação, é reexecutável, liga RLS e grava a versão", { skip: pular }, async () => {
  const pg = await aplicado();
  await pg.exec(SQL); // segunda vez: idempotente
  const r = await pg.query("select relname, relrowsecurity, obj_description(oid, 'pg_class') as c from pg_class where relname like 'intelligence_%' and relkind = 'r' order by 1");
  assert.deepEqual(r.rows.map((x) => [x.relname, x.relrowsecurity, x.c.startsWith("hefisto:ic-01.2")]), [
    ["intelligence_acoes", true, true], ["intelligence_eventos", true, true], ["intelligence_feedback", true, true], ["intelligence_preferencias", true, true],
  ]);
});

test("verificação pós-migração: tudo OK e impressão digital estável", { skip: pular }, async () => {
  const pg = await aplicado();
  const r = await somenteLeitura(pg, VERIFICACAO);
  const falhas = r.rows.filter((x) => x.situacao !== "OK");
  assert.deepEqual(falhas, []);
  const grants = r.rows.filter((x) => x.grupo === "grant");
  assert.equal(grants.length, 3 * 4 * 5, "anon, authenticated e service_role × 4 tabelas × 5 privilégios");
  const impressao = r.rows.find((x) => x.grupo === "versão").detalhe;
  assert.match(impressao, /^[0-9a-f]{32}$/);
  assert.equal(impressao, IMPRESSAO_IC01, `impressão digital mudou: ${impressao}`);
  assert.equal(r.rows.filter((x) => x.grupo === "fk").length, 4, "unidade_id → unidades nas 4 tabelas");
});

test("rollback recusa apagar tabela que não é da IC-01", { skip: pular }, async () => {
  const pg = await banco({ antes: "create table public.intelligence_feedback (x int);" });
  await assert.rejects(() => pg.exec(ROLLBACK), /não é da IC-01/);
  await pg.exec("rollback").catch(() => {});
  assert.equal(await intelligenceExiste(pg), 1);
  const pg2 = await aplicado();
  await pg2.exec(ROLLBACK);
  assert.equal(await intelligenceExiste(pg2), 0);
});

test("auditoria é imutável até para a service role (mesmo com os privilégios padrão do Supabase)", { skip: pular }, async () => {
  const pg = await aplicado();
  const id = (await como(pg, "service_role", null, () => pg.query(evento(A, "loja-a")))).rows[0].id;
  // 1ª camada: a service role não tem privilégio de alterar/apagar
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("update public.intelligence_eventos set comando = 'x' where id = $1", [id])), /permission denied/);
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("delete from public.intelligence_eventos where id = $1", [id])), /permission denied/);
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("truncate public.intelligence_eventos")), /permission denied/);
  // 2ª camada: nem o dono do banco altera (trigger)
  await assert.rejects(() => pg.query("update public.intelligence_eventos set comando = 'x' where id = $1", [id]), /imutável/);
  await assert.rejects(() => pg.query("delete from public.intelligence_eventos where id = $1", [id]), /imutável/);
  await assert.rejects(() => pg.query("truncate public.intelligence_eventos"), /imutável/);
});

test("usuário do app não escreve; lê só o próprio (empresa B não vê A); anônimo não lê", { skip: pular }, async () => {
  const pg = await aplicado();
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
  const pg = await aplicado();
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
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("delete from public.intelligence_acoes where id = $1", [id])), /permission denied/);
});

test("feedback estruturado: pergunta, entidade e evidência com limite de tamanho", { skip: pular }, async () => {
  const pg = await aplicado();
  const ins = (extra = "", valores = "") => como(pg, "service_role", null, () => pg.query(`insert into public.intelligence_feedback (unidade_id, auth_user_id, insight_id, insight_tipo, resposta, opcao_id${extra})
    values ('loja-a', '${A}', 'divergencia:abc12345', 'divergencia', 'opcao', 'erro_contagem'${valores}) returning id`));
  await ins(", pergunta_id, entidade_tipo, entidade_id, contexto", `, 'divergencia:abc12345', 'produto', 'insumo-1', '{"diferenca": -3.6, "unidade": "kg"}'`);
  await assert.rejects(() => ins(", contexto", `, '${JSON.stringify({ x: "a".repeat(5000) })}'`), /check constraint/);
  await assert.rejects(() => ins(", contexto", ", '[1,2]'"), /check constraint/);
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query(`insert into public.intelligence_feedback (unidade_id, auth_user_id, insight_id, insight_tipo, resposta, comentario) values ('loja-a', '${A}', 'x:00000000', 'x', 'opcao', repeat('a', 301))`)), /check constraint/);
});

test("preferências e metas: valores válidos e leitura só por quem abre a Central da unidade", { skip: pular }, async () => {
  const pg = await aplicado();
  await como(pg, "service_role", null, () => pg.query(`insert into public.intelligence_preferencias (unidade_id, meta_faturamento_mensal, sensibilidade) values ('loja-a', 120000, 'alta'), ('loja-b', null, 'normal')`));
  const linha = (await pg.query("select alertas, sensibilidade, meta_faturamento_diaria from public.intelligence_preferencias where unidade_id = 'loja-a'")).rows[0];
  assert.deepEqual(linha.alertas, { estoque: true, financeiro: true, compras: true, rh: true, vendas: true });
  assert.equal(linha.meta_faturamento_diaria, null, "meta diária não é inventada");
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("update public.intelligence_preferencias set meta_faturamento_mensal = 0 where unidade_id = 'loja-a'")), /check constraint/);
  await assert.rejects(() => como(pg, "service_role", null, () => pg.query("update public.intelligence_preferencias set sensibilidade = 'maxima' where unidade_id = 'loja-a'")), /check constraint/);
  const deA = await como(pg, "authenticated", A, () => pg.query("select unidade_id from public.intelligence_preferencias"));
  assert.deepEqual(deA.rows.map((x) => x.unidade_id), ["loja-a"]);
  const deB = await como(pg, "authenticated", B, () => pg.query("select unidade_id from public.intelligence_preferencias"));
  assert.deepEqual(deB.rows.map((x) => x.unidade_id), ["loja-b"]);
});

// ─── Funções de acesso REAIS do repositório (1B + RBAC) ──────────────────────
// hefisto_user_can vem de docs/controle-acesso-rbac.sql; as funções que ela
// chama, de db/1b/01_contexto_escopo_concessao.sql (a versão em vigor depois
// da Fase 1B). Isto prova o COMPORTAMENTO do código do repositório; o banco
// real pode ter outra versão — confira com IC_01_PREFLIGHT.sql (coluna definicao).

function funcaoDoRepositorio(fonte, nome) {
  const m = fonte.match(new RegExp(`create or replace function public\\.${nome}\\([\\s\\S]*?\\n\\$\\$;`));
  assert.ok(m, `função ${nome} não encontrada no repositório`);
  return m[0];
}

async function bancoComAcessoReal() {
  const rbac = ler("docs", "controle-acesso-rbac.sql");
  const f1b = ler("db", "1b", "01_contexto_escopo_concessao.sql");
  const pg = await pglite();
  await pg.exec(`
    ${PAPEIS_SUPABASE}
    create table public.empresas (id uuid primary key default gen_random_uuid(), nome text);
    create table public.unidades (id text primary key, empresa_id uuid references public.empresas(id));
    create table public.perfis_acesso (id uuid primary key default gen_random_uuid(), codigo text, ativo boolean not null default true);
    create table public.perfil_permissoes (perfil_id uuid references public.perfis_acesso(id), permission_key text, primary key (perfil_id, permission_key));
    create table public.usuarios_erp (
      id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, nome text, login text,
      status text not null default 'ativo', tipo_acesso text not null default 'funcionario', perfil_id uuid references public.perfis_acesso(id),
      super_admin boolean not null default false, unidade_principal_id text references public.unidades(id),
      timezone text not null default 'America/Sao_Paulo', allowed_days smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
      allowed_start_time time, allowed_end_time time, locked_until timestamptz, valid_from timestamptz, valid_until timestamptz);
    create table public.usuario_permissoes (usuario_id uuid references public.usuarios_erp(id), permission_key text, effect text not null default 'allow', primary key (usuario_id, permission_key));
    create table public.usuario_escopos (id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuarios_erp(id),
      empresa_id uuid, unidade_id text, setor_id uuid, data_scope text not null default 'unidade');
    ${funcaoDoRepositorio(rbac, "hefisto_permission_match")}
    ${funcaoDoRepositorio(f1b, "hefisto_usuario_valido")}
    ${funcaoDoRepositorio(f1b, "hefisto_tem_alguma_permissao")}
    ${funcaoDoRepositorio(f1b, "hefisto_user_has_permission")}
    ${funcaoDoRepositorio(f1b, "hefisto_unidades_do_usuario")}
    ${funcaoDoRepositorio(f1b, "hefisto_user_in_unit")}
    ${funcaoDoRepositorio(rbac, "hefisto_user_can")}
    grant execute on function public.hefisto_user_can(text, text) to authenticated;
    grant execute on function public.hefisto_user_in_unit(uuid, text) to authenticated;

    insert into public.empresas (id, nome) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'Empresa A'), ('bbbbbbbb-0000-4000-8000-00000000000b', 'Empresa B');
    insert into public.unidades values ('loja-a', 'aaaaaaaa-0000-4000-8000-00000000000a'), ('loja-a2', 'aaaaaaaa-0000-4000-8000-00000000000a'), ('loja-b', 'bbbbbbbb-0000-4000-8000-00000000000b');
    -- presets do docs/controle-acesso-rbac.sql
    insert into public.perfis_acesso (codigo) values ('administrador-geral'), ('gerente-geral'), ('financeiro'), ('garcom'), ('gerente-editado');
    insert into public.perfis_acesso (codigo, ativo) values ('gerente-desativado', false);
    insert into public.perfil_permissoes select id, k from public.perfis_acesso, unnest(case codigo
      when 'administrador-geral' then array['*']
      when 'gerente-geral' then array['dashboard.*','estoque.*','financeiro.*']
      when 'gerente-desativado' then array['dashboard.*']
      when 'financeiro' then array['financeiro.*','relatorios.*','dashboard.overview.view','dashboard.overview.view_values']
      when 'garcom' then array['salao.overview.view','salao.tables.*']
      when 'gerente-editado' then array['dashboard.overview.view','estoque.overview.view']
    end) k;
  `);
  const perfil = (c) => `(select id from public.perfis_acesso where codigo = '${c}')`;
  const usuarios = {
    dono:              `true,  'administrador', ${perfil("administrador-geral")}, 'loja-a'`,
    super_admin:       `true,  'administrador', null, 'loja-a'`,
    admin_empresa:     `false, 'administrador', ${perfil("administrador-geral")}, 'loja-a'`,
    gerente:           `false, 'gerente', ${perfil("gerente-geral")}, 'loja-a'`,
    gerente_editado:   `false, 'gerente', ${perfil("gerente-editado")}, 'loja-a'`,
    gerente_negado:    `false, 'gerente', ${perfil("gerente-geral")}, 'loja-a'`,
    gerente_desativado:`false, 'gerente', ${perfil("gerente-desativado")}, 'loja-a'`,
    financeiro:        `false, 'funcionario', ${perfil("financeiro")}, 'loja-a'`,
    comum:             `false, 'funcionario', ${perfil("garcom")}, 'loja-a'`,
    gerente_b:         `false, 'gerente', ${perfil("gerente-geral")}, 'loja-b'`,
  };
  const ids = {};
  let n = 1;
  for (const [nome, cols] of Object.entries(usuarios)) {
    const uid = `00000000-0000-4000-8000-${String(n++).padStart(12, "0")}`;
    ids[nome] = uid;
    await pg.exec(`insert into public.usuarios_erp (auth_user_id, nome, login, super_admin, tipo_acesso, perfil_id, unidade_principal_id) values ('${uid}', '${nome}', '${nome}', ${cols})`);
  }
  await pg.exec(`insert into public.usuario_permissoes (usuario_id, permission_key, effect)
    select id, 'dashboard.intelligence.view', 'deny' from public.usuarios_erp where login = 'gerente_negado'`);
  await pg.exec(`insert into public.usuario_escopos (usuario_id, data_scope, empresa_id)
    select id, 'empresa', 'aaaaaaaa-0000-4000-8000-00000000000a' from public.usuarios_erp where login = 'admin_empresa'`);
  return { pg, ids };
}

test("hefisto_user_can do repositório: quem abre a Central (dono, super admin, admin, gerente) e quem não", { skip: pular }, async () => {
  const { pg, ids } = await bancoComAcessoReal();
  const pode = async (quem, chave, unidade) => (await como(pg, "authenticated", ids[quem], () => pg.query("select public.hefisto_user_can($1, $2) as ok", [chave, unidade]))).rows[0].ok;
  const ver = "dashboard.intelligence.view";
  const configurar = "dashboard.intelligence.settings";
  const esperado = {
    dono: [true, true], super_admin: [true, true], admin_empresa: [true, true], gerente: [true, true],
    gerente_editado: [false, false], gerente_negado: [false, true], gerente_desativado: [false, false],
    financeiro: [false, false], comum: [false, false],
  };
  for (const [quem, [v, c]] of Object.entries(esperado)) {
    assert.equal(await pode(quem, ver, "loja-a"), v, `${quem} ver`);
    assert.equal(await pode(quem, configurar, "loja-a"), c, `${quem} configurar`);
  }
  // escopo: gerente da A não abre a Central da B; admin com escopo "empresa" vê só a própria empresa
  assert.equal(await pode("gerente", ver, "loja-b"), false);
  assert.equal(await pode("gerente_b", ver, "loja-b"), true);
  assert.equal(await pode("admin_empresa", ver, "loja-a2"), true);
  assert.equal(await pode("admin_empresa", ver, "loja-b"), false);
  assert.equal(await pode("super_admin", ver, "loja-b"), true, "super admin enxerga todas as unidades");
  // sem login não passa
  assert.equal((await como(pg, "authenticated", null, () => pg.query("select public.hefisto_user_can($1, 'loja-a') as ok", [ver]))).rows[0].ok, false);
});

test("matriz de permissões (IC_01_PERMISSOES.sql) roda só leitura e conta sem nomes", { skip: pular }, async () => {
  const { pg } = await bancoComAcessoReal();
  const r = await somenteLeitura(pg, PERMISSOES);
  const por = Object.fromEntries(r.rows.map((x) => [`${x.perfil}/${x.tipo_acesso}`, x]));
  assert.equal(Number(por["super_admin/administrador"].ve_central), 2, "dono + super admin");
  assert.equal(Number(por["administrador-geral/administrador"].ve_central), 1);
  assert.equal(Number(por["gerente-geral/gerente"].usuarios_ativos), 3);
  assert.equal(Number(por["gerente-geral/gerente"].ve_central), 2, "o gerente com negação explícita fica de fora");
  assert.equal(Number(por["garcom/funcionario"].ve_central), 0);
  assert.equal(Number(por["financeiro/funcionario"].ve_central), 0);
  for (const linha of r.rows) assert.ok(!("login" in linha) && !("nome" in linha) && !("email" in linha));
});
