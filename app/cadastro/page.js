"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Check } from "lucide-react";
import { PAPEIS, registrarUsuario, homeDoPapel } from "../lib/auth";
import { CENTRAL } from "../lib/unidades";
import { useERP } from "../context/ERPContext";

const STEPS = ["Dados", "Função", "Unidade"];

function StepBar({ step }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => {
        const done = i < step, cur = i === step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex items-center gap-1.5" style={{ opacity: cur ? 1 : done ? 0.8 : 0.4 }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ background: done || cur ? "var(--accent-strong)" : "var(--elevated)", color: done || cur ? "#fff" : "var(--muted)" }}>
                {done ? <Check size={13} /> : i + 1}
              </div>
              <span className="text-[12px] font-bold" style={{ color: cur ? "var(--fg)" : "var(--dim)" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px" style={{ background: done ? "var(--accent-strong)" : "var(--line)" }} />}
          </div>
        );
      })}
    </div>
  );
}

export default function CadastroPage() {
  const router = useRouter();
  const { unidades } = useERP();
  const [step, setStep] = useState(0);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [ver, setVer] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", papel: "", unidade: "" });
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErro(""); };

  function validar(s) {
    if (s === 0) {
      if (!form.nome.trim()) return "Informe seu nome completo.";
      if (!form.email.includes("@")) return "Informe um e-mail válido.";
      if (form.senha.length < 6) return "A senha deve ter ao menos 6 caracteres.";
    }
    if (s === 1 && !form.papel) return "Selecione sua função.";
    if (s === 2 && !form.unidade) return "Selecione sua unidade.";
    return null;
  }
  function avancar() { const m = validar(step); if (m) return setErro(m); setErro(""); setStep((s) => s + 1); }

  async function finalizar() {
    const m = validar(2); if (m) return setErro(m);
    setLoading(true); setErro("");
    const r = await registrarUsuario(form);
    if (!r.ok) { setErro(r.erro); setLoading(false); return; }
    if (r.precisaConfirmar) {
      setErro("Conta criada! Confirme o e-mail e depois faça login.");
      setLoading(false); setTimeout(() => router.push("/login"), 2500); return;
    }
    router.push(homeDoPapel(form.papel));
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-sm erp-card p-6">
        <button onClick={() => step === 0 ? router.push("/login") : setStep((s) => s - 1)}
          className="flex items-center gap-1.5 text-[12px] font-bold mb-5" style={{ color: "var(--dim)" }}>
          <ArrowLeft size={14} /> {step === 0 ? "Voltar ao login" : "Voltar"}
        </button>

        <StepBar step={step} />

        {step === 0 && (
          <div className="space-y-4">
            <div><h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Criar conta</h1>
              <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Seus dados de acesso.</p></div>
            <div><label className="erp-label block mb-1.5">Nome completo</label>
              <input value={form.nome} onChange={set("nome")} placeholder="Seu nome" className="erp-input" autoComplete="name" /></div>
            <div><label className="erp-label block mb-1.5">E-mail</label>
              <input type="email" value={form.email} onChange={set("email")} placeholder="seu@email.com" className="erp-input" autoComplete="email" /></div>
            <div><label className="erp-label block mb-1.5">Telefone (opcional)</label>
              <input value={form.telefone} onChange={set("telefone")} placeholder="(11) 9..." className="erp-input" autoComplete="tel" /></div>
            <div><label className="erp-label block mb-1.5">Senha</label>
              <div className="relative">
                <input type={ver ? "text" : "password"} value={form.senha} onChange={set("senha")} placeholder="Mínimo 6 caracteres" className="erp-input" style={{ paddingRight: 44 }} autoComplete="new-password" />
                <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dim)" }}>{ver ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <div className="mb-2"><h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Sua função</h1>
              <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Define o que você acessa no sistema.</p></div>
            {PAPEIS.map((p) => {
              const sel = form.papel === p.id;
              return (
                <button key={p.id} type="button" onClick={() => { setForm((f) => ({ ...f, papel: p.id })); setErro(""); }}
                  className="w-full flex items-start gap-3 px-3.5 py-3 rounded-xl text-left transition-all"
                  style={{ border: `1.5px solid ${sel ? "var(--accent)" : "var(--line)"}`, background: sel ? "var(--accent-soft)" : "var(--panel)" }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.cor + "22" }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.cor }} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{p.label}</p>
                    <p className="text-[11px] font-medium leading-snug" style={{ color: "var(--dim)" }}>{p.descricao}</p>
                  </div>
                  {sel && <Check size={16} style={{ color: "var(--accent-fg)", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <div className="mb-2"><h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Sua unidade</h1>
              <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Onde você atua.</p></div>
            {[...unidades, { id: CENTRAL.id, nome: "Central (todas as lojas)", cor: CENTRAL.cor }].map((u) => {
              const sel = form.unidade === u.id;
              return (
                <button key={u.id} type="button" onClick={() => { setForm((f) => ({ ...f, unidade: u.id })); setErro(""); }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all"
                  style={{ border: `1.5px solid ${sel ? "var(--accent)" : "var(--line)"}`, background: sel ? "var(--accent-soft)" : "var(--panel)" }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: u.cor }} />
                  <span className="flex-1 text-sm font-bold" style={{ color: "var(--fg)" }}>{u.nome}</span>
                  {sel && <Check size={16} style={{ color: "var(--accent-fg)" }} />}
                </button>
              );
            })}
          </div>
        )}

        {erro && <p className="erp-badge erp-badge-danger w-full justify-center mt-4">{erro}</p>}

        <button onClick={step === 2 ? finalizar : avancar} disabled={loading}
          className="erp-btn erp-btn-primary w-full !h-12 mt-5 disabled:opacity-60">
          {loading ? "Criando..." : step === 2 ? "Criar conta" : "Continuar"}
        </button>

        {step === 0 && (
          <p className="text-sm font-medium text-center mt-4" style={{ color: "var(--muted)" }}>
            Já tem conta? <button onClick={() => router.push("/login")} className="font-bold" style={{ color: "var(--accent-fg)" }}>Entrar</button>
          </p>
        )}
      </div>
    </div>
  );
}
