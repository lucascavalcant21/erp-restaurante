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
