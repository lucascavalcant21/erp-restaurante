"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useERP } from "../../context/ERPContext";
import {
  TrendingUp, Wallet, Receipt, Percent, Package, Warehouse, PackageX, Hourglass,
  Loader2, Printer, Flame, Users
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../components/ui";

import { fetchContas } from "../../lib/financeiro";
import { fetchColaboradores, fetchBancoHoras } from "../../lib/rh";
import { fetchFichas } from "../../lib/operacao";
import { fetchProdutos } from "../../lib/vendas";
import { fetchEstoque, fetchProducoesPeriodo } from "../../lib/estoque";
import { fetchInventario, fetchMovimentosInventario } from "../../lib/inventario";

const META_CMV = 30;

// ── Custo de ficha (mesmo cálculo do CMV/Dashboard) ──────────────────────────
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
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

const fmtMin = (m) => `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`;

export default function RelatorioGerencial() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setLoading(false); setDados(null); return; }
    let vivo = true;
    (async () => {
      setLoading(true);
      const mes = new Date().toISOString().slice(0, 7);
      const [rContas, rColab, rFichas, rProd, rEstoque, rInv, rMov, rBanco, rProducoes] = await Promise.all([
        fetchContas(unidadeAtiva, ""),
        fetchColaboradores(unidadeAtiva),
        fetchFichas(unidadeAtiva),
        fetchProdutos(unidadeAtiva),
        fetchEstoque(unidadeAtiva),
        fetchInventario(unidadeAtiva),
        fetchMovimentosInventario(unidadeAtiva, 500),
        fetchBancoHoras(unidadeAtiva, mes),
        fetchProducoesPeriodo(unidadeAtiva, dias),
      ]);
      if (!vivo) return;
      setDados({
        contas: rContas.data || [], colaboradores: rColab.data || [], fichas: rFichas.data || [],
        produtos: rProd.data || [], estoque: rEstoque.data || [], inventario: rInv.data || [],
        movInventario: rMov.data || [], bancoHoras: rBanco.data || [], producoes: rProducoes.data || [],
      });
      setLoading(false);
    })();
    return () => { vivo = false; };
  }, [unidadeAtiva, dias]);

  const m = useMemo(() => {
    if (!dados) return null;
    const { contas, colaboradores, fichas, produtos, estoque, inventario, movInventario, bancoHoras, producoes } = dados;
    const corte = new Date(Date.now() - dias * 86400000);
    const corteISO = corte.toISOString().split("T")[0];

    // Despesas do período (contas_pagar)
    const noPeriodo = contas.filter(c => (c.data_pagamento || c.data_vencimento || "") >= corteISO);
    const pagas = noPeriodo.filter(c => (c.status || "") === "pago");
    const totalPago = pagas.reduce((s, c) => s + (Number(c.valor) || 0), 0);
    const pendentes = contas.filter(c => (c.status || "pendente") !== "pago");
    const totalPendente = pendentes.reduce((s, c) => s + (Number(c.valor) || 0), 0);

    // Despesas por categoria (período, pagas + pendentes do período)
    const porCategoria = {};
    noPeriodo.forEach(c => {
      const cat = c.categoria || "Sem categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + (Number(c.valor) || 0);
    });
    const categorias = Object.entries(porCategoria).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    const totalCategorias = categorias.reduce((s, c) => s + c.valor, 0);

    // Folha (mão de obra) mensal
    const ativos = colaboradores.filter(c => (c.status || "ativo") !== "inativo");
    const folhaMes = ativos.reduce((s, c) => s + (Number(c.salario) || 0), 0);

    // CMV médio da carta
    const fichasPorId = {}; fichas.forEach(f => { fichasPorId[f.id] = f; });
    const cmvs = produtos.filter(p => (Number(p.preco_venda) || 0) > 0).map(p => {
      const comps = Array.isArray(p.composicao) && p.composicao.length ? p.composicao : (p.ficha_id ? [{ ficha_id: p.ficha_id, qtd: 1 }] : []);
      let custo = 0, tem = false;
      comps.forEach(c => { const f = fichasPorId[c.ficha_id]; if (!f) return; tem = true; custo += (custoTotalDaFicha(f, fichas) / porcoesDaFicha(f)) * (Number(c.qtd) || 1); });
      const preco = Number(p.preco_venda) || 0;
      return tem && preco > 0 ? (custo / preco) * 100 : null;
    }).filter(v => v !== null);
    const cmvMedio = cmvs.length ? cmvs.reduce((a, b) => a + b, 0) / cmvs.length : null;

    // Estoque de insumos (valor imobilizado) + zerados
    const valorEstoque = estoque.reduce((s, e) => s + (Number(e.custo_unitario) || 0) * (Number(e.quantidade_atual) || 0), 0);
    const zerados = estoque.filter(e => (Number(e.quantidade_atual) || 0) <= 0).length;

    // Inventário (patrimônio) + baixas do período
    const valorPatrimonio = inventario.reduce((s, i) => s + (Number(i.valor_unitario) || 0) * (Number(i.quantidade) || 0), 0);
    const baixasPeriodo = movInventario.filter(mv => ["quebra", "perda", "descarte"].includes(mv.tipo) && new Date(mv.created_at) >= corte);
    const qtdBaixas = baixasPeriodo.reduce((s, b) => s + (Number(b.quantidade) || 0), 0);

    // Banco de horas da equipe (mês)
    const totalBanco = bancoHoras.reduce((s, b) => s + (Number(b.minutos) || 0), 0);

    // Produções do período: agrupa por ficha + custo estimado
    const prodPorFicha = {};
    producoes.forEach(p => {
      const nome = p.fichas_tecnicas?.nome_receita || "Receita";
      const ficha = fichas.find(f => f.id === p.ficha_id);
      const custoPorcao = ficha ? custoTotalDaFicha(ficha, fichas) / porcoesDaFicha(ficha) : 0;
      const qtd = Number(p.quantidade_produzida) || 0;
      if (!prodPorFicha[nome]) prodPorFicha[nome] = { nome, qtd: 0, custo: 0 };
      prodPorFicha[nome].qtd += qtd;
      prodPorFicha[nome].custo += custoPorcao * qtd;
    });
    const producoesResumo = Object.values(prodPorFicha).sort((a, b) => b.custo - a.custo);
    const custoProducao = producoesResumo.reduce((s, p) => s + p.custo, 0);
    const qtdProducoes = producoes.length;

    return {
      totalPago, totalPendente, categorias, totalCategorias, folhaMes, ativos: ativos.length,
      cmvMedio, cmvCount: cmvs.length, valorEstoque, zerados, valorPatrimonio,
      baixasPeriodo: baixasPeriodo.length, qtdBaixas, totalBanco,
      producoesResumo, custoProducao, qtdProducoes,
    };
  }, [dados, dias]);

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="p-8 max-w-5xl mx-auto"><div className="erp-card p-10 text-center font-bold" style={{ color: "var(--muted)" }}>Selecione uma unidade no topo para gerar o relatório.</div></div>;
  }

  if (loading || !m) return (
    <div className="flex flex-col items-center justify-center h-[70vh]" style={{ color: "var(--dim)" }}>
      <Loader2 size={44} className="animate-spin mb-4" style={{ color: "var(--accent)" }} />
      <p className="font-bold uppercase tracking-widest text-sm">Montando o relatório...</p>
    </div>
  );

  const Kpi = ({ icon: Icon, label, value, sub, cor }) => (
    <div className="erp-card p-5 print:border print:border-slate-300 print:shadow-none print:rounded-lg">
      <div className="flex items-center gap-2 mb-1.5" style={{ color: "var(--muted)" }}>
        <Icon size={15} />
        <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-extrabold tracking-tight" style={{ color: cor || "var(--fg)" }}>{value}</p>
      {sub && <p className="text-[11px] font-bold mt-0.5" style={{ color: "var(--dim)" }}>{sub}</p>}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 pb-16 print:p-0">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-7 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" style={{ color: "var(--fg)" }}>
            <TrendingUp style={{ color: "var(--accent-strong)" }} size={32} /> Relatório Gerencial
          </h1>
          <p className="font-medium mt-1" style={{ color: "var(--muted)" }}>
            {unidadeInfo?.nome} · últimos {dias} dias · gerado em {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            {[7, 15, 30].map(d => (
              <button key={d} onClick={() => setDias(d)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${dias === d ? "text-white" : ""}`}
                style={dias === d ? { background: "var(--accent-strong)" } : { color: "var(--muted)" }}>
                {d} dias
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className="erp-btn erp-btn-primary !h-11 text-sm">
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* KPIs — só dados que existem de verdade na operação */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Kpi icon={Receipt} label={`Despesas pagas (${dias}d)`} value={fmtBRL(m.totalPago)} sub="contas com status pago" cor="#DC2626" />
        <Kpi icon={Wallet} label="Contas em aberto" value={fmtBRL(m.totalPendente)} sub="pendentes de pagamento" />
        <Kpi icon={Users} label="Folha mensal (CMO)" value={fmtBRL(m.folhaMes)} sub={`${m.ativos} colaborador(es)`} />
        <Kpi icon={Percent} label="CMV médio da carta" value={m.cmvCount ? fmtPct(m.cmvMedio) : "—"}
          sub={m.cmvCount ? `meta ${META_CMV}%` : "sem fichas precificadas"}
          cor={m.cmvMedio !== null ? (m.cmvMedio <= META_CMV ? "#047857" : "#DC2626") : undefined} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <Kpi icon={Package} label="Estoque de insumos" value={fmtBRL(m.valorEstoque)} sub={m.zerados ? `${m.zerados} item(ns) zerado(s)` : "nenhum item zerado"} />
        <Kpi icon={Warehouse} label="Patrimônio (inventário)" value={fmtBRL(m.valorPatrimonio)} sub="itens com valor informado" />
        <Kpi icon={PackageX} label={`Baixas de inventário (${dias}d)`} value={m.qtdBaixas.toLocaleString("pt-BR")} sub={`${m.baixasPeriodo} registro(s) de quebra/perda`} cor={m.qtdBaixas > 0 ? "#DC2626" : undefined} />
        <Kpi icon={Hourglass} label="Banco de horas (mês)" value={fmtMin(m.totalBanco)} sub="intervalos não tirados da equipe" cor={m.totalBanco >= 360 ? "#B45309" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Despesas por categoria */}
        <div className="erp-card p-6 print:border print:border-slate-300 print:shadow-none print:rounded-lg">
          <h3 className="font-black mb-5 flex items-center gap-2" style={{ color: "var(--fg)" }}><Receipt size={18} /> Despesas por categoria ({dias} dias)</h3>
          {m.categorias.length === 0 ? (
            <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Nenhuma conta lançada no período.</p>
          ) : (
            <div className="space-y-3">
              {m.categorias.map(c => {
                const pct = m.totalCategorias > 0 ? (c.valor / m.totalCategorias) * 100 : 0;
                return (
                  <div key={c.nome}>
                    <div className="flex justify-between text-sm font-bold mb-1">
                      <span style={{ color: "var(--fg-soft)" }}>{c.nome === "cmo" ? "Mão de obra (CMO)" : c.nome}</span>
                      <span style={{ color: "var(--muted)" }}>{fmtBRL(c.valor)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: "var(--elevated)" }}>
                      <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2 border-t text-sm font-black" style={{ borderColor: "var(--line)", color: "var(--fg)" }}>
                <span>Total do período</span><span>{fmtBRL(m.totalCategorias)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Produções do período */}
        <div className="erp-card p-6 print:border print:border-slate-300 print:shadow-none print:rounded-lg">
          <h3 className="font-black mb-5 flex items-center gap-2" style={{ color: "var(--fg)" }}><Flame size={18} /> Produção da cozinha ({dias} dias)</h3>
          {m.producoesResumo.length === 0 ? (
            <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Nenhuma produção registrada no período. Registre em Operação → Produção Diária para aparecer aqui.</p>
          ) : (
            <div className="space-y-2">
              {m.producoesResumo.slice(0, 10).map(p => (
                <div key={p.nome} className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "var(--line-soft)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--fg-soft)" }}>{p.nome}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>{p.qtd.toLocaleString("pt-BR")} porções</p>
                  </div>
                  <span className="font-black text-sm shrink-0 ml-2" style={{ color: "var(--fg)" }}>{fmtBRL(p.custo)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-sm font-black" style={{ color: "var(--fg)" }}>
                <span>{m.qtdProducoes} produção(ões) · custo estimado</span><span style={{ color: "var(--accent-strong)" }}>{fmtBRL(m.custoProducao)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] font-medium mt-6 text-center print:mt-8" style={{ color: "var(--dim)" }}>
        Relatório gerencial de {unidadeInfo?.nome} — dados reais de contas, RH, fichas técnicas, estoque, inventário e produção. Sem dados de venda (ERP de gestão).
      </p>
    </div>
  );
}
