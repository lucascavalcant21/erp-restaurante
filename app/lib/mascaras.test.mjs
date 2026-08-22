// Testes das máscaras do cadastro. Rode com: node app/lib/mascaras.test.mjs

import { mascaraCPF, mascaraRG, mascaraTelefone, somenteDigitos, cpfValido } from "./mascaras.mjs";

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

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
