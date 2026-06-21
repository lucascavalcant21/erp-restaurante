"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Package, AlertTriangle, Users,
  TrendingUp, ChefHat, Crown, DollarSign,
} from "lucide-react";
import { fetchEstoque } from "../../lib/estoque";
import { fetchFuncionarios } from "../../lib/rh";
import { fetchCardapio } from "../../lib/cardapio";
import { fetchLancamentos } from "../../lib/financeiro";
import { useERP } from "../../context/ERPContext";

function fmtBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

// Calcula os indicadores de UMA unidade a partir das 3 fontes de dados
async function carregarUnidade(u) {
  const [est, fun, car, lan] = await Promise.all([
    fetchEstoque(u.id),
    fetchFuncionarios(u.id),
    fetchCardapio(u.id),
    fetchLancamentos(u.id),
  ]);
  const estoque = est.data || [];
  const equipe  = (fun.data || []).filter((f) => f.ativo !== false);
  const pratos  = (car.data || []).filter((p) => p.ativo !== false);

  const valorEstoque = estoque.reduce((a, i) => a + (i.quantidade || 0) * (i.custo_unitario ?? i.preco_unit ?? 0), 0);
  const criticos     = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0)).length;
  const folha        = equipe.reduce((a, f) => a + (Number(f.salario) || 0), 0);

  const cmvs = pratos
    .filter((p) => (Number(p.preco) || 0) > 0)
    .map((p) => ((Number(p.custo) || 0) / Number(p.preco)) * 100);
  const cmvMedio = cmvs.length ? cmvs.reduce((a, b) => a + b, 0) / cmvs.length : null;

  // Financeiro 30 dias
  const now = Date.now(), d30 = 30 * 86400000;
  const noPeriodo = (tipo) => (lan.data || []).filter((l) => l.tipo === tipo && new Date(l.data).getTime() >= now - d30).reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const receita30 = noPeriodo("entrada");
  const lucro30 = receita30 - noPeriodo("saida");

  return {
    ...u,
    itens: estoque.length, valorEstoque, criticos,
    equipe: equipe.length, folha,
    pratos: pratos.length, cmvMedio,
    receita30, lucro30,
  };
}

function KpiCentral({ icon: Icon, label, valor, cor }) {
  return (
    <div className="erp-card p-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--panel)" }}>
        <Icon size={16} style={{ color: cor || "var(--subtle)" }} />
      </div>
      <p className="text-xl font-bold" style={{ color: "var(--fg)" }}>{valor}</p>
      <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>{label}</p>
    </div>
  );
}

