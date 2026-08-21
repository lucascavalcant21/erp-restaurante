// Testes do layout do AEJ. Rode com: node app/lib/aej-layout.test.mjs

import {
  dataHoraAEJ, horaAEJ, registro01, registro02, registro03, registro04,
  registro05, registro07, registro08, registro99, montarAEJ, nomeArquivoAEJ,
} from "./aej-layout.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}
const campos = (l) => l.split("|");

conferir("data e hora no formato do anexo",
  dataHoraAEJ("2026-08-21T18:40:00.000Z"), "2026-08-21T15:40:00-0300");
conferir("hora em hhmm", horaAEJ("15:40"), "1540");
conferir("hora meia-noite", horaAEJ("00:00"), "0000");

// ── Registro 01 ────────────────────────────────────────────────────────────
const r01 = registro01({
  idtEmpregador: "42.021.920/0001-36",
  razaoOuNome: "SELDEESTRELA",
  dataInicial: "2026-08-01", dataFinal: "2026-08-31",
  geradoEm: "2026-08-21T18:40:00.000Z",
});
conferir("cabecalho tem 10 campos", campos(r01).length, 10);
conferir("tipo do registro", campos(r01)[0], "01");
conferir("cnpj so com digitos", campos(r01)[2], "42021920000136");
conferir("razao social", campos(r01)[5], "SELDEESTRELA");
conferir("versao do leiaute", campos(r01)[9], "001");

// ── Registro 02 ────────────────────────────────────────────────────────────
const r02 = registro02({ idRepAej: 1, tpRep: "3", nrRep: "12345" });
conferir("REP-P com nrRep em 17 posicoes", campos(r02)[3], "00000000000012345");
conferir("tipo do REP", campos(r02)[2], "3");

// ── Registro 03 ────────────────────────────────────────────────────────────
const r03 = registro03({ idtVinculoAej: 1, cpf: "123.456.789-01", nomeEmp: "ALICE T V XAVIER" });
conferir("cpf com 11 digitos", campos(r03)[2], "12345678901");
conferir("nome do empregado", campos(r03)[3], "ALICE T V XAVIER");

// Pipe dentro do nome desalinharia o arquivo inteiro a partir dali.
conferir("pipe no nome vira espaco",
  campos(registro03({ idtVinculoAej: 1, cpf: "1", nomeEmp: "A|B" }))[3], "A B");
conferir("pipe no nome nao cria campo extra",
  campos(registro03({ idtVinculoAej: 1, cpf: "1", nomeEmp: "A|B" })).length, 4);

// ── Registro 04 ────────────────────────────────────────────────────────────
const r04 = registro04({
  codHorContratual: "1540-0000-INT60", durJornada: 440,
  pares: [["15:40", "17:00"], ["18:00", "00:00"]],
});
conferir("horario contratual tem 7 campos", campos(r04).length, 7);
conferir("duracao da jornada em minutos", campos(r04)[2], "440");
conferir("primeiro par entrada/saida", `${campos(r04)[3]}-${campos(r04)[4]}`, "1540-1700");
conferir("segundo par entrada/saida", `${campos(r04)[5]}-${campos(r04)[6]}`, "1800-0000");

// ── Registro 05 ────────────────────────────────────────────────────────────
const r05 = registro05({
  idtVinculoAej: 1, dataHoraMarc: "2026-08-21T18:40:00.000Z",
  tpMarc: "E", seqEntSaida: 1, codHorContratual: "1540-0000-INT60",
});
conferir("marcacao tem 9 campos", campos(r05).length, 9);
conferir("tipo da marcacao", campos(r05)[4], "E");
conferir("sequencia com 3 digitos", campos(r05)[5], "001");
conferir("fonte padrao e original do REP", campos(r05)[6], "O");
conferir("horario contratual na primeira entrada", campos(r05)[7], "1540-0000-INT60");

const r05i = registro05({
  idtVinculoAej: 1, dataHoraMarc: "2026-08-21T18:40:00.000Z",
  tpMarc: "S", seqEntSaida: 2, fonteMarc: "I", motivo: "Correcao de batida",
});
conferir("marcacao incluida manualmente leva motivo", campos(r05i)[8], "Correcao de batida");

// ── Registro 07 ────────────────────────────────────────────────────────────
conferir("DSR sem minutos",
  registro07({ idtVinculoAej: 1, tipo: 1, data: "2026-08-03" }), "07|1|1|2026-08-03||");
conferir("banco de horas leva minutos e tipo de movimento",
  registro07({ idtVinculoAej: 1, tipo: 3, data: "2026-08-05", qtMinutos: 24, tipoMovBH: 1 }),
  "07|1|3|2026-08-05|24|1");

// ── Registro 08 ────────────────────────────────────────────────────────────
const r08 = registro08({
  nomeProg: "Hefisto", versaoProg: "1.0", idtDesenv: "42021920000136",
  razaoNomeDesenv: "SELDEESTRELA", emailDesenv: "rh@seldeestrela.com.br",
});
conferir("identificacao do programa tem 7 campos", campos(r08).length, 7);
conferir("nome do programa", campos(r08)[1], "Hefisto");

// ── Trailer e arquivo completo ─────────────────────────────────────────────
const arquivo = montarAEJ({ registros: [r01, r02, r03, r04, r05, r05i, r08] });
const linhas = arquivo.split("\r\n").filter(l => l.length);
conferir("arquivo tem 7 registros + trailer + assinatura", linhas.length, 9);

const tr = campos(linhas[7]);
conferir("trailer conta 1 cabecalho", tr[1], "1");
conferir("trailer conta 1 REP", tr[2], "1");
conferir("trailer conta 1 vinculo", tr[3], "1");
conferir("trailer conta 1 horario contratual", tr[4], "1");
conferir("trailer conta 2 marcacoes", tr[5], "2");
conferir("trailer conta 0 matriculas eSocial", tr[6], "0");
conferir("trailer conta 0 ausencias", tr[7], "0");
conferir("trailer conta 1 identificacao de programa", tr[8], "1");

conferir("assinatura tem 100 caracteres", linhas[8].length, 100);
conferir("arquivo termina em CRLF", arquivo.endsWith("\r\n"), "true");
conferir("nenhuma linha em branco",
  arquivo.split("\r\n").slice(0, -1).every(l => l.length > 0), "true");

conferir("nome do arquivo",
  nomeArquivoAEJ({ identificador: "42.021.920/0001-36", inicio: "2026-08-01", fim: "2026-08-31" }),
  "AEJ42021920000136_2026-08-01_a_2026-08-31.txt");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
