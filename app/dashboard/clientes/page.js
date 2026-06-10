"use client";

import { useRouter } from "next/navigation";
import { PageHeader, PageBody, Card } from "../../components/ui";

export default function ClientesPage() {
  const router = useRouter();

  const opcoes = [
    { id: "crm", emoji: "🤝", titulo: "CRM", desc: "Base de clientes e relacionamento", href: "/dashboard/clientes/crm" },
    { id: "campanhas", emoji: "📣", titulo: "Tráfego Pago", desc: "Campanhas, investimento e conversões", href: "/dashboard/clientes/campanhas" },
    { id: "nps", emoji: "⭐", titulo: "Avaliações", desc: "Pesquisa de satisfação e NPS", href: "/dashboard/clientes/nps" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title="📱 Clientes & Marketing" subtitle="Relacionamento e crescimento" back={true} />
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
