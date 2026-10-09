import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays } from "lucide-react";

export default function RhNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abaAtiva = searchParams.get("aba") || "visao";

  const tabs = [
    { id: "visao", label: "Visão Geral", icon: LayoutDashboard },
    { id: "quadro", label: "Quadro de Funcionários", icon: Users },
    { id: "escala", label: "Escala de Trabalho", icon: CalendarDays }
  ];

  return (
    <div className="bg-[var(--surface)] border-b border-[var(--line-soft)] px-4 pt-2 overflow-x-auto sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto flex gap-6">
        {tabs.map(t => {
          const ativo = abaAtiva === t.id;
          return (
            <button
              key={t.id}
              onClick={() => router.push(`/dashboard/rh${t.id === "visao" ? "" : `?aba=${t.id}`}`)}
              className={`flex items-center gap-2 pb-3 pt-1 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${
                ativo 
                  ? "border-emerald-600 text-emerald-700" 
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <t.icon size={16} className={ativo ? "text-emerald-600" : "text-slate-400"} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
