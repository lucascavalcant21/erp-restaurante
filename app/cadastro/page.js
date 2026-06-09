"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAPEIS, registrarUsuario } from "../lib/auth";

const UNIDADES = ["Seldeestrela", "Tico Tico Saladas", "Burguer", "Todas as unidades"];

const IcCheck = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IcEye = ({ open }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    {open
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
    }
  </svg>
);

// ── Componente de seleção de papel ────────────────────────────
function SeletorPapel({ value, onChange }) {
  return (
    <div className="space-y-2">
      {PAPEIS.map((p) => {
        const sel = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
              sel
                ? "border-accent bg-brand-50"
                : "border-neutral-100 bg-neutral-50 active:bg-neutral-100"
            }`}
          >
            {/* Indicador de cor do papel */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: p.cor + "18" }}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.cor }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold leading-tight mb-0.5 ${sel ? "text-brand-900" : "text-neutral-800"}`}>
                {p.label}
              </p>
              <p className="text-xs text-neutral-400 font-medium leading-snug">
                {p.descricao}
              </p>
            </div>

            {/* Checkmark */}
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              sel ? "bg-accent text-white" : "border-2 border-neutral-200"
            }`}>
              {sel && <IcCheck />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────
const STEPS = ["Dados", "Função", "Unidade"];

function StepBar({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const done    = i < step;
        const current = i === step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`flex items-center gap-1.5 ${current ? "opacity-100" : done ? "opacity-70" : "opacity-30"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                done ? "bg-accent text-white" : current ? "bg-accent text-white" : "bg-neutral-200 text-neutral-500"
              }`}>
                {done ? <IcCheck /> : i + 1}
              </div>
              <span className={`text-xs font-bold ${current ? "text-neutral-900" : "text-neutral-400"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${done ? "bg-accent" : "bg-neutral-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  const [form, setForm] = useState({
    nome:     "",
    email:    "",
    telefone: "",
    senha:    "",
    papel:    "",
    unidade:  "",
  });

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErro(""); };

  // ── Validações por etapa ──────────────────────────────────
  const validarStep0 = () => {
    if (!form.nome.trim())  return "Informe seu nome completo.";
    if (!form.email.trim() || !form.email.includes("@")) return "Informe um e-mail válido.";
    if (form.senha.length < 6) return "A senha deve ter ao menos 6 caracteres.";
    return null;
  };

  const validarStep1 = () => {
    if (!form.papel) return "Selecione sua função no sistema.";
    return null;
  };

  const validarStep2 = () => {
    if (!form.unidade) return "Selecione sua unidade de trabalho.";
    return null;
  };

  const avancar = () => {
    const erros = [validarStep0, validarStep1, validarStep2];
    const msg = erros[step]();
    if (msg) { setErro(msg); return; }
    setErro("");
    setStep((s) => s + 1);
  };

  const finalizar = async () => {
    const msg = validarStep2();
    if (msg) { setErro(msg); return; }
    setLoading(true);
    setErro("");

    const result = await registrarUsuario(form);
    if (!result.ok) {
      setErro(result.erro);
      setLoading(false);
      return;
    }

    if (result.precisaConfirmar) {
      setErro("Conta criada! Confirme o e-mail enviado para você e depois faça login.");
      setLoading(false);
      setTimeout(() => router.push("/login"), 2500);
      return;
    }
    router.push("/dashboard");
  };

  const papelAtual = PAPEIS.find((p) => p.id === form.papel);

  return (
    <div className="min-h-screen bg-card flex flex-col px-5 py-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => step === 0 ? router.push("/login") : setStep((s) => s - 1)}
          className="w-9 h-9 rounded-full bg-white border border-neutral-200 flex items-center justify-center active:bg-neutral-50 transition-colors shadow-sm"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div>
          <p className="text-xs text-neutral-400 font-medium">Cerebro ERP</p>
          <p className="text-base font-black text-neutral-900">Criar conta</p>
        </div>
      </div>

      <StepBar step={step} />

      {/* ── STEP 0: Dados pessoais ── */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-xl font-black text-neutral-900 mb-1">Seus dados</p>
            <p className="text-sm text-neutral-400 font-medium mb-6">Informe seus dados de acesso.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide block mb-1.5">Nome completo</label>
            <input type="text" placeholder="Lucas Cavalcante" value={form.nome} onChange={set("nome")}
              className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm" />
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide block mb-1.5">E-mail</label>
            <input type="email" autoComplete="email" placeholder="seu@email.com" value={form.email} onChange={set("email")}
              className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm" />
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide block mb-1.5">Telefone (opcional)</label>
            <input type="tel" placeholder="(11) 9 0000-0000" value={form.telefone} onChange={set("telefone")}
              className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm" />
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide block mb-1.5">Senha</label>
            <div className="relative">
              <input type={verSenha ? "text" : "password"} autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={set("senha")}
                className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 pr-11 text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm" />
              <button type="button" onClick={() => setVerSenha(!verSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 active:text-neutral-600">
                <IcEye open={verSenha} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 1: Seleção de função ── */}
      {step === 1 && (
        <div>
          <p className="text-xl font-black text-neutral-900 mb-1">Qual é a sua função?</p>
          <p className="text-sm text-neutral-400 font-medium mb-6">
            O sistema vai exibir apenas os módulos relevantes para o seu papel.
          </p>
          <SeletorPapel
            value={form.papel}
            onChange={(id) => { setForm((f) => ({ ...f, papel: id })); setErro(""); }}
          />
        </div>
      )}

      {/* ── STEP 2: Unidade ── */}
      {step === 2 && (
        <div>
          <p className="text-xl font-black text-neutral-900 mb-1">Qual é a sua unidade?</p>
          <p className="text-sm text-neutral-400 font-medium mb-6">
            Selecione a unidade onde você atua.
          </p>

          {/* Resumo da função */}
          {papelAtual && (
            <div className="bg-white border border-neutral-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: papelAtual.cor + "18" }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: papelAtual.cor }} />
              </div>
              <div>
                <p className="text-xs text-neutral-400 font-medium">Função selecionada</p>
                <p className="text-sm font-bold text-neutral-800">{papelAtual.label}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {UNIDADES.map((u) => {
              const sel = form.unidade === u;
              return (
                <button key={u} type="button" onClick={() => { setForm((f) => ({ ...f, unidade: u })); setErro(""); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                    sel ? "border-accent bg-brand-50" : "border-neutral-100 bg-neutral-50 active:bg-neutral-100"
                  }`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${
                    sel ? "bg-accent text-white" : "bg-neutral-200 text-neutral-500"
                  }`}>
                    {u[0]}
                  </div>
                  <span className={`text-sm font-bold flex-1 ${sel ? "text-brand-900" : "text-neutral-700"}`}>{u}</span>
                  {sel && (
                    <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white flex-shrink-0">
                      <IcCheck />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Erro ── */}
      {erro && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold text-red-600">{erro}</p>
        </div>
      )}

      {/* ── Botões de navegação ── */}
      <div className="mt-8 space-y-3">
        {step < 2 ? (
          <button onClick={avancar}
            className="w-full py-3.5 rounded-2xl bg-accent text-white text-sm font-bold shadow-sm active:bg-accent-strong transition-colors">
            Continuar
          </button>
        ) : (
          <button onClick={finalizar} disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-accent text-white text-sm font-bold shadow-sm active:bg-accent-strong transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Criando conta...
              </>
            ) : "Criar conta e entrar"}
          </button>
        )}

        <p className="text-center text-sm text-neutral-400 font-medium">
          Já tem conta?{" "}
          <button onClick={() => router.push("/login")} className="text-accent font-bold">
            Entrar
          </button>
        </p>
      </div>

    </div>
  );
}
