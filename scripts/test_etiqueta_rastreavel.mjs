/* Prova as invariantes da etiqueta rastreável num Postgres descartável.
   Monta o ERP mínimo (unidades, insumos, estoques multi + lotes + FEFO com os
   ARQUIVOS REAIS do repositório), aplica db/etiquetas/0001 e exercita os
   fluxos: recebimento, reimpressão, abertura, uso, perda, fracionamento,
   produção, concorrência, tenant e QR público.

   Não toca em banco nenhum de verdade. Classificação: UNIT_TESTED.

   Uso: node scripts/test_etiqueta_rastreavel.mjs <caminho do @electric-sql/pglite>
   A última linha diz RESULTADO: OK ou RESULTADO: FALHOU.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PGLITE = process.argv[2];
if (!PGLITE) { console.error("Informe o caminho do @electric-sql/pglite."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(PGLITE, "dist/index.js")).href);
const db = await PGlite.create();

let total = 0, falhas = 0;
const conferir = (titulo, obtido, esperado) => {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${titulo}${ok ? "" : `\n      esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
};
const uma = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const num = (v) => Math.round(Number(v) * 1000) / 1000;
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");

/* ── ERP mínimo: só o que as funções tocam ───────────────────────────────── */
await db.exec(`
  create role authenticated; create role service_role bypassrls; create role anon;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('teste.uid', true), '')::uuid $$;
  grant usage on schema auth, public to authenticated, anon, service_role;

  create table public.unidades (id text primary key, nome text);
  insert into public.unidades values ('u1','Restaurante Teste'), ('u2','Outra Empresa');

  create table public.insumos (
    id uuid primary key default gen_random_uuid(),
    unidade_id text references public.unidades(id),
    nome text, departamento text, unidade_medida text default 'kg',
    custo_unitario numeric default 0, custo_compra numeric default 0,
    estoque_minimo numeric default 0, estoque_maximo numeric,
    validade date, ativo boolean default true
  );
  create table public.estoque_atual (
    id uuid primary key default gen_random_uuid(),
    unidade_id text, insumo_id uuid, quantidade_atual numeric default 0,
    unique (unidade_id, insumo_id)
  );

  /* etiquetas como está em produção hoje (sem as colunas novas) */
  create table public.etiquetas (
    id uuid primary key default gen_random_uuid(),
    unidade_id text references public.unidades(id),
    codigo text, produto text, conservacao text,
    quantidade numeric, unidade text, validade_dias integer,
    manipulacao_em timestamptz, validade_em timestamptz,
    lote text, responsavel text, custo_unit numeric default 0,
    status text default 'ativa', copias integer default 1,
    tipo_etiqueta text default 'aberto', departamento text,
    created_at timestamptz default now()
  );

  create table public.fichas_tecnicas (id uuid primary key default gen_random_uuid(), unidade_id text, nome_receita text);
  create table public.colaboradores (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
  create table public.producao_diaria (
    id uuid primary key default gen_random_uuid(),
    unidade_id text, ficha_id uuid, colaborador_id uuid,
    quantidade numeric, created_at timestamptz default now()
  );
`);

/* Os arquivos REAIS do repositório: multi-estoque, depois lotes/FEFO. */
await db.exec(ler("docs/estoques-multiplos.sql"));
await db.exec(ler("db/migracao_estoque_lotes.sql"));
await db.exec(ler("db/etiquetas/0001_saldo_e_linhagem.sql"));
conferir("0. bootstrap + lotes + etiqueta rastreável aplicam em sequência", true, true);
/* De novo, para provar idempotência da migration nova. */
await db.exec(ler("db/etiquetas/0001_saldo_e_linhagem.sql"));
conferir("0b. a migration roda duas vezes sem quebrar", true, true);

/* ── Dados de teste ──────────────────────────────────────────────────────── */
const ID = {
  insumo: "aaaaaaaa-0000-4000-8000-000000000001",
  insumoBar: "aaaaaaaa-0000-4000-8000-000000000002",
  molho: "aaaaaaaa-0000-4000-8000-000000000003",
  ficha: "bbbbbbbb-0000-4000-8000-000000000001",
  producao: "cccccccc-0000-4000-8000-000000000001",
};
await db.exec(`
  insert into public.insumos (id, unidade_id, nome, departamento, unidade_medida, custo_unitario) values
    ('${ID.insumo}', 'u1', 'Creme de leite', 'cozinha', 'l', 12),
    ('${ID.insumoBar}', 'u1', 'Xarope', 'bar', 'l', 20),
    ('${ID.molho}', 'u1', 'Molho branco', 'cozinha', 'kg', 8);
  insert into public.fichas_tecnicas (id, unidade_id, nome_receita) values ('${ID.ficha}', 'u1', 'Molho branco');
  insert into public.producao_diaria (id, unidade_id, ficha_id, quantidade) values ('${ID.producao}', 'u1', '${ID.ficha}', 6);
  insert into public.estoques (unidade_id, nome, slug, tipo, controla_validade) values
    ('u1','Cozinha','cozinha','alimentos',true), ('u1','Bar','bar','bebidas',true),
    ('u1','Pré-preparos cozinha','pre-preparos-cozinha','alimentos',true),
    ('u1','Pré-preparos bar','pre-preparos-bar','bebidas',true),
    ('u2','Cozinha','cozinha','alimentos',true)
  on conflict (unidade_id, slug) do nothing;
`);

