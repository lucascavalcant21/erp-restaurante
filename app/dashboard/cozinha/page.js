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
    { id: "cardapio", emoji: "🍽️", titulo: "Cardápio", desc: "Pratos, receitas e preços", href: "/dashboard/operacao/cardapio" },
    { id: "rotina", emoji: "📋", titulo: "Operação", desc: "Rotina diária da cozinha", href: "/dashboard/operacao/rotina" },
    { id: "fichas", emoji: "📄", titulo: "Fichas Técnicas", desc: "Receitas e composição de pratos", href: "/dashboard/operacao/fichas" },
    { id: "estoque", emoji: "📦", titulo: "Estoque", desc: "Controle de ingredientes", href: "/dashboard/operacao/estoque" },
    { id: "ingredientes", emoji: "🧪", titulo: "Ingredientes", desc: "Cadastro e gerenciamento", href: "/dashboard/operacao/ingredientes" },
    { id: "fornecedores", emoji: "🚚", titulo: "Fornecedores", desc: "Contatos e condições", href: "/dashboard/operacao/fornecedores" },
    { id: "validade", emoji: "⏰", titulo: "Controle de Validade", desc: "Rastreamento de vencimentos", href: "/dashboard/operacao/validade" },
    { id: "etiquetas", emoji: "🏷️", titulo: "Etiquetas (QR)", desc: "Gerador de códigos QR", href: "/dashboard/operacao/etiquetas" },
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
