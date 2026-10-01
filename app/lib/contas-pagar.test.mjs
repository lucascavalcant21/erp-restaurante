// Testes do HOTFIX FIN-CP-1 (contrato mínimo de contas a pagar).
// Rode com: node app/lib/contas-pagar.test.mjs
//
// Usa um banco falso em memória que imita o PostgREST no que importa aqui:
// insert/update/delete, filtros eq/in/not-in, select de retorno e — o mais
// importante — REJEITA coluna que não existe no schema real de produção.

import fs from "node:fs";
import {
  criarContaPagar, editarContaPagar, pagarContaPagar, estornarContaPagar,
  criarContasPagarEmLote, lancarContaPagar, unidadeValida, situacaoConta,
  statusPersistido, validarCamposConta, CATEGORIAS_NOVA_CONTA,
} from "./contas-pagar.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}

// Colunas reais de public.contas_pagar (confirmadas pelo dono em 2026-09-30).
const COLUNAS = ["id", "unidade_id", "descricao", "valor", "data_vencimento", "data_pagamento", "categoria", "status", "created_at", "updated_at", "recorrente"];

function bancoFalso({ falharCom = null } = {}) {
  const linhas = [];
  const chamadas = [];
  let seq = 0;
  function consulta(tabela) {
    const st = { op: null, payload: null, filtros: [], retornar: false, single: false };
    const exec = () => {
      chamadas.push({ tabela, op: st.op, payload: st.payload });
      if (falharCom) return { data: null, error: { message: falharCom } };
      const payloads = Array.isArray(st.payload) ? st.payload : st.payload ? [st.payload] : [];
      for (const p of payloads) {
        const extra = Object.keys(p).filter((k) => !COLUNAS.includes(k));
        if (extra.length) return { data: null, error: { code: "PGRST204", message: `Could not find the '${extra[0]}' column of 'contas_pagar'` } };
      }
      const casa = (l) => st.filtros.every((f) => f(l));
      let afetadas = [];
      if (st.op === "insert") {
        afetadas = payloads.map((p) => ({ id: `c${++seq}`, created_at: "t", updated_at: "t", ...p }));
        linhas.push(...afetadas);
      } else if (st.op === "update") {
        afetadas = linhas.filter(casa);
        afetadas.forEach((l) => Object.assign(l, st.payload));
      } else if (st.op === "delete") {
        afetadas = linhas.filter(casa);
        afetadas.forEach((l) => linhas.splice(linhas.indexOf(l), 1));
      }
      const data = st.retornar ? afetadas.map((l) => ({ id: l.id })) : null;
      if (st.single) return { data: data?.[0] || null, error: data?.length === 1 ? null : { message: "single: 0 ou >1 linhas" } };
      return { data, error: null };
    };
    const b = {
      insert(p) { st.op = "insert"; st.payload = p; return b; },
      update(p) { st.op = "update"; st.payload = p; return b; },
      delete() { st.op = "delete"; return b; },
      eq(c, v) { st.filtros.push((l) => l[c] === v); return b; },
      in(c, vs) { st.filtros.push((l) => vs.includes(l[c])); return b; },
      not(c, op, lista) {
        const vs = lista.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
        st.filtros.push((l) => l[c] != null && !vs.includes(l[c]));
        return b;
      },
      select() { st.retornar = true; return b; },
      single() { st.single = true; return b; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
    };
    return b;
  }
  return { from: consulta, linhas, chamadas };
}

const U = "seldeestrela";
const HOJE = "2026-10-01";
const valida = { unidade_id: U, descricao: "Conta de luz", valor: "350,90", data_vencimento: "2026-10-10", categoria: "custo_fixo" };

// 1. criar conta válida → pendente, só colunas reais
{
  const db = bancoFalso();
  const r = await criarContaPagar(db, valida);
  conferir("criar: sem erro", r.error, null);
  const l = db.linhas[0];
  conferir("criar: status 'pendente' (minúsculo)", l.status, "pendente");
  conferir("criar: data_pagamento nula", l.data_pagamento, null);
  conferir("criar: valor numérico com vírgula", l.valor, 350.9);
  conferir("criar: colunas enviadas", Object.keys(db.chamadas[0].payload[0]).sort(),
    ["categoria", "data_pagamento", "data_vencimento", "descricao", "recorrente", "status", "unidade_id", "valor"]);
}

// 2. valor zero / descrição vazia / sem vencimento / sem unidade → bloqueado, nada gravado
for (const [nome, dados] of [
  ["valor zero", { ...valida, valor: "0" }],
  ["valor negativo", { ...valida, valor: -5 }],
  ["descrição vazia", { ...valida, descricao: "   " }],
  ["vencimento vazio", { ...valida, data_vencimento: "" }],
  ["unidade vazia", { ...valida, unidade_id: "" }],
  ["unidade 'todas'", { ...valida, unidade_id: "todas" }],
]) {
  const db = bancoFalso();
  const r = await criarContaPagar(db, dados);
  conferir(`bloqueia ${nome}: erro`, !!r.error, true);
  conferir(`bloqueia ${nome}: nenhuma gravação`, db.chamadas.length, 0);
}

// 3. CMV não é oferecido nem aceito em conta nova
conferir("CMV fora das categorias de conta nova", CATEGORIAS_NOVA_CONTA.some((c) => c.id === "cmv"), false);
{
  const db = bancoFalso();
  const r = await criarContaPagar(db, { ...valida, categoria: "cmv" });
  conferir("conta nova com 'cmv' bloqueada", !!r.error && db.chamadas.length === 0, true);
}

// 4. pagar → 'pago' + data real; data futura bloqueada
{
  const db = bancoFalso();
  const { data } = await criarContaPagar(db, valida);
  const futura = await pagarContaPagar(db, { id: data.id, unidade_id: U, data_pagamento: "2026-10-02", hoje: HOJE });
  conferir("pagar com data futura: erro", !!futura.error, true);
  const r = await pagarContaPagar(db, { id: data.id, unidade_id: U, data_pagamento: "2026-09-30", hoje: HOJE });
  conferir("pagar: sem erro", r.error, null);
  conferir("pagar: status 'pago'", db.linhas[0].status, "pago");
  conferir("pagar: data_pagamento real", db.linhas[0].data_pagamento, "2026-09-30");
  const keys = Object.keys(db.chamadas.at(-1).payload).sort();
  conferir("pagar: não grava valor_pago/saldo/juros/forma", keys, ["data_pagamento", "status", "updated_at"]);
  // segunda tentativa (ex.: clique duplo que escapou da tela) não altera nada e não diz sucesso
  const de_novo = await pagarContaPagar(db, { id: data.id, unidade_id: U, data_pagamento: "2026-10-01", hoje: HOJE });
  conferir("pagar de novo: erro", !!de_novo.error, true);
  conferir("pagar de novo: data mantida", db.linhas[0].data_pagamento, "2026-09-30");
}

// 5. clique duplo concorrente: duas chamadas ao mesmo tempo → só uma vale
{
  const db = bancoFalso();
  const { data } = await criarContaPagar(db, valida);
  const [a, b] = await Promise.all([
    pagarContaPagar(db, { id: data.id, unidade_id: U, data_pagamento: HOJE, hoje: HOJE }),
    pagarContaPagar(db, { id: data.id, unidade_id: U, data_pagamento: HOJE, hoje: HOJE }),
  ]);
  conferir("pagamento concorrente: exatamente um sucesso", [a, b].filter((x) => !x.error).length, 1);
}

// 6. estornar → 'pendente' + data nula, conta não é apagada
{
  const db = bancoFalso();
  const { data } = await criarContaPagar(db, valida);
  await pagarContaPagar(db, { id: data.id, unidade_id: U, data_pagamento: HOJE, hoje: HOJE });
  const r = await estornarContaPagar(db, { id: data.id, unidade_id: U });
  conferir("estornar: sem erro", r.error, null);
  conferir("estornar: status 'pendente'", db.linhas[0].status, "pendente");
  conferir("estornar: data_pagamento nula", db.linhas[0].data_pagamento, null);
  conferir("estornar: conta continua existindo", db.linhas.length, 1);
  const pendente = await estornarContaPagar(db, { id: data.id, unidade_id: U });
  conferir("estornar conta pendente: erro, nada muda", !!pendente.error, true);
}

// 7. estorno aceita grafias legadas de 'pago'
{
  const db = bancoFalso();
  db.linhas.push({ id: "leg", unidade_id: U, descricao: "antiga", valor: 10, status: "PAGA", data_pagamento: "2026-06-23" });
  const r = await estornarContaPagar(db, { id: "leg", unidade_id: U });
  conferir("estornar legado 'PAGA': ok", r.error, null);
}

// 8. editar → não muda status nem data_pagamento
{
  const db = bancoFalso();
  const { data } = await criarContaPagar(db, valida);
  await pagarContaPagar(db, { id: data.id, unidade_id: U, data_pagamento: "2026-09-29", hoje: HOJE });
  const r = await editarContaPagar(db, { id: data.id, unidade_id: U, ...valida, descricao: "Luz (corrigida)", valor: "400", status: "pendente", data_pagamento: null });
  conferir("editar: sem erro", r.error, null);
  conferir("editar: descrição alterada", db.linhas[0].descricao, "Luz (corrigida)");
  conferir("editar: continua paga", [db.linhas[0].status, db.linhas[0].data_pagamento], ["pago", "2026-09-29"]);
  conferir("editar: payload sem status/data_pagamento",
    Object.keys(db.chamadas.at(-1).payload).filter((k) => k === "status" || k === "data_pagamento"), []);
  const outra = await editarContaPagar(db, { ...valida, id: data.id, unidade_id: "outra-unidade" });
  conferir("editar em outra unidade: erro (0 linhas)", !!outra.error, true);
}

// 9. editar conta histórica 'cmv' mantém a categoria, sem permitir trocar PARA cmv
{
  const db = bancoFalso();
  db.linhas.push({ id: "h9", unidade_id: U, descricao: "Histórica", valor: 9, data_vencimento: "2026-07-15", categoria: "cmv", status: "pendente" });
  const r = await editarContaPagar(db, { id: "h9", unidade_id: U, categoriaAtual: "cmv", descricao: "Histórica", valor: 9, data_vencimento: "2026-07-15", categoria: "cmv" });
  conferir("editar histórica 'cmv' sem trocar categoria: ok", r.error, null);
  const v = validarCamposConta({ ...valida, categoria: "cmv" }, { categoriaAtual: "custo_fixo" });
  conferir("trocar categoria para 'cmv': bloqueado", v.ok, false);
}

// 10. falha do Supabase → erro, nunca sucesso
{
  const db = bancoFalso({ falharCom: "permission denied for table contas_pagar" });
  const c = await criarContaPagar(db, valida);
  conferir("falha no insert: erro repassado", c.error, "permission denied for table contas_pagar");
  conferir("falha no insert: sem data", c.data, null);
  const p = await pagarContaPagar(db, { id: "x", unidade_id: U, data_pagamento: HOJE, hoje: HOJE });
  conferir("falha no update: erro", !!p.error, true);
}

// 11. update que não afeta linha (RLS/unidade/id errado) é erro
{
  const db = bancoFalso();
  const r = await pagarContaPagar(db, { id: "nao-existe", unidade_id: U, data_pagamento: HOJE, hoje: HOJE });
  conferir("pagar id inexistente: erro", !!r.error, true);
}

// 12. unidade: nunca o UUID falso
conferir("UUID falso recusado", unidadeValida("00000000-0000-0000-0000-000000000001"), false);
conferir("seldeestrela aceita", unidadeValida("seldeestrela"), true);
{
  const db = bancoFalso();
  const r = await criarContaPagar(db, { ...valida, unidade_id: "00000000-0000-0000-0000-000000000001" });
  conferir("criar com UUID falso: bloqueado", !!r.error && db.chamadas.length === 0, true);
}

// 13. lote (fechamento de folha): tudo ou nada
{
  const db = bancoFalso();
  const r = await criarContasPagarEmLote(db, [
    { ...valida, descricao: "Salário A", categoria: "cmo" },
    { ...valida, descricao: "Salário B", categoria: "cmo", valor: 0 },
  ]);
  conferir("lote com item inválido: erro e nada gravado", [!!r.error, db.chamadas.length], [true, 0]);
  conferir("lote: erro cita o item", /Salário B/.test(r.error), true);
  const ok = await criarContasPagarEmLote(db, [{ ...valida, descricao: "Salário A", categoria: "cmo" }, { ...valida, descricao: "Salário C", categoria: "cmo" }]);
  conferir("lote válido: 2 contas pendentes", [ok.error, db.linhas.map((l) => l.status)], [null, ["pendente", "pendente"]]);
}

// 14. lançamento declarado pago (Manutenção): cria pendente e paga na data declarada
{
  const db = bancoFalso();
  const r = await lancarContaPagar(db, { ...valida, categoria: "manutencao", data_vencimento: "2026-09-20" }, { pagaEm: "2026-09-20" });
  conferir("manutenção paga: sem erro", [r.error, r.erroPagamento], [null, null]);
  conferir("manutenção paga: insert pendente, depois update pago", db.chamadas.map((c) => c.op), ["insert", "update"]);
  conferir("manutenção paga: estado final", [db.linhas[0].status, db.linhas[0].data_pagamento], ["pago", "2026-09-20"]);
}

// 15. leitura tolera legado; "vencida" é derivada da data
conferir("status 'PAGA' lido como pago", statusPersistido({ status: "PAGA" }), "pago");
conferir("status 'PENDENTE' lido como pendente", statusPersistido({ status: "PENDENTE" }), "pendente");
conferir("pendente com vencimento passado = vencida", situacaoConta({ status: "pendente", data_vencimento: "2026-06-23" }, HOJE), "vencida");
conferir("pago vencido continua pago", situacaoConta({ status: "pago", data_vencimento: "2026-06-23" }, HOJE), "pago");

// 16. abrir a tela não cria conta: a tela não chama geração de recorrentes
{
  const pagina = fs.readFileSync(new URL("../dashboard/financeiro/contas/page.js", import.meta.url), "utf8");
  conferir("tela de contas não chama gerarContasRecorrentes", /gerarContasRecorrentes/.test(pagina), false);
  const fin = fs.readFileSync(new URL("./financeiro.js", import.meta.url), "utf8");
  const corpo = fin.slice(fin.indexOf("export async function gerarContasRecorrentes"), fin.indexOf("export async function pagarConta"));
  conferir("gerarContasRecorrentes não grava nada", /\.insert\(|\.from\(/.test(corpo), false);
}

// 17. nenhum arquivo do fluxo usa o UUID falso de unidade
for (const arq of ["../dashboard/financeiro/contas/page.js", "../dashboard/financeiro/page.js", "./financeiro.js", "./contas-pagar.mjs", "./manutencao.js"]) {
  const src = fs.readFileSync(new URL(arq, import.meta.url), "utf8");
  conferir(`sem UUID falso em ${arq}`, src.includes("00000000-0000-0000-0000-000000000001"), false);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
