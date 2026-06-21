"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarClock, AlertTriangle, CheckCircle, Clock, Check, XCircle, TrendingDown } from "lucide-react";
import { PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, Chips, SearchBar, EmptyState, fmtData, fmtBRL } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchEtiquetas, atualizarStatusEtiqueta } from "../../../lib/etiquetas";

function statusValidade(iso) {
  const dias = Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
  if (dias < 0)  return { tier: "vencido", cor: "#EF4444", dias };
  if (dias <= 2) return { tier: "critico", cor: "#F97316", dias };
  if (dias <= 7) return { tier: "atencao", cor: "#F59E0B", dias };
  return { tier: "ok", cor: "#10B981", dias };
}
function textoDias(dias) {
  if (dias < 0) return `vencido há ${Math.abs(dias)}d`;
  if (dias === 0) return "vence hoje";
  return `faltam ${dias}d`;
}
function fmtHora(iso) { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`; }

export default function ValidadePage() {
  const { unidadeAtiva, unidadeInfo, unidades } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setLoading(true);
    setLista(await fetchEtiquetas(unidadeAtiva, 500));
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  async function mudarStatus(e, status) {
    setLista((p) => p.map((item) => item.id === e.id ? { ...item, status } : item));
    await atualizarStatusEtiqueta(e, status);
  }

  const itens = useMemo(() => lista.map((e) => {
    const st = statusValidade(e.validade_em);
    return { ...e, st, dias: st.dias, valor: (Number(e.quantidade) || 0) * (Number(e.custo_unit) || 0), status: e.status || "ativa" };
  }), [lista]);

  const ativos = itens.filter((e) => e.status === "ativa");
  const perdas = itens.filter((e) => e.status === "perda");
  const baixados = itens.filter((e) => e.status === "baixa");

  const resumo = useMemo(() => ({
    vencidosSemBaixa: ativos.filter((e) => e.dias < 0).length,
    valorPendente: ativos.filter((e) => e.dias < 0).reduce((s, e) => s + e.valor, 0),
    vencendo: ativos.filter((e) => e.dias >= 0 && e.dias <= 7).length,
    noPrazo: ativos.filter((e) => e.dias > 7).length,
    perdasValor: perdas.reduce((s, e) => s + e.valor, 0),
  }), [ativos, perdas]);

  const base = filtro === "perdas" ? perdas : filtro === "baixados" ? baixados : ativos;
  const filtradas = useMemo(() => base.filter((e) => {
    const q = busca.toLowerCase().trim();
    const mb = !q || e.produto?.toLowerCase().includes(q) || (e.codigo || "").toLowerCase().includes(q);
    let mf = true;
    if (filtro === "vencendo") mf = e.dias >= 0 && e.dias <= 7;
    if (filtro === "vencidos") mf = e.dias < 0;
    return mb && mf;
  }), [base, busca, filtro]);

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
      <PageHeader title="Controle de Validade" subtitle={`FEFO + perdas · ${unidadeInfo.nome}`} icon={CalendarClock}
        onAction={carregar} actionLabel="Atualizar" />
      <PageBody>
        {/* Alertas */}
        {resumo.vencidosSemBaixa > 0 && (
          <Card style={{ background: "rgba(239,68,68,0.12)", borderColor: "#EF4444" }} className="flex items-center gap-3">
            <AlertTriangle size={22} style={{ color: "#EF4444", flexShrink: 0 }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#DC2626" }}>{resumo.vencidosSemBaixa} produto(s) VENCIDO(S) sem baixa</p>
              <p className="text-[12px]" style={{ color: "var(--muted)" }}>Possível perda de <b style={{ color: "#DC2626" }}>{fmtBRL(resumo.valorPendente)}</b> — registre baixa (usado) ou perda.</p>
            </div>
          </Card>
        )}
        {resumo.vencendo > 0 && (
          <Card style={{ background: "var(--warning-soft)" }} className="flex items-center gap-3">
            <Clock size={20} style={{ color: "#F59E0B", flexShrink: 0 }} />
            <p className="text-sm font-bold" style={{ color: "#B45309" }}>{resumo.vencendo} produto(s) vencem em até 7 dias — use primeiro!</p>
          </Card>
        )}

        <KpiGrid>
          <Kpi icon={AlertTriangle} label="Vencidos s/ baixa" value={resumo.vencidosSemBaixa} tint={resumo.vencidosSemBaixa > 0 ? "#EF4444" : "var(--muted)"} />
          <Kpi icon={Clock} label="Vencendo ≤7d" value={resumo.vencendo} tint={resumo.vencendo > 0 ? "#F59E0B" : "var(--muted)"} />
          <Kpi icon={CheckCircle} label="No prazo" value={resumo.noPrazo} tint="#10B981" />
          <Kpi icon={TrendingDown} label="Perdas (R$)" value={fmtBRL(resumo.perdasValor)} tint={resumo.perdasValor > 0 ? "#EF4444" : "var(--muted)"} />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por produto ou código..." />
        <Chips options={[
          { value: "todos", label: "Ativos" }, { value: "vencendo", label: "🟠 Vencendo" },
          { value: "vencidos", label: "🔴 Vencidos" }, { value: "perdas", label: "💸 Perdas" }, { value: "baixados", label: "✔ Baixados" },
        ]} value={filtro} onChange={setFiltro} />

        <div>
          <SectionLabel>{grupos.length} produto{grupos.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={CalendarClock} title="Carregando..." />
          ) : grupos.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nada aqui" hint="Gere etiquetas (Imprimir/Salvar) para alimentar o controle." />
          ) : (
            <div className="space-y-3">
              {grupos.map((g) => (
                <Card key={g.produto} className="!p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{g.produto}</p>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{g.items.length} lote{g.items.length > 1 ? "s" : ""} · {g.totalQtd} un</p>
                    </div>
                  </div>
                  {g.items.map((e, idx) => (
                    <div key={e.id} className="px-4 py-2.5" style={{ borderBottom: idx < g.items.length - 1 ? "1px solid var(--line-soft)" : "none", borderLeft: `3px solid ${e.st.cor}` }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>{e.quantidade} {e.unidade}</span>
                            {filtro !== "perdas" && filtro !== "baixados" && idx === 0 && e.dias >= 0 && <span className="erp-badge erp-badge-ok">usar 1º</span>}
                            {e.valor > 0 && <span className="text-[11px]" style={{ color: "var(--dim)" }}>· {fmtBRL(e.valor)}</span>}
                          </div>
                          <p className="text-[11px]" style={{ color: "var(--dim)" }}>vence {fmtData(e.validade_em)} {fmtHora(e.validade_em)} · #{e.codigo} {unidadeAtiva === "todas" && e.unidade_id ? `· 📍 ${unidades.find(u => u.id === e.unidade_id)?.nome || e.unidade_id}` : ""}</p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: e.st.cor + "22", color: e.st.cor }}>{textoDias(e.dias)}</span>
                      </div>
                      {e.status === "ativa" && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => mudarStatus(e, "baixa")} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg erp-badge-ok"><Check size={12} /> Dar baixa (usado)</button>
                          <button onClick={() => mudarStatus(e, "perda")} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg erp-badge-danger"><XCircle size={12} /> Registrar perda</button>
                        </div>
                      )}
                      {e.status !== "ativa" && (
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[11px] font-bold" style={{ color: e.status === "perda" ? "#DC2626" : "var(--accent-fg)" }}>
                            {e.status === "perda" ? `💸 Perda ${fmtBRL(e.valor)}` : "✔ Baixa (consumido)"}
                          </span>
                          <button onClick={() => mudarStatus(e, "ativa")} className="text-[11px] font-bold" style={{ color: "var(--dim)" }}>desfazer</button>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}
