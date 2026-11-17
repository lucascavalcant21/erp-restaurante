// SQL REAL da migração CONC-1 (cardápios dos concorrentes) num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/concorrentes-banco.test.mjs
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
  console.log("PGLITE não informado: testes de banco do CONC-1 NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

const DONO = "11111111-1111-1111-1111-111111111111";
const LEITOR = "22222222-2222-2222-2222-222222222222";
const OUTRA = "33333333-3333-3333-3333-333333333333";

await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  create table public.perm_teste (uid uuid, perm text, unidade text);
  insert into public.perm_teste values
    ('${DONO}', 'marmitaria.competitors.create', 'casa'), ('${DONO}', 'marmitaria.competitors.view', 'casa'), ('${DONO}', 'marmitaria.competitors.delete', 'casa'),
    ('${LEITOR}', 'marmitaria.competitors.view', 'casa'),
    ('${OUTRA}', 'marmitaria.competitors.view', 'outra'), ('${OUTRA}', 'marmitaria.competitors.create', 'outra'), ('${OUTRA}', 'marmitaria.competitors.delete', 'outra');
  create function public.hefisto_user_can(p_permission text, p_unidade_id text default null) returns boolean
    language sql stable security definer set search_path = public as
    $$ select exists (select 1 from public.perm_teste where uid = auth.uid() and perm = p_permission and unidade = p_unidade_id) $$;
`);

const sql = fs.readFileSync(path.join(raiz, "db", "CONC_1_CARDAPIOS_CONCORRENTES.sql"), "utf8");
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
const lit = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const cardapio = {
  concorrente: "  Marmitaria   da Vila ", plataforma: "iFood", fonte: "foto", chave: "leitura-0001-abc", observado_em: "2026-11-17",
  taxa_entrega: "6.99", pedido_minimo: "20", tempo_entrega: "40-50 min", avaliacao: "4.7", link: "javascript:alert(1)",
  itens: [
    { tipo: "prato", categoria: "Marmitas", nome: "Marmita de frango grelhado", componentes: ["arroz", "feijão", "frango grelhado", "salada", " "], peso_g: "500", preco: "24.90", preco_original: "29.90" },
    { tipo: "adicional", grupo: "Turbine sua marmita", nome: "Ovo frito", preco: "3" },
    { tipo: "adicional", grupo: "Turbine sua marmita", nome: "Bacon", preco: "" },
    { tipo: "hack", nome: "Coca-Cola lata", preco: "6.5", preco_original: "5" },
    { tipo: "prato", nome: "", preco: "10" },
  ],
};
const salvar = (dados, unidade = "casa") => `select public.hefisto_salvar_leitura_concorrente('${unidade}', ${lit(dados)}) as r`;

conferir("quem só lê não grava", (await como(LEITOR, salvar(cardapio))).ok, false);
conferir("outra empresa não grava na casa", (await como(OUTRA, salvar(cardapio))).ok, false);
conferir("sem itens é recusado", (await como(DONO, salvar({ ...cardapio, chave: "leitura-vazia-01", itens: [] }))).ok, false);
const s1 = await como(DONO, salvar(cardapio));
conferir("dono guarda: só itens com nome e preço (3 de 5)", [s1.ok, s1.itens, s1.idempotente], [true, 3, false]);
const s1b = await como(DONO, salvar(cardapio));
conferir("mesma chave não duplica", [s1b.ok, s1b.idempotente, s1b.leitura_id], [true, true, s1.leitura_id]);

const c = (await como(LEITOR, "select nome, plataforma, link from public.delivery_concorrentes"))[0];
conferir("nome limpo, plataforma em minúscula, link inseguro descartado", [c.nome, c.plataforma, c.link], ["Marmitaria da Vila", "ifood", null]);
const l = (await como(LEITOR, "select observado_em::text as d, fonte, taxa_entrega::text as t, pedido_minimo::text as m, avaliacao::text as a, qtd_itens from public.delivery_concorrentes_leituras"))[0];
conferir("leitura com data, taxa, mínimo e nota", [l.d, l.fonte, l.t, l.m, l.a, l.qtd_itens], ["2026-11-17", "foto", "6.99", "20.00", "4.7", 3]);
const it = await como(LEITOR, "select ordem, tipo, grupo, nome, componentes, peso_g::text as p, preco::text as v, preco_original::text as o from public.delivery_concorrentes_itens order by ordem");
conferir("prato com componentes (vazio sai), peso e preço riscado", [it[0].tipo, it[0].componentes, it[0].p, it[0].v, it[0].o], ["prato", ["arroz", "feijão", "frango grelhado", "salada"], "500.0", "24.90", "29.90"]);
conferir("adicional com grupo", [it[1].tipo, it[1].grupo, it[1].v], ["adicional", "Turbine sua marmita", "3.00"]);
conferir("tipo inválido vira 'outro'; 'riscado' menor que o preço é ignorado", [it[2].tipo, it[2].o], ["outro", null]);

const s2 = await como(DONO, salvar({ ...cardapio, concorrente: "marmitaria da vila", chave: "leitura-0002-abc", observado_em: "2026-11-24",
  itens: [{ tipo: "prato", nome: "Marmita de frango grelhado", preco: "26.90" }] }));
conferir("nova leitura do mesmo concorrente: guarda histórico, não cria outro", [s2.ok, s2.concorrente_id === s1.concorrente_id], [true, true]);
conferir("duas leituras guardadas", (await como(LEITOR, "select count(*)::int as r from public.delivery_concorrentes_leituras")), 2);
conferir("outra empresa não vê nada da casa", (await como(OUTRA, "select id from public.delivery_concorrentes_itens")).length, 0);
conferir("ninguém grava direto na tabela", /permission denied/i.test((await como(DONO, "update public.delivery_concorrentes_itens set preco = 1")).excecao || ""), true);

conferir("quem só lê não apaga", (await como(LEITOR, `select public.hefisto_apagar_leitura_concorrente('${s2.leitura_id}') as r`)).ok, false);
conferir("outra empresa não apaga", (await como(OUTRA, `select public.hefisto_apagar_leitura_concorrente('${s2.leitura_id}') as r`)).ok, false);
conferir("dono apaga a leitura errada (e os itens dela)", (await como(DONO, `select public.hefisto_apagar_leitura_concorrente('${s2.leitura_id}') as r`)).ok, true);
conferir("sobra a primeira leitura com os 3 itens", (await pg.query("select count(*)::int as n from public.delivery_concorrentes_itens")).rows[0].n, 3);

let anon = null;
await pg.exec("begin");
try { await pg.exec("set local role anon"); await pg.query("select * from public.delivery_concorrentes"); } catch (e) { anon = e.message; }
await pg.exec("rollback");
conferir("visitante sem login não lê", /permission denied/i.test(anon || ""), true);

let repetida = null;
try { await pg.exec(sql); } catch (e) { repetida = e.message; }
conferir("rodar de novo aborta no preflight", /já existem/.test(repetida || ""), true);
conferir("impressão digital", digital, "5914f480e5d072dd0b31a8e0ce4f44d1");
console.log(falhas ? `\n${falhas} falha(s).` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
