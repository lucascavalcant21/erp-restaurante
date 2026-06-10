"use client";

import { useRouter } from "next/navigation";
import { Wine, ChefHat, Beer } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { DEPARTAMENTOS } from "../../lib/unidades";
import { PageHeader, PageBody, Card } from "../../components/ui";

export default function DepartamentosPage() {
  const { unidadeAtiva, unidadeInfo, setDepartamento } = useERP();
  const router = useRouter();

  if (unidadeAtiva === "todas") {
    return (
      <div className="min-h-screen">
        <PageHeader title="Selecione um Restaurante" subtitle="Escolha uma unidade para começar" back={false} />
        <PageBody>
          <p style={{ color: "var(--dim)" }}>Selecione um restaurante no menu lateral para acessar seus departamentos.</p>
        </PageBody>
      </div>
    );
  }

  const departamentos = [
    { id: "bar", label: "🍹 Bar", desc: "Bebidas, Drinks, Coquetéis, Cervejas", href: "/dashboard/bar" },
    { id: "cozinha", label: "👨‍🍳 Cozinha", desc: "Cardápio, Estoque, Ingredientes, Fichas", href: "/dashboard/cozinha" },
    { id: "cervejas", label: "🍺 Cervejas", desc: "Catálogo e Estoque de Cervejas", href: "/dashboard/cervejas" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title={unidadeInfo.nome} subtitle="Escolha um departamento" back={true} />
      <PageBody>
        <div className="space-y-3">
          {departamentos.map((dept) => (
            <Card key={dept.id} className="!p-4 cursor-pointer hover:opacity-80 transition" onClick={() => { setDepartamento(dept.id); router.push(dept.href); }}>
              <div className="flex items-center gap-4">
                <div className="text-3xl">{dept.label.split(" ")[0]}</div>
                <div className="flex-1">
                  <p className="text-lg font-bold" style={{ color: "var(--fg)" }}>{dept.label}</p>
                  <p className="text-sm" style={{ color: "var(--dim)" }}>{dept.desc}</p>
                </div>
                <div style={{ color: "var(--muted)" }}>→</div>
              </div>
            </Card>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
