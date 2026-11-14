"use client";

// Peças do visual do app da Medway (pedido do dono, 14/11/2026, com as
// capturas de tela): título grande sem trilha, rótulo de seção em maiúsculas
// azul-acinzentado, grade de cartões brancos com ícone só em contorno e o nome
// embaixo, e a faixa de destaque em degradê ("Trilha do dia"). Cores: tokens
// mw-* (app/globals.css).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, FileText, Lock, Sparkles } from "lucide-react";
import { ICONES_MODULO } from "./IconeModulo";

/** Fundo cinza claro da tela, ocupando a altura toda. */
export function FundoMedway({ children, className = "" }) {
  return <div className={`min-h-full bg-mw-bg pb-10 text-mw-texto ${className}`}>{children}</div>;
}

/** "Menu", "Salão": título grande à esquerda, como na Medway. */
export function TituloGrande({ children, subtitulo = null, className = "" }) {
  return (
    <header className={`px-4 pb-5 pt-6 sm:px-6 ${className}`}>
      <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-mw-marinho">{children}</h1>
      {subtitulo && <p className="mt-1 text-[15px] text-mw-sec">{subtitulo}</p>}
    </header>
  );
}

/** "‹ Meu perfil": seta redonda e título, com a linha embaixo. */
export function TopoComVoltar({ titulo, voltarPara = null }) {
  const router = useRouter();
  return (
    <header className="flex min-h-[72px] items-center gap-4 border-b border-mw-borda bg-mw-card px-4 sm:px-6">
      <button
        type="button"
        onClick={() => (voltarPara ? router.push(voltarPara) : router.back())}
        aria-label="Voltar"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-mw-borda bg-mw-card text-mw-agua shadow-none hover:bg-mw-bg"
      >
        <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <h1 className="truncate text-[22px] font-semibold tracking-tight text-mw-marinho">{titulo}</h1>
    </header>
  );
}

export function RotuloSecao({ children }) {
  return <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-mw-sec">{children}</h2>;
}

export function GradeCartoes({ children }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

/** Cartão da grade: ícone em contorno no alto, nome embaixo. */
export function CartaoGrade({ href, icone, label, trancado = false, contador = null, onClick = null }) {
  const Icone = ICONES_MODULO[icone] || FileText;
  const conteudo = (
    <>
      <span className="relative inline-flex">
        <Icone size={24} strokeWidth={1.5} aria-hidden="true" className={trancado ? "text-mw-sec" : "text-mw-texto"} />
        {contador > 0 && (
          <span className="absolute -right-2.5 -top-2.5 grid h-6 min-w-6 place-items-center rounded-full bg-mw-marinho px-1.5 text-[12px] font-semibold text-white">
            {contador}
          </span>
        )}
      </span>
      {trancado && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 text-[12px] font-medium text-mw-sec">
          <Lock size={13} aria-hidden="true" /> Completo
        </span>
      )}
      <span className={`text-[16px] leading-snug ${trancado ? "text-mw-sec" : "text-mw-texto"}`}>{label}</span>
    </>
  );
  const classe = "relative flex min-h-[116px] min-w-0 flex-col justify-between gap-6 rounded-[22px] border border-mw-borda bg-mw-card p-5 text-left shadow-none transition active:scale-[0.98] hover:border-mw-sec/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mw-agua";
  if (onClick) return <button type="button" onClick={onClick} className={classe}>{conteudo}</button>;
  return (
    <Link href={href} aria-label={trancado ? `${label} (plano Completo)` : undefined} className={classe}>
      {conteudo}
    </Link>
  );
}

/** Faixa em degradê do verde-água ao azul, como a "Trilha do dia". */
export function DestaqueDegrade({ href, titulo, texto, icone = null, trancado = false }) {
  const Icone = (icone && ICONES_MODULO[icone]) || Sparkles;
  return (
    <Link
      href={href}
      aria-label={trancado ? `${titulo} (plano Completo)` : undefined}
      className="flex min-h-[96px] items-center gap-4 rounded-[24px] bg-gradient-to-r from-mw-agua to-mw-azul px-5 py-4 text-white shadow-none transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mw-marinho"
    >
      <Icone size={28} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[19px] font-semibold leading-tight">
          {titulo}
          {trancado && <Lock size={15} aria-hidden="true" />}
        </span>
        {texto && <span className="mt-1 block text-[14px] leading-snug text-white/90">{texto}</span>}
      </span>
      <ArrowRight size={22} aria-hidden="true" className="shrink-0" />
    </Link>
  );
}
