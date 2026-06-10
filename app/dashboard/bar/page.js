"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { PageHeader, PageBody, Card } from "../../components/ui";

export default function BarPage() {
  const { setDepartamento } = useERP();
  const router = useRouter();

  useEffect(() => {
    setDepartamento("bar");
  }, [setDepartamento]);

  const opcoes = [
    { id: "vendas", emoji: "🛒", titulo: "PDV — Vendas", desc: "Gerenciar vendas do balcão", href: "/dashboard/vendas" },
    { id: "drinks", emoji: "🍹", titulo: "Cardápio Drinks", desc: "Drinks, coquetéis e mocktails", href: "/dashboard/operacao/drinks" },
    { id: "estoque", emoji: "📦", titulo: "Estoque", desc: "Controle de ingredientes e bebidas", href: "/dashboard/operacao/estoque" },
    { id: "ingredientes", emoji: "🧪", titulo: "Ingredientes", desc: "Cadastro e gerenciamento", href: "/dashboard/operacao/ingredientes" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title="🍹 Bar" subtitle="Gerenciamento de bebidas e drinks" back={true} />
      <PageBody>
        <div className="space-y-3">
          {opcoes.map((op) => (
            <Card key={op.id} className="!p-4 cursor-pointer hover:opacity-80 transition" onClick={() => router.push(op.href)}>
              <div className="flex items-center gap-4">
                <div className="text-3xl">{op.emoji}</div>
                <div className="flex-1">
                  <p className="text-lg font-bold" style={{ color: "var(--fg)" }}>{op.titulo}</p>
                  <p className="text-sm" style={{ color: "var(--dim)" }}>{op.desc}</p>
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
