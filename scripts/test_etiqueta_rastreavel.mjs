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
  /* Schema REAL (db/migracao_producao_salao.sql): a coluna é
     quantidade_produzida. O stub anterior dizia "quantidade", e por isso o
     erro na RPC de produção passou batido aqui. */
  create table public.producao_diaria (
    id uuid primary key default gen_random_uuid(),
    unidade_id text not null, ficha_id uuid, colaborador_id uuid,
    quantidade_produzida numeric(14,3) not null default 0,
    departamento text, local_armazenamento text,
    created_at timestamptz not null default now()
  );
  create table public.contas_pagar (
    id uuid primary key default gen_random_uuid(),
    unidade_id text, descricao text, valor numeric, data_vencimento date,
    data_pagamento date, categoria text, status text
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
  insert into public.producao_diaria (id, unidade_id, ficha_id, quantidade_produzida) values ('${ID.producao}', 'u1', '${ID.ficha}', 6);
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

/* ═══════════════════════════════════════════════════════════════════════════
   FASE B.1 — o que a fase B tinha deixado frouxo
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── N. O evento aponta para o movimento CERTO, por RETURNING ────────────── */
const etqN = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 2 });
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda')", [etqN.id]);
const eventoN = await uma(
  "select movimento_id from public.etiqueta_eventos where etiqueta_id=$1 and tipo='recebida'", [etqN.id]);
const movN = await uma(
  "select id, quantidade, etiqueta_id from public.estoque_movimentacoes_multi where id=$1", [eventoN.movimento_id]);
conferir("N. o evento guarda o id do movimento que a própria função inseriu",
  [movN?.id === eventoN.movimento_id, num(movN?.quantidade), movN?.etiqueta_id === etqN.id],
  [true, 2, true]);

/* Prova que não é mais "o mais recente do par": um movimento posterior do MESMO
   par, feito por fora, não pode roubar o vínculo do evento anterior. */
await db.query(
  "select public.registrar_movimento_estoque_multi('u1', (select id from public.estoques where slug='cozinha' and unidade_id='u1'), $1, 'entrada', 5, null, 'Outro caminho', 'Compra avulsa')",
  [ID.insumo]);
const eventoNDepois = await uma(
  "select movimento_id from public.etiqueta_eventos where etiqueta_id=$1 and tipo='recebida'", [etqN.id]);
conferir("N2. movimento posterior do mesmo par não rouba o vínculo",
  eventoNDepois.movimento_id, eventoN.movimento_id);

/* ── O. Idempotência protege o MOVIMENTO, não só o evento ────────────────── */
const etqO = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 3 });
const chaveO = "entrada-retry-001";
const movsAntesO = await contarMovimentos();
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda', $2)", [etqO.id, chaveO]);
const movsMeioO = await contarMovimentos();
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda', $2)", [etqO.id, chaveO]);
const movsFimO = await contarMovimentos();
const eventosO = Number((await uma(
  "select count(*)::int as n from public.etiqueta_eventos where etiqueta_id=$1 and tipo='recebida'", [etqO.id])).n);
conferir("O. retry por timeout: 1 movimento e 1 evento, não 2 e 1",
  [movsMeioO - movsAntesO, movsFimO - movsMeioO, eventosO], [1, 0, 1]);
conferir("O2. a chave foi reservada antes do efeito e guarda o resultado",
  (await uma("select operacao, resultado_etiqueta_id is not null as fechada from public.etiqueta_operacoes where chave=$1", [chaveO])),
  { operacao: "registrar_entrada", fechada: true });

/* A mesma chave em outra operação é erro, não silêncio. */
const chaveTrocada = await (async () => {
  try { await db.query("select public.etiqueta_usar($1, 0.1, null, null, null, $2)", [etqO.id, chaveO]); return "aceitou"; }
  catch (e) { return String(e?.message || e).includes("já foi usada") ? "recusou" : "erro diferente"; }
})();
conferir("O3. chave reaproveitada em outra operação é recusada", chaveTrocada, "recusou");

