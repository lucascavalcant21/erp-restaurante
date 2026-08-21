// Montagem do Arquivo Eletrônico de Jornada (AEJ) — Portaria MTP 671/2021,
// Anexo VI. É a saída do Programa de Tratamento de Registro de Ponto (art. 82):
// as marcações do AFD já tratadas, com o horário contratual, as ausências e o
// banco de horas.
//
// Diferente do AFD, aqui os campos são separados por "|" e têm tamanho
// variável — mas a ORDEM é fixa e os campos de data, hora e CPF têm tamanho
// exato. Módulo puro para poder ser testado sem banco.

export const VERSAO_LEIAUTE_AEJ = "001";

const D = (v) => String(v ?? "").slice(0, 10);
export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// "AAAA-MM-ddThh:mm:00ZZZZZ", mesmo formato do AFD.
export function dataHoraAEJ(valor, fusoMin = -180) {
  const d = new Date(valor);
  const local = new Date(d.getTime() + fusoMin * 60000);
  const p = (n) => String(n).padStart(2, "0");
  const sinal = fusoMin < 0 ? "-" : "+";
  const abs = Math.abs(fusoMin);
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:00` +
    `${sinal}${p(Math.floor(abs / 60))}${p(abs % 60)}`;
}

// "hhmm"
export const horaAEJ = (hhmm) => soDigitos(hhmm).slice(0, 4).padStart(4, "0");

// O "|" separa campos: se ele aparecer dentro de um nome, o arquivo inteiro
// desalinha a partir dali. Vira espaço.
const limpo = (v, max) => String(v ?? "").replace(/\|/g, " ").slice(0, max);

const linha = (...campos) => campos.join("|");

// ── Registro 01 — cabeçalho ────────────────────────────────────────────────
export const registro01 = ({
  tpIdtEmpregador = "1", idtEmpregador, caepf = "", cno = "",
  razaoOuNome, dataInicial, dataFinal, geradoEm,
}) => linha("01", tpIdtEmpregador, soDigitos(idtEmpregador), soDigitos(caepf), soDigitos(cno),
  limpo(razaoOuNome, 150), D(dataInicial), D(dataFinal), dataHoraAEJ(geradoEm), VERSAO_LEIAUTE_AEJ);

// ── Registro 02 — REPs utilizados ──────────────────────────────────────────
// tpRep: 1 REP-C, 2 REP-A, 3 REP-P.
export const registro02 = ({ idRepAej = 1, tpRep = "3", nrRep }) =>
  linha("02", String(idRepAej), String(tpRep), soDigitos(nrRep).padStart(17, "0"));

// ── Registro 03 — vínculos ─────────────────────────────────────────────────
export const registro03 = ({ idtVinculoAej, cpf, nomeEmp }) =>
  linha("03", String(idtVinculoAej), soDigitos(cpf).padStart(11, "0"), limpo(nomeEmp, 150));

// ── Registro 04 — horário contratual ───────────────────────────────────────
// durJornada em MINUTOS, já considerando a hora noturna reduzida quando o
// turno for noturno — é o que o Anexo VI pede na observação 3.
export const registro04 = ({ codHorContratual, durJornada, pares }) =>
  linha("04", limpo(codHorContratual, 30), String(Math.round(durJornada)),
    ...pares.flatMap(([entrada, saida]) => [horaAEJ(entrada), horaAEJ(saida)]));

// ── Registro 05 — marcações ────────────────────────────────────────────────
// tpMarc: E entrada, S saída, D desconsiderada.
// fonteMarc: O original do REP, I incluída manualmente, P pré-assinalada,
//            X ponto por exceção, T outras fontes.
export const registro05 = ({
  idtVinculoAej, dataHoraMarc, idRepAej = 1, tpMarc, seqEntSaida,
  fonteMarc = "O", codHorContratual = "", motivo = "",
}) => linha("05", String(idtVinculoAej), dataHoraAEJ(dataHoraMarc), String(idRepAej),
  tpMarc, String(seqEntSaida).padStart(3, "0"), fonteMarc,
  limpo(codHorContratual, 30), limpo(motivo, 150));

// ── Registro 07 — ausências e banco de horas ───────────────────────────────
// tipoAusenOuComp: 1 DSR, 2 falta não justificada, 3 movimento no banco de
// horas, 4 folga compensatória de feriado.
// tipoMovBH: 1 inclusão no banco, 2 compensação.
export const registro07 = ({ idtVinculoAej, tipo, data, qtMinutos = "", tipoMovBH = "" }) =>
  linha("07", String(idtVinculoAej), String(tipo), D(data),
    qtMinutos === "" ? "" : String(Math.round(qtMinutos)),
    tipoMovBH === "" ? "" : String(tipoMovBH));

// ── Registro 08 — identificação do programa de tratamento ──────────────────
export const registro08 = ({
  nomeProg, versaoProg, tpIdtDesenv = "1", idtDesenv, razaoNomeDesenv, emailDesenv,
}) => linha("08", limpo(nomeProg, 150), limpo(versaoProg, 8), tpIdtDesenv,
  soDigitos(idtDesenv), limpo(razaoNomeDesenv, 150), limpo(emailDesenv, 50));

// ── Registro 99 — trailer ──────────────────────────────────────────────────
export const registro99 = (contagem) =>
  linha("99", ...["01", "02", "03", "04", "05", "06", "07", "08"]
    .map(t => String(contagem[t] || 0)));

export const linhaAssinaturaAEJ = (assinatura = "") =>
  String(assinatura ?? "").slice(0, 100).padEnd(100, " ");

// Junta tudo, contando os registros para o trailer. Cada linha termina em CRLF.
export function montarAEJ({ registros, assinatura = "" }) {
  const contagem = {};
  for (const l of registros) {
    const t = l.slice(0, 2);
    contagem[t] = (contagem[t] || 0) + 1;
  }
  const linhas = [...registros, registro99(contagem), linhaAssinaturaAEJ(assinatura)];
  return linhas.join("\r\n") + "\r\n";
}

export const nomeArquivoAEJ = ({ identificador, inicio, fim }) =>
  `AEJ${soDigitos(identificador)}_${D(inicio)}_a_${D(fim)}.txt`;
