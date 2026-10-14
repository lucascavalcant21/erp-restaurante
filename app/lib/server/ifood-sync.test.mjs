// Sincronização dos pedidos do iFood DE PONTA A PONTA, sem rede:
//   - banco: SQL real da IFOOD-1 e IFOOD-2 no PGlite (cliente no formato do
//     supabase-js, como o servidor usa com service_role);
//   - iFood: dublê que devolve eventos e detalhes sintéticos (fixtures.mjs).
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/server/ifood-sync.test.mjs

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sincronizarUnidade, processarFila, receberWebhook, reprocessar, resumoSincronizacao, salvarPreferencias, mensagemSegura, sincronizarTodas } from "./ifood-sync.mjs";
import { evento, detalhes, CANAL_TESTE, MERCHANT, PEDIDO } from "../ifood/fixtures.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
if (!process.env.PGLITE) { console.log("PGLITE não informado: testes da sincronização do iFood NÃO executados."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

const SEGREDO = "segredo-de-teste-NAO-REAL-123";
const FICHA = "aaaaaaaa-0000-0000-0000-000000000001";

await pg.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  create table public.unidades (id text primary key, nome text, ifood_conectado boolean, ifood_merchant_id text);
  insert into public.unidades values ('marmitaria', 'Marmitaria', true, '${MERCHANT}'), ('restaurante', 'Restaurante', false, null);
  create function public.hefisto_unidades_do_usuario() returns text[] language sql stable as $$ select '{}'::text[] $$;
  create function public.hefisto_ve_todas_unidades() returns boolean language sql stable as $$ select false $$;
  create table public.fichas_tecnicas (id uuid primary key, unidade_id text, nome_receita text);
  insert into public.fichas_tecnicas values ('${FICHA}', 'marmitaria', 'Marmita de frango');
  create table public.marmitaria_configuracoes (unidade_id text primary key, canais jsonb not null default '[]');
  insert into public.marmitaria_configuracoes values ('marmitaria', '${JSON.stringify([CANAL_TESTE])}');
  create table public.marmitaria_vendas (
    id uuid primary key default gen_random_uuid(), unidade_id text not null, data date not null, canal text not null, ficha_id uuid,
    quantidade numeric not null default 0, valor_bruto numeric not null default 0, descontos numeric not null default 0,
    cancelamentos numeric not null default 0, tributos numeric, comissao numeric not null default 0, taxa_pagamento numeric not null default 0,
    entrega_subsidiada numeric not null default 0, promocoes numeric not null default 0, outras_taxas numeric not null default 0,
    repasse_liquido numeric, taxas_estimadas boolean not null default false, fonte text not null default 'manual',
    referencia_externa text, observacao text, criado_por uuid, created_at timestamptz default now(), updated_at timestamptz default now());
  create unique index marmitaria_vendas_externa_uq on public.marmitaria_vendas (unidade_id, fonte, referencia_externa) where referencia_externa is not null;
  create function public.estoque_movimentar(p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_tipo text, p_motivo text, p_quantidade numeric,
    p_validade date default null, p_quantidade_informada numeric default null, p_unidade_informada text default null, p_detalhe jsonb default null,
    p_observacao text default null, p_responsavel_nome text default null, p_chave text default null, p_pin text default null,
    p_justificativa text default null, p_origem text default 'movimentacao') returns jsonb language sql as $$ select '{"ok":true}'::jsonb $$;
`);
for (const f of ["IFOOD_1_CONEXAO.sql", "IFOOD_2_PEDIDOS.sql"]) await pg.exec(fs.readFileSync(path.join(raiz, "db", "integracoes", f), "utf8"));
await pg.exec(`grant all on all tables in schema public to service_role;
  insert into public.integration_connections (unidade_id, provider, external_merchant_id, status, config_json) values ('marmitaria', 'IFOOD', '${MERCHANT}', 'CONNECTED', '{"clientId":"cliente-teste"}');
  insert into public.integration_secrets (unidade_id, provider, credentials_payload) values ('marmitaria', 'IFOOD', '{"isEncrypted":true,"encryptedData":"x"}');
  insert into public.delivery_itens_mapeamento (unidade_id, codigo_externo, ficha_id) values ('marmitaria', 'MARM-FRANGO', '${FICHA}');
  insert into public.delivery_itens_mapeamento (unidade_id, codigo_externo, ignorar) values ('marmitaria', 'REFRI-350', true);`);

// ── cliente no formato do supabase-js (subconjunto usado pelo servidor) ─────
let quebrarUpsert = false;
function db() {
  const executar = async (sql, ps) => {
    await pg.exec("set role service_role");
    try { return await pg.query(sql, ps); } finally { await pg.exec("reset role"); }
  };
  return {
    from(tabela) {
      const st = { op: "select", cols: "*", where: [], ps: [], order: [], limit: null, rows: null, patch: null, conflito: null, ignorar: false };
      const p = (v) => { st.ps.push(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : Array.isArray(v) && v.some((x) => typeof x === "object") ? JSON.stringify(v) : v); return `$${st.ps.length}`; };
      const b = {
        select(c = "*") { if (st.op === "select") st.cols = c; return b; },
        eq(c, v) { st.where.push(`${c} = ${p(v)}`); return b; },
        in(c, vs) { st.where.push(`${c} = any(${p(vs)})`); return b; },
        or(expr) {
          const partes = expr.split(",").map((t) => { const [c, op, ...v] = t.split("."); const val = v.join("."); return op === "is" ? `${c} is null` : `${c} ${op === "lte" ? "<=" : ">="} ${p(val)}`; });
          st.where.push(`(${partes.join(" or ")})`); return b;
        },
        order(c, o = {}) { st.order.push(`${c} ${o.ascending === false ? "desc" : "asc"} nulls first`); return b; },
        limit(n) { st.limit = n; return b; },
        upsert(rows, o = {}) { st.op = "upsert"; st.rows = Array.isArray(rows) ? rows : [rows]; st.conflito = o.onConflict; st.ignorar = !!o.ignoreDuplicates; return b; },
        update(patch) { st.op = "update"; st.patch = patch; return b; },
        delete() { st.op = "delete"; return b; },
        maybeSingle() { st.um = true; return b.then((r) => r); },
        async then(ok, ko) {
          try {
            let sql;
            const where = st.where.length ? ` where ${st.where.join(" and ")}` : "";
            if (st.op === "upsert") {
              if (quebrarUpsert && tabela === "integration_events") return ok({ data: null, error: { message: "banco fora do ar" } });
              const cols = [...new Set(st.rows.flatMap((r) => Object.keys(r)))];
              const vals = st.rows.map((r) => `(${cols.map((c) => (r[c] === undefined ? "default" : p(r[c]))).join(", ")})`).join(", ");
              sql = `insert into public.${tabela} (${cols.join(", ")}) values ${vals} on conflict (${st.conflito}) ${st.ignorar ? "do nothing" : `do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}`}`;
            } else if (st.op === "update") sql = `update public.${tabela} set ${Object.entries(st.patch).map(([c, v]) => `${c} = ${p(v)}`).join(", ")}${where}`;
            else if (st.op === "delete") sql = `delete from public.${tabela}${where}`;
            else sql = `select ${st.cols} from public.${tabela}${where}${st.order.length ? ` order by ${st.order.join(", ")}` : ""}${st.limit ? ` limit ${st.limit}` : ""}`;
            const r = await executar(sql, st.ps);
            return ok({ data: st.um ? (r.rows[0] || null) : r.rows, error: null });
          } catch (e) { return ok({ data: null, error: { message: e.message } }); }
        },
      };
      return b;
    },
    async rpc(nome, params) {
      const ks = Object.keys(params);
      try {
        const r = await executar(`select public.${nome}(${ks.map((k, i) => `${k} => $${i + 1}::jsonb`).join(", ")}) as r`, ks.map((k) => (params[k] == null ? null : JSON.stringify(params[k]))));
        return { data: r.rows[0].r, error: null };
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
  };
}

// ── iFood falso ─────────────────────────────────────────────────────────────
function ifoodFalso() {
  const f = { fila: [], acks: [], detalhe: () => detalhes(), tokens: 0, ackQuebrado: false, chamadasPedido: 0 };
  f.token = async () => { f.tokens++; return "token-teste"; };
  f.esquecerToken = () => {};
  f.eventos = async () => f.fila.slice();
  f.ack = async (_t, ids) => { if (f.ackQuebrado) { const e = new Error("O iFood respondeu 500 ao confirmar o recebimento dos eventos."); e.http = 500; throw e; } f.acks.push(...ids); f.fila = f.fila.filter((e) => !ids.includes(e.id)); return ids.length; };
  f.pedido = async () => { f.chamadasPedido++; return f.detalhe(); };
  return f;
}
const decifrar = () => ({ clientSecret: SEGREDO });
const q = async (sql) => (await pg.query(sql)).rows;
const T0 = "2026-10-14T15:30:00.000Z";
const mais = (min) => new Date(Date.parse(T0) + min * 60_000).toISOString();

// 1. pedido novo + confirmado: guarda, ACK, detalhes, pedido e vendas
const ifood = ifoodFalso();
ifood.fila = [evento("PLC", 0), evento("CFM", 1)];
let r = await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: T0 });
conferir("sincronização ok, 2 recebidos, 2 ACK", [r.ok, r.recebidos, r.ack], [true, 2, 2]);
let p = await q("select status, display_id, cliente_nome, detalhes_carregados from public.delivery_pedidos");
conferir("pedido gravado confirmado, com detalhes e só o primeiro nome", p, [{ status: "CONFIRMADO", display_id: "4821", cliente_nome: "Maria", detalhes_carregados: true }]);
let v = await q("select referencia_externa ref, quantidade::numeric q, valor_bruto::numeric b from public.marmitaria_vendas order by 1");
conferir("vendas: marmitas, outros itens e entrega", v.map((x) => x.ref.split(":")[2]), [FICHA, "entrega", "outros"]);
conferir("2 marmitas vendidas", Number(v.find((x) => x.ref.endsWith(FICHA)).q), 2);
conferir("eventos processados e com ACK", await q("select status, (ack_em is not null) ack from public.integration_events order by evento_em"), [{ status: "PROCESSADO", ack: true }, { status: "PROCESSADO", ack: true }]);
conferir("detalhes lidos uma vez só", ifood.chamadasPedido, 1);

// 2. o iFood manda os mesmos eventos de novo: nada duplica
ifood.fila = [evento("PLC", 0), evento("CFM", 1)];
r = await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(1) });
conferir("eventos repetidos: ACK de novo, sem duplicar", [(await q("select count(*)::int n from public.integration_events"))[0].n, (await q("select count(*)::int n from public.marmitaria_vendas"))[0].n, (await q("select count(*)::int n from public.delivery_pedidos"))[0].n], [2, 3, 1]);

// 3. fora de ordem e cancelamento depois do preparo
ifood.fila = [evento("DSP", 20), evento("PRS", 10)];
await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(2) });
conferir("fora de ordem termina no estágio mais avançado", (await q("select status from public.delivery_pedidos"))[0].status, "DESPACHADO");
ifood.fila = [evento("CAN", 30, { metadata: { CANCEL_CODE: "506", CANCEL_ORIGIN: "CUSTOMER", phone: "999" } })];
await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(3) });
p = (await q("select status, cancelamento from public.delivery_pedidos"))[0];
conferir("cancelado com motivo e origem", [p.status, p.cancelamento.codigo, p.cancelamento.origem], ["CANCELADO", "506", "CUSTOMER"]);
v = await q("select sum(valor_bruto - descontos - cancelamentos)::numeric receita, sum(quantidade)::numeric q from public.marmitaria_vendas");
conferir("cancelamento zera receita e quantidade", [Number(v[0].receita), Number(v[0].q)], [0, 0]);

// 4. detalhes ainda não liberados (404 logo após o PLACED): status gravado, tenta depois sem gastar tentativa
const P2 = "e1f2a3b4-0000-4000-8000-0000000000bb";
ifood.detalhe = () => null;
ifood.fila = [evento("PLC", 40, { id: "ev-p2-plc", orderId: P2 })];
r = await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(11) });
let e2 = (await q(`select status, attempts, proxima_tentativa_em is not null agendado from public.integration_events where order_id = '${P2}'`))[0];
conferir("sem detalhes: ERRO_PROCESSAMENTO reagendado, tentativa não contada", e2, { status: "ERRO_PROCESSAMENTO", attempts: 0, agendado: true });
conferir("pedido aparece mesmo sem detalhes", (await q(`select detalhes_carregados d from public.delivery_pedidos where pedido_externo_id = '${P2}'`))[0].d, false);
ifood.detalhe = () => detalhes({ id: P2, displayId: "4822" });
r = await processarFila(db(), { unidadeId: "marmitaria", ifood, credenciais: { clientId: "c", clientSecret: SEGREDO, merchantId: MERCHANT }, agora: mais(10) });
conferir("antes da hora marcada não reprocessa", r.eventos, 0);
r = await processarFila(db(), { unidadeId: "marmitaria", ifood, credenciais: { clientId: "c", clientSecret: SEGREDO, merchantId: MERCHANT }, agora: mais(60) });
conferir("depois da hora: detalhes lidos e processado", [r.eventos, (await q(`select display_id from public.delivery_pedidos where pedido_externo_id = '${P2}'`))[0].display_id], [1, "4822"]);

// 5. falha ao guardar = nenhum ACK (o iFood manda de novo)
quebrarUpsert = true; ifood.acks = [];
ifood.fila = [evento("PLC", 50, { id: "ev-p3", orderId: "p3" })];
r = await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(70) });
conferir("banco fora do ar: nenhum ACK enviado", ifood.acks.length, 0);
quebrarUpsert = false;

// 6. ACK falhou: evento guardado fica sem ack_em; no próximo polling vem de novo e não duplica
ifood.ackQuebrado = true; ifood.detalhe = () => detalhes({ id: "p3", displayId: "4823" });
r = await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(71) });
conferir("ACK falhou: erro informado sem segredo", [r.ok, /500/.test(r.erro), r.erro.includes(SEGREDO)], [false, true, false]);
ifood.ackQuebrado = false;
r = await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(72) });
conferir("polling seguinte: ACK enviado, evento uma vez só", [ifood.acks.includes("ev-p3"), (await q("select count(*)::int n from public.integration_events where provider_event_id = 'ev-p3'"))[0].n], [true, 1]);

// 7. erro persistente vira FALHA; reprocessar devolve à fila
ifood.detalhe = () => { const e = new Error("O iFood respondeu 500 ao ler o pedido. Bearer abc.def"); e.http = 500; throw e; };
ifood.fila = [evento("PLC", 59, { id: "ev-p4", orderId: "p4" })];
await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(80) });
for (let i = 0; i < 10; i++) await processarFila(db(), { unidadeId: "marmitaria", ifood, credenciais: { clientId: "c", clientSecret: SEGREDO }, agora: mais(200 + i * 70) });
let e4 = (await q("select status, attempts, last_error from public.integration_events where provider_event_id = 'ev-p4'"))[0];
conferir("esgotou as tentativas: FALHA", [e4.status, e4.attempts], ["FALHA", 8]);
conferir("erro gravado sem token", e4.last_error.includes("abc.def"), false);
await reprocessar(db(), { unidadeId: "marmitaria" });
ifood.detalhe = () => detalhes({ id: "p4", displayId: "4824" });
await processarFila(db(), { unidadeId: "marmitaria", ifood, credenciais: { clientId: "c", clientSecret: SEGREDO }, agora: mais(2000) });
conferir("reprocessado com sucesso", (await q("select status from public.integration_events where provider_event_id = 'ev-p4'"))[0].status, "PROCESSADO");

// 8. evento de outra loja não entra na unidade (mas recebe ACK)
ifood.fila = [evento("PLC", 59, { id: "ev-outra", orderId: "px", merchantId: "11111111-2222-4333-8444-555555555555" })];
await sincronizarUnidade(db(), { unidadeId: "marmitaria", decifrar, ifood, agora: mais(2001) });
conferir("outra loja: IGNORADO, sem unidade, com ACK", (await q("select status, unidade_id from public.integration_events where provider_event_id = 'ev-outra'"))[0], { status: "IGNORADO", unidade_id: null });
conferir("e não vira pedido", (await q("select count(*)::int n from public.delivery_pedidos where pedido_externo_id = 'px'"))[0].n, 0);

// 9. webhook: assinatura certa guarda; errada recusa; unidade vem do segredo, não do corpo
const corpo = JSON.stringify([evento("PLC", 59, { id: "ev-wh", orderId: "pw" })]);
const assinatura = crypto.createHmac("sha256", SEGREDO).update(corpo).digest("hex");
let w = await receberWebhook(db(), { corpoBruto: corpo, assinatura, decifrar, agora: mais(2002) });
conferir("webhook assinado: 202 e evento guardado na unidade", [w.status, (await q("select unidade_id from public.integration_events where provider_event_id = 'ev-wh'"))[0]?.unidade_id], [202, "marmitaria"]);
w = await receberWebhook(db(), { corpoBruto: corpo.replace("pw", "pz"), assinatura, decifrar });
conferir("corpo alterado: 401", w.status, 401);
w = await receberWebhook(db(), { corpoBruto: corpo, assinatura: "", decifrar });
conferir("sem assinatura: 401", w.status, 401);

// 10. unidade sem conexão não sincroniza; resumo sem segredo; preferências
r = await sincronizarUnidade(db(), { unidadeId: "restaurante", decifrar, ifood, agora: mais(2003) });
conferir("unidade sem iFood conectado não sincroniza", [r.ok, /não está conectado/.test(r.erro)], [false, true]);
const resumo = await resumoSincronizacao(db(), "marmitaria");
conferir("resumo sem segredo nem token", [resumo.ok, JSON.stringify(resumo).includes(SEGREDO), JSON.stringify(resumo).includes("token-teste")], [true, false, false]);
conferir("baixa de estoque padrão: na produção", resumo.baixaEstoque, "producao");
await salvarPreferencias(db(), "marmitaria", { baixaEstoque: "pedido" });
conferir("preferência salva sem perder o clientId", (await q("select config_json from public.integration_connections"))[0].config_json, { clientId: "cliente-teste", baixaEstoque: "pedido" });
conferir("opção inválida recusada", (await salvarPreferencias(db(), "marmitaria", { baixaEstoque: "xyz" })).ok, false);
conferir("mensagem segura remove Bearer", mensagemSegura(new Error("falhou Bearer abc.123 token=xyz")), "falhou Bearer *** token=***");
const todas = await sincronizarTodas(db(), { decifrar, ifood, agora: mais(2004) });
conferir("agendador percorre só as unidades conectadas", todas.unidades.map((u) => u.unidadeId), ["marmitaria"]);
conferir("nenhuma ação de pedido foi chamada no iFood (só leitura + ACK)", Object.keys(ifood).filter((k) => /confirm|dispatch|cancel|ready|start/i.test(k)), []);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
