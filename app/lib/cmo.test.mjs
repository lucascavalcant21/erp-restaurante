// Testes do CMO. Rode com: node app/lib/cmo.test.mjs

import { folhaDoMes, diariasNoPeriodo, calcularCMO, pesoDoCMO } from "./cmo.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}
const r2 = (n) => Math.round(n * 100) / 100;

// ── Folha dos contratados ─────────────────────────────────────────────────
const EQUIPE = [
  { id: "1", salario: 1500, vale_alimentacao: 300 },
  { id: "2", salario: 1800 },
  { id: "3", salario: 130, tipo_contrato: "Freelancer" }, // extra nao entra na folha
  { id: "4", salario: 9999, status: "inativo" },          // inativo nao entra
  { id: "5", salario: 8888, ativo: false },               // desligado por flag
];
conferir("folha soma salario e vale dos contratados", folhaDoMes(EQUIPE), 3600);
conferir("extra fica fora da folha", folhaDoMes([{ salario: 130, tipo_contrato: "Freelancer" }]), 0);
conferir("inativo fica fora", folhaDoMes([{ salario: 5000, status: "inativo" }]), 0);
conferir("ativo:false fica fora", folhaDoMes([{ salario: 5000, ativo: false }]), 0);
conferir("lista vazia nao quebra", folhaDoMes([]), 0);
conferir("sem argumento nao quebra", folhaDoMes(), 0);

// ── Diarias dos extras ────────────────────────────────────────────────────
// So recibo PAGO vira custo realizado; o resto fica em aberto, separado.
const REF = new Date("2026-09-15T12:00:00");
const RECIBOS = [
  { data_pagamento: "2026-09-02", valor_total: 130, pagamento_realizado: true },
  { data_pagamento: "2026-09-10", valor_total: 150, pagamento_realizado: true },
  { data_trabalho: "2026-09-12", valor_total: 200, pagamento_realizado: false }, // em aberto
  { data_pagamento: "2026-08-20", valor_total: 999, pagamento_realizado: true },  // outro mes
];
const d = diariasNoPeriodo(RECIBOS, REF, "mes");
conferir("soma so os recibos pagos do mes", d.total, 280);
conferir("o que nao foi pago fica em aberto", d.aberto, 200);
conferir("conta os recibos pagos", d.recibos, 2);
conferir("recibo de outro mes nao entra", d.total, 280);
conferir("sem recibos nao quebra", diariasNoPeriodo([], REF, "mes").total, 0);

// ── CMO do periodo ────────────────────────────────────────────────────────
const cmo = calcularCMO({ colaboradores: EQUIPE, recibos: RECIBOS, referencia: REF, modo: "mes" });
conferir("cmo = folha + diarias pagas", cmo.total, 3880);
conferir("folha do mes cheia no modo mes", cmo.folha, 3600);
conferir("extras em aberto aparecem separados", cmo.extrasEmAberto, 200);

// Num recorte menor que o mes a folha entra proporcional aos dias: contratado
// custa o mes inteiro, entao cobrar tudo numa semana distorceria o resultado.
const semana = calcularCMO({ colaboradores: EQUIPE, recibos: [], referencia: REF, modo: "semana" });
conferir("recorte menor rateia a folha", semana.folha < cmo.folha, "true");
conferir("folha do mes continua visivel no recorte", semana.folhaMes, 3600);

// ── Peso sobre o faturamento ──────────────────────────────────────────────
conferir("cmo sobre faturamento", r2(pesoDoCMO(4000, 20000)), 20);
// Sem faturamento nao existe porcentagem: devolver 0 diria "CMO zero", que e
// o contrario da verdade.
conferir("sem faturamento nao inventa porcentagem", pesoDoCMO(4000, 0), null);
conferir("faturamento negativo tambem nao", pesoDoCMO(4000, -5), null);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
