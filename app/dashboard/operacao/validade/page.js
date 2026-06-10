"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarClock, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, Chips, EmptyState, fmtData } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchEtiquetas } from "../../../lib/etiquetas";

// Status por validade → cor (FEFO)
function statusValidade(iso) {
  const dias = Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
  if (dias < 0)  return { tier: "vencido", label: "Vencido",        cor: "#EF4444", dias };
  if (dias <= 2) return { tier: "critico", label: dias === 0 ? "Vence hoje" : `${dias}d`, cor: "#F97316", dias };
  if (dias <= 7) return { tier: "atencao", label: `${dias}d`,        cor: "#F59E0B", dias };
  return { tier: "ok", label: `${dias}d`, cor: "#10B981", dias };
}

function fmtHora(iso) { const d = new Date(iso); return `${String(d.getHours()).padStart(2,"0")}h${String(d.getMinutes()).padStart(2,"0")}`; }

export default function ValidadePage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");

  async function carregar() {
    setLoading(true);
    setLista(await fetchEtiquetas(unidadeAtiva, 500));
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const comStatus = useMemo(() => lista.map((e) => ({ ...e, st: statusValidade(e.validade_em) })), [lista]);

  const resumo = useMemo(() => {
    const q = (arr) => arr.reduce((s, e) => s + (Number(e.quantidade) || 0), 0);
    const vencidos = comStatus.filter((e) => e.st.tier === "vencido");
    const vencendo = comStatus.filter((e) => e.st.tier === "critico" || e.st.tier === "atencao");
    const ok = comStatus.filter((e) => e.st.tier === "ok");
    return { total: comStatus.length, vencidos: vencidos.length, vencendo: vencendo.length, ok: ok.length, qVencidos: q(vencidos), qVencendo: q(vencendo) };
  }, [comStatus]);

  const filtradas = useMemo(() => comStatus.filter((e) => {
    if (filtro === "todos") return true;
    if (filtro === "vencidos") return e.st.tier === "vencido";
    if (filtro === "vencendo") return e.st.tier === "critico" || e.st.tier === "atencao";
    return e.st.tier === "ok";
  }), [comStatus, filtro]);

  // Agrupa por produto, ordena lotes por validade (usar primeiro = mais perto de vencer)
  const grupos = useMemo(() => {
    const map = {};
    for (const e of filtradas) (map[e.produto] ||= []).push(e);
    return Object.entries(map).map(([produto, items]) => {
      items.sort((a, b) => new Date(a.validade_em) - new Date(b.validade_em));
      return { produto, items, totalQtd: items.reduce((s, i) => s + (Number(i.quantidade) || 0), 0) };
    }).sort((a, b) => new Date(a.items[0].validade_em) - new Date(b.items[0].validade_em));
  }, [filtradas]);

  return (
    <div className="min-h-screen">
      <PageHeader title="Controle de Validade" subtitle={`FEFO · use primeiro o que vence antes · ${unidadeInfo.nome}`} icon={CalendarClock}
        onAction={carregar} actionLabel="Atualizar" />
      <PageBody>
        <KpiGrid>
          <Kpi icon={AlertTriangle} label={`Vencidos (${resumo.qVencidos} un)`} value={resumo.vencidos} tint={resumo.vencidos > 0 ? "#EF4444" : "var(--muted)"} />
          <Kpi icon={Clock} label={`Vencendo ≤7d (${resumo.qVencendo} un)`} value={resumo.vencendo} tint={resumo.vencendo > 0 ? "#F59E0B" : "var(--muted)"} />
          <Kpi icon={CheckCircle} label="Dentro do prazo" value={resumo.ok} tint="#10B981" />
          <Kpi icon={CalendarClock} label="Total etiquetado" value={resumo.total} tint="var(--accent-fg)" />
        </KpiGrid>

        <Chips options={[{ value: "todos", label: "Todos" }, { value: "vencidos", label: "🔴 Vencidos" }, { value: "vencendo", label: "🟠 Vencendo" }, { value: "ok", label: "🟢 No prazo" }]} value={filtro} onChange={setFiltro} />

        <div>
          <SectionLabel>{grupos.length} produto{grupos.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={CalendarClock} title="Carregando..." />
          ) : grupos.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nada por aqui"
              hint="Crie etiquetas em Operação → Etiquetas (ao Imprimir/Salvar, elas entram no controle de validade)." />
          ) : (
            <div className="space-y-3">
              {grupos.map((g) => (
                <Card key={g.produto} className="!p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{g.produto}</p>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{g.items.length} lote{g.items.length > 1 ? "s" : ""} · {g.totalQtd} un no total</p>
                    </div>
                  </div>
                  <div>
                    {g.items.map((e, idx) => (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: idx < g.items.length - 1 ? "1px solid var(--line-soft)" : "none", borderLeft: `3px solid ${e.st.cor}` }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>{e.quantidade} {e.unidade}</span>
                            {idx === 0 && e.st.tier !== "vencido" && <span className="erp-badge erp-badge-ok">usar 1º</span>}
                          </div>
                          <p className="text-[11px]" style={{ color: "var(--dim)" }}>vence {fmtData(e.validade_em)} {fmtHora(e.validade_em)} · {e.conservacao}</p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: e.st.cor + "22", color: e.st.cor }}>{e.st.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}
