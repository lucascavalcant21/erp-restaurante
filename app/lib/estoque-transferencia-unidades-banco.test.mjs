// SQL REAL da UNID-MARM-1 (transferência de estoque entre unidades) no PGlite.
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/estoque-transferencia-unidades-banco.test.mjs
// O custo médio usa as funções REAIS do repositório (estoque_custo_medio_novo
// da F2.1 e estoque_custo_registrar_entrada da F2.4B), extraídas dos arquivos.
// Lotes (_estoque_aplicar) e permissões são dublês com a mesma assinatura.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!process.env.PGLITE) { console.log("PGLITE não informado: testes da transferência entre unidades NÃO executados."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};
const funcao = (arquivo, nome) => {
  const s = fs.readFileSync(path.join(raiz, "db", arquivo), "utf8");
  const i = s.indexOf(`create or replace function public.${nome}(`);
  if (i < 0) throw new Error(`função ${nome} não encontrada em ${arquivo}`);
  const fim = s.indexOf("end $$;", i);
  return s.slice(i, fim + "end $$;".length);
};

const DONO = "11111111-1111-1111-1111-111111111111";      // vê as duas unidades
const COZ = "22222222-2222-2222-2222-222222222222";       // só o restaurante
const OUTRA = "33333333-3333-3333-3333-333333333333";     // outra empresa
const E1 = "e0000000-0000-4000-8000-000000000001";       // estoque do restaurante
const E2 = "e0000000-0000-4000-8000-000000000002";       // estoque da marmitaria
const E3 = "e0000000-0000-4000-8000-000000000003";       // estoque de outra empresa
const AR = "a0000000-0000-4000-8000-000000000001";       // arroz (restaurante)
const AM = "a0000000-0000-4000-8000-000000000002";       // arroz (marmitaria)
const LM = "a0000000-0000-4000-8000-000000000003";       // arroz em g (marmitaria) — unidade diferente
const AO = "a0000000-0000-4000-8000-000000000004";       // arroz (outra empresa)

