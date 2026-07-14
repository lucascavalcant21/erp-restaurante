"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchParams, salvarParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { PageHeader, PageBody, Card, fmtBRL } from "../../../components/ui";
import { PieChart, Save, TrendingUp, AlertTriangle } from "lucide-react";

// Custo real de produzir 1 porção da ficha (resolve sub-receitas em cascata)
function custoFicha(f, todas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    else if (fi.subficha_id) {
      const base = todas.find(x => x.id === fi.subficha_id);
      const rend = Number(base?.rendimento_porcoes) || 1;
      total += (base ? custoFicha(base, todas, guard) / rend : 0) * (fi.quantidade || 0);
    }
  });
  return total;
}
function porcoesDaFicha(f) {
  const rend = Number(f?.rendimento_porcoes) || 1;
  const un = String(f?.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return rend;
  const pesoPorcao = Number(f?.peso_porcao_g) || 0;
  const pesoTotalG = (un === "kg" || un === "l") ? rend * 1000 : rend;
  return pesoPorcao > 0 ? pesoTotalG / pesoPorcao : rend;
}

// Cada fatia da "pizza" do prato
const COR = {
  ingredientes: "#EF4444", imposto: "#8B5CF6", embalagem: "#F59E0B",
  aluguel: "#0EA5E9", luz: "#EAB308", gas: "#F97316", agua: "#06B6D4",
  limpeza: "#14B8A6", cmo: "#EC4899", lucro: "#10B981",
};

export default function PontoEquilibrioPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [p, setP] = useState({ ...PARAMS_PADRAO });
  const [precoPrato, setPrecoPrato] = useState("40");
  const [salvando, setSalvando] = useState(false);
  const [salvou, setSalvou] = useState(false);
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [pratoSel, setPratoSel] = useState("");   // id do prato escolhido (CMV real) ou "" = manual

  useEffect(() => {
    if (unidadeAtiva && unidadeAtiva !== "todas") {
      fetchParams(unidadeAtiva).then(r => setP({ ...PARAMS_PADRAO, ...r.data }));
      Promise.all([fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva)]).then(([rf, rp]) => {
        setFichas(rf.data || []); setProdutos(rp.data || []);
      });
    }
  }, [unidadeAtiva]);

  // Pratos do cardápio com PREÇO e CUSTO REAL de ingredientes (via fichas)
  const pratos = useMemo(() => {
    const porId = {}; fichas.forEach(f => { porId[f.id] = f; });
    return (produtos || [])
      .filter(pr => (Number(pr.preco_venda) || 0) > 0)
      .map(pr => {
        const comps = Array.isArray(pr.composicao) && pr.composicao.length ? pr.composicao : (pr.ficha_id ? [{ ficha_id: pr.ficha_id, qtd: 1 }] : []);
        let custo = 0, temFicha = false;
        comps.forEach(c => { const fi = porId[c.ficha_id]; if (!fi) return; temFicha = true; custo += (custoFicha(fi, fichas) / porcoesDaFicha(fi)) * (Number(c.qtd) || 1); });
        return temFicha ? { id: pr.id, nome: pr.nome_produto, preco: Number(pr.preco_venda) || 0, custo } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [produtos, fichas]);

  const pratoAtual = pratos.find(x => x.id === pratoSel) || null;

  const num = (v) => Number(v) || 0;
  const set = (k, v) => setP(o => ({ ...o, [k]: v === "" ? "" : Number(v) }));

  const salvar = async () => {
    setSalvando(true);
    const payload = {};
    ["custo_aluguel_mes", "custo_luz_mes", "custo_gas_mes", "custo_agua_mes", "custo_limpeza_mes", "custo_cmo_mes", "custo_outros_mes", "imposto_pct", "embalagem_pct", "dias_operacao_mes", "pratos_por_dia", "meta_cmv"]
      .forEach(k => payload[k] = num(p[k]));
    const { error } = await salvarParams(unidadeAtiva, payload);
    setSalvando(false);
    if (error) return alert("Erro ao salvar: " + error);
    setSalvou(true); setTimeout(() => setSalvou(false), 2500);
  };

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const dias = Math.max(1, num(p.dias_operacao_mes));
  const pratosDia = Math.max(1, num(p.pratos_por_dia));
  const fixosMes = num(p.custo_aluguel_mes) + num(p.custo_luz_mes) + num(p.custo_gas_mes) + num(p.custo_agua_mes) + num(p.custo_limpeza_mes) + num(p.custo_cmo_mes) + num(p.custo_outros_mes);
  const fixoDia = fixosMes / dias;
  const variavelPct = num(p.meta_cmv) + num(p.imposto_pct) + num(p.embalagem_pct);
  const margemPct = 100 - variavelPct;
  const equilibrioDia = margemPct > 0 ? fixoDia / (margemPct / 100) : Infinity;

  // Custo fixo rateado por prato (para a pizza)
  const porPrato = (custoMes) => (num(custoMes) / dias) / pratosDia;
  // Se escolheu um prato do cardápio, usa PREÇO e CUSTO REAL de ingredientes;
  // senão, usa o preço digitado e o CMV % alvo como estimativa.
  const P = pratoAtual ? pratoAtual.preco : num(precoPrato);
  const ingredientes = pratoAtual ? pratoAtual.custo : (P * num(p.meta_cmv) / 100);
  const fatias = [
    { id: "ingredientes", nome: "Ingredientes (CMV)", valor: ingredientes },
    { id: "imposto", nome: "Imposto", valor: P * num(p.imposto_pct) / 100 },
    { id: "embalagem", nome: "Embalagem", valor: P * num(p.embalagem_pct) / 100 },
    { id: "aluguel", nome: "Aluguel", valor: porPrato(p.custo_aluguel_mes) },
    { id: "luz", nome: "Luz / Energia", valor: porPrato(p.custo_luz_mes) },
    { id: "gas", nome: "Gás", valor: porPrato(p.custo_gas_mes) },
    { id: "agua", nome: "Água", valor: porPrato(p.custo_agua_mes) },
    { id: "limpeza", nome: "Produtos de limpeza", valor: porPrato(p.custo_limpeza_mes) },
    { id: "cmo", nome: "Mão de obra (CMO)", valor: porPrato(p.custo_cmo_mes) },
  ];
  const custoTotalPrato = fatias.reduce((s, f) => s + f.valor, 0);
  const lucro = P - custoTotalPrato;
  const fatiasPizza = [...fatias, { id: "lucro", nome: lucro >= 0 ? "Lucro" : "Prejuízo", valor: Math.abs(lucro) }].filter(f => f.valor > 0);
  const totalPizza = fatiasPizza.reduce((s, f) => s + f.valor, 0) || 1;

  // conic-gradient da pizza
  let acc = 0;
  const gradiente = fatiasPizza.map(f => {
    const ini = (acc / totalPizza) * 100;
    acc += f.valor;
    const fim = (acc / totalPizza) * 100;
    const cor = f.id === "lucro" && lucro < 0 ? "#DC2626" : COR[f.id];
    return `${cor} ${ini.toFixed(2)}% ${fim.toFixed(2)}%`;
  }).join(", ");

  const CampoCusto = ({ k, label, prefixo = "R$" }) => (
    <div>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
      <div className="relative mt-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{prefixo}</span>
        <input type="number" min="0" step="0.01" value={p[k] ?? ""} onChange={e => set(k, e.target.value)}
          className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <PageHeader title="Ponto de Equilíbrio" subtitle={`Quanto vender por dia para lucrar · ${unidadeInfo?.nome || ""}`} icon={PieChart}
        onAction={salvar} actionLabel={salvando ? "Salvando..." : (salvou ? "Salvo!" : "Salvar custos")} />
      <PageBody>
        {(!unidadeAtiva || unidadeAtiva === "todas") ? (
          <Card><p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Selecione uma unidade para configurar os custos.</p></Card>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Custos do mês */}
          <Card>
            <h3 className="font-black text-slate-800 mb-1">Custos do mês</h3>
            <p className="text-[11px] text-slate-500 mb-4">Quanto você gasta por mês com cada item. O sistema divide pelos dias de operação.</p>
            <div className="grid grid-cols-2 gap-3">
              <CampoCusto k="custo_aluguel_mes" label="Aluguel" />
              <CampoCusto k="custo_luz_mes" label="Luz / Energia" />
              <CampoCusto k="custo_gas_mes" label="Gás" />
              <CampoCusto k="custo_agua_mes" label="Água" />
              <CampoCusto k="custo_limpeza_mes" label="Produtos de limpeza" />
              <CampoCusto k="custo_cmo_mes" label="Folha / Mão de obra" />
              <CampoCusto k="custo_outros_mes" label="Outros fixos" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
              <CampoCusto k="dias_operacao_mes" label="Dias abertos no mês" prefixo="dias" />
              <CampoCusto k="pratos_por_dia" label="Pratos vendidos/dia" prefixo="un" />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
              <CampoCusto k="meta_cmv" label="CMV %" prefixo="%" />
              <CampoCusto k="imposto_pct" label="Imposto %" prefixo="%" />
              <CampoCusto k="embalagem_pct" label="Embalagem %" prefixo="%" />
            </div>
            <button onClick={salvar} disabled={salvando} className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl flex items-center justify-center gap-2">
              <Save size={16} /> {salvando ? "Salvando..." : (salvou ? "Salvo!" : "Salvar")}
            </button>
          </Card>

          {/* Resultado + Pizza */}
          <div className="space-y-4">
            {/* Ponto de equilíbrio */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className="text-emerald-600" />
                <h3 className="font-black text-slate-800">Quanto vender por dia</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl p-3 bg-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo fixo / dia</p>
                  <p className="text-xl font-black text-slate-800">{fmtBRL(fixoDia)}</p>
                </div>
                <div className="rounded-2xl p-3 bg-emerald-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Vender p/ empatar</p>
                  <p className="text-xl font-black text-emerald-700">{margemPct > 0 ? fmtBRL(equilibrioDia) : "—"}</p>
                </div>
              </div>
              {margemPct > 0 ? (
                <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
                  Vendendo <b>{fmtBRL(equilibrioDia)}</b> por dia você paga tudo (aluguel, luz, gás, água, limpeza, folha e outros) e ainda cobre CMV, imposto e embalagem. <b>Acima disso é lucro.</b> Cada real acima do equilíbrio rende <b>{margemPct.toFixed(0)}%</b> de margem.
                </p>
              ) : (
                <p className="text-[12px] text-rose-600 mt-3 font-bold flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> CMV + imposto + embalagem somam {variavelPct.toFixed(0)}% — não sobra margem para pagar os fixos. Reveja os preços ou reduza esses percentuais.</p>
              )}
            </Card>

            {/* Pizza do prato */}
            <Card>
              <h3 className="font-black text-slate-800 flex items-center gap-2 mb-3"><PieChart size={18} className="text-slate-500" /> A pizza de um prato</h3>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <select value={pratoSel} onChange={e => setPratoSel(e.target.value)}
                  className="flex-1 min-w-[160px] py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-sm outline-none focus:border-emerald-500">
                  <option value="">Preço manual</option>
                  {pratos.map(pr => <option key={pr.id} value={pr.id}>{pr.nome} — {fmtBRL(pr.preco)}</option>)}
                </select>
                {!pratoAtual && (
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <input type="number" min="0" step="0.5" value={precoPrato} onChange={e => setPrecoPrato(e.target.value)}
                      className="w-24 pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500" />
                  </div>
                )}
              </div>
              {pratoAtual
                ? <p className="text-[11px] text-emerald-600 font-bold mb-3 -mt-1">Ingredientes vindos da ficha técnica deste prato (CMV real).</p>
                : <p className="text-[11px] text-slate-400 font-medium mb-3 -mt-1">Escolha um prato para usar o CMV real da ficha, ou digite um preço (usa o CMV % alvo).</p>}
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="shrink-0 rounded-full" style={{ width: 150, height: 150, background: `conic-gradient(${gradiente})` }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="rounded-full bg-white flex flex-col items-center justify-center" style={{ width: 92, height: 92 }}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Preço</span>
                      <span className="text-base font-black text-slate-800">{fmtBRL(P)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-1">
                  {fatiasPizza.map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-[12px]">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: f.id === "lucro" && lucro < 0 ? "#DC2626" : COR[f.id] }} />
                      <span className="flex-1 font-bold text-slate-600 truncate">{f.nome}</span>
                      <span className="font-black text-slate-800">{fmtBRL(f.valor)}</span>
                      <span className="w-10 text-right font-bold text-slate-400">{Math.round(f.valor / totalPizza * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`mt-3 pt-3 border-t border-slate-100 text-center font-black ${lucro >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {lucro >= 0 ? "Lucro por prato: " : "Prejuízo por prato: "}{fmtBRL(Math.abs(lucro))}
                <span className="text-[11px] font-bold text-slate-400"> ({Math.round(lucro / (P || 1) * 100)}% do preço)</span>
              </div>
            </Card>
          </div>
        </div>
        )}
      </PageBody>
    </div>
  );
}
