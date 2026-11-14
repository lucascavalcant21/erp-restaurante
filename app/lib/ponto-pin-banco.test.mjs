// SQL REAL da migração PONTO-PIN-1 num Postgres em memória (PGlite, com o
// pgcrypto). Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/ponto-pin-banco.test.mjs
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
  console.log("PGLITE não informado: testes de banco do PONTO-PIN-1 NÃO executados.");
  process.exit(2);
}

const base = path.join(process.env.PGLITE, "dist");
const { PGlite } = await import(pathToFileURL(path.join(base, "index.js")).href);
const { pgcrypto } = await import(pathToFileURL(path.join(base, "contrib", "pgcrypto.js")).href);
const pg = new PGlite({ extensions: { pgcrypto } });

const DONO = "11111111-1111-1111-1111-111111111111";
const TABLET = "22222222-2222-2222-2222-222222222222";
const OUTRA = "33333333-3333-3333-3333-333333333333"; // tablet de outra unidade
const ANA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETO = "aaaaaaaa-0000-0000-0000-000000000002";
const CAIO = "aaaaaaaa-0000-0000-0000-000000000003"; // inativo
const ZE = "aaaaaaaa-0000-0000-0000-000000000004"; // outra unidade

await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema extensions;
  create extension pgcrypto schema extensions;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, extensions, public to anon, authenticated;

  create table public.colaboradores (id uuid primary key, unidade_id text, nome text, status text);
  insert into public.colaboradores values ('${ANA}', 'casa', 'Ana', 'ativo'), ('${BETO}', 'casa', 'Beto', 'ativo'),
    ('${CAIO}', 'casa', 'Caio', 'inativo'), ('${ZE}', 'outra', 'Zé', 'ativo');

  -- permissões de teste: dono edita RH da casa; tablet bate ponto na casa; outro tablet na outra unidade
  create table public.perm_teste (uid uuid, perm text, unidade text);
  insert into public.perm_teste values ('${DONO}', 'rh.employees.edit', 'casa'), ('${DONO}', 'rh.employees.view', 'casa'),
    ('${TABLET}', 'ponto.clock.create', 'casa'), ('${OUTRA}', 'ponto.clock.create', 'outra');
  create function public.hefisto_user_can(p_permission text, p_unidade_id text default null) returns boolean
    language sql stable security definer set search_path = public as
    $$ select exists (select 1 from public.perm_teste where uid = auth.uid() and perm = p_permission and unidade = p_unidade_id) $$;
`);

const sql = fs.readFileSync(path.join(raiz, "db", "PONTO_PIN_1_PIN_DO_FUNCIONARIO.sql"), "utf8");
const res = await pg.exec(sql);
console.log(`     impressão digital: ${res.find((r) => r.rows?.[0]?.impressao_digital)?.rows?.[0]?.impressao_digital}`);

async function como(uid, consulta) {
  await pg.exec("begin");
  try {
    await pg.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    const r = await pg.query(consulta);
    await pg.exec("commit");
    return r.rows[0]?.r ?? r.rows;
  } catch (e) {
    await pg.exec("rollback");
    return { excecao: e.message };
  }
}

conferir("dono define o PIN da Ana", await como(DONO, `select public.hefisto_definir_pin('${ANA}', '4826') as r`), { ok: true });
conferir("PIN fraco é recusado", (await como(DONO, `select public.hefisto_definir_pin('${BETO}', '1234') as r`)).ok, false);
conferir("PIN repetido é recusado", (await como(DONO, `select public.hefisto_definir_pin('${BETO}', '1111') as r`)).ok, false);
conferir("PIN de outra pessoa da unidade é recusado", (await como(DONO, `select public.hefisto_definir_pin('${BETO}', '4826') as r`)).erro, "Este PIN já é de outra pessoa da unidade. Escolha outro.");
conferir("Beto ganha outro PIN", await como(DONO, `select public.hefisto_definir_pin('${BETO}', '7391') as r`), { ok: true });
conferir("tablet NÃO define PIN", (await como(TABLET, `select public.hefisto_definir_pin('${ANA}', '5555') as r`)).ok, false);

const hash = await pg.query(`select pin_hash from public.colaborador_pin where colaborador_id = '${ANA}'`);
conferir("o PIN fica só como hash (bcrypt)", /^\$2[aby]\$/.test(hash.rows[0].pin_hash) && !hash.rows[0].pin_hash.includes("4826"), true);

conferir("tablet acha a Ana pelo PIN", await como(TABLET, `select public.hefisto_conferir_pin('casa', '4826') as r`), { ok: true, nome: "Ana", colaborador_id: ANA });
conferir("tablet de outra unidade não confere PIN da casa", (await como(OUTRA, `select public.hefisto_conferir_pin('casa', '4826') as r`)).ok, false);
conferir("dono sem permissão de ponto não confere PIN", (await como(DONO, `select public.hefisto_conferir_pin('casa', '4826') as r`)).ok, false);

await pg.exec(`update public.colaboradores set status = 'inativo' where id = '${BETO}'`);
conferir("funcionário desligado não bate mais pelo PIN", (await como(TABLET, `select public.hefisto_conferir_pin('casa', '7391') as r`)).ok, false);

for (let i = 0; i < 4; i++) await como(TABLET, `select public.hefisto_conferir_pin('casa', '000${i}') as r`);
const travado = await como(TABLET, `select public.hefisto_conferir_pin('casa', '4826') as r`);
conferir("5 erros em 10 minutos travam o tablet, mesmo com o PIN certo", travado.bloqueado, true);

conferir("o app não lê a tabela de PINs", /permission denied/i.test((await como(DONO, "select * from public.colaborador_pin")).excecao || ""), true);
conferir("o app não lê as tentativas", /permission denied/i.test((await como(TABLET, "select * from public.ponto_pin_tentativas")).excecao || ""), true);

const temPin = await como(DONO, `select array_agg(x)::text as r from public.hefisto_tem_pin('casa') x`);
conferir("RH vê quem tem PIN, sem o PIN", typeof temPin === "string" && temPin.includes(ANA), true);

let anon = null;
await pg.exec("begin");
try { await pg.exec("set local role anon"); await pg.query("select public.hefisto_conferir_pin('casa', '4826')"); } catch (e) { anon = e.message; }
await pg.exec("rollback");
conferir("visitante sem login não chama a função", /permission denied/i.test(anon || ""), true);

let repetida = null;
try { await pg.exec(sql); } catch (e) { repetida = e.message; }
conferir("rodar de novo aborta no preflight", /já existe/.test(repetida || ""), true);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
