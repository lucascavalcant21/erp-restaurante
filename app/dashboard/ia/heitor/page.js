"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChefHat,
  Users,
  ShoppingCart,
  BarChart2,
  Bell,
  Package,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

// ─── ERPContext (com fallback seguro) ─────────────────────────────────────────
let useERPSafe;
try {
  const ctx = require("../../../context/ERPContext");
  useERPSafe = ctx.useERP;
} catch (_) {
  useERPSafe = null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Dados base (financeiro/clientes — ainda sem Supabase, mas prontos p/ trocar) ─
const DADOS_FINANCEIROS = {
  faturamento_mes:   28450.00,
  custo_mes:         10990.00,
  mc_media:          61.3,
  cmv_geral:         38.7,
  funcionarios:      5,
  faltas_mes:        2,
  clientes_ativos:   6,
  nps_score:         67,
  estrelas_bcg:      3,
  abacaxis_bcg:      1,
  eventos_semana:    1,
  top_prato:         "Marmitex Executiva",
  top_prato_mc:      64.6,
  pior_prato:        "Sobremesa do Dia",
  pior_prato_mc:     40.0,
};

// ─── Gera insights dinâmicos com dados reais do contexto ─────────────────────
function gerarInsights(erpData) {
  const insights = [];

  // Estoque crítico — usa dado real do ERPContext
  if (erpData.estoque_criticos > 0) {
    const nomes = erpData.nomes_criticos?.slice(0, 3).join(", ") || "itens";
    insights.push({
      id: "i1", tipo: "alerta", prioridade: "alta",
      Icon: Package, cor: "text-amber-600", bg: "bg-amber-50", borda: "border-amber-200",
      titulo: `${erpData.estoque_criticos} ${erpData.estoque_criticos === 1 ? "item em" : "itens em"} estoque crítico`,
      corpo: `${nomes.charAt(0).toUpperCase() + nomes.slice(1)} estão abaixo do ponto de reposição. Risco de interrupção na produção.`,
      acao: "Ver Estoque",
      href: "/dashboard/operacao/estoque",
    });
  }

  // CMV
  if (erpData.cmv_geral >= 35) {
    insights.push({
      id: "i2", tipo: "alerta", prioridade: "alta",
      Icon: TrendingUp, cor: "text-emerald-600", bg: "bg-emerald-50", borda: "border-emerald-200",
      titulo: `CMV em ${erpData.cmv_geral}% — acima da meta`,
      corpo: `O CMV está ${(erpData.cmv_geral - 35).toFixed(1)} p.p. acima da meta de 35%. Revise o custo da ${erpData.pior_prato}.`,
      acao: "Ver CMV",
      href: "/dashboard/financeiro/cmv",
    });
  } else {
    insights.push({
      id: "i2", tipo: "positivo", prioridade: "media",
      Icon: TrendingDown, cor: "text-emerald-600", bg: "bg-emerald-50", borda: "border-emerald-200",
      titulo: `CMV em ${erpData.cmv_geral}% — dentro da meta`,
      corpo: `Excelente controle de custos. CMV abaixo da meta de 35%. Mantenha o monitoramento regular.`,
      acao: "Ver CMV",
      href: "/dashboard/financeiro/cmv",
    });
  }

  // Top prato
  insights.push({
    id: "i3", tipo: "positivo", prioridade: "media",
    Icon: ChefHat, cor: "text-blue-600", bg: "bg-blue-50", borda: "border-blue-200",
    titulo: `${erpData.top_prato} lidera com MC de ${erpData.top_prato_mc}%`,
    corpo: "Este prato combina alto volume de vendas com boa margem. Considere criar um combo que inclua ele.",
    acao: "Ver Margem",
    href: "/dashboard/financeiro/margem",
  });

  // Faltas
  if (erpData.faltas_mes > 0) {
    insights.push({
      id: "i4", tipo: "alerta", prioridade: "media",
      Icon: Users, cor: "text-accent-strong", bg: "bg-[rgba(5,150,105,0.1)]", borda: "border-[rgba(5,150,105,0.3)]",
      titulo: `${erpData.faltas_mes} falta${erpData.faltas_mes !== 1 ? "s" : ""} registrada${erpData.faltas_mes !== 1 ? "s" : ""} este mês`,
      corpo: "Verifique o espelho de ponto e acione o protocolo de comunicação com o colaborador.",
      acao: "Ver Ponto",
      href: "/dashboard/rh/ponto",
    });
  }

  // NPS
  const npsLabel = erpData.nps_score >= 75 ? "Excelente" : erpData.nps_score >= 50 ? "Muito Bom" : erpData.nps_score >= 0 ? "Bom" : "Crítico";
  insights.push({
    id: "i5", tipo: erpData.nps_score >= 50 ? "positivo" : "alerta", prioridade: "baixa",
    Icon: BarChart2, cor: "text-purple-600", bg: "bg-purple-50", borda: "border-purple-200",
    titulo: `NPS em ${erpData.nps_score} — ${npsLabel}`,
    corpo: erpData.nps_score >= 50
      ? "Ótima satisfação dos clientes. Detratores recentes reclamaram de entrega fria — vale revisar embalagem."
      : "NPS abaixo do ideal. Analise os comentários dos detratores e crie ações de melhoria.",
    acao: "Ver NPS",
    href: "/dashboard/clientes/nps",
  });

  // Notificações não lidas
  if (erpData.nao_lidas > 0) {
    insights.push({
      id: "i6", tipo: "alerta", prioridade: "alta",
      Icon: Bell, cor: "text-accent-strong", bg: "bg-[rgba(5,150,105,0.1)]", borda: "border-[rgba(5,150,105,0.3)]",
      titulo: `${erpData.nao_lidas} notificaç${erpData.nao_lidas === 1 ? "ão não lida" : "ões não lidas"}`,
      corpo: "Você tem alertas pendentes no sistema. Revise as notificações para não perder nenhuma ação importante.",
      acao: "Ver Alertas",
      href: "/dashboard/notificacoes",
    });
  }

  return insights;
}

// ─── Resposta dinâmica do chatbot ─────────────────────────────────────────────
function gerarResposta(texto, erpData) {
  const t = texto.toLowerCase();

  if (t.includes("cmv") || t.includes("custo de mercadoria")) {
    const status = erpData.cmv_geral >= 35 ? `**${(erpData.cmv_geral - 35).toFixed(1)} p.p. acima da meta**` : "dentro da meta";
    return `O CMV geral do cardápio está em **${erpData.cmv_geral}%** — ${status} de 35%. O prato mais crítico é a ${erpData.pior_prato} (CMV estimado acima de 55%). Recomendo renegociar com o fornecedor ou reformular a receita.`;
  }
  if (t.includes("margem") || t.includes("lucro")) {
    const lucro = erpData.faturamento_mes - erpData.custo_mes;
    return `A MC média do cardápio é **${erpData.mc_media}%**. O prato mais lucroso é **${erpData.top_prato}** com ${erpData.top_prato_mc}% de margem. O pior é **${erpData.pior_prato}** com ~${erpData.pior_prato_mc}% — considere remover ou reformular. Lucro bruto estimado: ${fmtBRL(lucro)}.`;
  }
  if (t.includes("estoque") || t.includes("ingrediente")) {
    if (erpData.estoque_criticos === 0) {
      return `Ótima notícia! **Nenhum item em estoque crítico** no momento. Todos os ${erpData.total_estoque} itens cadastrados estão acima do ponto de reposição.`;
    }
    const nomes = erpData.nomes_criticos?.join(", ") || "itens";
    return `Há **${erpData.estoque_criticos} ${erpData.estoque_criticos === 1 ? "item" : "itens"} em estoque crítico**: ${nomes}. Recomendo emitir pedido de compra ainda hoje para evitar paralisação na produção.`;
  }
  if (t.includes("funcionário") || t.includes("ponto") || t.includes("falta")) {
    return `Você tem **${erpData.funcionarios} funcionários ativos**. Foram registradas **${erpData.faltas_mes} falta(s)** este mês. Acesse o Controle de Ponto para ver o espelho completo e identificar padrões.`;
  }
  if (t.includes("cliente") || t.includes("crm") || t.includes("nps")) {
    const npsLabel = erpData.nps_score >= 75 ? "Excelente" : erpData.nps_score >= 50 ? "Muito Bom" : "atenção necessária";
    return `Seu NPS está em **${erpData.nps_score} pontos** — ${npsLabel}. Você tem ${erpData.clientes_ativos} clientes ativos no CRM. Use as campanhas para reativar clientes que não compram há mais de 30 dias.`;
  }
  if (t.includes("faturamento") || t.includes("receita") || t.includes("dre")) {
    const lucro = erpData.faturamento_mes - erpData.custo_mes;
    return `Faturamento do mês: **${fmtBRL(erpData.faturamento_mes)}**. Custo total: ${fmtBRL(erpData.custo_mes)}. Lucro bruto: **${fmtBRL(lucro)}** (MC ${erpData.mc_media}%). Para o DRE completo com todas as despesas, acesse o módulo financeiro.`;
  }
  if (t.includes("campanha") || t.includes("marketing") || t.includes("promoção")) {
    return `Use o módulo de Campanhas para criar ações direcionadas. Recomendo segmentar clientes VIP (gasto > R$500) com desconto exclusivo, e reativar inativos (sem compra há 60+ dias) com uma oferta de retorno.`;
  }
  if (t.includes("evento")) {
    return `Há **${erpData.eventos_semana} evento confirmado esta semana**. Verifique o módulo de Gestão de Eventos para confirmar o ponto de equilíbrio e se o custo estimado está dentro do orçamento.`;
  }
  if (t.includes("notificaç") || t.includes("alerta")) {
    return erpData.nao_lidas > 0
      ? `Você tem **${erpData.nao_lidas} notificaç${erpData.nao_lidas === 1 ? "ão" : "ões"} não lida${erpData.nao_lidas === 1 ? "" : "s"}**. ${erpData.estoque_criticos > 0 ? `${erpData.estoque_criticos} ${erpData.estoque_criticos === 1 ? "é sobre" : "são sobre"} estoque crítico.` : ""} Acesse as notificações para revisar tudo.`
      : `Ótimo! Você está em dia — **nenhuma notificação não lida**. O sistema está operando normalmente.`;
  }
  if (t.includes("melhoria") || t.includes("recomend") || t.includes("o que fazer") || t.includes("prioridade")) {
    const p1 = erpData.estoque_criticos > 0 ? `🔴 Repor estoque crítico (${erpData.nomes_criticos?.slice(0, 2).join(", ") || "itens críticos"}) — risco imediato` : `🟢 Estoque normalizado — manter monitoramento diário`;
    const p2 = erpData.cmv_geral >= 35 ? `🟡 Reduzir CMV (${erpData.cmv_geral}%) — revisar custo da ${erpData.pior_prato}` : `🟢 CMV dentro da meta — foco em volume de vendas`;
    const p3 = erpData.faltas_mes > 0 ? `🟡 Acompanhar ${erpData.faltas_mes} falta(s) registrada(s) — verificar justificativas` : `🟢 Equipe sem faltas este mês`;
    return `Minhas **3 prioridades** para hoje:\n1. ${p1}\n2. ${p2}\n3. ${p3}`;
  }
  if (t.includes("oi") || t.includes("olá") || t.includes("bom dia") || t.includes("boa tarde") || t.includes("tudo bem")) {
    return `Olá! Sou o **Heitor**, o assistente de gestão do seu ERP.${erpData.estoque_criticos > 0 ? ` Atenção: há **${erpData.estoque_criticos} item(ns) em estoque crítico** no momento.` : " Tudo parece bem no estoque."} O que quer saber?`;
  }

  return `Entendi sua pergunta sobre "${texto}". Com base nos dados do ERP, posso analisar: **CMV**, **margem de lucro**, **estoque** (${erpData.total_estoque} itens cadastrados), **funcionários**, **clientes/NPS**, **faturamento** e **campanhas**. Tente perguntar algo específico sobre um desses temas.`;
}

// ─── Sugestões rápidas ────────────────────────────────────────────────────────
const SUGESTOES = [
  "Quais são as prioridades de hoje?",
  "Como está o CMV do cardápio?",
  "Tem algum estoque crítico?",
  "Como está o NPS dos clientes?",
  "Qual prato tem mais margem?",
  "Resumo do faturamento do mês",
];

// ─── Bolha de mensagem ────────────────────────────────────────────────────────
function Bolha({ msg }) {
  const isUser = msg.role === "user";
  const renderTexto = (txt) => {
    const parts = txt.split(/\*\*(.+?)\*\*/g);
    return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);
  };
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-xl bg-accent-strong flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
          <Sparkles size={13} className="text-white" />
        </div>
      )}
      <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed font-medium whitespace-pre-line
        ${isUser
          ? "bg-accent-strong text-white rounded-tr-sm"
          : "bg-card border border-white/5  text-fg rounded-tl-sm"
        }`}>
        {renderTexto(msg.texto)}
      </div>
    </div>
  );
}

// ─── Card de insight ──────────────────────────────────────────────────────────
function CardInsight({ insight }) {
  const router = useRouter();
  const Icon = insight.Icon;
  return (
    <div className={`rounded-2xl border p-3.5 ${insight.bg} ${insight.borda}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-card/70 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className={insight.cor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black text-fg leading-snug mb-0.5">{insight.titulo}</p>
          <p className="text-[11px] font-medium text-muted leading-snug">{insight.corpo}</p>
        </div>
      </div>
      <button
        onClick={() => router.push(insight.href)}
        className="mt-2.5 w-full flex items-center justify-center gap-1 text-[11px] font-black text-fg-soft bg-card/80 border border-white rounded-xl py-2 active:scale-95 transition-transform">
        {insight.acao} <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function HeitorPage() {
  const router = useRouter();
  const [aba,        setAba]        = useState("insights");
  const [mensagens,  setMensagens]  = useState([
    { id: 0, role: "heitor", texto: `Olá! Sou o **Heitor**, seu assistente de gestão. Analisei os dados do ERP e preparei alguns insights. Pode me perguntar qualquer coisa sobre operação, financeiro ou equipe.` },
  ]);
  const [input,      setInput]      = useState("");
  const [carregando, setCarregando] = useState(false);
  const fimRef   = useRef(null);
  const inputRef = useRef(null);

  // ── Dados do ERPContext (com fallback seguro) ─────────────────────────────
  let estoqueCtx = { estoque: [], resumoEstoque: { criticos: 0, total: 0, valor: 0 }, naoLidas: 0 };
  try {
    if (useERPSafe) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const erp = useERPSafe();
      estoqueCtx = erp;
    }
  } catch (_) {}

  const { estoque = [], resumoEstoque = {}, naoLidas = 0 } = estoqueCtx;

  // Monta erpData combinando dados reais (estoque) + dados financeiros (fallback)
  const erpData = useMemo(() => {
    const criticos = estoque.filter(i => i.quantidade <= i.minimo);
    return {
      ...DADOS_FINANCEIROS,
      estoque_criticos: resumoEstoque.criticos ?? criticos.length,
      total_estoque:    resumoEstoque.total    ?? estoque.length,
      nomes_criticos:   criticos.map(i => i.nome),
      nao_lidas:        naoLidas,
    };
  }, [estoque, resumoEstoque, naoLidas]);

  const insights = useMemo(() => gerarInsights(erpData), [erpData]);
  const lucro    = erpData.faturamento_mes - erpData.custo_mes;

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  function enviar(texto) {
    const msg = texto || input.trim();
    if (!msg) return;
    setInput("");
    setAba("chat");
    const novaMsgs = [...mensagens, { id: Date.now(), role: "user", texto: msg }];
    setMensagens(novaMsgs);
    setCarregando(true);
    setTimeout(() => {
      const resposta = gerarResposta(msg, erpData);
      setMensagens(prev => [...prev, { id: Date.now() + 1, role: "heitor", texto: resposta }]);
      setCarregando(false);
    }, 600 + Math.random() * 600);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  }

  return (
    <div className="min-h-screen  flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3 flex-shrink-0" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-muted" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-accent-strong flex items-center justify-center">
                <Sparkles size={12} className="text-white" />
              </div>
              <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Heitor IA</h1>
              <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">ONLINE</span>
              {erpData.estoque_criticos > 0 && (
                <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  {erpData.estoque_criticos} CRÍTICO{erpData.estoque_criticos > 1 ? "S" : ""}
                </span>
              )}
            </div>
            <p className="text-[11px] text-dim font-medium">Assistente inteligente de gestão</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mt-3">
          {[["insights", `💡 Insights (${insights.length})`], ["chat", "💬 Chat"]].map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 ${aba === id ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA INSIGHTS ── */}
      {aba === "insights" && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-4">

          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">Faturamento</p>
              <p className="text-base font-black text-emerald-800">{fmtBRL(erpData.faturamento_mes)}</p>
              <p className="text-[10px] font-bold text-emerald-600">este mês</p>
            </div>
            <div className="bg-card border border-white/5 rounded-2xl  p-3">
              <p className="text-[9px] font-black text-dim uppercase tracking-wider mb-0.5">Lucro Bruto</p>
              <p className="text-base font-black text-fg">{fmtBRL(lucro)}</p>
              <p className="text-[10px] font-bold text-dim">MC {erpData.mc_media}%</p>
            </div>
            <div className={`rounded-2xl border p-3 ${erpData.cmv_geral >= 35 ? "bg-amber-50 border-amber-200" : "bg-card border-white/5"}`}>
              <p className="text-[9px] font-black text-dim uppercase tracking-wider mb-0.5">CMV Geral</p>
              <p className={`text-base font-black ${erpData.cmv_geral >= 35 ? "text-amber-800" : "text-fg"}`}>{erpData.cmv_geral}%</p>
              <p className="text-[10px] font-bold text-dim">meta: abaixo de 35%</p>
            </div>
            <div className={`rounded-2xl border p-3 ${erpData.estoque_criticos > 0 ? "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" : "bg-card border-white/5 "}`}>
              <p className="text-[9px] font-black text-dim uppercase tracking-wider mb-0.5">Estoque Crítico</p>
              <p className={`text-base font-black ${erpData.estoque_criticos > 0 ? "text-accent-strong" : "text-emerald-700"}`}>
                {erpData.estoque_criticos > 0 ? `${erpData.estoque_criticos} item${erpData.estoque_criticos > 1 ? "s" : ""}` : "OK"}
              </p>
              <p className="text-[10px] font-bold text-dim">{erpData.total_estoque} itens total</p>
            </div>
          </div>

          {/* Insights dinâmicos */}
          <div>
            <p className="text-[10px] font-black text-dim uppercase tracking-wider px-1 mb-2">
              {insights.length} insights identificados
            </p>
            <div className="space-y-3">
              {insights.map(ins => <CardInsight key={ins.id} insight={ins} />)}
            </div>
          </div>

          {/* CTA para chat */}
          <button onClick={() => { setAba("chat"); inputRef.current?.focus(); }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent-strong text-white font-black text-sm active:scale-95 transition-transform">
            <Sparkles size={15} />
            Perguntar ao Heitor
          </button>
        </div>
      )}

      {/* ── ABA CHAT ── */}
      {aba === "chat" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">

            {/* Sugestões (só se poucas mensagens) */}
            {mensagens.length <= 1 && (
              <div className="mb-4">
                <p className="text-[10px] font-black text-dim uppercase tracking-wider mb-2">Sugestões</p>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s, i) => (
                    <button key={i} onClick={() => enviar(s)}
                      className="text-[11px] font-black bg-card border border-white/8 text-fg-soft px-3 py-1.5 rounded-full active:scale-95 transition-transform">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map(m => <Bolha key={m.id} msg={m} />)}

            {carregando && (
              <div className="flex justify-start mb-3">
                <div className="w-7 h-7 rounded-xl bg-accent-strong flex items-center justify-center flex-shrink-0 mr-2">
                  <Sparkles size={13} className="text-white" />
                </div>
                <div className="bg-card border border-white/5  px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 pb-8 pt-2  border-t border-white/8">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pergunte sobre o negócio..."
                className="flex-1 bg-card border border-white/8 rounded-xl px-4 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent "
              />
              <button
                onClick={() => enviar()}
                disabled={!input.trim() || carregando}
                className="w-11 h-11 rounded-xl bg-accent-strong flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform disabled:opacity-40">
                <Send size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
