"use client";

// Boundary da RAIZ. É ele que pega o que quebra ANTES do dashboard montar --
// inclusive falha ao carregar o layout do próprio dashboard, porque erro num
// layout sobe para o boundary de cima, não para o irmão.
//
// Era aqui que caía o "Loading chunk ... layout-f67be.js failed": o
// app/dashboard/error.js já sabia se recuperar disso, mas nunca chegava a
// montar. A tela mostrava o stack cru e a pessoa ficava presa.

import { useEffect, useState } from "react";
import { ehErroDeChunk, deveRecarregar } from "./lib/erro-chunk.mjs";

export default function GlobalError({ error, reset }) {
  const versaoVelha = ehErroDeChunk(error);
  const [desistiu, setDesistiu] = useState(false);
  const [detalhes, setDetalhes] = useState(false);

  useEffect(() => {
    if (!versaoVelha) return;
    const armazem = typeof window === "undefined" ? null : window.sessionStorage;
    if (deveRecarregar(armazem)) window.location.reload();
    else setDesistiu(true);   // já tentou o bastante: mostra o botão
  }, [versaoVelha]);

  if (versaoVelha && !desistiu) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontWeight: 800, color: "#334155" }}>Atualizando o sistema...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24, background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 28, textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>
          {versaoVelha ? "Recarregue a página" : "Algo quebrou nesta tela"}
        </p>
        <p style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: "#475569", lineHeight: 1.5 }}>
          {versaoVelha
            ? "O sistema foi atualizado enquanto esta janela estava aberta e a versão antiga não conseguiu se recuperar sozinha."
            : "Recarregar costuma resolver. Se voltar a acontecer, me mande os detalhes abaixo."}
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 20, width: "100%", height: 46, borderRadius: 14, border: 0, background: "#047857", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
          Recarregar
        </button>
        <button
          onClick={() => { if (typeof reset === "function") reset(); else window.location.href = "/dashboard"; }}
          style={{ marginTop: 8, width: "100%", height: 44, borderRadius: 14, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 800, cursor: "pointer" }}>
          Tentar de novo sem recarregar
        </button>

        {/* O texto do erro continua acessível: é o que resolve o problema
            quando ele volta. Só não é a primeira coisa que a pessoa vê. */}
        <button onClick={() => setDetalhes(v => !v)}
          style={{ marginTop: 14, background: "none", border: 0, color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
          {detalhes ? "Esconder detalhes" : "Ver detalhes técnicos"}
        </button>
        {detalhes && (
          <pre style={{ marginTop: 10, textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, color: "#64748b", background: "#f1f5f9", borderRadius: 12, padding: 12, maxHeight: 220, overflow: "auto" }}>
            {error?.message || "Erro desconhecido"}
            {error?.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}
      </div>
    </div>
  );
}