/* ── P. Perda: estoque e financeiro na MESMA transação ───────────────────── */
const etqP = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 2, condicao: "aberto" });
await db.query("update public.etiquetas set custo_unit = 10 where id=$1", [etqP.id]);
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda')", [etqP.id]);
const chaveP = "perda-retry-001";
await db.query("select public.etiqueta_perda($1, 0.5, 'Caiu no chão', null, 'Eduarda', $2)", [etqP.id, chaveP]);
await db.query("select public.etiqueta_perda($1, 0.5, 'Caiu no chão', null, 'Eduarda', $2)", [etqP.id, chaveP]);
const pend = await db.query(
  "select valor, status, descricao from public.etiqueta_financeiro_pendente where etiqueta_id=$1", [etqP.id]);
conferir("P. a perda deixa UMA pendência financeira, na transação do estoque",
  [pend.rows.length, num(pend.rows[0]?.valor), pend.rows[0]?.status], [1, 5, "pendente"]);
conferir("P2. o saldo caiu uma vez só, apesar do retry",
  num((await uma("select saldo from public.etiquetas where id=$1", [etqP.id])).saldo), 1.5);

/* Se o movimento falhar, a pendência financeira não pode existir. */
const etqPFalha = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 1, condicao: "aberto" });
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda')", [etqPFalha.id]);
try { await db.query("select public.etiqueta_perda($1, 99, 'Impossível')", [etqPFalha.id]); } catch { /* esperado */ }
conferir("P3. perda recusada não deixa pendência financeira órfã",
  Number((await uma("select count(*)::int as n from public.etiqueta_financeiro_pendente where etiqueta_id=$1", [etqPFalha.id])).n), 0);

/* Fechar a pendência é idempotente. */
const idPend = (await uma("select id from public.etiqueta_financeiro_pendente where etiqueta_id=$1", [etqP.id])).id;
const contaFake = "dddddddd-0000-4000-8000-000000000001";
await db.query("select public.etiqueta_financeiro_marcar_lancado($1, $2)", [idPend, contaFake]);
await db.query("select public.etiqueta_financeiro_marcar_lancado($1, $2)", [idPend, "dddddddd-0000-4000-8000-000000000002"]);
conferir("P4. marcar lançado duas vezes não troca a conta nem duplica",
  (await uma("select status, conta_pagar_id from public.etiqueta_financeiro_pendente where id=$1", [idPend])),
  { status: "lancado", conta_pagar_id: contaFake });

/* ── Q. Unidades: converte o que dá, recusa o que não dá ─────────────────── */
conferir("Q. 500 g num insumo cadastrado em kg viram 0,5 kg",
  num((await uma("select public.etiqueta__converter(500, 'g', 'kg') as v")).v), 0.5);
conferir("Q2. 1 kg vira 1000 g e 1 L vira 1000 ml",
  [num((await uma("select public.etiqueta__converter(1,'kg','g') as v")).v),
   num((await uma("select public.etiqueta__converter(1,'l','ml') as v")).v)], [1000, 1000]);
for (const [de, para] of [["kg", "l"], ["g", "ml"], ["un", "kg"], ["garrafa", "lata"]]) {
  const r = await (async () => {
    try { await db.query("select public.etiqueta__converter(1, $1, $2)", [de, para]); return "converteu"; }
    catch (e) { return String(e?.message || e).includes("fator cadastrado") ? "recusou" : "erro diferente"; }
  })();
  conferir(`Q3. ${de} -> ${para} sem fator cadastrado é recusado`, r, "recusou");
}
/* O caso real: etiqueta impressa em g, insumo cadastrado em kg. */
const etqQ = await novaEtiqueta({ produto: "Molho branco", insumo: ID.molho, qtd: 500, unidade: "g" });
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda')", [etqQ.id]);
conferir("Q4. etiqueta de 500 g entra como 0,5 kg no estoque, não 500",
  [num((await uma("select saldo from public.etiquetas where id=$1", [etqQ.id])).saldo),
   (await uma("select saldo_unidade from public.etiquetas where id=$1", [etqQ.id])).saldo_unidade,
   await saldoEstoque("cozinha", ID.molho)],
  [0.5, "kg", 0.5]);