const saldoEstoque = async (slug, insumo) => num((await uma(
  `select coalesce(it.quantidade_atual,0) as q from public.estoque_itens it
     join public.estoques e on e.id = it.estoque_id
    where e.slug = $1 and e.unidade_id = 'u1' and it.insumo_id = $2`, [slug, insumo]))?.q ?? 0);
const contarMovimentos = async () => Number((await uma("select count(*)::int as n from public.estoque_movimentacoes_multi")).n);

async function novaEtiqueta({ produto, insumo, qtd, unidade = "l", condicao = "fechado", dept = "cozinha", unidadeId = "u1" }) {
  const r = await uma(`
    insert into public.etiquetas (unidade_id, codigo, produto, quantidade, unidade, validade_em, responsavel, departamento, tipo_etiqueta, insumo_id, condicao_estoque, saldo_unidade)
    values ($1, upper(substr(md5(gen_random_uuid()::text),1,8)), $2, $3, $4, now() + interval '3 days', 'Eduarda', $5, $6, $7, $6, $4)
    returning *`, [unidadeId, produto, qtd, unidade, dept, condicao, insumo]);
  return r;
}

/* ── A. Recebimento etiquetado ───────────────────────────────────────────── */
const etqA = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 1 });
const recebida = await uma("select * from public.etiqueta_registrar_entrada($1, null, 'Eduarda')", [etqA.id]);
conferir("A. recebimento: saldo da etiqueta e estoque fechado sobem 1",
  [num(recebida.saldo), recebida.condicao_estoque, recebida.rastreavel, await saldoEstoque("cozinha", ID.insumo)],
  [1, "fechado", true, 1]);

/* ── B. Reimpressão não movimenta ────────────────────────────────────────── */
const movsAntes = await contarMovimentos();
await db.exec(`select public.etiqueta_reimprimir('${etqA.id}', null, 'Eduarda', 'molhou')`);
conferir("B. reimpressão: nenhum movimento novo e saldo intacto",
  [await contarMovimentos() - movsAntes, num((await uma("select saldo from public.etiquetas where id=$1", [etqA.id])).saldo), await saldoEstoque("cozinha", ID.insumo)],
  [0, 1, 1]);
conferir("B2. a reimpressão virou evento auditável",
  Number((await uma("select count(*)::int as n from public.etiqueta_eventos where tipo='reimpressa'")).n), 1);

/* ── C. Abertura sem consumo ─────────────────────────────────────────────── */
const etqC = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 1 });
await db.exec(`select public.etiqueta_registrar_entrada('${etqC.id}')`);
const abertaC = await uma("select * from public.etiqueta_abrir($1, 0)", [etqC.id]);
conferir("C. abrir sem usar: sai do fechado, entra no aberto, total igual",
  [num(abertaC.saldo), abertaC.condicao_estoque, await saldoEstoque("cozinha", ID.insumo), await saldoEstoque("pre-preparos-cozinha", ID.insumo)],
  [1, "aberto", 1, 1]);

/* ── D. Abertura com consumo ─────────────────────────────────────────────── */
const etqD = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 1 });
await db.exec(`select public.etiqueta_registrar_entrada('${etqD.id}')`);
const abertaD = await uma("select * from public.etiqueta_abrir($1, 0.3)", [etqD.id]);
conferir("D. abrir usando 300 ml: sobra 700 ml aberto e o fechado cai",
  [num(abertaD.saldo), await saldoEstoque("cozinha", ID.insumo), num(await saldoEstoque("pre-preparos-cozinha", ID.insumo))],
  [0.7, 1, 1.7]);
conferir("D2. a etiqueta fechada foi encerrada e ficou registrada como fechada",
  (await uma("select status, condicao_estoque, saldo from public.etiquetas where id=$1", [etqD.id])),
  { status: "baixa", condicao_estoque: "fechado", saldo: "0.000" });

