"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { fazerLogin, homeDoPapel, formatarParaEmailFantasma } from "../lib/auth";
import { loginAcesso, salvarAcessoLocal, limparAcessoLocal, resolverAcesso } from "../lib/acessos";

// Guarda/recupera as credenciais lembradas (só neste aparelho).
function guardarCred(email, senha, lembrar) {
  try {
    if (lembrar) {
      localStorage.setItem("erp_lembrar", "1");
      localStorage.setItem("erp_cred", btoa(unescape(encodeURIComponent(JSON.stringify({ email, senha })))));
    } else {
      localStorage.setItem("erp_lembrar", "0");
      localStorage.removeItem("erp_cred");
    }
  } catch (_) {}
}
function lerCred() {
  try {
    if (localStorage.getItem("erp_lembrar") !== "1") return null;
    const raw = localStorage.getItem("erp_cred");
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch (_) { return null; }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const autoTentou = useRef(false);

  // Núcleo do login (usado no botão e no auto-login).
  async function entrar(em, se, lembrarAgora) {
    setLoading(true); setErro("");
    // 1) Acesso por módulo (login criado pelo master em Configurações).
    const acesso = await loginAcesso(em, se);
    if (acesso) {
      salvarAcessoLocal(acesso);
      guardarCred(em, se, lembrarAgora);
      router.push(resolverAcesso(acesso.modulo).home || "/dashboard");
      return true;
    }
    // 2) Login normal (master/papéis) via Supabase Auth.
    limparAcessoLocal();
    const r = await fazerLogin(formatarParaEmailFantasma(em), se);
    if (!r.ok) { setErro(r.erro); setLoading(false); return false; }
    guardarCred(em, se, lembrarAgora);
    router.push(homeDoPapel(r.usuario.papel));
    return true;
  }

  // Ao abrir: preenche e-mail/senha lembrados e já entra sozinho (entra rápido
  // e evita ficar refazendo login quando a sessão cai).
  useEffect(() => {
    const c = lerCred();
    if (!c) return;
    if (c.email) setEmail(c.email);
    if (c.senha) setSenha(c.senha);
    if (c.email && c.senha && !autoTentou.current) {
      autoTentou.current = true;
      entrar(c.email, c.senha, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !senha) { setErro("Preencha o usuário e a senha."); return; }
    await entrar(email, senha, lembrar);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-5 py-6" style={{ background: "var(--surface)" }}>
      <div className="mb-8 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>Hefisto</p>
        <p className="text-sm font-medium mt-0.5" style={{ color: "var(--dim)" }}>Gestão inteligente para food service</p>
      </div>

      <form onSubmit={handleLogin} className="w-full max-w-sm erp-card p-5 sm:p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Entrar</h1>
          <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Acesse sua conta para continuar.</p>
        </div>

        <div>
          <label className="erp-label block mb-1.5">Usuário ou E-mail</label>
          <input type="text" autoComplete="username" value={email} placeholder="Ex: seldeestrela ou seu@email.com"
            onChange={(e) => { setEmail(e.target.value); setErro(""); }} className="erp-input" />
        </div>

        <div>
          <label className="erp-label block mb-1.5">Senha</label>
          <div className="relative">
            <input type={ver ? "text" : "password"} autoComplete="current-password" value={senha} placeholder="Sua senha"
              onChange={(e) => { setSenha(e.target.value); setErro(""); }} className="erp-input" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dim)" }}>
              {ver ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[12px] font-medium cursor-pointer" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
            Lembrar e entrar automático
          </label>
          <button type="button" onClick={() => router.push("/recuperar")} className="text-[12px] font-bold" style={{ color: "var(--accent-fg)" }}>
            Esqueci minha senha
          </button>
        </div>

        {erro && <p className="erp-badge erp-badge-danger w-full justify-center">{erro}</p>}

        <button type="submit" disabled={loading} className="erp-btn erp-btn-primary w-full !h-12 disabled:opacity-60">
          {loading ? "Entrando..." : <><LogIn size={16} /> Entrar</>}
        </button>
      </form>

      <p className="text-sm font-medium mt-6" style={{ color: "var(--muted)" }}>
        Ainda não tem conta?{" "}
        <button onClick={() => router.push("/cadastro")} className="font-bold" style={{ color: "var(--accent-fg)" }}>Cadastre-se</button>
      </p>
    </div>
  );
}
