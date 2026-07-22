"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight, Beaker, BookOpen, ChefHat, ClipboardList, GlassWater,
  Plus, Sparkles,
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

export default function RecipeWorkspace({
  active,
  dept = "cozinha",
  title,
  description,
  total,
  onDeptChange,
  onPrimary,
  primaryLabel = "Novo item",
  primaryIcon: PrimaryIcon = Plus,
  children,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const setor = dept === "bar" ? "bar" : "cozinha";
  const bar = setor === "bar";
  const SetorIcon = bar ? GlassWater : ChefHat;

  const trocarSetor = (novo) => {
    onDeptChange?.(novo);
    const params = new URLSearchParams();
    params.set("dept", novo);
    router.replace(`${pathname}?${params.toString()}`);
  };

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
              <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
                {["cozinha", "bar"].map((opcao) => {
                  const ativo = setor === opcao;
                  const Icon = opcao === "bar" ? GlassWater : ChefHat;
                  return (
                    <button key={opcao} type="button" onClick={() => trocarSetor(opcao)}
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black capitalize transition-all ${ativo
                        ? "bg-white text-slate-950 shadow-lg"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                      <Icon size={15} /> {opcao}
                    </button>
                  );
                })}
              </div>
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
                    <span className="block truncate text-sm font-black">{etapa.label}</span>
                    <span className={`block truncate text-[11px] font-medium ${ativo ? "text-slate-500" : "text-slate-400"}`}>{etapa.hint}</span>
                  </span>
                  <ArrowRight size={15} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${ativo ? "text-slate-400" : "text-slate-600"}`} />
                </button>
              );
            })}
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
