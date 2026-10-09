import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays } from "lucide-react";

export default function RhNav() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { label: "Visão Geral", path: "/dashboard/rh", icon: LayoutDashboard },
    { label: "Quadro de Funcionários", path: "/dashboard/rh/colaborador", icon: Users },
    { label: "Escala de Trabalho", path: "/dashboard/rh/semana", icon: CalendarDays }
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-4 pt-2 overflow-x-auto sticky top-[73px] z-10 sm:top-0 shadow-sm">
      <div className="max-w-7xl mx-auto flex gap-6">
        {tabs.map(t => {
          const ativo = pathname === t.path;
          return (
            <button
              key={t.path}
              onClick={() => router.push(t.path)}
              className={\`flex items-center gap-2 pb-3 pt-1 border-b-2 font-bold text-sm transition-colors whitespace-nowrap \${
                ativo 
                  ? "border-emerald-600 text-emerald-700" 
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }\`}
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
