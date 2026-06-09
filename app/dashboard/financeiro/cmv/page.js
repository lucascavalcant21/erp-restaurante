"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, AlertTriangle, TrendingDown, TrendingUp,
  ChefHat, Search, X, FileDown, BarChart2, Trophy,
  CheckCircle, XCircle, Minus,
} from "lucide-react";
import { exportarTabelaPDF } from "../../../lib/exportPDF";

function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(val) {
  return `${Number(val).toFixed(1)}%`;
}

const PRATOS_CMV = [
  { id: "p1", nome: "Marmitex Executiva",   categoria: "Marmita",        preco: 19.90, custo: 7.05,  vendas_mes: 420 },
  { id: "p2", nome: "Salada Completa",       categoria: "Salada",         preco: 14.90, custo: 4.35,  vendas_mes: 280 },
  { id: "p3", nome: "Marmitex Premium",      categoria: "Marmita",        preco: 24.90, custo: 10.20, vendas_mes: 160 },
  { id: "p4", nome: "Prato Feijão Tropeiro", categoria: "Prato Principal", preco: 22.00, custo: 9.80,  vendas_mes: 95  },
  { id: "p5", nome: "Combo Salada + Suco",   categoria: "Combo",           preco: 18.90, custo: 8.50,  vendas_mes: 210 },
  { id: "p6", nome: "Refrigerante Lata",     categoria: "Bebida",          preco: 6.00,  custo: 3.20,  vendas_mes: 380 },
  { id: "p7", nome: "Suco Natural 500ml",    categoria: "Bebida",          preco: 9.00,  custo: 3.80,  vendas_mes: 195 },
  { id: "p8", nome: "Sobremesa do Dia",      categoria: "Sobremesa",       preco: 8.50,  custo: 5.10,  vendas_mes: 120 },
];

const HISTORICO_CAT = [
  { mes: "Jan", Marmita: 37.2, Salada: 29.8, Bebida: 53.1, Combo: 45.2, Sobremesa: 59.1, "Prato Principal": 44.5 },
  { mes: "Fev", Marmita: 36.0, Salada: 28.5, Bebida: 52.0, Combo: 44.1, Sobremesa: 58.2, "Prato Principal": 43.8 },
  { mes: "Mar", Marmita: 38.5, Salada: 30.2, Bebida: 54.0, Combo: 46.0, Sobremesa: 60.2, "Prato Principal": 45.2 },
  { mes: "Abr", Marmita: 36.8, Salada: 29.0, Bebida: 53.3, Combo: 45.5, Sobremesa: 59.8, "Prato Principal": 44.9 },
  { mes: "Mai", Marmita: 35.9, Salada: 29.5, Bebida: 52.8, Combo: 44.8, Sobremesa: 60.0, "Prato Principal": 44.6 },
  { mes: "Jun", Marmita: 36.3, Salada: 29.2, Bebida: 53.3, Combo: 45.0, Sobremesa: 60.0, "Prato Principal": 44.5 },
];

const CATEGORIAS_LISTA = ["Marmita", "Salada", "Prato Principal", "Combo", "Bebida", "Sobremesa"];
const CATEGORIAS_FILTRO = ["Todos", ...CATEGORIAS_LISTA];
const META_CMV = 35;
const CAT_COR = {
  Marmita: "#10b981", Salada: "#3b82f6", Bebida: "#f43f5e",
  Combo: "#f59e0b", Sobremesa: "#a855f7", "Prato Principal": "#f97316",
};

function classificar(cmv_pct) {
  if (cmv_pct >= 45) return "critico";
  if (cmv_pct >= 35) return "alerta";
  return "ok";
}
const CLASS_STYLE = {
  ok:      { bg: "bg-emerald-50", borda: "border-emerald-200", cor: "#10b981", label: "Saudável", badge: "bg-emerald-100 text-emerald-700" },
  alerta:  { bg: "bg-amber-50",   borda: "border-amber-200",   cor: "#f59e0b", label: "Atenção",  badge: "bg-amber-100 text-amber-600"   },
  critico: { bg: "bg-[rgba(5,150,105,0.1)]",    borda: "border-[rgba(5,150,105,0.3)]",    cor: "#f43f5e", label: "Crítico",  badge: "bg-[rgba(5,150,105,0.15)] text-accent-strong"     },
};

