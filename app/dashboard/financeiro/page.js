"use client";

import { useRouter } from "next/navigation";
import { PageHeader, PageBody, Card } from "../../components/ui";

export default function FinanceiroPage() {
  const router = useRouter();

  const opcoes = [
    { id: "rede", emoji: "📊", titulo: "Visão Consolidada", desc: "Resultados consolidados de todas as unidades", href: "/dashboard/rede" },
    { id: "dre", emoji: "📑", titulo: "DRE", desc: "Demonstrativo de Resultado do Exercício", href: "/dashboard/financeiro/dre" },
    { id: "fluxo", emoji: "💸", titulo: "Fluxo de Caixa", desc: "Entradas, saídas e saldo do período", href: "/dashboard/financeiro/fluxo" },
    { id: "cmv", emoji: "%", titulo: "CMV", desc: "Custo da mercadoria vendida e indicadores", href: "/dashboard/financeiro/cmv" },
    { id: "margem", emoji: "📈", titulo: "Lucro", desc: "Margem de lucro e rentabilidade", href: "/dashboard/financeiro/margem" },
    { id: "documentos", emoji: "📄", titulo: "Notas e Boletos", desc: "Documentos fiscais e a pagar/receber", href: "/dashboard/financeiro/documentos" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title="💰 Financeiro" subtitle="Gestão financeira e indicadores" back={true} />
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
