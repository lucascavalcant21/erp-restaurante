// SQL REAL da migração MARMITARIA_V2 num Postgres em memória (PGlite), com RLS
// por unidade como em produção. Rode com:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/marmitaria/marmitaria-banco.test.mjs
// Sem PGLITE os testes NÃO rodam (e o processo sai com código 2).
//
// O esquema mínimo abaixo copia do banco real (14/10/2026) só as colunas e o
// índice que a migração usa — inclusive o fichas_tecnicas_codigo_unico_idx
// que disparava o erro "duplicate key" do cadastro antigo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clienteSupabase } from "../teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

if (!process.env.PGLITE) {
  console.log("PGLITE não informado: testes de banco da marmitaria NÃO executados.");
  process.exit(2);
}

const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

const U1 = "11111111-1111-1111-1111-111111111111"; // usuário da seldeestrela
const U2 = "22222222-2222-2222-2222-222222222222"; // usuário de outra empresa

await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;

  create table public.unidades (id text primary key, nome text);
  insert into public.unidades values ('seldeestrela', 'Sel de Estrela'), ('outra', 'Outra empresa');

  create table public.acesso_teste (uid uuid, unidade text, super boolean default false);
  insert into public.acesso_teste values ('${U1}', 'seldeestrela', false), ('${U2}', 'outra', false);
  create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer set search_path = public as
    $$ select coalesce(array_agg(unidade), '{}') from public.acesso_teste where uid = auth.uid() $$;
  create function public.hefisto_ve_todas_unidades() returns boolean language sql stable security definer set search_path = public as
    $$ select exists (select 1 from public.acesso_teste where uid = auth.uid() and super) $$;

  create table public.insumos (id uuid primary key default gen_random_uuid(), unidade_id text, nome text, departamento text,
    unidade_medida text, custo_unitario numeric, arquivado_em timestamptz);
  create table public.estoques (id uuid primary key default gen_random_uuid(), unidade_id text, nome text, slug text, tipo text, status text default 'ativo');
  create table public.colaboradores (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
  create table public.fichas_tecnicas (
    id uuid primary key default gen_random_uuid(), unidade_id text, departamento text not null, nome_receita text not null,
    rendimento_porcoes numeric default 1, created_at timestamptz default now(), eh_base boolean not null default false,
    rendimento_unidade text not null default 'porcao', peso_porcao_g numeric, imagem text, categoria text,
    validade_dias integer, preco_venda numeric not null default 0, codigo text, status text not null default 'ativa',
    versao text not null default '1.0', descricao text, peso_final_g numeric, atualizado_em timestamptz,
    custo_embalagens_total numeric default 0, tamanho_marmita text default 'M', descricao_comercial text,
    montagem_sequencia jsonb default '[]', ativo boolean default true);
  create unique index fichas_tecnicas_codigo_unico_idx on public.fichas_tecnicas (unidade_id, codigo)
    where codigo is not null and codigo <> '';
  create table public.fichas_ingredientes (id uuid primary key default gen_random_uuid(), ficha_id uuid references public.fichas_tecnicas(id) on delete cascade,
    insumo_id uuid references public.insumos(id), quantidade numeric, created_at timestamptz default now(),
    subficha_id uuid references public.fichas_tecnicas(id), fator_correcao numeric, perda_percentual numeric);

  create table public.marmitaria_configuracoes (id uuid primary key default gen_random_uuid(), unidade_id text not null unique references public.unidades(id),
    taxa_ifood_padrao_pct numeric default 15, margem_lucro_alvo_pct numeric default 20, updated_at timestamptz default now());
  create table public.marmitaria_fichas_embalagens (id uuid primary key default gen_random_uuid(), unidade_id text not null references public.unidades(id),
    ficha_id uuid not null references public.fichas_tecnicas(id) on delete cascade, embalagem_insumo_id uuid references public.insumos(id),
    tipo_embalagem text not null default 'marmita', quantidade numeric not null default 1, custo_unitario numeric not null default 0, created_at timestamptz default now());
  create table public.marmitaria_precificacao_canais (id uuid primary key default gen_random_uuid(), unidade_id text not null references public.unidades(id),
    ficha_id uuid not null references public.fichas_tecnicas(id) on delete cascade, canal text not null, preco_venda numeric not null default 0,
    atualizado_em timestamptz not null default now(), constraint uq_marmitaria_precificacao unique (unidade_id, ficha_id, canal));
  create table public.marmitaria_producao_lotes (id uuid primary key default gen_random_uuid(), unidade_id text not null references public.unidades(id),
    codigo text not null, tipo_demanda text default 'antecipada', status text not null default 'planejado', ficha_id uuid references public.fichas_tecnicas(id),
    quantidade_planejada numeric default 0, quantidade_produzida numeric default 0, quantidade_perdas numeric default 0, motivo_perda text,
    rendimento_real_dados jsonb default '{}', data_producao date default current_date, custo_total numeric default 0,
    baixou_ingredientes boolean default false, baixou_embalagens boolean default false);

  -- motor de estoque mínimo: saldo por (estoque, insumo) e chave idempotente,
  -- recusando retirada maior que o saldo (como o _estoque_aplicar real).
  create table public.saldo_teste (estoque_id uuid, insumo_id uuid, qtd numeric, primary key (estoque_id, insumo_id));
  create table public.mov_teste (chave text primary key, estoque_id uuid, insumo_id uuid, qtd numeric);
  create function public.estoque_movimentar(p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_tipo text, p_motivo text, p_quantidade numeric,
    p_validade date default null, p_quantidade_informada numeric default null, p_unidade_informada text default null, p_detalhe jsonb default null,
    p_observacao text default null, p_responsavel_nome text default null, p_chave text default null, p_pin text default null,
    p_justificativa text default null, p_origem text default 'movimentacao')
  returns jsonb language plpgsql security definer set search_path = public as $$
  declare v numeric;
  begin
    if exists (select 1 from public.mov_teste where chave = p_chave) then return jsonb_build_object('ok', true, 'idempotente', true); end if;
    select qtd into v from public.saldo_teste where estoque_id = p_estoque_id and insumo_id = p_insumo_id;
    if coalesce(v, 0) < p_quantidade then raise exception 'Saldo insuficiente para retirar %.', p_quantidade; end if;
    update public.saldo_teste set qtd = qtd - p_quantidade where estoque_id = p_estoque_id and insumo_id = p_insumo_id;
    insert into public.mov_teste values (p_chave, p_estoque_id, p_insumo_id, p_quantidade);
    return jsonb_build_object('ok', true, 'idempotente', false);
  end $$;

  alter default privileges in schema public grant all on tables to authenticated;
  grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema public to anon, authenticated;
  do $$ declare t text; begin
    foreach t in array array['insumos','fichas_tecnicas','marmitaria_configuracoes','marmitaria_fichas_embalagens',
      'marmitaria_precificacao_canais','marmitaria_producao_lotes'] loop
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy sec_unidade on public.%I for all to authenticated using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario()))) with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))', t);
    end loop;
  end $$;
  alter table public.fichas_ingredientes enable row level security;
  create policy sec_pai on public.fichas_ingredientes for all to authenticated
    using (exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id))
    with check (exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id));
