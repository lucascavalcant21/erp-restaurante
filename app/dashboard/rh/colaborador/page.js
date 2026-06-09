"use client";

import { useState, useEffect } from "react";
import { Badge, DollarSign, CalendarDays, Bell, FileText, ChevronDown } from "lucide-react";
import { PageHeader, PageBody, Card, EmptyState } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { lerSessao, getPapel } from "../../../lib/auth";

function Secao({ icon: Icon, titulo, children, aberto: ab = false }) {
  const [aberto, setAberto] = useState(ab);
  return (
    <Card className="!p-0 overflow-hidden">
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}>
          <Icon size={15} style={{ color: "var(--muted)" }} />
        </div>
        <span className="flex-1 text-left text-sm font-bold" style={{ color: "var(--fg)" }}>{titulo}</span>
        <ChevronDown size={16} style={{ color: "var(--dim)", transform: aberto ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />
      </button>
      {aberto && <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>{children}</div>}
    </Card>
  );
}

export default function ColaboradorPage() {
  const { unidadeInfo } = useERP();
  const [sessao, setSessao] = useState(null);
  useEffect(() => { lerSessao().then(setSessao); }, []);
  const papel = sessao ? getPapel(sessao.papel) : null;

  return (
    <div className="min-h-screen">
      <PageHeader title="Portal do Colaborador" subtitle="Autosserviço da equipe" icon={Badge} />
      <PageBody>
        {/* Cartão do colaborador */}
        <Card className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
            {sessao?.nome?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold truncate" style={{ color: "var(--fg)" }}>{sessao?.nome || "Colaborador"}</p>
            <p className="text-[11px]" style={{ color: "var(--dim)" }}>{papel?.label || "—"} · {unidadeInfo.nome}</p>
          </div>
        </Card>

        <Secao icon={DollarSign} titulo="Meus holerites" aberto>
          <EmptyState icon={DollarSign} title="Nenhum holerite disponível" hint="Os holerites aparecem aqui quando o RH os emitir." />
        </Secao>
        <Secao icon={CalendarDays} titulo="Minha escala">
          <EmptyState icon={CalendarDays} title="Escala não publicada" hint="Sua escala da semana aparecerá aqui." />
        </Secao>
        <Secao icon={Bell} titulo="Avisos da empresa">
          <EmptyState icon={Bell} title="Sem avisos no momento" hint="Comunicados internos aparecerão aqui." />
        </Secao>
        <Secao icon={FileText} titulo="Documentos">
          <EmptyState icon={FileText} title="Nenhum documento" hint="Regulamentos e manuais ficarão disponíveis aqui." />
        </Secao>
      </PageBody>
    </div>
  );
}
