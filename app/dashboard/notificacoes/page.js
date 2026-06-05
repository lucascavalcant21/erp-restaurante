"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";

export default function Page() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#fbf9f5]">
      <div className="sticky top-0 z-10 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} className="text-neutral-600" />
        </button>
        <div>
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Notificações</h1>
          <p className="text-[11px] text-neutral-400 font-medium">Central de alertas do sistema.</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="w-20 h-20 rounded-3xl bg-white border border-neutral-100 shadow-sm flex items-center justify-center mb-5">
          <Clock size={32} className="text-neutral-300" />
        </div>
        <h2 className="text-xl font-black text-neutral-900 mb-2">Em Desenvolvimento</h2>
        <p className="text-sm text-neutral-400 font-medium leading-relaxed max-w-xs">
          Este módulo está sendo construído. Em breve estará disponível para uso na operação.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-8 px-6 py-3.5 bg-[#10b981] text-white font-black text-sm rounded-2xl shadow-md active:scale-95 transition-transform"
        >
          Voltar ao Painel
        </button>
      </div>
    </div>
  );
}
