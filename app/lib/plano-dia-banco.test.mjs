// SQL REAL da migração PLANO-DIA-1 num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/plano-dia-banco.test.mjs
// Sem PGLITE os testes NÃO rodam (o processo sai com código 2).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};
if (!process.env.PGLITE) {
  console.log("PGLITE não informado: testes de banco do PLANO-DIA-1 NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

const DONO = "11111111-1111-1111-1111-111111111111";
const TABLET = "22222222-2222-2222-2222-222222222222";
const OUTRA = "33333333-3333-3333-3333-333333333333";
const MARIA = "aaaaaaaa-0000-0000-0000-000000000001";
const ZE = "aaaaaaaa-0000-0000-0000-000000000004"; // outra unidade
const FICHA = "bbbbbbbb-0000-0000-0000-000000000001";
const FICHA_OUTRA = "bbbbbbbb-0000-0000-0000-000000000002";

await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  insert into auth.users values ('${DONO}', 'dono@x', '{"nome":"Lucas"}'), ('${TABLET}', 'tablet@x', '{"nome":"Tablet da cozinha"}'), ('${OUTRA}', 'o@x', '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  create table public.colaboradores (id uuid primary key, unidade_id text, nome text, status text);
  insert into public.colaboradores values ('${MARIA}', 'casa', 'Maria', 'ativo'), ('${ZE}', 'outra', 'Zé', 'ativo');
  create table public.fichas_tecnicas (id uuid primary key, unidade_id text, nome_receita text);
  insert into public.fichas_tecnicas values ('${FICHA}', 'casa', 'Vatapá'), ('${FICHA_OUTRA}', 'outra', 'Segredo');
  create table public.perm_teste (uid uuid, perm text, unidade text);
  insert into public.perm_teste values ('${DONO}', 'dashboard.intelligence.settings', 'casa'), ('${DONO}', 'dashboard.intelligence.view', 'casa'),
    ('${TABLET}', 'dashboard.intelligence.view', 'casa'), ('${OUTRA}', 'dashboard.intelligence.view', 'outra'), ('${OUTRA}', 'dashboard.intelligence.settings', 'outra');
  create function public.hefisto_user_can(p_permission text, p_unidade_id text default null) returns boolean
    language sql stable security definer set search_path = public as
    $$ select exists (select 1 from public.perm_teste where uid = auth.uid() and perm = p_permission and unidade = p_unidade_id) $$;
`);

const sql = fs.readFileSync(path.join(raiz, "db", "PLANO_DIA_1_TAREFAS_DO_DIA.sql"), "utf8");
const res = await pg.exec(sql);
const digital = res.find((r) => r.rows?.[0]?.impressao_digital)?.rows?.[0]?.impressao_digital;
console.log(`     impressão digital: ${digital}`);

async function como(uid, consulta) {
  await pg.exec("begin");
  try {
    await pg.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    const r = await pg.query(consulta);
    await pg.exec("commit");
    return r.rows.length === 1 && "r" in r.rows[0] ? r.rows[0].r : r.rows;
  } catch (e) {
    await pg.exec("rollback");
    return { excecao: e.message };
  }
}
const tarefas = JSON.stringify([
  { titulo: "Fazer vatapá", tipo: "producao", fichaId: FICHA, quantidade: 3, unidade: "kg", responsavelId: MARIA, motivo: "leva 90 min" },
  { titulo: "Bater açaí", tipo: "producao", fichaId: FICHA_OUTRA, quantidade: "4", unidade: "L", responsavelId: ZE },
  { titulo: "Limpar o balcão", tipo: "hackear", depoisDoIntervalo: true },
]).replace(/'/g, "''");
const aprovar = (data = "current_date") => `select public.hefisto_aprovar_plano_dia('casa', ${data}, '4 L de açaí, 3 kg de vatapá', '${tarefas}'::jsonb) as r`;

conferir("tablet não aprova plano", (await como(TABLET, aprovar())).ok, false);
conferir("dono de outra unidade não aprova na casa", (await como(OUTRA, aprovar())).ok, false);
conferir("data longe demais é recusada", (await como(DONO, aprovar("current_date + 30"))).ok, false);
const a1 = await como(DONO, aprovar());
conferir("dono aprova com 3 tarefas", [a1.ok, a1.tarefas], [true, 3]);

const t = await como(TABLET, `select ordem, titulo, tipo, ficha_id, ficha_nome, quantidade, responsavel_id, responsavel_nome, depois_do_intervalo from public.plano_dia_tarefa order by ordem`);
conferir("ficha e responsável da casa ficam, com o nome do cadastro", [t[0].ficha_nome, t[0].responsavel_nome, Number(t[0].quantidade)], ["Vatapá", "Maria", 3]);
conferir("ficha e funcionário de OUTRA unidade viram nulo", [t[1].ficha_id, t[1].responsavel_id], [null, null]);
conferir("tipo inválido vira 'outro'", [t[2].tipo, t[2].depois_do_intervalo], ["outro", true]);
conferir("outra unidade não vê o plano da casa", (await como(OUTRA, "select id from public.plano_dia_tarefa")).length, 0);

const id = (await pg.query("select id from public.plano_dia_tarefa where ordem = 1 and plano_id = (select id from public.plano_dia where status = 'ativo')")).rows[0].id;
conferir("tablet marca feito, com quem fez", (await como(TABLET, `select public.hefisto_marcar_tarefa_plano('${id}', true, 'Maria') as r`)).ok, true);
const feita = (await pg.query(`select feito_em is not null as f, feito_por, feito_por_nome from public.plano_dia_tarefa where id = '${id}'`)).rows[0];
conferir("grava a hora, o login e o nome tocado", [feita.f, feita.feito_por, feita.feito_por_nome], [true, TABLET, "Maria"]);
conferir("outra unidade não marca", (await como(OUTRA, `select public.hefisto_marcar_tarefa_plano('${id}', false) as r`)).ok, false);
conferir("ninguém grava direto na tabela", /permission denied/i.test((await como(DONO, `update public.plano_dia_tarefa set titulo = 'x'`)).excecao || ""), true);

const a2 = await como(DONO, aprovar());
conferir("aprovar de novo substitui (um ativo por dia)", (await pg.query("select status, count(*)::int as n from public.plano_dia group by status order by status")).rows, [{ status: "ativo", n: 1 }, { status: "substituido", n: 1 }]);
conferir("tarefa do plano substituído não é mais marcada", (await como(TABLET, `select public.hefisto_marcar_tarefa_plano('${id}', false) as r`)).ok, false);
conferir("segundo plano ok", a2.ok, true);

let anon = null;
await pg.exec("begin");
try { await pg.exec("set local role anon"); await pg.query("select * from public.plano_dia"); } catch (e) { anon = e.message; }
await pg.exec("rollback");
conferir("visitante sem login não lê", /permission denied/i.test(anon || ""), true);

let repetida = null;
try { await pg.exec(sql); } catch (e) { repetida = e.message; }
conferir("rodar de novo aborta no preflight", /já existem/.test(repetida || ""), true);
conferir("impressão digital", digital, "c8ae79c9c0448a3dc24cc5a3bd32f4dd");
console.log(falhas ? `\n${falhas} falha(s).` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
