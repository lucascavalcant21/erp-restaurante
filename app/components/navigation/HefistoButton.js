"use client";

import React from "react";
import { Search, Sparkles, Command } from "lucide-react";

export default function HefistoButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir busca universal Héfisto (CTRL+K)"
      className={`
        group relative flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl
        bg-slate-900/90 text-slate-100 hover:bg-slate-900 hover:text-white
        border border-emerald-500/30 hover:border-emerald-500/60
        shadow-sm hover:shadow-md hover:shadow-emerald-950/20
        transition-all duration-200 cursor-pointer min-h-[44px] min-w-[200px] sm:min-w-[280px] md:min-w-[340px]
        ${className}
      `}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 group-hover:scale-105 transition-transform">
          <Sparkles size={15} />
        </div>
        <div className="flex flex-col text-left truncate">
          <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
            ✦ Héfisto <span className="text-emerald-400 font-normal text-3xs uppercase tracking-wider hidden sm:inline">• Busca Universal</span>
          </span>
          <span className="text-3xs text-slate-400 truncate">O que você quer fazer agora?</span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 text-slate-400 text-3xs font-semibold border border-slate-700/60 shrink-0">
        <Command size={10} />
        <span>K</span>
      </div>

      <div className="sm:hidden flex items-center justify-center w-7 h-7 text-slate-400">
        <Search size={16} />
      </div>
    </button>
  );
}
