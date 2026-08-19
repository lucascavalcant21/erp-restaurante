// Testes das frases do ponto no RH. São a linguagem que o dono lê todo dia —
// se uma delas mentir sobre intervalo ou encerramento, vira problema
// trabalhista, não bug de tela.
import { situacaoDoPonto, TOM } from "./ponto-status.mjs";

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

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
