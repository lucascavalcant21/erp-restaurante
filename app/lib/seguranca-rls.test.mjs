// SEC-RLS-1 (HDEV-SEC-001): isolamento por unidade com o SQL REAL da migração, no PGlite.
// Reproduz as policies de produção (lidas em 08/10/2026): USING (true), WITH CHECK (true),
// "auth.role() = 'authenticated'", "… OR unidade_id IS NULL" e RLS desligado em
// colaboradores/registro_ponto. Duas unidades, usuários de cada tipo.
// Sem PGLITE os testes de banco PULAM (não validam): PGLITE=… node --test app/lib/seguranca-rls.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classificarMigracao, rollbackIrmao } from "../../scripts/hefisto-agent/politica.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRACAO = fs.readFileSync(path.join(raiz, "db", "security", "SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql"), "utf8");
const ROLLBACK = fs.readFileSync(path.join(raiz, "db", "security", "SEC_RLS_1_ROLLBACK.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

const ALVO = [...MIGRACAO.matchAll(/^\s+(\('[a-z_]+'\)(?:, \('[a-z_]+'\))*)[,;]\s*$/gm)].flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
const NAO_NULA = new Set(["estoques", "rh_recibos_prestacao"]);
const RLS_DESLIGADO = new Set(["colaboradores", "registro_ponto"]);

const U = {
  a: "aaaaaaaa-0000-0000-0000-000000000001",      // unidade principal seldeestrela
  b: "bbbbbbbb-0000-0000-0000-000000000002",      // unidade principal outra
  admin: "cccccccc-0000-0000-0000-000000000003",  // super_admin, sem unidade principal (como o real)
  escopo: "dddddddd-0000-0000-0000-000000000004", // sem principal, escopo de unidade 'outra'
  inativo: "eeeeeeee-0000-0000-0000-000000000005",
  bloqueado: "ffffffff-0000-0000-0000-000000000006",
  empresa: "99999999-0000-0000-0000-000000000007", // só escopo 'empresa' (falha fechada)
};

function policiesDeProducao(t) {
  if (t === "cupons" || t === "observacoes_padrao") {
    return `create policy aberta_logados on public.${t} for all to public using (auth.role() = 'authenticated'::text);`;
  }
  const rlsUnidade = `create policy rls_unidade on public.${t} for all to authenticated
      using (pode_ver_todas() or (unidade_id = auth_unidade_id()) or (unidade_id is null))
      with check (pode_ver_todas() or (unidade_id = auth_unidade_id()) or (unidade_id is null));`;
  if (["etiquetas", "vendas", "venda_itens"].includes(t)) return `${rlsUnidade}
      create policy auth_all on public.${t} for all to authenticated using (true) with check (true);`;
  if (t === "clientes") return `${rlsUnidade}
      create policy "Liberar para logados" on public.${t} for all to public using (auth.role() = 'authenticated'::text);`;
  // só "… OR unidade_id IS NULL": a linha sem unidade fica visível para qualquer empresa
  if (["advertencias", "avaliacoes_nps", "avisos", "campanhas", "cardapio", "cursos", "func_documentos"].includes(t)) return rlsUnidade;
  if (t === "mesas" || t === "producoes") {
    return `create policy "Liberar para logados" on public.${t} for all to public using (auth.role() = 'authenticated'::text);
      create policy "Acesso Total" on public.${t} for all to public using (true);`;
  }
  if (t === "ponto_marcacao") {
    return `create policy ponto_marcacao_inserir on public.${t} for insert to public with check (true);
      create policy ponto_marcacao_ler on public.${t} for select to public using (true);`;
  }
  if (t === "candidatos") {
    return `create policy "Acesso Total Candidatos" on public.${t} for all to public using (true);
      create policy candidatos_insert_publico on public.${t} for insert to anon with check (true);`;
  }
  return `create policy "Acesso Total" on public.${t} for all to public using (true) with check (true);`;
}

async function banco({ extra = "" } = {}) {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select case when auth.uid() is null then 'anon' else 'authenticated' end $$;
    grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
    create table public.unidades (id text primary key, nome text);
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, status text default 'ativo',
      super_admin boolean default false, unidade_principal_id text, unidade_id text, locked_until timestamptz);
    create table public.usuario_escopos (id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuarios_erp(id), data_scope text, unidade_id text);
    -- funções como estão em produção (usadas pelas policies rls_unidade antigas)
    create function public.pode_ver_todas() returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo'
        and (u.super_admin or exists (select 1 from usuario_escopos e where e.usuario_id = u.id and e.data_scope in ('todos','empresa')))) $$;
    create function public.auth_unidade_id() returns text language sql stable security definer set search_path = public as $$
      select coalesce((select u.unidade_principal_id from usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' and u.unidade_principal_id is not null limit 1), '') $$;
    insert into public.unidades values ('seldeestrela', 'Sal de Estrela'), ('outra', 'Outra empresa');
    insert into public.usuarios_erp (auth_user_id, unidade_principal_id, super_admin, status, locked_until) values
      ('${U.a}', 'seldeestrela', false, 'ativo', null), ('${U.b}', 'outra', false, 'ativo', null), ('${U.admin}', null, true, 'ativo', null),
      ('${U.escopo}', null, false, 'ativo', null), ('${U.inativo}', 'seldeestrela', false, 'inativo', null),
      ('${U.bloqueado}', 'seldeestrela', false, 'ativo', now() + interval '1 day');
    insert into public.usuario_escopos (usuario_id, data_scope, unidade_id)
      select id, 'unidade', 'outra' from public.usuarios_erp where auth_user_id = '${U.escopo}';
  `);
  for (const t of ALVO) {
    await pg.exec(`
      create table public.${t} (id serial primary key, unidade_id text ${NAO_NULA.has(t) ? "not null" : ""}, nome text);
      grant select, insert, update, delete on public.${t} to authenticated;
      grant usage on sequence public.${t}_id_seq to authenticated;
      ${RLS_DESLIGADO.has(t) ? "" : `alter table public.${t} enable row level security;`}
      ${policiesDeProducao(t)}
      insert into public.${t} (unidade_id, nome) values ('seldeestrela', 'dado A'), ('outra', 'dado B');
    `);
  }
  if (extra) await pg.exec(extra);
  return pg;
}

async function como(pg, uid, sql, params = []) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  await pg.exec(uid ? "set role authenticated" : "set role anon");
  try { return await pg.query(sql, params); } finally { await pg.exec("reset role"); }
}
const unidadesVistas = async (pg, uid, t) => (await como(pg, uid, `select coalesce(string_agg(distinct unidade_id, ',' order by unidade_id), '') u from public.${t}`)).rows[0].u;
const erro = async (p) => { try { await p; return null; } catch (e) { return e.message; } };

test("a migração cobre as 88 tabelas da fase 1 (lista lida do próprio SQL)", () => {
  assert.equal(ALVO.length, 88);
  assert.equal(new Set(ALVO).size, 88);
  for (const t of ["colaboradores", "registro_ponto", "insumos", "rh_recibos_prestacao", "ponto_marcacao"]) assert.ok(ALVO.includes(t), t);
  for (const t of ["notas_fiscais", "montagem", "eventos", "usuarios_erp", "fichas_ingredientes"]) assert.ok(!ALVO.includes(t), `${t} fica para a fase 2`);
});

test("política de publicação: a migração é REVIEW (não insegura), com rollback irmão; o rollback é CRITICAL", () => {
  const m = classificarMigracao(MIGRACAO);
  assert.equal(m.rlsInseguro, false);
  assert.notEqual(m.classe, "SAFE", "troca RLS em produção: exige o dono");
  assert.equal(rollbackIrmao("SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql", fs.readdirSync(path.join(raiz, "db", "security"))), "SEC_RLS_1_ROLLBACK.sql");
  assert.equal(classificarMigracao(ROLLBACK).rlsInseguro, true, "o rollback reabre o RLS: CRITICAL");
});

test("ANTES (estado de produção): usuário de outra unidade lê colaboradores, ponto e insumos da Sal de Estrela", { skip: pular }, async () => {
  const pg = await banco();
  for (const t of ["colaboradores", "registro_ponto", "insumos", "rh_recibos_prestacao", "etiquetas", "mesas"]) {
    assert.equal(await unidadesVistas(pg, U.b, t), "outra,seldeestrela", t);
  }
  assert.equal(await erro(como(pg, U.b, "insert into public.insumos (unidade_id, nome) values ('seldeestrela', 'invasão')")), null, "e grava na unidade dos outros");
});

test("DEPOIS: cada usuário vê e grava só a própria unidade, nas 88 tabelas", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(MIGRACAO);
  // escopo 'empresa' criado depois (o preflight recusaria: esse usuário perderia o acesso)
  await pg.exec(`insert into public.usuarios_erp (auth_user_id) values ('${U.empresa}');
    insert into public.usuario_escopos (usuario_id, data_scope) select id, 'empresa' from public.usuarios_erp where auth_user_id = '${U.empresa}';`);
  for (const t of ALVO) {
    assert.equal(await unidadesVistas(pg, U.a, t), "seldeestrela", `A em ${t}`);
    assert.equal(await unidadesVistas(pg, U.b, t), "outra", `B em ${t}`);
    assert.equal(await unidadesVistas(pg, U.admin, t), "outra,seldeestrela", `admin em ${t}`);
  }
  assert.equal(await unidadesVistas(pg, U.escopo, "colaboradores"), "outra", "escopo de unidade");
  for (const quem of ["inativo", "bloqueado", "empresa"]) assert.equal(await unidadesVistas(pg, U[quem], "colaboradores"), "", `${quem} não vê nada`);
  assert.match(await erro(como(pg, U.a, "insert into public.colaboradores (unidade_id, nome) values ('outra', 'x')")), /row-level security/);
  assert.match(await erro(como(pg, U.a, "update public.insumos set unidade_id = 'outra' where unidade_id = 'seldeestrela'")), /row-level security/);
  assert.equal((await como(pg, U.a, "update public.insumos set nome = 'y' where unidade_id = 'outra' returning id")).rows.length, 0, "não altera a outra unidade");
  assert.equal((await como(pg, U.a, "delete from public.registro_ponto where unidade_id = 'outra' returning id")).rows.length, 0, "não apaga a outra unidade");
  // tela que não manda a unidade continua funcionando: recebe a unidade do usuário
  const novo = await como(pg, U.a, "insert into public.insumos (nome) values ('sem unidade') returning unidade_id");
  assert.equal(novo.rows[0].unidade_id, "seldeestrela");
  assert.match(await erro(como(pg, null, "select * from public.colaboradores")), /permission denied/, "anon sem grant (como em produção)");
  const rls = (await pg.query("select relname, relrowsecurity from pg_class where relname in ('colaboradores','registro_ponto')")).rows;
  assert.ok(rls.every((r) => r.relrowsecurity), "RLS ligado em colaboradores e registro_ponto");
  assert.equal((await pg.query("select count(*)::int n from pg_policies where schemaname = 'public' and qual ~* '^\\(?\\s*true\\s*\\)?$'")).rows[0].n, 0);
  assert.equal((await pg.query("select count(*)::int n from public.sec_backup_policies_sec_rls_1")).rows[0].n, 88 + 8, "backup de todas as policies antigas (8 tabelas têm 2)");
  assert.match(await erro(pg.exec(MIGRACAO)), /já aplicada/, "reaplicar aborta");
});

test("preflight aborta SEM mudar nada: dado órfão, policy desconhecida, usuário sem unidade", { skip: pular }, async () => {
  for (const [extra, motivo] of [
    ["insert into public.controle_gas (unidade_id, nome) values ('burguer', 'órfão');", /controle_gas tem 1 linha\(s\) sem unidade válida/],
    ["insert into public.insumos (unidade_id, nome) values (null, 'nulo');", /insumos tem 1 linha/],
    ["create policy so_gerente on public.produtos for select to authenticated using (auth.uid() is not null and nome <> 'x');", /policy desconhecida "so_gerente" em public.produtos/],
    ["insert into public.usuarios_erp (auth_user_id, status) values (gen_random_uuid(), 'ativo');", /1 usuário\(s\) ativo\(s\) sem unidade/],
  ]) {
    const pg = await banco({ extra });
    assert.match(await erro(pg.exec(MIGRACAO)), motivo);
    await pg.exec("rollback").catch(() => {});
    assert.equal(await unidadesVistas(pg, U.b, "colaboradores"), "outra,seldeestrela", "nada mudou");
    assert.equal((await pg.query("select to_regclass('public.sec_backup_policies_sec_rls_1') t")).rows[0].t, null);
  }
});

test("ROLLBACK volta exatamente ao estado aberto de antes", { skip: pular }, async () => {
  const pg = await banco();
  const antes = (await pg.query("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2")).rows;
  await pg.exec(MIGRACAO);
  await pg.exec(ROLLBACK);
  const depois = (await pg.query("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2")).rows;
  assert.deepEqual(depois, antes);
  const rls = (await pg.query("select relname from pg_class where relname in ('colaboradores','registro_ponto') and relrowsecurity")).rows;
  assert.equal(rls.length, 0, "RLS desligado de novo, como estava");
  assert.equal(await unidadesVistas(pg, U.b, "colaboradores"), "outra,seldeestrela");
  assert.equal((await pg.query("select count(*)::int n from pg_trigger where tgname = 'sec_unidade_padrao'")).rows[0].n, 0);
});

// ─── TRAVAS CONTRA REGRESSÃO (rodam sem PGLITE, toda rodada do agente) ──────

// Arquivos antigos que JÁ criam policy aberta ou desligam RLS (08/10/2026). Estão congelados:
// a política de publicação os marca BLOCKED se alguém tentar reaplicar. Um arquivo NOVO
// inseguro faz este teste falhar. Para tirar um daqui, corrija o arquivo (não aumente a lista).
const LEGADO_INSEGURO = new Set([
  "db/avulsos_locais/IMPORTAR_PONTO_AGOSTO.sql", "db/ESSENCIAL_AGORA.sql", "db/F2_1_FUNDACAO_FINANCEIRA.sql", "db/IMPORTAR_PONTO_AGOSTO.sql",
  "db/migracao_atestados.sql", "db/migracao_auditoria_correcao.sql", "db/migracao_central_comando.sql", "db/migracao_compras_recebimento.sql",
  "db/migracao_comprovante_envio.sql", "db/migracao_controle_acesso.sql", "db/migracao_espelho_fechado.sql", "db/migracao_estoque_lotes.sql",
  "db/migracao_ficha_custo_historico.sql", "db/migracao_ficha_tecnica_completa.sql", "db/migracao_financeiro_integrado.sql",
  "db/migracao_guias_operacionais.sql", "db/migracao_hefisto_auditoria.sql", "db/migracao_integracoes_canonica.sql", "db/migracao_listas_etiquetas.sql",
  "db/migracao_memorandos_operacao.sql", "db/migracao_operacao_inteligente.sql", "db/migracao_ponto_nsr.sql", "db/migracao_portal_extras.sql",
  "db/migracao_portal_vagas_publico.sql", "db/migracao_recibos_prestacao.sql", "db/migracao_rls_autorizacao_servidor.sql",
  "db/migracao_vendas_recebiveis_conciliacao.sql", "db/TODAS_AS_MIGRACOES.sql",
  "db/security/SEC_RLS_1_ROLLBACK.sql", // rollback: reabre de propósito, só com o dono
]);

function arquivosSql(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const p = path.join(dir, f.name);
    return f.isDirectory() ? arquivosSql(p) : p.endsWith(".sql") ? [path.relative(raiz, p).split(path.sep).join("/")] : [];
  });
}

test("trava: nenhum SQL NOVO no repositório cria policy aberta ou desliga RLS", () => {
  const inseguros = arquivosSql(path.join(raiz, "db")).filter((f) => classificarMigracao(fs.readFileSync(path.join(raiz, f), "utf8")).rlsInseguro);
  const novos = inseguros.filter((f) => !LEGADO_INSEGURO.has(f));
  assert.deepEqual(novos, [], `SQL novo com policy aberta (true / auth.role() = 'authenticated') ou RLS desligado: ${novos.join(", ")}. Use a policy sec_unidade da SEC-RLS-1.`);
  const consertados = [...LEGADO_INSEGURO].filter((f) => !inseguros.includes(f));
  assert.deepEqual(consertados, [], `já não é inseguro (ou sumiu): tire da lista LEGADO_INSEGURO: ${consertados.join(", ")}`);
});

test("trava: a auditoria do banco real conhece exatamente as tabelas da SEC-RLS-1 e passa pela guarda da noite", async () => {
  const sql = fs.readFileSync(path.join(raiz, "db", "security", "AUDITORIA_RLS.sql"), "utf8");
  const aguarda = [...sql.matchAll(/\('([a-z_]+)', 'aguarda SEC-RLS-1'\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(aguarda, [...ALVO].sort(), "lista da auditoria = lista da migração");
  const { avaliarSql } = await import("../../scripts/hefisto-agent/guarda-sql.mjs");
  const r = avaliarSql(sql, { projetos: ["sezccspqxgklicfndwxx"], projeto: "sezccspqxgklicfndwxx" });
  assert.equal(r.ok, true, r.motivo);
  assert.match(sql, /NOVO: REGRESSÃO/);
});