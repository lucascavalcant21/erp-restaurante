"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { redefinirSenha } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function NovaSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [temSessao, setTemSessao] = useState(null); // null = verificando

  // O link do e-mail traz um token de recuperação; o Supabase cria a sessão.
  useEffect(() => {
    if (!supabase) { setTemSessao(false); return; }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setTemSessao(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setTemSessao((prev) => prev ?? !!data?.session);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  async function handleSalvar(e) {
    e.preventDefault();
    if (senha.length < 6) { setErro("A senha precisa ter ao menos 6 caracteres."); return; }
    if (senha !== confirma) { setErro("As senhas não conferem."); return; }
    setLoading(true); setErro("");
    const r = await redefinirSenha(senha);
    setLoading(false);
    if (!r.ok) { setErro(r.erro); return; }
    setPronto(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-sm erp-card p-6 space-y-4">
        {pronto ? (
          <div className="flex flex-col items-center text-center gap-2 py-4">
            <CheckCircle size={40} style={{ color: "var(--accent-fg)" }} />
            <p className="text-base font-bold" style={{ color: "var(--fg)" }}>Senha alterada!</p>
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>Você já pode entrar com a nova senha. Redirecionando...</p>
          </div>
        ) : temSessao === false ? (
          <div className="flex flex-col items-center text-center gap-2 py-4">
            <p className="text-base font-bold" style={{ color: "var(--fg)" }}>Link inválido ou expirado</p>
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>Solicite um novo link de redefinição.</p>
            <button onClick={() => router.push("/recuperar")} className="erp-btn erp-btn-primary w-full mt-2">Pedir novo link</button>
          </div>
        ) : (
          <form onSubmit={handleSalvar} className="space-y-4">
            <div className="flex flex-col items-center text-center gap-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1" style={{ background: "var(--accent-soft)" }}>
                <Lock size={22} style={{ color: "var(--accent-fg)" }} />
              </div>
              <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Nova senha</h1>
              <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Crie uma nova senha para sua conta.</p>
            </div>
            <div>
              <label className="erp-label block mb-1.5">Nova senha</label>
              <div className="relative">
                <input type={ver ? "text" : "password"} autoComplete="new-password" value={senha} placeholder="Mínimo 6 caracteres"
                  onChange={(e) => { setSenha(e.target.value); setErro(""); }} className="erp-input" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dim)" }}>
                  {ver ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="erp-label block mb-1.5">Confirmar senha</label>
              <input type={ver ? "text" : "password"} autoComplete="new-password" value={confirma} placeholder="Repita a senha"
                onChange={(e) => { setConfirma(e.target.value); setErro(""); }} className="erp-input" />
            </div>
            {erro && <p className="erp-badge erp-badge-danger w-full justify-center">{erro}</p>}
            <button type="submit" disabled={loading} className="erp-btn erp-btn-primary w-full !h-12 disabled:opacity-60">
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