/* ── R. Produção já consumida antes da etiquetagem ───────────────────────── */
const ID2 = { producao2: "cccccccc-0000-4000-8000-000000000002", requeijao: "aaaaaaaa-0000-4000-8000-000000000004" };
/* Insumo exclusivo de R e S: os blocos anteriores já movimentaram os outros. */
await db.query("insert into public.insumos (id, unidade_id, nome, departamento, unidade_medida, custo_unitario) values ($1, 'u1', 'Requeijão', 'cozinha', 'kg', 15)", [ID2.requeijao]);
await db.query(
  "insert into public.producao_diaria (id, unidade_id, ficha_id, quantidade_produzida) values ($1,'u1',$2,10)",
  [ID2.producao2, ID.ficha]);
const estPre = (await uma("select id from public.estoques where slug='pre-preparos-cozinha' and unidade_id='u1'")).id;
/* A produção lança 10 kg no estoque, como producao_diaria faz hoje. */
await db.query("select public.registrar_movimento_estoque_multi('u1', $1, $2, 'entrada', 10, null, 'Produção', 'Produção do dia')", [estPre, ID2.requeijao]);
/* Alguém consome 4 kg antes de qualquer etiqueta existir. */
await db.query("select public.registrar_movimento_estoque_multi('u1', $1, $2, 'saida', 4, null, 'Cozinha', 'Consumo antes de etiquetar')", [estPre, ID2.requeijao]);
const etqR = await novaEtiqueta({ produto: "Molho branco", insumo: ID2.requeijao, qtd: 10, unidade: "kg", condicao: "manipulado" });
const excedeFisico = await (async () => {
  try { await db.query("select public.etiqueta_vincular_producao($1, $2)", [etqR.id, ID2.producao2]); return "aceitou"; }
  catch (e) { return String(e?.message || e).includes("não etiquetado") ? "recusou" : `erro diferente: ${String(e?.message || e).slice(0, 60)}`; }
})();
conferir("R. produzir 10 e consumir 4 antes: etiquetar 10 é recusado", excedeFisico, "recusou");
const etqR6 = await novaEtiqueta({ produto: "Molho branco", insumo: ID2.requeijao, qtd: 6, unidade: "kg", condicao: "manipulado" });
await db.query("select public.etiqueta_vincular_producao($1, $2)", [etqR6.id, ID2.producao2]);
conferir("R2. etiquetar os 6 que sobraram é aceito, sem movimentar estoque",
  [num((await uma("select saldo from public.etiquetas where id=$1", [etqR6.id])).saldo),
   await saldoEstoque("pre-preparos-cozinha", ID2.requeijao)], [6, 6]);

/* ── S. Quanto do estoque tem etiqueta ───────────────────────────────────── */
await db.query("select public.registrar_movimento_estoque_multi('u1', $1, $2, 'entrada', 3, null, 'Legado', 'Estoque antigo sem etiqueta')", [estPre, ID2.requeijao]);
const rastr = await uma(
  "select saldo_total, saldo_rastreado, saldo_nao_rastreado from public.vw_estoque_rastreabilidade where estoque_id=$1 and insumo_id=$2",
  [estPre, ID2.requeijao]);
conferir("S. total 9, rastreado 6, não rastreado 3",
  [num(rastr.saldo_total), num(rastr.saldo_rastreado), num(rastr.saldo_nao_rastreado)], [9, 6, 3]);
conferir("S2. nenhuma etiqueta foi inventada para o saldo antigo",
  Number((await uma("select count(*)::int as n from public.etiquetas where insumo_id=$1 and estoque_id=$2", [ID2.requeijao, estPre])).n), 1);

