"use client";

// "Pergunte ao Héfisto": conversa (texto ou voz) com o Command Bus do servidor.
// Usada na Central de Inteligência e no painel lateral / bottom sheet.
// A voz só troca a ENTRADA (fala → texto) e, se ligado, lê a resposta: o
// pedido segue o mesmo caminho do teclado.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Mic, MicOff, Loader2, Volume2, VolumeX, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";
import { perguntarAoHefisto, confirmarAcao, cancelarAcao, novaChaveDeEnvio } from "../../lib/intelligence/client/api";
import { provedorDeVoz } from "../../lib/intelligence/voice/voice-provider";
import { MetricaCartao, ListaBloco, TextoBloco } from "./Blocos";
import InsightCartao from "./InsightCartao";

export const SUGESTOES_PADRAO = [
  "Como foi minha empresa hoje?",
  "Quanto vendi esta semana?",
  "Quanto comprei esta semana?",
  "Qual produto teve maior aumento de preço?",
  "Quais produtos estão próximos do vencimento?",
  "Tem alguma diferença estranha no estoque?",
  "Quais contas vencem nos próximos dias?",
  "Como está meu CMV?",
  "Como está meu CMO?",
];

let seq = 0;
const novoId = () => `m${++seq}`;

function Botao({ children, onClick, tipo = "secundario", disabled, className = "" }) {
  const estilos = {
    primario: "bg-slate-900 text-white hover:bg-slate-800",
    perigo: "bg-rose-600 text-white hover:bg-rose-700",
    secundario: "border border-slate-300 bg-white text-slate-700 hover:border-slate-500",
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`min-h-[44px] rounded-xl px-4 text-[14px] font-bold transition disabled:opacity-50 ${estilos[tipo]} ${className}`}>
      {children}
    </button>
  );
}

function RespostaLivre({ pergunta, onEnviar, desabilitado }) {
  const [valor, setValor] = useState("");
  const numerico = pergunta.campo === "quantidade";
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (valor.trim()) { onEnviar(valor.trim()); setValor(""); } }}>
      <input value={valor} onChange={(e) => setValor(e.target.value)} disabled={desabilitado}
        inputMode={numerico ? "decimal" : "text"} placeholder={numerico ? "Ex.: 2,5" : "Digite aqui"}
        className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-[15px] focus:border-slate-600 focus:outline-none" />
      <Botao tipo="primario" disabled={desabilitado || !valor.trim()}>OK</Botao>
    </form>
  );
}

