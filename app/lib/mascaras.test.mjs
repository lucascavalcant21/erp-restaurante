// Testes das máscaras do cadastro. Rode com: node app/lib/mascaras.test.mjs

import { mascaraCPF, mascaraRG, mascaraTelefone, somenteDigitos, cpfValido, mascaraCpfCnpj, lerDecimal, mascaraDecimal, digitosParaDecimal, coladoParaDecimal } from "./mascaras.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)})`}`);
}

// ── CPF ────────────────────────────────────────────────────────────────────
conferir("cpf completo", mascaraCPF("12345678901"), "123.456.789-01");
conferir("cpf formata enquanto digita (3)", mascaraCPF("123"), "123");
conferir("cpf formata enquanto digita (4)", mascaraCPF("1234"), "123.4");
conferir("cpf formata enquanto digita (7)", mascaraCPF("1234567"), "123.456.7");
conferir("cpf ignora o que ja esta formatado", mascaraCPF("123.456.789-01"), "123.456.789-01");
conferir("cpf corta o que passa de 11", mascaraCPF("123456789012345"), "123.456.789-01");
conferir("cpf vazio nao vira pontuacao solta", mascaraCPF(""), "");
conferir("cpf de valor nulo", mascaraCPF(null), "");

// ── Telefone ───────────────────────────────────────────────────────────────
conferir("celular com 11 digitos", mascaraTelefone("91988887777"), "(91) 98888-7777");
conferir("fixo com 10 digitos", mascaraTelefone("9132221111"), "(91) 3222-1111");
conferir("abre o parentese no DDD", mascaraTelefone("91"), "(91");
conferir("DDD e comeco do numero", mascaraTelefone("9198"), "(91) 98");
conferir("telefone vazio", mascaraTelefone(""), "");
conferir("telefone ja formatado nao duplica", mascaraTelefone("(91) 98888-7777"), "(91) 98888-7777");

// ── RG ─────────────────────────────────────────────────────────────────────
conferir("rg de 8 digitos", mascaraRG("1234567"), "123.456-7");
conferir("rg com digito X", mascaraRG("123456X"), "123.456-X");
conferir("rg curto nao ganha traco", mascaraRG("12"), "12");
conferir("rg ignora letras que nao sejam X", mascaraRG("1234567 PC/PA"), "123.456-7");

// ── Utilitários ────────────────────────────────────────────────────────────
conferir("somenteDigitos limpa a mascara", somenteDigitos("123.456.789-01"), "12345678901");

// CPF real de teste (dígitos verificadores corretos).
conferir("cpf valido reconhecido", cpfValido("529.982.247-25"), "true");
conferir("cpf com digito errado recusado", cpfValido("529.982.247-26"), "false");
conferir("cpf de digitos repetidos recusado", cpfValido("111.111.111-11"), "false");
conferir("cpf incompleto recusado", cpfValido("529.982.247"), "false");

// ── CPF ou CNPJ ──────────────────────────────────────────────────────────────
conferir("até 11 dígitos é CPF", mascaraCpfCnpj("12345678901"), "123.456.789-01");
conferir("passou de 11 vira CNPJ", mascaraCpfCnpj("123456789012"), "12.345.678/9012");
conferir("cnpj completo", mascaraCpfCnpj("12345678000199"), "12.345.678/0001-99");
conferir("cnpj já formatado não duplica", mascaraCpfCnpj("12.345.678/0001-99"), "12.345.678/0001-99");

// ── Vírgula automática ───────────────────────────────────────────────────────
// Digitando 1, 9, 3 (cada passo é o que o campo tem + o dígito novo)
let tela = "";
const passos = [];
for (const tecla of ["1", "9", "3"]) { tela = mascaraDecimal(digitosParaDecimal(tela + tecla)); passos.push(tela); }
conferir("digitando 1, 9, 3", passos.join(" → "), "0,01 → 0,19 → 1,93");
// Apagar: o navegador tira o último caractere de "1,93" → "1,9"
conferir("apagar de 1,93 volta para 0,19 (não vira 193)", mascaraDecimal(digitosParaDecimal("1,9")), "0,19");
conferir("apagar até o fim esvazia", digitosParaDecimal("0,0"), "");
conferir("apagar a vírgula não junta os números", mascaraDecimal(digitosParaDecimal("193")), "1,93");
conferir("saída ponto (como o type=number)", digitosParaDecimal("1.234,56"), "1234.56");
conferir("saída vírgula (como o campo de texto)", digitosParaDecimal("1.234,56", 2, "virgula"), "1234,56");
conferir("três casas para kg", [digitosParaDecimal("8350", 3), mascaraDecimal(8.35, 3)].join(" | "), "8.350 | 8,350");
conferir("zero à esquerda some", digitosParaDecimal("0,005"), "0.05");
conferir("letras são ignoradas", digitosParaDecimal("1a9b3"), "1.93");
conferir("sem casas (inteiro)", digitosParaDecimal("0012", 0), "12");

conferir("mostra milhar e duas casas", mascaraDecimal(1234.5), "1.234,50");
conferir("mostra milhão", mascaraDecimal("1234567.89"), "1.234.567,89");
conferir("mostra o que veio com vírgula", mascaraDecimal("1,5"), "1,50");
conferir("vazio mostra vazio (placeholder)", mascaraDecimal(""), "");
conferir("nulo mostra vazio", mascaraDecimal(null), "");
conferir("zero mostra 0,00", mascaraDecimal(0), "0,00");
conferir("arredonda o que tem casas a mais", mascaraDecimal(1.005 + 0.0001), "1,01");

conferir("lê ponto decimal", lerDecimal("1.93"), "1.93");
conferir("lê vírgula", lerDecimal("1,93"), "1.93");
conferir("lê milhar com vírgula", lerDecimal("1.234,56"), "1234.56");
conferir("lê R$", lerDecimal("R$ 12,50"), "12.5");
conferir("inválido é NaN", Number.isNaN(lerDecimal("abc")), "true");

conferir("colar 12.5 vira 12,50 (não 1,25)", coladoParaDecimal("12.5"), "12.50");
conferir("colar R$ 1.234,5", coladoParaDecimal("R$ 1.234,5", 2, "virgula"), "1234,50");
conferir("colar texto não muda", coladoParaDecimal("abc"), "null");

// Negativo (só onde o campo permite)
conferir("sem permissão, o menos some", digitosParaDecimal("-1,93"), "1.93");
conferir("com permissão, o menos vira sinal", digitosParaDecimal("-1,93", 2, "ponto", true), "-1.93");
conferir("menos digitado no fim também vale", digitosParaDecimal("1,93-", 2, "ponto", true), "-1.93");
conferir("só o menos fica esperando o número", [digitosParaDecimal("-", 1, "ponto", true), mascaraDecimal("-", 1)].join(" | "), "- | -");
conferir("depois do menos, o primeiro dígito", mascaraDecimal(digitosParaDecimal("-5", 1, "ponto", true), 1), "-0,5");
conferir("mostra negativo", mascaraDecimal(-2.5, 1), "-2,5");
conferir("colar negativo só onde pode", [coladoParaDecimal("-3,5"), coladoParaDecimal("-3,5", 1, "ponto", true)].map(String).join(" | "), "null | -3.5");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