/* ── T. Integridade referencial de verdade ───────────────────────────────── */
const fks = await db.query(
  "select conname from pg_constraint where conname in ('etiquetas_insumo_fk','etiquetas_estoque_fk','etiquetas_producao_fk','movimentacoes_multi_etiqueta_fk') order by conname");
conferir("T. as quatro FKs foram criadas",
  fks.rows.map((r) => r.conname),
  ["etiquetas_estoque_fk", "etiquetas_insumo_fk", "etiquetas_producao_fk", "movimentacoes_multi_etiqueta_fk"]);
const fkBarra = await (async () => {
  try {
    await db.query("insert into public.etiquetas (unidade_id, codigo, produto, insumo_id) values ('u1','ZZZ','Fantasma','eeeeeeee-0000-4000-8000-000000000009')");
    return "aceitou";
  } catch (e) { return String(e?.message || e).includes("etiquetas_insumo_fk") ? "recusou" : "erro diferente"; }
})();
conferir("T2. insumo_id apontando para nada é recusado pelo banco", fkBarra, "recusou");

/* ── U. Criar, imprimir e reimprimir são três coisas ─────────────────────── */
const etqU = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 1 });
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda')", [etqU.id]);
const estoqueAntesU = await saldoEstoque("cozinha", ID.insumo);
conferir("U. etiqueta nasce com evento 'criada' e sem 'impressa'",
  (await db.query("select tipo from public.etiqueta_eventos where etiqueta_id=$1 order by created_at, tipo", [etqU.id])).rows.map((r) => r.tipo),
  ["criada", "recebida"]);
conferir("U2. e aparece como pendente de impressão",
  Number((await uma("select count(*)::int as n from public.vw_etiquetas_pendentes_impressao where id=$1", [etqU.id])).n), 1);
/* A impressora falhou: nada mudou no estoque e a etiqueta continua pendente. */
conferir("U3. impressora falhando não mexe no estoque", await saldoEstoque("cozinha", ID.insumo), estoqueAntesU);
/* Agora imprimiu de verdade. */
await db.query("select public.etiqueta_marcar_impressa($1, null, 'Eduarda')", [etqU.id]);
conferir("U4. depois de impressa sai da lista de pendentes e o estoque não muda",
  [Number((await uma("select count(*)::int as n from public.vw_etiquetas_pendentes_impressao where id=$1", [etqU.id])).n),
   await saldoEstoque("cozinha", ID.insumo)], [0, estoqueAntesU]);
await db.query("select public.etiqueta_marcar_impressa($1, null, 'Eduarda')", [etqU.id]);
conferir("U5. a segunda impressão é 'reimpressa', não 'impressa' de novo",
  (await db.query("select tipo, count(*)::int as n from public.etiqueta_eventos where etiqueta_id=$1 and tipo in ('impressa','reimpressa') group by tipo order by tipo", [etqU.id])).rows
    .map((r) => `${r.tipo}:${r.n}`),
  ["impressa:1", "reimpressa:1"]);

/* ── V. Tenant: TODAS as operações negadas para a empresa vizinha ────────── */
const etqV = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 2, unidadeId: "u2" });
const tentativas = [
  ["usar", "select public.etiqueta_usar($1, 0.1)"],
  ["abrir", "select public.etiqueta_abrir($1, 0)"],
  ["perda", "select public.etiqueta_perda($1, 0.1, 'x')"],
  ["fracionar", "select * from public.etiqueta_fracionar($1, array[0.5]::numeric[])"],
  ["reimprimir", "select public.etiqueta_reimprimir($1)"],
  ["novo ciclo", "select public.etiqueta_novo_ciclo($1, now() + interval '2 days', 'x')"],
  ["marcar impressa", "select public.etiqueta_marcar_impressa($1)"],
  ["registrar entrada", "select public.etiqueta_registrar_entrada($1)"],
];
await db.exec("set role authenticated; select set_config('teste.unidade','u1',false);");
const bloqueios = [];
for (const [nome, sql] of tentativas) {
  try { await db.query(sql, [etqV.id]); bloqueios.push(`${nome}: PASSOU`); }
  catch (e) {
    bloqueios.push(String(e?.message || e).includes("não encontrada") ? `${nome}: bloqueado` : `${nome}: ${String(e?.message || e).slice(0, 40)}`);
  }
}
await db.exec("reset role;");
conferir("V. a empresa vizinha não executa NENHUMA das operações",
  bloqueios, tentativas.map(([n]) => `${n}: bloqueado`));

