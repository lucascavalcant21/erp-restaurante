"use client";

import { useRouter } from "next/navigation";
import { PageHeader, PageBody, Card } from "../../components/ui";

export default function GestaoPage() {
  const router = useRouter();

  const opcoes = [
    { id: "validade", emoji: "⏰", titulo: "Controle de Validade", desc: "Rastreamento de vencimentos de insumos", href: "/dashboard/operacao/validade" },
    { id: "suprimentos", emoji: "📦", titulo: "Estoque Central de Suprimentos", desc: "Controle e distribuição de material de limpeza para as lojas", href: "/dashboard/gestao/suprimentos" },
    { id: "notas", emoji: "🧾", titulo: "Notas Fiscais & DANFEs", desc: "Digitalização e OCR de notas de entrada", href: "/dashboard/operacao/notas" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title="⚙️ Gestão" subtitle="Operações transversais e controles" back={true} />
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
