// SQL REAL da migração RH-FICHA-1 num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/ficha-funcionario-banco.test.mjs
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
  console.log("PGLITE não informado: testes de banco do RH-FICHA-1 NÃO executados.");
  process.exit(2);
}

const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

const DONO = "11111111-1111-1111-1111-111111111111";
const TABLET = "22222222-2222-2222-2222-222222222222"; // tablet de setor: sem RH
const GERENTE_OUTRA = "33333333-3333-3333-3333-333333333333";
const LEITOR = "44444444-4444-4444-4444-444444444444"; // só vê o RH
const ANA = "aaaaaaaa-0000-0000-0000-000000000001";
const ZE = "aaaaaaaa-0000-0000-0000-000000000004"; // outra unidade

await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;

  create table public.colaboradores (id uuid primary key, unidade_id text, nome text, status text);
  insert into public.colaboradores values ('${ANA}', 'casa', 'Ana', 'ativo'), ('${ZE}', 'outra', 'Zé', 'ativo');
  grant select on public.colaboradores to authenticated;

  create table public.perm_teste (uid uuid, perm text, unidade text);
  insert into public.perm_teste values
    ('${DONO}', 'rh.employees.view', 'casa'), ('${DONO}', 'rh.employees.create', 'casa'), ('${DONO}', 'rh.employees.edit', 'casa'),
    ('${TABLET}', 'ponto.clock.create', 'casa'),
    ('${GERENTE_OUTRA}', 'rh.employees.view', 'outra'), ('${GERENTE_OUTRA}', 'rh.employees.edit', 'outra'),
    ('${LEITOR}', 'rh.employees.view', 'casa');
  create function public.hefisto_user_can(p_permission text, p_unidade_id text default null) returns boolean
    language sql stable security definer set search_path = public as
    $$ select exists (select 1 from public.perm_teste where uid = auth.uid() and perm = p_permission and unidade = p_unidade_id) $$;
`);

const sql = fs.readFileSync(path.join(raiz, "db", "RH_FICHA_1_REGISTROS_DO_FUNCIONARIO.sql"), "utf8");
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

// unidade mentida no corpo: o gatilho põe a do funcionário
const ins = await como(DONO, `insert into public.rh_registros_colab (unidade_id, colaborador_id, tipo, titulo, descricao, gravidade, registrado_por)
  values ('outra', '${ANA}', 'advertencia_escrita', 'Atraso repetido', 'Chegou 40 min atrasada pela 3ª vez no mês.', 'media', 'Lucas') returning id, unidade_id, criado_por`);
conferir("dono registra advertência; unidade vem do cadastro", [ins[0]?.unidade_id, ins[0]?.criado_por], ["casa", DONO]);
const id = ins[0]?.id;

const uni = await como(DONO, `insert into public.rh_registros_colab (unidade_id, colaborador_id, tipo, titulo, item, quantidade, tamanho)
  values ('casa', '${ANA}', 'uniforme', 'Entrega de uniforme', 'Dólmã', 2, 'M') returning id, quantidade`);
conferir("uniforme com item, quantidade e tamanho", Number(uni[0]?.quantidade), 2);

conferir("gerente de outra unidade não registra na casa", /row-level security/i.test((await como(GERENTE_OUTRA, `insert into public.rh_registros_colab (unidade_id, colaborador_id, tipo, titulo) values ('outra', '${ANA}', 'observacao', 'Teste')`)).excecao || ""), true);
conferir("gerente de outra unidade não vê a ficha da casa", (await como(GERENTE_OUTRA, `select id from public.rh_registros_colab`)).length, 0);
conferir("tablet de setor não vê a ficha", (await como(TABLET, `select id from public.rh_registros_colab`)).length, 0);
conferir("quem só vê o RH lê a ficha", (await como(LEITOR, `select id from public.rh_registros_colab`)).length, 2);
conferir("quem só vê o RH não registra", /row-level security/i.test((await como(LEITOR, `insert into public.rh_registros_colab (unidade_id, colaborador_id, tipo, titulo) values ('casa', '${ANA}', 'observacao', 'Teste')`)).excecao || ""), true);

conferir("o texto não muda depois de criado", /não se altera/.test((await como(DONO, `update public.rh_registros_colab set descricao = 'outra coisa' where id = '${id}'`)).excecao || ""), true);
const ass = await como(DONO, `update public.rh_registros_colab set assinado = true, arquivo_url = 'storage://rh-docs/casa/registros/x/y.pdf' where id = '${id}' returning assinado_em is not null as ok`);
conferir("anexar a cópia assinada é permitido e carimba a hora", ass[0]?.ok, true);
conferir("recusa de assinatura exige testemunhas", /rh_registros_colab_recusa/.test((await como(DONO, `update public.rh_registros_colab set recusou_assinar = true where id = '${id}'`)).excecao || ""), true);
conferir("anular exige motivo", /rh_registros_colab_anulacao/.test((await como(DONO, `update public.rh_registros_colab set anulado_em = now() where id = '${id}'`)).excecao || ""), true);
conferir("anula com motivo", (await como(DONO, `update public.rh_registros_colab set anulado_em = now(), anulado_motivo = 'Registrado no funcionário errado' where id = '${id}' returning id`)).length, 1);
conferir("anulado não muda mais", /anulado não se altera/.test((await como(DONO, `update public.rh_registros_colab set assinado = false where id = '${id}'`)).excecao || ""), true);
conferir("ninguém apaga registro", /permission denied/i.test((await como(DONO, `delete from public.rh_registros_colab where id = '${id}'`)).excecao || ""), true);
conferir("tipo fora da lista é recusado", /check/i.test((await como(DONO, `insert into public.rh_registros_colab (colaborador_id, tipo, titulo, unidade_id) values ('${ANA}', 'demissao', 'X', 'casa')`)).excecao || ""), true);

let anon = null;
await pg.exec("begin");
try { await pg.exec("set local role anon"); await pg.query("select * from public.rh_registros_colab"); } catch (e) { anon = e.message; }
await pg.exec("rollback");
conferir("visitante sem login não lê", /permission denied/i.test(anon || ""), true);

let repetida = null;
try { await pg.exec(sql); } catch (e) { repetida = e.message; }
conferir("rodar de novo aborta no preflight", /já existe/.test(repetida || ""), true);

conferir("impressão digital", digital, "13996d29be16a222dc78a9a7738a39f2");
console.log(falhas ? `\n${falhas} falha(s).` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