function GraficoBarrasH({ itens, maxVal = 70 }) {
  const H_ITEM = 36;
  const PAD_LEFT = 110;
  const PAD_RIGHT = 50;
  const W = 320;
  const barW = W - PAD_LEFT - PAD_RIGHT;
  const height = itens.length * H_ITEM + 20;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {(() => {
        const x = PAD_LEFT + (META_CMV / maxVal) * barW;
        return (
          <g>
            <line x1={x} y1={4} x2={x} y2={height - 4} stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
            <text x={x + 3} y={12} fontSize="7" fill="#10b981" fontWeight="bold">Meta</text>
          </g>
        );
      })()}
      {itens.map((item, i) => {
        const y = i * H_ITEM + 14;
        const pct = Math.min(item.valor, maxVal);
        const bw = (pct / maxVal) * barW;
        const cor = item.cor || (item.valor >= 45 ? "#f43f5e" : item.valor >= 35 ? "#f59e0b" : "#10b981");
        return (
          <g key={item.nome}>
            <text x={PAD_LEFT - 6} y={y + 11} fontSize="8.5" fill="#374151" fontWeight="600" textAnchor="end">
              {item.nome.length > 14 ? item.nome.slice(0, 13) + "…" : item.nome}
            </text>
            <rect x={PAD_LEFT} y={y} width={barW} height={20} rx="4" fill="#f3f4f6" />
            <rect x={PAD_LEFT} y={y} width={Math.max(bw, 2)} height={20} rx="4" fill={cor} opacity="0.85" />
            <text x={PAD_LEFT + bw + 4} y={y + 13} fontSize="8.5" fill={cor} fontWeight="bold">
              {fmtPct(item.valor)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GraficoLinhaCategoria({ categoria }) {
  const valores = HISTORICO_CAT.map(m => m[categoria]);
  const min = Math.min(...valores) - 5;
  const max = Math.max(...valores) + 5;
  const W = 300; const H = 80; const PAD = { l: 8, r: 8, t: 12, b: 20 };
  const iW = W - PAD.l - PAD.r; const iH = H - PAD.t - PAD.b;
  const cor = CAT_COR[categoria] || "#10b981";
  const pts = valores.map((v, i) => ({
    x: PAD.l + (i / (valores.length - 1)) * iW,
    y: PAD.t + (1 - (v - min) / (max - min)) * iH,
    v,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${pts[pts.length-1].x} ${H - PAD.b} L ${pts[0].x} ${H - PAD.b} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id={`grad-${categoria.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={cor} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {(() => {
        const metaY = PAD.t + (1 - (META_CMV - min) / (max - min)) * iH;
        if (metaY > PAD.t && metaY < H - PAD.b)
          return <line x1={PAD.l} y1={metaY} x2={W - PAD.r} y2={metaY} stroke="#10b981" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />;
        return null;
      })()}
      <path d={area} fill={`url(#grad-${categoria.replace(/\s/g,"")})`} />
      <path d={path} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill={cor} />
          <text x={p.x} y={H - PAD.b + 10} fontSize="7" fill="#9ca3af" textAnchor="middle">{HISTORICO_CAT[i].mes}</text>
          {(i === 0 || i === pts.length - 1) && (
            <text x={p.x} y={p.y - 5} fontSize="7.5" fill={cor} fontWeight="bold" textAnchor="middle">{fmtPct(p.v)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function CardCMV({ prato, rank }) {
  const cmv_pct = prato.preco > 0 ? (prato.custo / prato.preco) * 100 : 0;
  const mc_pct  = 100 - cmv_pct;
  const classe  = classificar(cmv_pct);
  const st      = CLASS_STYLE[classe];
  return (
    <div className={`rounded-2xl border  overflow-hidden ${classe !== "ok" ? `${st.bg} ${st.borda}` : "bg-card border-white/5"}`}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {rank && <span className="text-[10px] font-black text-elevated">#{rank}</span>}
              <span className="text-[10px] font-black text-dim uppercase tracking-wider">{prato.categoria}</span>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
            </div>
            <p className="text-base font-black text-fg truncate">{prato.nome}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black" style={{ color: st.cor }}>{fmtPct(cmv_pct)}</p>
            <p className="text-[10px] font-bold text-dim">CMV</p>
          </div>
        </div>
        <div className="h-2.5 bg-elevated rounded-full overflow-hidden flex mb-1.5">
          <div className="h-full rounded-l-full transition-all duration-700"
            style={{ width: `${Math.min(cmv_pct, 100)}%`, backgroundColor: st.cor }} />
        </div>
        <div className="flex justify-between text-[10px] font-black mb-3">
          <span style={{ color: st.cor }}>CMV {fmtPct(cmv_pct)}</span>
          <span className="text-dim">MC {fmtPct(mc_pct)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card/70 rounded-xl px-2 py-2 text-center">
            <p className="text-[10px] font-black text-dim uppercase">Preço</p>
            <p className="text-xs font-black text-fg">{fmtBRL(prato.preco)}</p>
          </div>
          <div className="bg-card/70 rounded-xl px-2 py-2 text-center">
            <p className="text-[10px] font-black text-dim uppercase">Custo</p>
            <p className="text-xs font-black text-fg">{fmtBRL(prato.custo)}</p>
          </div>
          <div className="bg-card/70 rounded-xl px-2 py-2 text-center">
            <p className="text-[10px] font-black text-dim uppercase">Vendas/mês</p>
            <p className="text-xs font-black text-fg">{prato.vendas_mes}un</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabVisao({ pratos, resumo }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [ordenar, setOrdenar] = useState("cmv_desc");
  const filtrados = useMemo(() => {
    let lista = pratos.filter(p => {
      const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
      const matchCat = filtro === "Todos" || p.categoria === filtro;
      return matchBusca && matchCat;
    });
    if (ordenar === "cmv_desc") lista = [...lista].sort((a, b) => b.cmv_pct - a.cmv_pct);
    if (ordenar === "cmv_asc")  lista = [...lista].sort((a, b) => a.cmv_pct - b.cmv_pct);
    if (ordenar === "vendas_desc") lista = [...lista].sort((a, b) => b.vendas_mes - a.vendas_mes);
    return lista;
  }, [pratos, busca, filtro, ordenar]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl border  p-4 col-span-2 ${resumo.cmv_real >= 45 ? "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" : resumo.cmv_real >= 35 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <p className="text-[10px] font-black text-dim uppercase tracking-wider mb-1">CMV Geral do Cardápio</p>
          <div className="flex items-end gap-3">
            <p className={`text-4xl font-black ${resumo.cmv_real >= 45 ? "text-accent-strong" : resumo.cmv_real >= 35 ? "text-amber-700" : "text-emerald-800"}`}>
              {fmtPct(resumo.cmv_real)}
            </p>
            <p className="text-[10px] font-bold text-dim mb-1">Meta: abaixo de 35%</p>
          </div>
          <div className="h-2 bg-card/50 rounded-full overflow-hidden mt-2">
            <div className="h-full rounded-full" style={{ width: `${Math.min((resumo.cmv_real / 70) * 100, 100)}%`, backgroundColor: resumo.cmv_real >= 45 ? "#f43f5e" : resumo.cmv_real >= 35 ? "#f59e0b" : "#10b981" }} />
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-white/5  p-4">
          <p className="text-[10px] font-black text-dim uppercase tracking-wider mb-1">Custo Total</p>
          <p className="text-xl font-black text-fg">{fmtBRL(resumo.custo_total)}</p>
          <p className="text-[10px] font-bold text-dim mt-0.5">de {fmtBRL(resumo.faturamento)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 col-span-1">
          <div className={`rounded-2xl border  p-3 ${resumo.criticos > 0 ? "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" : "bg-card border-white/5"}`}>
            <p className="text-[9px] font-black text-dim uppercase">Críticos</p>
            <p className={`text-2xl font-black ${resumo.criticos > 0 ? "text-accent-strong" : "text-fg"}`}>{resumo.criticos}</p>
          </div>
          <div className={`rounded-2xl border  p-3 ${resumo.alertas > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-white/5"}`}>
            <p className="text-[9px] font-black text-dim uppercase">Atenção</p>
            <p className={`text-2xl font-black ${resumo.alertas > 0 ? "text-amber-700" : "text-fg"}`}>{resumo.alertas}</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">CMV por Prato</p>
        <GraficoBarrasH
          itens={[...pratos].sort((a, b) => a.cmv_pct - b.cmv_pct).map(p => ({ nome: p.nome, valor: p.cmv_pct }))}
          maxVal={70}
        />
        <p className="text-[10px] text-dim font-medium mt-2">Linha verde = meta 35%</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar prato..." className="w-full bg-card border border-white/8 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none " />
        {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-dim" /></button>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIAS_FILTRO.map(c => (
          <button key={c} onClick={() => setFiltro(c)}
            className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtro === c ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {[{ id: "cmv_desc", label: "Maior CMV" }, { id: "cmv_asc", label: "Menor CMV" }, { id: "vendas_desc", label: "Mais Vendidos" }].map(o => (
          <button key={o.id} onClick={() => setOrdenar(o.id)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all active:scale-95 ${ordenar === o.id ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtrados.map((p, i) => <CardCMV key={p.id} prato={p} rank={i + 1} />)}
      </div>
    </div>
  );
}

function TabCategorias({ pratos }) {
  const [catSel, setCatSel] = useState(null);
  const porCategoria = useMemo(() => {
    return CATEGORIAS_LISTA.map(cat => {
      const itens = pratos.filter(p => p.categoria === cat);
      if (!itens.length) return null;
      const fat = itens.reduce((a, p) => a + p.preco * p.vendas_mes, 0);
      const custo = itens.reduce((a, p) => a + p.custo * p.vendas_mes, 0);
      const cmv_real = fat > 0 ? (custo / fat) * 100 : 0;
      const classe = classificar(cmv_real);
      return { cat, itens, cmv_real, fat, custo, classe };
    }).filter(Boolean);
  }, [pratos]);

  const catSelecionada = catSel ? porCategoria.find(c => c.cat === catSel) : null;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">CMV por Categoria</p>
        <GraficoBarrasH
          itens={porCategoria.map(c => ({ nome: c.cat, valor: c.cmv_real, cor: CAT_COR[c.cat] })).sort((a, b) => a.valor - b.valor)}
          maxVal={70}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {porCategoria.map(c => {
          const st = CLASS_STYLE[c.classe];
          const ativo = catSel === c.cat;
          return (
            <button key={c.cat} onClick={() => setCatSel(ativo ? null : c.cat)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-2 rounded-xl border transition-all active:scale-95 ${ativo ? "border-2 " : "bg-card border-white/8 text-muted"}`}
              style={ativo ? { borderColor: CAT_COR[c.cat], color: CAT_COR[c.cat], background: `${CAT_COR[c.cat]}15` } : {}}>
              {c.cat}
              <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${st.badge}`}>{fmtPct(c.cmv_real)}</span>
            </button>
          );
        })}
      </div>

      {catSelecionada && (
        <div className="bg-card rounded-2xl border border-white/5  p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-fg">{catSelecionada.cat}</p>
            <p className="text-lg font-black" style={{ color: CAT_COR[catSelecionada.cat] }}>{fmtPct(catSelecionada.cmv_real)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className=" rounded-xl p-3 text-center">
              <p className="text-[10px] font-black text-dim uppercase">Pratos</p>
              <p className="text-lg font-black text-fg">{catSelecionada.itens.length}</p>
            </div>
            <div className=" rounded-xl p-3 text-center">
              <p className="text-[10px] font-black text-dim uppercase">Faturamento</p>
              <p className="text-xs font-black text-fg">{fmtBRL(catSelecionada.fat)}</p>
            </div>
            <div className=" rounded-xl p-3 text-center">
              <p className="text-[10px] font-black text-dim uppercase">Custo</p>
              <p className="text-xs font-black text-fg">{fmtBRL(catSelecionada.custo)}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-black text-dim uppercase tracking-wider mb-2">Evolução 6 meses</p>
            <GraficoLinhaCategoria categoria={catSelecionada.cat} />
          </div>
          <div>
            <p className="text-[11px] font-black text-dim uppercase tracking-wider mb-2">Pratos</p>
            {catSelecionada.itens.map(p => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-fg truncate">{p.nome}</p>
                  <p className="text-[10px] text-dim">{fmtBRL(p.preco)} · {p.vendas_mes} vendas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black" style={{ color: p.cmv_pct >= 45 ? "#f43f5e" : p.cmv_pct >= 35 ? "#f59e0b" : "#10b981" }}>{fmtPct(p.cmv_pct)}</p>
                  <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden mt-0.5">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(p.cmv_pct / 70 * 100, 100)}%`, backgroundColor: p.cmv_pct >= 45 ? "#f43f5e" : p.cmv_pct >= 35 ? "#f59e0b" : "#10b981" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabRanking({ pratos }) {
  const sorted = [...pratos].sort((a, b) => b.cmv_pct - a.cmv_pct);
  const top3Piores   = sorted.slice(0, 3);
  const top3Melhores = [...pratos].sort((a, b) => a.cmv_pct - b.cmv_pct).slice(0, 3);
  const porImpacto   = [...pratos].sort((a, b) => (b.custo * b.vendas_mes) - (a.custo * a.vendas_mes));
  const porMC        = [...pratos].sort((a, b) => ((b.preco - b.custo) * b.vendas_mes) - ((a.preco - a.custo) * a.vendas_mes));
  const medalhas     = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <div className="flex items-center gap-2 mb-3">
          <XCircle size={15} className="text-accent" />
          <p className="text-xs font-black text-fg uppercase tracking-wider">Pior CMV — Revisar precificação</p>
        </div>
        <div className="space-y-2">
          {top3Piores.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-[rgba(5,150,105,0.1)] rounded-xl border border-[rgba(5,150,105,0.2)]">
              <span className="text-lg">{medalhas[i]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-fg truncate">{p.nome}</p>
                <p className="text-[10px] text-subtle">{p.categoria} · {p.vendas_mes} vendas/mês</p>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-accent-strong">{fmtPct(p.cmv_pct)}</p>
                <p className="text-[9px] text-accent">+{fmtPct(p.cmv_pct - META_CMV)} acima</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle size={15} className="text-emerald-500" />
          <p className="text-xs font-black text-fg uppercase tracking-wider">Melhor CMV — Pratos referência</p>
        </div>
        <div className="space-y-2">
          {top3Melhores.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-lg">{medalhas[i]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-fg truncate">{p.nome}</p>
                <p className="text-[10px] text-subtle">{p.categoria} · {p.vendas_mes} vendas/mês</p>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-emerald-600">{fmtPct(p.cmv_pct)}</p>
                <p className="text-[9px] text-emerald-400">{fmtPct(META_CMV - p.cmv_pct)} abaixo</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-1">Maior Custo Absoluto / Mês</p>
        <p className="text-[10px] text-dim mb-3">Pratos que mais pesam no custo total</p>
        <div className="space-y-2">
          {porImpacto.map((p, i) => {
            const custoTotal = p.custo * p.vendas_mes;
            const maxCusto = porImpacto[0].custo * porImpacto[0].vendas_mes;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-[11px] font-black text-elevated w-4">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <p className="text-xs font-black text-fg truncate">{p.nome}</p>
                    <p className="text-xs font-black text-fg-soft ml-2 flex-shrink-0">{fmtBRL(custoTotal)}</p>
                  </div>
                  <div className="h-2 bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${(custoTotal / maxCusto) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-1">Maior Margem de Contribuição</p>
        <p className="text-[10px] text-dim mb-3">Pratos que mais geram margem (MC × vendas)</p>
        <div className="space-y-2">
          {porMC.map((p, i) => {
            const mc = (p.preco - p.custo) * p.vendas_mes;
            const maxMC = (porMC[0].preco - porMC[0].custo) * porMC[0].vendas_mes;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-[11px] font-black text-elevated w-4">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <p className="text-xs font-black text-fg truncate">{p.nome}</p>
                    <p className="text-xs font-black text-emerald-700 ml-2 flex-shrink-0">{fmtBRL(mc)}</p>
                  </div>
                  <div className="h-2 bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(mc / maxMC) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabAnalise({ pratos, resumo }) {
  const analises = useMemo(() => {
    const itens = [];
    const criticos = pratos.filter(p => p.cmv_pct >= 45);
    const alertas  = pratos.filter(p => p.cmv_pct >= 35 && p.cmv_pct < 45);
    const saudaveis = pratos.filter(p => p.cmv_pct < 35);

    if (resumo.cmv_real < META_CMV) {
      itens.push({ tipo: "ok", titulo: "CMV geral dentro da meta", descricao: `CMV de ${fmtPct(resumo.cmv_real)} está abaixo da meta de ${fmtPct(META_CMV)}.` });
    } else if (resumo.cmv_real < 45) {
      itens.push({ tipo: "alerta", titulo: "CMV geral acima da meta", descricao: `CMV de ${fmtPct(resumo.cmv_real)} supera a meta em ${fmtPct(resumo.cmv_real - META_CMV)}. Revisar precificação ou fornecedores.` });
    } else {
      itens.push({ tipo: "critico", titulo: "CMV geral em nível crítico", descricao: `CMV de ${fmtPct(resumo.cmv_real)} em zona crítica (≥45%). Ação imediata necessária.` });
    }

    if (criticos.length > 0) {
      itens.push({ tipo: "critico", titulo: `${criticos.length} prato${criticos.length > 1 ? "s" : ""} com CMV crítico (≥45%)`, descricao: `${criticos.map(p => p.nome).join(", ")}. Consomem mais de 45% da receita em custo.` });
    }

    if (alertas.length > 0) {
      itens.push({ tipo: "alerta", titulo: `${alertas.length} prato${alertas.length > 1 ? "s" : ""} em zona de atenção (35–45%)`, descricao: `${alertas.map(p => p.nome).join(", ")}. Monitorar evolução de custo.` });
    }

    if (saudaveis.length > 0) {
      itens.push({ tipo: "ok", titulo: `${saudaveis.length} prato${saudaveis.length > 1 ? "s" : ""} com CMV saudável (<35%)`, descricao: `${saudaveis.map(p => p.nome).join(", ")}. Priorizar vendas destes pratos.` });
    }

    const bebidas = pratos.filter(p => p.categoria === "Bebida");
    if (bebidas.length) {
      const cmvBeb = bebidas.reduce((a, p) => a + p.cmv_pct, 0) / bebidas.length;
      if (cmvBeb > 50) {
        itens.push({ tipo: "critico", titulo: "Categoria Bebida com CMV elevado", descricao: `CMV médio de ${fmtPct(cmvBeb)}. Avaliar troca de fornecedor ou reajuste de preços.` });
      }
    }

    const maisCaro = [...pratos].sort((a, b) => (b.custo * b.vendas_mes) - (a.custo * a.vendas_mes))[0];
    itens.push({ tipo: "info", titulo: `"${maisCaro.nome}" é o maior custo absoluto`, descricao: `${fmtBRL(maisCaro.custo * maisCaro.vendas_mes)}/mês em custo. Priorizar negociação de insumos.` });

    const melhorMC = [...pratos].sort((a, b) => ((b.preco - b.custo) * b.vendas_mes) - ((a.preco - a.custo) * a.vendas_mes))[0];
    itens.push({ tipo: "ok", titulo: `"${melhorMC.nome}" gera maior margem total`, descricao: `Contribui com ${fmtBRL((melhorMC.preco - melhorMC.custo) * melhorMC.vendas_mes)}/mês. Incentivar via cardápio e combos.` });

    return itens;
  }, [pratos, resumo]);

  const TIPO_STYLE = {
    ok:      { icon: <CheckCircle size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />, bg: "bg-emerald-50 border-emerald-200" },
    alerta:  { icon: <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />, bg: "bg-amber-50 border-amber-200" },
    critico: { icon: <XCircle size={15} className="text-accent flex-shrink-0 mt-0.5" />,        bg: "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" },
    info:    { icon: <Minus size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />,          bg: "bg-blue-50 border-blue-200" },
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">Scorecard de Eficiência</p>
        <div className="space-y-3">
          {[
            { label: "CMV Geral",    valor: resumo.cmv_real, meta: 35, inverter: true },
            { label: "Margem Bruta", valor: 100 - resumo.cmv_real, meta: 65, inverter: false },
            { label: "Custo / Fat",  valor: (resumo.custo_total / resumo.faturamento) * 100, meta: 35, inverter: true },
          ].map(e => {
            const dentro = e.inverter ? e.valor <= e.meta : e.valor >= e.meta;
            const pct = e.inverter
              ? Math.min((e.meta / Math.max(e.valor, 0.1)) * 100, 100)
              : Math.min((e.valor / e.meta) * 100, 100);
            return (
              <div key={e.label}>
                <div className="flex justify-between mb-1">
                  <p className="text-xs font-bold text-fg-soft">{e.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black" style={{ color: dentro ? "#10b981" : "#f43f5e" }}>{fmtPct(e.valor)}</p>
                    <p className="text-[10px] text-dim">meta {fmtPct(e.meta)}</p>
                  </div>
                </div>
                <div className="h-2.5 bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: dentro ? "#10b981" : "#f59e0b" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">Análise Automática</p>
        <div className="space-y-3">
          {analises.map((a, i) => (
            <div key={i} className={`flex gap-3 p-3 rounded-xl border ${TIPO_STYLE[a.tipo]?.bg}`}>
              {TIPO_STYLE[a.tipo]?.icon}
              <div>
                <p className="text-xs font-black text-fg">{a.titulo}</p>
                <p className="text-[11px] text-subtle mt-0.5 leading-relaxed">{a.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-accent-strong rounded-2xl p-4">
        <p className="text-xs font-black text-white uppercase tracking-wider mb-3">Próximos Passos</p>
        <div className="space-y-2.5">
          {[
            { n: "1", acao: "Renegociar fornecedor de Bebidas",                    prazo: "Esta semana",  urgencia: "alta"  },
            { n: "2", acao: "Revisar ficha técnica da Sobremesa do Dia",            prazo: "Esta semana",  urgencia: "alta"  },
            { n: "3", acao: "Aumentar preço do Combo Salada + Suco em R$ 1,50",    prazo: "Esta semana",  urgencia: "media" },
            { n: "4", acao: "Impulsionar venda de Marmitex Executiva e Salada",    prazo: "Mês atual",    urgencia: "baixa" },
          ].map(a => (
            <div key={a.n} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-card/10 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{a.n}</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-white">{a.acao}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-white/50">{a.prazo}</span>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${a.urgencia === "alta" ? "bg-[rgba(5,150,105,0.1)]0/30 text-rose-300" : a.urgencia === "media" ? "bg-amber-500/30 text-amber-300" : "bg-emerald-500/30 text-emerald-300"}`}>
                    {a.urgencia.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CMVPage() {
  const router = useRouter();
  const [tab, setTab] = useState("visao");

  const pratos = useMemo(() => PRATOS_CMV.map(p => ({
    ...p, cmv_pct: p.preco > 0 ? (p.custo / p.preco) * 100 : 0,
  })), []);

  const resumo = useMemo(() => {
    const faturamento = pratos.reduce((a, p) => a + p.preco * p.vendas_mes, 0);
    const custo_total = pratos.reduce((a, p) => a + p.custo * p.vendas_mes, 0);
    const cmv_real    = faturamento > 0 ? (custo_total / faturamento) * 100 : 0;
    const criticos    = pratos.filter(p => p.cmv_pct >= 45).length;
    const alertas     = pratos.filter(p => p.cmv_pct >= 35 && p.cmv_pct < 45).length;
    return { cmv_real, faturamento, custo_total, criticos, alertas };
  }, [pratos]);

  const TABS = [
    { id: "visao",      label: "Visão Geral" },
    { id: "categorias", label: "Categorias"  },
    { id: "ranking",    label: "Ranking"     },
    { id: "analise",    label: "Análise"     },
  ];

  return (
    <div className="min-h-screen ">
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-0" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-muted" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Análise de CMV</h1>
            <p className="text-[11px] text-dim font-medium">Custo de mercadoria vendida por prato</p>
          </div>
          <button
            onClick={() => exportarTabelaPDF({
              titulo: "Análise de CMV por Prato",
              colunas: ["Prato", "Categoria", "Preço", "Custo", "CMV%", "Status"],
              dados: pratos.map(p => [p.nome, p.categoria, fmtBRL(p.preco), fmtBRL(p.custo), fmtPct(p.cmv_pct), p.cmv_pct >= 45 ? "Crítico" : p.cmv_pct >= 35 ? "Atenção" : "Saudável"]),
              rodape: `CMV Geral: ${fmtPct(resumo.cmv_real)} · Meta: <35% · Cerebro ERP`,
            })}
            className="flex items-center gap-1.5 bg-card border border-white/8 text-fg-soft text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform ">
            <FileDown size={13} /> PDF
          </button>
        </div>
        <div className="flex gap-0 -mb-px overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-[11px] font-black transition-all border-b-2 ${tab === t.id ? "border-neutral-900 text-fg" : "border-transparent text-dim"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">
        {tab === "visao"      && <TabVisao pratos={pratos} resumo={resumo} />}
        {tab === "categorias" && <TabCategorias pratos={pratos} />}
        {tab === "ranking"    && <TabRanking pratos={pratos} />}
        {tab === "analise"    && <TabAnalise pratos={pratos} resumo={resumo} />}
      </div>
    </div>
  );
}
