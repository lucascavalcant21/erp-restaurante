"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "@/app/contexts/ERPContext";
import {
  ArrowLeft, ArrowRight, Beaker, BookOpen, ChefHat, ClipboardList, GlassWater,
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
  const { abrirMenu } = useERP();
  const [fluxoAberto, setFluxoAberto] = useState(false);
  const setor = dept === "bar" ? "bar" : "cozinha";
  const bar = setor === "bar";
  const SetorIcon = bar ? GlassWater : ChefHat;

  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={abrirMenu}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Voltar ao menu"
            >
              <ArrowLeft size={19} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${bar ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>
                  <SetorIcon size={12} /> {bar ? "Operação do Bar" : "Operação da Cozinha"}
                </span>
                {Number.isFinite(Number(total)) && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-600">
                    {total} cadastrado{Number(total) === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">{title}</h1>
              {description && <p className="text-sm font-medium text-slate-500">{description}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onPrimary && (
              <button
                type="button"
                onClick={onPrimary}
                className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black text-white shadow-md transition-all active:scale-[.98] ${bar ? "bg-violet-600 hover:bg-violet-700 shadow-violet-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"}`}
              >
                <PrimaryIcon size={16} /> {primaryLabel}
              </button>
            )}
            {children}
          </div>
        </div>

        {/* Etapas de navegação rápida (Ingredientes -> Fichas técnicas -> Guia de montagem) */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {ETAPAS.map((etapa, index) => {
            const Icon = etapa.icon;
            const ativo = active === etapa.id;
            return (
              <button
                key={etapa.id}
                type="button"
                onClick={() => router.push(`${etapa.href}?dept=${setor}`)}
                className={`group flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-all ${
                  ativo
                    ? (bar ? "border-violet-300 bg-violet-50/70 text-violet-950 shadow-sm" : "border-emerald-300 bg-emerald-50/70 text-emerald-950 shadow-sm")
                    : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100/80"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    ativo
                      ? (bar ? "bg-violet-600 text-white" : "bg-emerald-600 text-white")
                      : "bg-white border border-slate-200 text-slate-500"
                  }`}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[9px] font-black uppercase tracking-widest ${ativo ? (bar ? "text-violet-600" : "text-emerald-600") : "text-slate-400"}`}>
                    Etapa {index + 1}
                  </span>
                  <span className="block text-xs font-black leading-tight break-words">{etapa.label}</span>
                </span>
                <ArrowRight size={14} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${ativo ? (bar ? "text-violet-600" : "text-emerald-600") : "text-slate-400"}`} />
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
