"use client";

import s from "./ui.module.css";

// Quantidade (– n +). Controlado: quem guarda o número é a tela. Abaixo do
// mínimo o "–" fica apagado; no carrinho a tela passa min={0} e trata o 0 como
// "remover o item".
export default function Quantidade({ valor, onMudar, min = 1, max = 99, pequeno = false, nomeItem = "", className = "" }) {
  const n = Number(valor) || 0;
  const sufixo = nomeItem ? ` ${nomeItem}` : "";
  return (
    <div className={`${s.quantidade} ${pequeno ? s.quantidadeP : ""} ${className}`} role="group" aria-label={`Quantidade${sufixo}`}>
      <button type="button" className={`${s.quantidadeBotao} ${s.pressiona}`} aria-label={`Diminuir${sufixo}`} disabled={n <= min} onClick={() => onMudar?.(Math.max(min, n - 1))}>−</button>
      <span className={s.quantidadeValor} aria-live="polite">{n}</span>
      <button type="button" className={`${s.quantidadeBotao} ${s.pressiona}`} aria-label={`Aumentar${sufixo}`} disabled={n >= max} onClick={() => onMudar?.(Math.min(max, n + 1))}>+</button>
    </div>
  );
}
