"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain, Send } from "lucide-react";
import { PageHeader } from "../../../components/ui";
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
    return `Olá! Sou o **Heitor**, assistente de gestão da rede.${erp.criticos.length > 0 ? ` Atenção: ${erp.criticos.length} item(ns) em estoque crítico em ${erp.unidade}.` : ` Tudo tranquilo no estoque de ${erp.unidade}.`} Como posso ajudar?`;
  }
  return `Posso te ajudar com base nos dados reais do ERP da unidade **${erp.unidade}**: estoque, notificações, CMV/margem (Cardápio) e faturamento (Fluxo de Caixa). Pergunte algo específico desses temas.`;
}

export default function HeitorPage() {
  const router = useRouter();
  const { estoque, resumoEstoque, naoLidas, unidadeInfo } = useERP();
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0));
  const erp = { criticos, totalEstoque: estoque.length, naoLidas, unidade: unidadeInfo.nome };

  const [msgs, setMsgs] = useState([
    { role: "bot", text: "Olá! Sou o **Heitor**. Pergunte sobre estoque, notificações, CMV ou faturamento da sua unidade." },
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
    // negrito simples **x**
    return txt.split("\n").map((linha, i) => (
      <p key={i} style={{ margin: i ? "4px 0 0" : 0 }}
        dangerouslySetInnerHTML={{ __html: linha.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
    ));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader title="Heitor I.A" subtitle={`Assistente de gestão · ${unidadeInfo.nome}`} icon={Brain} />

      <div className="flex-1 px-4 pt-4 pb-40 space-y-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm"
              style={m.role === "user"
                ? { background: "var(--accent-strong)", color: "#fff", borderBottomRightRadius: 4 }
                : { background: "var(--card)", border: "1px solid var(--line)", color: "var(--fg-soft)", borderBottomLeftRadius: 4 }}>
              {render(m.text)}
            </div>
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      {/* Sugestões + input fixos */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-5 pt-2" style={{ background: "linear-gradient(transparent, var(--surface) 30%)" }}>
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {SUGESTOES.map((s) => (
            <button key={s} onClick={() => enviar(s)} className="flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full"
              style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--muted)" }}>{s}</button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()}
            placeholder="Pergunte ao Heitor..." className="erp-input" style={{ height: 46 }} />
          <button onClick={() => enviar()} className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-strong)" }}>
            <Send size={18} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}
