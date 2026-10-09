// SEC-RLS-2 (HDEV-SEC-002): fase 2 do isolamento, com o SQL REAL da SEC-RLS-1 e da SEC-RLS-2 no PGlite.
// Estado de partida = produção em 08/10/2026 (policies abertas das 33 tabelas, lidas no banco real).
// Duas empresas (E1: seldeestrela + filial; E2: outra). Sem PGLITE os testes de banco PULAM.
//   PGLITE=… node --test app/lib/seguranca-rls-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classificarMigracao, rollbackIrmao } from "../../scripts/hefisto-agent/politica.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f) => fs.readFileSync(path.join(raiz, "db", "security", f), "utf8");
const FASE1 = ler("SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql");
const FASE2 = ler("SEC_RLS_2_FASE2.sql");
const ROLLBACK2 = ler("SEC_RLS_2_ROLLBACK.sql");
const REATRIBUIR = ler("SEC_RLS_2_REATRIBUIR_EVENTO.sql");
const pular = !process.env.PGLITE && "PGLITE não informado";

const FASE1_TABELAS = [...FASE1.matchAll(/^\s+(\('[a-z_]+'\)(?:, \('[a-z_]+'\))*)[,;]\s*$/gm)].flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
const E1 = "e1e1e1e1-0000-0000-0000-000000000001";
const E2 = "e2e2e2e2-0000-0000-0000-000000000002";
const U = {
  super: "00000000-0000-0000-0000-00000000000a",
  dono: "00000000-0000-0000-0000-00000000000b",     // escopo empresa E1, perfil administrador-geral
  gerente: "00000000-0000-0000-0000-00000000000c",  // seldeestrela, gerente-geral (rh.*, configuracoes.units.*)
  rhB: "00000000-0000-0000-0000-00000000000d",      // outra (empresa E2), recursos-humanos
  a1: "00000000-0000-0000-0000-00000000000e",       // seldeestrela, cozinheiro, ligado ao colaborador A1
  a2: "00000000-0000-0000-0000-00000000000f",       // seldeestrela, somente-consulta, ligado ao colaborador A2
  todos: "00000000-0000-0000-0000-000000000010",    // filial, escopo 'todos' (antes: via TODAS as empresas)
};
const C = { a1: "c0000000-0000-0000-0000-0000000000a1", a2: "c0000000-0000-0000-0000-0000000000a2", b1: "c0000000-0000-0000-0000-0000000000b1", f1: "c0000000-0000-0000-0000-0000000000f1" };
const EV = { a: "e0000000-0000-0000-0000-00000000000a", b: "e0000000-0000-0000-0000-00000000000b", nulo: "503556ac-ed46-466c-a657-17bfe7bc1b39" };

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select case when auth.uid() is null then 'anon' else 'authenticated' end $$;
    grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

    create table public.empresas (id uuid primary key, nome text);
    insert into public.empresas values ('${E1}', 'Hefisto'), ('${E2}', 'Outra empresa');
    create table public.unidades (id text primary key, nome text, cnpj text, token_nfe text, ambiente_nfe text, empresa_id uuid references public.empresas(id));
    insert into public.unidades values ('seldeestrela', 'Sal de Estrela', '42021920000136', 'segredo-a', 'Producao', '${E1}'),
      ('filial', 'Filial', null, null, null, '${E1}'), ('outra', 'Outra', '99', 'segredo-b', 'Producao', '${E2}');
    create table public.perfis_acesso (id uuid primary key default gen_random_uuid(), codigo text unique, nome text, sistema boolean default true);
    create table public.perfil_permissoes (perfil_id uuid references public.perfis_acesso(id), permission_key text);
    insert into public.perfis_acesso (codigo, nome, sistema) values ('administrador-geral', 'Adm', true), ('gerente-geral', 'Gerente', true),
      ('recursos-humanos', 'RH', true), ('cozinheiro', 'Cozinheiro', true), ('somente-consulta', 'Consulta', true), ('perfil-da-empresa-b', 'Custom B', false);
    insert into public.perfil_permissoes select id, k from public.perfis_acesso p, lateral (values
      ('administrador-geral', '*'), ('gerente-geral', 'rh.*'), ('gerente-geral', 'configuracoes.units.*'), ('gerente-geral', 'configuracoes.users.*'),
      ('recursos-humanos', 'rh.*'), ('cozinheiro', 'cozinha.*'), ('somente-consulta', 'dashboard.overview.view')) v(cod, k) where p.codigo = v.cod;
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, nome text, email text, status text default 'ativo',
      super_admin boolean default false, unidade_principal_id text, unidade_id text, perfil_id uuid, colaborador_id uuid, funcionario_id uuid,
      locked_until timestamptz, valid_from timestamptz, valid_until timestamptz, timezone text, allowed_days smallint[], allowed_start_time time, allowed_end_time time);
    create table public.usuario_escopos (id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuarios_erp(id),
      empresa_id uuid, unidade_id text, setor_id uuid, data_scope text);
    create table public.usuario_permissoes (usuario_id uuid, permission_key text, effect text);
    create function public.hefisto_permission_match(granted text, wanted text) returns boolean language sql immutable as $$
      select granted = '*' or granted = wanted or granted = split_part(wanted,'.',1) || '.*' or granted = split_part(wanted,'.',1) || '.' || split_part(wanted,'.',2) || '.*' $$;
    -- como em produção (08/10/2026)
    create function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text) returns boolean language plpgsql stable security definer set search_path = public as $$
    declare v_user usuarios_erp%rowtype; begin
      select * into v_user from usuarios_erp where auth_user_id = p_auth_user_id;
      if not found or v_user.status <> 'ativo' then return false; end if;
      if v_user.locked_until is not null and v_user.locked_until > now() then return false; end if;
      if v_user.super_admin then return true; end if;
      if exists (select 1 from usuario_permissoes up where up.usuario_id = v_user.id and up.effect = 'deny' and hefisto_permission_match(up.permission_key, p_permission)) then return false; end if;
      return exists (select 1 from usuario_permissoes up where up.usuario_id = v_user.id and up.effect = 'allow' and hefisto_permission_match(up.permission_key, p_permission))
        or exists (select 1 from perfil_permissoes pp where pp.perfil_id = v_user.perfil_id and hefisto_permission_match(pp.permission_key, p_permission));
    end $$;
    create function public.pode_ver_todas() returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo'
        and (u.super_admin or exists (select 1 from usuario_escopos e where e.usuario_id = u.id and e.data_scope in ('todos','empresa')))) $$;
    create function public.auth_unidade_id() returns text language sql stable security definer set search_path = public as $$
      select coalesce((select u.unidade_principal_id from usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' and u.unidade_principal_id is not null limit 1), '') $$;
    -- tabela no padrão antigo (como compras/contas_pagar): só pode_ver_todas() OU a unidade principal
    create table public.compras (id uuid primary key default gen_random_uuid(), unidade_id text);
    alter table public.compras enable row level security;
    create policy compras_unidade_f21 on public.compras for all to authenticated using (pode_ver_todas() or unidade_id = auth_unidade_id()) with check (pode_ver_todas() or unidade_id = auth_unidade_id());
    insert into public.compras (unidade_id) values ('seldeestrela'), ('filial'), ('outra');
  `);
  // as 88 tabelas da fase 1 (abertas, como estavam), com id uuid; colaboradores com os campos sensíveis
  for (const t of FASE1_TABELAS) {
    const extra = t === "colaboradores" ? ", cargo text, cpf text, salario numeric, rg text, chave_pix text, face_descritores jsonb, horario_entrada text, status text" : "";
    await pg.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), unidade_id text, nome text${extra});
      create policy "Acesso Total" on public.${t} for all to public using (true) with check (true);
      ${t === "colaboradores" ? "" : `alter table public.${t} enable row level security;
      insert into public.${t} (unidade_id, nome) values ('seldeestrela', 'dado A'), ('outra', 'dado B');`}`);
  }
  await pg.exec(`insert into public.colaboradores (id, unidade_id, nome, cargo, cpf, salario, rg, chave_pix, face_descritores, horario_entrada, status) values
    ('${C.a1}', 'seldeestrela', 'Ana', 'Cozinheira', '111', 1000, 'RG1', 'pix1', '[[0.1]]', '15:40', 'ativo'),
    ('${C.a2}', 'seldeestrela', 'Beto', 'Garçom', '222', 2000, 'RG2', 'pix2', null, '16:00', 'ativo'),
    ('${C.b1}', 'outra', 'Caio', 'Caixa', '333', 3000, 'RG3', 'pix3', null, '10:00', 'ativo'),
    ('${C.f1}', 'filial', 'Duda', 'Bar', '444', 4000, 'RG4', 'pix4', null, '18:00', 'ativo');`);
  // as 33 da fase 2, com as policies de produção
  await pg.exec(`
    create table public.eventos (id uuid primary key default gen_random_uuid(), unidade_id text references public.unidades(id), nome text, tag text);
    alter table public.eventos enable row level security;
    create policy "Liberar para logados" on public.eventos for all to public using (auth.role() = 'authenticated'::text);
    create policy auth_all on public.eventos for all to authenticated using (true) with check (true);
    create policy rls_unidade on public.eventos for all to authenticated using (pode_ver_todas() or (unidade_id = auth_unidade_id()) or (unidade_id is null))
      with check (pode_ver_todas() or (unidade_id = auth_unidade_id()) or (unidade_id is null));
    insert into public.eventos values ('${EV.a}', 'seldeestrela', 'Casamento', null), ('${EV.b}', 'outra', 'Festa B', null), ('${EV.nulo}', null, 'Dia dos namorados', 'Seldeestrela');
  `);
  for (const t of ["evento_compras", "evento_custos_fixos", "evento_drinks", "evento_ingredientes", "evento_pratos", "evento_preparos", "evento_reservas"]) {
    await pg.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), evento_id uuid references public.eventos(id), nome text);
      alter table public.${t} enable row level security;
      create policy auth_all on public.${t} for all to authenticated using (true) with check (true);
      insert into public.${t} (evento_id, nome) values ('${EV.a}', 'de A'), ('${EV.b}', 'de B'), ('${EV.nulo}', 'do legado'), (null, 'sem evento');`);
  }
  const filhas = [["fichas_ingredientes", "ficha_id", "fichas_tecnicas"], ["ficha_itens", "ficha_id", "fichas_tecnicas"], ["pedidos_itens", "pedido_id", "pedidos"],
    ["op_secoes", "processo_id", "op_processos"], ["op_itens", "processo_id", "op_processos"], ["op_respostas", "execucao_id", "op_execucoes"],
    ["op_acoes_corretivas", "nao_conformidade_id", "op_nao_conformidades"]];
  for (const [t, col, mae] of filhas) {
    await pg.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), ${col} uuid references public.${mae}(id), nome text);
      alter table public.${t} enable row level security;
      create policy "Acesso Total" on public.${t} for all to public using (true) with check (true);
      insert into public.${t} (${col}, nome) select id, 'filha de ' || unidade_id from public.${mae};`);
  }
  await pg.exec(`
    create table public.documentos_rh (id uuid primary key default gen_random_uuid(), colaborador_id uuid references public.colaboradores(id), nome_arquivo text);
    alter table public.documentos_rh enable row level security;
    create policy "Acesso Total Docs RH" on public.documentos_rh for all to public using (true);
    insert into public.documentos_rh (colaborador_id, nome_arquivo) values ('${C.a1}', 'contrato Ana'), ('${C.a2}', 'contrato Beto'), ('${C.b1}', 'contrato Caio');

    create table public.montagem (id uuid primary key default gen_random_uuid(), unidade_id text references public.unidades(id), nome text);
    create table public.notas_fiscais (id uuid primary key default gen_random_uuid(), unidade_id text not null, fornecedor text);
    create table public.controle_limpeza (id uuid primary key default gen_random_uuid(), unidade_id text, produto text);
    create table public.controle_manutencoes (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
    create table public.suprimentos_catalogo (id uuid primary key default gen_random_uuid(), nome text);
    create table public.suprimentos_historico (id uuid primary key default gen_random_uuid(), catalogo_id uuid references public.suprimentos_catalogo(id), unidade_id text);
    create table public.suprimentos_unidades (id uuid primary key default gen_random_uuid(), catalogo_id uuid references public.suprimentos_catalogo(id), unidade_id text);
    create table public.tarefas_templates (id uuid primary key default gen_random_uuid(), titulo text);
    create table public.ponto (id uuid primary key default gen_random_uuid(), funcionario_id uuid, obs text);
    create table public.permissoes_auditoria (id bigserial primary key, evento text);
    create table public.fin_categorias (codigo text primary key, nome text);
    create table public.fin_categorias_legado (codigo_legado text, categoria_codigo text);
    create table public.fin_centros_custo (codigo text primary key, nome text);
    do $d$ declare t text; begin
      foreach t in array array['montagem','notas_fiscais','controle_limpeza','controle_manutencoes','suprimentos_catalogo','suprimentos_historico',
                               'suprimentos_unidades','tarefas_templates','ponto','permissoes_auditoria','fin_categorias','fin_categorias_legado','fin_centros_custo',
                               'unidades','usuarios_erp','usuario_escopos','perfis_acesso'] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      end loop; end $d$;
    grant usage on all sequences in schema public to authenticated;
    create policy auth_all on public.montagem for all to authenticated using (true) with check (true);
    create policy "Acesso Notas Fiscais" on public.notas_fiscais for all to public using (true);
    create policy auth_all on public.notas_fiscais for all to authenticated using (true) with check (true);
    create policy auth_all on public.controle_limpeza for all to authenticated using (true) with check (true);
    create policy acesso_anon_manutencoes on public.controle_manutencoes for all to public using (true) with check (true);
    create policy auth_all on public.suprimentos_catalogo for all to authenticated using (true) with check (true);
    create policy auth_all on public.suprimentos_historico for all to authenticated using (true) with check (true);
    create policy auth_all on public.suprimentos_unidades for all to authenticated using (true) with check (true);
    create policy auth_all on public.tarefas_templates for all to authenticated using (true) with check (true);
    create policy acesso_total on public.ponto for all to public using (true) with check (true);
    create policy pub on public.ponto for all to public using (true) with check (true);
    create policy permissoes_auditoria_leitura on public.permissoes_auditoria for select to authenticated using (true);
    create policy fin_categorias_leitura_f21 on public.fin_categorias for select to authenticated using (true);
    create policy fin_categorias_legado_leitura_f21 on public.fin_categorias_legado for select to authenticated using (true);
    create policy fin_centros_custo_leitura_f21 on public.fin_centros_custo for select to authenticated using (true);
    create policy admin_gerencia on public.unidades for all to authenticated using (pode_ver_todas()) with check (pode_ver_todas());
    create policy todos_authenticated_leem on public.unidades for select to authenticated using (true);
    create policy unidades_all on public.unidades for all to public using (true) with check (true);
    create policy usuarios_erp_leitura on public.usuarios_erp for select to authenticated using (true);
    create policy usuario_escopos_leitura on public.usuario_escopos for select to authenticated using (true);
    create policy perfis_acesso_leitura on public.perfis_acesso for select to authenticated using (true);

    insert into public.montagem (unidade_id, nome) values ('seldeestrela', 'Pirarucu'), ('outra', 'Prato B'), (null, 'Double Bacon');
    insert into public.notas_fiscais (unidade_id, fornecedor) values ('seldeestrela', 'Atacado'), ('outra', 'Atacado B'), ('todas', 'Muffato');
    insert into public.controle_limpeza (unidade_id, produto) values ('seldeestrela', 'Detergente'), ('burguer', 'sss');
    insert into public.controle_manutencoes (unidade_id, nome) values ('burguer', 'Limpeza da Coifa');
    insert into public.suprimentos_catalogo (id, nome) values ('5c000000-0000-0000-0000-000000000001', 'Copo');
    insert into public.suprimentos_historico (catalogo_id, unidade_id) values ('5c000000-0000-0000-0000-000000000001', 'ticotico'), ('5c000000-0000-0000-0000-000000000001', null);
    insert into public.suprimentos_unidades (catalogo_id, unidade_id) values ('5c000000-0000-0000-0000-000000000001', 'ticotico');
    insert into public.ponto (obs) values ('antigo');
    insert into public.permissoes_auditoria (evento) values ('perfil alterado');
    insert into public.fin_categorias values ('CMV', 'Custo da mercadoria');

    insert into auth.users select unnest(array['${Object.values(U).join("','")}']::uuid[]);
    insert into public.usuarios_erp (auth_user_id, nome, email, super_admin, unidade_principal_id, perfil_id, colaborador_id)
      select v.uid::uuid, v.nome, v.nome || '@x', v.sup, v.un, (select id from public.perfis_acesso where codigo = v.perfil), v.colab::uuid from (values
        ('${U.super}', 'Super', true, null, 'administrador-geral', null),
        ('${U.gerente}', 'Gerente', false, 'seldeestrela', 'gerente-geral', null),
        ('${U.rhB}', 'RH B', false, 'outra', 'recursos-humanos', null),
        ('${U.a1}', 'Ana', false, 'seldeestrela', 'cozinheiro', '${C.a1}'),
        ('${U.a2}', 'Beto', false, 'seldeestrela', 'somente-consulta', '${C.a2}'),
        ('${U.todos}', 'Todos', false, 'filial', 'somente-consulta', null)) v(uid, nome, sup, un, perfil, colab);
    insert into public.usuario_escopos (usuario_id, data_scope) select id, 'todos' from public.usuarios_erp where auth_user_id = '${U.todos}';
  `);
  return pg;
}

