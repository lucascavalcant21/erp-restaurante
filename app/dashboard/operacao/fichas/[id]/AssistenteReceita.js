"use client";

// ASSISTENTE DA RECEITA — painel de perguntas sobre a ficha aberta.
//
// A frase passa primeiro pelo interpretador local (regex, instantâneo e de
// graça). Só o que ele não reconhece vai para a IA, e mesmo aí a IA apenas
// classifica: a conta é sempre feita aqui, com ficha-calculos.mjs.
//
// Nada é gravado sem o usuário mandar: quando a resposta traz uma proposta
// (ex.: novo preço de venda), ela aparece como botão para aplicar.

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send, Sparkles, X } from "lucide-react";
import { interpretar, executar, EXEMPLOS } from "../../../../lib/ficha-assistente.mjs";
import { criarEscuta, vozDisponivel } from "../../../../lib/hefisto-voz";

export default function AssistenteReceita({ ficha, todasFichas, custos, onAplicar, onFechar }) {
  const [conversa, setConversa] = useState([]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const escutaRef = useRef(null);
  const fimRef = useRef(null);
  const temVoz = typeof window !== "undefined" && vozDisponivel();

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversa, pensando]);
  useEffect(() => () => { try { escutaRef.current?.parar(); } catch {} }, []);

  const responder = async (texto) => {
    const pergunta = String(texto || "").trim();
    if (!pergunta || pensando) return;

    setConversa(c => [...c, { de: "usuario", texto: pergunta }]);
    setEntrada("");
    setPensando(true);

    const contexto = { ficha, todasFichas, custos };

    // 1) Interpretador local — cobre as frases do dia a dia sem gastar chamada.
    let intencao = interpretar(pergunta);
    let veioDaIA = false;

    // 2) Só o que ele não reconheceu vai para a IA, que apenas classifica.
    if (!intencao) {
      try {
        const r = await fetch("/api/ia-ficha-assistente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: pergunta,
            ingredientes: (ficha.fichas_ingredientes || [])
              .map(fi => fi.insumos?.nome).filter(Boolean),
          }),
        });
        const dados = await r.json();
        if (!r.ok) throw new Error(dados.error || "Falha ao interpretar.");
        if (dados.intencao && dados.intencao.tipo !== "desconhecido") {
          intencao = dados.intencao;
          veioDaIA = true;
        }
      } catch (e) {
        setConversa(c => [...c, { de: "assistente", texto: e.message || "Não consegui interpretar agora." }]);
        setPensando(false);
        return;
      }
    }

    if (!intencao) {
      setConversa(c => [...c, {
        de: "assistente",
        texto: "Não entendi. Tente algo como: “quanto custa essa receita”, “simule CMV de 30%” ou “se a carne subir para R$ 50/kg”.",
      }]);
      setPensando(false);
      return;
    }

    // 3) A conta é sempre local.
    const resultado = executar(intencao, contexto);
    setConversa(c => [...c, { de: "assistente", ...resultado, veioDaIA }]);
    setPensando(false);
  };

  const alternarVoz = () => {
    if (ouvindo) { try { escutaRef.current?.parar(); } catch {} setOuvindo(false); return; }
    escutaRef.current = criarEscuta({
      onParcial: (t) => setEntrada(t),
      onFinal: (t) => { setOuvindo(false); responder(t); },
      onErro: () => setOuvindo(false),
      onFim: () => setOuvindo(false),
    });
    // criarEscuta devolve null quando o navegador não tem reconhecimento de voz.
    if (!escutaRef.current) { setOuvindo(false); return; }
    try { escutaRef.current.iniciar(); setOuvindo(true); } catch { setOuvindo(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onFechar}>
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white sm:h-[75vh] sm:rounded-3xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-slate-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">Assistente da receita</h2>
              <p className="text-[11px] text-slate-500">{ficha.nome_receita}</p>
            </div>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {conversa.length === 0 ? (
            <div>
              <p className="text-sm text-slate-500">Pergunte sobre esta receita. Por exemplo:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXEMPLOS.map(ex => (
                  <button key={ex} onClick={() => responder(ex)}
                    className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50">
                    {ex}
                  </button>
                ))}
              </div>
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                As contas são feitas pelo sistema, com as mesmas fórmulas da ficha.
                A IA entra só para entender frases fora do comum — ela não calcula custo.
              </p>
            </div>
          ) : null}

          {conversa.map((msg, i) => (
            <div key={i} className={msg.de === "usuario" ? "flex justify-end" : ""}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                msg.de === "usuario"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700"}`}>
                <Markdown texto={msg.texto} />
                {msg.nota ? <p className="mt-1.5 text-[11px] italic text-slate-400">{msg.nota}</p> : null}

                {msg.proposta ? (
                  <button
                    onClick={() => { onAplicar?.(msg.proposta); onFechar?.(); }}
                    className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                    {msg.proposta.rotulo}
                  </button>
                ) : null}

                {msg.veioDaIA ? (
                  <p className="mt-1.5 text-[10px] text-slate-300">interpretado pela IA · conta feita pelo sistema</p>
                ) : null}
              </div>
            </div>
          ))}

          {pensando ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={15} className="animate-spin" /> Calculando…
            </div>
          ) : null}
          <div ref={fimRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); responder(entrada); }}
          className="flex items-center gap-2 border-t border-slate-100 p-3">
          {temVoz ? (
            <button type="button" onClick={alternarVoz} title={ouvindo ? "Parar de ouvir" : "Falar"}
              className={`rounded-xl p-2.5 ${ouvindo ? "bg-rose-500 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {ouvindo ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          ) : null}
          <input
            value={entrada}
            onChange={e => setEntrada(e.target.value)}
            placeholder={ouvindo ? "Ouvindo…" : "Pergunte sobre esta receita"}
            className="erp-input flex-1"
          />
          <button type="submit" disabled={pensando || !entrada.trim()}
            className="rounded-xl bg-slate-900 p-2.5 text-white disabled:opacity-40">
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}

// Negrito com **…** e quebras de linha. O assistente não gera HTML, então não
// há o que sanear além disto.
function Markdown({ texto }) {
  const linhas = String(texto || "").split("\n");
  return (
    <>
      {linhas.map((linha, i) => (
        <p key={i} className={i ? "mt-1" : ""}>
          {linha.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith("**") && parte.endsWith("**")
              ? <b key={j}>{parte.slice(2, -2)}</b>
              : <span key={j}>{parte}</span>
          )}
        </p>
      ))}
    </>
  );
}
