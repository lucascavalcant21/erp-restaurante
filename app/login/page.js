"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fazerLogin } from "../lib/auth";

// ── Ícones ────────────────────────────────────────────────────
const IcEye = ({ open }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    {open
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
    }
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [senha, setSenha]     = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro]       = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !senha) { setErro("Preencha todos os campos."); return; }
    setLoading(true);
    setErro("");

    // Simula latência de rede
    await new Promise((r) => setTimeout(r, 600));

    const result = fazerLogin(email, senha);
    if (!result.ok) {
      setErro(result.erro);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#fbf9f5] flex flex-col items-center justify-center px-5">

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-[#10b981] flex items-center justify-center shadow-lg mb-4">
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <p className="text-2xl font-black text-neutral-900 tracking-tight">Cerebro ERP</p>
        <p className="text-sm text-neutral-400 font-medium mt-0.5">Gestão inteligente para food service</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-neutral-100 p-6">
        <h1 className="text-xl font-black text-neutral-900 mb-1">Entrar</h1>
        <p className="text-sm text-neutral-400 font-medium mb-6">Acesse sua conta para continuar.</p>

        <form onSubmit={handleLogin} className="space-y-4">

          {/* E-mail */}
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide block mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErro(""); }}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition-all"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide block mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={verSenha ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setErro(""); }}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 pr-11 text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setVerSenha(!verSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 active:text-neutral-600"
              >
                <IcEye open={verSenha} />
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <p className="text-xs font-semibold text-red-600">{erro}</p>
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#10b981] text-white text-sm font-bold shadow-sm active:bg-[#059669] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Entrando...
              </>
            ) : "Entrar"}
          </button>
        </form>
      </div>

      {/* Link cadastro */}
      <p className="text-sm text-neutral-500 font-medium mt-6">
        Ainda não tem conta?{" "}
        <button
          onClick={() => router.push("/cadastro")}
          className="text-[#10b981] font-bold"
        >
          Cadastre-se
        </button>
      </p>

    </div>
  );
}