`);

// índice que a migração confere no preflight
const sql = fs.readFileSync(path.join(raiz, "db", "MARMITARIA_V2_REFORMULACAO.sql"), "utf8");
await pg.exec(sql);
// segunda aplicação: idempotente
await pg.exec(sql);
conferir("migração aplica duas vezes sem erro (idempotente)", true, true);

const ID = () => crypto.randomUUID();
const ARROZ = ID(), FRANGO = ID(), POTE = ID(), TAMPA = ID(), ALHEIO = ID();
const EST_MARM = ID(), EST_EMB = ID(), EST_PRE = ID();
await pg.exec(`
  insert into public.insumos (id, unidade_id, nome, departamento, unidade_medida, custo_unitario) values
    ('${ARROZ}', 'seldeestrela', 'Arroz', 'cozinha', 'kg', 6),
    ('${FRANGO}', 'seldeestrela', 'Frango', 'cozinha', 'kg', 20),
    ('${POTE}', 'seldeestrela', 'Pote 750 ml', 'embalagens', 'un', 1.1),
    ('${TAMPA}', 'seldeestrela', 'Tampa', 'embalagens', 'un', 0.3),
    ('${ALHEIO}', 'outra', 'Insumo de outra empresa', 'cozinha', 'kg', 9);
  insert into public.fichas_tecnicas (unidade_id, departamento, nome_receita, codigo) values
    ('seldeestrela', 'marmitaria', 'Marmita antiga', 'MARM-001'),
    ('seldeestrela', 'cozinha', 'Prato da cozinha', 'FT-0007');
