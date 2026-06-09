"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sun,
  Moon,
  CheckCircle2,
  Circle,
  ChevronDown,
  User,
  ClipboardList,
  Thermometer,
  Leaf,
  Sparkles,
  CreditCard,
  FileText,
  DollarSign,
} from "lucide-react";

// ─── Dados Iniciais das Tarefas ────────────────────────────────────────────────
const TAREFAS_INICIAIS = {
  abertura: [
    {
      id: "ab1",
      label: "Conferência do fundo de caixa (troco)",
      detalhe: "Verificar se o valor inicial está correto e registrar no sistema.",
      Icon: DollarSign,
      concluida: false,
    },
    {
      id: "ab2",
      label: "Checagem de temperatura das geladeiras e câmaras frias",
      detalhe: "Ideal entre 0°C–4°C para refrigerados e abaixo de -18°C para congelados.",
      Icon: Thermometer,
      concluida: false,
    },
    {
      id: "ab3",
      label: "Verificação do estoque diário de hortifrúti",
      detalhe: "Checar validade, aparência e quantidade dos insumos frescos (Tico Tico).",
      Icon: Leaf,
      concluida: false,
    },
    {
      id: "ab4",
      label: "Limpeza e organização do ambiente de atendimento",
      detalhe: "Mesas, cadeiras, balcão e piso prontos para abertura.",
      Icon: Sparkles,
      concluida: false,
    },
    {
      id: "ab5",
      label: "Conferência das comandas e sistemas do dia anterior",
      detalhe: "Verificar se não há pendências do turno anterior no sistema.",
      Icon: FileText,
      concluida: false,
    },
  ],
  fechamento: [
    {
      id: "fe1",
      label: "Limpeza e higienização completa da linha de produção",
      detalhe: "Todos os equipamentos, superfícies e utensílios devem ser sanitizados.",
      Icon: Sparkles,
      concluida: false,
    },
    {
      id: "fe2",
      label: "Sangria de caixa e fechamento da maquininha de cartão",
      detalhe: "Retirar o excedente do caixa e gerar o relatório de fechamento.",
      Icon: CreditCard,
      concluida: false,
    },
    {
      id: "fe3",
      label: "Conferência de comandas em aberto no sistema",
      detalhe: "Garantir que nenhuma comanda ficou sem baixa ou pagamento.",
      Icon: FileText,
      concluida: false,
    },
    {
      id: "fe4",
      label: "Registro de temperatura final das câmaras",
      detalhe: "Anotar temperatura no log de controle e fechar as câmaras corretamente.",
      Icon: Thermometer,
      concluida: false,
    },
    {
      id: "fe5",
      label: "Trancamento e alarme da unidade",
      detalhe: "Checar janelas, portas e acionar o sistema de segurança.",
      Icon: ClipboardList,
      concluida: false,
    },
  ],
};

