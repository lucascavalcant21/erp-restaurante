"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, AlertTriangle, Package, ChefHat, Calendar, Users, Building2,
  ArrowRight, ChevronRight, ArrowUpRight, ArrowDownRight, Cart, Truck, Bell, BarChart, 
  LayoutGrid, Receipt, CircleDot, Activity
} from "lucide-react";
import { PageBody, Card, SectionLabel, fmtBRL } from "../components/ui";
import { useERP } from "../context/ERPContext";
import { lerSessao } from "../lib/auth";
import { fetchLancamentos } from "../lib/financeiro";
import CerebroDashboard from "../components/CerebroDashboard";

// ═══════════════════════════════════════════════════════════════
// HELPER FUNÇÕES E CONSTANTES
// ═══════════════════════════════════════════════════════════════
const PERIODOS = {
  mensal:     { label: "Mensal",     dias: 30,  step: "day",   count: 14 },
  trimestral: { label: "Trimestral", dias: 90,  step: "week",  count: 12 },
  anual:      { label: "Anual",      dias: 365, step: "month", count: 12 },
};
const MES_LETRA = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function montarBuckets(step, count) {
  const arr = []; const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    let ini, fim, label;
    if (step === "day") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      ini = d.getTime(); fim = ini + 86400000; label = d.getDate();
    } else if (step === "week") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i * 7);
      ini = d.getTime() - 6 * 86400000; fim = d.getTime() + 86400000; label = `${d.getDate()}/${d.getMonth() + 1}`;
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      ini = d.getTime(); fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); label = MES_LETRA[d.getMonth()];
    }
    arr.push({ ini, fim, label, receita: 0, despesa: 0 });
  }
  return arr;
}
function variacao(a, b) { if (!b) return a > 0 ? 100 : null; return ((a - b) / b) * 100; }

