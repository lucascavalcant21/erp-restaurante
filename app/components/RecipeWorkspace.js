"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Beaker, BookOpen, ChefHat, ClipboardList, GlassWater,
  Boxes, CalendarCheck, ChevronDown, Factory, FileInput, Layers3,
  ListChecks, Plus, ReceiptText, ShoppingCart, Sparkles, Tags, Wine,
} from "lucide-react";

const ETAPAS = [
  {
    id: "ingredientes",
    label: "Ingredientes",
    hint: "Custos e insumos",
    icon: Beaker,
    href: "/dashboard/operacao/ingredientes",
  },
  {
    id: "fichas",
    label: "Fichas técnicas",
    hint: "Receitas e CMV",
    icon: BookOpen,
    href: "/dashboard/operacao/fichas",
  },
  {
    id: "montagem",
    label: "Guia de montagem",
    hint: "Padrão de execução",
    icon: ClipboardList,
    href: "/dashboard/operacao/montagem",
  },
];

const COMPLEMENTOS = {
  cozinha: [
    { label: "Estoque", hint: "Saldos e movimentações", icon: Boxes, href: "/dashboard/operacao/estoque" },
    { label: "Compras", hint: "Pedidos e fornecedores", icon: ShoppingCart, href: "/dashboard/operacao/compras" },
    { label: "Entrada de notas", hint: "Recebimento e conferência", icon: FileInput, href: "/dashboard/operacao/notas" },
    { label: "Produção do dia", hint: "Planejamento e execução", icon: Factory, href: "/dashboard/operacao/producao" },
    { label: "Etiquetas e validade", hint: "Rastreio, FEFO e perdas", icon: Tags, href: "/dashboard/operacao/etiquetas" },
    { label: "Controles de limpeza", hint: "Rotinas e registros", icon: ListChecks, href: "/dashboard/operacao/controles" },
    { label: "Checklist da cozinha", hint: "Abertura e fechamento", icon: CalendarCheck, href: "/dashboard/operacao/rotina" },
    { label: "Orçamento de eventos", hint: "Custos e planejamento", icon: ReceiptText, href: "/dashboard/operacao/orcamento" },
  ],
  bar: [
    { label: "Drinks e produtos", hint: "Tudo no receituário integrado", icon: Wine, href: "/dashboard/operacao/fichas?dept=bar" },
    { label: "Estoque", hint: "Bebidas e insumos", icon: Boxes, href: "/dashboard/operacao/estoque" },
    { label: "Compras", hint: "Pedidos e fornecedores", icon: ShoppingCart, href: "/dashboard/operacao/compras" },
    { label: "Entrada de notas", hint: "Recebimento e conferência", icon: FileInput, href: "/dashboard/operacao/notas" },
    { label: "Produção do dia", hint: "Bases, xaropes e preparos", icon: Factory, href: "/dashboard/operacao/producao" },
    { label: "Etiquetas e validade", hint: "Rastreio e perdas", icon: Tags, href: "/dashboard/operacao/etiquetas" },
    { label: "Checklist do bar", hint: "Abertura e fechamento", icon: CalendarCheck, href: "/dashboard/operacao/rotina" },
    { label: "Orçamento de eventos", hint: "Bebidas e planejamento", icon: ReceiptText, href: "/dashboard/operacao/orcamento" },
  ],
};

export default function RecipeWorkspace({
  active,
  dept = "cozinha",
  title,
  description,
  total,
  onPrimary,
  primaryLabel = "Novo item",
  primaryIcon: PrimaryIcon = Plus,
  children,
}) {
  const router = useRouter();
  const [fluxoAberto, setFluxoAberto] = useState(false);
  const setor = dept === "bar" ? "bar" : "cozinha";
  const bar = setor === "bar";
  const SetorIcon = bar ? GlassWater : ChefHat;

  return (
    <section className="px-3 sm:px-5 pt-4 sm:pt-6">
      <div className={`relative overflow-hidden rounded-3xl border shadow-sm ${bar
        ? "border-violet-200 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950"
        : "border-emerald-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950"}`}>
        <div className={`absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl ${bar ? "bg-violet-500/20" : "bg-emerald-500/20"}`} />
        <div className="relative p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${bar ? "bg-violet-400/15 text-violet-200" : "bg-emerald-400/15 text-emerald-200"}`}>
                  <SetorIcon size={13} /> {bar ? "Operação do Bar" : "Operação da Cozinha"}
                </span>
                {Number.isFinite(Number(total)) && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300">
                    {total} cadastrado{Number(total) === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <h1 className="max-w-3xl text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300 sm:text-base">{description}</p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row xl:justify-end">
              {onPrimary && (
                <button type="button" onClick={onPrimary}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-lg transition-all active:scale-[.98] ${bar
                    ? "bg-violet-500 hover:bg-violet-400 shadow-violet-950/40"
                    : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-950/40"}`}>
                  <PrimaryIcon size={18} /> {primaryLabel}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
            {ETAPAS.map((etapa, index) => {
              const Icon = etapa.icon;
              const ativo = active === etapa.id;
              return (
                <button key={etapa.id} type="button" onClick={() => router.push(`${etapa.href}?dept=${setor}`)}
                  className={`group flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-all ${ativo
                    ? "border-white/30 bg-white text-slate-950 shadow-xl"
                    : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10"}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ativo
                    ? (bar ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700")
                    : "bg-white/10 text-slate-200"}`}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[9px] font-black uppercase tracking-widest ${ativo ? "text-slate-400" : "text-slate-500"}`}>Etapa {index + 1}</span>
                    <span className="block text-sm font-black leading-tight break-words">{etapa.label}</span>
                    <span className={`block text-[11px] font-medium leading-snug break-words ${ativo ? "text-slate-500" : "text-slate-400"}`}>{etapa.hint}</span>
                  </span>
                  <ArrowRight size={15} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${ativo ? "text-slate-400" : "text-slate-600"}`} />
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035]">
            <button type="button" onClick={() => setFluxoAberto((valor) => !valor)} aria-expanded={fluxoAberto}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition-colors hover:bg-white/5 sm:px-5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bar ? "bg-violet-400/15 text-violet-200" : "bg-emerald-400/15 text-emerald-200"}`}>
                <Layers3 size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">Fluxo completo de {bar ? "Bar" : "Cozinha"}</span>
                <span className="block text-[11px] font-medium text-slate-400">Acesse estoque, compras, notas, produção, validade e demais rotinas</span>
              </span>
              <span className="hidden rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-slate-300 sm:block">{ETAPAS.length + COMPLEMENTOS[setor].length} submódulos</span>
              <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${fluxoAberto ? "rotate-180" : ""}`} />
            </button>

            <div className={`grid transition-all duration-300 ${fluxoAberto ? "grid-rows-[1fr] border-t border-white/10" : "grid-rows-[0fr]"}`}>
              <div className="min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {COMPLEMENTOS[setor].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.href} type="button" onClick={() => router.push(`${item.href}?dept=${setor}`)}
                        className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-white transition-all hover:border-white/20 hover:bg-white/10">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200"><Icon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500">Etapa {ETAPAS.length + index + 1}</span>
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

          {children && (
            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/10 p-2 sm:flex-row sm:flex-wrap sm:items-center [&>button]:min-h-11 [&>button]:flex-1 [&>button]:justify-center [&>button]:whitespace-nowrap sm:[&>button]:flex-none">
              <span className="hidden items-center gap-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 lg:flex">
                <Sparkles size={13} /> Ferramentas
              </span>
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
