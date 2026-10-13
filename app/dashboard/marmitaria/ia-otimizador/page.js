"use client";

import { useState } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Boxes,
  Users,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";

const PERGUNTAS_RAPIDAS = [
  "Se eu vender 150 marmitas por dia em vez de 100, quanto meu lucro mensal aumenta?",
  "Qual canal me dá mais lucro: iFood com 15% de comissão ou WhatsApp com motoboy próprio?",
  "Onde está o maior desvio entre custo da ficha e custo real esta semana?",
  "Quantos quilos de frango e arroz preciso comprar para produzir 500 marmitas executivas?",
];

const RESPOSTAS_BASE = {
  "150": {
    titulo: "Simulação de Escala: 100 -> 150 marmitas/dia",
    explicacao: "Com o aumento de 50 marmitas/dia (+1.300 marmitas/mês considerando 26 dias):",
    pontos: [
      "Faturamento adicional bruto: +R$ 34.450,00 (ticket médio R$ 26,50).",
      "Custos adicionais de insumos e embalagens (CMV ~33,4%): +R$ 11.506,30.",
      "Comissões de canais e taxas de cartão (~11,8%): +R$ 4.065,10.",
      "Mão de obra adicional: exige convocação de 1 auxiliar de montagem (+R$ 2.430,00 com encargos).",
      "Impacto líquido no lucro operacional: aumento de +R$ 16.448,60 no mês.",
    ],
    conclusao: "A operação apresenta excelente alavancagem operacional porque os custos fixos da cozinha (aluguel, gás e energia) já estão cobertos.",
  },
  "canal": {
    titulo: "Comparativo de Rentabilidade: iFood vs WhatsApp com Entrega Própria",
    explicacao: "Análise de margem unitária para uma marmita de R$ 26,00 (custo técnico de R$ 8,85):",
    pontos: [
      "No iFood: Preço R$ 26,00 (-) Comissão 15% (R$ 3,90) (-) Taxa cartão 2,5% (R$ 0,65) (-) CMV R$ 8,85 = Margem de Contribuição de R$ 12,60 (48,4%).",
      "No WhatsApp: Preço R$ 26,00 (-) Taxa PIX/cartão 1,5% (R$ 0,39) (-) Subsídio motoboy R$ 3,00 (-) CMV R$ 8,85 = Margem de Contribuição de R$ 13,76 (52,9%).",
      "Diferença líquida: O canal próprio entrega R$ 1,16 a mais de margem por marmita vendida (+4,5% de rentabilidade).",
    ],
    conclusao: "Recomendação: Usar o iFood para atrair clientes novos (aquisição) e incentivar recompra via WhatsApp com programa de fidelidade ou assinaturas.",
  },
  "desvio": {
    titulo: "Diagnóstico de Desperdício e Desvios de Ficha Técnica",
    explicacao: "Cruzamento entre fichas técnicas teóricas e baixas reais de estoque:",
    pontos: [
      "Proteínas (Peito de frango): Consumo real 4,2% acima do padrão das fichas técnicas (impacto de R$ 310,00/mês). Causa provável: falta de aferição na balança da praça de montagem.",
      "Embalagens (Tampas e potes): Quebra de 2,1% no fechamento manual das tampas térmicas.",
      "Arroz e Feijão: Rendimento dentro da meta prevista (fator de cocção 2.4x).",
    ],
    conclusao: "Ação imediata: Calibrar a balança digital da bancada de montagem para travar a porção em 120g exatos de frango cozido.",
  },
  "comprar": {
    titulo: "Explosão de Insumos para 500 Marmitas Executivas",
    explicacao: "Cálculo baseado nas gramaturas líquidas das fichas e fatores de correção de cocção:",
    pontos: [
      "Peito de frango in natura: 85,0 kg (considera perda de limpeza e cocção de 28% para render 60 kg cozido / 120g por marmita).",
      "Arroz cru: 32,0 kg (rende 75 kg cozido / 150g por marmita).",
      "Feijão cru: 18,0 kg (rende 50 kg cozido / 100g por marmita).",
      "Embalagens: 500 potes c/ divisória + 500 tampas + 500 lacres + 500 sacolas kraft delivery.",
    ],
    conclusao: "Custo total previsto de insumos e embalagens: R$ 4.425,00 (R$ 8,85 por marmita).",
  },
};

