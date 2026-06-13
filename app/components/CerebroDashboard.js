"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Brain, TrendingUp, DollarSign, Users, AlertTriangle, Lightbulb,
  Crown, ArrowUpRight, ArrowDownRight, Package, ChefHat, BarChart3
} from "lucide-react";
import { Card, SectionLabel, fmtBRL } from "./ui";
import { UNIDADES } from "../lib/unidades";
import { fetchEstoque } from "../lib/estoque";
import { fetchFuncionarios } from "../lib/rh";
import { fetchCardapio } from "../lib/cardapio";
import { fetchLancamentos } from "../lib/financeiro";
import { fetchProducoes } from "../lib/producao";
import { fetchVendas } from "../lib/vendas";

function fmtPct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

// ─── Lógica para consolidar os dados de UMA unidade ───────────────────────────
async function carregarDadosDaUnidade(u) {
  const [est, fun, car, lan, prod, ven] = await Promise.all([
    fetchEstoque(u.id),
    fetchFuncionarios(u.id),
    fetchCardapio(u.id),
    fetchLancamentos(u.id),
    fetchProducoes(u.id, null, 500),
    fetchVendas(u.id)
  ]);
  
  const estoque = est.data || [];
  const equipe = (fun.data || []).filter((f) => f.ativo !== false && f.status !== "inativo");
  const pratos = (car.data || []).filter((p) => p.ativo !== false);
  const lancamentos = lan.data || [];
  const producoes = prod.data || [];
  const vendas = ven.data || [];

  // Financeiro 30 dias
  const now = Date.now(), d30 = 30 * 86400000;
  const lanc30 = lancamentos.filter((l) => new Date(l.data).getTime() >= now - d30);
  const receita30 = lanc30.filter(l => l.tipo === "entrada").reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const despesa30 = lanc30.filter(l => l.tipo === "saida").reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const lucro30 = receita30 - despesa30;

  // CMO: Custo de Mão de Obra
  const folha = equipe.reduce((a, f) => a + (Number(f.salario) || 0), 0);
  const cmo = receita30 > 0 ? (folha / receita30) * 100 : 0;

  // CMV: Custo de Mercadoria Vendida (Estimado pelo custo dos pratos produzidos vs Receita Potencial)
  // Ou pelo histórico de produção dos últimos 30 dias
  const prod30 = producoes.filter((p) => new Date(p.created_at).getTime() >= now - d30);
  const custoProduzido = prod30.reduce((a, p) => a + (Number(p.custo_total) || 0), 0);
  const receitaProduzida = prod30.reduce((a, p) => a + (Number(p.receita_potencial) || 0), 0);
  const cmvProducao = receitaProduzida > 0 ? (custoProduzido / receitaProduzida) * 100 : null;

  // CMV via Cardápio (Médio)
  const cmvsPratos = pratos.filter((p) => (Number(p.preco) || 0) > 0).map((p) => ((Number(p.custo) || 0) / Number(p.preco)) * 100);
  const cmvMedio = cmvsPratos.length ? cmvsPratos.reduce((a, b) => a + b, 0) / cmvsPratos.length : 0;

  const cmvFinal = cmvProducao !== null ? cmvProducao : cmvMedio;

  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0)).length;

  return {
    ...u,
    receita30,
    despesa30,
    lucro30,
    folha,
    cmo,
    cmv: cmvFinal,
    criticos,
    equipe: equipe.length,
    vendas30: vendas.filter(v => new Date(v.created_at).getTime() >= now - d30),
    producoes30: prod30
  };
}