function KpiVar({ label, value, delta, inverter }) {
  const pos = delta != null && (inverter ? delta < 0 : delta >= 0);
  return (
    <Card className="p-5 flex flex-col justify-between group hover:shadow-[0_20px_40px_rgba(9,9,11,0.12)] transition-all duration-300 transform hover:-translate-y-1">
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-2xl font-black tracking-tighter mt-4" style={{ color: "var(--fg)" }}>{value}</p>
      {delta == null ? (
        <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--dim)" }}>sem histórico</p>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-lg shadow-sm"
            style={{ background: pos ? "var(--success-soft)" : "var(--danger-soft)", color: pos ? "var(--success-strong)" : "#DC2626" }}>
            {pos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(delta).toFixed(0)}%
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>vs. anterior</span>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const { resumoEstoque, estoque, unidadeInfo, isCentral, podeTrocar, unidadeAtiva } = useERP();
  const [nome, setNome] = useState("");
  const [lanc, setLanc] = useState([]);
  const [periodo, setPeriodo] = useState("mensal");
  const cfg = PERIODOS[periodo];

  useEffect(() => { lerSessao().then((s) => setNome(s?.nome?.split(" ")[0] || "Dono")); }, []);
  useEffect(() => { fetchLancamentos(unidadeAtiva).then(({ data }) => setLanc(data || [])); }, [unidadeAtiva]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0));

  // Lógica Financeira Original (Mão no Lucro)
  const fin = useMemo(() => {
    const now = Date.now(); const d = cfg.dias * 86400000;
    const soma = (tipo, ini, fim) => lanc.filter((l) => { const t = new Date(l.data).getTime(); return l.tipo === tipo && t >= ini && t < fim; }).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const recA = soma("entrada", now - d, now + 86400000), recB = soma("entrada", now - 2 * d, now - d);
    const desA = soma("saida", now - d, now + 86400000), desB = soma("saida", now - 2 * d, now - d);
    return { recA, desA, lucro: recA - desA, varRec: variacao(recA, recB), varDes: variacao(desA, desB), varLuc: variacao(recA - desA, recB - desB) };
  }, [lanc, cfg]);

  const barras = useMemo(() => {
    const b = montarBuckets(cfg.step, cfg.count);
    lanc.forEach((l) => {
      const t = new Date(l.data).getTime();
      const bk = b.find((x) => t >= x.ini && t < x.fim);
      if (bk) { if (l.tipo === "entrada") bk.receita += Number(l.valor) || 0; else bk.despesa += Number(l.valor) || 0; }
    });
    return b;
  }, [lanc, cfg]);
  const maxBar = Math.max(1, ...barras.map((b) => Math.max(b.receita, b.despesa)));
  const semDados = barras.every((b) => b.receita === 0 && b.despesa === 0);

  const distrib = useMemo(() => {
    const now = Date.now(); const ini = now - cfg.dias * 86400000;
    const map = {};
    lanc.filter((l) => l.tipo === "saida" && new Date(l.data).getTime() >= ini).forEach((l) => { map[l.categoria || "Outros"] = (map[l.categoria || "Outros"] || 0) + (Number(l.valor) || 0); });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return { total, itens: Object.entries(map).map(([cat, val]) => ({ cat, val, pct: total ? (val / total) * 100 : 0 })).sort((a, b) => b.val - a.val).slice(0, 5) };
  }, [lanc, cfg]);

  if (unidadeAtiva === "todas") return <CerebroDashboard />;

  return (
    <div className="min-h-screen">
      {/* CABEÇALHO - TORRE DE CONTROLE */}
      <div className="px-4 pt-8 md:pt-12 pb-8" style={{ background: "var(--surface)" }}>
        <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{saudacao},</p>
        <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter text-slate-800">Torre de Controle.</h1>
        <p className="text-sm font-semibold text-slate-500 mt-2">Visão em tempo real da unidade <span className="text-slate-800 font-bold">{unidadeInfo.nome}</span></p>
      </div>

      <PageBody>
        {/* SINAIS VITAIS DO RESTAURANTE (Real-Time Mock) */}
        <div className="mb-10">
          <SectionLabel>Pulso do Restaurante (Hoje)</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            
            <Card className="p-4 md:p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-none text-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-20"><Activity size={60} /></div>
               <div className="relative z-10">
                 <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Vendas (Tempo Real)</p>
                 <p className="text-2xl md:text-4xl font-black tracking-tighter">R$ 4.250<span className="text-lg text-slate-400">,00</span></p>
                 <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-400">
                   <ArrowUpRight size={14}/> 12% vs. ontem
                 </div>
               </div>
            </Card>

            <Card className="p-4 md:p-6 border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300">
               <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Salão & Mesas</p>
                   <p className="text-2xl md:text-4xl font-black tracking-tighter text-slate-800">45<span className="text-lg text-slate-400">%</span></p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500"><Users size={20}/></div>
               </div>
               <p className="text-xs font-bold text-slate-500 mt-3">18 de 40 mesas ocupadas</p>
            </Card>

            <Card className="p-4 md:p-6 border-l-4 border-l-orange-500 hover:shadow-lg transition-all duration-300">
               <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Delivery Ativo</p>
                   <p className="text-2xl md:text-4xl font-black tracking-tighter text-slate-800">12</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500"><Truck size={20}/></div>
               </div>
               <p className="text-xs font-bold text-slate-500 mt-3">pedidos em preparação/rota</p>
            </Card>

            <Card className="p-4 md:p-6 border-l-4 border-l-purple-500 hover:shadow-lg transition-all duration-300">
               <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Equipe no Ponto</p>
                   <p className="text-2xl md:text-4xl font-black tracking-tighter text-slate-800">08</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500"><CircleDot size={20} className="animate-pulse"/></div>
               </div>
               <p className="text-xs font-bold text-slate-500 mt-3">funcionários na loja agora</p>
            </Card>

          </div>
        </div>

        {/* ATALHOS PARA TABLETS DE OPERAÇÃO */}
        <div className="mb-10">
          <SectionLabel>Acesso Rápido aos Tablets de Operação</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
             <button onClick={() => router.push("/dashboard/vendas")} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-slate-800 flex items-center justify-center transition-colors">
                  <Receipt size={24} className="text-slate-400 group-hover:text-white transition-colors"/>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800">Caixa (Frente)</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1 font-bold">Abrir PDV</p>
                </div>
             </button>

             <button onClick={() => router.push("/dashboard/cozinha/kds")} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-slate-800 flex items-center justify-center transition-colors">
                  <Bell size={24} className="text-slate-400 group-hover:text-white transition-colors"/>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800">KDS Cozinha</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1 font-bold">Fila de Pedidos</p>
                </div>
             </button>

             <button onClick={() => router.push("/dashboard/mesas")} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-slate-800 flex items-center justify-center transition-colors">
                  <LayoutGrid size={24} className="text-slate-400 group-hover:text-white transition-colors"/>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800">Mapa de Mesas</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1 font-bold">Salão / Garçom</p>
                </div>
             </button>

             <button onClick={() => router.push("/dashboard/rh/ponto")} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-slate-800 flex items-center justify-center transition-colors">
                  <Users size={24} className="text-slate-400 group-hover:text-white transition-colors"/>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800">Bate-Ponto Facial</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1 font-bold">Relógio Entrada</p>
                </div>
             </button>
          </div>
        </div>

        {/* MÉTRICAS HISTÓRICAS E FINANCEIRAS */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <SectionLabel>Resumo Financeiro e Histórico</SectionLabel>
            <div className="inline-flex p-1 rounded-xl bg-slate-200 border border-slate-300 shadow-inner">
              {Object.entries(PERIODOS).map(([k, v]) => (
                <button key={k} onClick={() => setPeriodo(k)} className="text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all duration-300 uppercase tracking-widest"
                  style={periodo === k ? { background: "white", color: "var(--accent-strong)", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" } : { color: "var(--muted)" }}>{v.label}</button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            <KpiVar label={`Receita (${cfg.label})`} value={fmtBRL(fin.recA)} delta={fin.varRec} />
            <KpiVar label={`Despesas (${cfg.label})`} value={fmtBRL(fin.desA)} delta={fin.varDes} inverter />
            <KpiVar label={`Lucro Líquido`} value={fmtBRL(fin.lucro)} delta={fin.varLuc} />
            <Card className="p-5 flex flex-col justify-between">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Capital em Estoque</p>
              <p className="text-2xl font-black tracking-tighter mt-4 text-slate-800">{fmtBRL(resumoEstoque.valor)}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-100 self-start">
                 <div className={`w-2 h-2 rounded-full ${resumoEstoque.criticos > 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`}></div>
                 <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                   {resumoEstoque.criticos > 0 ? `${resumoEstoque.criticos} Itens Críticos` : "Estoque Saudável"}
                 </p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Receita × Despesa</SectionLabel>
                <div className="flex items-center gap-3 text-[11px] font-medium">
                  <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}><span className="w-2 h-2 rounded-sm" style={{ background: "var(--accent)" }} /> Receita</span>
                  <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}><span className="w-2 h-2 rounded-sm" style={{ background: "#EF4444" }} /> Despesa</span>
                </div>
              </div>
              <Card>
                <div className="flex items-end gap-1.5" style={{ height: 180 }}>
                  {barras.map((b, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 group" style={{ height: "100%" }}>
                      <div className="w-full flex items-end justify-center gap-1" style={{ height: "100%" }}>
                        <div className="rounded-t-md transition-all duration-300 group-hover:opacity-80" style={{ width: "45%", height: `${Math.max((b.receita / maxBar) * 100, b.receita ? 4 : 0)}%`, background: "linear-gradient(to top, var(--accent-strong), var(--accent))", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.3)" }} title={`Receita ${fmtBRL(b.receita)}`} />
                        <div className="rounded-t-md transition-all duration-300 group-hover:opacity-80" style={{ width: "45%", height: `${Math.max((b.despesa / maxBar) * 100, b.despesa ? 4 : 0)}%`, background: "linear-gradient(to top, #BE123C, #F43F5E)", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.3)" }} title={`Despesa ${fmtBRL(b.despesa)}`} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{b.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-center mt-3" style={{ color: "var(--dim)" }}>
                  {semDados ? "Sem lançamentos no período · registre no Fluxo de Caixa" : `Período: ${cfg.label}`}
                </p>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              {distrib.total > 0 && (
                <div>
                  <SectionLabel>Distribuição de Custos</SectionLabel>
                  <Card className="space-y-4 min-h-[225px] flex flex-col justify-center">
                    {distrib.itens.map((d) => (
                      <div key={d.cat}>
                        <div className="flex justify-between text-[12px] mb-1.5">
                          <span className="font-bold uppercase tracking-widest text-[10px]" style={{ color: "var(--fg-soft)" }}>{d.cat}</span>
                          <span className="font-black text-slate-800">{fmtBRL(d.val)} <span className="text-slate-400 font-medium">({d.pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--panel)" }}>
                          <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: "var(--fg-soft)" }} />
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              )}
              
              {criticos.length > 0 && (
                <div>
                  <SectionLabel>Falta de Estoque</SectionLabel>
                  <Card className="!p-0 overflow-hidden border-red-100">
                    {criticos.slice(0, 3).map((i, idx) => (
                      <button key={i.id} onClick={() => router.push("/dashboard/operacao/estoque")}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors" style={idx ? { borderTop: "1px solid var(--line)" } : {}}>
                        <AlertTriangle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
                        <span className="flex-1 text-sm font-bold truncate text-slate-800">{i.nome}</span>
                        <span className="text-[11px] font-black uppercase tracking-widest bg-red-100 text-red-600 px-2 py-1 rounded-md">{i.quantidade} {i.unidade}</span>
                      </button>
                    ))}
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageBody>
    </div>
  );
}
