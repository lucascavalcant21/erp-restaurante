"use client";

import { useState } from "react";
import { Sun, Moon, CheckCircle2, Circle, ChevronDown, ClipboardList, User } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Field, TextInput, Btn, Toast,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";

const TAREFAS = {
  abertura: [
    { id: "ab1", label: "Conferência do fundo de caixa (troco)", detalhe: "Verificar se o valor inicial está correto e registrar." },
    { id: "ab2", label: "Temperatura das geladeiras e câmaras", detalhe: "0°C–4°C para refrigerados, abaixo de -18°C para congelados." },
    { id: "ab3", label: "Estoque diário de hortifrúti", detalhe: "Checar validade, aparência e quantidade dos frescos." },
    { id: "ab4", label: "Limpeza do ambiente de atendimento", detalhe: "Mesas, balcão e piso prontos para abertura." },
    { id: "ab5", label: "Conferência das comandas do dia anterior", detalhe: "Verificar pendências do turno anterior no sistema." },
  ],
  fechamento: [
    { id: "fe1", label: "Higienização da linha de produção", detalhe: "Equipamentos, superfícies e utensílios sanitizados." },
    { id: "fe2", label: "Sangria de caixa e fechamento do cartão", detalhe: "Retirar excedente e gerar o relatório de fechamento." },
    { id: "fe3", label: "Comandas em aberto no sistema", detalhe: "Garantir que nenhuma comanda ficou sem baixa." },
    { id: "fe4", label: "Registro de temperatura final", detalhe: "Anotar no log e fechar as câmaras corretamente." },
    { id: "fe5", label: "Trancamento e alarme da unidade", detalhe: "Checar portas/janelas e acionar a segurança." },
  ],
};

export default function RotinaPage() {
  const { unidadeInfo } = useERP();
  const [turno, setTurno] = useState("abertura");
  const [feitas, setFeitas] = useState({});          // { taskId: true }
  const [exp, setExp] = useState(null);
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");
  const [registrado, setRegistrado] = useState(false);

  const lista = TAREFAS[turno];
  const concluidas = lista.filter((t) => feitas[t.id]).length;
  const pct = Math.round((concluidas / lista.length) * 100);
  const cor = pct === 100 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#F97316";

  function toggle(id) { setFeitas((p) => ({ ...p, [id]: !p[id] })); setRegistrado(false); }
  function trocar(t) { setTurno(t); setExp(null); setRegistrado(false); }
  function finalizar() {
    if (pct < 100 || !responsavel.trim()) return;
    setRegistrado(true);
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Rotina da Loja" subtitle={`Abertura e fechamento · ${unidadeInfo.nome}`} icon={ClipboardList} />
      <PageBody>
        {/* Seletor de turno */}
        <div className="erp-card p-1.5 flex gap-1.5">
          {[{ id: "abertura", label: "Abertura", Icon: Sun }, { id: "fechamento", label: "Fechamento", Icon: Moon }].map(({ id, label, Icon }) => {
            const ativo = turno === id;
            return (
              <button key={id} onClick={() => trocar(id)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={ativo ? { background: "var(--accent-strong)", color: "#fff" } : { color: "var(--dim)" }}>
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>

        {/* Progresso */}
        <Card>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="erp-label">Progresso do turno</p>
              <p className="text-4xl font-bold leading-none" style={{ color: "var(--fg)" }}>{pct}%</p>
            </div>
            <p className="text-[11px]" style={{ color: "var(--dim)" }}>{concluidas} de {lista.length} tarefas</p>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--elevated)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
          </div>
        </Card>

        {/* Checklist */}
        <div>
          <SectionLabel>Checklist — {turno === "abertura" ? "Abertura" : "Fechamento"}</SectionLabel>
          <div className="space-y-2">
            {lista.map((t) => {
              const ok = !!feitas[t.id];
              const aberto = exp === t.id;
              return (
                <Card key={t.id} className="!p-0 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <button onClick={() => toggle(t.id)} className="flex-shrink-0 active:scale-90 transition-transform">
                      {ok ? <CheckCircle2 size={24} style={{ color: "var(--accent-fg)" }} /> : <Circle size={24} style={{ color: "var(--faint)" }} />}
                    </button>
                    <p className="flex-1 text-sm font-bold leading-tight" style={{ color: ok ? "var(--dim)" : "var(--fg)", textDecoration: ok ? "line-through" : "none" }}>{t.label}</p>
                    <button onClick={() => setExp(aberto ? null : t.id)} className="flex-shrink-0 p-1">
                      <ChevronDown size={16} style={{ color: "var(--dim)", transform: aberto ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />
                    </button>
                  </div>
                  {aberto && (
                    <p className="px-4 pb-4 text-xs font-medium leading-relaxed" style={{ color: "var(--subtle)", borderTop: "1px solid var(--line)", paddingTop: 12 }}>{t.detalhe}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Responsável */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--elevated)" }}><User size={15} style={{ color: "var(--muted)" }} /></div>
            <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>Registro do responsável</p>
          </div>
          <Field label="Responsável pelo turno"><TextInput value={responsavel} onChange={(e) => { setResponsavel(e.target.value); setRegistrado(false); }} placeholder="Nome de quem assina a rotina" /></Field>
          <Field label="Observações (opcional)"><TextInput value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Algo relevante do turno..." /></Field>
        </Card>

        {registrado ? (
          <div className="erp-card p-5 flex flex-col items-center text-center gap-2">
            <CheckCircle2 size={36} style={{ color: "var(--accent-fg)" }} />
            <p className="text-base font-bold" style={{ color: "var(--fg)" }}>Rotina registrada!</p>
            <p className="text-xs" style={{ color: "var(--subtle)" }}>
              {turno === "abertura" ? "Abertura" : "Fechamento"} de {unidadeInfo.nome} por <b style={{ color: "var(--fg-soft)" }}>{responsavel}</b>
            </p>
          </div>
        ) : (
          <Btn variant="primary" className="w-full !h-12" disabled={pct < 100 || !responsavel.trim()} onClick={finalizar}>
            {pct === 100 ? "Finalizar e registrar rotina" : `Conclua as tarefas (${lista.length - concluidas} restantes)`}
          </Btn>
        )}
      </PageBody>
    </div>
  );
}