/* ── E. Uso parcial ──────────────────────────────────────────────────────── */
const usadaE = await uma("select * from public.etiqueta_usar($1, 0.2)", [abertaD.id]);
conferir("E. usar 200 ml de 700: sobra 500 e o estoque acompanha",
  [num(usadaE.saldo), num(await saldoEstoque("pre-preparos-cozinha", ID.insumo))], [0.5, 1.5]);

/* ── F. Perda ────────────────────────────────────────────────────────────── */
const perdidaF = await uma("select * from public.etiqueta_perda($1, 0.1, 'caiu no chão')", [abertaD.id]);
conferir("F. perda de 100 ml: saldo 400 e estoque 1,4",
  [num(perdidaF.saldo), num(await saldoEstoque("pre-preparos-cozinha", ID.insumo))], [0.4, 1.4]);
conferir("F2. perda ficou registrada como perda, não como consumo",
  (await uma("select tipo, quantidade from public.etiqueta_eventos where etiqueta_id=$1 order by created_at desc limit 1", [abertaD.id])),
  { tipo: "perda", quantidade: "0.100" });

/* ── G. Fracionamento ────────────────────────────────────────────────────── */
const etqG = await novaEtiqueta({ produto: "Molho branco", insumo: ID.molho, qtd: 2, unidade: "kg", condicao: "manipulado" });
await db.exec(`select public.etiqueta_registrar_entrada('${etqG.id}')`);
const estoqueAntesG = await saldoEstoque("pre-preparos-cozinha", ID.molho);
const filhas = (await db.query("select * from public.etiqueta_fracionar($1, array[0.5,0.5,1]::numeric[])", [etqG.id])).rows;
const somaFilhas = num(filhas.reduce((s, f) => s + Number(f.saldo), 0));
conferir("G. fracionar 2 kg em 3 recipientes: soma igual e estoque inalterado",
  [filhas.length, somaFilhas, num(await saldoEstoque("pre-preparos-cozinha", ID.molho)), estoqueAntesG],
  [3, 2, 2, 2]);
conferir("G2. o pai zerou e as filhas guardam a origem",
  [num((await uma("select saldo from public.etiquetas where id=$1", [etqG.id])).saldo),
   Number((await uma("select count(*)::int as n from public.etiqueta_relacoes where etiqueta_origem_id=$1 and tipo_relacao='fracionamento'", [etqG.id])).n)],
  [0, 3]);

/* ── H. Produção: etiquetas NÃO criam entrada ────────────────────────────── */
await db.exec(`
  insert into public.estoque_itens (unidade_id, estoque_id, insumo_id, quantidade_atual)
  select 'u1', e.id, '${ID.molho}', 0 from public.estoques e where e.slug='pre-preparos-cozinha' and e.unidade_id='u1'
  on conflict (estoque_id, insumo_id) do nothing;
  select public.registrar_movimento_estoque_lote('u1', (select id from public.estoques where slug='pre-preparos-cozinha' and unidade_id='u1'), '${ID.molho}', 'entrada', 6, null, null, 'Produção', 'Produção do dia', now());
`);
const estoqueAposProducao = await saldoEstoque("pre-preparos-cozinha", ID.molho);
const etiquetasProducao = [];
for (const parte of [2, 2, 2]) {
  const e = await novaEtiqueta({ produto: "Molho branco", insumo: ID.molho, qtd: parte, unidade: "kg", condicao: "manipulado" });
  etiquetasProducao.push(await uma("select * from public.etiqueta_vincular_producao($1, $2)", [e.id, ID.producao]));
}
conferir("H. 3 etiquetas de 2 kg numa produção de 6 kg: estoque continua o mesmo",
  [num(etiquetasProducao.reduce((s, e) => s + Number(e.saldo), 0)),
   num(await saldoEstoque("pre-preparos-cozinha", ID.molho)), num(estoqueAposProducao)],
  [6, estoqueAposProducao, estoqueAposProducao]);

const excedeu = await (async () => {
  const e = await novaEtiqueta({ produto: "Molho branco", insumo: ID.molho, qtd: 1, unidade: "kg", condicao: "manipulado" });
  try { await db.exec(`select public.etiqueta_vincular_producao('${e.id}', '${ID.producao}')`); return "aceitou"; }
  catch (err) { return String(err?.message || err).includes("não dá para etiquetar mais") ? "recusou" : "erro diferente"; }
})();
conferir("H2. etiquetar mais do que foi produzido é recusado", excedeu, "recusou");

