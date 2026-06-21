"use client";

import { useRouter } from "next/navigation";
import { PageHeader, PageBody, Card } from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { podeAcessar } from "../../lib/auth";

export default function RHPage() {
  const router = useRouter();
  const { sessao } = useERP();

  const opcoes = [
    { id: "gestao_rh", emoji: "👥", titulo: "Gestão de Equipe", desc: "Controle de funcionários, contratos e folha", href: "/dashboard/rh/gestao" },
    { id: "ponto", emoji: "⏱️", titulo: "Controle de Ponto", desc: "Registros de entrada, saída e horas", href: "/dashboard/rh/ponto" },
    { id: "recrutamento", emoji: "🎯", titulo: "Banco de Talentos", desc: "Triagem automática de currículos e vagas", href: "/dashboard/rh/recrutamento" },
    { id: "colaborador", emoji: "🪪", titulo: "Meu Portal", desc: "Acesso aos meus dados, holerites e benefícios", href: "/dashboard/rh/colaborador" },
  ].filter(op => sessao ? podeAcessar(sessao.papel, op.id) : false);

  return (
    <div className="min-h-screen">
      <PageHeader title="👥 Recursos Humanos" subtitle="Gestão de pessoas" back={true} />
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
