// Testes do layout do AFD. Rode com: node app/lib/afd-layout.test.mjs
//
// O que estes casos protegem: arquivo de posição fixa quebra em silêncio. Um
// campo com um caractere a mais desloca todos os seguintes e a fiscalização
// recusa o arquivo inteiro — sem que nada pareça errado ao olho.

import {
  alfa, num, dataHoraAFD, dataAFD, crc16,
  registro1, registro7, registro9, linhaAssinatura, montarAFD, nomeArquivoAFD,
} from "./afd-layout.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}

// ── Preenchimento dos campos (Anexo V, item 8) ─────────────────────────────
conferir("alfa completa com espaco a direita", alfa("AB", 5), "AB   ");
conferir("alfa corta no tamanho", alfa("ABCDEFG", 3), "ABC");
conferir("num completa com zero a esquerda", num("123", 6), "000123");
conferir("num descarta nao-digito", num("123.456.789-01", 12), "000012345678901".slice(-12));
conferir("num mantem os digitos finais quando estoura", num("9".repeat(15), 12), "9".repeat(12));

// ── Data e hora (Anexo V, item 6) ──────────────────────────────────────────
conferir("data e hora no formato do anexo",
  dataHoraAFD("2026-08-21T18:40:00.000Z"), "2026-08-21T15:40:00-0300");
conferir("virada da meia-noite mantem o dia local",
  dataHoraAFD("2026-08-22T02:30:00.000Z"), "2026-08-21T23:30:00-0300");
conferir("data simples", dataAFD("2026-08-01T00:00:00Z"), "2026-08-01");

// ── CRC-16/CCITT-FALSE ─────────────────────────────────────────────────────
// Vetor de referência conhecido: "123456789" → 0x29B1.
conferir("crc16 do vetor de referencia", crc16("123456789"), "29B1");
conferir("crc16 sempre com 4 caracteres", crc16("A").length, 4);

// ── Registro tipo 1 — cabeçalho ────────────────────────────────────────────
const cab = registro1({
  identificador: "42.021.920/0001-36",
  razaoSocial: "SELDEESTRELA",
  identificadorRep: "12345678901234567",
  dataInicial: "2026-08-01",
  dataFinal: "2026-08-31",
  geradoEm: "2026-08-21T18:40:00.000Z",
  identDesenvolvedor: "42021920000136",
});
conferir("cabecalho tem 302 caracteres", cab.length, 302);
conferir("cabecalho comeca com nove zeros", cab.slice(0, 9), "000000000");
conferir("tipo do registro na posicao 10", cab.slice(9, 10), "1");
conferir("cnpj nas posicoes 12-25", cab.slice(11, 25), "42021920000136");
conferir("razao social nas posicoes 40-189", cab.slice(39, 189).trimEnd(), "SELDEESTRELA");
conferir("data inicial nas posicoes 207-216", cab.slice(206, 216), "2026-08-01");
conferir("data final nas posicoes 217-226", cab.slice(216, 226), "2026-08-31");
conferir("geracao nas posicoes 227-250", cab.slice(226, 250), "2026-08-21T15:40:00-0300");
conferir("versao do leiaute nas posicoes 251-253", cab.slice(250, 253), "003");

// ── Registro tipo 7 — marcação do REP-P ────────────────────────────────────
const marc = registro7({
  nsr: 42,
  marcadoEm: "2026-08-21T18:40:00.000Z",
  cpf: "123.456.789-01",
  gravadoEm: "2026-08-21T18:40:03.000Z",
  coletor: "02",
  online: "0",
  hash: "a".repeat(64),
});
conferir("marcacao tem 137 caracteres", marc.length, 137);
conferir("NSR nas posicoes 1-9", marc.slice(0, 9), "000000042");
conferir("tipo do registro na posicao 10", marc.slice(9, 10), "7");
conferir("marcacao nas posicoes 11-34", marc.slice(10, 34), "2026-08-21T15:40:00-0300");
conferir("cpf nas posicoes 35-46", marc.slice(34, 46), "012345678901");
conferir("gravacao nas posicoes 47-70", marc.slice(46, 70), "2026-08-21T15:40:00-0300");
conferir("coletor nas posicoes 71-72", marc.slice(70, 72), "02");
conferir("online na posicao 73", marc.slice(72, 73), "0");
conferir("hash nas posicoes 74-137", marc.slice(73, 137), "a".repeat(64));

// ── Registro tipo 9 — trailer ──────────────────────────────────────────────
const tr = registro9({ tipo7: 128 });
conferir("trailer tem 64 caracteres", tr.length, 64);
conferir("trailer comeca com nove noves", tr.slice(0, 9), "999999999");
conferir("quantidade de marcacoes nas posicoes 55-63", tr.slice(54, 63), "000000128");
conferir("trailer termina em 9", tr.slice(63, 64), "9");

// ── Assinatura e arquivo completo ──────────────────────────────────────────
conferir("assinatura tem 100 caracteres", linhaAssinatura("").length, 100);

const arquivo = montarAFD({ cabecalho: cab, marcacoes: [marc, marc] });
const linhas = arquivo.split("\r\n").filter(l => l.length);
conferir("arquivo tem cabecalho + 2 marcacoes + trailer + assinatura", linhas.length, 5);
conferir("todas as linhas terminam em CRLF", arquivo.endsWith("\r\n"), "true");
conferir("nenhuma linha em branco", arquivo.split("\r\n").slice(0, -1).every(l => l.length > 0), "true");
conferir("trailer conta as duas marcacoes", linhas[3].slice(54, 63), "000000002");

conferir("nome do arquivo segue o padrao REP_P",
  nomeArquivoAFD({ identificadorRep: "12345678901234567", identificador: "42.021.920/0001-36" }),
  "AFD1234567890123456742021920000136REP_P.txt");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
