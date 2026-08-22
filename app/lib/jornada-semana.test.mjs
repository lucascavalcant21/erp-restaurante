// Testes do resumo da jornada da semana.
// Rode com: node app/lib/jornada-semana.test.mjs

import { horarioDoDia, trechosDaSemana, linhasJornadaSemana, resumoJornadaSemana } from "./jornada-semana.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}

// ── Caso da casa: terça a domingo, tudo igual ──────────────────────────────
const garcom = {
  dias_trabalho: "0,2,3,4,5,6",
  horario_entrada: "15:40", horario_saida: "00:00",
};
conferir("terca a domingo vira um trecho so",
  resumoJornadaSemana(garcom), "Terça a domingo: 15:40 às 00:00");

// ── Domingo com horário próprio ────────────────────────────────────────────
const chefe = {
  dias_trabalho: "0,2,3,4,5,6",
  horario_entrada: "15:40", horario_saida: "00:00",
  horario_dom_entrada: "09:00", horario_dom_saida: "17:20",
};
conferir("domingo diferente se separa",
  resumoJornadaSemana(chefe), "Terça a sábado: 15:40 às 00:00 · Domingo: 09:00 às 17:20");
conferir("duas linhas quando o domingo difere", linhasJornadaSemana(chefe).length, 2);

// ── A semana começa na segunda: sem isso, domingo abriria a lista ──────────
conferir("domingo vem por ultimo, nao primeiro",
  trechosDaSemana(chefe)[1].dias.join(","), "0");
conferir("primeiro trecho comeca na terca",
  trechosDaSemana(chefe)[0].dias.join(","), "2,3,4,5,6");

// ── Dias salteados não podem virar intervalo ───────────────────────────────
const salteado = {
  dias_trabalho: "2,4",
  horario_entrada: "15:40", horario_saida: "00:00",
};
conferir("terca e quinta nao viram 'terca a quinta'",
  resumoJornadaSemana(salteado), "Terça: 15:40 às 00:00 · Quinta: 15:40 às 00:00");

// ── Dois dias seguidos usam "e" ────────────────────────────────────────────
const doisDias = {
  dias_trabalho: "5,6",
  horario_entrada: "18:00", horario_saida: "02:00",
};
conferir("dois dias seguidos usam 'e'",
  resumoJornadaSemana(doisDias), "Sexta e sábado: 18:00 às 02:00");

// ── Semana inteira ─────────────────────────────────────────────────────────
const todoDia = { dias_trabalho: "0,1,2,3,4,5,6", horario_entrada: "08:00", horario_saida: "17:00" };
conferir("semana inteira vai de segunda a domingo",
  resumoJornadaSemana(todoDia), "Segunda a domingo: 08:00 às 17:00");

// ── Sem dias_trabalho: assume que trabalha todos ───────────────────────────
conferir("sem dias_trabalho assume a semana toda",
  resumoJornadaSemana({ horario_entrada: "09:00", horario_saida: "18:00" }),
  "Segunda a domingo: 09:00 às 18:00");

// ── Sem horário cadastrado não inventa nada ────────────────────────────────
conferir("sem horario devolve vazio", resumoJornadaSemana({ dias_trabalho: "2,3" }), "");
conferir("colaborador nulo devolve vazio", resumoJornadaSemana(null), "");
conferir("dia que nao trabalha devolve null", horarioDoDia(garcom, 1), "null");

// ── Formatos frouxos do cadastro ───────────────────────────────────────────
conferir("aceita hora sem dois-pontos",
  resumoJornadaSemana({ dias_trabalho: "2", horario_entrada: "1540", horario_saida: "0000" }),
  "Terça: 15:40 às 00:00");
conferir("aceita hora com segundos",
  resumoJornadaSemana({ dias_trabalho: "2", horario_entrada: "15:40:00", horario_saida: "00:00:00" }),
  "Terça: 15:40 às 00:00");
conferir("aceita espacos em dias_trabalho",
  resumoJornadaSemana({ dias_trabalho: " 2 , 3 ", horario_entrada: "15:40", horario_saida: "00:00" }),
  "Terça e quarta: 15:40 às 00:00");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
