// SQL REAL da IFOOD-2 (e da IFOOD-1 antes dela) no PGlite, com RLS por
// unidade como em produção:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/ifood/ifood-pedidos-banco.test.mjs
// Sem PGLITE os testes NÃO rodam (sai com código 2).
//
// estoque_movimentar aqui é um dublê que registra a chamada e respeita a
// chave idempotente — a função real é testada nos testes do estoque.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
if (!process.env.PGLITE) { console.log("PGLITE não informado: testes de banco do iFood NÃO executados."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};
const erroDe = async (sql, params) => { try { await pg.query(sql, params); return null; } catch (e) { return e.message; } };

const U1 = "11111111-1111-1111-1111-111111111111"; // usuário da marmitaria
const U2 = "22222222-2222-2222-2222-222222222222"; // usuário de outro negócio
const F1 = "aaaaaaaa-0000-0000-0000-000000000001";
const E1 = "eeeeeeee-0000-0000-0000-000000000001";
const I1 = "cccccccc-0000-0000-0000-000000000001";

await pg.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;

  create table public.unidades (id text primary key, nome text, ifood_conectado boolean, ifood_merchant_id text);
  insert into public.unidades values ('marmitaria', 'Marmitaria', false, null), ('restaurante', 'Restaurante', false, null);
  create table public.acesso_teste (uid uuid, unidade text, super boolean default false);
  insert into public.acesso_teste values ('${U1}', 'marmitaria', false), ('${U2}', 'restaurante', false);
  create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer set search_path = public as
    $$ select coalesce(array_agg(unidade), '{}') from public.acesso_teste where uid = auth.uid() $$;
  create function public.hefisto_ve_todas_unidades() returns boolean language sql stable security definer set search_path = public as
    $$ select exists (select 1 from public.acesso_teste where uid = auth.uid() and super) $$;

  create table public.fichas_tecnicas (id uuid primary key, unidade_id text, nome_receita text);
  insert into public.fichas_tecnicas values ('${F1}', 'marmitaria', 'Marmita de frango');

  -- marmitaria_vendas como na MARMITARIA-V2 (colunas e índice usados aqui)
  create table public.marmitaria_vendas (
    id uuid primary key default gen_random_uuid(), unidade_id text not null references public.unidades(id), data date not null,
    canal text not null, ficha_id uuid references public.fichas_tecnicas(id), quantidade numeric not null default 0,
    valor_bruto numeric not null default 0, descontos numeric not null default 0, cancelamentos numeric not null default 0,
    tributos numeric, comissao numeric not null default 0, taxa_pagamento numeric not null default 0,
    entrega_subsidiada numeric not null default 0, promocoes numeric not null default 0, outras_taxas numeric not null default 0,
    repasse_liquido numeric, taxas_estimadas boolean not null default false, fonte text not null default 'manual',
    referencia_externa text, observacao text, criado_por uuid default auth.uid(),
    created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create unique index marmitaria_vendas_externa_uq on public.marmitaria_vendas (unidade_id, fonte, referencia_externa) where referencia_externa is not null;
  grant all on public.marmitaria_vendas to service_role; -- como no Supabase (privilégio padrão do servidor)

  -- dublê de estoque_movimentar: mesma assinatura, exige login, chave idempotente
  create table public.mov_teste (chave text primary key, unidade text, estoque uuid, insumo uuid, tipo text, motivo text, qtd numeric, quem uuid);
  create function public.estoque_movimentar(p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_tipo text, p_motivo text, p_quantidade numeric,
    p_validade date default null, p_quantidade_informada numeric default null, p_unidade_informada text default null, p_detalhe jsonb default null,
    p_observacao text default null, p_responsavel_nome text default null, p_chave text default null, p_pin text default null,
    p_justificativa text default null, p_origem text default 'movimentacao') returns jsonb language plpgsql security definer set search_path = public as $$
  begin
    if auth.uid() is null then raise exception 'Faça login para movimentar o estoque.'; end if;
    if exists (select 1 from public.mov_teste where chave = p_chave) then return jsonb_build_object('ok', true, 'idempotente', true); end if;
    insert into public.mov_teste values (p_chave, p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_motivo, p_quantidade, auth.uid());
    return jsonb_build_object('ok', true, 'idempotente', false);
  end $$;
  grant execute on function public.estoque_movimentar(text,uuid,uuid,text,text,numeric,date,numeric,text,jsonb,text,text,text,text,text,text) to authenticated;
`);

const sql1 = fs.readFileSync(path.join(raiz, "db", "integracoes", "IFOOD_1_CONEXAO.sql"), "utf8");
const sql2 = fs.readFileSync(path.join(raiz, "db", "integracoes", "IFOOD_2_PEDIDOS.sql"), "utf8");
await pg.exec(sql1);
await pg.exec(sql2);
await pg.exec(sql2);
conferir("IFOOD-2 aplica duas vezes sem erro", true, true);

const comoServidor = async (fn) => { await pg.exec("set role service_role"); try { return await fn(); } finally { await pg.exec("reset role"); } };
const comoUsuario = async (uid, fn) => {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
};
const gravar = (pedido, vendas = null) => comoServidor(() => pg.query("select public.delivery_gravar_pedido($1::jsonb, $2::jsonb) r", [JSON.stringify(pedido), vendas === null ? null : JSON.stringify(vendas)]));

const base = { unidade_id: "marmitaria", canal: "ifood", pedido_externo_id: "pedido-1", merchant_id: "m1", status: "RECEBIDO", data_operacao: "2026-10-14" };
const det = { ...base, detalhes_carregados: true, display_id: "1234", cliente_nome: "Ana", valor_pedido: 40, subtotal: 35, taxa_entrega: 5,
  itens: [{ codigo: "X1", nome: "Marmita frango", quantidade: 2 }] };
const linha = (extra = {}) => ({ referencia_externa: `ifood:pedido-1:${F1}`, ficha_id: F1, quantidade: 2, valor_bruto: 35, comissao: 4.2, taxas_estimadas: true, ...extra });

// ── gravação idempotente, status só avança ──────────────────────────────────
await gravar(base);
await gravar({ ...det, status: "CONFIRMADO" }, [linha()]);
await gravar({ ...det, status: "CONFIRMADO" }, [linha()]);
let r = await pg.query("select count(*)::int n, max(status) s, max(display_id) d from public.delivery_pedidos");
conferir("reenvio do mesmo pedido não duplica", r.rows[0], { n: 1, s: "CONFIRMADO", d: "1234" });
r = await pg.query("select count(*)::int n, sum(quantidade)::int q from public.marmitaria_vendas where fonte = 'ifood'");
conferir("linha de venda gravada uma vez só", r.rows[0], { n: 1, q: 2 });

await gravar({ ...base, status: "DESPACHADO" });
await gravar({ ...base, status: "CONFIRMADO" }); // evento atrasado
r = await pg.query("select status, itens from public.delivery_pedidos");
conferir("evento atrasado não faz o status voltar", r.rows[0].status, "DESPACHADO");
conferir("evento sem detalhes não apaga os itens", r.rows[0].itens.length, 1);

await gravar({ ...base, status: "CANCELADO", cancelamento: { codigo: "501" } }, [linha({ cancelamentos: 35 })]);
await gravar({ ...base, status: "CONCLUIDO" });
r = await pg.query("select status from public.delivery_pedidos");
conferir("cancelamento é final", r.rows[0].status, "CANCELADO");
r = await pg.query("select cancelamentos::int c from public.marmitaria_vendas where fonte = 'ifood'");
conferir("cancelamento vai para a venda", r.rows[0].c, 35);

// ── itens alterados: linha some do pedido → zerada, não apagada ─────────────
await gravar({ ...det, pedido_externo_id: "pedido-2", status: "CONFIRMADO" }, [{ referencia_externa: "ifood:pedido-2:a", quantidade: 1, valor_bruto: 20 }, { referencia_externa: "ifood:pedido-2:b", quantidade: 1, valor_bruto: 15 }]);
await gravar({ ...det, pedido_externo_id: "pedido-2", status: "CONFIRMADO" }, [{ referencia_externa: "ifood:pedido-2:a", quantidade: 1, valor_bruto: 20 }]);
await gravar({ ...det, pedido_externo_id: "pedido-2", status: "PRONTO" });
r = await pg.query("select count(*)::int n from public.marmitaria_vendas where referencia_externa like 'ifood:pedido-2:%' and valor_bruto > 0");
conferir("evento só de status não mexe nas vendas", r.rows[0].n, 1);
r = await pg.query("select referencia_externa ref, valor_bruto::int v from public.marmitaria_vendas where referencia_externa like 'ifood:pedido-2:%' order by 1");
conferir("item retirado do pedido fica zerado", r.rows, [{ ref: "ifood:pedido-2:a", v: 20 }, { ref: "ifood:pedido-2:b", v: 0 }]);

const e1 = await comoServidor(() => erroDe("select public.delivery_gravar_pedido($1::jsonb, $2::jsonb)", [JSON.stringify(base), JSON.stringify([{ referencia_externa: "ifood:outro:x", quantidade: 1 }])]));
conferir("linha de outro pedido é recusada", /outro pedido/.test(e1 || ""), true);

// ── repasse real não é apagado por estimativa ───────────────────────────────
await pg.exec(`update public.marmitaria_vendas set taxas_estimadas = false, repasse_liquido = 28.5 where referencia_externa = 'ifood:pedido-2:a'`);
await gravar({ ...det, pedido_externo_id: "pedido-2", status: "CONCLUIDO" }, [{ referencia_externa: "ifood:pedido-2:a", quantidade: 1, valor_bruto: 20, repasse_liquido: 17, taxas_estimadas: true }]);
r = await pg.query("select repasse_liquido::numeric r, taxas_estimadas t from public.marmitaria_vendas where referencia_externa = 'ifood:pedido-2:a'");
conferir("repasse real preservado", r.rows[0], { r: "28.5", t: false });

// ── isolamento e privilégios ────────────────────────────────────────────────
const eUser = await comoUsuario(U1, () => erroDe("select public.delivery_gravar_pedido($1::jsonb)", [JSON.stringify(base)]));
conferir("usuário não grava pedido direto", /permission denied/.test(eUser || ""), true);
const eAnon = await (async () => { await pg.exec("set role anon"); try { return await erroDe("select * from public.delivery_pedidos"); } finally { await pg.exec("reset role"); } })();
conferir("anônimo não lê pedidos", /permission denied/.test(eAnon || ""), true);
r = await comoUsuario(U1, () => pg.query("select count(*)::int n from public.delivery_pedidos"));
conferir("usuário da marmitaria vê os pedidos dela", r.rows[0].n, 2);
r = await comoUsuario(U2, () => pg.query("select count(*)::int n from public.delivery_pedidos"));
conferir("usuário de outro negócio não vê nenhum", r.rows[0].n, 0);
const eStatus = await comoUsuario(U1, () => erroDe("update public.delivery_pedidos set status = 'CONCLUIDO'"));
conferir("usuário não muda status", /permission denied/.test(eStatus || ""), true);
await comoUsuario(U1, () => pg.query("update public.delivery_pedidos set separacao = 'separado' where pedido_externo_id = 'pedido-2'"));
await comoUsuario(U2, () => pg.query("update public.delivery_pedidos set separacao = 'separado' where pedido_externo_id = 'pedido-1'"));
r = await pg.query("select pedido_externo_id p, separacao s from public.delivery_pedidos order by 1");
conferir("separação só na própria unidade", r.rows, [{ p: "pedido-1", s: "pendente" }, { p: "pedido-2", s: "separado" }]);
for (const t of ["integration_events", "delivery_repasses"]) {
  const e = await comoUsuario(U1, () => erroDe(`insert into public.${t} (unidade_id, provider, provider_event_id, event_type) values ('marmitaria','IFOOD','x','PLC')`));
  conferir(`usuário não grava em ${t}`, !!e, true);
}
await comoUsuario(U1, () => pg.query(`insert into public.delivery_itens_mapeamento (unidade_id, codigo_externo, ficha_id) values ('marmitaria', 'X1', '${F1}')`));
const eMap = await comoUsuario(U2, () => erroDe(`insert into public.delivery_itens_mapeamento (unidade_id, codigo_externo) values ('marmitaria', 'X2')`));
conferir("mapeamento só na própria unidade", /row-level security/.test(eMap || ""), true);

// ── baixa de estoque pelo usuário ───────────────────────────────────────────
const pid = (await pg.query("select id from public.delivery_pedidos where pedido_externo_id = 'pedido-2'")).rows[0].id;
const baixa = (uid, versao, unidade = "marmitaria") => comoUsuario(uid, () => erroDe("select public.marmitaria_baixar_pedidos($1::jsonb)", [JSON.stringify({
  unidade_id: unidade, pedidos: [{ pedido_id: pid, versao, aplicado: { [`${E1}:${I1}`]: 150 }, movimentos: [{ estoque_id: E1, insumo_id: I1, tipo: "saida", quantidade: 150 }] }],
})]));
conferir("baixa na versão certa passa", await baixa(U1, 0), null);
r = await pg.query("select estoque_versao v, estoque_aplicado a from public.delivery_pedidos where id = $1", [pid]);
conferir("versão e aplicado atualizados", r.rows[0], { v: 1, a: { [`${E1}:${I1}`]: 150 } });
r = await pg.query("select count(*)::int n, max(motivo) m, max(quem::text) q from public.mov_teste");
conferir("movimento registrado como consumo do usuário", r.rows[0], { n: 1, m: "consumo", q: U1 });
const eVersao = await baixa(U1, 0);
conferir("reenvio com versão antiga é recusado (sem baixar de novo)", /mudou/.test(eVersao || ""), true);
const eOutro = await baixa(U2, 1, "marmitaria");
conferir("outro negócio não baixa estoque da marmitaria", /Sem acesso/.test(eOutro || ""), true);
const eAnonBaixa = await (async () => { await pg.exec("set role anon"); try { return await erroDe("select public.marmitaria_baixar_pedidos('{}'::jsonb)"); } finally { await pg.exec("reset role"); } })();
conferir("anônimo não executa a baixa", /permission denied/.test(eAnonBaixa || ""), true);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