const RESPONSAVEIS = [
  "Selecione o responsável…",
  "Lucas (Gerente)",
  "Ana (Supervisora)",
  "Carlos (Caixa)",
  "Maria (Cozinha)",
  "João (Estoque)",
  "Fernanda (Atendimento)",
];

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function RotinaPage() {
  const router = useRouter();

  const [turno, setTurno] = useState("abertura"); // "abertura" | "fechamento"
  const [tarefas, setTarefas] = useState(TAREFAS_INICIAIS);
  const [responsavel, setResponsavel] = useState(RESPONSAVEIS[0]);
  const [observacao, setObservacao] = useState("");
  const [expandida, setExpandida] = useState(null); // id da tarefa expandida
  const [registroFinalizado, setRegistroFinalizado] = useState(false);

  // ── Progresso ──────────────────────────────────────────────────────────────
  const listaTurno = tarefas[turno];
  const total = listaTurno.length;
  const concluidas = listaTurno.filter((t) => t.concluida).length;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const corBarra = pct === 100 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#f97316";
  const labelStatus =
    pct === 100 ? "Rotina Completa!" : pct >= 50 ? "Em Andamento" : "Iniciando…";

  // ── Handlers ───────────────────────────────────────────────────────────────
  function toggleTarefa(id) {
    setTarefas((prev) => ({
      ...prev,
      [turno]: prev[turno].map((t) =>
        t.id === id ? { ...t, concluida: !t.concluida } : t
      ),
    }));
    setRegistroFinalizado(false);
  }

  function toggleExpand(id) {
    setExpandida((prev) => (prev === id ? null : id));
  }

  function handleFinalizarRotina() {
    if (responsavel === RESPONSAVEIS[0]) {
      alert("Selecione o responsável antes de finalizar.");
      return;
    }
    if (pct < 100) {
      alert(`Ainda há ${total - concluidas} tarefa(s) pendente(s). Conclua todas para finalizar.`);
      return;
    }
    // TODO: persistir no Supabase: { turno, responsavel, observacao, data: new Date(), tarefas }
    setRegistroFinalizado(true);
  }

  function handleTrocarTurno(novoTurno) {
    setTurno(novoTurno);
    setExpandida(null);
    setRegistroFinalizado(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:10, background:"#0F172A", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Rotina da Loja</h1>
          <p className="text-[11px] text-dim font-medium">Controle de abertura e fechamento</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-dim font-medium">
            {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Seletor de Turno */}
        <div className="bg-card rounded-2xl border border-white/5  p-1.5 flex gap-1.5">
          {[
            { id: "abertura", label: "Abertura da Loja", Icon: Sun, cor: "#f59e0b" },
            { id: "fechamento", label: "Fechamento da Loja", Icon: Moon, cor: "#6366f1" },
          ].map(({ id, label, Icon, cor }) => {
            const ativo = turno === id;
            return (
              <button
                key={id}
                onClick={() => handleTrocarTurno(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-95 ${
                  ativo
                    ? "text-white "
                    : "text-dim hover:text-muted"
                }`}
                style={ativo ? { backgroundColor: cor } : {}}
              >
                <Icon size={16} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Painel de Progresso */}
        <div className="bg-card rounded-2xl border border-white/5  p-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold text-dim uppercase tracking-wider mb-0.5">Progresso do Turno</p>
              <p className="text-4xl font-black text-fg leading-none">{pct}%</p>
            </div>
            <div className="text-right">
              <p
                className="text-xs font-black px-3 py-1 rounded-full"
                style={{ backgroundColor: corBarra + "20", color: corBarra }}
              >
                {labelStatus}
              </p>
              <p className="text-[11px] text-dim font-medium mt-1.5">
                {concluidas} de {total} tarefas
              </p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="h-4 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%`, backgroundColor: corBarra }}
            />
          </div>

          {pct === 100 && (
            <div className="mt-3 flex items-center gap-2 text-accent">
              <CheckCircle2 size={16} />
              <span className="text-xs font-bold">Todas as tarefas concluídas!</span>
            </div>
          )}
        </div>

        {/* Lista de Tarefas */}
        <div>
          <p className="text-[11px] font-black text-dim uppercase tracking-wider mb-2 px-1">
            Checklist — {turno === "abertura" ? "Abertura" : "Fechamento"}
          </p>
          <div className="space-y-2">
            {listaTurno.map((tarefa) => {
              const isExp = expandida === tarefa.id;
              const TarefaIcon = tarefa.Icon;
              return (
                <div
                  key={tarefa.id}
                  className={`bg-card rounded-2xl border  overflow-hidden transition-all duration-200 ${
                    tarefa.concluida ? "border-accent/30 bg-brand-50" : "border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTarefa(tarefa.id)}
                      className="flex-shrink-0 active:scale-90 transition-transform"
                    >
                      {tarefa.concluida ? (
                        <CheckCircle2 size={24} className="text-accent" />
                      ) : (
                        <Circle size={24} className="text-elevated" />
                      )}
                    </button>

                    {/* Ícone da tarefa */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: tarefa.concluida ? "#10b98120" : "#f5f5f5",
                        color: tarefa.concluida ? "#10b981" : "#737373",
                      }}
                    >
                      <TarefaIcon size={15} />
                    </div>

                    {/* Texto */}
                    <p
                      className={`flex-1 text-sm font-bold leading-tight ${
                        tarefa.concluida
                          ? "line-through text-dim"
                          : "text-fg"
                      }`}
                    >
                      {tarefa.label}
                    </p>

                    {/* Expandir */}
                    <button
                      onClick={() => toggleExpand(tarefa.id)}
                      className="flex-shrink-0 p-1 rounded-lg active:bg-elevated transition-colors"
                    >
                      <ChevronDown
                        size={16}
                        className={`text-dim transition-transform duration-200 ${isExp ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Detalhe expansível */}
                  {isExp && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/5 mt-0">
                      <p className="text-xs text-subtle font-medium leading-relaxed pt-3">
                        {tarefa.detalhe}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Registro de Responsável */}
        <div className="bg-card rounded-2xl border border-white/5  p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-elevated flex items-center justify-center">
              <User size={15} className="text-muted" />
            </div>
            <p className="text-sm font-black text-fg">Registro do Responsável</p>
          </div>

          {/* Seletor de Responsável */}
          <div className="relative mb-3">
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="w-full appearance-none  border border-white/8 rounded-xl px-4 py-3 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all pr-10" style={{ background: "#1E293B", color: "#F1F5F9" }} >
              {RESPONSAVEIS.map((r) => (
                <option key={r} value={r} disabled={r === RESPONSAVEIS[0]}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none"
            />
          </div>

          {/* Campo de Observação */}
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observações do turno (opcional)…"
            rows={3}
            className="w-full  border border-white/8 rounded-xl px-4 py-3 text-sm text-fg-soft font-medium placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
          />
        </div>

        {/* Botão de Finalizar */}
        {!registroFinalizado ? (
          <button
            onClick={handleFinalizarRotina}
            className={`w-full py-4 rounded-2xl font-black text-base  active:scale-95 transition-all duration-200 ${
              pct === 100 && responsavel !== RESPONSAVEIS[0]
                ? "bg-accent text-white shadow-accent/30"
                : "bg-elevated text-dim shadow-none"
            }`}
          >
            {pct === 100 ? "Finalizar e Registrar Rotina" : `Conclua as tarefas (${total - concluidas} restantes)`}
          </button>
        ) : (
          <div className="bg-brand-50 border border-accent/30 rounded-2xl p-5 flex flex-col items-center text-center gap-2">
            <CheckCircle2 size={36} className="text-accent" />
            <p className="text-base font-black text-fg">Rotina Registrada!</p>
            <p className="text-xs text-subtle font-medium">
              Turno de{" "}
              <span className="font-bold capitalize">{turno}</span> finalizado por{" "}
              <span className="font-bold text-fg-soft">{responsavel}</span>.
            </p>
            {/* TODO: exibir timestamp da persistência no Supabase */}
            <p className="text-[11px] text-dim mt-1">
              {new Date().toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
