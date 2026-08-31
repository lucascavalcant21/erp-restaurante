"use client";

// Boundary do dashboard: pega o que quebra DENTRO de uma tela. O que falha no
// layout do próprio dashboard sobe para app/error.js, que trata igual.

import { useEffect, useState } from "react";
import { ehErroDeChunk, deveRecarregar } from "../lib/erro-chunk.mjs";

export default function DashboardError({ error, reset }) {
  const versaoVelha = ehErroDeChunk(error);
  const [desistiu, setDesistiu] = useState(false);

  useEffect(() => {
    if (!versaoVelha) return;
    const armazem = typeof window === "undefined" ? null : window.sessionStorage;
    // A contagem vive no sessionStorage e limita as tentativas: recarregar em
    // laço deixa a tela piscando para sempre, o que é pior que a falha.
    if (deveRecarregar(armazem)) window.location.reload();
    else setDesistiu(true);
  }, [versaoVelha]);

  if (versaoVelha && !desistiu) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <p className="text-sm font-black" style={{ color: "var(--muted)" }}>Atualizando o sistema...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="erp-card w-full max-w-md p-8 text-center shadow-2xl">
        <p className="text-lg font-black" style={{ color: "var(--fg)" }}>
          {versaoVelha ? "Recarregue a página" : "Algo quebrou nesta tela"}
        </p>
        <p className="mt-2 break-words rounded-lg p-3 text-xs font-medium"
           style={{ color: "var(--danger-strong)", background: "var(--danger-soft)" }}>
          {versaoVelha
            ? "O sistema foi atualizado enquanto esta janela estava aberta e a versão antiga não conseguiu se recuperar sozinha."
            : String(error?.message || error || "Erro desconhecido")}
        </p>
        <p className="mt-3 text-[11px] font-medium" style={{ color: "var(--dim)" }}>
          {versaoVelha
            ? "Recarregar traz a versão nova."
            : "Se o erro continuar, recarregue a página ou mande a mensagem acima para o suporte."}
        </p>
        <button onClick={() => window.location.reload()} className="erp-btn erp-btn-primary mt-5 w-full font-bold">
          Recarregar
        </button>
        <button onClick={() => { if (typeof reset === "function") reset(); else window.location.href = "/dashboard"; }}
                className="erp-btn erp-btn-ghost mt-2 w-full">
          Tentar de novo sem recarregar
        </button>
      </div>
    </div>
  );
}
