"use client";

import { useState, useMemo } from "react";
import { Bell, AlertTriangle, Calendar, Info, Megaphone, CheckCheck, Trash2, ChevronRight } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Chips, EmptyState, Btn,
} from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { useRouter } from "next/navigation";

const TIPO = {
  estoque_critico: { Icon: AlertTriangle, cor: "#EF4444", label: "Estoque", href: "/dashboard/operacao/estoque" },
  evento_proximo:  { Icon: Calendar,      cor: "#F59E0B", label: "Evento",  href: "/dashboard/operacao/eventos" },
  sistema:         { Icon: Info,          cor: "#3B82F6", label: "Sistema", href: null },
  aviso:           { Icon: Megaphone,     cor: "#8B5CF6", label: "Aviso",   href: null },
};

function tempoRel(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

const FILTROS = [
  { value: "todas", label: "Todas" },
  { value: "nao_lidas", label: "Não lidas" },
  { value: "estoque_critico", label: "Estoque" },
  { value: "evento_proximo", label: "Eventos" },
];

export default function NotificacoesPage() {
  const router = useRouter();
  const { notificacoes, marcarLida, marcarTodasLidas, removerNotificacao, limparLidas } = useERP();
  const [filtro, setFiltro] = useState("todas");

  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const filtradas = useMemo(() => notificacoes
    .filter((n) => filtro === "todas" ? true : filtro === "nao_lidas" ? !n.lida : n.tipo === filtro)
    .sort((a, b) => new Date(b.data) - new Date(a.data)), [notificacoes, filtro]);

  return (
    <div className="min-h-screen">
      <PageHeader title="Notificações" subtitle={naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}` : "Tudo em dia"} icon={Bell} />
      <PageBody>
        {naoLidas > 0 && (
          <Btn variant="ghost" className="w-full" onClick={marcarTodasLidas}><CheckCheck size={15} /> Marcar todas como lidas</Btn>
        )}

        <Chips options={FILTROS} value={filtro} onChange={setFiltro} />

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
                          <button onClick={() => removerNotificacao(n.id)} className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "#FCA5A5" }}><Trash2 size={11} /> Remover</button>
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
      </PageBody>
    </div>
  );
}
