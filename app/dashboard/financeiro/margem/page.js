"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  Search,
  X,
  FileDown,
} from "lucide-react";
import { exportarTabelaPDF } from "../../../lib/exportPDF";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(val) {
  return `${Number(val).toFixed(1)}%`;
}

// ─── Dados (mock — substituir por join cardapio + fichas + ingredientes) ───────
const PRATOS = [
  { id: "p1", nome: "Marmitex Executiva",   categoria: "Marmita",        preco: 19.90, custo: 7.05,  vendas: 420 },
  { id: "p2", nome: "Suco Natural 500ml",    categoria: "Bebida",         preco: 9.00,  custo: 3.80,  vendas: 195 },
  { id: "p3", nome: "Salada Completa",       categoria: "Salada",         preco: 14.90, custo: 4.35,  vendas: 280 },
  { id: "p4", nome: "Marmitex Premium",      categoria: "Marmita",        preco: 24.90, custo: 10.20, vendas: 160 },
  { id: "p5", nome: "Prato Feijão Tropeiro", categoria: "Prato Principal",preco: 22.00, custo: 9.80,  vendas: 95  },
  { id: "p6", nome: "Combo Salada + Suco",   categoria: "Combo",          preco: 18.90, custo: 8.50,  vendas: 210 },
  { id: "p7", nome: "Refrigerante Lata",     categoria: "Bebida",         preco: 6.00,  custo: 3.20,  vendas: 380 },
  { id: "p8", nome: "Sobremesa do Dia",      categoria: "Sobremesa",      preco: 8.50,  custo: 5.10,  vendas: 120 },
];

// Matriz BCG adaptada: MC% × Volume de vendas
// Stars: MC ≥ 50% e vendas ≥ 200 | Cash Cows: MC ≥ 50% e vendas < 200
// Questions: MC < 50% e vendas ≥ 200 | Dogs: MC < 50% e vendas < 200
function classificarBCG(mc_pct, vendas) {
  const altaMC = mc_pct >= 50;
  const altoVol = vendas >= 200;
  if (altaMC && altoVol) return "star";
  if (altaMC && !altoVol) return "cow";
  if (!altaMC && altoVol) return "question";
  return "dog";
}

const BCG_STYLE = {
  star:     { label: "⭐ Estrela",       bg: "bg-amber-50",   borda: "border-amber-200",  cor: "#f59e0b", desc: "Alta MC + alto volume" },
  cow:      { label: "🐄 Vaca Leiteira", bg: "bg-emerald-50", borda: "border-emerald-200",cor: "#10b981", desc: "Alta MC + volume médio" },
  question: { label: "❓ Interrogação",  bg: "bg-blue-50",    borda: "border-blue-200",   cor: "#3b82f6", desc: "MC baixa + alto volume" },
  dog:      { label: "🐶 Abacaxi",       bg: "bg-[rgba(5,150,105,0.1)]",    borda: "border-[rgba(5,150,105,0.3)]",   cor: "#f43f5e", desc: "MC baixa + volume baixo" },
};

const CATEGORIAS = ["Todos", "Marmita", "Salada", "Prato Principal", "Combo", "Bebida", "Sobremesa"];