await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;

  create table public.unidades (id text primary key, nome text, empresa_id uuid);
  insert into public.unidades values ('restaurante', 'Restaurante', 'aaaaaaaa-0000-0000-0000-000000000001'),
    ('marmitaria', 'Marmitaria', 'aaaaaaaa-0000-0000-0000-000000000001'), ('fora', 'Outra empresa', 'bbbbbbbb-0000-0000-0000-000000000002');
  create table public.acesso (uid uuid, unidade text, super boolean default false, pode boolean default true);
  insert into public.acesso values ('${DONO}', 'restaurante', true, true), ('${COZ}', 'restaurante', false, true), ('${OUTRA}', 'fora', false, true);
  create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer set search_path = public as
    $$ select coalesce(array_agg(unidade), '{}') from public.acesso where uid = auth.uid() $$;
  create function public.hefisto_ve_todas_unidades() returns boolean language sql stable security definer set search_path = public as
    $$ select exists (select 1 from public.acesso where uid = auth.uid() and super) $$;
  create function public._estoque_pode(p_acao text, p_unidade_id text, p_tipo text default null) returns boolean language sql stable set search_path = public as
    $$ select exists (select 1 from public.acesso where uid = auth.uid() and pode and (super or unidade = p_unidade_id)) $$;
  create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid, nome text, status text default 'ativo');
  insert into public.usuarios_erp (auth_user_id, nome) values ('${DONO}', 'Dono'), ('${COZ}', 'Cozinha'), ('${OUTRA}', 'Outro');
  create function public._estoque_usuario(out id uuid, out nome text) returns record language sql stable set search_path = public as
    $$ select u.id, u.nome from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' limit 1 $$;

  create table public.estoques (id uuid primary key, unidade_id text, nome text, status text default 'ativo');
  insert into public.estoques values ('${E1}', 'restaurante', 'Cozinha'), ('${E2}', 'marmitaria', 'Marmitaria'), ('${E3}', 'fora', 'Outro');
  create table public.insumos (id uuid primary key, unidade_id text, nome text, unidade_medida text, tamanho_embalagem numeric, unidade_conteudo text);
  insert into public.insumos values ('${AR}', 'restaurante', 'Arroz', 'kg', 1, null), ('${AM}', 'marmitaria', 'Arroz', 'kg', 1, null),
    ('${LM}', 'marmitaria', 'Arroz (g)', 'g', 1, null), ('${AO}', 'fora', 'Arroz', 'kg', 1, null);
  create table public.estoque_itens (estoque_id uuid, insumo_id uuid, unidade_id text, quantidade_atual numeric default 0, primary key (estoque_id, insumo_id));
  insert into public.estoque_itens values ('${E1}', '${AR}', 'restaurante', 50), ('${E2}', '${AM}', 'marmitaria', 10);

  -- unidade do saldo e fatores (como no banco)
  create function public.estoque_fator_base(p text) returns numeric language sql immutable as
    $$ select case lower(btrim(coalesce(p, ''))) when 'kg' then 1000 when 'l' then 1000 else 1 end::numeric $$;
  create function public._estoque_fator_saldo(p uuid) returns numeric language sql stable as $$ select 1::numeric $$;
  create function public._estoque_unidade_saldo(p uuid) returns text language sql stable as $$ select unidade_medida from public.insumos where id = p $$;
  -- dublê de lotes: soma/subtrai o saldo; saldo insuficiente recusa
  create function public._estoque_aplicar(p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_tipo text, p_quantidade numeric,
    p_validade date, p_lotes_preferidos jsonb, p_embalagens numeric, out o_saldo_anterior numeric, out o_saldo_posterior numeric, out o_lotes jsonb)
    returns record language plpgsql set search_path = public as $$
  begin
    if p_tipo = 'entrada' then insert into public.estoque_itens values (p_estoque_id, p_insumo_id, p_unidade_id, 0) on conflict do nothing; end if;
    select quantidade_atual into o_saldo_anterior from public.estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
    if o_saldo_anterior is null then raise exception 'Este produto não está neste estoque.'; end if;
    if p_tipo = 'saida' and o_saldo_anterior < p_quantidade then raise exception 'Saldo insuficiente: há % e a retirada é de %.', o_saldo_anterior, p_quantidade; end if;
    o_saldo_posterior := o_saldo_anterior + case when p_tipo = 'entrada' then p_quantidade else -p_quantidade end;
    update public.estoque_itens set quantidade_atual = o_saldo_posterior where estoque_id = p_estoque_id and insumo_id = p_insumo_id;
    o_lotes := '[]'::jsonb;
  end $$;

  create table public.estoque_movimentacoes_multi (id uuid primary key default gen_random_uuid(), transferencia_id uuid, unidade_id text, estoque_id uuid,
    estoque_destino_id uuid, insumo_id uuid, tipo text, quantidade numeric, saldo_anterior numeric, saldo_posterior numeric, usuario_id uuid, usuario_nome text,
    observacao text, data_movimento timestamptz, valor_unitario numeric, valor_total numeric, motivo text, origem text, registrado_por uuid,
    unidade_medida text, lotes jsonb, custo_origem text, chave_idempotencia text);
  create unique index estoque_mov_chave_unica on public.estoque_movimentacoes_multi (unidade_id, chave_idempotencia) where chave_idempotencia is not null;

  -- custo médio como no banco (F2.1 + F2.4B)
  create table public.estoque_custos (unidade_id text not null references public.unidades(id), insumo_id uuid not null references public.insumos(id),
    custo_medio_base numeric(18,6) not null check (custo_medio_base >= 0), saldo_referencia numeric(18,3), atualizado_em timestamptz not null default now(),
    origem_tipo text not null check (origem_tipo in ('COMPRA','CONTAGEM','AJUSTE')), origem_id uuid, unidade_base text, primary key (unidade_id, insumo_id));
  create table public.estoque_custos_historico (seq bigserial primary key, unidade_id text not null, insumo_id uuid not null, data_referencia date not null,
    origem_tipo text not null check (origem_tipo in ('COMPRA','CONTAGEM','ESTORNO_COMPRA','AJUSTE')), origem_id uuid,
    unidade_base text not null check (unidade_base in ('g','ml','un')), saldo_anterior numeric(18,3), custo_medio_anterior numeric(18,6), quantidade numeric(18,3),
    valor numeric(14,2), custo_entrada numeric(18,6), saldo_novo numeric(18,3), custo_medio_novo numeric(18,6), created_at timestamptz default now(), criado_por uuid);
  -- arroz do restaurante a R$ 5,00/kg = R$ 0,005/g
  insert into public.estoque_custos values ('restaurante', '${AR}', 0.005, 50000, now(), 'COMPRA', null, 'g');
  -- arroz da marmitaria: 10 kg a R$ 6,00/kg
  insert into public.estoque_custos values ('marmitaria', '${AM}', 0.006, 10000, now(), 'COMPRA', null, 'g');
