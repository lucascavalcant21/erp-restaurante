"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { recuperarSenha } from "../lib/auth";

export default function RecuperarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleEnviar(e) {
    e.preventDefault();
    if (!email) { setErro("Informe seu e-mail."); return; }
    setLoading(true); setErro("");
    const r = await recuperarSenha(email);
    setLoading(false);
    if (!r.ok) { setErro(r.erro); return; }
    setEnviado(true);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-sm erp-card p-6 space-y-4">
        <button onClick={() => router.push("/login")} className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--dim)" }}>
          <ArrowLeft size={14} /> Voltar ao login
        </button>

        {enviado ? (
          <div className="flex flex-col items-center text-center gap-2 py-4">
            <CheckCircle size={40} style={{ color: "var(--accent-fg)" }} />
            <p className="text-base font-bold" style={{ color: "var(--fg)" }}>E-mail enviado!</p>
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
              Enviamos um link de redefinição para <b style={{ color: "var(--fg-soft)" }}>{email}</b>. Abra o e-mail e clique no link para criar uma nova senha.
            </p>
            <button onClick={() => router.push("/login")} className="erp-btn erp-btn-ghost w-full mt-2">Voltar</button>
          </div>
        ) : (
          <form onSubmit={handleEnviar} className="space-y-4">
            <div className="flex flex-col items-center text-center gap-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1" style={{ background: "var(--accent-soft)" }}>
                <Mail size={22} style={{ color: "var(--accent-fg)" }} />
              </div>
              <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Recuperar senha</h1>
              <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Informe seu e-mail e enviaremos um link para redefinir.</p>
            </div>
            <div>
              <label className="erp-label block mb-1.5">E-mail</label>
              <input type="email" autoComplete="email" value={email} placeholder="seu@email.com"
                onChange={(e) => { setEmail(e.target.value); setErro(""); }} className="erp-input" />
            </div>
            {erro && <p className="erp-badge erp-badge-danger w-full justify-center">{erro}</p>}
            <button type="submit" disabled={loading} className="erp-btn erp-btn-primary w-full !h-12 disabled:opacity-60">
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
