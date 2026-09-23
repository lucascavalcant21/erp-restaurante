/* A migration das etiquetas é ADITIVA — este script existe para provar isso em
   vez de afirmar.

   Duas bases idênticas são montadas com os arquivos REAIS do repositório. Só
   uma delas recebe db/etiquetas/0001. Depois as duas rodam exatamente a mesma
   sequência de operações ANTIGAS de estoque — entrada, saída, contagem,
   transferência, produção do dia, baixa e perda no modelo velho — e os estados
   finais são comparados linha a linha.

   Qualquer diferença é regressão: a migration teria mudado o comportamento de
   um fluxo que ela não deveria tocar.

   Uso: node scripts/test_regressao_estoque_pos_etiquetas.mjs <caminho do @electric-sql/pglite>
   A última linha diz RESULTADO: OK ou RESULTADO: FALHOU.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PGLITE = process.argv[2];
if (!PGLITE) { console.error("Informe o caminho do @electric-sql/pglite."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(PGLITE, "dist/index.js")).href);

let total = 0, falhas = 0;
const conferir = (titulo, obtido, esperado) => {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${titulo}${ok ? "" : `\n      antes  ${JSON.stringify(esperado)}\n      depois ${JSON.stringify(obtido)}`}`);
};
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");

const ID = {
  insumo: "aaaaaaaa-0000-4000-8000-000000000001",
  outro: "aaaaaaaa-0000-4000-8000-000000000002",
};

const BASE = `
  create role authenticated; create role service_role bypassrls; create role anon;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('teste.uid', true), '')::uuid $fn$;
  grant usage on schema auth, public to authenticated, anon, service_role;

  create table public.unidades (id text primary key, nome text);
  insert into public.unidades values ('u1','Restaurante Teste');

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
`;

const SEMENTE = `
  insert into public.insumos (id, unidade_id, nome, departamento, unidade_medida, custo_unitario) values
    ('${ID.insumo}', 'u1', 'Creme de leite', 'cozinha', 'l', 12),
    ('${ID.outro}',  'u1', 'Molho branco',   'cozinha', 'kg', 8);
  insert into public.estoques (unidade_id, nome, slug, tipo, controla_validade) values
    ('u1','Cozinha','cozinha','alimentos',true),
    ('u1','Pré-preparos cozinha','pre-preparos-cozinha','alimentos',true)
  on conflict (unidade_id, slug) do nothing;
`;

/* Só fluxos ANTIGOS. Nenhuma função nova é chamada aqui de propósito: o que se
   quer medir é se o que já existia continua fazendo exatamente o mesmo. */
const FLUXOS_ANTIGOS = `
do $roteiro$
declare
  v_cozinha uuid;
  v_pre uuid;
begin
  select id into v_cozinha from public.estoques where slug='cozinha' and unidade_id='u1';
  select id into v_pre     from public.estoques where slug='pre-preparos-cozinha' and unidade_id='u1';

  /* 1. entrada normal, com e sem validade */
  perform public.registrar_movimento_estoque_multi('u1', v_cozinha, '${ID.insumo}', 'entrada', 10, null, 'Compras', 'Nota 1');
  perform public.registrar_movimento_estoque_lote('u1', v_cozinha, '${ID.insumo}', 'entrada', 5, date '2030-01-10', null, 'Compras', 'Nota 2');

  /* 2. saída normal (consome FEFO) */
  perform public.registrar_movimento_estoque_multi('u1', v_cozinha, '${ID.insumo}', 'saida', 3, null, 'Cozinha', 'Consumo');

  /* 3. contagem: sobrando e faltando */
  perform public.registrar_contagem_estoque_multi('u1', v_cozinha, '${ID.insumo}', 14, null, 'Inventário', 'Contagem 1');
  perform public.registrar_contagem_estoque_multi('u1', v_cozinha, '${ID.insumo}', 11, null, 'Inventário', 'Contagem 2');

  /* 4. transferência entre estoques */
  perform public.transferir_item_entre_estoques('u1', v_cozinha, v_pre, '${ID.insumo}', 4, null, 'Chef', 'Levou para o preparo');

  /* 5. produção do dia lança no estoque de preparos, como a tela faz */
  insert into public.producao_diaria (unidade_id, ficha_id, quantidade_produzida, departamento)
  values ('u1', null, 6, 'cozinha');
  perform public.registrar_movimento_estoque_multi('u1', v_pre, '${ID.outro}', 'entrada', 6, null, 'Cozinha', 'Produção do dia');

  /* 6. etiqueta ANTIGA: entra no estoque pelo mesmo caminho do app de hoje */
  insert into public.etiquetas (unidade_id, codigo, produto, quantidade, unidade, validade_em, responsavel, departamento, tipo_etiqueta, custo_unit, status)
  values ('u1','ETQVELHA','Molho branco', 2, 'kg', now() + interval '3 days', 'Eduarda', 'cozinha', 'aberto', 8, 'ativa');
  perform public.registrar_movimento_estoque_multi('u1', v_pre, '${ID.outro}', 'entrada', 2, null, 'Eduarda', 'Etiqueta ETQVELHA');

  /* 7. baixa antiga (consumo) e 8. perda antiga, do jeito velho: saída + conta */
  perform public.registrar_movimento_estoque_multi('u1', v_pre, '${ID.outro}', 'saida', 1, null, 'Eduarda', 'Consumo — etiqueta ETQVELHA');
  update public.etiquetas set status='baixa' where codigo='ETQVELHA';

  perform public.registrar_movimento_estoque_multi('u1', v_pre, '${ID.outro}', 'saida', 0.5, null, 'Eduarda', 'Perda — etiqueta ETQVELHA');
  insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, data_pagamento, categoria, status)
  values ('u1', 'Perda de Validade: Molho branco (0.5 kg)', 4, current_date, current_date, 'inventarios', 'pago');
end
$roteiro$;
`;

