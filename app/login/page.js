"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { fazerLogin, homeDoUsuario, formatarParaEmailFantasma, lerSessao } from "../lib/auth";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

// Guarda somente o nome de usuário. A senha e os tokens ficam a cargo do
// armazenamento seguro do Supabase Auth; nunca mais são copiados para o app.
function guardarCred(email, lembrar) {
  try {
    if (lembrar) {
      localStorage.setItem("erp_lembrar", "1");
      localStorage.setItem("erp_cred", JSON.stringify({ email }));
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
    try { return JSON.parse(raw); } catch {
      // Remove o formato antigo, que continha senha codificada em base64.
      localStorage.removeItem("erp_cred");
      return null;
    }
  } catch (_) { return null; }
}

function deviceId() {
  try {
    let id = localStorage.getItem("hefisto_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("hefisto_device_id", id);
    }
    return id;
  } catch { return ""; }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  // Núcleo do login. Todos os tipos de usuário usam a mesma autenticação.
  async function entrar(em, se, lembrarAgora) {
    setLoading(true); setErro("");
    const idAparelho = deviceId();
    const policy = await fetch("/api/auth/policy", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: em, event: "precheck", deviceId: idAparelho }),
    }).then((response) => response.json()).catch(() => ({ ok: true }));
    if (!policy.ok) {
      setErro(policy.error || "Usuário ou senha incorretos.");
      setLoading(false);
      return false;
    }
    const r = await fazerLogin(formatarParaEmailFantasma(em), se);
    if (!r.ok) {
      await fetch("/api/auth/policy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: em, event: "failure", deviceId: idAparelho }),
      }).catch(() => null);
      setErro(r.erro); setLoading(false); return false;
    }
    guardarCred(em, lembrarAgora);
    const { data } = await supabase.auth.getSession();
    await fetch("/api/auth/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
      body: JSON.stringify({ deviceId: idAparelho }),
    }).catch(() => null);
    router.push(r.usuario?.must_change_password ? "/nova-senha?obrigatoria=1" : homeDoUsuario(r.usuario));
    return true;
  }

  const [verificandoSessao, setVerificandoSessao] = useState(true);

  // Ao abrir o app, se o usuário já estiver logado e não apertou "Sair", entra direto no sistema
  useEffect(() => {
    let cancelado = false;
    async function checarSessaoAtiva() {
      try {
        const u = await lerSessao();
        if (cancelado) return;
        if (u) {
          router.replace(homeDoUsuario(u));
          return;
        }
      } catch (_) {}
      if (!cancelado) {
        setVerificandoSessao(false);
        const c = lerCred();
        if (c?.email) setEmail(c.email);
      }
    }
    checarSessaoAtiva();
    return () => { cancelado = true; };
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !senha) { setErro("Preencha o usuário e a senha."); return; }
    await entrar(email, senha, lembrar);
  }

  if (verificandoSessao) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-white">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-orange-500 to-amber-600 shadow-xl shadow-orange-500/20">
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <p className="text-xl font-bold tracking-tight mb-2">Hefisto</p>
        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
          <Loader2 size={16} className="animate-spin text-orange-400" />
          <span>Restaurando sua sessão...</span>
        </div>
      </div>
    );
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
            Lembrar meu usuário
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

      <p className="text-sm font-medium mt-6 text-center" style={{ color: "var(--muted)" }}>
        Precisa de acesso? Solicite seu usuário ao administrador.
      </p>
    </div>
  );
}
