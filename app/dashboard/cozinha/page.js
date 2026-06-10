"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { PageHeader, PageBody, Card } from "../../components/ui";

export default function CozinhaPage() {
  const { setDepartamento } = useERP();
  const router = useRouter();

  useEffect(() => {
    setDepartamento("cozinha");
  }, [setDepartamento]);

  const opcoes = [
    { id: "cardapio", emoji: "🍽️", titulo: "Cardápio", desc: "Menu completo, preços de venda e composição", href: "/dashboard/operacao/cardapio" },
    { id: "rotina", emoji: "📋", titulo: "Operação", desc: "Fluxo de trabalho diário, tarefas e metas", href: "/dashboard/operacao/rotina" },
    { id: "fichas", emoji: "📄", titulo: "Fichas Técnicas", desc: "Receitas, modo de preparo e ingredientes", href: "/dashboard/operacao/fichas" },
    { id: "montagem", emoji: "📝", titulo: "Montagem", desc: "Fichas de montagem com foto e passo a passo", href: "/dashboard/operacao/montagem?dept=cozinha" },
    { id: "estoque", emoji: "📦", titulo: "Estoque", desc: "Controle de ingredientes e insumos", href: "/dashboard/operacao/estoque" },
    { id: "ingredientes", emoji: "🧪", titulo: "Ingredientes", desc: "Cadastro, preços de compra e unidades", href: "/dashboard/operacao/ingredientes" },
    { id: "fornecedores", emoji: "🚚", titulo: "Fornecedores", desc: "Base de fornecedores e negociações", href: "/dashboard/operacao/fornecedores" },
    { id: "etiquetas", emoji: "🏷️", titulo: "Etiquetas", desc: "Geração de etiquetas e códigos QR para insumos", href: "/dashboard/operacao/etiquetas" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title="👨‍🍳 Cozinha" subtitle="Gerenciamento de alimentos e receitas" back={true} />
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