/* O que sai do banco para comparação. Tudo o que as telas antigas leem. */
const RETRATO = {
  itens: `select e.slug, i.nome, it.quantidade_atual
            from public.estoque_itens it
            join public.estoques e on e.id = it.estoque_id
            join public.insumos  i on i.id = it.insumo_id
           order by e.slug, i.nome`,
  lotes: `select e.slug, i.nome, l.validade, l.quantidade
            from public.estoque_lotes l
            join public.estoques e on e.id = l.estoque_id
            join public.insumos  i on i.id = l.insumo_id
           order by e.slug, i.nome, l.validade nulls last, l.quantidade`,
  movimentos: `select e.slug, i.nome, m.tipo, m.quantidade, m.saldo_anterior, m.saldo_posterior, m.observacao
                 from public.estoque_movimentacoes_multi m
                 join public.estoques e on e.id = m.estoque_id
                 join public.insumos  i on i.id = m.insumo_id
                order by m.data_movimento, m.observacao, m.quantidade`,
  etiquetas: `select codigo, status, quantidade, unidade from public.etiquetas order by codigo`,
  contas: `select descricao, valor, categoria, status from public.contas_pagar order by descricao`,
  estoqueAtual: `select insumo_id, quantidade_atual from public.estoque_atual order by insumo_id`,
};

async function montar({ comEtiquetas }) {
  const db = await PGlite.create();
  await db.exec(BASE);
  await db.exec(ler("docs/estoques-multiplos.sql"));
  await db.exec(ler("db/migracao_estoque_lotes.sql"));
  if (comEtiquetas) await db.exec(ler("db/etiquetas/0001_saldo_e_linhagem.sql"));
  await db.exec(SEMENTE);
  await db.exec(FLUXOS_ANTIGOS);
  const retrato = {};
  for (const [nome, sql] of Object.entries(RETRATO)) {
    retrato[nome] = (await db.query(sql)).rows.map((linha) =>
      Object.fromEntries(Object.entries(linha).map(([k, v]) =>
        [k, typeof v === "string" || v === null ? v : Number(v)])));
  }
  return { db, retrato };
}

const antes = await montar({ comEtiquetas: false });
const depois = await montar({ comEtiquetas: true });

for (const nome of Object.keys(RETRATO)) {
  conferir(`${nome}: idêntico com e sem a migration das etiquetas`, depois.retrato[nome], antes.retrato[nome]);
}

/* O saldo final, conferido à mão, para o teste não passar comparando dois
   resultados igualmente errados. */
const cozinhaCreme = antes.retrato.itens.find((l) => l.slug === "cozinha" && l.nome === "Creme de leite");
const preCreme = antes.retrato.itens.find((l) => l.slug === "pre-preparos-cozinha" && l.nome === "Creme de leite");
const preMolho = antes.retrato.itens.find((l) => l.slug === "pre-preparos-cozinha" && l.nome === "Molho branco");
conferir("saldos batem com a conta feita à mão (11-4=7 / 4 / 6+2-1-0,5=6,5)",
  [cozinhaCreme, preCreme, preMolho].map((l) => Number(l?.quantidade_atual)),
  [7, 4, 6.5]);

/* E a migration não pode ter inventado etiqueta nem mexido no legado. */
conferir("a etiqueta antiga continua não rastreável",
  (await depois.db.query("select rastreavel, saldo, condicao_estoque from public.etiquetas where codigo='ETQVELHA'")).rows,
  [{ rastreavel: false, saldo: null, condicao_estoque: null }]);
conferir("estoque_atual (legado) não foi tocado por nenhum dos dois",
  [antes.retrato.estoqueAtual.length, depois.retrato.estoqueAtual.length], [0, 0]);

console.log(`\n${total - falhas}/${total} verificações passaram.`);
console.log(falhas ? "RESULTADO: FALHOU" : "RESULTADO: OK");
process.exit(falhas ? 1 : 0);
