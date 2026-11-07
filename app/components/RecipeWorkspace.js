"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import CabecalhoTela from "./ui/CabecalhoTela";
import { useERP } from "../context/ERPContext";
import { canAccessRoute } from "../lib/permissions-catalog.mjs";
import {
  ArrowLeft, ArrowRight, Beaker, BookOpen, ChefHat, ClipboardList, GlassWater,
  Boxes, CalendarCheck, ChevronDown, Factory, FileInput, Layers3,
  ListChecks, Plus, ReceiptText, RotateCw, ShoppingCart, Sparkles, Tags, Wine,
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
    { label: "Eventos e Reservas", hint: "Custos e planejamento", icon: ReceiptText, href: "/dashboard/reservas-eventos/eventos" },
  ],
  bar: [
    { label: "Drinks e produtos", hint: "Tudo no receituário integrado", icon: Wine, href: "/dashboard/operacao/fichas?dept=bar" },
    { label: "Estoque", hint: "Bebidas e insumos", icon: Boxes, href: "/dashboard/operacao/estoque" },
    { label: "Compras", hint: "Pedidos e fornecedores", icon: ShoppingCart, href: "/dashboard/operacao/compras" },
    { label: "Entrada de notas", hint: "Recebimento e conferência", icon: FileInput, href: "/dashboard/operacao/notas" },
    { label: "Produção do dia", hint: "Bases, xaropes e preparos", icon: Factory, href: "/dashboard/operacao/producao" },
    { label: "Etiquetas e validade", hint: "Rastreio e perdas", icon: Tags, href: "/dashboard/operacao/etiquetas" },
    { label: "Checklist do bar", hint: "Abertura e fechamento", icon: CalendarCheck, href: "/dashboard/operacao/rotina" },
    { label: "Eventos e Reservas", hint: "Bebidas e planejamento", icon: ReceiptText, href: "/dashboard/reservas-eventos/eventos" },
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
  mostrarEtapas = true,
  children,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { abrirMenu, sessao } = useERP();
  // A troca Cozinha/Bar só aparece para quem pode abrir os dois setores.
  const podeSetor = (dept) => !sessao?.gerenciado || canAccessRoute(sessao, pathname, `dept=${dept}`);
  const trocaSetor = podeSetor("cozinha") && podeSetor("bar");
  const [fluxoAberto, setFluxoAberto] = useState(false);
  const setor = dept === "bar" ? "bar" : "cozinha";
  const bar = setor === "bar";

  return (
    <header className="border-b border-hf-border bg-hf-bg">
      <div className="mx-auto max-w-[1480px]">
        {/* Visual do Nina (07/11/2026): cabeçalho padrão; setor, total e ações à direita. */}
        <CabecalhoTela titulo={title} subtitulo={description || undefined}>
          {trocaSetor && <div className="flex items-center rounded-full bg-hf-elevated p-1 border border-hf-border">
                  <button
                    type="button"
                    onClick={() => router.push(`${pathname}?dept=cozinha`)}
                    className={`min-h-[36px] px-3 text-sm font-semibold rounded-full shadow-none transition-all ${!bar ? "bg-hf-menu text-white" : "text-hf-text-2 hover:text-hf-text"}`}
                  >
                    Cozinha
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`${pathname}?dept=bar`)}
                    className={`min-h-[36px] px-3 text-sm font-semibold rounded-full shadow-none transition-all ${bar ? "bg-hf-menu text-white" : "text-hf-text-2 hover:text-hf-text"}`}
                  >
                    Bar
                  </button>
                </div>}
                {Number.isFinite(Number(total)) && (
                  <span className="rounded-full border border-hf-border bg-hf-surface px-3 py-1.5 text-xs font-semibold text-hf-text-2">
                    {total} cadastrado{Number(total) === 1 ? "" : "s"}
                  </span>
                )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hf-border bg-hf-surface text-hf-text-2 shadow-none hover:bg-hf-elevated"
            title="Atualizar dados e recarregar a tela"
            aria-label="Atualizar"
          >
            <RotateCw size={16} />
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {onPrimary && (
              <button
                type="button"
                onClick={onPrimary}
                className="flex min-h-[44px] items-center gap-2 rounded-full bg-hf-accent px-5 text-sm font-semibold text-hf-accent-fg shadow-none transition-all active:scale-[.98]"
              >
                <PrimaryIcon size={16} /> {primaryLabel}
              </button>
            )}
            {children}
          </div>
        </CabecalhoTela>
      </div>
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8 space-y-4 pb-4">
        {/* Etapas de navegação rápida (Ingredientes -> Fichas técnicas -> Guia de montagem) */}
        {mostrarEtapas && <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
                    ? (bar ? "border-zinc-200 bg-zinc-100/70 text-zinc-900 shadow-sm" : "border-emerald-300 bg-emerald-50/70 text-emerald-950 shadow-sm")
                    : "border-line bg-slate-50/50 text-fg-soft hover:bg-slate-100/80"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    ativo
                      ? (bar ? "bg-emerald-700 text-accent-fg" : "bg-accent text-accent-fg")
                      : "bg-card border border-line text-muted"
                  }`}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-3xs font-bold uppercase tracking-widest ${ativo ? (bar ? "text-emerald-700" : "text-success") : "text-subtle"}`}>
                    Etapa {index + 1}
                  </span>
                  <span className="block text-xs font-bold leading-tight break-words">{etapa.label}</span>
                </span>
                <ArrowRight size={14} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${ativo ? (bar ? "text-emerald-700" : "text-success") : "text-subtle"}`} />
              </button>
            );
          })}
        </div>}
      </div>
    </header>
  );
}