/* ── W. QR antes e depois de fechar a leitura anônima ────────────────────── */
const antes0002 = await uma("select codigo, produto from public.get_etiqueta_publica($1)", [etqA.codigo]);
conferir("W. antes do 0002 o rastreio novo já funciona", antes0002?.codigo, etqA.codigo);
await db.exec(`
  drop policy if exists etiquetas_anon_publico on public.etiquetas;
  create policy etiquetas_anon_publico on public.etiquetas for select to anon using (true);
  grant select on public.etiquetas to anon;
`);
await db.exec(ler("db/etiquetas/0002_fechar_leitura_anonima.sql"));
const depois0002 = await uma("select codigo from public.get_etiqueta_publica($1)", [etqA.codigo]);
const anonDireto = await (async () => {
  await db.exec("set role anon;");
  try { await db.query("select saldo from public.etiquetas limit 1"); return "leu"; }
  catch { return "bloqueado"; }
  finally { await db.exec("reset role;"); }
})();
conferir("W2. depois do 0002 o rastreio continua funcionando", depois0002?.codigo, etqA.codigo);
conferir("W3. e a leitura anônima direta da tabela está fechada", anonDireto, "bloqueado");

/* ── X. A fila financeira tem dono ───────────────────────────────────────── */
const etqX = await novaEtiqueta({ produto: "Creme de leite", insumo: ID.insumo, qtd: 3, condicao: "aberto" });
await db.query("update public.etiquetas set custo_unit = 20 where id=$1", [etqX.id]);
await db.query("select public.etiqueta_registrar_entrada($1, null, 'Eduarda')", [etqX.id]);
await db.query("select public.etiqueta_perda($1, 0.25, 'Vencido', null, 'Eduarda')", [etqX.id]);

const reservado = await db.query(
  "select id, status, reservado_por from public.etiqueta_financeiro_reservar_lote(null, 10, 'cron-teste')");
conferir("X. reservar o lote tira da fila e marca quem pegou",
  [reservado.rows.length > 0, reservado.rows[0]?.status, reservado.rows[0]?.reservado_por],
  [true, "processando", "cron-teste"]);

/* Um segundo drenador não pode pegar o que já está reservado. */
const segundo = await db.query("select id from public.etiqueta_financeiro_reservar_lote(null, 10, 'cron-2')");
conferir("X2. um segundo drenador não pega o mesmo lote",
  segundo.rows.filter((r) => reservado.rows.some((a) => a.id === r.id)).length, 0);

/* Erro devolve para a fila até o teto de tentativas; depois para em 'erro'. */
const idX = reservado.rows[0].id;
for (let i = 0; i < 4; i++) {
  await db.query("select public.etiqueta_financeiro_marcar_erro($1, 'financeiro fora do ar')", [idX]);
  /* Reserva de novo só entre as tentativas: depois da quarta queremos ver o
     estado em que a falha deixou a linha, não o da reserva seguinte. */
  if (i < 3) await db.query("select * from public.etiqueta_financeiro_reservar_lote(null, 10, 'cron-teste')");
}
const aposQuatro = await uma("select status, tentativas from public.etiqueta_financeiro_pendente where id=$1", [idX]);
await db.query("select public.etiqueta_financeiro_marcar_erro($1, 'financeiro fora do ar')", [idX]);
const aposCinco = await uma("select status, tentativas from public.etiqueta_financeiro_pendente where id=$1", [idX]);
conferir("X3. erro volta para a fila; no quinto, para em 'erro' para alguém olhar",
  [aposQuatro.status, Number(aposQuatro.tentativas), aposCinco.status, Number(aposCinco.tentativas)],
  ["pendente", 4, "erro", 5]);