async function aplicarFases(pg, { fase2 = true } = {}) {
  await pg.exec(FASE1);
  // o dono (escopo de empresa, sem unidade principal) entra depois da fase 1, como entraria em produção
  await pg.exec(`insert into public.usuarios_erp (auth_user_id, nome, perfil_id) values ('${U.dono}', 'Dono', (select id from public.perfis_acesso where codigo = 'administrador-geral'));
    insert into public.usuario_escopos (usuario_id, data_scope, empresa_id) select id, 'empresa', '${E1}' from public.usuarios_erp where auth_user_id = '${U.dono}';`);
  if (fase2) await pg.exec(FASE2);
}

async function como(pg, uid, sql, params = []) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  await pg.exec(uid ? "set role authenticated" : "set role anon");
  try { return await pg.query(sql, params); } finally { await pg.exec("reset role"); }
}
const valores = async (pg, uid, sql) => (await como(pg, uid, sql)).rows.map((r) => Object.values(r)[0]).sort();
const erro = async (p) => { try { await p; return null; } catch (e) { return e.message; } };
const policiesSnapshot = async (pg) => (await pg.query("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2")).rows;

let cache = null;
async function aplicado() {
  if (!cache) { cache = await banco(); await aplicarFases(cache); }
  return cache;
}

// ─── estáticos (rodam sem PGLITE) ────────────────────────────────────────────

