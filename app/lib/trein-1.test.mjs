// TREIN-1 com o SQL real no PGlite: quem pode ver, responder e aprovar.
//   PGLITE=… node --test app/lib/trein-1.test.mjs
// Sem PGLITE os testes de banco PULAM.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f) => fs.readFileSync(path.join(raiz, "db", "treinamento", f), "utf8");
const MIGRACAO = ler("TREIN_1_TREINAMENTO_POR_FUNCAO.sql");
const ROLLBACK = ler("TREIN_1_ROLLBACK.sql");
const pular = !process.env.PGLITE && "PGLITE não informado";

const A = (n) => `00000000-0000-0000-0000-0000000000${n}`; // auth.uid
const U = (n) => `10000000-0000-0000-0000-0000000000${n}`; // usuarios_erp.id
const novato = "01", lider = "02", dono = "03", outro = "04", colega = "05";
const FICHA = "f0000000-0000-0000-0000-000000000001";
const PACOTE = {
  modulos: [
    { chave: "m1", area: "cozinha", titulo: "Higiene", ordem: 1, aulas: [
      { chave: "a1", titulo: "Mãos", conteudo: "Lave as mãos.", questoes: [
        { chave: "q1", enunciado: "Quando lavar?", opcoes: ["Nunca", "Ao chegar"], correta: 1, explicacao: "Ao chegar." },
        { chave: "q2", enunciado: "Com quê?", opcoes: ["Sabonete", "Pano"], correta: 0, explicacao: "Sabonete." },
        { chave: "q3", tipo: "situacao", enunciado: "Cortou o dedo", opcoes: ["Segue", "Avisa o líder"], correta: 1, explicacao: "Avisa." },
      ] },
    ] },
    { chave: "m2", area: "cozinha", titulo: "História", ordem: 2, aulas: [
      { chave: "a2", titulo: "A casa", conteudo: "[PREENCHER: história]", questoes: [
        { chave: "q4", enunciado: "a", opcoes: ["x", "y"], correta: 0 }, { chave: "q5", enunciado: "b", opcoes: ["x", "y"], correta: 0 }, { chave: "q6", enunciado: "c", opcoes: ["x", "y"], correta: 0 },
      ] },
    ] },
    { chave: "p1", area: "cozinha", titulo: "Pratos", ordem: 3, tipo: "pratos", departamento: "cozinha", etapa: "montar" },
  ],
  trilhas: [{ chave: "t1", area: "cozinha", nome: "Auxiliar", modulos: ["m1", "m2", "p1"], pratica: ["Lavou as mãos no padrão"], cargos: ["Auxiliar de Cozinha 1"] }],
};

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table unidades (id text primary key, nome text);
    create table usuarios_erp (id uuid primary key, auth_user_id uuid, nome text, cargo text, status text, unidade text);
    create table fichas_tecnicas (id uuid primary key, unidade_id text);
    create table perfis_acesso (id uuid primary key, codigo text, is_current boolean);
    create table perfil_permissoes (perfil_id uuid, permission_key text);
    create table acessos (usuario uuid, unidade text, chave text);
    create function public.hefisto_ve_todas_unidades() returns boolean language sql stable as $$ select false $$;
    create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer as $$ select array_agg(unidade) from usuarios_erp where auth_user_id = auth.uid() $$;
    create function public.hefisto_user_in_unit(a uuid, u text) returns boolean language sql stable security definer as $$ select exists (select 1 from usuarios_erp x where x.auth_user_id = a and x.unidade = u) $$;
    create function public.hefisto_user_can(p text, u text default null) returns boolean language sql stable security definer as $$
      select exists (select 1 from acessos a where a.usuario = auth.uid() and (u is null or a.unidade = u)
        and (a.chave = p or (a.chave like '%.*' and p like replace(a.chave, '*', '%')))) $$;
    insert into unidades values ('casa', 'Casa'), ('outra', 'Outra');
    insert into usuarios_erp values
      ('${U(novato)}', '${A(novato)}', 'Novato', 'Auxiliar', 'ativo', 'casa'),
      ('${U(lider)}', '${A(lider)}', 'Líder', 'Chefe', 'ativo', 'casa'),
      ('${U(dono)}', '${A(dono)}', 'Dono', 'Dono', 'ativo', 'casa'),
      ('${U(outro)}', '${A(outro)}', 'De fora', 'Chefe', 'ativo', 'outra'),
      ('${U(colega)}', '${A(colega)}', 'Colega', 'Auxiliar', 'ativo', 'casa');
    insert into fichas_tecnicas values ('${FICHA}', 'casa');
    insert into perfis_acesso values
      ('20000000-0000-0000-0000-000000000001', 'gerente-geral', true),
      ('20000000-0000-0000-0000-000000000002', 'somente-ponto', true),
      ('20000000-0000-0000-0000-000000000003', 'somente-consulta', true);
    insert into acessos values
      ('${A(lider)}', 'casa', 'treinamento.team.*'),
      ('${A(dono)}', 'casa', 'treinamento.*'),
      ('${A(outro)}', 'outra', 'treinamento.*');
  `);
  await pg.exec(MIGRACAO);
  await pg.query("select trein_importar_pacote('casa', $1::jsonb)", [JSON.stringify(PACOTE)]);
  return pg;
}

async function como(pg, quem, sql, params = []) {
  await pg.exec(`begin; select set_config('app.uid', '${quem ? A(quem) : ""}', true); set local role ${quem ? "authenticated" : "anon"};`);
  try {
    const r = await pg.query(sql, params);
    await pg.exec("commit");
    return r.rows;
  } catch (e) {
    await pg.exec("rollback");
    throw e;
  }
}
const nega = (p, re) => assert.rejects(p, re);
const id = async (pg, tabela, chave) => (await pg.query(`select id from ${tabela} where chave = $1`, [chave])).rows[0].id;

async function preparar() {
  const pg = await banco();
  const trilha = await id(pg, "trein_trilhas", "t1");
  const m1 = await id(pg, "trein_modulos", "m1");
  const a1 = await id(pg, "trein_aulas", "a1");
  const qs = Object.fromEntries((await pg.query("select chave, id from trein_questoes")).rows.map((r) => [r.chave, r.id]));
  return { pg, trilha, m1, a1, qs };
}
const matricular = async (ctx, quem = novato) => (await como(ctx.pg, lider, "select trein_matricular($1, $2) as id", [U(quem), ctx.trilha]))[0].id;
const respostas = (qs, r1 = 1, r2 = 0, r3 = 1) => JSON.stringify({ [qs.q1]: r1, [qs.q2]: r2, [qs.q3]: r3 });
const aprovarM1 = (ctx) => como(ctx.pg, dono, "select trein_aprovar_modulo($1, true)", [ctx.m1]);

test("rascunho só aparece para quem cuida do conteúdo; anon não vê nada", { skip: pular }, async () => {
  const ctx = await preparar();
  assert.equal((await como(ctx.pg, novato, "select id from trein_aulas")).length, 0);
  assert.equal((await como(ctx.pg, dono, "select id from trein_aulas")).length, 2);
  await nega(como(ctx.pg, null, "select id from trein_aulas"), /permission denied/);
  await aprovarM1(ctx);
  assert.equal((await como(ctx.pg, novato, "select id from trein_aulas")).length, 1);
});

test("o gabarito não sai para ninguém pelo navegador", { skip: pular }, async () => {
  const ctx = await preparar();
  await nega(como(ctx.pg, dono, "select * from trein_gabaritos"), /permission denied/);
  await nega(como(ctx.pg, novato, "select * from trein_gabarito_do_modulo($1)", [ctx.m1]), /permissão/);
  assert.equal((await como(ctx.pg, dono, "select * from trein_gabarito_do_modulo($1)", [ctx.m1])).length, 3);
  const colunas = (await ctx.pg.query("select column_name from information_schema.columns where table_name = 'trein_questoes'")).rows.map((r) => r.column_name);
  assert.ok(!colunas.includes("correta"));
});

test("módulo com [PREENCHER] não pode ser aprovado", { skip: pular }, async () => {
  const ctx = await preparar();
  const m2 = await id(ctx.pg, "trein_modulos", "m2");
  await nega(como(ctx.pg, dono, "select trein_aprovar_modulo($1, true)", [m2]), /PREENCHER/);
  await nega(como(ctx.pg, lider, "select trein_aprovar_modulo($1, true)", [ctx.m1]), /permissão/);
});

test("prova: exige as aulas, corrige no banco e só mostra a resposta a quem passou", { skip: pular }, async () => {
  const ctx = await preparar();
  await aprovarM1(ctx);
  const mat = await matricular(ctx);
  await nega(como(ctx.pg, novato, "select trein_corrigir_prova($1, $2, $3::jsonb)", [mat, ctx.m1, respostas(ctx.qs)]), /Conclua/);
  await como(ctx.pg, novato, "select trein_concluir_aula($1, $2)", [mat, ctx.a1]);
  const ruim = (await como(ctx.pg, novato, "select trein_corrigir_prova($1, $2, $3::jsonb) as r", [mat, ctx.m1, respostas(ctx.qs, 0, 1, 0)]))[0].r;
  assert.equal(ruim.aprovada, false);
  assert.equal(ruim.correcao, undefined, "reprovado não recebe gabarito");
  assert.deepEqual(ruim.rever, ["Mãos"]);
  const boa = (await como(ctx.pg, novato, "select trein_corrigir_prova($1, $2, $3::jsonb) as r", [mat, ctx.m1, respostas(ctx.qs)]))[0].r;
  assert.equal(boa.aprovada, true);
  assert.equal(boa.correcao.length, 3);
  await nega(como(ctx.pg, novato, "select trein_corrigir_prova($1, $2, $3::jsonb)", [mat, ctx.m1, respostas(ctx.qs)]), /já foi aprovado/);
  assert.equal((await ctx.pg.query("select status from trein_matriculas where id = $1", [mat])).rows[0].status, "aguardando_lider");
});

test("depois de 3 reprovações em 1 hora a prova espera", { skip: pular }, async () => {
  const ctx = await preparar();
  await aprovarM1(ctx);
  const mat = await matricular(ctx);
  await como(ctx.pg, novato, "select trein_concluir_aula($1, $2)", [mat, ctx.a1]);
  for (let i = 0; i < 3; i++) await como(ctx.pg, novato, "select trein_corrigir_prova($1, $2, $3::jsonb)", [mat, ctx.m1, respostas(ctx.qs, 0, 1, 0)]);
  await nega(como(ctx.pg, novato, "select trein_corrigir_prova($1, $2, $3::jsonb)", [mat, ctx.m1, respostas(ctx.qs)]), /1 hora/);
});

test("ninguém escreve progresso direto nem usa a matrícula de outra pessoa", { skip: pular }, async () => {
  const ctx = await preparar();
  await aprovarM1(ctx);
  const mat = await matricular(ctx);
  await nega(como(ctx.pg, novato, "update trein_matriculas set status = 'aprovado'"), /permission denied/);
  await nega(como(ctx.pg, novato, `insert into trein_tentativas (unidade_id, matricula_id, modulo_id, acertos, total, aprovada) values ('casa', '${mat}', '${ctx.m1}', 3, 3, true)`), /permission denied/);
  await nega(como(ctx.pg, colega, "select trein_concluir_aula($1, $2)", [mat, ctx.a1]), /não encontrado/);
  await nega(como(ctx.pg, novato, "select trein_importar_pacote('casa', '{}'::jsonb)"), /permission denied/);
  assert.equal((await como(ctx.pg, colega, "select id from trein_matriculas")).length, 0);
  assert.equal((await como(ctx.pg, novato, "select id from trein_matriculas")).length, 1);
  assert.equal((await como(ctx.pg, lider, "select id from trein_matriculas")).length, 1);
});

test("isolamento: gestor de outra unidade não vê nem age nesta", { skip: pular }, async () => {
  const ctx = await preparar();
  await aprovarM1(ctx);
  const mat = await matricular(ctx);
  assert.equal((await como(ctx.pg, outro, "select id from trein_trilhas")).length, 0);
  assert.equal((await como(ctx.pg, outro, "select id from trein_modulos")).length, 0);
  assert.equal((await como(ctx.pg, outro, "select id from trein_matriculas")).length, 0);
  await nega(como(ctx.pg, outro, "select trein_equipe('casa')"), /permissão/);
  await nega(como(ctx.pg, outro, "select trein_matricular($1, $2)", [U(outro), ctx.trilha]), /permissão/);
  await nega(como(ctx.pg, outro, "select trein_concluir_trilha($1)", [mat]), /permissão/);
  await nega(como(ctx.pg, lider, "select trein_matricular($1, $2)", [U(outro), ctx.trilha]), /não pertence/);
});

test("aprovação final: precisa de prova e prática, e o líder não aprova a si mesmo", { skip: pular }, async () => {
  const ctx = await preparar();
  await aprovarM1(ctx);
  const mat = await matricular(ctx);
  const item = (await ctx.pg.query("select id from trein_pratica_itens")).rows[0].id;
  await nega(como(ctx.pg, lider, "select trein_concluir_trilha($1)", [mat]), /prova/);
  await como(ctx.pg, novato, "select trein_concluir_aula($1, $2)", [mat, ctx.a1]);
  await como(ctx.pg, novato, "select trein_corrigir_prova($1, $2, $3::jsonb)", [mat, ctx.m1, respostas(ctx.qs)]);
  await nega(como(ctx.pg, lider, "select trein_concluir_trilha($1)", [mat]), /prova|prática/);
  // m2 ainda é rascunho, mas conta como prova da trilha: só sai quando aprovado.
  await ctx.pg.exec("delete from trein_trilha_modulos where modulo_id in (select id from trein_modulos where chave = 'm2')");
  await nega(como(ctx.pg, lider, "select trein_concluir_trilha($1)", [mat]), /prática/);
  await nega(como(ctx.pg, novato, "select trein_avaliar_pratica($1, $2, true, '')", [mat, item]), /permissão/);
  await como(ctx.pg, lider, "select trein_avaliar_pratica($1, $2, true, 'ok')", [mat, item]);
  await como(ctx.pg, lider, "select trein_validar_prato($1, $2, 'montar', true)", [mat, FICHA]);
  assert.equal((await como(ctx.pg, novato, "select etapa from trein_pratos_validados")).length, 1);
  await como(ctx.pg, lider, "select trein_concluir_trilha($1)", [mat]);
  assert.equal((await ctx.pg.query("select status from trein_matriculas where id = $1", [mat])).rows[0].status, "aprovado");

  await ctx.pg.exec(`update trein_matriculas set status = 'cancelado'`);
  const propria = await matricular(ctx, lider);
  await nega(como(ctx.pg, lider, "select trein_avaliar_pratica($1, $2, true, '')", [propria, item]), /Outra pessoa/);
});

test("edição do conteúdo: confere permissão e dados; importar de novo não sobrescreve", { skip: pular }, async () => {
  const ctx = await preparar();
  await nega(como(ctx.pg, lider, "select trein_salvar_aula($1, 'x', 'y', null, 5)", [ctx.a1]), /permissão/);
  await nega(como(ctx.pg, dono, "select trein_salvar_aula($1, 'x', 'y', 'http://inseguro', 5)", [ctx.a1]), /https/);
  await como(ctx.pg, dono, "select trein_salvar_aula($1, 'Mãos limpas', 'Texto do dono', 'https://v.co/1', 7)", [ctx.a1]);
  await nega(como(ctx.pg, dono, "select trein_salvar_questao($1, 'p', '[\"a\",\"b\"]'::jsonb, 5, '')", [ctx.qs.q1]), /Confira/);
  await como(ctx.pg, dono, "select trein_salvar_questao($1, 'Nova?', '[\"a\",\"b\",\"c\"]'::jsonb, 2, 'porque')", [ctx.qs.q1]);
  await ctx.pg.query("select trein_importar_pacote('casa', $1::jsonb)", [JSON.stringify(PACOTE)]);
  const a = (await ctx.pg.query("select titulo, conteudo from trein_aulas where id = $1", [ctx.a1])).rows[0];
  assert.deepEqual(a, { titulo: "Mãos limpas", conteudo: "Texto do dono" });
  assert.equal((await ctx.pg.query("select correta from trein_gabaritos where questao_id = $1", [ctx.qs.q1])).rows[0].correta, 2);
  assert.equal((await ctx.pg.query("select count(*)::int n from trein_aulas")).rows[0].n, 2);
});

test("permissões: todos veem o próprio treinamento, menos Somente ponto", { skip: pular }, async () => {
  const pg = await banco();
  const r = (await pg.query("select p.codigo, x.permission_key k from perfil_permissoes x join perfis_acesso p on p.id = x.perfil_id order by 1, 2")).rows;
  assert.deepEqual(r, [
    { codigo: "gerente-geral", k: "treinamento.*" },
    { codigo: "gerente-geral", k: "treinamento.my.view" },
    { codigo: "somente-consulta", k: "treinamento.my.view" },
  ]);
});

test("preflight não roda de novo; rollback tira tudo e impressão fica estável", { skip: pular }, async () => {
  const pg = await banco();
  await assert.rejects(pg.exec(MIGRACAO), /já aplicada/);
  await pg.exec("rollback").catch(() => {});
  const antes = (await pg.query("select count(*)::int n from pg_policies where tablename like 'trein\\_%'")).rows[0].n;
  assert.equal(antes, 11);
  await pg.exec(ROLLBACK);
  assert.equal((await pg.query("select count(*)::int n from pg_class where relname like 'trein\\_%' and relkind = 'r'")).rows[0].n, 0);
  assert.equal((await pg.query("select count(*)::int n from pg_proc where proname like 'trein\\_%'")).rows[0].n, 0);
  assert.equal((await pg.query("select count(*)::int n from perfil_permissoes")).rows[0].n, 0);
  await pg.exec(MIGRACAO);
});

test("TREIN-2: os rascunhos reais carregam, ficam invisíveis e podem ser aprovados", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec("delete from trein_trilhas; delete from trein_modulos; insert into unidades values ('seldeestrela', 'Sel de Estrela');");
  await pg.exec("update usuarios_erp set unidade = 'seldeestrela' where unidade = 'casa'; update acessos set unidade = 'seldeestrela' where unidade = 'casa';");
  const sql = ler("TREIN_2_RASCUNHOS.sql");
  await pg.exec(sql);
  const n = (await pg.query("select (select count(*)::int from trein_modulos) m, (select count(*)::int from trein_aulas) a, (select count(*)::int from trein_trilhas) t, (select count(*)::int from trein_gabaritos) g, (select count(*)::int from trein_questoes) q")).rows[0];
  assert.equal(n.t, 10);
  assert.ok(n.m >= 30 && n.a >= 50 && n.q >= 100);
  assert.equal(n.g, n.q);
  await pg.exec(sql); // rodar de novo não duplica
  assert.equal((await pg.query("select count(*)::int n from trein_aulas")).rows[0].n, n.a);
  assert.equal((await como(pg, novato, "select id from trein_aulas")).length, 0, "equipe não vê rascunho");
  const higiene = await id(pg, "trein_modulos", "g-higiene");
  await como(pg, dono, "select trein_aprovar_modulo($1, true)", [higiene]);
  assert.ok((await como(pg, novato, "select id from trein_aulas")).length >= 4);
  await nega(como(pg, dono, "select trein_aprovar_modulo($1, true)", [await id(pg, "trein_modulos", "g-casa")]), /PREENCHER/);
});

test("Estúdio: criar conteúdo novo, salvar falas e ligar a uma trilha", { skip: pular }, async () => {
  const ctx = await preparar();
  await nega(como(ctx.pg, lider, "select trein_criar_modulo('casa', 'bar', 'Vinhos', '')"), /permissão/);
  await nega(como(ctx.pg, outro, "select trein_criar_modulo('casa', 'bar', 'Vinhos', '')"), /permissão/);
  const m = (await como(ctx.pg, dono, "select trein_criar_modulo('casa', 'bar', 'Vinhos', 'Serviço') as id"))[0].id;
  const a = (await como(ctx.pg, dono, "select trein_criar_aula($1, 'Abrir', 'Corte a cápsula.') as id", [m]))[0].id;
  const qs = [];
  for (const e of ["a", "b", "c"]) qs.push((await como(ctx.pg, dono, `select trein_criar_questao($1, 'prova', '${e}', '["x","y"]'::jsonb, 1, 'porque') as id`, [a]))[0].id);
  await nega(como(ctx.pg, dono, "select trein_criar_questao($1, 'prova', 'z', '[\"x\"]'::jsonb, 0, '')", [a]), /Confira/);
  await como(ctx.pg, dono, "select trein_salvar_cenas($1, '[{\"fala\":\"Corte\"}]'::jsonb)", [a]);
  await nega(como(ctx.pg, novato, "select trein_salvar_cenas($1, null)", [a]), /permissão/);
  await como(ctx.pg, dono, "select trein_salvar_aula($1, 'Abrir', 'Corte a cápsula.', null, 5)", [a]);
  assert.ok((await ctx.pg.query("select cenas from trein_aulas where id = $1", [a])).rows[0].cenas, "texto igual mantém as falas");
  await como(ctx.pg, dono, "select trein_salvar_aula($1, 'Abrir', 'Texto novo.', null, 5)", [a]);
  assert.equal((await ctx.pg.query("select cenas from trein_aulas where id = $1", [a])).rows[0].cenas, null, "texto novo invalida as falas");
  await como(ctx.pg, dono, "select trein_ligar_modulo($1, $2, true)", [m, ctx.trilha]);
  await nega(como(ctx.pg, outro, "select trein_ligar_modulo($1, $2, false)", [m, ctx.trilha]), /permissão/);
  await como(ctx.pg, dono, "select trein_aprovar_modulo($1, true)", [m]);
  await nega(como(ctx.pg, dono, "select trein_remover_aula($1)", [a]), /rascunho/);
  await como(ctx.pg, dono, "select trein_aprovar_modulo($1, false)", [m]);
  await como(ctx.pg, dono, "select trein_remover_questao($1)", [qs[0]]);
  await como(ctx.pg, dono, "select trein_remover_aula($1)", [a]);
  assert.equal((await ctx.pg.query("select count(*)::int n from trein_gabaritos where questao_id = any($1)", [qs])).rows[0].n, 0);
});