// ─── Card de prato ────────────────────────────────────────────────────────────
function CardMargem({ prato, rank }) {
  const mc_reais = prato.preco - prato.custo;
  const mc_pct   = prato.preco > 0 ? (mc_reais / prato.preco) * 100 : 0;
  const lucro_total = mc_reais * prato.vendas;
  const bcg      = classificarBCG(mc_pct, prato.vendas);
  const st       = BCG_STYLE[bcg];

  return (
    <div className={`rounded-2xl border  overflow-hidden ${bcg === "dog" ? `${st.bg} ${st.borda}` : "bg-card border-white/5"}`}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3 mb-3">
          {/* Rank */}
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ${rank <= 3 ? "bg-amber-100 text-amber-700" : "bg-elevated text-subtle"}`}>
            {rank <= 3 ? ["🥇","🥈","🥉"][rank - 1] : `#${rank}`}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-dim uppercase tracking-wider">{prato.categoria}</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full`}
                style={{ backgroundColor: st.cor + "20", color: st.cor }}>
                {st.label}
              </span>
            </div>
            <p className="text-base font-black text-fg truncate">{prato.nome}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black" style={{ color: st.cor }}>{fmtPct(mc_pct)}</p>
            <p className="text-[10px] font-bold text-dim">MC</p>
          </div>
        </div>

        {/* Barra */}
        <div className="h-2 bg-elevated rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(mc_pct, 100)}%`, backgroundColor: st.cor }} />
        </div>

        {/* Detalhes */}
        <div className="grid grid-cols-4 gap-2">
          <div className=" rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-dim uppercase">Preço</p>
            <p className="text-[11px] font-black text-fg">{fmtBRL(prato.preco)}</p>
          </div>
          <div className=" rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-dim uppercase">Custo</p>
            <p className="text-[11px] font-black text-fg">{fmtBRL(prato.custo)}</p>
          </div>
          <div className=" rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-dim uppercase">MC/un</p>
            <p className="text-[11px] font-black text-emerald-700">{fmtBRL(mc_reais)}</p>
          </div>
          <div className=" rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-dim uppercase">Lucro/mês</p>
            <p className="text-[11px] font-black text-emerald-700">{fmtBRL(lucro_total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function MargemPage() {
  const router = useRouter();
  const [busca,   setBusca]   = useState("");
  const [filtro,  setFiltro]  = useState("Todos");
  const [ordenar, setOrdenar] = useState("mc_desc");

  const pratos = useMemo(() => {
    return PRATOS.map(p => ({
      ...p,
      mc_reais: p.preco - p.custo,
      mc_pct:   p.preco > 0 ? ((p.preco - p.custo) / p.preco) * 100 : 0,
    }));
  }, []);

  // Resumo geral
  const resumo = useMemo(() => {
    const total_faturamento = pratos.reduce((a, p) => a + p.preco * p.vendas, 0);
    const total_custo       = pratos.reduce((a, p) => a + p.custo * p.vendas, 0);
    const total_lucro       = total_faturamento - total_custo;
    const mc_media          = total_faturamento > 0 ? (total_lucro / total_faturamento) * 100 : 0;
    const stars             = pratos.filter(p => classificarBCG(p.mc_pct, p.vendas) === "star").length;
    const dogs              = pratos.filter(p => classificarBCG(p.mc_pct, p.vendas) === "dog").length;
    return { total_faturamento, total_lucro, mc_media, stars, dogs };
  }, [pratos]);

  const filtrados = useMemo(() => {
    let lista = pratos.filter(p => {
      const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
      const matchCat   = filtro === "Todos" || p.categoria === filtro;
      return matchBusca && matchCat;
    });
    if (ordenar === "mc_desc")     lista = [...lista].sort((a, b) => b.mc_pct - a.mc_pct);
    if (ordenar === "lucro_desc")  lista = [...lista].sort((a, b) => (b.mc_reais * b.vendas) - (a.mc_reais * a.vendas));
    if (ordenar === "vendas_desc") lista = [...lista].sort((a, b) => b.vendas - a.vendas);
    return lista;
  }, [pratos, busca, filtro, ordenar]);

  return (
    <div className="min-h-screen ">
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-muted" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Margem de Lucro</h1>
            <p className="text-[11px] text-dim font-medium">Ranking de lucratividade por prato</p>
          </div>
          <button
            onClick={() => exportarTabelaPDF({
              titulo: "Ranking de Margem de Lucro",
              colunas: ["Prato", "Categoria", "Preço", "Custo", "MC%", "Lucro/mês", "BCG"],
              dados: filtrados.map((p, i) => [
                `#${i + 1} ${p.nome}`,
                p.categoria,
                fmtBRL(p.preco),
                fmtBRL(p.custo),
                fmtPct(p.mc_pct),
                fmtBRL(p.mc_reais * p.vendas),
                BCG_STYLE[classificarBCG(p.mc_pct, p.vendas)].label,
              ]),
              rodape: `MC Média: ${fmtPct(resumo.mc_media)} · Lucro Total: ${fmtBRL(resumo.total_lucro)} · Gerado pelo Cerebro ERP`,
            })}
            className="flex items-center gap-1.5 bg-card border border-white/8 text-fg-soft text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform ">
            <FileDown size={13} /> PDF
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <p className="text-xl font-black text-emerald-800">{fmtPct(resumo.mc_media)}</p>
            <p className="text-[11px] font-bold text-emerald-600">MC Média do Cardápio</p>
          </div>
          <div className="bg-card border border-white/5 rounded-2xl  p-4">
            <div className="w-8 h-8 rounded-xl bg-elevated flex items-center justify-center mb-2">
              <Award size={16} className="text-muted" />
            </div>
            <p className="text-xl font-black text-fg">{fmtBRL(resumo.total_lucro)}</p>
            <p className="text-[11px] font-bold text-dim">Lucro Total / Mês</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">⭐ Estrelas</p>
            <p className="text-2xl font-black text-amber-800">{resumo.stars}</p>
            <p className="text-[10px] font-bold text-amber-600">pratos campeões</p>
          </div>
          <div className={`rounded-2xl border p-4 ${resumo.dogs > 0 ? "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" : "bg-card border-white/5"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${resumo.dogs > 0 ? "text-accent" : "text-dim"}`}>🐶 Abacaxis</p>
            <p className={`text-2xl font-black ${resumo.dogs > 0 ? "text-accent-strong" : "text-fg"}`}>{resumo.dogs}</p>
            <p className={`text-[10px] font-bold ${resumo.dogs > 0 ? "text-accent" : "text-dim"}`}>pratos a revisar</p>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar prato..."
            className="w-full bg-card border border-white/8 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent " />
          {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-dim" /></button>}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setFiltro(c)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtro === c ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Ordenação */}
        <div className="flex gap-2">
          {[
            { id: "mc_desc",     label: "Maior MC%" },
            { id: "lucro_desc",  label: "Maior Lucro" },
            { id: "vendas_desc", label: "Mais Vendidos" },
          ].map(o => (
            <button key={o.id} onClick={() => setOrdenar(o.id)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all active:scale-95 ${ordenar === o.id ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Ranking */}
        <div className="space-y-3">
          {filtrados.map((p, i) => <CardMargem key={p.id} prato={p} rank={i + 1} />)}
        </div>

        {/* Legenda BCG */}
        <div className="bg-card rounded-2xl border border-white/5  p-4">
          <p className="text-[10px] font-black text-dim uppercase tracking-wider mb-3">Classificação da Matriz</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(BCG_STYLE).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: v.cor }} />
                <div>
                  <p className="text-[11px] font-black text-fg">{v.label}</p>
                  <p className="text-[10px] text-dim font-medium">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
