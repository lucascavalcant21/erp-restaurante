"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  BookOpen,
  UtensilsCrossed,
  Calculator,
  BarChart3,
  ChefHat,
  Boxes,
  ShoppingCart,
  Users,
  DollarSign,
  PieChart,
  Settings,
  Sparkles,
  Calendar,
  Tag,
  Repeat,
  ShieldCheck,
  Bot,
} from "lucide-react";

const SUBMENUS = [
  { href: "/dashboard/marmitaria", label: "Visão Geral", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/marmitaria/planejamento", label: "Planejamento 360º", icon: Calendar },
  { href: "/dashboard/marmitaria/pedidos", label: "Pedidos & iFood", icon: ShoppingBag },
  { href: "/dashboard/marmitaria/cardapio", label: "Cardápio", icon: BookOpen },
  { href: "/dashboard/marmitaria/fichas", label: "Fichas Técnicas", icon: UtensilsCrossed },
  { href: "/dashboard/marmitaria/precificacao", label: "Precificação", icon: Calculator },
  { href: "/dashboard/marmitaria/combos", label: "Combos & Margem", icon: Tag },
  { href: "/dashboard/marmitaria/simulador", label: "Simulador de Vendas", icon: BarChart3 },
  { href: "/dashboard/marmitaria/producao", label: "Produção", icon: ChefHat },
  { href: "/dashboard/marmitaria/estoque", label: "Estoque & Embalagens", icon: Boxes },
  { href: "/dashboard/marmitaria/compras", label: "Lista de Compras", icon: ShoppingCart },
  { href: "/dashboard/marmitaria/assinaturas", label: "Assinaturas", icon: Repeat },
  { href: "/dashboard/marmitaria/rh", label: "RH & Escalas", icon: Users },
  { href: "/dashboard/marmitaria/qualidade", label: "Qualidade & ANVISA", icon: ShieldCheck },
  { href: "/dashboard/marmitaria/financeiro", label: "Financeiro & Repasses", icon: DollarSign },
  { href: "/dashboard/marmitaria/cmv-cmo", label: "CMV & CMO", icon: PieChart },
  { href: "/dashboard/marmitaria/dre", label: "DRE & Resultados", icon: TrendingUp },
  { href: "/dashboard/marmitaria/ia-otimizador", label: "Copiloto IA", icon: Bot },
  { href: "/dashboard/marmitaria/configuracoes", label: "Configurações", icon: Settings },
];

export default function MarmitariaLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-full bg-hf-bg">
      {/* Sub-header de navegação rápida da Marmitaria */}
      <div className="sticky top-0 z-30 bg-hf-bg/95 backdrop-blur-md border-b border-hf-border/80 px-4 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30">
              <UtensilsCrossed size={16} />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 block leading-none">
                Operação Integrada
              </span>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Marmitaria & Delivery
              </h2>
            </div>
          </div>

          {/* Abas horizontais roláveis com scrollbar suave */}
          <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1">
            {SUBMENUS.map((sub) => {
              const Icon = sub.icon;
              const isActive = sub.exact
                ? pathname === sub.href
                : pathname === sub.href || pathname.startsWith(`${sub.href}/`);

              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-white" : "text-slate-500"} />
                  {sub.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Conteúdo dinâmico da página selecionada */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}
