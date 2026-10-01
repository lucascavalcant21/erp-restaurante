// Testes da F2.2 (Contas a Pagar sobre a fundação F2.1).
// Rode com: PGLITE=<caminho de @electric-sql/pglite> node app/lib/contas-pagar.test.mjs
//
// A camada contas-pagar.mjs roda contra o SQL REAL da F2.1
// (db/F2_1_FUNDACAO_FINANCEIRA.sql) num Postgres em memória (PGlite), através
// de um adaptador mínimo que imita o cliente do Supabase (from/insert/update/
// select/eq/in/rpc), com papel `authenticated`, auth.uid() e RLS por unidade.
// Nada aqui toca o banco de produção. As contas "antigas" são sintéticas.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  criarContaPagar, editarContaPagar, registrarPagamento, estornarPagamento, cancelarConta,
  criarContasPagarEmLote, lancarContaPagar, gerarRecorrentes, planejarRecorrentes,
  validarConta, montarParcelas, intervaloPeriodo, resumoContas, unidadeValida, podeReceberPagamento,
  podeCancelar, rotuloSituacao, categoriaTextoCompat, competenciaDe,
} from "./contas-pagar.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

// ── 1. funções puras ─────────────────────────────────────────────────────────
conferir("parcelas: 3.000 em 3 → 1.000 cada", montarParcelas(3000, 3, "2026-10-10").map((p) => p.valor), [1000, 1000, 1000]);
conferir("parcelas: 1.000,01 em 3 → centavos exatos", montarParcelas(1000.01, 3, "2026-10-10").map((p) => p.valor), [333.33, 333.33, 333.35]);
conferir("parcelas: vencimentos mensais (31 → fim do mês)", montarParcelas(30, 3, "2026-01-31").map((p) => p.data_vencimento), ["2026-01-31", "2026-02-28", "2026-03-31"]);
conferir("competência: '2026-09' → 2026-09-01", competenciaDe("2026-09"), "2026-09-01");
conferir("semana: seg→dom", intervaloPeriodo("semana", "2026-10-01"), { de: "2026-09-28", ate: "2026-10-04" });
conferir("mês", intervaloPeriodo("mes", "2026-02-10"), { de: "2026-02-01", ate: "2026-02-28" });
conferir("personalizado inválido → nulo", intervaloPeriodo("personalizado", "2026-10-01", { de: "2026-10-05", ate: "2026-10-01" }), null);
conferir("UUID falso recusado", unidadeValida("00000000-0000-0000-0000-000000000001"), false);
conferir("categoria compat: energia → custo_fixo", categoriaTextoCompat("utilidades_energia"), "custo_fixo");
conferir("categoria compat: salários → cmo", categoriaTextoCompat("pessoal_salarios"), "cmo");
conferir("conta nova com 'mercadoria_insumos' recusada", validarConta({ descricao: "x", valor: 1, data_vencimento: "2026-10-01", competencia: "2026-10", categoria_codigo: "mercadoria_insumos" }).ok, false);
conferir("conta nova com 'legado_cmo' recusada", validarConta({ descricao: "x", valor: 1, data_vencimento: "2026-10-01", competencia: "2026-10", categoria_codigo: "legado_cmo" }).ok, false);
conferir("conta nova sem competência recusada", validarConta({ descricao: "x", valor: 1, data_vencimento: "2026-10-01", categoria_codigo: "outros" }).ok, false);

