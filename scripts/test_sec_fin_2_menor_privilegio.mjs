// Teste LOCAL (PGlite) da SEC-FIN-2 — menor privilégio nos objetos da F2.3.
// Nada aqui toca produção. Uso:
//   PGLITE=<caminho de @electric-sql/pglite> node scripts/test_sec_fin_2_menor_privilegio.mjs
// O funcionamento da F2.3 DEPOIS da correção é provado rodando a suíte inteira:
//   SEC_FIN_2=1 PGLITE=<...> node app/lib/contas-receber.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBancoF21 } from "../app/lib/teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
const AUDITORIA = ler("db/diagnosticos/F2_3_AUDITORIA_RECEBER.sql");
const PREVIA = ler("db/security/SEC_FIN_2_PREVIA_MENOR_PRIVILEGIO.sql");
const CORRECAO = ler("db/security/SEC_FIN_2_MENOR_PRIVILEGIO_F23.sql");
const ROLLBACK = CORRECAO.match(/\/\* ── ROLLBACK[^\n]*\n([\s\S]*?)\n\s*─+ \*\//)[1];

let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};
const execScript = async (db, sql) => { try { await db.exec(sql); return null; } catch (e) { await db.exec("rollback"); return e.message; } };
const privilegios = async (db) => Object.fromEntries((await db.query(AUDITORIA)).rows
  .filter((r) => r.item.startsWith("04 ")).map((r) => [r.item.replace("04 privilégios: ", ""), r.resultado]));
const colunasUpdate = async (db, tabela) => (await db.query(
  `select string_agg(column_name, ',' order by column_name) c from information_schema.column_privileges
    where table_schema = 'public' and table_name = $1 and grantee = 'authenticated' and privilege_type = 'UPDATE'`, [tabela])).rows[0].c;
const policies = async (db) => (await db.query(`select tablename, policyname, qual, with_check from pg_policies
  where tablename in ('fin_recebimentos','fin_contas_receber','fin_contas_financeiras','fin_taxas_meio_pagamento') order by 1`)).rows;

// Resultado da auditoria REAL de produção (01/10/2026), bloco 04.
const PRODUCAO = {
  "fin_contas_financeiras → authenticated": "INSERT,REFERENCES,SELECT,TRIGGER,UPDATE",
  "fin_contas_receber → authenticated": "INSERT,REFERENCES,SELECT,TRIGGER,UPDATE",
  "fin_recebimentos → authenticated": "REFERENCES,SELECT,TRIGGER",
  "fin_taxas_meio_pagamento → authenticated": "INSERT,REFERENCES,SELECT,TRIGGER,UPDATE",
  "vw_fin_contas_receber → authenticated": "DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE",
  "vw_fin_fluxo_caixa → authenticated": "DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE",
  "vw_fin_saldo_contas_financeiras → authenticated": "DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE",
};
const DEPOIS = {
  "fin_contas_financeiras → authenticated": "INSERT,SELECT",
  "fin_contas_receber → authenticated": "INSERT,SELECT",
  "fin_recebimentos → authenticated": "SELECT",
  "fin_taxas_meio_pagamento → authenticated": "INSERT,SELECT",
  "vw_fin_contas_receber → authenticated": "SELECT",
  "vw_fin_fluxo_caixa → authenticated": "SELECT",
  "vw_fin_saldo_contas_financeiras → authenticated": "SELECT",
};
const COLUNAS_RECEBER = "adquirente,autorizacao,bandeira,cancelado_em,conta_financeira_prevista_id,data_prevista,data_venda,descricao,motivo_cancelamento,nsu,observacao,status,taxa_fixa_prevista,taxa_percentual_prevista,taxa_regra_id,valor_bruto,valor_taxa_previsto";

// ── 1. reprodução fiel do estado de produção ────────────────────────────────
const db = await criarBancoF21(raiz);
conferir("banco local reproduz EXATAMENTE os privilégios auditados em produção (bloco 04)", await privilegios(db), PRODUCAO);
const rpcs = (await db.query(AUDITORIA)).rows.filter((r) => r.item.startsWith("06 ") || r.item.startsWith("07 ")).map((r) => r.resultado.replace(/ \| dono=postgres/, ""));
conferir("RPCs: definer, anon=false, authenticated como em produção", rpcs.map((r) => r.match(/definer=\w+ \| anon=\w+ \| authenticated=\w+|^(true|false)$/)?.[0]),
  ["definer=true | anon=false | authenticated=false", "definer=true | anon=false | authenticated=true", "definer=true | anon=false | authenticated=true", "true", "true"]);
