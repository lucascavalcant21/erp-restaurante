// Testes da folga de domingo: o domingo do mês passado tem que aparecer (e
// poder ser lançado), e o aviso tem que dizer o que muda antes de gravar.
import { domingosParaFolga, folgasDeDomingoNoMes, avisosDaFolga, ehDomingo, nomeDoMes } from "./folgas-domingo.mjs";

let falhas = 0;
function conferir(nome, recebido, esperado) {
  const ok = JSON.stringify(recebido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (recebido ${JSON.stringify(recebido)}, esperado ${JSON.stringify(esperado)})`}`);
}

// Hoje: sábado, 03/10/2026
const meses = domingosParaFolga("2026-10-03");
conferir("meses oferecidos", meses.map((m) => [m.anoMes, m.relativo]), [["2026-09", "mês passado"], ["2026-10", "este mês"], ["2026-11", ""]]);
conferir("todos os domingos de setembro", meses[0].domingos.map((d) => d.data), ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
conferir("setembro inteiro já passou", meses[0].domingos.every((d) => d.passou), true);
conferir("outubro: domingos e o que passou", meses[1].domingos.map((d) => [d.label, d.passou]), [["04/10", false], ["11/10", false], ["18/10", false], ["25/10", false]]);
conferir("à frente, os mesmos 5 próximos domingos de antes", meses.slice(1).flatMap((m) => m.domingos.map((d) => d.data)), ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01"]);
conferir("rótulo do mês", meses[0].rotulo, "setembro/2026");

// Domingo de hoje não conta como passado
const noDomingo = domingosParaFolga("2026-10-04");
conferir("domingo de hoje não passou", noDomingo[1].domingos.find((d) => d.data === "2026-10-04").passou, false);
// No meio do mês, os domingos de antes de hoje continuam na lista, marcados como passados
const meioDoMes = domingosParaFolga("2026-10-15");
conferir("meio do mês: domingos já passados ficam", meioDoMes[1].domingos.map((d) => [d.label, d.passou]), [["04/10", true], ["11/10", true], ["18/10", false], ["25/10", false]]);

// Virada de ano: em janeiro, o mês passado é dezembro do ano anterior
const janeiro = domingosParaFolga("2027-01-10");
conferir("janeiro oferece dezembro", [janeiro[0].anoMes, janeiro[0].relativo, janeiro[0].domingos[0].data], ["2026-12", "mês passado", "2026-12-06"]);

conferir("domingo", [ehDomingo("2026-09-13"), ehDomingo("2026-09-14")], [true, false]);
conferir("nome do mês", nomeDoMes("2026-03"), "março/2026");

// Uma por mês
const folgas = [{ data_folga: "2026-09-13" }, { data_folga: "2026-09-16" }, { data_folga: "2026-10-11T00:00:00" }];
conferir("folgas de domingo de setembro (quarta não conta)", folgasDeDomingoNoMes(folgas, "2026-09"), ["2026-09-13"]);
conferir("outubro com data em timestamp", folgasDeDomingoNoMes(folgas, "2026-10"), ["2026-10-11"]);

// Avisos
const hora = (iso) => iso.slice(11, 16);
conferir("domingo futuro sem nada: grava direto", avisosDaFolga({ data: "2026-10-18", hoje: "2026-10-03", folgas: [] }), []);
const retro = avisosDaFolga({ data: "2026-09-20", hoje: "2026-10-03", nome: "Welligton Furquim Silvero", folgas: [] });
conferir("retroativa avisa e diz o mês do espelho", retro, ["20/09 já passou: é uma folga retroativa. O espelho de setembro/2026 passa a mostrar a folga nesse dia."]);
const comPonto = avisosDaFolga({ data: "2026-09-20", hoje: "2026-10-03", nome: "Larissa", pontoDoDia: { hora_entrada: "2026-09-20T15:40:00" }, horaLocal: hora });
conferir("ponto batido no dia avisa (sem prometer folga no espelho)", comPonto, ["20/09 já passou: é uma folga retroativa.", "Larissa bateu ponto nesse dia (entrada 15:40). Com ponto batido, o espelho continua mostrando o dia como trabalhado."]);
const segunda = avisosDaFolga({ data: "2026-09-27", hoje: "2026-10-03", nome: "Eduarda de Lima", folgas });
conferir("segunda folga de domingo no mês avisa", segunda[1], "Eduarda já tem folga de domingo em setembro/2026 (13/09). A regra é uma por mês.");
conferir("a própria data não conta como outra", avisosDaFolga({ data: "2026-09-13", hoje: "2026-09-01", folgas }), []);
conferir("dia de semana não cobra a regra do domingo", avisosDaFolga({ data: "2026-10-07", hoje: "2026-10-03", folgas }), []);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