// ── 2. banco simulado com a F2.1 real ────────────────────────────────────────
const alvo = process.env.PGLITE;
if (!alvo) {
  console.log("\nPGLITE não informado: testes de integração NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(alvo, "dist", "index.js")).href);
const pg = new PGlite();
await pg.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table public.unidades (id text primary key, nome text);
create table public.fornecedores (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
create table public.insumos (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
create table public.estoques (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
create table public.vendas (id uuid primary key default gen_random_uuid(), unidade_id text, total numeric);
create table public.contas_pagar (id uuid primary key default gen_random_uuid(), unidade_id text, descricao text, valor numeric,
  data_vencimento date, data_pagamento date, categoria text, status text, created_at timestamptz default now(),
  updated_at timestamptz default now(), recorrente boolean default false);
alter table public.contas_pagar enable row level security;
-- como as policies antigas de produção: qualquer logado (sem unidade) — ver relatório
create policy cp_auth on public.contas_pagar for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.contas_pagar to authenticated;
grant select on public.fornecedores to authenticated;
create function public.auth_unidade_id() returns text language sql stable security definer as $$ select coalesce(current_setting('test.unidade', true), '') $$;
create function public.pode_ver_todas() returns boolean language sql stable security definer as $$ select coalesce(current_setting('test.rede', true), 'false') = 'true' $$;
insert into public.unidades values ('seldeestrela','Unidade'), ('outra','Outra');
insert into public.fornecedores (id, unidade_id, nome) values ('11111111-1111-1111-1111-111111111111','seldeestrela','Companhia de Energia');
insert into public.contas_pagar (id, unidade_id, descricao, valor, data_vencimento, data_pagamento, categoria, status, created_at, updated_at) values
 ('aaaaaaaa-0000-0000-0000-000000000001','seldeestrela','Histórica paga',2382.20,'2026-06-23','2026-06-23','cmo','pago','2026-06-23','2026-06-23'),
 ('aaaaaaaa-0000-0000-0000-000000000002','seldeestrela','Histórica pendente',800,'2026-06-23',null,'cmo','pendente','2026-06-23','2026-06-23'),
 ('aaaaaaaa-0000-0000-0000-000000000003','seldeestrela','Histórica cmv',9,'2026-07-15',null,'cmv','pendente','2026-07-15','2026-07-15');
`);
await pg.exec(fs.readFileSync(path.join(raiz, "db", "F2_1_FUNDACAO_FINANCEIRA.sql"), "utf8"));
const historicoAntes = (await pg.query(`select id, descricao, valor, data_vencimento, data_pagamento, categoria, status, created_at from public.contas_pagar order by id`)).rows;

// Adaptador mínimo no formato do supabase-js (só o que a camada usa).
function cliente({ uid = "33333333-3333-3333-3333-333333333333", unidade = "seldeestrela", rede = false, quebrar = null } = {}) {
  const sessao = async () => {
    await pg.exec("reset role");
    await pg.query(`select set_config('request.jwt.claim.sub',$1,false), set_config('test.unidade',$2,false), set_config('test.rede',$3,false)`, [uid, unidade, String(rede)]);
    await pg.exec("set role authenticated");
  };
  const executar = async (sql, params) => {
    if (quebrar) return { data: null, error: { message: quebrar, code: "XX000" } };
    await sessao();
    try { return { data: (await pg.query(sql, params)).rows, error: null }; }
    catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
    finally { await pg.exec("reset role"); }
  };
  return {
    from(tabela) {
      const st = { op: "select", cols: "*", rows: null, patch: null, where: [], params: [], ret: null, order: null, single: false };
      const p = (v) => { st.params.push(v); return `$${st.params.length}`; };
      const b = {
        select(cols = "*") { if (st.op === "select") st.cols = cols; else st.ret = cols; return b; },
        insert(rows) { st.op = "insert"; st.rows = Array.isArray(rows) ? rows : [rows]; return b; },
        update(patch) { st.op = "update"; st.patch = patch; return b; },
        eq(c, v) { st.where.push(() => `${c} = ${p(v)}`); return b; },
        in(c, vs) { st.where.push(() => `${c} = any(${p(vs)})`); return b; },
        gte(c, v) { st.where.push(() => `${c} >= ${p(v)}`); return b; },
        lte(c, v) { st.where.push(() => `${c} <= ${p(v)}`); return b; },
        order(c, o = {}) { st.order = `${c} ${o.ascending === false ? "desc" : "asc"}`; return b; },
        maybeSingle() { st.single = true; return b; },
        single() { st.single = true; return b; },
        then(res, rej) {
          const run = async () => {
            st.params = [];
            let sql;
            if (st.op === "insert") {
              const cols = [...new Set(st.rows.flatMap(Object.keys))];
              const valores = st.rows.map((r) => `(${cols.map((c) => (r[c] === undefined ? "default" : p(r[c]))).join(", ")})`).join(", ");
              sql = `insert into public.${tabela} (${cols.join(", ")}) values ${valores}${st.ret ? ` returning ${st.ret}` : ""}`;
            } else if (st.op === "update") {
              const sets = Object.entries(st.patch).map(([c, v]) => `${c} = ${p(v)}`).join(", ");
              const where = st.where.map((f) => f()).join(" and ");
              sql = `update public.${tabela} set ${sets}${where ? ` where ${where}` : ""}${st.ret ? ` returning ${st.ret}` : ""}`;
            } else {
              const where = st.where.map((f) => f()).join(" and ");
              sql = `select ${st.cols} from public.${tabela}${where ? ` where ${where}` : ""}${st.order ? ` order by ${st.order}` : ""}`;
            }
            const r = await executar(sql, st.params);
            if (r.error) return r;
            if (st.op !== "select" && !st.ret) return { data: null, error: null };
            return { data: st.single ? (r.data[0] || null) : r.data, error: null };
          };
          return run().then(res, rej);
        },
      };
      return b;
    },
    async rpc(nome, params) {
      const chaves = Object.keys(params);
      const r = await executar(`select public.${nome}(${chaves.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, chaves.map((k) => params[k]));
      return r.error ? r : { data: r.data[0].r, error: null };
    },
  };
}
const db = cliente();
const ver = async (id) => (await pg.query(`select * from public.vw_fin_contas_pagar where id = $1`, [id])).rows[0];
const todas = async () => (await pg.query(`select * from public.vw_fin_contas_pagar where unidade_id = 'seldeestrela'`)).rows
  .map((r) => ({ ...r, data_vencimento: iso(r.data_vencimento), competencia_efetiva: iso(r.competencia_efetiva), data_ultimo_pagamento: iso(r.data_ultimo_pagamento) }));
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
const HOJE = new Date().toISOString().slice(0, 10);
const base = { unidade_id: "seldeestrela", descricao: "Energia de setembro", valor: "5.000,00", data_vencimento: "2026-10-10",
  competencia: "2026-09", categoria_codigo: "utilidades_energia", centro_custo_codigo: "cozinha",
  fornecedor_id: "11111111-1111-1111-1111-111111111111", documento_numero: "BOL-123", observacao: "conta de luz" };

// ── 3. criar ─────────────────────────────────────────────────────────────────
const c1 = await criarContaPagar(db, base, { chave: "form-1" });
conferir("criar: sem erro, 1 id", [c1.error, c1.data?.length], [null, 1]);
const v1 = await ver(c1.data[0]);
conferir("criar: pendente, valor original 5000, saldo 5000", [v1.situacao, Number(v1.valor_original), Number(v1.saldo)], ["pendente", 5000, 5000]);
conferir("criar: competência ≠ vencimento", [iso(v1.competencia_efetiva), iso(v1.data_vencimento), v1.competencia_inferida], ["2026-09-01", "2026-10-10", false]);
conferir("criar: categoria, centro, fornecedor, documento", [v1.categoria_codigo, v1.centro_custo_codigo, v1.fornecedor_id, v1.documento_numero, v1.categoria_texto_antigo],
  ["utilidades_energia", "cozinha", "11111111-1111-1111-1111-111111111111", "BOL-123", "custo_fixo"]);
conferir("criar: quem criou registrado", v1.criado_por, "33333333-3333-3333-3333-333333333333");
const retry = await criarContaPagar(db, base, { chave: "form-1" });
conferir("retry (mesma chave): idempotente, mesma conta", [retry.idempotente, retry.data?.[0]], [true, c1.data[0]]);
const [d1, d2] = await Promise.all([criarContaPagar(db, { ...base, descricao: "Duplo" }, { chave: "form-dup" }), criarContaPagar(db, { ...base, descricao: "Duplo" }, { chave: "form-dup" })]);
conferir("duplo clique concorrente: 1 conta só", (await pg.query(`select count(*)::int n from public.contas_pagar where chave_idempotencia = 'form-dup'`)).rows[0].n, 1);
conferir("duplo clique concorrente: os dois retornos apontam a mesma conta", d1.data?.[0] === d2.data?.[0], true);
const semForn = await criarContaPagar(db, { ...base, fornecedor_id: "", descricao: "Sem fornecedor" }, { chave: "form-sf" });
conferir("conta sem fornecedor", [semForn.error, (await ver(semForn.data[0])).fornecedor_id], [null, null]);
const ccInvalido = await criarContaPagar(db, { ...base, centro_custo_codigo: "garagem" }, { chave: "form-cc" });
conferir("centro de custo inexistente → erro do banco, nada criado", [!!ccInvalido.error, ccInvalido.data], [true, null]);
const cmv = await criarContaPagar(db, { ...base, categoria_codigo: "mercadoria_insumos" }, { chave: "form-cmv" });
conferir("mercadoria como despesa → recusado", /módulo de Compras/.test(cmv.error), true);
conferir("UUID falso de unidade → recusado", !!(await criarContaPagar(db, { ...base, unidade_id: "00000000-0000-0000-0000-000000000001" }, { chave: "x" })).error, true);

// ── 4. editar ────────────────────────────────────────────────────────────────
const e1 = await editarContaPagar(db, { id: c1.data[0], unidade_id: "seldeestrela", contaAtual: { ...v1, data_vencimento: iso(v1.data_vencimento), competencia_efetiva: iso(v1.competencia_efetiva) }, ...base, descricao: "Energia set/26", observacao: "ajustada" });
conferir("editar: grava só o que mudou", e1.data?.alterados, ["descricao", "observacao"]);
conferir("editar: situação intacta", (await ver(c1.data[0])).situacao, "pendente");
const legado = await todas().then((xs) => xs.find((x) => x.descricao === "Histórica pendente"));
const eLeg = await editarContaPagar(db, { id: legado.id, unidade_id: "seldeestrela", contaAtual: legado,
  descricao: "Histórica pendente (revista)", valor: 800, data_vencimento: legado.data_vencimento, competencia: legado.competencia_efetiva,
  categoria_codigo: legado.categoria_codigo });
const rawLeg = (await pg.query(`select descricao, categoria, categoria_codigo, competencia from public.contas_pagar where id = $1`, [legado.id])).rows[0];
conferir("editar conta antiga: só a descrição; categoria/competência continuam inferidas", [eLeg.data?.alterados, rawLeg.categoria, rawLeg.categoria_codigo, rawLeg.competencia],
  [["descricao"], "cmo", null, null]);

// ── 5. pagamentos ────────────────────────────────────────────────────────────
const conta = c1.data[0];
const p1 = await registrarPagamento(db, { conta_pagar_id: conta, pago_em: HOJE, valor_principal: "2.000,00", saldo: 5000, chave: "pg-1" });
const vp1 = await ver(conta);
conferir("pagamento parcial 2.000 → PARCIAL, saldo 3.000", [p1.error, vp1.situacao, Number(vp1.saldo)], [null, "parcial", 3000]);
conferir("retry do pagamento (mesma chave) → idempotente", (await registrarPagamento(db, { conta_pagar_id: conta, pago_em: HOJE, valor_principal: 2000, saldo: 3000, chave: "pg-1" })).data?.idempotente, true);
conferir("pagar acima do saldo → recusado", !!(await registrarPagamento(db, { conta_pagar_id: conta, pago_em: HOJE, valor_principal: 3500, chave: "pg-x" })).error, true);
conferir("desconto maior que o pago → recusado", !!(await registrarPagamento(db, { conta_pagar_id: conta, pago_em: HOJE, valor_principal: 10, desconto: 50, chave: "pg-y" })).error, true);
const [pa, pb] = await Promise.all([
  registrarPagamento(db, { conta_pagar_id: conta, pago_em: HOJE, valor_principal: 3000, juros: "40", multa: "20", desconto: "10", forma_pagamento: "boleto", chave: "pg-2" }),
  registrarPagamento(db, { conta_pagar_id: conta, pago_em: HOJE, valor_principal: 3000, juros: "40", multa: "20", desconto: "10", forma_pagamento: "boleto", chave: "pg-2" }),
]);
const vp2 = await ver(conta);
conferir("segundo pagamento (duplo clique) → PAGO, saldo 0, um só registro", [vp2.situacao, Number(vp2.saldo), (await pg.query(`select count(*)::int n from public.fin_pagamentos where chave_idempotencia = 'pg-2'`)).rows[0].n], ["pago", 0, 1]);
conferir("juros/multa/desconto: saída de caixa 5.050, valor original 5.000", [Number(vp2.saida_caixa_total), Number(vp2.valor_original)], [5050, 5000]);
conferir("um dos cliques foi idempotente", [pa.data?.idempotente, pb.data?.idempotente].sort(), [false, true]);
conferir("editar valor depois de pagamento → recusado", /não pode mudar/.test((await editarContaPagar(db, { id: conta, unidade_id: "seldeestrela", contaAtual: { ...vp2, data_vencimento: iso(vp2.data_vencimento), competencia_efetiva: iso(vp2.competencia_efetiva) }, ...base, valor: 6000 })).error), true);

// integral numa conta nova
const c3 = await criarContaPagar(db, { ...base, descricao: "Internet", valor: 199.9, categoria_codigo: "utilidades_internet" }, { chave: "form-3" });
await registrarPagamento(db, { conta_pagar_id: c3.data[0], pago_em: HOJE, valor_principal: 199.9, chave: "pg-3" });
conferir("pagamento integral → PAGO", (await ver(c3.data[0])).situacao, "pago");

// ── 6. estorno e cancelamento ────────────────────────────────────────────────
const pag2 = (await pg.query(`select id from public.fin_pagamentos where chave_idempotencia = 'pg-2'`)).rows[0].id;
conferir("estorno sem motivo → recusado", /motivo/.test((await estornarPagamento(db, { pagamento_id: pag2, motivo: " " })).error), true);
const est = await estornarPagamento(db, { pagamento_id: pag2, motivo: "boleto pago em duplicidade" });
const hist = (await pg.query(`select estornado_em is not null est, motivo_estorno, estornado_por from public.fin_pagamentos where conta_pagar_id = $1 order by created_at`, [conta])).rows;
conferir("estorno → volta a PARCIAL", [est.error, (await ver(conta)).situacao], [null, "parcial"]);
conferir("histórico: os 2 pagamentos continuam visíveis, o 2º marcado estornado com motivo e autor",
  hist.map((h) => [h.est, h.motivo_estorno, h.estornado_por]), [[false, null, null], [true, "boleto pago em duplicidade", "33333333-3333-3333-3333-333333333333"]]);
conferir("cancelar conta com pagamento → recusado", /estorne/.test((await cancelarConta(db, { conta_pagar_id: conta, motivo: "erro" })).error), true);
conferir("cancelar sem motivo → recusado", !!(await cancelarConta(db, { conta_pagar_id: semForn.data[0], motivo: "" })).error, true);
const canc = await cancelarConta(db, { conta_pagar_id: semForn.data[0], motivo: "lançada por engano" });
conferir("cancelar → CANCELADO e a conta continua existindo", [canc.error, (await ver(semForn.data[0])).situacao], [null, "cancelado"]);

// ── 7. contas antigas ────────────────────────────────────────────────────────
const antigas = await todas();
const paga = antigas.find((c) => c.descricao === "Histórica paga");
conferir("antiga paga: 'Pago antigo', sem botão de pagar nem cancelar", [rotuloSituacao(paga), podeReceberPagamento(paga), podeCancelar(paga)], ["Pago antigo", false, false]);
conferir("antiga paga: RPC recusa novo pagamento", /registro anterior/.test((await registrarPagamento(db, { conta_pagar_id: paga.id, pago_em: HOJE, valor_principal: 1, chave: "pg-leg" })).error), true);
conferir("antiga paga: nenhum pagamento fictício criado", (await pg.query(`select count(*)::int n from public.fin_pagamentos where conta_pagar_id = $1`, [paga.id])).rows[0].n, 0);
const pend = antigas.find((c) => c.descricao.startsWith("Histórica pendente"));
const pLeg = await registrarPagamento(db, { conta_pagar_id: pend.id, pago_em: HOJE, valor_principal: 300, saldo: 800, chave: "pg-leg2" });
conferir("antiga pendente recebe pagamento parcial normal", [pLeg.error, (await ver(pend.id)).situacao], [null, "parcial"]);
const histDepois = (await pg.query(`select id, descricao, valor, data_vencimento, data_pagamento, categoria, status, created_at from public.contas_pagar where id in ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003') order by id`)).rows;
conferir("contas antigas não tocadas continuam idênticas", JSON.stringify(histDepois), JSON.stringify(historicoAntes.filter((h) => h.id !== "aaaaaaaa-0000-0000-0000-000000000002")));

// ── 8. parcelamento ──────────────────────────────────────────────────────────
const parc = await criarContaPagar(db, { ...base, descricao: "Forno", valor: 3000, parcelas: 3, categoria_codigo: "investimento_equipamentos", data_vencimento: "2026-10-15" }, { chave: "form-parc" });
const linhas = (await pg.query(`select descricao, valor::float v, data_vencimento::text d, parcela_numero, parcelas_total, grupo_parcelas_id from public.contas_pagar where chave_idempotencia like 'form-parc:%' order by parcela_numero`)).rows;
conferir("parcelamento: 3 contas 1/3..3/3 de 1.000", linhas.map((l) => [l.descricao, l.v, l.d, l.parcela_numero, l.parcelas_total]),
  [["Forno (1/3)", 1000, "2026-10-15", 1, 3], ["Forno (2/3)", 1000, "2026-11-15", 2, 3], ["Forno (3/3)", 1000, "2026-12-15", 3, 3]]);
conferir("parcelamento: mesmo grupo", new Set(linhas.map((l) => l.grupo_parcelas_id)).size, 1);
const parcRetry = await criarContaPagar(db, { ...base, descricao: "Forno", valor: 3000, parcelas: 3, categoria_codigo: "investimento_equipamentos", data_vencimento: "2026-10-15" }, { chave: "form-parc" });
conferir("parcelamento retry → idempotente, continua 3", [parcRetry.idempotente, (await pg.query(`select count(*)::int n from public.contas_pagar where chave_idempotencia like 'form-parc:%'`)).rows[0].n], [true, 3]);

// ── 9. recorrência (sob demanda) ─────────────────────────────────────────────
const modelo = await criarContaPagar(db, { ...base, descricao: "Aluguel", valor: 4000, categoria_codigo: "ocupacao_aluguel", competencia: "2026-09", data_vencimento: "2026-10-05", recorrente: true }, { chave: "form-alug" });
let lista = await todas();
const rec = await gerarRecorrentes(db, { unidade_id: "seldeestrela", contas: lista, competenciaAlvo: "2026-10" });
const gerada = (await pg.query(`select competencia::text c, data_vencimento::text d, recorrencia_origem_id from public.contas_pagar where recorrencia_origem_id = $1`, [modelo.data[0]])).rows;
conferir("recorrência: gera outubro com vencimento em novembro (mesma distância)", [rec.data.criadas, gerada.map((g) => [g.c, g.d])], [1, [["2026-10-01", "2026-11-05"]]]);
lista = await todas();
conferir("recorrência: pedir de novo não planeja nada", planejarRecorrentes(lista, "2026-10").length, 0);
const forcado = await gerarRecorrentes(db, { unidade_id: "seldeestrela", contas: lista.map((c) => (c.recorrencia_origem_id ? { ...c, recorrencia_origem_id: null, recorrente: false } : c)), competenciaAlvo: "2026-10" });
conferir("recorrência: mesmo forçando, o banco não duplica", [forcado.data.criadas, forcado.data.existentes], [0, 1]);

// ── 10. lote (folha) e módulo externo ────────────────────────────────────────
const lote = await criarContasPagarEmLote(db, [
  { unidade_id: "seldeestrela", descricao: "Salário A", valor: 2000, data_vencimento: "2026-11-05", competencia: "2026-10", categoria_codigo: "pessoal_salarios", chave_idempotencia: "folha:A" },
  { unidade_id: "seldeestrela", descricao: "Salário B", valor: 0, data_vencimento: "2026-11-05", competencia: "2026-10", categoria_codigo: "pessoal_salarios", chave_idempotencia: "folha:B" },
], { chave: "folha-out", origem_tipo: "FOLHA" });
conferir("folha com valor zero → lote inteiro bloqueado, cita quem", [/Salário B/.test(lote.error || ""), (await pg.query(`select count(*)::int n from public.contas_pagar where chave_idempotencia like 'folha:%'`)).rows[0].n], [true, 0]);
const man = await lancarContaPagar(db, { unidade_id: "seldeestrela", descricao: "Manutenção: geladeira", valor: 350, data_vencimento: HOJE, competencia: HOJE, categoria_codigo: "manutencao" },
  { chave: "manutencao:srv1", origem_tipo: "MANUTENCAO", pagaEm: HOJE });
conferir("manutenção declarada paga: conta + pagamento pela RPC", [man.error, man.erroPagamento, (await ver(man.data.id)).situacao], [null, null, "pago"]);
const man2 = await lancarContaPagar(db, { unidade_id: "seldeestrela", descricao: "Manutenção: geladeira", valor: 350, data_vencimento: HOJE, competencia: HOJE, categoria_codigo: "manutencao" },
  { chave: "manutencao:srv1", origem_tipo: "MANUTENCAO", pagaEm: HOJE });
conferir("manutenção finalizada de novo: não duplica conta nem pagamento", [man2.data.id === man.data.id, (await pg.query(`select count(*)::int n from public.fin_pagamentos where conta_pagar_id = $1`, [man.data.id])).rows[0].n], [true, 1]);

// ── 11. isolamento entre unidades ────────────────────────────────────────────
const outra = cliente({ uid: "44444444-4444-4444-4444-444444444444", unidade: "outra" });
const vistas = await outra.from("vw_fin_contas_pagar").select("id").eq("unidade_id", "seldeestrela");
const pagsOutra = await outra.from("fin_pagamentos").select("id");
conferir("outra unidade não vê pagamentos alheios", pagsOutra.data.length, 0);
conferir("outra unidade não paga conta alheia (RPC)", /não encontrada/.test((await registrarPagamento(outra, { conta_pagar_id: pend.id, pago_em: HOJE, valor_principal: 1, chave: "pg-o" })).error), true);
conferir("outra unidade não estorna nem cancela", [!!(await estornarPagamento(outra, { pagamento_id: pag2, motivo: "x" })).error, !!(await cancelarConta(outra, { conta_pagar_id: c3.data[0], motivo: "x" })).error], [true, true]);
// Achado de segurança (ver relatório): contas_pagar ainda tem policy sem unidade;
// enquanto não for corrigida, a OUTRA unidade enxerga as contas pela view.
conferir("[achado] policy antiga de contas_pagar deixa outra unidade LER as contas", vistas.data.length > 0, true);

// ── 12. erro do banco nunca vira sucesso ─────────────────────────────────────
const quebrado = cliente({ quebrar: "connection reset" });
const falhasDb = [
  await criarContaPagar(quebrado, base, { chave: "q1" }),
  await registrarPagamento(quebrado, { conta_pagar_id: conta, pago_em: HOJE, valor_principal: 1, chave: "q2" }),
  await estornarPagamento(quebrado, { pagamento_id: pag2, motivo: "x" }),
  await cancelarConta(quebrado, { conta_pagar_id: conta, motivo: "x" }),
];
conferir("erro do banco: todas as operações devolvem erro e data nula", falhasDb.map((r) => [r.error, r.data]), Array(4).fill(["connection reset", null]));

// ── 13. resumo do topo (caixa ≠ competência) ─────────────────────────────────
lista = await todas();
const pagsPeriodo = (await pg.query(`select valor_total::float valor_total, estornado_em, pago_em::text pago_em from public.fin_pagamentos where unidade_id = 'seldeestrela'`)).rows;
const periodoHoje = intervaloPeriodo("hoje", HOJE);
const r = resumoContas(lista, pagsPeriodo.filter((p) => p.pago_em === HOJE), periodoHoje, HOJE);
const esperadoPago = pagsPeriodo.filter((p) => p.pago_em === HOJE && !p.estornado_em).reduce((s, p) => s + p.valor_total, 0);
conferir("resumo: pago hoje = saídas de caixa não estornadas de hoje", r.pagoNoPeriodo, Math.round(esperadoPago * 100) / 100);
conferir("resumo: a pagar = soma dos saldos em aberto", r.aPagar, Math.round(lista.filter((c) => ["pendente", "parcial", "vencido"].includes(c.situacao)).reduce((s, c) => s + Number(c.saldo), 0) * 100) / 100);
conferir("resumo: antigo pago em junho não entra no 'pago hoje'", r.pagoNoPeriodoIncluiLegado, false);

// ── 14. verificações estáticas ───────────────────────────────────────────────
const pagina = fs.readFileSync(path.join(raiz, "app/dashboard/financeiro/contas/page.js"), "utf8");
const efeitos = pagina.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || [];
conferir("abrir a tela não gera recorrentes (nenhum useEffect chama)", efeitos.some((e) => /gerarContasRecorrentes/.test(e)), false);
const appSrc = ["app/lib/contas-pagar.mjs", "app/lib/financeiro.js", "app/dashboard/financeiro/page.js", "app/dashboard/financeiro/contas/page.js", "app/components/ModalPagamentoConta.js"]
  .map((f) => fs.readFileSync(path.join(raiz, f), "utf8")).join("\n");
conferir("nenhum delete em contas_pagar no fluxo", /from\("contas_pagar"\)[^;]*\.delete\(/.test(appSrc), false);
conferir("pagamento não grava mais status='pago' direto", /status:\s*["']pago["']/.test(appSrc), false);
conferir("sem UUID falso de unidade", appSrc.includes("00000000-0000-0000-0000-000000000001"), false);

// ── 15. navegação: uma rota só, alcançável pelo menu e pela Central ──────────
{
  const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
  const menu = ler("app/components/layout/TopNavigation.js");
  const central = ler("app/components/navigation/FinanceiroHub.js");
  const menuFin = menu.slice(menu.indexOf('id: "financeiro"'));
  conferir("menu Financeiro: Visão Geral, Contas a Pagar, Vendas e Recebimentos, DRE Gerencial",
    [...menuFin.matchAll(/label: "([^"]+)", href: "([^"]+)"/g)].slice(0, 4).map((m) => [m[1], m[2]]),
    [["Visão Geral", "/dashboard/financeiro"], ["Contas a Pagar", "/dashboard/financeiro/contas"],
     ["Vendas e Recebimentos", "/dashboard/vendas"], ["DRE Gerencial", "/dashboard/financeiro/dre"]]);
  conferir("Central: botão direto 'Contas a Pagar' no topo", /push\("\/dashboard\/financeiro\/contas"\)[\s\S]{0,120}Contas a Pagar/.test(central), true);
  conferir("Central: 'Resolver' abre Contas a Pagar filtrado em vencidas", (() => { const i = central.indexOf("Resolver"); const trecho = central.slice(Math.max(0, i - 250), i); return i > 0 && trecho.includes('"/dashboard/financeiro/contas?situacao=vencido"'); })(), true);
  conferir("tela lê o filtro da URL (recarregar mantém)", /params\?\.get\("situacao"\)/.test(pagina) && /params\?\.get\("periodo"\)/.test(pagina), true);
  const outrasTelas = fs.readdirSync(path.join(raiz, "app/dashboard"), { recursive: true }).filter((f) => /contas-?a-?pagar|contas_pagar/i.test(String(f)));
  conferir("não existe segunda tela de contas a pagar", outrasTelas, []);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
