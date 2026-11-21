// SQL REAL da CONS-1 (consultório) em Postgres local (PGlite): quem vê o quê.
// Rode com PGLITE=<caminho de @electric-sql/pglite>. Sem PGLITE, sai com 2.

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
const E = "e0000000-0000-4000-8000-000000000001"; const F = "e0000000-0000-4000-8000-000000000002";
const DONO = "11111111-1111-1111-1111-111111111111", SEC = "22222222-2222-2222-2222-222222222222",
  GER = "33333333-3333-3333-3333-333333333333", OUTRO = "44444444-4444-4444-4444-444444444444", MED2 = "55555555-5555-5555-5555-555555555555";
await pg.exec(`
  create role anon nologin; create role authenticated nologin; create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
  create table public.unidades (id text primary key, nome text not null, cor text, ativo boolean, empresa_id uuid);
  insert into public.unidades values ('teste', 'Restaurante', null, true, '${E}'), ('marmitaria', 'Delivery', null, true, '${E}'), ('x', 'Outra empresa', null, true, '${F}');
  create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid, status text, locked_until timestamptz, super_admin boolean default false, unidade_principal_id text);
  create table public.usuario_escopos (id uuid primary key default gen_random_uuid(), usuario_id uuid, empresa_id uuid, unidade_id text, data_scope text);
  insert into public.usuarios_erp (auth_user_id, status, super_admin, unidade_principal_id) values
    ('${DONO}', 'ativo', true, 'teste'), ('${SEC}', 'ativo', false, 'consultorio'), ('${GER}', 'ativo', false, 'teste'),
    ('${OUTRO}', 'ativo', true, 'x'), ('${MED2}', 'ativo', false, 'teste');
  insert into public.usuario_escopos (usuario_id, empresa_id, unidade_id, data_scope)
    select id, '${E}', null, 'empresa' from public.usuarios_erp where auth_user_id = '${GER}';
  insert into public.usuario_escopos (usuario_id, empresa_id, unidade_id, data_scope)
    select id, null, 'consultorio', 'unidade' from public.usuarios_erp where auth_user_id = '${MED2}';
`);
const sql = fs.readFileSync(path.join(raiz, "db", "consultorio", "CONS_1_CONSULTORIO.sql"), "utf8");
await pg.exec(sql);
conferir("cria a unidade do consultório na empresa do Delivery", (await pg.query(`select empresa_id::text e from public.unidades where id = 'consultorio'`)).rows[0]?.e, E);
await pg.exec(sql);
conferir("rodar de novo não duplica nem quebra", (await pg.query(`select count(*)::int n from pg_policies where tablename like 'cons\\_%'`)).rows[0].n, 16);

const db = (uid) => clienteSupabase(pg, { uid });
const [dono, sec, ger, outro, med2] = [DONO, SEC, GER, OUTRO, MED2].map(db);
const anon = clienteSupabase(pg, { uid: "" });
// Função que devolve várias linhas: chamada direta, com o papel do usuário.
const fichasDe = async (uid, paciente) => {
  await pg.exec("reset role");
  await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  await pg.exec("set role authenticated");
  try { return { data: (await pg.query(`select * from public.cons_fichas_do_paciente($1)`, [paciente])).rows, error: null }; }
  catch (e) { return { data: null, error: { message: e.message } }; }
  finally { await pg.exec("reset role"); }
};

// cadastros
let r = await dono.from("cons_tipos_consulta").insert({ unidade_id: "consultorio", nome: "Consulta", minutos: 30, valor_particular: 250 }).select("id");
const TIPO = r.data?.[0]?.id;
conferir("dono cadastra tipo de consulta", [r.error, !!TIPO], [null, true]);
r = await sec.from("cons_pacientes").insert({ unidade_id: "consultorio", nome: "Maria Souza", cpf: "12345678901", telefone: "81999990000" }).select("id");
const PAC = r.data?.[0]?.id;
conferir("secretária cadastra paciente", [r.error, !!PAC], [null, true]);
r = await sec.from("cons_pacientes").insert({ unidade_id: "consultorio", nome: "Repetida", cpf: "12345678901" });
conferir("CPF repetido na mesma unidade é recusado", !!r.error, true);
r = await sec.from("cons_consultas").insert({ unidade_id: "consultorio", paciente_id: PAC, tipo_id: TIPO, inicio: "2026-11-24T13:00:00Z", fim: "2026-11-24T13:30:00Z", motivo: "Dor nas costas", valor: 250 }).select("id");
const CON = r.data?.[0]?.id;
conferir("secretária agenda com o motivo", [r.error, !!CON], [null, true]);
r = await sec.from("cons_consultas").select("motivo").eq("id", CON);
conferir("secretária vê o motivo", r.data?.[0]?.motivo, "Dor nas costas");

