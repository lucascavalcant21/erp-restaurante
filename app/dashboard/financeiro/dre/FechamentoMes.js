"use client";

import { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { fetchColaboradores } from "../../../lib/rh";
import { fetchContas } from "../../../lib/financeiro";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";

// Custo recursivo da ficha (mesma regra do CMV) — cópia compacta
function custoFicha(f, todas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let t = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    const fc = 1 + (Number(fi.fator_correcao) || 0) / 100;
    if (fi.insumos) t += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0) * fc;
    else if (fi.subficha_id) {
      const b = todas.find(x => x.id === fi.subficha_id);
      t += (b ? custoFicha(b, todas, guard) / (b.rendimento_porcoes || 1) : 0) * (fi.quantidade || 0) * fc;
    }
  });
  return t;
}
function porcoesF(f) {
  const r = Number(f?.rendimento_porcoes) || 1;
  const un = String(f?.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return r;
  const pg = Number(f?.peso_porcao_g) || 0;
  const tot = (un === "kg" || un === "l") ? r * 1000 : r;
  return pg > 0 ? tot / pg : r;
}

// Fechamento do mês: você digita o faturamento e a taxa de serviço; o sistema
// aplica CMV médio, CMO (folha), imposto do Simples, cartão e as contas do mês
// por categoria — tudo separado, em % e em R$.
export default function FechamentoMes({ unidadeAtiva, unidadeInfo }) {
  const [faturamento, setFaturamento] = useState("");
  const [taxaServico, setTaxaServico] = useState("");
  const [pctImposto, setPctImposto] = useState("6");      // Simples Nacional
  const [pctCartao, setPctCartao] = useState("3.5");      // taxa média da maquininha
  const [pctVendasCartao, setPctVendasCartao] = useState("70"); // % das vendas no cartão
  const [cmvMedio, setCmvMedio] = useState(null);
  const [folha, setFolha] = useState(0);
  const [contasMes, setContasMes] = useState([]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    (async () => {
      const mes = new Date().toISOString().slice(0, 7);
      const [rC, rContas, rF, rP] = await Promise.all([
        fetchColaboradores(unidadeAtiva),
        fetchContas(unidadeAtiva, ""),
        fetchFichas(unidadeAtiva),
        fetchProdutos(unidadeAtiva),
      ]);
      const ativos = (rC.data || []).filter(c => (c.status || "ativo") !== "inativo" && c.tipo_contrato !== "Freelancer");
      setFolha(ativos.reduce((s, c) => s + (Number(c.salario) || 0), 0));
      setContasMes((rContas.data || []).filter(c => String(c.data_vencimento || "").slice(0, 7) === mes));
      // CMV médio da carta (fichas precificadas)
      const fichas = rF.data || [];
      const cmvs = (rP.data || []).filter(p => Number(p.preco_venda) > 0).map(p => {
        const comps = Array.isArray(p.composicao) && p.composicao.length ? p.composicao : (p.ficha_id ? [{ ficha_id: p.ficha_id, qtd: 1 }] : []);
        let custo = 0, tem = false;
        comps.forEach(c => { const f = fichas.find(x => x.id === c.ficha_id); if (!f) return; tem = true; custo += (custoFicha(f, fichas) / porcoesF(f)) * (Number(c.qtd) || 1); });
        return tem ? (custo / Number(p.preco_venda)) * 100 : null;
      }).filter(v => v !== null);
      setCmvMedio(cmvs.length ? cmvs.reduce((a, b) => a + b, 0) / cmvs.length : null);
    })();
  }, [unidadeAtiva]);

  const fat = Number(String(faturamento).replace(",", ".")) || 0;
  const taxa = Number(String(taxaServico).replace(",", ".")) || 0;
  const receita = fat + taxa;
  const vImposto = receita * ((Number(pctImposto) || 0) / 100);
  const vCartao = fat * ((Number(pctVendasCartao) || 0) / 100) * ((Number(pctCartao) || 0) / 100);
  const pctCmv = cmvMedio ?? 0;
  const vCmv = fat * (pctCmv / 100);
  // Contas do mês por categoria (cmo fica de fora: a folha entra como CMO)
  const porCat = {};
  contasMes.filter(c => c.categoria !== "cmo").forEach(c => { const k = c.categoria || "outros"; porCat[k] = (porCat[k] || 0) + (Number(c.valor) || 0); });
  const nomeCat = { manutencao: "Manutenção", limpeza: "Produtos de limpeza", aluguel: "Aluguel", energia: "Energia", agua: "Água", gas: "Gás", internet: "Internet", outros: "Outros custos fixos" };
  const totalContas = Object.values(porCat).reduce((a, b) => a + b, 0);
  const totalCustos = vImposto + vCartao + vCmv + folha + totalContas;
  const lucro = receita - totalCustos;
  const pct = (v) => receita > 0 ? `${((v / receita) * 100).toFixed(1)}%` : "—";

  const Linha = ({ label, valor, cor = "text-slate-700", sub }) => (
    <div className="flex justify-between items-baseline py-1.5 border-b border-slate-100">
      <span className="text-sm font-bold text-slate-500">{label}{sub && <span className="block text-[10px] font-medium text-slate-400">{sub}</span>}</span>
      <span className="text-right shrink-0 ml-2"><span className="text-[10px] font-bold text-slate-400 mr-2">{pct(valor)}</span><span className={`font-black ${cor}`}>{fmtBRL(valor)}</span></span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 mt-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-1"><Calculator size={20} className="text-emerald-600" /> Fechamento do Mês — DRE detalhado</h2>
        <p className="text-xs font-medium text-slate-500 mb-4">Digite o faturamento e a taxa de serviço — o resto o sistema preenche: CMV médio da carta, CMO (folha), Simples, cartão e as contas do mês por categoria.</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Faturamento (R$)</label>
            <input type="text" inputMode="decimal" value={faturamento} onChange={e => setFaturamento(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00" className="w-full p-3 mt-1 bg-emerald-50 border-2 border-emerald-300 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500" /></div>
          <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Taxa de serviço (R$)</label>
            <input type="text" inputMode="decimal" value={taxaServico} onChange={e => setTaxaServico(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00" className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" /></div>
          <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Simples (%)</label>
            <input type="number" step="0.1" value={pctImposto} onChange={e => setPctImposto(e.target.value)} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" /></div>
          <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Taxa cartão (%)</label>
            <input type="number" step="0.1" value={pctCartao} onChange={e => setPctCartao(e.target.value)} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" /></div>
          <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vendas no cartão (%)</label>
            <input type="number" step="1" value={pctVendasCartao} onChange={e => setPctVendasCartao(e.target.value)} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" /></div>
        </div>

        {receita > 0 ? (
          <>
            <Linha label="Receita bruta" sub={taxa > 0 ? `faturamento ${fmtBRL(fat)} + taxa de serviço ${fmtBRL(taxa)}` : "faturamento do mês"} valor={receita} cor="text-slate-900" />
            <Linha label={`(−) Imposto — Simples Nacional (${pctImposto}%)`} valor={-vImposto} cor="text-rose-600" />
            <Linha label={`(−) Cartão crédito/débito (${pctVendasCartao}% das vendas × ${pctCartao}%)`} valor={-vCartao} cor="text-rose-600" />
            <Linha label={`(−) CMV${cmvMedio !== null ? ` — ${cmvMedio.toFixed(1)}% médio da carta` : " (sem fichas precificadas)"}`} sub="custo variável de insumos" valor={-vCmv} cor="text-rose-600" />
            <Linha label="(−) CMO — folha da equipe fixa" sub="salários cadastrados no RH" valor={-folha} cor="text-rose-600" />
            {Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
              <Linha key={cat} label={`(−) ${nomeCat[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}`} sub="contas a pagar do mês" valor={-v} cor="text-rose-600" />
            ))}
            <div className="flex justify-between items-baseline pt-3 mt-2 border-t-2 border-slate-800">
              <span className="font-black text-slate-800 uppercase tracking-widest text-sm">Lucro do mês</span>
              <span className="text-right"><span className="text-xs font-bold text-slate-400 mr-2">{pct(lucro)}</span><span className={`text-2xl font-black ${lucro >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtBRL(lucro)}</span></span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-3">CMV = média teórica das fichas precificadas aplicada ao faturamento. Contas do mês vêm do Contas a Pagar por categoria (a folha lançada como "cmo" fica de fora para não contar duas vezes). Ajuste os percentuais conforme sua faixa do Simples e o contrato da maquininha.</p>
          </>
        ) : (
          <p className="text-sm font-medium text-slate-400 py-4 text-center">Digite o faturamento do mês para montar o DRE.</p>
        )}
      </div>
    </div>
  );
}