test("cobertura: as 33 tabelas da fase 2 estão tratadas (31 trocadas + 3 catálogos globais só leitura − colaboradores, que é da fase 1)", () => {
  const todas = [...FASE2.matchAll(/^insert into _sec2_(unidade|filha) values([\s\S]*?);$/gm)].flatMap((m) => [...m[2].matchAll(/\('([a-z_]+)'/g)].map((x) => x[1]));
  const extras = ["ponto", "usuarios_erp", "usuario_escopos", "unidades", "perfis_acesso", "permissoes_auditoria"];
  const globais = ["fin_categorias", "fin_categorias_legado", "fin_centros_custo"];
  const auditoria = ler("AUDITORIA_RLS.sql");
  const fase2Auditoria = [...auditoria.matchAll(/\('([a-z_]+)', '(aguarda SEC-RLS-2|GLOBAL[^']*)'\)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set([...todas, ...extras, ...globais])].sort(), fase2Auditoria);
  assert.equal(fase2Auditoria.length, 33);
});

test("política de publicação: SEC-RLS-2 não é insegura e tem rollback; o rollback é CRITICAL; a reatribuição é REVIEW", () => {
  const m = classificarMigracao(FASE2);
  assert.equal(m.rlsInseguro, false, JSON.stringify(m.achados.filter((a) => a.classe === "CRITICAL")));
  assert.equal(rollbackIrmao("SEC_RLS_2_FASE2.sql", fs.readdirSync(path.join(raiz, "db", "security"))), "SEC_RLS_2_ROLLBACK.sql");
  assert.equal(classificarMigracao(ROLLBACK2).rlsInseguro, true);
  assert.equal(classificarMigracao(REATRIBUIR).classe, "REVIEW");
});

// ─── banco (PGlite) ──────────────────────────────────────────────────────────

test("1 · usuário comum da unidade A não vê a unidade B", { skip: pular }, async () => {
  const pg = await aplicado();
  for (const t of ["montagem", "notas_fiscais", "eventos", "controle_limpeza"]) {
    assert.deepEqual(await valores(pg, U.a1, `select distinct unidade_id from public.${t}`), ["seldeestrela"], t);
  }
  assert.deepEqual(await valores(pg, U.a1, "select id from public.unidades"), ["seldeestrela"], "só a própria unidade");
});

test("2 e 8 · empresa A não vê empresa B; o dono vê a própria empresa e não a outra", { skip: pular }, async () => {
  const pg = await aplicado();
  assert.deepEqual(await valores(pg, U.dono, "select distinct unidade_id from public.insumos"), ["seldeestrela"], "fase 1: insumos só tem A e B; dono vê A");
  assert.deepEqual(await valores(pg, U.dono, "select id from public.unidades"), ["filial", "seldeestrela"]);
  assert.deepEqual(await valores(pg, U.dono, "select nome from public.colaboradores"), ["Ana", "Beto", "Duda"], "equipe das duas unidades da empresa");
  assert.deepEqual(await valores(pg, U.rhB, "select nome from public.colaboradores"), ["Caio"], "RH da empresa B só vê a B");
  assert.deepEqual(await valores(pg, U.rhB, "select distinct unidade_id from public.eventos"), ["outra"]);
});

test("3, 4 e 5 · funcionário vê o próprio CPF e salário; não vê CPF nem salário de colega", { skip: pular }, async () => {
  const pg = await aplicado();
  const proprio = (await como(pg, U.a1, "select nome, cpf, salario from public.colaboradores")).rows;
  assert.deepEqual(proprio, [{ nome: "Ana", cpf: "111", salario: "1000" }], "só a própria linha completa");
  assert.equal((await como(pg, U.a1, `select cpf from public.colaboradores where id = '${C.a2}'`)).rows.length, 0);
  // a lista operacional traz a equipe da unidade, sem dado sensível
  const lista = (await como(pg, U.a1, "select public.hefisto_colaboradores_operacional() as l")).rows[0].l;
  assert.deepEqual(lista.map((c) => c.nome), ["Ana", "Beto"]);
  for (const c of lista) for (const k of ["cpf", "salario", "rg", "chave_pix", "face_descritores"]) assert.ok(!(k in c), `${k} vazou na lista operacional`);
  assert.equal(lista[1].horario_entrada, "16:00", "horário continua disponível para o ponto");
  // não edita colega nem a si mesmo (edição é do RH)
  assert.equal((await como(pg, U.a1, `update public.colaboradores set salario = 9999 where id = '${C.a2}' returning id`)).rows.length, 0);
});

test("6 · RH/gerência autorizados veem a equipe da unidade (com dados sensíveis) e editam", { skip: pular }, async () => {
  const pg = await aplicado();
  assert.deepEqual(await valores(pg, U.gerente, "select cpf from public.colaboradores"), ["111", "222"]);
  assert.equal((await como(pg, U.gerente, `update public.colaboradores set cargo = 'Chef' where id = '${C.a1}' returning id`)).rows.length, 1);
  assert.match(await erro(como(pg, U.gerente, "insert into public.colaboradores (unidade_id, nome) values ('outra', 'x')")), /row-level security/);
  assert.match(await erro(como(pg, U.a1, "insert into public.colaboradores (unidade_id, nome) values ('seldeestrela', 'x')")), /row-level security/, "comum não cria");
});

test("7 e 9 · dono vê a empresa toda; super admin vê tudo, inclusive registros legados", { skip: pular }, async () => {
  const pg = await aplicado();
  assert.deepEqual(await valores(pg, U.super, "select id from public.unidades"), ["filial", "outra", "seldeestrela"]);
  assert.equal((await valores(pg, U.super, "select nome from public.colaboradores")).length, 4);
  assert.deepEqual(await valores(pg, U.super, "select coalesce(unidade_id, '(nulo)') from public.montagem"), ["(nulo)", "outra", "seldeestrela"]);
  assert.deepEqual(await valores(pg, U.super, "select unidade_id from public.controle_manutencoes"), ["burguer"]);
});

test("10 · tabela-filha segue a mãe (eventos, fichas, pedidos, op_*, documentos de RH)", { skip: pular }, async () => {
  const pg = await aplicado();
  for (const t of ["evento_pratos", "evento_compras", "evento_reservas"]) assert.deepEqual(await valores(pg, U.a1, `select nome from public.${t}`), ["de A"], t);
  for (const t of ["fichas_ingredientes", "ficha_itens", "pedidos_itens", "op_secoes", "op_itens", "op_respostas", "op_acoes_corretivas"]) {
    assert.deepEqual(await valores(pg, U.a1, `select nome from public.${t}`), ["filha de seldeestrela"], t);
  }
  assert.match(await erro(como(pg, U.a1, `insert into public.evento_pratos (evento_id, nome) values ('${EV.b}', 'invasão')`)), /row-level security/, "não pendura filha em mãe da outra unidade");
  assert.deepEqual(await valores(pg, U.a1, "select nome_arquivo from public.documentos_rh"), ["contrato Ana"], "documento de RH: só o próprio");
  assert.deepEqual(await valores(pg, U.gerente, "select nome_arquivo from public.documentos_rh"), ["contrato Ana", "contrato Beto"]);
  assert.deepEqual(await valores(pg, U.super, "select nome from public.evento_pratos"), ["de A", "de B", "do legado", "sem evento"]);
});

test("11 e 12 · órfão/legado não vaza e nada é reatribuído sem aprovação", { skip: pular }, async () => {
  const pg = await aplicado();
  for (const quem of ["gerente", "dono", "a1", "todos"]) {
    assert.equal((await valores(pg, U[quem], "select 1 from public.controle_manutencoes")).length, 0, `${quem}: burguer`);
    assert.equal((await valores(pg, U[quem], "select 1 from public.suprimentos_historico")).length, 0, `${quem}: ticotico/nulo`);
    assert.equal((await valores(pg, U[quem], "select 1 from public.notas_fiscais where unidade_id = 'todas'")).length, 0, `${quem}: todas`);
    assert.equal((await valores(pg, U[quem], "select 1 from public.montagem where unidade_id is null")).length, 0, `${quem}: montagem sem unidade`);
    assert.equal((await valores(pg, U[quem], `select 1 from public.eventos where id = '${EV.nulo}'`)).length, 0, `${quem}: evento sem unidade`);
  }
  // dado intacto
  assert.equal((await pg.query("select count(*)::int n from public.montagem where unidade_id is null")).rows[0].n, 1);
  assert.equal((await pg.query("select count(*)::int n from public.notas_fiscais where unidade_id = 'todas'")).rows[0].n, 1);
  assert.equal((await pg.query(`select unidade_id from public.eventos where id = '${EV.nulo}'`)).rows[0].unidade_id, null);
  // classificação
  const cls = Object.fromEntries((await pg.query("select tabela || ':' || coalesce(unidade_original, '(nulo)') k, classificacao from public.sec_dados_legados")).rows.map((r) => [r.k, r.classificacao]));
  assert.deepEqual(cls, {
    "controle_limpeza:burguer": "LEGADO", "controle_manutencoes:burguer": "LEGADO", "suprimentos_historico:ticotico": "LEGADO",
    "suprimentos_historico:(nulo)": "ORFAO", "suprimentos_unidades:ticotico": "LEGADO", "suprimentos_catalogo:(nulo)": "LEGADO",
    "montagem:(nulo)": "AMBIGUO", "notas_fiscais:todas": "AMBIGUO", "eventos:(nulo)": "AMBIGUO",
  });
  assert.match(await erro(como(pg, U.gerente, "select * from public.sec_dados_legados")), /permission denied/, "classificação não é lida pelo navegador");
  // inserir com marcador inventado é recusado (o app deixa de gravar 'todas')
  assert.match(await erro(como(pg, U.gerente, "insert into public.notas_fiscais (unidade_id, fornecedor) values ('todas', 'x')")), /row-level security/);
  const nova = await como(pg, U.gerente, "insert into public.tarefas_templates (titulo) values ('abrir loja') returning unidade_id");
  assert.equal(nova.rows[0].unidade_id, "seldeestrela", "tabela que ganhou unidade_id recebe a unidade do usuário");
});

test("13 · pode_ver_todas() antiga não dá mais acesso a todas as empresas", { skip: pular }, async () => {
  const pg = await aplicado();
  assert.equal((await como(pg, U.todos, "select public.pode_ver_todas() v")).rows[0].v, false, "escopo 'todos' não é super admin");
  assert.equal((await como(pg, U.dono, "select public.pode_ver_todas() v")).rows[0].v, false, "dono não é super admin");
  assert.equal((await como(pg, U.super, "select public.pode_ver_todas() v")).rows[0].v, true);
  assert.deepEqual(await valores(pg, U.todos, "select unidade_id from public.compras"), ["filial"], "policy no padrão antigo: sem bypass para a outra empresa");
  assert.deepEqual(await valores(pg, U.todos, "select id from public.unidades"), ["filial", "seldeestrela"], "escopo 'todos' = a própria empresa");
  assert.deepEqual(await valores(pg, U.todos, "select distinct unidade_id from public.insumos"), ["seldeestrela"], "nunca a empresa B");
});

test("14 e 15 · nenhuma policy aberta perigosa sobrou; RLS ligado em todas as tabelas protegidas", { skip: pular }, async () => {
  const pg = await aplicado();
  const abertas = (await pg.query(`select tablename, policyname, cmd from pg_policies where schemaname = 'public'
    and (coalesce(qual, '') ~* '^\\(?\\s*true\\s*\\)?$' or coalesce(with_check, '') ~* '^\\(?\\s*true\\s*\\)?$' or coalesce(qual, '') ~* 'auth\\.role\\(\\)' or coalesce(qual, '') ~* 'unidade_id\\s+is\\s+null')
    order by 1`)).rows;
  assert.deepEqual(abertas, [
    { tablename: "fin_categorias", policyname: "fin_categorias_leitura_f21", cmd: "SELECT" },
    { tablename: "fin_categorias_legado", policyname: "fin_categorias_legado_leitura_f21", cmd: "SELECT" },
    { tablename: "fin_centros_custo", policyname: "fin_centros_custo_leitura_f21", cmd: "SELECT" },
  ], "só os catálogos globais, só leitura");
  const semRls = (await pg.query("select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity order by 1")).rows.map((r) => r.relname);
  assert.deepEqual(semRls, ["empresas", "perfil_permissoes", "usuario_permissoes"], "só tabelas do fixture fora do escopo (em produção têm RLS sem policy)");
  assert.equal((await valores(pg, U.gerente, "select 1 from public.ponto")).length, 0, "ponto antigo fechado");
  assert.equal((await valores(pg, U.gerente, "select codigo from public.perfis_acesso")).includes("perfil-da-empresa-b"), false, "perfil próprio de outra empresa não aparece");
  assert.equal((await valores(pg, U.gerente, "select 1 from public.permissoes_auditoria")).length, 0);
  assert.deepEqual(await valores(pg, U.a1, "select nome from public.usuarios_erp"), ["Ana"], "comum só vê o próprio cadastro");
  assert.deepEqual(await valores(pg, U.gerente, "select nome from public.usuarios_erp"), ["Ana", "Beto", "Gerente"], "gestão de usuários: só a unidade");
});

test("token da NF-e: o navegador não lê, mas grava e sabe se está configurado", { skip: pular }, async () => {
  const pg = await aplicado();
  assert.match(await erro(como(pg, U.gerente, "select token_nfe from public.unidades")), /permission denied/);
  assert.match(await erro(como(pg, U.gerente, "select * from public.unidades")), /permission denied/, "select * deixa de funcionar: o app lista as colunas");
  assert.deepEqual(await valores(pg, U.gerente, "select nome from public.unidades"), ["Sal de Estrela"]);
  assert.equal((await como(pg, U.gerente, "select public.hefisto_token_nfe_configurado('seldeestrela') v")).rows[0].v, true);
  assert.equal((await como(pg, U.gerente, "select public.hefisto_token_nfe_configurado('outra') v")).rows[0].v, false, "não diz nada da outra empresa");
  await como(pg, U.gerente, "update public.unidades set token_nfe = 'novo' where id = 'seldeestrela'");
  assert.equal((await pg.query("select token_nfe from public.unidades where id = 'seldeestrela'")).rows[0].token_nfe, "novo");
  assert.equal((await como(pg, U.a1, "update public.unidades set nome = 'x' where id = 'seldeestrela' returning id")).rows.length, 0, "sem permissão não edita a unidade");
  assert.match(await erro(como(pg, U.gerente, "insert into public.unidades (id, nome) values ('nova', 'x')")), /row-level security/, "criar unidade: só super admin");
});

test("preflight aborta sem mudar nada (sem a fase 1; policy desconhecida); reaplicar aborta", { skip: pular }, async () => {
  const sem1 = await banco();
  assert.match(await erro(sem1.exec(FASE2)), /SEC-RLS-1 não está aplicada/);
  await sem1.exec("rollback").catch(() => {});
  const pg = await banco();
  await aplicarFases(pg, { fase2: false });
  await pg.exec("create policy so_gerente on public.montagem for select to authenticated using (nome <> 'x')");
  assert.match(await erro(pg.exec(FASE2)), /policy desconhecida "so_gerente" em public.montagem/);
  await pg.exec("rollback").catch(() => {});
  assert.equal((await pg.query("select to_regclass('public.sec_dados_legados') t")).rows[0].t, null, "nada criado");
  assert.match(await erro((await aplicado()).exec(FASE2)), /já aplicada/);
});

test("ROLLBACK volta exatamente ao estado de depois da fase 1; reatribuição só mexe no evento com evidência", { skip: pular }, async () => {
  const pg = await banco();
  await aplicarFases(pg, { fase2: false });
  const antes = await policiesSnapshot(pg);
  const funcAntes = (await pg.query("select pg_get_functiondef('public.pode_ver_todas()'::regprocedure) d")).rows[0].d;
  await pg.exec(FASE2);
  await pg.exec(REATRIBUIR);
  assert.equal((await pg.query(`select unidade_id from public.eventos where id = '${EV.nulo}'`)).rows[0].unidade_id, "seldeestrela");
  assert.equal((await pg.query("select count(*)::int n from public.montagem where unidade_id is null")).rows[0].n, 1, "o resto não muda");
  assert.equal((await pg.query("select classificacao from public.sec_dados_legados where tabela = 'eventos'")).rows[0].classificacao, "VALIDO");
  assert.match(await erro(pg.exec(REATRIBUIR)), /esperado 1 evento, encontrado 0/, "não roda duas vezes");
  await pg.exec("rollback").catch(() => {});
  await pg.exec(ROLLBACK2);
  assert.deepEqual(await policiesSnapshot(pg), antes);
  assert.equal((await pg.query("select pg_get_functiondef('public.pode_ver_todas()'::regprocedure) d")).rows[0].d, funcAntes);
  assert.equal((await como(pg, U.gerente, "select token_nfe from public.unidades")).rows.length, 3, "volta como era: policy aberta e token legível (por isso o rollback é CRITICAL)");
});

// ─── app: as telas continuam funcionando (rodam sem PGLITE) ──────────────────

test("app: a lista junta a equipe operacional com as linhas completas que a RLS libera; antes da migração, como era", async () => {
  const { juntarColaboradores, buscarColaboradores, horarioDoColaborador } = await import("./colaboradores-acesso.mjs");
  const oper = [{ id: "a", nome: "Beto", cargo: "Garçom" }, { id: "b", nome: "Ana", cargo: "Cozinheira" }];
  const comp = [{ id: "b", nome: "Ana", cargo: "Cozinheira", cpf: "111" }];
  assert.deepEqual(juntarColaboradores(oper, comp), [{ id: "b", nome: "Ana", cargo: "Cozinheira", cpf: "111" }, { id: "a", nome: "Beto", cargo: "Garçom" }]);
  const cliente = ({ rpcErro = null, tabelaErro = null } = {}) => {
    const chamadas = [];
    const consulta = { eq(c, v) { chamadas.push(["eq", c, v]); return consulta; }, order() { return Promise.resolve(tabelaErro ? { error: { message: tabelaErro } } : { data: comp, error: null }); },
      maybeSingle() { return Promise.resolve({ data: { horario_entrada: "15:40" }, error: null }); } };
    return { chamadas, rpc: async (nome, args) => { chamadas.push(["rpc", nome, args]); return rpcErro ? { error: { message: rpcErro } } : { data: oper, error: null }; },
      from: () => ({ select: () => consulta }) };
  };
  const c1 = cliente();
  assert.equal((await buscarColaboradores(c1, "seldeestrela")).data.length, 2);
  assert.deepEqual(c1.chamadas.filter((x) => x[0] === "rpc")[0][2], { p_unidade_id: "seldeestrela" });
  assert.deepEqual((await buscarColaboradores(cliente(), "matriz")).data.length, 2, "matriz = todas as do usuário");
  const antes = await buscarColaboradores(cliente({ rpcErro: "function does not exist" }), "seldeestrela");
  assert.deepEqual(antes.data, comp, "antes da SEC-RLS-2: só a tabela");
  assert.equal((await buscarColaboradores(cliente({ rpcErro: "x", tabelaErro: "y" }), null)).error, "y");
  assert.equal((await horarioDoColaborador(cliente(), "a")).cargo, "Garçom");
  assert.equal((await horarioDoColaborador(cliente({ rpcErro: "x" }), "a")).horario_entrada, "15:40");
});

test("app: o navegador não pede token_nfe; a tela fiscal não reenvia o token vazio; notas sem unidade não viram 'todas'", () => {
  const unidades = fs.readFileSync(path.join(raiz, "app", "lib", "unidades.js"), "utf8");
  const colunas = /COLUNAS_UNIDADE = \[([\s\S]*?)\]/.exec(unidades)[1];
  assert.ok(!/token_nfe/.test(colunas));
  assert.ok(!/from\("unidades"\)\.select\("\*"\)/.test(unidades) && !/insert\(\[u\]\)\.select\(\)/.test(unidades), "nada de select * em unidades no navegador");
  const fiscal = fs.readFileSync(path.join(raiz, "app", "dashboard", "gestao", "fiscal", "page.js"), "utf8");
  assert.ok(!/minhaUnidade\.token_nfe/.test(fiscal), "não lê o token");
  assert.match(fiscal, /if \(dadosLoja\.token_nfe\.trim\(\)\) updates\.token_nfe/);
  assert.ok(!/unidade_id = "todas"/.test(fs.readFileSync(path.join(raiz, "app", "lib", "notas.js"), "utf8")));
});