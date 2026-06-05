"use client";

export default function GlobalError({ error }) {
  return (
    <div style={{ padding: 32, fontFamily: "monospace", background: "#fff1f1", minHeight: "100vh" }}>
      <h2 style={{ color: "#cc0000", marginBottom: 8 }}>Erro detectado</h2>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#333" }}>
        {error?.message || "Erro desconhecido"}
        {"\n\n"}
        {error?.stack || ""}
      </pre>
    </div>
  );
}
