"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import GreenDotAssist from "../components/green-dot/GreenDotAssist";

export default function KioskGreenDotAssistPage() {
  return (
    <div className="min-h-screen bg-[#1E3B2B] flex flex-col">
      <div className="px-4 py-2 bg-[#162C20] text-white/90 text-xs flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2 font-bold">
          <Sparkles size={14} className="text-emerald-400" />
          <span>Héfisto · Green Dot Assist (Modo Tablet / Kiosk de Loja)</span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-emerald-300 hover:text-white font-bold transition"
        >
          <ArrowLeft size={14} /> Voltar ao ERP
        </Link>
      </div>
      <div className="flex-1">
        <GreenDotAssist modoInicial="boas-vindas" />
      </div>
    </div>
  );
}
