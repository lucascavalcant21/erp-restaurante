"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, Percent, ChevronDown, FileDown, AlertTriangle, CheckCircle,
} from "lucide-react";
import { exportarPDF } from "../../../lib/exportPDF";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) { return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtPct(val) { return `${Number(val).toFixed(1)}%`; }
function fmtK(val)   { return val >= 1000 ? `R$${(val/1000).toFixed(1)}k` : fmtBRL(val); }

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Dados históricos (últimos 6 meses) ───────────────────────────────────────
const HISTORICO = [
  { mes: "Jan", receita: 18400, lucro_bruto: 10580, despesas: 7100, lucro_liquido: 3100, cmv_pct: 42.5 },
  { mes: "Fev", receita: 21200, lucro_bruto: 12600, despesas: 8200, lucro_liquido: 3800, cmv_pct: 40.6 },
  { mes: "Mar", receita: 19800, lucro_bruto: 11300, despesas: 7800, lucro_liquido: 3200, cmv_pct: 42.9 },
  { mes: "Abr", receita: 23500, lucro_bruto: 14100, despesas: 9000, lucro_liquido: 4500, cmv_pct: 40.0 },
  { mes: "Mai", receita: 22100, lucro_bruto: 13200, despesas: 8800, lucro_liquido: 3900, cmv_pct: 40.3 },
  { mes: "Jun", receita: 25300, lucro_bruto: 14421, despesas: 9150, lucro_liquido: 4226, cmv_pct: 38.0 },
];

const DRE_MES = {
  receita_bruta: 25300, deducoes: 1265, receita_liquida: 24035,
  cmv: 9614, lucro_bruto: 14421,
  despesas_pessoal: 5500, despesas_aluguel: 2200, despesas_energia: 680,
  despesas_marketing: 320, despesas_outras: 450, total_despesas_op: 9150,
  ebitda: 5271, depreciacao: 300, lucro_operacional: 4971,
  imposto_renda: 745, lucro_liquido: 4226,
};
const DRE_MES_ANT = {
  receita_bruta: 22100, lucro_bruto: 13200, lucro_liquido: 3900,
  total_despesas_op: 8800, ebitda: 4400, cmv: 8940,
};

// ─── Variação mês a mês ───────────────────────────────────────────────────────
function variacao(atual, anterior) {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

// ─── Gráfico de barras SVG ────────────────────────────────────────────────────
function GraficoBarras({ dados, altura = 80 }) {
  const maxReceita = Math.max(...dados.map(d => d.receita));
  const W = 280; const H = altura;
  const barW = Math.floor(W / dados.length) - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ maxHeight: H + 20 }}>
      {dados.map((d, i) => {
        const x = i * (W / dados.length) + 2;
        const hR = Math.round((d.receita / maxReceita) * H);
        const hL = Math.round((d.lucro_liquido / maxReceita) * H);
        const hB = Math.round((d.lucro_bruto / maxReceita) * H);
        const atual = i === dados.length - 1;
        return (
          <g key={d.mes}>
            {/* Receita */}
            <rect x={x} y={H - hR} width={barW * 0.4} height={hR} rx={2}
              fill={atual ? "#10b981" : "#d1fae5"} />
            {/* Lucro bruto */}
            <rect x={x + barW * 0.42} y={H - hB} width={barW * 0.3} height={hB} rx={2}
              fill={atual ? "#3b82f6" : "#bfdbfe"} />
            {/* Lucro líquido */}
            <rect x={x + barW * 0.74} y={H - hL} width={barW * 0.24} height={hL} rx={2}
              fill={atual ? "#8b5cf6" : "#ddd6fe"} />
            {/* Label */}
            <text x={x + barW * 0.4} y={H + 13} textAnchor="middle" fontSize={8}
              fill={atual ? "#10b981" : "#9ca3af"} fontWeight={atual ? "900" : "600"}>
              {d.mes}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Gráfico de pizza SVG (despesas) ─────────────────────────────────────────
function GraficoPizza({ fatias, raio = 48 }) {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  let angulo = -Math.PI / 2;
  const slices = fatias.map(f => {
    const ang = (f.valor / total) * 2 * Math.PI;
    const x1 = raio + raio * Math.cos(angulo);
    const y1 = raio + raio * Math.sin(angulo);
    angulo += ang;
    const x2 = raio + raio * Math.cos(angulo);
    const y2 = raio + raio * Math.sin(angulo);
    const large = ang > Math.PI ? 1 : 0;
    return { ...f, d: `M ${raio} ${raio} L ${x1} ${y1} A ${raio} ${raio} 0 ${large} 1 ${x2} ${y2} Z`, pct: Math.round(f.valor / total * 100) };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${raio * 2} ${raio * 2}`} width={raio * 2} height={raio * 2} className="flex-shrink-0">
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.cor} />)}
      </svg>
      <div className="flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.cor }} />
              <p className="text-[10px] font-bold text-neutral-600">{s.label}</p>
            </div>
            <p className="text-[10px] font-black text-neutral-800">{s.pct}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Card KPI com variação ────────────────────────────────────────────────────
function KPICard({ label, valor, anterior, formatador = fmtBRL, icone, corBase = "neutral", meta, metaLabel }) {
  const var_pct = anterior != null ? variacao(valor, anterior) : null;
  const positivo = var_pct >= 0;
  const cores = {
    emerald: { bg: "bg-emerald-50", borda: "border-emerald-200", txt: "text-emerald-800", icon: "bg-emerald-100" },
    blue:    { bg: "bg-blue-50",    borda: "border-blue-200",    txt: "text-blue-800",    icon: "bg-blue-100"    },
    violet:  { bg: "bg-violet-50",  borda: "border-violet-200",  txt: "text-violet-800",  icon: "bg-violet-100"  },
    neutral: { bg: "bg-white",      borda: "border-neutral-100", txt: "text-neutral-900", icon: "bg-neutral-100" },
  };
  const c = cores[corBase] || cores.neutral;
  const metaPct = meta ? Math.min((valor / meta) * 100, 100) : null;

  return (
    <div className={`rounded-2xl border shadow-sm p-3.5 ${c.bg} ${c.borda}`}>
      <div className={`w-8 h-8 rounded-xl ${c.icon} flex items-center justify-center mb-2`}>
        {icone}
      </div>
      <p className={`text-lg font-black ${c.txt} leading-tight`}>{formatador(valor)}</p>
      <p className="text-[10px] font-bold text-neutral-400 mb-1">{label}</p>
      <div className="flex items-center justify-between">
        {var_pct != null && (
          <div className={`flex items-center gap-0.5 text-[10px] font-black ${positivo ? "text-emerald-600" : "text-rose-500"}`}>
            {positivo ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {positivo ? "+" : ""}{fmtPct(Math.abs(var_pct))} vs mai
          </div>
        )}
        {metaPct != null && (
          <div className="text-[9px] font-black text-neutral-400">{Math.round(metaPct)}% da meta</div>
        )}
      </div>
      {metaPct != null && (
        <div className="h-1 bg-neutral-200 rounded-full mt-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${metaPct}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Linha da DRE ─────────────────────────────────────────────────────────────
function LinhaDRE({ label, valor, receita_bruta, destaque, negativo, separador, subitem }) {
  const pct = receita_bruta > 0 ? (Math.abs(valor) / receita_bruta) * 100 : 0;
  const cor = negativo ? "text-rose-600" : destaque ? "text-neutral-900" : "text-neutral-700";
  if (separador) return <div className="h-px bg-neutral-100 my-1" />;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${destaque ? "bg-neutral-50" : ""} ${subitem ? "pl-8" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-tight ${destaque ? "font-black text-neutral-900" : subitem ? "font-medium text-neutral-500" : "font-bold text-neutral-700"}`}>
          {label}
        </p>
        {!destaque && !subitem && (
          <div className="h-1 bg-neutral-100 rounded-full mt-1 w-24 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: negativo ? "#f43f5e" : "#10b981" }} />
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0 ml-4">
        <p className={`text-[13px] font-black ${cor}`}>{negativo ? "- " : ""}{fmtBRL(Math.abs(valor))}</p>
        {!destaque && <p className="text-[9px] text-neutral-400 font-medium">{fmtPct(pct)} RB</p>}
      </div>
    </div>
  );
}

// ─── Seletor de mês ───────────────────────────────────────────────────────────
function SeletorMes({ mes, ano, onChange }) {
  const prev = () => { let m = mes - 1, a = ano; if (m < 0) { m = 11; a--; } onChange(m, a); };
  const next = () => { let m = mes + 1, a = ano; if (m > 11) { m = 0; a++; } onChange(m, a); };
  const hoje = new Date();
  const isFuturo = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center active:scale-95 shadow-sm">
        <ChevronLeft size={15} className="text-neutral-600" />
      </button>
      <span className="text-sm font-black text-neutral-900 w-32 text-center">{MESES[mes]} {ano}</span>
      <button onClick={next} disabled={isFuturo} className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center active:scale-95 shadow-sm disabled:opacity-30">
        <ChevronRight size={15} className="text-neutral-600" />
      </button>
    </div>
  );
}

// ─── Análise automática ───────────────────────────────────────────────────────
function AnaliseAutomatica({ d, anterior, margem_liquida, cmv_pct }) {
  const pontos = [];

  const var_receita = variacao(d.receita_bruta, anterior.receita_bruta);
  const var_lucro   = variacao(d.lucro_liquido, anterior.lucro_liquido);

  if (var_receita > 5)  pontos.push({ tipo: "ok",    texto: `Receita cresceu ${fmtPct(var_receita)} vs mês anterior — bom ritmo de vendas.` });
  if (var_receita < -5) pontos.push({ tipo: "alerta", texto: `Receita caiu ${fmtPct(Math.abs(var_receita))} vs mês anterior — investigar causa.` });

  if (cmv_pct > 42) pontos.push({ tipo: "alerta", texto: `CMV em ${fmtPct(cmv_pct)} — acima do ideal de 40%. Revisar fichas técnicas.` });
  else              pontos.push({ tipo: "ok",     texto: `CMV em ${fmtPct(cmv_pct)} — dentro da meta. Continue monitorando.` });

  const despesa_pct = (d.total_despesas_op / d.receita_bruta) * 100;
  if (despesa_pct > 38) pontos.push({ tipo: "alerta", texto: `Despesas operacionais em ${fmtPct(despesa_pct)} da RB — peso alto. Avaliar cortes em ${fmtBRL(d.despesas_outras)} (outras).` });
  else                  pontos.push({ tipo: "ok",     texto: `Despesas operacionais em ${fmtPct(despesa_pct)} da RB — nível saudável.` });

  if (margem_liquida < 10) pontos.push({ tipo: "alerta", texto: `Margem líquida em ${fmtPct(margem_liquida)} — baixa. Meta mínima: 10%.` });
  else                     pontos.push({ tipo: "ok",     texto: `Margem líquida de ${fmtPct(margem_liquida)} — saudável para food service.` });

  if (var_lucro > var_receita + 2) pontos.push({ tipo: "ok", texto: `Lucro cresceu mais que a receita (+${fmtPct(var_lucro)} vs +${fmtPct(var_receita)}) — alavancagem operacional positiva.` });

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-3">Análise Automática — IA</p>
      <div className="space-y-2">
        {pontos.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            {p.tipo === "ok"
              ? <CheckCircle size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              : <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />}
            <p className="text-[12px] font-medium text-neutral-700 leading-snug">{p.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function DREPage() {
  const router = useRouter();
  const hoje   = new Date();
  const [mes,  setMes]  = useState(hoje.getMonth());
  const [ano,  setAno]  = useState(hoje.getFullYear());
  const [tabAtiva, setTabAtiva] = useState("visao"); // "visao" | "detalhes" | "evolucao"

  const d    = DRE_MES;
  const dAnt = DRE_MES_ANT;

  const margem_liquida = d.receita_bruta > 0 ? (d.lucro_liquido / d.receita_bruta) * 100 : 0;
  const margem_bruta   = d.receita_bruta > 0 ? (d.lucro_bruto   / d.receita_bruta) * 100 : 0;
  const cmv_pct        = d.receita_bruta > 0 ? (d.cmv           / d.receita_bruta) * 100 : 0;
  const despesa_pct    = d.receita_bruta > 0 ? (d.total_despesas_op / d.receita_bruta) * 100 : 0;

  const fatiasDespesas = [
    { label: "Pessoal",    valor: d.despesas_pessoal,   cor: "#3b82f6" },
    { label: "Aluguel",    valor: d.despesas_aluguel,   cor: "#8b5cf6" },
    { label: "Energia",    valor: d.despesas_energia,   cor: "#f59e0b" },
    { label: "Marketing",  valor: d.despesas_marketing, cor: "#10b981" },
    { label: "Outras",     valor: d.despesas_outras,    cor: "#9ca3af" },
  ];

  const mediaMensal = HISTORICO.reduce((a, h) => a + h.receita, 0) / HISTORICO.length;
  const melhorMes   = HISTORICO.reduce((a, b) => a.receita > b.receita ? a : b);

  return (
    <div className="min-h-screen bg-[#fbf9f5]">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-neutral-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-neutral-900 leading-tight">DRE Gerencial</h1>
            <p className="text-[11px] text-neutral-400 font-medium">Demonstrativo de Resultado</p>
          </div>
          <button onClick={() => exportarPDF({
              titulo: `DRE Gerencial — ${MESES[mes]} ${ano}`,
              subtitulo: "Demonstrativo de Resultado do Exercício",
              linhas: [
                { label: "Receita Bruta",           valor: fmtBRL(d.receita_bruta),      destaque: true },
                { label: "(-) Deduções",             valor: fmtBRL(d.deducoes) },
                { label: "= Receita Líquida",        valor: fmtBRL(d.receita_liquida),    total: true },
                { separador: true },
                { label: "(-) CMV",                  valor: fmtBRL(d.cmv) },
                { label: "= Lucro Bruto",            valor: fmtBRL(d.lucro_bruto),        total: true },
                { separador: true },
                { label: "Total Despesas Op.",       valor: fmtBRL(d.total_despesas_op) },
                { label: "EBITDA",                   valor: fmtBRL(d.ebitda),             total: true },
                { label: "(-) Depreciação",          valor: fmtBRL(d.depreciacao) },
                { label: "= Lucro Operacional",      valor: fmtBRL(d.lucro_operacional),  total: true },
                { label: "(-) IR e CSLL",            valor: fmtBRL(d.imposto_renda) },
                { label: "= LUCRO LÍQUIDO",          valor: fmtBRL(d.lucro_liquido),      total: true },
              ],
              rodape: `Margem Líquida: ${fmtPct(margem_liquida)} · Margem Bruta: ${fmtPct(margem_bruta)} · CMV: ${fmtPct(cmv_pct)}`,
            })}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 text-neutral-700 text-xs font-black px-3 py-2 rounded-xl active:scale-95 shadow-sm">
            <FileDown size={13} /> PDF
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mt-3">
          {[["visao","📊 Visão Geral"],["detalhes","📋 DRE"],["evolucao","📈 Evolução"]].map(([id, label]) => (
            <button key={id} onClick={() => setTabAtiva(id)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 ${tabAtiva === id ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Seletor */}
        <div className="flex justify-center">
          <SeletorMes mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
        </div>

        {/* ── ABA VISÃO GERAL ── */}
        {tabAtiva === "visao" && (
          <>
            {/* KPIs com variação */}
            <div className="grid grid-cols-2 gap-3">
              <KPICard label="Receita Bruta"  valor={d.receita_bruta}  anterior={dAnt.receita_bruta}  corBase="emerald"
                icone={<DollarSign size={16} className="text-emerald-600" />}
                meta={28000} metaLabel="meta jun" />
              <KPICard label="Lucro Líquido"  valor={d.lucro_liquido}  anterior={dAnt.lucro_liquido}  corBase="violet"
                icone={<TrendingUp size={16} className="text-violet-600" />} />
              <KPICard label="Margem Bruta"   valor={margem_bruta}     anterior={d.receita_bruta > 0 ? (dAnt.lucro_bruto/dAnt.receita_bruta)*100 : null}
                corBase="blue" formatador={fmtPct}
                icone={<Percent size={16} className="text-blue-600" />} />
              <KPICard label="Margem Líquida" valor={margem_liquida}   anterior={d.receita_bruta > 0 ? (dAnt.lucro_liquido/dAnt.receita_bruta)*100 : null}
                corBase="neutral" formatador={fmtPct}
                icone={<Percent size={16} className="text-neutral-600" />} />
            </div>

            {/* Indicadores de eficiência */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-3">Indicadores de Eficiência</p>
              <div className="space-y-3">
                {[
                  { label: "CMV / Receita Bruta", valor: cmv_pct,     meta: 40, melhor: false },
                  { label: "Despesas / Receita",  valor: despesa_pct, meta: 38, melhor: false },
                  { label: "EBITDA / Receita",    valor: (d.ebitda / d.receita_bruta) * 100, meta: 15, melhor: true },
                ].map(r => {
                  const ok = r.melhor ? r.valor >= r.meta : r.valor <= r.meta;
                  return (
                    <div key={r.label}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[12px] font-bold text-neutral-700">{r.label}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black ${ok ? "text-emerald-600" : "text-amber-600"}`}>{fmtPct(r.valor)}</span>
                          <span className="text-[9px] text-neutral-400">meta {r.melhor ? "≥" : "≤"}{fmtPct(r.meta)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(r.valor / (r.melhor ? r.meta * 2 : 60) * 100, 100)}%`, backgroundColor: ok ? "#10b981" : "#f59e0b" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pizza despesas */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-3">Composição das Despesas</p>
              <GraficoPizza fatias={fatiasDespesas} />
              <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between">
                <p className="text-[11px] font-bold text-neutral-500">Total despesas op.</p>
                <p className="text-[12px] font-black text-neutral-900">{fmtBRL(d.total_despesas_op)}</p>
              </div>
            </div>

            {/* Análise automática */}
            <AnaliseAutomatica d={d} anterior={dAnt} margem_liquida={margem_liquida} cmv_pct={cmv_pct} />

            {/* Stats do semestre */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-3">Semestre em Números</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-base font-black text-neutral-900">{fmtK(mediaMensal)}</p>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase">Média mensal</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-emerald-700">{melhorMes.mes}</p>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase">Melhor mês</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-neutral-900">
                    {fmtK(HISTORICO.reduce((a, h) => a + h.lucro_liquido, 0))}
                  </p>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase">Lucro total</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── ABA DRE COMPLETO ── */}
        {tabAtiva === "detalhes" && (
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-50">
            <div className="px-4 py-2 bg-emerald-50">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Receitas</p>
            </div>
            <LinhaDRE label="Receita Bruta"    valor={d.receita_bruta}   receita_bruta={d.receita_bruta} />
            <LinhaDRE label="(-) Deduções/Impostos s/ Vendas" valor={d.deducoes} receita_bruta={d.receita_bruta} negativo subitem />
            <LinhaDRE label="= Receita Líquida" valor={d.receita_liquida} receita_bruta={d.receita_bruta} destaque />
            <LinhaDRE separador />
            <div className="px-4 py-2 bg-orange-50">
              <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Custos</p>
            </div>
            <LinhaDRE label="(-) CMV"    valor={d.cmv}        receita_bruta={d.receita_bruta} negativo />
            <LinhaDRE label="= Lucro Bruto" valor={d.lucro_bruto} receita_bruta={d.receita_bruta} destaque />
            <LinhaDRE separador />
            <div className="px-4 py-2 bg-blue-50">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Despesas Operacionais</p>
            </div>
            <LinhaDRE label="Pessoal e Encargos"   valor={d.despesas_pessoal}   receita_bruta={d.receita_bruta} negativo subitem />
            <LinhaDRE label="Aluguel"               valor={d.despesas_aluguel}   receita_bruta={d.receita_bruta} negativo subitem />
            <LinhaDRE label="Energia e Utilities"   valor={d.despesas_energia}   receita_bruta={d.receita_bruta} negativo subitem />
            <LinhaDRE label="Marketing"             valor={d.despesas_marketing} receita_bruta={d.receita_bruta} negativo subitem />
            <LinhaDRE label="Outras Despesas"       valor={d.despesas_outras}    receita_bruta={d.receita_bruta} negativo subitem />
            <LinhaDRE label="= Total Despesas Op."  valor={d.total_despesas_op}  receita_bruta={d.receita_bruta} destaque negativo />
            <LinhaDRE separador />
            <div className="px-4 py-2 bg-violet-50">
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Resultado</p>
            </div>
            <LinhaDRE label="EBITDA"               valor={d.ebitda}            receita_bruta={d.receita_bruta} />
            <LinhaDRE label="(-) Depreciação"      valor={d.depreciacao}       receita_bruta={d.receita_bruta} negativo subitem />
            <LinhaDRE label="= Lucro Operacional"  valor={d.lucro_operacional} receita_bruta={d.receita_bruta} destaque />
            <LinhaDRE label="(-) IR e CSLL"        valor={d.imposto_renda}     receita_bruta={d.receita_bruta} negativo subitem />
            <div className={`px-4 py-4 flex items-center justify-between ${d.lucro_liquido >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
              <p className={`text-base font-black ${d.lucro_liquido >= 0 ? "text-emerald-900" : "text-rose-800"}`}>= LUCRO LÍQUIDO</p>
              <div className="text-right">
                <p className={`text-xl font-black ${d.lucro_liquido >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmtBRL(d.lucro_liquido)}</p>
                <p className={`text-[11px] font-black ${d.lucro_liquido >= 0 ? "text-emerald-500" : "text-rose-400"}`}>{fmtPct(margem_liquida)} da RB</p>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA EVOLUÇÃO ── */}
        {tabAtiva === "evolucao" && (
          <>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-1">Evolução — Últimos 6 Meses</p>
              <GraficoBarras dados={HISTORICO} altura={88} />
              <div className="flex gap-3 mt-1 justify-center">
                {[["#10b981","Receita"],["#3b82f6","Lucro Bruto"],["#8b5cf6","Lucro Líquido"]].map(([cor, label]) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: cor }} />
                    <p className="text-[9px] font-bold text-neutral-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabela comparativa */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Comparativo Mensal</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {HISTORICO.map((h, i) => {
                  const atual = i === HISTORICO.length - 1;
                  const varR  = i > 0 ? variacao(h.receita, HISTORICO[i-1].receita) : null;
                  return (
                    <div key={h.mes} className={`px-4 py-3 flex items-center ${atual ? "bg-emerald-50" : ""}`}>
                      <p className={`w-10 text-[12px] font-black ${atual ? "text-emerald-700" : "text-neutral-600"}`}>{h.mes}</p>
                      <div className="flex-1">
                        <p className="text-[12px] font-black text-neutral-900">{fmtBRL(h.receita)}</p>
                        <p className="text-[10px] text-neutral-400">Lucro: {fmtBRL(h.lucro_liquido)}</p>
                      </div>
                      {varR != null && (
                        <span className={`text-[10px] font-black ${varR >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                          {varR >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(varR))}
                        </span>
                      )}
                      {atual && <span className="ml-2 text-[9px] font-black bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full">atual</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CMV ao longo do tempo */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-3">CMV% — Evolução</p>
              <div className="space-y-2">
                {HISTORICO.map((h, i) => {
                  const ok = h.cmv_pct <= 40;
                  return (
                    <div key={h.mes} className="flex items-center gap-3">
                      <p className="text-[11px] font-black text-neutral-500 w-8">{h.mes}</p>
                      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(h.cmv_pct / 60) * 100}%`, backgroundColor: ok ? "#10b981" : "#f59e0b" }} />
                      </div>
                      <p className={`text-[11px] font-black w-10 text-right ${ok ? "text-emerald-600" : "text-amber-600"}`}>{fmtPct(h.cmv_pct)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-100">
                <div className="w-2 h-2 rounded-full bg-neutral-300" />
                <p className="text-[10px] text-neutral-400">Linha de meta: 40% da Receita Bruta</p>
              </div>
            </div>
          </>
        )}

        <p className="text-[10px] text-neutral-300 font-medium text-center">
          * Conecte seu PDV e lançamentos ao Supabase para dados reais
        </p>
      </div>
    </div>
  );
}
