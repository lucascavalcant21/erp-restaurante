"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, Grid, ChefHat, Tag, Package, Users, Wallet, Calendar,
  BarChart2, Settings, ArrowRight, ShieldCheck, Box, Truck, Sparkles,
  ShoppingBag, ShoppingCart, FileText, UserCheck, Clock, DollarSign,
  UserPlus, Receipt, GitFork, TrendingUp, PieChart, FileCheck,
  ClipboardCheck, Wrench, FileSpreadsheet, Heart, ShieldAlert, Lock, Edit3
} from "lucide-react";
import { searchNavigationRegistry, getAccessibleNavigation } from "../../lib/navigation-registry.mjs";
import FavoriteStarButton from "./FavoriteStarButton.js";

const ICON_MAP = {
  Home: Grid, ChefHat, Tag, Package, Users, Wallet, Calendar, BarChart: BarChart2,
  Settings, ShieldCheck, Box, Truck, Sparkles, ShoppingBag, ShoppingCart,
  FileText, UserCheck, Clock, DollarSign, UserPlus, Receipt, GitFork,
  TrendingUp, PieChart, FileCheck, ClipboardCheck, Wrench, FileSpreadsheet,
  Heart, ShieldAlert, Lock, Edit3
};

export default function AllModulesCatalog({ isOpen, onClose, sessao }) {
  const router = useRouter();
  const [filterQuery, setFilterQuery] = useState("");

  if (!isOpen) return null;

  // Reutiliza rigorosamente a busca e filtragem por permissão
  const accessibleItems = filterQuery.trim()
    ? searchNavigationRegistry(filterQuery, sessao, { limit: 100 })
    : getAccessibleNavigation(sessao);

  // Agrupa os itens por Domínio
  const groupedDomains = accessibleItems.reduce((acc, item) => {
    const domain = item.domain || "Outros";
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(item);
    return acc;
  }, {});

  const domainOrder = [
    "Operação",
    "Estoque & Compras",
    "RH & Pessoas",
    "Financeiro & Fiscal",
    "Gestão & Ajustes"
  ];

  const handleNavigate = (route) => {
    onClose();
    router.push(route);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo Completo de Módulos"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="fixed inset-0 pointer-events-auto" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[960px] md:w-[94vw] lg:w-[960px] my-auto bg-[#0D1527] border border-slate-800 rounded-2xl shadow-2xl shadow-emerald-950/30 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Grid size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Todos os Módulos Héfisto
                <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono">
                  {accessibleItems.length} acessíveis
                </span>
              </h2>
              <p className="text-3xs sm:text-xs text-slate-400">Catálogo completo de funcionalidades permitidas para sua conta</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors shrink-0 self-end sm:self-auto min-h-[44px]"
          >
            <X size={22} />
          </button>
        </div>

        {/* Input de filtro dentro de Todos os Módulos */}
        <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800/60 shrink-0">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar módulos e funcionalidades no catálogo..."
              className="w-full bg-slate-950/80 border border-slate-700/60 focus:border-emerald-500/80 text-slate-100 placeholder-slate-400 text-xs sm:text-sm font-medium rounded-xl pl-9 pr-9 py-2.5 outline-none transition-colors min-h-[44px]"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo do Catálogo por Domínio */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-8">
          {Object.keys(groupedDomains).length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-bold text-slate-300">Nenhum módulo encontrado para &quot;{filterQuery}&quot;</p>
            </div>
          ) : (
            domainOrder
              .filter((domain) => groupedDomains[domain] && groupedDomains[domain].length > 0)
              .concat(
                Object.keys(groupedDomains).filter((d) => !domainOrder.includes(d))
              )
              .map((domain) => {
                const items = groupedDomains[domain] || [];
                if (!items.length) return null;

                return (
                  <div key={domain} className="space-y-3">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/80">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                        {domain}
                      </h3>
                      <span className="text-3xs text-slate-500 font-semibold">({items.length})</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map((item) => {
                        const IconComponent = ICON_MAP[item.icon] || Package;
                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 sm:p-3.5 rounded-xl bg-slate-900/50 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 text-slate-200 transition-all text-left group min-h-[64px] justify-between"
                          >
                            <button
                              type="button"
                              onClick={() => handleNavigate(item.route)}
                              className="flex items-start gap-3 min-w-0 flex-1 text-left"
                            >
                              <div className="w-9 h-9 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 transition-colors mt-0.5">
                                <IconComponent size={18} />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs sm:text-sm font-bold truncate group-hover:text-emerald-300 transition-colors">
                                    {item.title}
                                  </span>
                                </div>
                                <span className="text-3xs text-slate-400 line-clamp-2 mt-0.5">{item.description}</span>
                              </div>
                            </button>
                            <FavoriteStarButton itemId={item.id} sessao={sessao} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
