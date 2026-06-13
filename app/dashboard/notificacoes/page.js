"use client";

import { useState, useMemo, useEffect } from "react";
import { Bell, AlertTriangle, Calendar, Info, Megaphone, CheckCheck, Trash2, ChevronRight, Brain, Lightbulb } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Chips, EmptyState, Btn,
} from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { useRouter } from "next/navigation";
import { UNIDADES } from "../../lib/unidades";
import { carregarDadosDaUnidade, consolidarRede, gerarInsights } from "../../lib/cerebro";

const TIPO = {
  estoque_critico: { Icon: AlertTriangle, cor: "#EF4444", label: "Estoque", href: "/dashboard/operacao/estoque" },
  evento_proximo:  { Icon: Calendar,      cor: "#F59E0B", label: "Evento",  href: "/dashboard/operacao/eventos" },
  sistema:         { Icon: Info,          cor: "#3B82F6", label: "Sistema", href: null },
  aviso:           { Icon: Megaphone,     cor: "#8B5CF6", label: "Aviso",   href: null },
};

function tempoRel(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export default function NotificacoesPage() {
  const router = useRouter();
  const { notificacoes, marcarLida, marcarTodasLidas, removerNotificacao, limparLidas, unidadeAtiva } = useERP();
  const [filtro, setFiltro] = useState("todas");
  
  // Estado para os insights do Cérebro
  const [insights, setInsights] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const FILTROS = [
    { value: "todas", label: "Todas" },
    { value: "nao_lidas", label: "Não lidas" },
    { value: "estoque_critico", label: "Estoque" },
    { value: "evento_proximo", label: "Eventos" },
  ];

  if (unidadeAtiva === "todas") {
    FILTROS.push({ value: "insights", label: "💡 Insights do Cérebro" });
  }

  useEffect(() => {
    if (filtro === "insights" && insights.length === 0) {
      setLoadingInsights(true);
      Promise.all(UNIDADES.map(carregarDadosDaUnidade)).then(res => {
        const rede = consolidarRede(res);
        setInsights(gerarInsights(rede, res));
        setLoadingInsights(false);
      });
    }
  }, [filtro, insights.length]);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const filtradas = useMemo(() => notificacoes
    .filter((n) => filtro === "todas" ? true : filtro === "nao_lidas" ? !n.lida : n.tipo === filtro)
    .sort((a, b) => new Date(b.data) - new Date(a.data)), [notificacoes, filtro]);

  return (
    <div className="min-h-screen">
      <PageHeader title="Notificações" subtitle={naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}` : "Tudo em dia"} icon={Bell} />
      <PageBody>
        {naoLidas > 0 && filtro !== "insights" && (
          <Btn variant="ghost" className="w-full" onClick={marcarTodasLidas}><CheckCheck size={15} /> Marcar todas como lidas</Btn>
        )}

        <Chips options={FILTROS} value={filtro} onChange={setFiltro} />

        {filtro === "insights" ? (
          <div>
            <SectionLabel>Inteligência da Rede</SectionLabel>
            {loadingInsights ? (
              <div className="flex flex-col items-center justify-center p-10 gap-4">
                <Brain size={48} className="animate-pulse" style={{ color: "var(--accent)" }} />
                <p style={{ color: "var(--dim)", fontWeight: 600 }}>O Cérebro está calculando os alertas e dicas...</p>
              </div>
            ) : insights.length === 0 ? (
               <EmptyState icon={Brain} title="Tudo tranquilo por enquanto" hint="Não há alertas de desempenho ou dicas no momento." />
            ) : (
              <div className="space-y-3">
                {insights.map((ins, i) => {
                  let color, bg, borderColor;
                  switch (ins.tipo) {
                    case "perigo": color = "#EF4444"; bg = "rgba(239,68,68,0.08)"; borderColor = "rgba(239,68,68,0.3)"; break;
                    case "alerta": color = "#F59E0B"; bg = "rgba(245,158,11,0.08)"; borderColor = "rgba(245,158,11,0.3)"; break;
                    case "sucesso": color = "#10B981"; bg = "rgba(16,185,129,0.08)"; borderColor = "rgba(16,185,129,0.3)"; break;
                    default: color = "#3B82F6"; bg = "rgba(59,130,246,0.08)"; borderColor = "rgba(59,130,246,0.3)"; break;
                  }
                  return (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: bg, border: `1px solid ${borderColor}` }}>
                      <div className="mt-0.5">
                        {ins.tipo === "perigo" || ins.tipo === "alerta" ? <AlertTriangle size={20} color={color} /> : <Lightbulb size={20} color={color} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold mb-1" style={{ color: "var(--fg)" }}>{ins.titulo}</p>
                        <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--fg-soft)" }}>{ins.msg}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <SectionLabel>{filtradas.length} notificação{filtradas.length !== 1 ? "ões" : ""}</SectionLabel>
            {filtradas.length === 0 ? (
              <EmptyState icon={Bell} title={filtro === "nao_lidas" ? "Nenhuma não lida" : "Nenhuma notificação"}
                hint="Alertas de estoque, eventos e avisos aparecem aqui automaticamente." />
            ) : (
              <div className="space-y-2">
                {filtradas.map((n) => {
                  const cfg = TIPO[n.tipo] || TIPO.sistema;
                  return (
                    <Card key={n.id} className="!p-3" style={n.lida ? { opacity: 0.6 } : {}}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.cor + "22" }}>
                          <cfg.Icon size={16} style={{ color: cfg.cor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="erp-badge" style={{ background: cfg.cor + "22", color: cfg.cor }}>{cfg.label}</span>
                            <span className="text-[10px]" style={{ color: "var(--dim)" }}>{tempoRel(n.data)}</span>
                          </div>
                          <p className="text-sm font-bold mt-1" style={{ color: n.lida ? "var(--muted)" : "var(--fg)" }}>{n.titulo}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--subtle)" }}>{n.corpo}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {cfg.href && <button onClick={() => router.push(cfg.href)} className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "var(--muted)" }}>Ver módulo <ChevronRight size={12} /></button>}
                            {!n.lida && <button onClick={() => marcarLida(n.id)} className="text-[11px] font-bold" style={{ color: "var(--accent-fg)" }}>Marcar lida</button>}
                            <button onClick={() => removerNotificacao(n.id)} className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "#DC2626" }}><Trash2 size={11} /> Remover</button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
            {notificacoes.some((n) => n.lida) && (
              <button onClick={limparLidas} className="w-full mt-3 py-2.5 rounded-xl text-[11px] font-bold" style={{ border: "1px solid var(--line)", color: "var(--dim)" }}>
                Limpar notificações lidas
              </button>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
