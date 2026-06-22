"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain, Send, Cpu, Sparkles } from "lucide-react";
import { useERP } from "../../../context/ERPContext";

function fmtBRL(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const SUGESTOES = [
  "Tem algum estoque crítico?",
  "Quais são as prioridades de hoje?",
  "Tenho notificações pendentes?",
  "Como está o estoque?",
];

// Resposta dirigida por dados REAIS do ERP (sem números inventados)
function gerarResposta(texto, erp) {
  const t = texto.toLowerCase();
  const criticosNomes = erp.criticos.map((i) => i.nome);

  if (t.includes("estoque") || t.includes("ingrediente") || t.includes("crític")) {
    if (erp.totalEstoque === 0) return `Ainda não há itens cadastrados no estoque de **${erp.unidade}**. Cadastre em Operação → Estoque para eu acompanhar os níveis.`;
    if (erp.criticos.length === 0) return `Tudo certo no estoque de **${erp.unidade}**: nenhum dos ${erp.totalEstoque} itens está abaixo do mínimo. 👍`;
    return `Atenção: **${erp.criticos.length} item(ns) em estoque crítico** em ${erp.unidade} — ${criticosNomes.slice(0, 4).join(", ")}. Recomendo emitir pedido de compra hoje para não parar a produção.`;
  }
  if (t.includes("notificaç") || t.includes("alerta") || t.includes("pendente")) {
    return erp.naoLidas > 0
      ? `Você tem **${erp.naoLidas} notificação(ões) não lida(s)**. Veja em Notificações.`
      : `Você está em dia — nenhuma notificação não lida. ✅`;
  }
  if (t.includes("cmv") || t.includes("margem") || t.includes("lucro")) {
    return `O CMV e a margem são calculados a partir dos preços e custos do **Cardápio** desta unidade. Cadastre/atualize os pratos e veja os números em Financeiro → CMV e Lucro.`;
  }
  if (t.includes("faturamento") || t.includes("receita") || t.includes("dre") || t.includes("caixa")) {
    return `O faturamento vem dos lançamentos do **Fluxo de Caixa** (e do PDV, quando integrado). Registre entradas/saídas e o DRE é gerado automaticamente.`;
  }
  if (t.includes("prioridade") || t.includes("o que fazer") || t.includes("recomend") || t.includes("hoje")) {
    const linhas = [];
    linhas.push(erp.criticos.length > 0
      ? `🔴 Repor estoque crítico (${criticosNomes.slice(0, 2).join(", ")})`
      : `🟢 Estoque sob controle`);
    linhas.push(erp.naoLidas > 0 ? `🟡 Revisar ${erp.naoLidas} notificação(ões)` : `🟢 Sem notificações pendentes`);
    linhas.push(`🔵 Manter cardápio e fichas atualizados para CMV correto`);
    return `Prioridades para **${erp.unidade}** hoje:\n${linhas.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
  }
  if (t.includes("oi") || t.includes("olá") || t.includes("bom dia") || t.includes("boa")) {
    return `Olá! Sou a **Hefisto AI**, inteligência baseada nos dados da rede.${erp.criticos.length > 0 ? ` Atenção: ${erp.criticos.length} item(ns) em estoque crítico em ${erp.unidade}.` : ` Tudo tranquilo no estoque de ${erp.unidade}.`} Como posso ajudar?`;
  }
  return `Posso te ajudar com base nos dados reais do ERP da unidade **${erp.unidade}**: estoque, notificações, CMV/margem (Cardápio) e faturamento (Fluxo de Caixa). Pergunte algo específico desses temas.`;
}

export default function HeitorPage() {
  const router = useRouter();
  const { estoque, resumoEstoque, naoLidas, unidadeInfo } = useERP();
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0));
  const erp = { criticos, totalEstoque: estoque.length, naoLidas, unidade: unidadeInfo.nome };

  const [msgs, setMsgs] = useState([
    { role: "bot", text: "Saudações. Sou a **Hefisto AI**. Estou conectada ao banco de dados do restaurante. Pergunte-me sobre seu estoque, notificações, CMV ou faturamento em tempo real." },
  ]);
  const [input, setInput] = useState("");
  const fimRef = useRef(null);
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  function enviar(texto) {
    const t = (texto ?? input).trim();
    if (!t) return;
    const resposta = gerarResposta(t, erp);
    setMsgs((m) => [...m, { role: "user", text: t }, { role: "bot", text: resposta }]);
    setInput("");
  }

  function render(txt) {
    return txt.split("\n").map((linha, i) => (
      <p key={i} style={{ margin: i ? "8px 0 0" : 0 }}
        dangerouslySetInnerHTML={{ __html: linha.replace(/\*\*(.+?)\*\*/g, '<b class="font-black">$1</b>') }} />
    ));
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* HEADER COCKPIT IA PREMIUM */}
      <div className="px-4 py-6 bg-slate-900 sticky top-0 z-30 shadow-2xl shadow-slate-900/20 border-b border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Brain size={24} color="#fff" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Hefisto AI</h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border border-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                <Cpu size={12}/> Analisando dados da unidade <span className="text-white font-bold">{unidadeInfo.nome}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DO CHAT */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 pt-8 pb-40 space-y-6 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "bot" && (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                <Brain size={14} className="text-purple-400" />
              </div>
            )}
            
            <div className={`max-w-[85%] md:max-w-[75%] px-5 py-4 text-sm shadow-sm ${
                m.role === "user"
                  ? "bg-slate-800 text-white rounded-2xl rounded-tr-sm"
                  : "bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-sm"
              }`}
            >
              {render(m.text)}
            </div>
            
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 ml-3 mt-1">
                <span className="text-[10px] font-black text-slate-500">VC</span>
              </div>
            )}
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      {/* ÁREA DE INPUT (FIXA NO RODAPÉ) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto px-4 pb-6 pt-3">
          
          {/* Sugestões Rápidas */}
          <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar">
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => enviar(s)} 
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors"
              >
                <Sparkles size={12}/> {s}
              </button>
            ))}
          </div>
          
          {/* Caixa de Texto Premium */}
          <div className="flex items-end gap-3 bg-slate-50 p-2 border border-slate-200 rounded-3xl focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all">
            <textarea 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => {
                if(e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Pergunte ao seu ERP..." 
              className="w-full bg-transparent border-none focus:ring-0 resize-none px-4 py-3 text-sm text-slate-800 placeholder-slate-400 max-h-32 min-h-[48px]" 
              rows={1}
            />
            <button 
              onClick={() => enviar()} 
              className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md transition-colors"
            >
              <Send size={18} color="#fff" className="ml-1" />
            </button>
          </div>
          <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3">
            Hefisto AI processa os dados em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