function Confirmacao({ c, onConfirmar, onCancelar, ocupado }) {
  const [texto, setTexto] = useState("");
  return (
    <div className="mt-2 rounded-2xl border-2 border-slate-900 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-black text-slate-900">{c.titulo}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${c.risco === "HIGH" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
          {c.risco === "HIGH" ? "Risco alto" : "Confirmação necessária"}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5">
        {c.linhas.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-[14px]">
            <dt className="text-slate-500">{l.rotulo}</dt><dd className="text-right font-bold text-slate-900">{l.valor}</dd>
          </div>
        ))}
      </dl>
      {c.confirmacaoExplicita && (
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite CONFIRMAR"
          className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-[15px]" />
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Botao tipo="secundario" onClick={onCancelar} disabled={ocupado}>Cancelar</Botao>
        <Botao tipo="primario" onClick={() => onConfirmar(c.confirmacaoExplicita ? texto : null)} disabled={ocupado || (c.confirmacaoExplicita && texto !== "CONFIRMAR")}>
          {ocupado ? <Loader2 size={18} className="mx-auto animate-spin" /> : "Confirmar"}
        </Botao>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">Nada é gravado antes de confirmar. Expira às {new Date(c.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.{c.rollback ? ` Para desfazer: ${c.rollback}` : ""}</p>
    </div>
  );
}

function Resposta({ r, ocupado, onComando, onContinuar, onConfirmar, onCancelar }) {
  const router = useRouter();
  const tomCaixa = r.tipo === "bloqueado" || r.tipo === "erro_acao" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white";
  return (
    <div className="space-y-2">
      {r.tipo === "resultado_acao" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-[15px] font-black text-emerald-900"><CheckCircle2 size={18} /> {r.texto}</p>
          <dl className="mt-2 space-y-1">
            {r.resultado?.linhas?.map((l, i) => <div key={i} className="flex justify-between gap-3 text-[13px]"><dt className="text-emerald-800">{l.rotulo}</dt><dd className="font-bold text-emerald-950">{l.valor}</dd></div>)}
          </dl>
          {r.repetido && <p className="mt-2 text-[12px] text-emerald-800">Este registro já tinha sido feito — nada foi duplicado.</p>}
        </div>
      ) : (
        <div className={`rounded-2xl border p-3 ${tomCaixa}`}>
          <p className="flex gap-2 whitespace-pre-line text-[14px] leading-relaxed text-slate-800">
            {r.tipo === "bloqueado" && <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-700" />}
            {r.tipo === "erro_acao" && <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" />}
            <span>{r.texto}</span>
          </p>
        </div>
      )}

      {(r.blocos || []).map((b, i) => {
        if (b.tipo === "metrica") return <MetricaCartao key={i} rotulo={b.rotulo} m={b.metrica} compacto />;
        if (b.tipo === "lista") return <ListaBloco key={i} titulo={b.titulo} itens={b.itens} />;
        if (b.tipo === "texto") return <TextoBloco key={i} texto={b.texto} qualificador={b.qualificador} />;
        if (b.tipo === "insight") return <InsightCartao key={i} insight={b.insight} onComando={onComando} compacto />;
        return null;
      })}

      {r.pergunta && (
        <div className="rounded-2xl bg-slate-50 p-3">
          {r.pergunta.texto !== r.texto && <p className="text-[14px] font-semibold text-slate-800">{r.pergunta.texto}</p>}
          {r.pergunta.opcoes?.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {r.pergunta.opcoes.map((o) => (
                <Botao key={o.id} disabled={ocupado} onClick={() => (o.comando ? onComando(o.comando) : onContinuar(r.pergunta, o.id))}>{o.rotulo}</Botao>
              ))}
            </div>
          ) : r.pergunta.acaoId ? (
            <RespostaLivre pergunta={r.pergunta} desabilitado={ocupado} onEnviar={(v) => onContinuar(r.pergunta, v)} />
          ) : r.pergunta.comandoBase ? (
            <RespostaLivre pergunta={r.pergunta} desabilitado={ocupado} onEnviar={(v) => onComando(r.pergunta.comandoBase.replace("{valor}", v))} />
          ) : null}
        </div>
      )}

      {r.confirmacao && <Confirmacao c={r.confirmacao} ocupado={ocupado} onConfirmar={(t) => onConfirmar(r.confirmacao.acaoId, t)} onCancelar={() => onCancelar(r.confirmacao.acaoId)} />}

      {r.sugestoes?.length > 0 && (
        <div className="flex flex-wrap gap-2">{r.sugestoes.map((s) => <Botao key={s} onClick={() => onComando(s)} disabled={ocupado}>{s}</Botao>)}</div>
      )}

      {r.acoes?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.acoes.map((a, i) => <Botao key={i} onClick={() => (a.rota ? router.push(a.rota) : onComando(a.comando))} disabled={ocupado}>{a.rotulo}</Botao>)}
        </div>
      )}

      {(r.agentes?.length > 0 || r.fontesConsultadas?.length > 0) && (
        <p className="px-1 text-[11px] text-slate-500">
          {r.agentes?.length > 0 && <>Consultado: {r.agentes.join(", ")}. </>}
          {r.fontesConsultadas?.length > 0 && <>Fontes: {r.fontesConsultadas.join(" · ")}. </>}
          {r.interpretacao?.origem === "ia" && <>Pedido interpretado por IA. </>}
          {r.auditado === false && <>Auditoria não persistida neste servidor.</>}
        </p>
      )}
    </div>
  );
}

