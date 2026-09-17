"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, ArrowRight, Sparkles, ChefHat, Tag, Package, Users,
  Wallet, Calendar, BarChart2, Settings, Home, ClipboardList, GlassWater,
  Grid, Clock, ChevronRight
} from "lucide-react";
import { searchNavigationRegistry, getAccessibleNavigation } from "../../lib/navigation-registry.mjs";

// Mapeamento dinâmico de ícones Lucide
const ICON_MAP = {
  Home, ChefHat, Tag, Package, Users, Wallet, Calendar, BarChart: BarChart2,
  Settings, ClipboardList, GlassWater, Clock, Grid
};

export default function CommandCenterModal({
  isOpen,
  onClose,
  sessao,
  onOpenAllModules
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Executa a busca em tempo real com base no query e nas permissões da sessão
  const results = searchNavigationRegistry(query, sessao, { limit: 12 });
  const accessibleItems = getAccessibleNavigation(sessao);

  // Seleciona de 6 a 8 atalhos principais para o Acesso Rápido com base nas permissões
  const quickAccessItems = accessibleItems
    .filter(item => item.mobilePriority && item.mobilePriority <= 2)
    .slice(0, 8);

  // Foco automático e reseta estado ao abrir
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Teclado (Navegação com setas Up/Down, Enter e Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleNavigate(results[selectedIndex].route);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  const handleNavigate = (route) => {
    onClose();
    router.push(route);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Center Héfisto"
      className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      {/* Backdrop click to close */}
      <div
        className="fixed inset-0 pointer-events-auto"
        onClick={onClose}
      />

      {/* Container Principal do Command Center (Tablet / Desktop / Mobile) */}
      <div className="relative z-10 w-full max-w-[760px] md:w-[92vw] lg:w-[760px] my-auto bg-[#0D1527] border border-slate-800 rounded-2xl shadow-2xl shadow-emerald-950/30 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho de Busca */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Sparkles size={20} />
          </div>

          <div className="relative flex-1 flex items-center min-w-0">
            <Search size={20} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="O que você quer fazer? Ex: etiquetas, cmv, ponto, estoque..."
              className="w-full bg-slate-950/80 border border-slate-700/60 focus:border-emerald-500/80 text-slate-100 placeholder-slate-400 text-sm sm:text-base font-medium rounded-xl pl-10 pr-10 py-3 transition-colors outline-none min-h-[48px]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-3 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors shrink-0 min-h-[44px]"
          >
            <X size={22} />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-5 space-y-6">
          {/* Se query estiver vazia: Mostrar Acesso Rápido */}
          {!query.trim() && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Acesso Rápido
                </span>
                <span className="text-3xs text-slate-400">Baseado em seu perfil</span>
              </div>

              {/* Grid Acesso Rápido (Targets >= 44px) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {quickAccessItems.map((item) => {
                  const IconComponent = ICON_MAP[item.icon] || Package;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.route)}
                      className="flex flex-col items-start p-3 sm:p-3.5 rounded-xl bg-slate-900/60 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 text-slate-200 hover:text-white transition-all group text-left min-h-[56px] justify-between"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 transition-colors">
                        <IconComponent size={18} />
                      </div>
                      <span className="text-xs font-bold leading-tight line-clamp-1">{item.shortTitle}</span>
                      <span className="text-3xs text-slate-400 line-clamp-1">{item.domain}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista de Resultados da Busca */}
          {query.trim() && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Resultados da Busca ({results.length})
                </span>
                <span className="text-3xs text-slate-400">Use ↑ ↓ para navegar, ENTER para abrir</span>
              </div>

              {results.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <p className="text-sm font-bold text-slate-300">Nenhum resultado encontrado para &quot;{query}&quot;</p>
                  <p className="text-xs">Verifique os termos ou busque em &quot;Todos os Módulos&quot;.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {results.map((item, idx) => {
                    const IconComponent = ICON_MAP[item.icon] || Package;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.route)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left min-h-[52px] ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm"
                            : "bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-800 text-emerald-400"
                          }`}>
                            <IconComponent size={18} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold truncate">{item.title}</span>
                              <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold uppercase tracking-wider shrink-0">
                                {item.domain}
                              </span>
                            </div>
                            <span className="text-3xs sm:text-xs text-slate-400 truncate">{item.description}</span>
                          </div>
                        </div>

                        <div className={`flex items-center gap-1 text-xs font-bold shrink-0 ml-2 ${
                          isSelected ? "text-emerald-400" : "text-slate-500 opacity-0 group-hover:opacity-100"
                        }`}>
                          <span className="hidden sm:inline">Abrir</span>
                          <ArrowRight size={14} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé: Link para Todos os Módulos */}
        <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-900/80 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenAllModules) onOpenAllModules();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/50 border border-slate-700/60 hover:border-emerald-500/40 text-xs font-bold text-slate-200 hover:text-emerald-300 transition-all min-h-[44px]"
          >
            <Grid size={16} className="text-emerald-400" />
            <span>Todos os Módulos</span>
            <ChevronRight size={14} />
          </button>

          <span className="text-3xs text-slate-400 hidden sm:inline font-mono">
            Pressione ESC para fechar
          </span>
        </div>
      </div>
    </div>
  );
}
