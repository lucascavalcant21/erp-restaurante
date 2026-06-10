"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, LogIn, LogOut, Users } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, EmptyState, Toast,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchFuncionarios, fetchPontoMes, registrarPonto } from "../../../lib/rh";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function horaAgora() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

export default function PontoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [funcs, setFuncs]     = useState([]);
  const [pontos, setPontos]   = useState({}); // { func_id: { entrada, saida } }
  const [loading, setLoading] = useState(true);
  const [salvou, setSalvou]   = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: fs } = await fetchFuncionarios(unidadeAtiva);
    const ativos = (fs || []).filter((f) => f.ativo !== false);
    setFuncs(ativos);
    const mes = hojeISO().slice(0, 7);
    const { data: regs } = await fetchPontoMes(mes);
    const hoje = hojeISO();
    const mapa = {};
    (regs || []).filter((r) => r.data === hoje).forEach((r) => { mapa[r.func_id] = { entrada: r.entrada, saida: r.saida }; });
    setPontos(mapa);
    setLoading(false);
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  async function bater(func, tipo) {
    const hora = horaAgora();
    setPontos((p) => ({ ...p, [func.id]: { ...(p[func.id] || {}), [tipo]: hora } }));
    await registrarPonto(func.id, hojeISO(), tipo, hora);
    setSalvou(`${tipo === "entrada" ? "Entrada" : "Saída"} de ${func.nome.split(" ")[0]} registrada`);
    setTimeout(() => setSalvou(""), 2200);
  }

  const presentes = funcs.filter((f) => pontos[f.id]?.entrada && !pontos[f.id]?.saida).length;

  return (
    <div className="min-h-screen">
      <PageHeader title="Controle de Ponto" subtitle={`Registro de hoje · ${unidadeInfo.nome}`} icon={Clock} />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <KpiGrid>
          <Kpi icon={Users} label="Equipe ativa" value={funcs.length} tint="var(--accent-fg)" />
          <Kpi icon={Clock} label="Presentes agora" value={presentes} tint="#10B981" />
        </KpiGrid>

        <div>
          <SectionLabel>Ponto de hoje — {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</SectionLabel>
          {loading ? (
            <EmptyState icon={Clock} title="Carregando..." />
          ) : funcs.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum colaborador ativo" hint="Cadastre a equipe em RH para registrar o ponto." />
          ) : (
            <div className="space-y-2">
              {funcs.map((f) => {
                const p = pontos[f.id] || {};
                return (
                  <Card key={f.id} className="!p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>{f.nome?.[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{f.nome}</p>
                        <p className="text-[11px]" style={{ color: "var(--dim)" }}>
                          Entrada: <b style={{ color: p.entrada ? "var(--accent-fg)" : "var(--dim)" }}>{p.entrada || "—"}</b> · Saída: <b style={{ color: p.saida ? "#DC2626" : "var(--dim)" }}>{p.saida || "—"}</b>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => bater(f, "entrada")} disabled={!!p.entrada}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg erp-badge-ok disabled:opacity-40"><LogIn size={13} /> Entrada</button>
                      <button onClick={() => bater(f, "saida")} disabled={!p.entrada || !!p.saida}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg disabled:opacity-40" style={{ background: "var(--danger-soft)", color: "#DC2626" }}><LogOut size={13} /> Saída</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}
