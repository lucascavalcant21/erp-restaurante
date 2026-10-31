"use client";

import s from "./ui.module.css";

// Escolha entre poucas opções lado a lado (Aqui | Viagem, Entrega | Retirada).
// `tom` da opção escolhida: "branco" (cartão branco com sombra, delivery) ou
// "principal" (verde com texto branco, tablet). `leve` = opções não
// escolhidas em cinza médio e peso normal (como no início do delivery).
export default function Segmentado({ opcoes = [], valor, onMudar, tom = "branco", leve = false, rotulo, largura, className = "" }) {
  return (
    <div role="group" aria-label={rotulo} className={`${s.segmentado} ${leve ? s.segmentadoLeve : ""} ${className}`} style={largura ? { width: largura } : undefined}>
      {opcoes.map((o) => {
        const sel = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={sel}
            className={`${s.segmento} ${sel ? (tom === "principal" ? s.segmentoPrincipal : s.segmentoBranco) : ""}`}
            onClick={() => onMudar?.(o.id)}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
