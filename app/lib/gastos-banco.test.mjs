// SQL REAL da migração GASTOS-1 (detalhe do gasto: item, categoria e para quem) num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/gastos-banco.test.mjs
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
  console.log("PGLITE não informado: testes de banco do GASTOS-1 NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

const DONO = "11111111-1111-1111-1111-111111111111";
const OUTRA = "33333333-3333-3333-3333-333333333333";
const C1 = "aaaaaaaa-0000-4000-8000-000000000001";
const C2 = "aaaaaaaa-0000-4000-8000-000000000002";
const CP_CASA = "bbbbbbbb-0000-4000-8000-000000000001";
const CP_CASA2 = "bbbbbbbb-0000-4000-8000-000000000002";
const CP_OUTRA = "bbbbbbbb-0000-4000-8000-000000000003";
const FUNC_CASA = "cccccccc-0000-4000-8000-000000000001";
const FUNC_OUTRA = "cccccccc-0000-4000-8000-000000000002";

// contas_pagar e colaboradores reduzidos, com a mesma regra de unidade do banco real (uma unidade por usuário)
await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  create table public.usuario_teste (uid uuid primary key, unidade text);
  insert into public.usuario_teste values ('${DONO}', 'casa'), ('${OUTRA}', 'outra');
  create function public.auth_unidade_id() returns text language sql stable security definer set search_path = public as
    $$ select unidade from public.usuario_teste where uid = auth.uid() $$;
  create table public.fin_categorias (codigo text primary key, nome text, grupo text, natureza text, permite_conta_manual boolean, exige_revisao boolean, ativa boolean, ordem int, created_at timestamptz default now());
  create table public.colaboradores (id uuid primary key, unidade_id text, nome text);
  insert into public.colaboradores values ('${FUNC_CASA}', 'casa', 'Ana'), ('${FUNC_OUTRA}', 'outra', 'Beto');
  create table public.contas_pagar (id uuid primary key, unidade_id text, descricao text, valor numeric);
  insert into public.contas_pagar values ('${CP_CASA}', 'casa', 'Frigideira', 89.9), ('${CP_CASA2}', 'casa', 'Avental', 35), ('${CP_OUTRA}', 'outra', 'Panela', 120);
  alter table public.contas_pagar enable row level security;
  create policy cp on public.contas_pagar for all to authenticated using (unidade_id = public.auth_unidade_id()) with check (unidade_id = public.auth_unidade_id());
  grant select, insert on public.contas_pagar to authenticated;
`);

const sql = fs.readFileSync(path.join(raiz, "db", "GASTOS_1_GASTOS_DETALHADOS.sql"), "utf8");
const res = await pg.exec(sql);
const digital = res.find((r) => r.rows?.[0]?.impressao_digital)?.rows?.[0]?.impressao_digital;
console.log(`     impressão digital: ${digital}`);

async function como(uid, consulta) {
  await pg.exec("begin");
  try {
    await pg.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    const r = await pg.query(consulta);
    await pg.exec("commit");
    return r.rows;
  } catch (e) {
    await pg.exec("rollback");
    return { excecao: e.message };
  }
}
const inserir = (conta, extra = "") => `insert into public.gastos_detalhe (unidade_id, conta_pagar_id, data, tipo_gasto, item, quantidade, valor_total, destino, colaborador_id)
  values ('outra', '${conta}', '2026-11-17', ${extra || "'utensilios', 'Frigideira 28 cm', 1, 89.90, 'geral', null"}) returning unidade_id, criado_por`;

conferir("categorias novas no plano de contas", (await pg.query("select codigo from public.fin_categorias order by codigo")).rows.map((r) => r.codigo), ["uniformes_epi", "utensilios"]);
const g1 = await como(DONO, inserir(CP_CASA));
conferir("dono grava o detalhe; a unidade vem da conta, não do corpo", [g1[0]?.unidade_id, g1[0]?.criado_por], ["casa", DONO]);
conferir("mesma conta não tem dois detalhes", !!(await como(DONO, inserir(CP_CASA))).excecao, true);
conferir("não grava detalhe de conta de outra empresa", !!(await como(DONO, inserir(CP_OUTRA))).excecao, true);
conferir("funcionário de outra unidade é recusado", !!(await como(DONO, inserir(CP_CASA2, `'uniformes_epi', 'Avental', 2, 35, 'colaborador', '${FUNC_OUTRA}'`))).excecao, true);
conferir("destino funcionário sem funcionário é recusado", !!(await como(DONO, inserir(CP_CASA2, `'uniformes_epi', 'Avental', 2, 35, 'colaborador', null`))).excecao, true);
conferir("tipo de gasto fora da lista é recusado", !!(await como(DONO, inserir(CP_CASA2, `'mercadoria', 'Arroz', 2, 35, 'geral', null`))).excecao, true);
const g2 = await como(DONO, inserir(CP_CASA2, `'uniformes_epi', 'Avental', 2, 35, 'colaborador', '${FUNC_CASA}'`));
conferir("avental para a Ana (mesma unidade)", g2[0]?.unidade_id, "casa");
conferir("o dono vê os dois detalhes da casa", (await como(DONO, "select item from public.gastos_detalhe order by item")).map((r) => r.item), ["Avental", "Frigideira 28 cm"]);
conferir("outra empresa não vê nada da casa", (await como(OUTRA, "select item from public.gastos_detalhe")).length, 0);
conferir("detalhe não se altera", !!(await como(DONO, "update public.gastos_detalhe set valor_total = 1")).excecao, true);
conferir("detalhe não se apaga pela API", !!(await como(DONO, "delete from public.gastos_detalhe")).excecao, true);
await pg.exec("set role anon");
let anonLe;
try { await pg.query("select * from public.gastos_detalhe"); anonLe = true; } catch { anonLe = false; }
await pg.exec("reset role");
conferir("visitante não lê", anonLe, false);

// preflight: rodar de novo aborta sem mudar nada
let preflight = null;
try { await pg.exec(sql); } catch (e) { preflight = e.message; }
conferir("preflight: segunda execução aborta", /já existe/.test(preflight || ""), true);
conferir("impressão digital", digital, "89a161c93f2106338f57493827411cdd");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