`);

const db1 = clienteSupabase(pg, { uid: U1 });
const db2 = clienteSupabase(pg, { uid: U2 });
const anon = clienteSupabase(pg, { uid: null });
const salvar = (db, dados) => db.rpc("marmitaria_salvar_ficha", { p_dados: dados });

// ── pré-preparo compartilhado ────────────────────────────────────────────────
const ARROZ_COZIDO = ID();
let r = await salvar(db1, { id: ARROZ_COZIDO, unidade_id: "seldeestrela", tipo: "pre_preparo", nome: "Arroz cozido",
  rendimento: 2.5, rendimento_unidade: "kg", itens: [{ insumo_id: ARROZ, quantidade: 1 }] });
conferir("cria pré-preparo com código FT seguinte ao maior da unidade", [r.error, r.data?.codigo, r.data?.criado], [null, "FT-0008", true]);
let row = (await pg.query(`select departamento, eh_base, rendimento_porcoes::float8 r, rendimento_unidade from public.fichas_tecnicas where id = $1`, [ARROZ_COZIDO])).rows[0];
conferir("pré-preparo nasce na cozinha (base compartilhada) com rendimento", row, { departamento: "cozinha", eh_base: true, r: 2.5, rendimento_unidade: "kg" });

// ── marmita: cadastro ────────────────────────────────────────────────────────
const M1 = ID();
const marmita = {
  id: M1, unidade_id: "seldeestrela", tipo: "marmita", nome: "Frango grelhado com arroz", descricao: "Arroz, frango e salada",
  categoria: "Tradicional", tamanho: "M", peso_final_g: 550, preco_venda: 25, custo_embalagens_total: 1.4,
  itens: [{ subficha_id: ARROZ_COZIDO, quantidade: 0.15 }, { insumo_id: FRANGO, quantidade: 0.12, fator_correcao: 25 }],
  embalagens: [{ insumo_id: POTE, quantidade: 1, tipo: "marmitex" }, { insumo_id: TAMPA, quantidade: 1, tipo: "tampa" }],
  precos: [{ canal: "ifood", preco_venda: 29.9 }, { canal: "balcao", preco_venda: 25 }],
};
r = await salvar(db1, marmita);
conferir("cria marmita: código MARM depois do MARM-001 existente", [r.error, r.data?.codigo, r.data?.criado], [null, "MARM-0002", true]);
let cont = (await pg.query(`select
  (select count(*)::int from public.fichas_ingredientes where ficha_id = $1) itens,
  (select count(*)::int from public.marmitaria_fichas_embalagens where ficha_id = $1) embs,
  (select count(*)::int from public.marmitaria_precificacao_canais where ficha_id = $1) precos,
  (select preco_venda::float8 from public.fichas_tecnicas where id = $1) preco,
  (select fator_correcao::float8 from public.fichas_ingredientes where ficha_id = $1 and insumo_id is not null) fc`, [M1])).rows[0];
conferir("ingredientes, pré-preparo, embalagens e preços por canal gravados", cont, { itens: 2, embs: 2, precos: 2, preco: 25, fc: 25 });

// ── o erro original: salvar de novo, duas vezes, não duplica nem quebra ──────
r = await salvar(db1, marmita);
conferir("salvar a mesma marmita de novo vira atualização (sem duplicate key)", [r.error, r.data?.codigo, r.data?.criado], [null, "MARM-0002", false]);
const [a, b] = await Promise.all([salvar(db1, marmita), salvar(db1, marmita)]);
conferir("clique duplo (duas chamadas iguais) não cria duplicata", [a.error, b.error], [null, null]);
cont = (await pg.query(`select count(*)::int n from public.fichas_tecnicas where nome_receita = 'Frango grelhado com arroz'`)).rows[0].n;
conferir("continua uma só marmita", cont, 1);
cont = (await pg.query(`select count(*)::int n from public.fichas_ingredientes where ficha_id = $1`, [M1])).rows[0].n;
conferir("ingredientes não duplicam ao salvar várias vezes", cont, 2);

// duas marmitas NOVAS seguidas: códigos distintos e sequenciais
const M2 = ID(), M3 = ID();
const r2 = await salvar(db1, { ...marmita, id: M2, nome: "Carne de panela", precos: [] });
const r3 = await salvar(db1, { ...marmita, id: M3, nome: "Strogonoff", precos: [] });
conferir("marmitas novas em sequência ganham códigos únicos", [r2.data?.codigo, r3.data?.codigo], ["MARM-0003", "MARM-0004"]);

// ── edição ──────────────────────────────────────────────────────────────────
r = await salvar(db1, { ...marmita, preco_venda: 27, itens: [{ insumo_id: FRANGO, quantidade: 0.2 }], embalagens: [{ insumo_id: POTE, quantidade: 1 }],
  precos: [{ canal: "ifood", preco_venda: 32 }] });
cont = (await pg.query(`select
  (select count(*)::int from public.fichas_ingredientes where ficha_id = $1) itens,
  (select count(*)::int from public.marmitaria_fichas_embalagens where ficha_id = $1) embs,
  (select string_agg(canal || '=' || preco_venda::float8, ',') from public.marmitaria_precificacao_canais where ficha_id = $1) precos,
  (select preco_venda::float8 from public.fichas_tecnicas where id = $1) preco,
  (select codigo from public.fichas_tecnicas where id = $1) codigo`, [M1])).rows[0];
conferir("edição troca itens, embalagens e preços; código preservado", cont, { itens: 1, embs: 1, precos: "ifood=32", preco: 27, codigo: "MARM-0002" });

// ── erros com mensagem em português e rollback ───────────────────────────────
r = await salvar(db1, { ...marmita, id: ID(), nome: "frango grelhado com ARROZ" });
conferir("nome repetido é recusado com mensagem clara", /Já existe um\(a\) marmita/.test(r.error?.message || ""), true);
const M4 = ID();
r = await salvar(db1, { ...marmita, id: M4, nome: "Com item inválido", itens: [{ insumo_id: FRANGO, quantidade: 0 }] });
conferir("quantidade zero é recusada", r.error?.message, "Informe uma quantidade maior que zero em todos os itens.");
cont = (await pg.query(`select count(*)::int n from public.fichas_tecnicas where id = $1`, [M4])).rows[0].n;
conferir("erro desfaz tudo: nada da ficha ficou gravado", cont, 0);
r = await salvar(db1, { ...marmita, id: ID(), nome: "Com insumo alheio", itens: [{ insumo_id: ALHEIO, quantidade: 1 }] });
conferir("ingrediente de outra empresa é recusado", r.error?.message, "Ingrediente não encontrado nesta unidade.");
r = await salvar(db1, { ...marmita, id: ID(), nome: "Marmita usando marmita", itens: [{ subficha_id: M2, quantidade: 1 }] });
conferir("marmita não entra como pré-preparo", r.error?.message, "Pré-preparo não encontrado nesta unidade.");
r = await salvar(db1, { ...marmita, id: "nao-e-uuid" });
conferir("id inválido é recusado", r.error?.message, "Identificador da ficha inválido. Recarregue a tela.");
r = await salvar(db1, { ...marmita, id: ID(), nome: "Preço ruim", precos: [{ canal: "ifood", preco_venda: -1 }] });
conferir("preço negativo é recusado", r.error?.message, 'Preço inválido no canal "ifood".');

// ── ciclo entre pré-preparos ────────────────────────────────────────────────
const MOLHO = ID(), BASE = ID();
await salvar(db1, { id: BASE, unidade_id: "seldeestrela", tipo: "pre_preparo", nome: "Base de tomate", rendimento: 1, itens: [{ insumo_id: ARROZ, quantidade: 1 }] });
await salvar(db1, { id: MOLHO, unidade_id: "seldeestrela", tipo: "pre_preparo", nome: "Molho", rendimento: 1, itens: [{ subficha_id: BASE, quantidade: 0.5 }] });
r = await salvar(db1, { id: BASE, unidade_id: "seldeestrela", tipo: "pre_preparo", nome: "Base de tomate", rendimento: 1, itens: [{ subficha_id: MOLHO, quantidade: 0.2 }] });
conferir("dependência circular entre pré-preparos é recusada", r.error?.message, 'Referência circular: "Molho" já usa este pré-preparo.');
r = await salvar(db1, { id: MOLHO, unidade_id: "seldeestrela", tipo: "pre_preparo", nome: "Molho", rendimento: 1, itens: [{ subficha_id: MOLHO, quantidade: 0.2 }] });
conferir("ficha usando a si mesma é recusada", r.error?.message, "Uma ficha não pode usar a si mesma.");

// ── tipo trocado ─────────────────────────────────────────────────────────────
const cozinhaId = (await pg.query(`select id from public.fichas_tecnicas where codigo = 'FT-0007'`)).rows[0].id;
r = await salvar(db1, { ...marmita, id: cozinhaId, nome: "Sequestro da ficha da cozinha" });
conferir("não transforma ficha da cozinha em marmita", r.error?.message, "Esta ficha não é uma marmita.");

// ── isolamento entre empresas ────────────────────────────────────────────────
r = await salvar(db2, { ...marmita, id: ID(), nome: "Invasão" });
conferir("usuário de outra empresa não grava na unidade alheia", r.error?.message, "Você não tem acesso a esta unidade.");
r = await salvar(db2, { ...marmita, unidade_id: "outra", itens: [], embalagens: [], precos: [] });
conferir("usuário de outra empresa não sobrescreve marmita alheia pelo id", /Conflito de identificador|row-level security|outra unidade/.test(r.error?.message || ""), true);
cont = (await pg.query(`select unidade_id, nome_receita from public.fichas_tecnicas where id = $1`, [M1])).rows[0];
conferir("a marmita original continua intacta", cont, { unidade_id: "seldeestrela", nome_receita: "Frango grelhado com arroz" });
r = await anon.rpc("marmitaria_salvar_ficha", { p_dados: marmita });
conferir("anônimo não executa a função", /permission denied/.test(r.error?.message || ""), true);

// ── concorrência no código: outra tela gravou MARM-0005 por fora ─────────────
await pg.exec(`insert into public.fichas_tecnicas (unidade_id, departamento, nome_receita, codigo) values ('seldeestrela', 'marmitaria', 'Criada por outra tela', 'MARM-0005')`);
r = await salvar(db1, { ...marmita, id: ID(), nome: "Depois da outra tela", precos: [] });
conferir("código pula o que outra tela já usou", r.data?.codigo, "MARM-0006");

// ── produção: lote + baixas atômicas e idempotentes ──────────────────────────
await pg.exec(`insert into public.saldo_teste values ('${EST_PRE}', '${FRANGO}', 1000), ('${EST_EMB}', '${POTE}', 10), ('${EST_MARM}', '${ARROZ}', 0)`);
const LOTE = ID();
const producao = {
  lote_id: LOTE, unidade_id: "seldeestrela", ficha_id: M1, quantidade: 5, data: "2026-10-14", custo_previsto: 60,
  baixas: [{ estoque_id: EST_PRE, insumo_id: FRANGO, quantidade: 600 }, { estoque_id: EST_EMB, insumo_id: POTE, quantidade: 5 }],
};
r = await db1.rpc("marmitaria_registrar_producao", { p_dados: producao });
conferir("produção registra lote e baixa itens", [r.error, r.data?.baixas, r.data?.idempotente], [null, 2, false]);
r = await db1.rpc("marmitaria_registrar_producao", { p_dados: producao });
conferir("reenviar a mesma produção não baixa de novo", [r.error, r.data?.idempotente], [null, true]);
cont = (await pg.query(`select string_agg(qtd::float8::text, ',' order by qtd) s from public.saldo_teste`)).rows[0].s;
conferir("saldos baixados uma vez só", cont, "0,5,400");
const LOTE2 = ID();
r = await db1.rpc("marmitaria_registrar_producao", { p_dados: { ...producao, lote_id: LOTE2,
  baixas: [{ estoque_id: EST_EMB, insumo_id: POTE, quantidade: 5 }, { estoque_id: EST_MARM, insumo_id: ARROZ, quantidade: 1 }] } });
conferir("falta de saldo em um item recusa a produção inteira", /Saldo insuficiente/.test(r.error?.message || ""), true);
cont = (await pg.query(`select (select qtd::float8 from public.saldo_teste where insumo_id = $1) pote,
  (select count(*)::int from public.marmitaria_producao_lotes where id = $2) lote`, [POTE, LOTE2])).rows[0];
conferir("rollback: o pote não foi baixado e o lote não existe", cont, { pote: 5, lote: 0 });
r = await db2.rpc("marmitaria_registrar_producao", { p_dados: { ...producao, lote_id: ID() } });
conferir("outra empresa não registra produção na unidade alheia", r.error?.message, "Você não tem acesso a esta unidade.");

// ── vendas: RLS e regras ─────────────────────────────────────────────────────
const venda = { unidade_id: "seldeestrela", data: "2026-10-14", canal: "ifood", ficha_id: M1, quantidade: 3, valor_bruto: 89.7, comissao: 10.76 };
r = await db1.from("marmitaria_vendas").insert(venda).select("id");
conferir("lança venda na própria unidade", r.error, null);
r = await db2.from("marmitaria_vendas").insert(venda).select("id");
conferir("outra empresa não lança venda na unidade alheia", /row-level security/.test(r.error?.message || ""), true);
r = await db2.from("marmitaria_vendas").select("id");
conferir("outra empresa não lê as vendas", r.data?.length, 0);
r = await db1.from("marmitaria_vendas").insert({ ...venda, valor_bruto: -1 }).select("id");
conferir("valor negativo é recusado pelo banco", /marmitaria_vendas_valores_ck/.test(r.error?.message || ""), true);
await db1.from("marmitaria_vendas").insert({ ...venda, fonte: "ifood", referencia_externa: "PED-1" });
r = await db1.from("marmitaria_vendas").insert({ ...venda, fonte: "ifood", referencia_externa: "PED-1" });
conferir("pedido importado entra uma vez só", r.error?.code, "23505");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