// ─── Componente do Cérebro ───────────────────────────────────────────────────
export default function CerebroDashboard() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all(UNIDADES.map(carregarDadosDaUnidade)).then((res) => {
      if (vivo) {
        setUnidades(res);
        setLoading(false);
      }
    });
    return () => { vivo = false; };
  }, []);

  // Consolidado
  const rede = useMemo(() => {
    if (!unidades.length) return null;
    const receita = unidades.reduce((a, u) => a + u.receita30, 0);
    const despesa = unidades.reduce((a, u) => a + u.despesa30, 0);
    const lucro = receita - despesa;
    const folha = unidades.reduce((a, u) => a + u.folha, 0);
    const cmo = receita > 0 ? (folha / receita) * 100 : 0;
    const cmvsValidos = unidades.filter(u => u.cmv > 0);
    const cmv = cmvsValidos.length ? cmvsValidos.reduce((a, u) => a + u.cmv, 0) / cmvsValidos.length : 0;
    const criticos = unidades.reduce((a, u) => a + u.criticos, 0);
    const colaboradores = unidades.reduce((a, u) => a + u.equipe, 0);
    
    // Top produtos (Vendas ou Produção)
    const produtos = {};
    unidades.forEach(u => {
      u.producoes30.forEach(p => {
        if (!produtos[p.prato_nome]) produtos[p.prato_nome] = { nome: p.prato_nome, qtd: 0, lucro: 0 };
        produtos[p.prato_nome].qtd += Number(p.quantidade) || 0;
        produtos[p.prato_nome].lucro += (Number(p.receita_potencial) || 0) - (Number(p.custo_total) || 0);
      });
    });
    const topPratos = Object.values(produtos).sort((a, b) => b.lucro - a.lucro).slice(0, 5);

    return { receita, despesa, lucro, folha, cmo, cmv, criticos, colaboradores, topPratos };
  }, [unidades]);

  // Motor de Insights (Geração de Dicas Inteligentes)
  const insights = useMemo(() => {
    if (!rede) return [];
    const alertas = [];

    // CMO
    if (rede.cmo > 30) {
      alertas.push({ tipo: "perigo", msg: `O Custo de Mão de Obra (CMO) da rede está muito alto (${fmtPct(rede.cmo)}). O ideal para restaurantes é abaixo de 25%.` });
    } else if (rede.cmo > 0 && rede.cmo < 20) {
      alertas.push({ tipo: "sucesso", msg: `O Custo de Mão de Obra (CMO) da rede está excelente (${fmtPct(rede.cmo)}). Equipe altamente produtiva.` });
    }
    unidades.forEach(u => {
      if (u.cmo > 35) alertas.push({ tipo: "alerta", msg: `Atenção à loja ${u.nome}: CMO crítico de ${fmtPct(u.cmo)}. Receita não está pagando a folha adequadamente.` });
    });

    // CMV
    if (rede.cmv > 35) {
      alertas.push({ tipo: "perigo", msg: `O Custo da Mercadoria Vendida (CMV) da rede está em ${fmtPct(rede.cmv)}. Fique de olho no desperdício ou ajuste os preços de venda.` });
    } else if (rede.cmv > 0 && rede.cmv <= 28) {
      alertas.push({ tipo: "sucesso", msg: `CMV da rede muito saudável (${fmtPct(rede.cmv)}). Boa precificação e controle de estoque.` });
    }
    unidades.forEach(u => {
      if (u.cmv > 40) alertas.push({ tipo: "alerta", msg: `Unidade ${u.nome} com CMV crítico de ${fmtPct(u.cmv)}. Verifique as fichas técnicas e desperdícios urgentes.` });
    });

    // Vendas e Lucros
    const melhorLoja = unidades.reduce((m, u) => (u.lucro30 > (m?.lucro30 || 0) ? u : m), null);
    if (melhorLoja && melhorLoja.lucro30 > 0) {
      alertas.push({ tipo: "info", msg: `A unidade ${melhorLoja.nome} é o destaque do mês, puxando o lucro da rede com ${fmtBRL(melhorLoja.lucro30)}.` });
    }

    if (rede.topPratos.length > 0) {
      alertas.push({ tipo: "info", msg: `O prato "${rede.topPratos[0].nome}" é sua estrela! Ele gerou ${fmtBRL(rede.topPratos[0].lucro)} de lucro bruto estimado na produção.` });
    }

    if (rede.criticos > 0) {
      alertas.push({ tipo: "alerta", msg: `Existem ${rede.criticos} itens em estoque crítico na rede. Evite ruptura de vendas repondo os insumos.` });
    }

    return alertas;
  }, [rede, unidades]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Brain size={48} className="animate-pulse" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--dim)", fontWeight: 600 }}>O Cérebro está processando dados das unidades...</p>
      </div>
    );
  }

  const kpiBox = (label, value, Icon, color, sub) => (
    <Card className="p-5 flex flex-col justify-between" style={{ borderBottom: `4px solid ${color}`, boxShadow: `0 10px 30px -10px ${color}20` }}>
      <div className="flex justify-between items-start mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={22} style={{ color }} />
        </div>
        <p className="text-[11px] uppercase font-bold tracking-widest mt-2" style={{ color: "var(--dim)" }}>{label}</p>
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight" style={{ color: "var(--fg)" }}>{value}</p>
        {sub && <p className="text-xs font-semibold mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
    </Card>
  );

  return (
    <div className="p-4 space-y-6 pb-20">
      
      {/* Título Cérebro */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)", boxShadow: "0 8px 16px rgba(139, 92, 246, 0.25)" }}>
          <Brain size={24} color="#fff" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--fg)" }}>Cérebro ERP</h1>
          <p className="text-sm font-semibold" style={{ color: "var(--dim)" }}>Central de Inteligência • Últimos 30 dias</p>
        </div>
      </div>

      {/* Visão Macro */}
      <div>
        <SectionLabel>Visão Macro da Rede</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiBox("Receita Total", fmtBRL(rede.receita), TrendingUp, "#10B981", "Faturamento somado")}
          {kpiBox("Lucro Líquido", fmtBRL(rede.lucro), DollarSign, rede.lucro >= 0 ? "#3B82F6" : "#EF4444", "Receitas - Despesas")}
          {kpiBox("CMV Médio", fmtPct(rede.cmv), Package, rede.cmv > 35 ? "#EF4444" : "#F59E0B", "Custo da Mercadoria Vendida")}
          {kpiBox("CMO Médio", fmtPct(rede.cmo), Users, rede.cmo > 30 ? "#EF4444" : "#8B5CF6", "Custo de Mão de Obra")}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Insights */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <SectionLabel>Insights Inteligentes</SectionLabel>
            <div className="space-y-3">
              {insights.map((ins, i) => {
                let color, bg, borderColor;
                switch (ins.tipo) {
                  case "perigo": color = "#EF4444"; bg = "rgba(239,68,68,0.08)"; borderColor = "rgba(239,68,68,0.3)"; break;
                  case "alerta": color = "#F59E0B"; bg = "rgba(245,158,11,0.08)"; borderColor = "rgba(245,158,11,0.3)"; break;
                  case "sucesso": color = "#10B981"; bg = "rgba(16,185,129,0.08)"; borderColor = "rgba(16,185,129,0.3)"; break;
                  default: color = "#3B82F6"; bg = "rgba(59,130,246,0.08)"; borderColor = "rgba(59,130,246,0.3)"; break;
                }
                return (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: bg, border: `1px solid ${borderColor}` }}>
                    <div className="mt-0.5">
                      {ins.tipo === "perigo" || ins.tipo === "alerta" ? <AlertTriangle size={20} color={color} /> : <Lightbulb size={20} color={color} />}
                    </div>
                    <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--fg)" }}>{ins.msg}</p>
                  </div>
                );
              })}
              {insights.length === 0 && (
                <div className="p-4 text-center rounded-2xl" style={{ background: "var(--panel)" }}>
                  <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>Sem insights críticos no momento. O Cérebro continua monitorando.</p>
                </div>
              )}
            </div>
          </div>

          {/* Ranking de Pratos */}
          <div>
            <SectionLabel>Curva ABC: Top Pratos (Lucratividade)</SectionLabel>
            <Card className="!p-0 overflow-hidden">
              {rede.topPratos.length === 0 ? (
                <p className="p-6 text-center text-sm font-medium" style={{ color: "var(--dim)" }}>Sem histórico de produção/vendas para analisar.</p>
              ) : (
                rede.topPratos.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 p-4" style={i > 0 ? { borderTop: "1px solid var(--line)" } : {}}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold" style={{ background: i === 0 ? "#F59E0B" : "var(--panel)", color: i === 0 ? "#fff" : "var(--dim)" }}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>{p.nome}</p>
                      <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{p.qtd} unidades vendidas/produzidas</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm" style={{ color: "#10B981" }}>{fmtBRL(p.lucro)}</p>
                      <p className="text-[10px] uppercase font-bold" style={{ color: "var(--dim)" }}>Lucro Estimado</p>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>

        {/* Coluna Direita: Ranking Lojas */}
        <div className="space-y-6">
          <SectionLabel>Ranking de Lojas (Receita)</SectionLabel>
          <div className="space-y-3">
            {unidades.slice().sort((a, b) => b.receita30 - a.receita30).map((u, i) => {
              const maxR = Math.max(1, ...unidades.map(x => x.receita30));
              const pct = (u.receita30 / maxR) * 100;
              return (
                <Card key={u.id} className="p-4" style={i === 0 ? { border: "1px solid #F59E0B", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.1)" } : {}}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Crown size={16} color="#F59E0B" />}
                      <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>{u.nome}</span>
                    </div>
                    <span className="font-black text-sm" style={{ color: i === 0 ? "#F59E0B" : "var(--fg)" }}>{fmtBRL(u.receita30)}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full w-full" style={{ background: "var(--panel)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: i === 0 ? "linear-gradient(90deg, #F59E0B, #FBBF24)" : u.cor || "var(--accent)" }} />
                  </div>
                  
                  <div className="flex gap-4 mt-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">CMV</p>
                      <p className="text-xs font-bold" style={{ color: u.cmv > 35 ? "#EF4444" : "var(--fg-soft)" }}>{fmtPct(u.cmv)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">CMO</p>
                      <p className="text-xs font-bold" style={{ color: u.cmo > 30 ? "#EF4444" : "var(--fg-soft)" }}>{fmtPct(u.cmo)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">LUCRO</p>
                      <p className="text-xs font-bold" style={{ color: u.lucro30 < 0 ? "#EF4444" : "#10B981" }}>{fmtBRL(u.lucro30)}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
