// SQL REAL da migração COMPRAS-COT-1 (pesquisa de preço por local) num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/cotacoes-banco.test.mjs
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
  console.log("PGLITE não informado: testes de banco do COMPRAS-COT-1 NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

const DONO = "11111111-1111-1111-1111-111111111111";
const OUTRA = "33333333-3333-3333-3333-333333333333";
const ARROZ = "aaaaaaaa-0000-4000-8000-000000000001";
const ARROZ_OUTRA = "aaaaaaaa-0000-4000-8000-000000000002";
const MERCADO_X = "bbbbbbbb-0000-4000-8000-000000000001";
const MERCADO_OUTRA = "bbbbbbbb-0000-4000-8000-000000000002";

// insumos e fornecedores reduzidos, com a mesma regra de unidade do banco real
await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  create table public.usuario_teste (uid uuid primary key, unidade text);
  insert into public.usuario_teste values ('${DONO}', 'casa'), ('${OUTRA}', 'outra');
  create function public.auth_unidade_id() returns text language sql stable security definer set search_path = public as
    $$ select unidade from public.usuario_teste where uid = auth.uid() $$;
  create table public.insumos (id uuid primary key, unidade_id text, nome text);
  insert into public.insumos values ('${ARROZ}', 'casa', 'Arroz'), ('${ARROZ_OUTRA}', 'outra', 'Arroz');
  alter table public.insumos enable row level security;
  create policy i on public.insumos for all to authenticated using (unidade_id = public.auth_unidade_id()) with check (unidade_id = public.auth_unidade_id());
  grant select on public.insumos to authenticated;
  create table public.fornecedores (id uuid primary key, unidade_id text, nome text);
  insert into public.fornecedores values ('${MERCADO_X}', 'casa', 'Mercado X'), ('${MERCADO_OUTRA}', 'outra', 'Mercado da outra');
`);

const sql = fs.readFileSync(path.join(raiz, "db", "COMPRAS_COT_1_PESQUISA_DE_PRECO.sql"), "utf8");
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
const inserir = (insumo, local, preco = 30) => `insert into public.compras_cotacoes
  (unidade_id, insumo_id, fornecedor_id, local_nome, marca, preco, tamanho_embalagem, unidade_embalagem, preco_normalizado)
  values ('outra', '${insumo}', '${local}', 'Mercado X', 'Tio João', ${preco}, 5, 'kg', ${preco / 5000})
  returning id, unidade_id, registrada_por, escolhida, escolhida_em`;

const c1 = await como(DONO, inserir(ARROZ, MERCADO_X));
conferir("dono registra o preço; a unidade vem do ingrediente, não do corpo", [c1[0]?.unidade_id, c1[0]?.registrada_por, c1[0]?.escolhida], ["casa", DONO, false]);
const id = c1[0]?.id;
conferir("não registra preço de ingrediente de outra empresa", !!(await como(DONO, inserir(ARROZ_OUTRA, MERCADO_OUTRA))).excecao, true);
conferir("local de outra unidade é recusado", !!(await como(DONO, inserir(ARROZ, MERCADO_OUTRA))).excecao, true);
conferir("preço zero é recusado", !!(await como(DONO, inserir(ARROZ, MERCADO_X, 0))).excecao, true);
conferir("a outra empresa não vê a pesquisa", (await como(OUTRA, "select count(*)::int n from public.compras_cotacoes")).at(0)?.n, 0);
conferir("o dono vê a pesquisa", (await como(DONO, "select count(*)::int n from public.compras_cotacoes")).at(0)?.n, 1);

const esc = await como(DONO, `update public.compras_cotacoes set escolhida = true where id = '${id}' returning escolhida, escolhida_em is not null as tem_data`);
conferir("marcar como escolhida grava a hora da escolha", [esc[0]?.escolhida, esc[0]?.tem_data], [true, true]);
conferir("o preço não se altera depois de gravado", !!(await como(DONO, `update public.compras_cotacoes set preco = 1 where id = '${id}'`)).excecao, true);
const outraMexe = await como(OUTRA, `update public.compras_cotacoes set escolhida = false where id = '${id}' returning id`);
conferir("a outra empresa não desmarca a escolha", Array.isArray(outraMexe) ? outraMexe.length : outraMexe, 0);
const desf = await como(DONO, `update public.compras_cotacoes set escolhida = false where id = '${id}' returning escolhida_em`);
conferir("desfazer a escolha limpa a hora", desf[0]?.escolhida_em, null);
conferir("ninguém apaga o histórico", !!(await como(DONO, `delete from public.compras_cotacoes where id = '${id}'`)).excecao, true);
conferir("anon não lê", !!(await (async () => { await pg.exec("begin"); try { await pg.exec("set local role anon"); await pg.query("select * from public.compras_cotacoes"); await pg.exec("commit"); return {}; } catch (e) { await pg.exec("rollback"); return { excecao: e.message }; } })()).excecao, true);

// Preflight: rodar de novo aborta sem mudar nada.
let abortou = false;
try { await pg.exec(sql); } catch (e) { abortou = /já existe/.test(e.message); }
conferir("rodar duas vezes aborta no preflight", abortou, true);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