export default function MarmitariaIaOtimizadorPage() {
  const [pergunta, setPergunta] = useState("");
  const [conversa, setConversa] = useState([
    {
      tipo: "ia",
      texto: "Olá! Sou o Copiloto de Inteligência Operacional da Marmitaria & Delivery. Posso responder dúvidas sobre seus custos reais, simular cenários de lucro, calcular listas de insumos e comparar a rentabilidade de canais. Como posso te ajudar hoje?",
    },
  ]);
  const [pensando, setPensando] = useState(false);

  const enviarPergunta = (textoPergunta) => {
    const q = textoPergunta || pergunta;
    if (!q.trim()) return;

    const novaConversa = [...conversa, { tipo: "user", texto: q }];
    setConversa(novaConversa);
    setPergunta("");
    setPensando(true);

    setTimeout(() => {
      let resposta = null;
      const lower = q.toLowerCase();

      if (lower.includes("150") || lower.includes("escala") || lower.includes("aumentar")) {
        resposta = RESPOSTAS_BASE["150"];
      } else if (lower.includes("canal") || lower.includes("ifood") || lower.includes("whatsapp")) {
        resposta = RESPOSTAS_BASE["canal"];
      } else if (lower.includes("desvio") || lower.includes("desperdício") || lower.includes("perda")) {
        resposta = RESPOSTAS_BASE["desvio"];
      } else if (lower.includes("frango") || lower.includes("arroz") || lower.includes("comprar") || lower.includes("500")) {
        resposta = RESPOSTAS_BASE["comprar"];
      } else {
        resposta = {
          titulo: "Análise Determinística dos Dados da Marmitaria",
          explicacao: `Avaliando sua pergunta com base nas fichas técnicas, contratos de canais e estoque da Marmitaria:`,
          pontos: [
            "Ticket médio atual da operação: R$ 26,50 por marmita.",
            "CMV Técnico Médio: R$ 8,85 (33,4% do faturamento bruto).",
            "Capacidade diária atual da cozinha: 150 marmitas/dia no turno de 6h.",
            "Ponto de equilíbrio operacional: 42 marmitas/dia cobrem todos os custos fixos e rateios.",
          ],
          conclusao: "Qualquer volume vendido acima de 42 marmitas diárias gera lucro limpo com margem de contribuição superior a 48%.",
        };
      }

      setConversa([...novaConversa, { tipo: "ia", resposta }]);
      setPensando(false);
    }, 700);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Sparkles size={16} />
            Inteligência Artificial Operacional
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Copiloto & Otimizador de Lucro da Marmitaria
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Simulações financeiras, identificação de gargalos e consultoria determinística baseada nos dados reais do seu restaurante.
          </p>
        </div>
      </div>

      {/* Regra de Governança Estrita */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
        <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Diretriz de Segurança e Governança:</span> A IA atua exclusivamente em modo consultivo e analítico. Ela explica com transparência a lógica dos números e <strong>nunca efetua compras de estoque, alterações de preços públicos ou contratações de funcionários automaticamente</strong> sem sua expressa aprovação.
        </div>
      </div>

      {/* Chat Interativo */}
      <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm flex flex-col h-[560px] overflow-hidden">
        {/* Histórico da Conversa */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {conversa.map((item, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-3xl ${item.tipo === "user" ? "ml-auto flex-row-reverse" : ""}`}
            >
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                  item.tipo === "user" ? "bg-slate-900" : "bg-emerald-600"
                }`}
              >
                {item.tipo === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div
                className={`p-4 rounded-2xl text-xs space-y-2 ${
                  item.tipo === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 border border-slate-200 text-slate-800"
                }`}
              >
                {item.texto && <p className="leading-relaxed">{item.texto}</p>}

                {item.resposta && (
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm text-emerald-800 flex items-center gap-1.5">
                      <Sparkles size={16} className="text-emerald-600" />
                      {item.resposta.titulo}
                    </h3>
                    <p className="font-medium text-slate-700">{item.resposta.explicacao}</p>
                    <ul className="space-y-1.5 pl-3 border-l-2 border-emerald-500 text-slate-700 font-medium">
                      {item.resposta.pontos.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                    <div className="p-3 rounded-xl bg-white border border-slate-200 font-bold text-emerald-900 text-[11px]">
                      💡 {item.resposta.conclusao}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {pensando && (
            <div className="flex gap-3 items-center text-xs text-slate-500 animate-pulse">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 flex items-center justify-center text-white">
                <Bot size={16} />
              </div>
              <span>Processando simulação e consultando banco de dados...</span>
            </div>
          )}
        </div>

        {/* Sugestões de Perguntas Rápidas */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-hf-border flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">Sugestões:</span>
          {PERGUNTAS_RAPIDAS.map((pr, idx) => (
            <button
              key={idx}
              onClick={() => enviarPergunta(pr)}
              className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold whitespace-nowrap hover:border-emerald-500 hover:text-emerald-700 transition-colors shadow-2xs"
            >
              {pr}
            </button>
          ))}
        </div>

        {/* Input de Envio */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviarPergunta();
          }}
          className="p-4 border-t border-hf-border bg-white flex items-center gap-3"
        >
          <input
            type="text"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Pergunte sobre compras, custos, capacidade ou simule um cenário de lucro..."
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!pergunta.trim()}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition-all shadow-sm disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
