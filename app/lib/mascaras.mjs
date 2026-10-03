// Máscaras dos documentos do cadastro.
//
// Todas são "progressivas": formatam o que já foi digitado sem exigir o campo
// completo, e nunca travam a digitação. Quem digita CPF no tablet não pode ver
// o cursor pular ou o campo recusar o número no meio.
//
// Módulo puro, com teste: máscara errada não quebra a tela — ela grava o dado
// torto e ninguém percebe até precisar do documento.

const digitos = (v) => String(v ?? "").replace(/\D/g, "");

// 000.000.000-00
export function mascaraCPF(valor) {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// RG não tem formato nacional único: o tamanho varia por estado. Agrupamos de
// três em três a partir da esquerda e o dígito final vai depois do traço, que é
// como a maioria dos órgãos emite. Letras (alguns RGs terminam em X) passam.
export function mascaraRG(valor) {
  const bruto = String(valor ?? "").toUpperCase().replace(/[^0-9X]/g, "").slice(0, 9);
  if (bruto.length <= 2) return bruto;
  const corpo = bruto.slice(0, -1);
  const fim = bruto.slice(-1);
  const grupos = corpo.match(/.{1,3}/g) || [];
  return `${grupos.join(".")}-${fim}`;
}

// (00) 0000-0000 para fixo, (00) 00000-0000 para celular.
export function mascaraTelefone(valor) {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Só os números, para guardar ou comparar.
export const somenteDigitos = digitos;

// Confere o CPF pelos dígitos verificadores. Não bloqueia nada sozinho: serve
// para avisar quem digitou errado, porque CPF trocado só aparece na hora de
// emitir documento — normalmente meses depois.
export function cpfValido(valor) {
  const d = digitos(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // 111.111.111-11 e afins
  const calc = (ate) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

// CPF (11 dígitos) ou CNPJ (14): fornecedor pode ser um ou outro. Passou de
// 11 dígitos, vira CNPJ: 00.000.000/0000-00.
export function mascaraCpfCnpj(valor) {
  const d = digitos(valor).slice(0, 14);
  if (d.length <= 11) return mascaraCPF(d);
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ─── Número com vírgula automática ──────────────────────────────────────────
// Como no app do banco: só entram dígitos e a vírgula fica sempre antes das
// `casas` últimas. Digitar 1, 9, 3 mostra 0,01 → 0,19 → 1,93; apagar tira o
// último dígito (1,93 → 0,19) e, sem dígito nenhum, o campo fica vazio. Assim
// a vírgula nunca some no meio do número (antes, apagar perto dela virava 193).

const MAX_DIGITOS = 13;

/**
 * Lê um número escrito de qualquer jeito que chega aos campos: 1.93 (ponto do
 * banco), "1,93", "1.234,56". Com vírgula, o ponto é milhar; sem vírgula, o
 * ponto é decimal. Vazio ou inválido = NaN.
 */
export function lerDecimal(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;
  const s = String(valor ?? "").trim().replace(/\s|R\$|%/g, "");
  if (!s) return NaN;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : NaN;
}

const milhar = (inteiro) => inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Dígitos → "inteiro" e "fração" com `casas` na fração (zeros à esquerda fora).
function partes(digitosTexto, casas) {
  const d = digitos(digitosTexto).replace(/^0+/, "").slice(0, MAX_DIGITOS);
  if (!d) return null;
  const cheio = d.padStart(casas + 1, "0");
  return { inteiro: cheio.slice(0, cheio.length - casas) || "0", fracao: casas ? cheio.slice(-casas) : "" };
}

/**
 * O que o campo MOSTRA para um valor guardado: 1.93 → "1,93"; 1234.5 → "1.234,50".
 * Vazio/nulo/inválido → "" (o placeholder aparece). Zero → "0,00".
 */
export function mascaraDecimal(valor, casas = 2) {
  if (valor === "-") return "-"; // começou a digitar um negativo
  const n = lerDecimal(valor);
  if (!Number.isFinite(n)) return "";
  const negativo = n < 0;
  const [int, frac = ""] = Math.abs(n).toFixed(casas).split(".");
  const corpo = casas ? `${milhar(int)},${frac}` : int;
  return negativo ? `-${corpo}` : corpo;
}

/**
 * O que o campo DEVOLVE quando a pessoa digita: os dígitos do que está escrito
 * viram o número com a vírgula no lugar. saida "ponto" = "1234.56" (o que um
 * campo type=number devolvia); "virgula" = "1234,56" (o que se digitava num
 * campo de texto). Sem dígitos = "".
 */
export function digitosParaDecimal(texto, casas = 2, saida = "ponto", negativo = false) {
  // Campo que aceita negativo (offset, saldo): um "-" em qualquer lugar vira o
  // sinal; apagar o "-" volta a positivo.
  const sinal = negativo && String(texto ?? "").includes("-") ? "-" : "";
  const p = partes(texto, casas);
  if (!p) return sinal;
  if (!casas) return sinal + p.inteiro;
  return `${sinal}${p.inteiro}${saida === "virgula" ? "," : "."}${p.fracao}`;
}

/** Valor colado (ex.: "R$ 1.234,5" ou "12.5") → mesma saída do digitado. */
export function coladoParaDecimal(texto, casas = 2, saida = "ponto", negativo = false) {
  const n = lerDecimal(texto);
  if (!Number.isFinite(n) || (n < 0 && !negativo)) return null;
  const s = n.toFixed(casas);
  return saida === "virgula" ? s.replace(".", ",") : s;
}
