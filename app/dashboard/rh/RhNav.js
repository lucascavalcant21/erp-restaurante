import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays } from "lucide-react";
import CabecalhoTela from "../../components/ui/CabecalhoTela";

export default function RhNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abaAtiva = searchParams.get("aba") || "visao";

  const tabs = [
    { id: "visao", label: "Visão geral", icon: LayoutDashboard },
    { id: "quadro", label: "Quadro de funcionários", icon: Users },
    { id: "escala", label: "Escala de trabalho", icon: CalendarDays }
  ];

  // Visual do Nina (07/11/2026): cabeçalho padrão e abas em pílula.
  return (
    <>
      <CabecalhoTela titulo="Equipe" subtitulo="Pessoas, ponto, escala e folha" />
      <div className="sticky top-0 z-40 overflow-x-auto border-b border-hf-border bg-hf-bg/95 px-4 pb-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex gap-2" role="tablist" aria-label="Equipe">
          {tabs.map(t => {
            const ativo = abaAtiva === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={ativo}
                onClick={() => router.push(`/dashboard/rh${t.id === "visao" ? "" : `?aba=${t.id}`}`)}
                className={`flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold shadow-none transition-colors ${
                  ativo
                    ? "bg-hf-menu text-white"
                    : "border border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated"
                }`}
              >
                <t.icon size={16} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