/* ── I. Reimpressão de etiqueta de produção ──────────────────────────────── */
const movsAntesI = await contarMovimentos();
await db.exec(`select public.etiqueta_reimprimir('${etiquetasProducao[0].id}')`);
conferir("I. reimprimir etiqueta de produção não mexe no estoque",
  [await contarMovimentos() - movsAntesI, num(await saldoEstoque("pre-preparos-cozinha", ID.molho))],
  [0, num(estoqueAposProducao)]);

/* ── J. Saldo negativo e concorrência ────────────────────────────────────── */
const negativo = await (async () => {
  try { await db.exec(`select public.etiqueta_usar('${abertaD.id}', 99)`); return "aceitou"; }
  catch (e) { return String(e?.message || e).includes("maior que o saldo") ? "recusou" : "erro diferente"; }
})();
conferir("J. usar mais do que o saldo é recusado", negativo, "recusou");
conferir("J2. o saldo continua o que era", num((await uma("select saldo from public.etiquetas where id=$1", [abertaD.id])).saldo), 0.4);

/* Idempotência: a mesma requisição repetida não desconta duas vezes. */
const chave = "req-teste-123";
await db.exec(`select public.etiqueta_usar('${abertaD.id}', 0.1, null, 'Eduarda', null, '${chave}')`);
const saldoDepoisDe1 = num((await uma("select saldo from public.etiquetas where id=$1", [abertaD.id])).saldo);
await db.exec(`select public.etiqueta_usar('${abertaD.id}', 0.1, null, 'Eduarda', null, '${chave}')`);
conferir("J3. retry com a mesma chave não desconta de novo",
  [saldoDepoisDe1, num((await uma("select saldo from public.etiquetas where id=$1", [abertaD.id])).saldo)], [0.3, 0.3]);

/* ── K. Tenant: etiqueta de outra empresa ────────────────────────────────── */
await db.exec(`
  alter table public.etiquetas enable row level security;
  grant select, update on public.etiquetas to authenticated;
  grant usage on schema public to authenticated;
  drop policy if exists etiquetas_da_unidade on public.etiquetas;
  create policy etiquetas_da_unidade on public.etiquetas for all to authenticated
    using (unidade_id = current_setting('teste.unidade', true))
    with check (unidade_id = current_setting('teste.unidade', true));
`);
const etqOutra = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 1, unidadeId: "u2" });
const tenant = await (async () => {
  await db.exec("set role authenticated;");
  await db.exec("select set_config('teste.unidade','u1',false);");
  try { await db.query("select public.etiqueta_usar($1, 0.1)", [etqOutra.id]); return "conseguiu"; }
  catch (e) { return String(e?.message || e).includes("não encontrada") ? "bloqueado" : `erro diferente: ${String(e?.message || e).slice(0, 50)}`; }
  finally { await db.exec("reset role;"); }
})();
conferir("K. usuário de outra unidade não opera a etiqueta alheia", tenant, "bloqueado");

/* ── L. QR público não vaza dado interno ─────────────────────────────────── */
const publico = await uma("select * from public.get_etiqueta_publica($1)", [etqA.codigo]);
conferir("L. rastreio público devolve só o que está impresso no papel",
  Object.keys(publico).sort(),
  ["codigo", "conservacao", "lote", "manipulacao_em", "produto", "quantidade", "status", "unidade", "unidade_nome", "validade_em"]);
conferir("L2. nada de saldo, custo, linhagem, produção, responsável ou id interno",
  ["saldo", "custo_unit", "insumo_id", "estoque_id", "producao_id", "id", "responsavel", "condicao_estoque", "rastreavel"]
    .filter((k) => k in publico), []);

/* ── Invariante final: etiquetas rastreáveis x saldo do estoque ──────────── */
const conciliacao = await uma(`
  select coalesce(sum(e.saldo),0) as etiquetas,
         (select coalesce(sum(it.quantidade_atual),0) from public.estoque_itens it
            join public.estoques s on s.id = it.estoque_id
           where s.slug='pre-preparos-cozinha' and s.unidade_id='u1' and it.insumo_id=$1) as estoque
    from public.etiquetas e
   where e.insumo_id = $1 and e.rastreavel and coalesce(e.saldo,0) > 0
     and e.estoque_id = (select id from public.estoques where slug='pre-preparos-cozinha' and unidade_id='u1')`,
  [ID.insumo]);
conferir("M. o que as etiquetas dizem bate com o saldo do estoque de manipulados",
  num(conciliacao.etiquetas), num(conciliacao.estoque));

console.log(`\n${total - falhas}/${total} verificações passaram.`);
console.log(falhas ? "RESULTADO: FALHOU" : "RESULTADO: OK");
process.exit(falhas ? 1 : 0);
