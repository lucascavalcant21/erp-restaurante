"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Layers3, Sparkles } from "lucide-react";

const TEMAS = {
  sky: {
    border: "border-sky-200",
    glow: "bg-sky-500/20",
    badge: "bg-sky-400/15 text-sky-200",
    icon: "bg-sky-400/15 text-sky-200",
    primary: "bg-sky-500 hover:bg-sky-400 shadow-sky-950/40",
    active: "bg-sky-100 text-sky-700",
  },
  indigo: {
    border: "border-indigo-200",
    glow: "bg-indigo-500/20",
    badge: "bg-indigo-400/15 text-indigo-200",
    icon: "bg-indigo-400/15 text-indigo-200",
    primary: "bg-indigo-500 hover:bg-indigo-400 shadow-indigo-950/40",
    active: "bg-indigo-100 text-indigo-700",
  },
  rose: {
    border: "border-rose-200",
    glow: "bg-rose-500/20",
    badge: "bg-rose-400/15 text-rose-200",
    icon: "bg-rose-400/15 text-rose-200",
    primary: "bg-rose-500 hover:bg-rose-400 shadow-rose-950/40",
    active: "bg-rose-100 text-rose-700",
  },
  amber: {
    border: "border-amber-200",
    glow: "bg-amber-500/20",
    badge: "bg-amber-400/15 text-amber-200",
    icon: "bg-amber-400/15 text-amber-200",
    primary: "bg-amber-500 hover:bg-amber-400 shadow-amber-950/40",
    active: "bg-amber-100 text-amber-700",
  },
};

export default function ModuleWorkspace({ config }) {
  const router = useRouter();
  const [fluxoAberto, setFluxoAberto] = useState(false);
  const tema = TEMAS[config.theme] || TEMAS.indigo;
  const ModuloIcon = config.icon;
  const PrimaryIcon = config.primary.icon;
  const etapas = config.stages || [];
  const complementos = config.items || [];
  const ferramentas = config.tools || [];

  return (
    <section className="px-3 pb-8 pt-4 sm:px-5 sm:pt-6">
      <div className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-sm ${tema.border}`}>
        <div className={`absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl ${tema.glow}`} />
        <div className="relative p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tema.badge}`}>
                  <ModuloIcon size={13} /> Módulo integrado · {config.shortTitle}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300">
                  {etapas.length + complementos.length} áreas conectadas
                </span>
              </div>
              <h1 className="max-w-4xl text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">{config.title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300 sm:text-base">{config.description}</p>
            </div>

            <button type="button" onClick={() => router.push(config.primary.href)}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-lg transition-all active:scale-[.98] sm:w-auto ${tema.primary}`}>
              <PrimaryIcon size={18} /> {config.primary.label}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
            {etapas.map((etapa, index) => {
              const Icon = etapa.icon;
              return (
                <button key={etapa.href} type="button" onClick={() => router.push(etapa.href)}
                  className={`group flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-all ${index === 0
                    ? "border-white/30 bg-white text-slate-950 shadow-xl"
                    : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10"}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${index === 0 ? tema.active : "bg-white/10 text-slate-200"}`}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[9px] font-black uppercase tracking-widest ${index === 0 ? "text-slate-400" : "text-slate-500"}`}>Etapa {index + 1}</span>
                    <span className="block text-sm font-black leading-tight break-words">{etapa.label}</span>
                    <span className={`block text-[11px] font-medium leading-snug break-words ${index === 0 ? "text-slate-500" : "text-slate-400"}`}>{etapa.hint}</span>
                  </span>
                  <ArrowRight size={15} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${index === 0 ? "text-slate-400" : "text-slate-600"}`} />
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035]">
            <button type="button" onClick={() => setFluxoAberto((valor) => !valor)} aria-expanded={fluxoAberto}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition-colors hover:bg-white/5 sm:px-5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tema.icon}`}><Layers3 size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">Fluxo completo de {config.shortTitle}</span>
                <span className="block text-[11px] font-medium leading-snug text-slate-400">{config.flowHint}</span>
              </span>
              <span className="hidden rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-slate-300 sm:block">{complementos.length} submódulos</span>
              <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${fluxoAberto ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-all duration-300 ${fluxoAberto ? "grid-rows-[1fr] border-t border-white/10" : "grid-rows-[0fr]"}`}>
              <div className="min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {complementos.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button key={`${item.href}-${item.label}`} type="button" onClick={() => router.push(item.href)}
                        className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-white transition-all hover:border-white/20 hover:bg-white/10">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200"><Icon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500">Área {etapas.length + index + 1}</span>
                          <span className="block text-xs font-black leading-tight break-words">{item.label}</span>
                          <span className="mt-0.5 block text-[10px] font-medium leading-snug text-slate-400 break-words">{item.hint}</span>
                        </span>
                        <ArrowRight size={13} className="shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/10 p-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="hidden items-center gap-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 lg:flex"><Sparkles size={13} /> Ferramentas</span>
            {ferramentas.map((item) => {
              const Icon = item.icon;
              return (
                <button key={`${item.href}-${item.label}`} type="button" onClick={() => router.push(item.href)}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-black text-white transition-colors hover:bg-white/15 sm:flex-none">
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
