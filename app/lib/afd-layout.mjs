// Montagem do Arquivo Fonte de Dados (AFD) — Portaria MTP 671/2021, Anexo V.
//
// Módulo puro para poder ser testado sem banco: arquivo de posição fixa é
// exatamente o tipo de código onde um caractere a mais passa despercebido no
// olho e invalida o arquivo inteiro na fiscalização.
//
// Regras do Anexo V que estão implementadas aqui:
//  · registros ordenados por NSR;
//  · preenchimento pela esquerda, sobra preenchida com espaço (campos A) —
//    campos numéricos vão com zero à esquerda;
//  · cada linha termina em CR LF; sem linhas em branco;
//  · registros tipo 1 a 5 levam CRC-16 do próprio registro;
//  · registro tipo 7 (marcação do REP-P) leva o hash SHA-256 encadeado;
//  · texto no padrão ASCII da ISO 8859-1.

export const VERSAO_LEIAUTE_AFD = "003";

// Campos alfanuméricos: alinhados à esquerda, completados com espaço.
export const alfa = (valor, tamanho) =>
  String(valor ?? "").normalize("NFC").slice(0, tamanho).padEnd(tamanho, " ");

// Campos numéricos: zero à esquerda.
export const num = (valor, tamanho) =>
  String(valor ?? "").replace(/\D/g, "").slice(-tamanho).padStart(tamanho, "0");

export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// "AAAA-MM-ddThh:mm:00ZZZZZ" — ex.: 2026-08-21T15:40:00-0300.
export function dataHoraAFD(valor, fusoMin = -180) {
  const d = new Date(valor);
  const local = new Date(d.getTime() + fusoMin * 60000);
  const p = (n, t = 2) => String(n).padStart(t, "0");
  const sinal = fusoMin < 0 ? "-" : "+";
  const abs = Math.abs(fusoMin);
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:00` +
    `${sinal}${p(Math.floor(abs / 60))}${p(abs % 60)}`;
}

// "AAAA-MM-dd"
export const dataAFD = (valor) => String(valor).slice(0, 10);

// CRC-16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF) — o mesmo usado no AFD
// desde a Portaria 1510/2009. O Anexo V diz apenas "CRC-16"; se o validador do
// contador recusar, é esta variante que se troca, e só ela.
export function crc16(texto) {
  let crc = 0xFFFF;
  for (let i = 0; i < texto.length; i++) {
    crc ^= (texto.charCodeAt(i) & 0xFF) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// ── Registro tipo 1 — cabeçalho (302 caracteres) ───────────────────────────
export function registro1({
  tipoIdentificador = "1", identificador, caepfCno = "", razaoSocial,
  identificadorRep, dataInicial, dataFinal, geradoEm,
  tipoIdentDesenvolvedor = "1", identDesenvolvedor = "", modelo = "",
}) {
  const corpo =
    num("0", 9) +
    "1" +
    String(tipoIdentificador) +
    num(identificador, 14) +
    num(caepfCno, 14) +
    alfa(razaoSocial, 150) +
    num(identificadorRep, 17) +
    dataAFD(dataInicial) +
    dataAFD(dataFinal) +
    dataHoraAFD(geradoEm) +
    VERSAO_LEIAUTE_AFD +
    String(tipoIdentDesenvolvedor) +
    num(identDesenvolvedor, 14) +
    alfa(modelo, 30);
  return corpo + alfa(crc16(corpo), 4);
}

// ── Registro tipo 7 — marcação de ponto do REP-P (137 caracteres) ──────────
// Sem CRC: aqui a integridade é o hash encadeado, que já vem calculado do
// banco. Recalcular na exportação anularia o encadeamento.
export function registro7({ nsr, marcadoEm, cpf, gravadoEm, coletor = "02", online = "0", hash }) {
  return (
    num(nsr, 9) +
    "7" +
    dataHoraAFD(marcadoEm) +
    num(cpf, 12) +
    dataHoraAFD(gravadoEm) +
    num(coletor, 2) +
    String(online === "1" ? "1" : "0") +
    alfa(hash, 64)
  );
}

// ── Registro tipo 9 — trailer (64 caracteres) ──────────────────────────────
export function registro9({ tipo2 = 0, tipo3 = 0, tipo4 = 0, tipo5 = 0, tipo6 = 0, tipo7 = 0 }) {
  return (
    "999999999" +
    num(tipo2, 9) + num(tipo3, 9) + num(tipo4, 9) +
    num(tipo5, 9) + num(tipo6, 9) + num(tipo7, 9) +
    "9"
  );
}

// A assinatura digital do arquivo (100 posições). Exige certificado ICP-Brasil
// da desenvolvedora (art. 88) — enquanto não houver, vai em branco e o arquivo
// serve para conferência, não para entrega.
export const linhaAssinatura = (assinatura = "") => alfa(assinatura, 100);

// Nome do arquivo, REP-P: "AFD" + registro INPI + CNPJ/CPF + "REP_P".
export const nomeArquivoAFD = ({ identificadorRep, identificador }) =>
  `AFD${soDigitos(identificadorRep)}${soDigitos(identificador)}REP_P.txt`;

// Junta tudo. Cada linha termina em CR LF, conforme o item 3 do Anexo V.
export function montarAFD({ cabecalho, marcacoes, assinatura = "" }) {
  const linhas = [cabecalho, ...marcacoes];
  linhas.push(registro9({ tipo7: marcacoes.length }));
  linhas.push(linhaAssinatura(assinatura));
  return linhas.join("\r\n") + "\r\n";
}