export default function RedePage() {
  const router = useRouter();
  const { unidades } = useERP();
  const [dados, setDados]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (unidades.length === 0) return;
    Promise.all(unidades.map(carregarUnidade)).then((res) => {
      if (vivo) { setDados(res); setLoading(false); }
    });
    return () => { vivo = false; };
  }, [unidades]);

  const total = useMemo(() => ({
    receita:      dados.reduce((a, u) => a + (u.receita30 || 0), 0),
    lucro:        dados.reduce((a, u) => a + (u.lucro30 || 0), 0),
    valorEstoque: dados.reduce((a, u) => a + u.valorEstoque, 0),
    criticos:     dados.reduce((a, u) => a + u.criticos, 0),
    equipe:       dados.reduce((a, u) => a + u.equipe, 0),
    folha:        dados.reduce((a, u) => a + u.folha, 0),
  }), [dados]);
  const maxReceita = Math.max(1, ...dados.map((u) => u.receita30 || 0));

  // Melhor CMV (menor) entre unidades que têm cardápio precificado
  const melhorCmv = useMemo(() => {
    const comCmv = dados.filter((u) => u.cmvMedio != null);
    if (!comCmv.length) return null;
    return comCmv.reduce((m, u) => (u.cmvMedio < m.cmvMedio ? u : m));
  }, [dados]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b px-4 pt-12 pb-3 flex items-center gap-3"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center erp-card">
          <ArrowLeft size={18} style={{ color: "var(--muted)" }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight flex items-center gap-2" style={{ color: "var(--fg)" }}>
            <Building2 size={18} style={{ color: "var(--muted)" }} /> Visão de Rede
          </h1>
          <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>
            Central · consolidado e comparativo das {unidades.length} unidades
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-6">

        {/* Consolidado da rede */}
        <div>
          <p className="erp-label mb-2">Consolidado da rede (30 dias)</p>
          <div className="grid grid-cols-2 gap-3">
            <KpiCentral icon={TrendingUp}    label="Receita da rede"   valor={fmtBRL(total.receita)} />
            <KpiCentral icon={DollarSign}    label="Lucro da rede"     valor={fmtBRL(total.lucro)} cor={total.lucro < 0 ? "#DC2626" : undefined} />
            <KpiCentral icon={DollarSign}    label="Valor em estoque"  valor={fmtBRL(total.valorEstoque)} />
            <KpiCentral icon={AlertTriangle} label="Itens críticos"    valor={total.criticos} cor={total.criticos > 0 ? "#DC2626" : undefined} />
            <KpiCentral icon={Users}         label="Colaboradores"     valor={total.equipe} />
            <KpiCentral icon={DollarSign}    label="Folha mensal"      valor={fmtBRL(total.folha)} />
          </div>
        </div>

        {/* Faturamento por unidade (comparativo) */}
        {!loading && total.receita > 0 && (
          <div>
            <p className="erp-label mb-2">Faturamento por unidade (30 dias)</p>
            <div className="erp-card p-4 space-y-3">
              {dados.slice().sort((a, b) => (b.receita30 || 0) - (a.receita30 || 0)).map((u) => (
                <div key={u.id}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--fg-soft)" }}><span className="w-2 h-2 rounded-full" style={{ background: u.cor }} />{u.nome}</span>
                    <span className="font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(u.receita30 || 0)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--panel)" }}>
                    <div className="h-full rounded-full" style={{ width: `${((u.receita30 || 0) / maxReceita) * 100}%`, background: u.cor }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Destaque: melhor CMV */}
        {melhorCmv && (
          <div className="erp-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)" }}>
              <Crown size={18} style={{ color: "var(--accent-fg)" }} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>Melhor CMV da rede</p>
              <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>
                {melhorCmv.nome} · {fmtPct(melhorCmv.cmvMedio)}
              </p>
            </div>
          </div>
        )}

        {/* Comparativo por unidade */}
        <div>
          <p className="erp-label mb-2">Por unidade</p>
          {loading ? (
            <div className="erp-card p-8 text-center text-sm" style={{ color: "var(--subtle)" }}>Carregando rede…</div>
          ) : (
            <div className="space-y-3">
              {dados.map((u) => (
                <div key={u.id} className="erp-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: u.cor }} />
                    <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{u.nome}</p>
                    {u.criticos > 0 && (
                      <span className="erp-badge erp-badge-danger ml-auto">{u.criticos} crítico{u.criticos > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Metric icon={TrendingUp} label="Receita 30d" valor={fmtBRL(u.receita30 || 0)} />
                    <Metric icon={DollarSign} label="Lucro 30d"  valor={fmtBRL(u.lucro30 || 0)} />
                    <Metric icon={Package}   label="Estoque" valor={fmtBRL(u.valorEstoque)} />
                    <Metric icon={Users}     label="Equipe"  valor={u.equipe} />
                    <Metric icon={ChefHat}   label="Pratos"  valor={u.pratos} />
                    <Metric icon={TrendingUp} label="CMV méd." valor={u.cmvMedio != null ? fmtPct(u.cmvMedio) : "—"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-center" style={{ color: "var(--elevated)" }}>
          Dados por unidade · rode a migração multiunidade no Supabase para separar por loja
        </p>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, valor }) {
  return (
    <div>
      <Icon size={14} style={{ color: "var(--dim)" }} className="mx-auto mb-1" />
      <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{valor}</p>
      <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>{label}</p>
    </div>
  );
}
