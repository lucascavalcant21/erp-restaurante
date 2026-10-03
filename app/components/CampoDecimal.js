"use client";

// Campo de número com vírgula automática (regras em lib/mascaras.mjs): a pessoa
// só digita os números e a vírgula se põe sozinha, como no CPF e no telefone.
// 1 → 0,01 → 0,19 → 1,93; apagar volta um dígito (1,93 → 0,19).
//
// Troca direta de <input type="number"> e de <input inputMode="decimal">: o
// onChange recebe { target: { value, name, type } } com o valor em "1234.56",
// o formato do type=number — e que todos os leitores do sistema aceitam
// (Number, parseFloat e os parsers com vírgula). saida="virgula" devolve
// "1234,56" para quem precisar.
// casas = casas depois da vírgula (2 para R$ e %, 3 para kg e litro).
// negativo = aceita sinal de menos (offset de impressora, saldo de conta).

import { forwardRef } from "react";
import { mascaraDecimal, digitosParaDecimal, coladoParaDecimal } from "../lib/mascaras.mjs";

const CampoDecimal = forwardRef(function CampoDecimal(
  { value, onChange, onPaste, casas = 2, saida = "ponto", negativo = false, name, min, max, step, type, inputMode, ...resto },
  ref,
) {
  // type "number" porque quem tratava o campo antigo às vezes pergunta isso
  // (if (type === "number") Number(value)) — o valor continua sendo texto. Só
  // o "-" sozinho (negativo começando) vai como texto, senão viraria NaN.
  const emitir = (valor) => {
    const incompleto = valor === "" || valor === "-";
    const alvo = { value: valor, name, type: valor === "-" ? "text" : "number", valueAsNumber: incompleto ? NaN : Number(valor) };
    onChange?.({ target: alvo, currentTarget: alvo });
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode={negativo ? "text" : "numeric"}
      autoComplete="off"
      {...resto}
      name={name}
      value={mascaraDecimal(value, casas)}
      onChange={(e) => emitir(digitosParaDecimal(e.target.value, casas, saida, negativo))}
      onPaste={(e) => {
        onPaste?.(e);
        const colado = coladoParaDecimal(e.clipboardData?.getData("text"), casas, saida, negativo);
        if (colado == null) return;
        e.preventDefault();
        emitir(colado);
      }}
    />
  );
});

export default CampoDecimal;