const ConversaHefisto = forwardRef(function ConversaHefisto({ unidadeId, tela = null, sugestoes = SUGESTOES_PADRAO, autoFoco = false, altura = "auto", onNavegar }, ref) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState([]);
  const [entrada, setEntrada] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [lerEmVoz, setLerEmVoz] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const escutaRef = useRef(null);
  // O que a última resposta citou (produto, alertas): volta no próximo pedido
  // para "Por quê?" e "Perdi 2 kg." — o servidor reconfere tudo.
  const referenciaRef = useRef(null);
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const voz = provedorDeVoz();

  useEffect(() => { setVozOk(voz.disponivel()); }, [voz]);
  useEffect(() => { referenciaRef.current = null; }, [unidadeId]);
  useEffect(() => { if (autoFoco) setTimeout(() => inputRef.current?.focus(), 80); }, [autoFoco]);
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens, ocupado]);
  useEffect(() => () => { escutaRef.current?.parar(); voz.calar(); }, [voz]);

  const adicionar = (m) => setMensagens((xs) => [...xs, { id: novoId(), ...m }]);

  const tratar = useCallback((dados, { canal } = {}) => {
    adicionar({ de: "hefisto", resposta: dados });
    if (dados?.referencia) referenciaRef.current = dados.referencia;
    if (canal === "voz" && lerEmVoz && dados?.texto) voz.falar(dados.texto);
    if (dados?.tipo === "navegacao" && dados.rota) {
      setTimeout(() => { onNavegar?.(); router.push(dados.rota); }, 350);
    }
  }, [lerEmVoz, voz, router, onNavegar]);

  const enviar = useCallback(async (texto, { canal = "texto" } = {}) => {
    const t = String(texto || "").trim();
    if (!t || ocupado) return;
    setEntrada("");
    adicionar({ de: "usuario", texto: t, canal });
    setOcupado(true);
    const r = await perguntarAoHefisto(unidadeId, { texto: t, chave: novaChaveDeEnvio(), canal, tela, conversa: referenciaRef.current });
    setOcupado(false);
    tratar(r.ok ? r.dados : { tipo: "erro_acao", texto: r.dados?.erro || "Não consegui responder agora." }, { canal });
  }, [ocupado, unidadeId, tela, tratar]);

  useImperativeHandle(ref, () => ({ enviar }), [enviar]);

  async function continuar(pergunta, valor) {
    const rotulo = pergunta.opcoes?.find((o) => o.id === valor)?.rotulo || String(valor);
    adicionar({ de: "usuario", texto: rotulo });
    setOcupado(true);
    const bruto = String(valor).trim();
    const numero = pergunta.campo === "quantidade" ? Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto) : null;
    const continuarCampo = { acaoId: pergunta.acaoId, campo: pergunta.campo, valor: numero == null ? bruto : null, valorNumero: Number.isFinite(numero) ? numero : null };
    const r = await perguntarAoHefisto(unidadeId, { continuar: continuarCampo, tela });
    setOcupado(false);
    tratar(r.ok ? r.dados : { tipo: "erro_acao", texto: r.dados?.erro || "Não consegui continuar." });
  }

  async function confirmar(acaoId, confirmacaoTexto) {
    setOcupado(true);
    const r = await confirmarAcao(unidadeId, acaoId, confirmacaoTexto);
    setOcupado(false);
    tratar(r.ok ? r.dados : { tipo: "erro_acao", texto: r.dados?.erro || "Não consegui confirmar." });
  }

  async function cancelar(acaoId) {
    setOcupado(true);
    const r = await cancelarAcao(unidadeId, acaoId);
    setOcupado(false);
    tratar(r.ok ? r.dados : { tipo: "erro_acao", texto: r.dados?.erro || "Não consegui cancelar." });
  }

  function alternarMicrofone() {
    if (ouvindo) { escutaRef.current?.parar(); setOuvindo(false); return; }
    voz.calar();
    setOuvindo(true);
    escutaRef.current = voz.ouvir({
      onParcial: (t) => setEntrada(t),
      onFinal: (t) => { setOuvindo(false); enviar(t, { canal: "voz" }); },
      onErro: (msg) => { setOuvindo(false); adicionar({ de: "hefisto", resposta: { tipo: "erro_acao", texto: msg } }); },
      onFim: () => setOuvindo(false),
    });
  }

  return (
    <div className="flex min-h-0 flex-col" style={altura === "auto" ? undefined : { height: altura }}>
      <div className={`min-h-0 flex-1 space-y-3 ${altura === "auto" ? "" : "overflow-y-auto overscroll-contain"} pb-2`}>
        {mensagens.length === 0 && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[13px] text-slate-500"><Sparkles size={15} className="text-emerald-600" /> Respostas só com dados da sua unidade, com a fonte de cada número.</p>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)} className="min-h-[40px] rounded-full border border-slate-200 bg-white px-3 text-left text-[13px] font-semibold text-slate-700 hover:border-slate-400">{s}</button>
              ))}
            </div>
          </div>
        )}
        {mensagens.map((m) => m.de === "usuario" ? (
          <div key={m.id} className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-[14px] text-white">{m.canal === "voz" && <Mic size={13} className="mr-1 inline" />}{m.texto}</p>
          </div>
        ) : (
          <Resposta key={m.id} r={m.resposta} ocupado={ocupado} onComando={(c) => enviar(c)} onContinuar={continuar} onConfirmar={confirmar} onCancelar={cancelar} />
        ))}
        {ocupado && <p className="flex items-center gap-2 text-[13px] text-slate-500"><Loader2 size={15} className="animate-spin" /> Consultando os dados…</p>}
        <div ref={fimRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enviar(entrada); }} className="sticky bottom-0 z-10 -mx-1 mt-2 flex items-end gap-2 bg-[#F7F8F7] px-1 pb-1 pt-2" style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom, 0px))" }}>
        <textarea ref={inputRef} rows={2} value={entrada} onChange={(e) => setEntrada(e.target.value)} maxLength={500}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(entrada); } }}
          placeholder={ouvindo ? "Ouvindo…" : "Pergunte qualquer coisa sobre sua empresa..."}
          aria-label="Pergunte ao Héfisto"
          className="max-h-32 min-h-[56px] min-w-0 flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] leading-snug focus:border-slate-700 focus:outline-none" />
        {vozOk && (
          <button type="button" onClick={alternarMicrofone} aria-label={ouvindo ? "Parar de ouvir" : "Falar com o Héfisto"}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${ouvindo ? "animate-pulse bg-rose-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
            {ouvindo ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}
        <button type="submit" disabled={!entrada.trim() || ocupado} aria-label="Enviar"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white disabled:opacity-40">
          <Send size={19} />
        </button>
      </form>
      {vozOk && voz.sinteseDisponivel() && (
        <button type="button" onClick={() => { setLerEmVoz((v) => !v); voz.calar(); }} className="mt-1 inline-flex min-h-[32px] items-center gap-1 self-start text-[12px] font-semibold text-slate-500">
          {lerEmVoz ? <Volume2 size={14} /> : <VolumeX size={14} />} {lerEmVoz ? "Lendo respostas de voz em voz alta" : "Ler respostas de voz em voz alta"}
        </button>
      )}
    </div>
  );
});

export default ConversaHefisto;