const policiesAntes = await policies(db);

// ── 2. prévia (só leitura) ──────────────────────────────────────────────────
const previa = (await db.query(PREVIA)).rows;
const linhasAuth = previa.filter((r) => r.ord === 1 && r.item.endsWith("→ authenticated"));
conferir("prévia: os 7 objetos MUDAM para authenticated", linhasAuth.map((r) => r.resultado.endsWith("MUDA")), Array(7).fill(true));
conferir("prévia: anon e PUBLIC sem mudança (já não têm nada)", previa.filter((r) => r.ord === 1 && !r.item.endsWith("→ authenticated")).every((r) => r.resultado.includes("HOJE: (nada)") && r.resultado.endsWith("sem mudança")), true);
conferir("prévia: mostra as 4 policies que NÃO mudam", previa.filter((r) => r.ord === 2).length, 4);
const infoAnon = previa.filter((r) => r.ord === 3).map((r) => `${r.item.replace("info: função executável por anon: ", "")}=${r.resultado}`);
console.log("     (info) funções fin_*/estoque_* executáveis por anon no estado reproduzido:", infoAnon.join("; ") || "nenhuma");
conferir("prévia: nenhuma função de dados executável por anon fica marcada REVISAR", infoAnon.filter((x) => x.endsWith("REVISAR")), []);
conferir("prévia é só leitura (nada mudou)", await privilegios(db), PRODUCAO);

// ── 3. correção ─────────────────────────────────────────────────────────────
conferir("correção roda", await execScript(db, CORRECAO), null);
conferir("DEPOIS: privilégios de tabela/view = menor privilégio", await privilegios(db), DEPOIS);
conferir("DEPOIS: fin_contas_receber — UPDATE só nas 17 colunas da tela", await colunasUpdate(db, "fin_contas_receber"), COLUNAS_RECEBER);
conferir("DEPOIS: fin_contas_financeiras — UPDATE só em nome e ativa", await colunasUpdate(db, "fin_contas_financeiras"), "ativa,nome");
conferir("DEPOIS: fin_taxas_meio_pagamento — UPDATE só em ativa e vigente_ate", await colunasUpdate(db, "fin_taxas_meio_pagamento"), "ativa,vigente_ate");
conferir("DEPOIS: fin_recebimentos — nenhum UPDATE", await colunasUpdate(db, "fin_recebimentos"), null);
conferir("DEPOIS: policies por unidade idênticas (não foram tocadas)", await policies(db), policiesAntes);
conferir("DEPOIS: prévia diz 'sem mudança' em tudo", (await db.query(PREVIA)).rows.filter((r) => r.ord === 1).every((r) => r.resultado.endsWith("sem mudança")), true);
conferir("backup do estado anterior guardado", (await db.query(`select count(*)::int n from public.sec_backup_privilegios_sec_fin_2 where papel = 'authenticated'`)).rows[0].n, 3 * 7 + 3 + 3 * 5);
conferir("backup não é legível pelo app", /permission denied/.test(await (async () => {
  await db.exec("set role authenticated"); try { await db.query("select * from public.sec_backup_privilegios_sec_fin_2"); return ""; } catch (e) { return e.message; } finally { await db.exec("reset role"); }
})()), true);
conferir("rodar de novo não quebra (idempotente)", await execScript(db, CORRECAO), null);
conferir("rodar de novo: mesmo estado final", await privilegios(db), DEPOIS);

// ── 4. rollback ─────────────────────────────────────────────────────────────
conferir("rollback roda", await execScript(db, ROLLBACK), null);
conferir("rollback: volta EXATAMENTE ao estado auditado em produção", await privilegios(db), PRODUCAO);
conferir("rollback: UPDATE de novo em todas as colunas de fin_contas_financeiras",
  (await colunasUpdate(db, "fin_contas_financeiras")).split(",").length,
  (await db.query(`select count(*)::int n from information_schema.columns where table_schema='public' and table_name='fin_contas_financeiras'`)).rows[0].n);

// ── 5. verificação prévia aborta sem as policies ────────────────────────────
{
  const db2 = await criarBancoF21(raiz);
  await db2.exec(`alter policy fin_recebimentos_unidade_f21 on public.fin_recebimentos rename to outra_coisa`);
  conferir("sem as policies por unidade: aborta", /policies por unidade/.test((await execScript(db2, CORRECAO)) || ""), true);
  conferir("sem as policies por unidade: nada mudou", await privilegios(db2), PRODUCAO);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