`);
await pg.exec(funcao("F2_1_FUNDACAO_FINANCEIRA.sql", "estoque_custo_medio_novo"));
await pg.exec(funcao("F2_4B_COMPRAS_CUSTO_MEDIO.sql", "estoque_custo_registrar_entrada"));

const sql = fs.readFileSync(path.join(raiz, "db", "UNID_MARM_1_TRANSFERENCIA_ENTRE_UNIDADES.sql"), "utf8");
await pg.exec(sql);
await pg.exec(sql);
conferir("UNID-MARM-1 aplica duas vezes sem erro", true, true);

const como = async (uid, fn) => {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
};
const transferir = (uid, d) => como(uid, async () => {
  try { return (await pg.query("select public.estoque_transferir_unidades($1::jsonb) r", [JSON.stringify(d)])).rows[0].r; }
  catch (e) { return { erro: e.message }; }
});
const base = { unidade_origem: "restaurante", estoque_origem_id: E1, insumo_origem_id: AR, unidade_destino: "marmitaria", estoque_destino_id: E2, insumo_destino_id: AM, quantidade: 10 };
const q = async (s) => (await pg.query(s)).rows;

// ── caminho feliz ───────────────────────────────────────────────────────────
let r = await transferir(DONO, { ...base, chave: "t1" });
conferir("transfere 10 kg ao custo da origem (R$ 50,00)", [r.ok, Number(r.valor)], [true, 50]);
conferir("saldos: restaurante 40, marmitaria 20", (await q(`select estoque_id::text e, quantidade_atual::numeric q from public.estoque_itens order by 1`)).map((x) => Number(x.q)), [40, 20]);
const movs = await q(`select unidade_id u, tipo, motivo, valor_total::numeric v from public.estoque_movimentacoes_multi order by tipo desc`);
conferir("dois movimentos, um em cada unidade, com o mesmo valor", movs.map((m) => [m.u, m.tipo, m.motivo, Number(m.v)]),
  [["restaurante", "saida", "transferencia_enviada", 50], ["marmitaria", "entrada", "transferencia_recebida", 50]]);
// custo médio da marmitaria: (10 kg × 6 + 10 kg × 5) / 20 kg = 5,50/kg = 0,0055/g
const cm = (await q(`select custo_medio_base::numeric c, saldo_referencia::numeric s, origem_tipo o from public.estoque_custos where unidade_id = 'marmitaria'`))[0];
conferir("custo médio do destino recalculado como numa compra", [Number(cm.c), Number(cm.s), cm.o], [0.0055, 20000, "TRANSFERENCIA"]);
conferir("custo da origem não muda", Number((await q(`select custo_medio_base::numeric c from public.estoque_custos where unidade_id = 'restaurante'`))[0].c), 0.005);
conferir("histórico do custo registra a transferência", (await q(`select origem_tipo o, quantidade::numeric qt, valor::numeric v from public.estoque_custos_historico`)).map((h) => [h.o, Number(h.qt), Number(h.v)]), [["TRANSFERENCIA", 10000, 50]]);

// ── reenvio, regras e permissões ────────────────────────────────────────────
r = await transferir(DONO, { ...base, chave: "t1" });
conferir("reenvio com a mesma chave não transfere de novo", [r.idempotente, Number((await q(`select quantidade_atual::numeric q from public.estoque_itens where estoque_id = '${E1}'`))[0].q)], [true, 40]);
r = await transferir(DONO, { ...base, chave: "t2", quantidade: 999 });
conferir("saldo insuficiente recusa e não grava nada", [/Saldo insuficiente/.test(r.erro || ""), (await q("select count(*)::int n from public.estoque_transferencias_unidades"))[0].n], [true, 1]);
r = await transferir(DONO, { ...base, chave: "t3", insumo_destino_id: LM });
conferir("unidades de medida diferentes são recusadas", /unidades diferentes/.test(r.erro || ""), true);
r = await transferir(DONO, { ...base, chave: "t4", unidade_destino: "fora", estoque_destino_id: E3, insumo_destino_id: AO });
conferir("outra empresa é recusada", /mesma empresa/.test(r.erro || ""), true);
r = await transferir(COZ, { ...base, chave: "t5" });
conferir("sem permissão no destino é recusado", /Sem permissão para dar entrada/.test(r.erro || ""), true);
r = await transferir(DONO, { ...base, chave: "t6", estoque_destino_id: E1 });
conferir("estoque que não é da unidade de destino é recusado", /Estoque de destino não encontrado/.test(r.erro || ""), true);
r = await transferir(DONO, { ...base, chave: "t7", insumo_destino_id: AR });
conferir("produto de outra unidade no destino é recusado", /Produto de destino não encontrado/.test(r.erro || ""), true);
r = await transferir(DONO, { ...base, chave: "t8", quantidade: 0 });
conferir("quantidade zero é recusada", /maior que zero/.test(r.erro || ""), true);
r = await transferir(DONO, { ...base });
conferir("sem chave é recusado", /sem chave/.test(r.erro || ""), true);

// ── visibilidade do registro ────────────────────────────────────────────────
conferir("quem vê a origem vê a transferência", (await como(COZ, () => q("select count(*)::int n from public.estoque_transferencias_unidades")))[0].n, 1);
conferir("outra empresa não vê", (await como(OUTRA, () => q("select count(*)::int n from public.estoque_transferencias_unidades")))[0].n, 0);
let erroGrava = null;
await como(DONO, async () => { try { await pg.query(`insert into public.estoque_transferencias_unidades (chave, unidade_origem, estoque_origem_id, insumo_origem_id, unidade_destino, estoque_destino_id, insumo_destino_id, quantidade) values ('x','restaurante','${E1}','${AR}','marmitaria','${E2}','${AM}',1)`); } catch (e) { erroGrava = e.message; } });
conferir("ninguém grava o registro direto", /permission denied/.test(erroGrava || ""), true);
let erroAnon = null;
await pg.exec("set role anon"); try { await pg.query("select public.estoque_transferir_unidades('{}'::jsonb)"); } catch (e) { erroAnon = e.message; } await pg.exec("reset role");
conferir("anônimo não executa", /permission denied/.test(erroAnon || ""), true);

// ── sem custo na origem: transfere, mas sem valor e sem mexer no custo do destino
await pg.exec(`delete from public.estoque_custos where unidade_id = 'restaurante'`);
r = await transferir(DONO, { ...base, chave: "t9", quantidade: 5 });
conferir("origem sem custo: transfere, valor nulo e avisa", [r.ok, r.valor, r.sem_custo], [true, null, true]);
conferir("custo do destino intacto sem valor de origem", Number((await q(`select custo_medio_base::numeric c from public.estoque_custos where unidade_id = 'marmitaria'`))[0].c), 0.0055);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
