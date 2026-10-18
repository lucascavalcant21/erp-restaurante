"use client";

// Conversa com o cliente. Respostas prontas a partir do cardápio montado —
// o que o dono marcou e o que está na ficha técnica (responderConversa).
// Não há modelo de linguagem aqui: nada é inventado, e quando falta a
// informação a resposta diz isso e oferece outro caminho.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, SendHorizontal } from "lucide-react";
import { entenderMensagem, responderConversa, aberturaDaConversa, formatarPreco, primeiroNome } from "../../lib/cardapio-digital.mjs";
import { Foto, travar, soltar } from "./partes";
import s from "./cardapio.module.css";

const ESPERA_MS = 380;

export default function Conversa({ cardapio, nome, mensagens, setMensagens, onFechar, onAbrirPrato, onAdicionar, onIrParaSecao, podePedir, consultaInicial = "" }) {
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const fim = useRef(null);
  const caixa = useRef(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  const atendente = cardapio.conversa.nome_atendente || cardapio.unidade.nome || "A casa";

  useEffect(() => {
    if (!mensagens.length) setMensagens([{ de: "casa", ...aberturaDaConversa(cardapio, { nome }) }]);
    const tecla = (e) => { if (e.key === "Escape") fechar.current?.(); };
    document.addEventListener("keydown", tecla);
    travar();
    caixa.current?.focus({ preventScroll: true });
    return () => { document.removeEventListener("keydown", tecla); soltar(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (consultaInicial) perguntar(consultaInicial, { tipo: "texto" }); }, [consultaInicial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens, digitando]);

  function responder(pedido) {
    setDigitando(true);
    setTimeout(() => {
      setDigitando(false);
      setMensagens((m) => [...m, { de: "casa", ...responderConversa(pedido, cardapio, { nome }) }]);
    }, ESPERA_MS);
  }

  function perguntar(conteudo, { tipo, id } = {}) {
    const t = String(conteudo || "").trim();
    if (!t) return;
    setMensagens((m) => [...m, { de: "cliente", texto: t }]);
    responder(tipo === "intencao" ? { tipo: "intencao", id } : entenderMensagem(t, cardapio));
  }

  function acao(a) {
    if (a.tipo === "categoria") { onIrParaSecao(a.id); fechar.current?.(); return; }
    perguntar(a.rotulo, { tipo: "intencao", id: a.id });
  }

  return (
    <div className={s.conversa} role="dialog" aria-modal="true" aria-label={`Conversa com ${atendente}`} ref={caixa} tabIndex={-1}>
      <div className={s.conversaCabeca}>
        <button type="button" className={s.fechar} onClick={() => fechar.current?.()} aria-label="Voltar ao cardápio"><ArrowLeft size={20} aria-hidden="true" /></button>
        <span className={s.avatar} aria-hidden="true">
          <Foto src={cardapio.tema.logo_url} fallback={(atendente.trim()[0] || "C").toUpperCase()} />
        </span>
        <span className={s.conversaQuem}>
          <strong>{atendente}</strong>
          <span>{primeiroNome(nome) ? `Conversando com ${primeiroNome(nome)}` : "Pergunte sobre o cardápio"}</span>
        </span>
      </div>

      <div className={s.mensagens} aria-live="polite">
        {mensagens.map((m, i) => (
          <div key={i} className={`${s.msg} ${m.de === "casa" ? s.msgCasa : s.msgCliente}`}>
            {m.texto ? <div className={s.balao}>{m.texto}</div> : null}
            {(m.produto_ids || []).map((id) => {
              const p = porId.get(id);
              if (!p) return null;
              return (
                <div key={id} className={s.pratoMsg}>
                  <Foto src={p.imagem_url} loading="lazy" fallback={<span className={s.pratoMsgSem} aria-hidden="true">{p.nome.trim()[0]}</span>} />
                  <button type="button" className={s.pratoMsgAbrir} onClick={() => onAbrirPrato(id)}>
                    <strong>{p.nome}</strong>
                    <span className={s.preco}>{formatarPreco(p.preco)}{p.preco_original ? <span className={s.precoAntigo} style={{ marginLeft: 6 }}>{formatarPreco(p.preco_original)}</span> : null}</span>
                  </button>
                  {podePedir ? (
                    <button type="button" className={s.mais} onClick={() => onAdicionar(id)} aria-label={`Adicionar ${p.nome}`}><Plus size={20} aria-hidden="true" /></button>
                  ) : <span />}
                </div>
              );
            })}
            {m.de === "casa" && m.acoes?.length && i === mensagens.length - 1 ? (
              <div className={s.chips}>
                {m.acoes.map((a) => (
                  <button key={`${a.tipo}-${a.id}`} type="button" className={s.secundario} onClick={() => acao(a)}>{a.rotulo}</button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {digitando ? <div className={s.digitando} aria-label="Respondendo"><i /><i /><i /></div> : null}
        <div ref={fim} />
      </div>

      <form className={s.escrever} onSubmit={(e) => { e.preventDefault(); perguntar(texto); setTexto(""); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 120))} placeholder="Pergunte: tem algo sem glúten?" aria-label="Sua mensagem" enterKeyHint="send" />
        <button type="submit" className={s.enviar} aria-label="Enviar" disabled={!texto.trim()}><SendHorizontal size={20} aria-hidden="true" /></button>
      </form>
    </div>
  );
}