// quem não deve ver
conferir("gerente do restaurante (escopo de empresa) não vê pacientes", (await ger.from("cons_pacientes").select("id")).data?.length, 0);
r = await ger.from("cons_pacientes").insert({ unidade_id: "consultorio", nome: "Intruso" });
conferir("gerente do restaurante não cadastra paciente", !!r.error, true);
conferir("administrador de outra empresa não vê pacientes", (await outro.from("cons_pacientes").select("id")).data?.length, 0);
conferir("sem login não vê nada", (await anon.from("cons_pacientes").select("id")).data?.length ?? 0, 0);

// ficha: só o médico que escreveu
r = await dono.from("cons_fichas").insert({ unidade_id: "consultorio", paciente_id: PAC, consulta_id: CON, diagnostico: "Lombalgia", cid: "M54.5", conduta: "Analgésico e fisioterapia", retorno_dias: 30 }).select("id, medico_id");
conferir("médico registra a ficha em nome dele", [r.error, r.data?.[0]?.medico_id], [null, DONO]);
conferir("secretária não lê a ficha", (await sec.from("cons_fichas").select("diagnostico")).data?.length, 0);
r = await sec.from("cons_fichas").insert({ unidade_id: "consultorio", paciente_id: PAC, medico_id: DONO, diagnostico: "falso" });
conferir("secretária não escreve ficha em nome do médico", !!r.error, true);
conferir("outro médico do consultório não lê a ficha", (await med2.from("cons_fichas").select("id")).data?.length, 0);
r = await fichasDe(MED2, PAC);
conferir("outro médico: a função devolve só as dele (nenhuma)", [r.error, r.data?.length], [null, 0]);
r = await fichasDe(DONO, PAC);
conferir("médico lê a própria ficha pela função", [r.error, r.data?.[0]?.diagnostico], [null, "Lombalgia"]);
r = await fichasDe(GER, PAC);
conferir("gerente do restaurante: a função recusa", !!r.error, true);
const acessos = (await pg.query(`select acao, usuario_id::text u from public.cons_acessos order by em, acao`)).rows.map((x) => `${x.acao}:${x.u.slice(0, 1)}`);
conferir("fica registrado quem criou e quem leu", acessos.sort(), ["criou:1", "leu:1", "leu:5"].sort());
r = await dono.from("cons_fichas").update({ medico_id: MED2 }).eq("paciente_id", PAC);
conferir("a ficha não muda de médico", !!r.error, true);

// integridade e exclusão
r = await dono.from("cons_pacientes").insert({ unidade_id: "teste", nome: "Paciente no restaurante" }).select("id");
const PAC_RES = r.data?.[0]?.id;
r = await dono.from("cons_consultas").insert({ unidade_id: "consultorio", paciente_id: PAC_RES, inicio: "2026-11-24T14:00:00Z", fim: "2026-11-24T14:30:00Z" });
conferir("consulta com paciente de outra unidade é recusada", /outra unidade/.test(r.error?.message || ""), true);
r = await dono.from("cons_pacientes").delete().eq("id", PAC);
conferir("ninguém exclui paciente (inativa)", !!r.error, true);
r = await sec.from("cons_consultas").update({ status: "chegou", chegada_em: "2026-11-24T12:55:00Z" }).eq("id", CON).select("status");
conferir("secretária marca a chegada", [r.error, r.data?.[0]?.status], [null, "chegou"]);
r = await sec.from("cons_consultas").update({ status: "inventado" }).eq("id", CON);
conferir("status fora da lista é recusado", !!r.error, true);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
