// Testes das frases do ponto no RH. São a linguagem que o dono lê todo dia —
// se uma delas mentir sobre intervalo ou encerramento, vira problema
// trabalhista, não bug de tela.
import { situacaoDoPonto, atestadoNaData, esperaEntreBatidasMs, TOM } from "./ponto-status.mjs";

const hoje = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

let falhas = 0;
function conferir(nome, recebido, esperado) {
  const ok = recebido === esperado;
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}`);
  if (!ok) console.log(`      esperado: ${esperado}\n      recebido: ${recebido}`);
}

// Sem registro nenhum
conferir("sem registro", situacaoDoPonto(null).texto, "Ainda não bateu o ponto de entrada");
conferir("registro vazio", situacaoDoPonto({}).texto, "Ainda não bateu o ponto de entrada");

// Entrou e está trabalhando
const so_entrada = situacaoDoPonto({ hora_entrada: hoje("08:05") });
conferir("só entrada", so_entrada.texto, "Bateu o ponto de entrada às 08:05");
conferir("só entrada · tom", so_entrada.tom, TOM.TRABALHANDO);

// Saiu para o intervalo
conferir("em intervalo", situacaoDoPonto({
  hora_entrada: hoje("08:05"), hora_saida_intervalo: hoje("12:00"),
}).texto, "Está em intervalo.");

// Voltou do intervalo
conferir("voltou do intervalo", situacaoDoPonto({
  hora_entrada: hoje("08:05"), hora_saida_intervalo: hoje("12:00"), hora_retorno_intervalo: hoje("13:02"),
}).texto, "Voltou do intervalo às 13:02 e está trabalhando");

// Encerrou o dia tendo tirado intervalo
conferir("encerrou com intervalo", situacaoDoPonto({
  hora_entrada: hoje("08:05"), hora_saida_intervalo: hoje("12:00"),
  hora_retorno_intervalo: hoje("13:02"), hora_saida: hoje("17:30"),
}).texto, "Finalizou o trabalho às 17:30");

// Encerrou sem nenhum intervalo — o caso que o RH precisa enxergar
const semIntervalo = situacaoDoPonto({ hora_entrada: hoje("08:05"), hora_saida: hoje("17:30") });
conferir("encerrou sem intervalo", semIntervalo.texto, "Finalizou o trabalho às 17:30 · não tirou intervalo");
conferir("encerrou sem intervalo · sinal", String(semIntervalo.semIntervalo), "true");

// ── Atestado ───────────────────────────────────────────────────────────────
// O que importa aqui: atestado nunca pode virar falta, nem quando não há
// nenhuma batida no dia — falta desconta e atestado não.
const atestado3dias = [{ data_inicio: "2026-08-13", data_fim: "2026-08-15", parcial: false }];

conferir("dia sem batida com atestado", situacaoDoPonto(null, {
  atestado: atestadoNaData(atestado3dias, "2026-08-14"),
}).texto, "Atestado médico");

conferir("atestado tem tom proprio", situacaoDoPonto(null, {
  atestado: atestadoNaData(atestado3dias, "2026-08-14"),
}).tom, TOM.ATESTADO);

conferir("primeiro dia do periodo", String(!!atestadoNaData(atestado3dias, "2026-08-13")), "true");
conferir("ultimo dia do periodo", String(!!atestadoNaData(atestado3dias, "2026-08-15")), "true");
conferir("vespera fica de fora", String(atestadoNaData(atestado3dias, "2026-08-12")), "null");
conferir("dia seguinte fica de fora", String(atestadoNaData(atestado3dias, "2026-08-16")), "null");

// Atestado parcial: a pessoa trabalhou e saiu no meio. O dia continua contando
// pelas batidas — o documento fica registrado, mas não apaga a jornada.
const parcial = [{ data_inicio: "2026-08-13", data_fim: "2026-08-13", parcial: true }];
conferir("parcial nao cobre o dia", String(atestadoNaData(parcial, "2026-08-13")), "null");
conferir("parcial mantem a jornada", situacaoDoPonto(
  { hora_entrada: hoje("15:40"), hora_saida_intervalo: hoje("17:26"), hora_retorno_intervalo: hoje("18:26"), hora_saida: hoje("23:59") },
  { atestado: atestadoNaData(parcial, "2026-08-13") },
).texto, "Finalizou o trabalho às 23:59");


// ── Trava contra batida duplicada ──────────────────────────────────────────
// O defeito real: o segundo toque chega antes de a tela atualizar, o sistema
// avanca de etapa e grava o MESMO instante no campo seguinte. Foi assim que
// Andrey e Cedeine perderam o intervalo inteiro.
const t = (hhmm) => `2026-08-27T${hhmm}:00-03:00`;

conferir("sem registro, pode bater", esperaEntreBatidasMs(null, t("15:40")), 0);
conferir("registro vazio, pode bater", esperaEntreBatidasMs({}, t("15:40")), 0);

conferir("segundo toque no mesmo instante e barrado",
  esperaEntreBatidasMs({ hora_entrada: t("15:40") }, t("15:40")), 60000);

conferir("um segundo depois ainda e barrado",
  esperaEntreBatidasMs({ hora_entrada: t("15:40") }, t("15:40").replace(":00-03", ":01-03")), 59000);

conferir("passado o minuto, libera",
  esperaEntreBatidasMs({ hora_entrada: t("15:40") }, t("15:41")), 0);

conferir("olha a marcacao mais recente, nao a primeira",
  esperaEntreBatidasMs(
    { hora_entrada: t("15:40"), hora_saida_intervalo: t("16:40") },
    t("16:40")), 60000);

conferir("intervalo de verdade passa",
  esperaEntreBatidasMs(
    { hora_entrada: t("15:40"), hora_saida_intervalo: t("16:40") },
    t("17:40")), 0);

// Relogio do aparelho atrasado poe a batida anterior no futuro. Trancar o
// ponto de alguem por causa disso seria pior que o bug que a trava conserta.
conferir("batida anterior no futuro nao tranca ninguem",
  esperaEntreBatidasMs({ hora_entrada: t("16:00") }, t("15:40")), 0);

conferir("hora invalida nao tranca ninguem",
  esperaEntreBatidasMs({ hora_entrada: t("15:40") }, "isso nao e data"), 0);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);