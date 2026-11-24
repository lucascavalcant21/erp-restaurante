"use client";

// Peças comuns das seções de Configurações: cabeçalho com voltar, blocos,
// campos e a barra de salvar presa embaixo (no celular o botão fica sempre à mão).

import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export const inputCls = "w-full h-12 rounded-xl border border-hf-border bg-hf-surface px-4 text-[15px] text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/30 disabled:opacity-60";

export function Painel({ titulo, descricao, onVoltar, children, rodape = null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-3 sm:px-6">
      <button type="button" onClick={onVoltar} className="-ml-2 mb-2 flex h-11 items-center gap-1.5 rounded-xl px-2 text-[14px] font-medium text-hf-muted hover:text-hf-text">
        <ArrowLeft size={18} /> Configurações
      </button>
      <h1 className="text-[22px] font-semibold tracking-tight text-hf-text">{titulo}</h1>
      {descricao && <p className="mt-1 text-[14px] text-hf-muted">{descricao}</p>}
      <div className="mt-5 space-y-5">{children}</div>
      {rodape && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hf-border bg-hf-surface/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-2xl items-center gap-3">{rodape}</div>
        </div>
      )}
    </div>
  );
}

export function Bloco({ titulo, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-hf-border bg-hf-surface p-4 sm:p-5 ${className}`}>
      {titulo && <h2 className="mb-3 text-[13px] font-medium text-hf-muted">{titulo}</h2>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Campo({ rotulo, dica, aviso, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium text-hf-text">{rotulo}</span>
      {children}
      {aviso ? <span className="mt-1 block text-[13px] font-medium text-hf-warning">{aviso}</span> : dica ? <span className="mt-1 block text-[13px] text-hf-muted">{dica}</span> : null}
    </label>
  );
}

export function BotaoSalvar({ onClick, salvando, ok, desabilitado = false, texto = "Salvar" }) {
  return (
    <>
      <button type="button" onClick={onClick} disabled={salvando || desabilitado}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-hf-menu px-6 text-[15px] font-semibold text-white disabled:opacity-40 sm:flex-none">
        {salvando && <Loader2 size={18} className="animate-spin" />} {salvando ? "Salvando…" : texto}
      </button>
      {ok && <span className="flex items-center gap-1 text-[14px] font-medium text-hf-success"><CheckCircle2 size={16} /> Salvo</span>}
    </>
  );
}

export function SemUnidade() {
  return <p className="rounded-2xl border border-hf-border bg-hf-surface p-4 text-[14px] text-hf-muted">Escolha uma unidade no topo da tela para ver e mudar esta configuração.</p>;
}

/** Mostra "Salvo" por 2,5 s. */
export function avisarSalvo(setOk) {
  setOk(true);
  setTimeout(() => setOk(false), 2500);
}