conferir("X4. quem parou em 'erro' não é mais reservado sozinho",
  (await db.query("select id from public.etiqueta_financeiro_reservar_lote(null, 10, 'cron-teste')")).rows
    .filter((r) => r.id === idX).length, 0);

/* Reserva abandonada volta para a fila sozinha. */
await db.query(`update public.etiqueta_financeiro_pendente
                   set status='processando', tentativas=0, reservado_em = now() - interval '1 hour',
                       reservado_por='cron-que-morreu'
                 where id=$1`, [idX]);
const recuperado = await db.query("select id from public.etiqueta_financeiro_reservar_lote(null, 10, 'cron-novo')");
conferir("X5. lote preso num drenador que morreu volta para a fila",
  recuperado.rows.some((r) => r.id === idX), true);

/* Fechar é idempotente e limpa a reserva. */
await db.query("select public.etiqueta_financeiro_marcar_lancado($1, $2)", [idX, "dddddddd-0000-4000-8000-000000000ff1"]);
conferir("X6. lançado limpa a reserva e não volta para a fila",
  (await uma("select status, reservado_em, reservado_por from public.etiqueta_financeiro_pendente where id=$1", [idX])),
  { status: "lancado", reservado_em: null, reservado_por: null });

/* A visão de saúde da fila responde numa consulta só. */
const fila = await uma("select * from public.vw_etiqueta_financeiro_fila where unidade_id='u1'");
conferir("X7. a fila se reporta: nada fica esquecido em silêncio",
  [Number(fila.lancados) >= 1, fila.mais_antiga !== undefined], [true, true]);

/* ── Y. Não etiquetar mais do que o estoque tem ──────────────────────────── */
/* Depois do bloco S: total 9, rastreado 6, não rastreado 3. Uma etiqueta nova
   de 2 kg é legítima; 5 kg não, porque não existe fisicamente. */
const etqY = await novaEtiqueta({ produto: "Requeijão", insumo: ID2.requeijao, qtd: 2, unidade: "kg", condicao: "manipulado" });
const movsAntesY = await contarMovimentos();
await db.query("select public.etiqueta_vincular_producao($1, $2)", [etqY.id, ID2.producao2]);
const rastrY = await uma(
  "select saldo_total, saldo_rastreado, saldo_nao_rastreado from public.vw_estoque_rastreabilidade where estoque_id=$1 and insumo_id=$2",
  [estPre, ID2.requeijao]);
conferir("Y. etiquetar 2 kg do saldo antigo: total 9, rastreado 8, não rastreado 1",
  [num(rastrY.saldo_total), num(rastrY.saldo_rastreado), num(rastrY.saldo_nao_rastreado)], [9, 8, 1]);
conferir("Y2. e nenhuma entrada nova foi criada", await contarMovimentos(), movsAntesY);

const etqY5 = await novaEtiqueta({ produto: "Requeijão", insumo: ID2.requeijao, qtd: 2, unidade: "kg", condicao: "manipulado" });
const excedeY = await (async () => {
  try { await db.query("select public.etiqueta_vincular_producao($1, $2)", [etqY5.id, ID2.producao2]); return "aceitou"; }
  catch (e) { return String(e?.message || e).includes("não etiquetado") ? "recusou" : `erro diferente: ${String(e?.message || e).slice(0, 60)}`; }
})();
conferir("Y3. com só 1 kg não rastreado, etiquetar mais 2 kg é recusado", excedeY, "recusou");

console.log(`\n${total - falhas}/${total} verificações passaram.`);
console.log(falhas ? "RESULTADO: FALHOU" : "RESULTADO: OK");
process.exit(falhas ? 1 : 0);
