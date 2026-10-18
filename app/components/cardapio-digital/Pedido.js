"use client";

// O pedido do cliente: itens, sugestão, dados e confirmação. Os valores aqui
// são para MOSTRAR; quem cobra é o servidor, que recalcula com o preço do
// minuto do envio — e a confirmação mostra o total que o servidor devolveu.

import { useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Trash2 } from "lucide-react";
import { aplicarNome, formatarPreco, saudacao, sugestaoParaCarrinho, totalDoCarrinho } from "../../lib/cardapio-digital.mjs";
import { Folha } from "./partes";
import s from "./cardapio.module.css";

function Totais({ cardapio, carrinho, mesa }) {
  const t = totalDoCarrinho(carrinho, cardapio, { tipo: mesa ? "qrcode" : "delivery" });
  return (
    <div className={s.totais}>
      <div><span>Subtotal</span><span>{formatarPreco(t.subtotal)}</span></div>
      {!mesa ? <div><span>Entrega</span><span>{t.taxa ? formatarPreco(t.taxa) : "Grátis"}</span></div> : null}
      <div className={s.total}><span>Total</span><span>{formatarPreco(t.total)}</span></div>
    </div>
  );
}

function Itens({ cardapio, carrinho, alterarQtd, definirObs, remover, onAbrirPrato }) {
  const [editando, setEditando] = useState(null);
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  return (
    <div>
      {carrinho.map((i) => {
        const p = porId.get(i.id);
        if (!p) return null;
        return (
          <div key={i.id} className={s.pedidoItem}>
            <button type="button" className={s.itemAbrir} onClick={() => onAbrirPrato(i.id)}>
              <span className={s.pedidoNome}>{p.nome}</span>
              <span className={s.pedidoObs}>{i.quantidade} × {formatarPreco(p.preco)}</span>
            </button>
            <span className={s.preco}>{formatarPreco(p.preco * i.quantidade)}</span>
            {editando === i.id ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <textarea className={s.observacao} autoFocus value={i.observacao || ""} maxLength={200}
                  onChange={(e) => definirObs(i.id, e.target.value)} placeholder="Ex.: sem cebola, ponto da carne" aria-label={`Observação de ${p.nome}`} />
                <button type="button" className={s.link} onClick={() => setEditando(null)}>Pronto</button>
              </div>
            ) : (
              <div style={{ gridColumn: "1 / -1" }}>
                {i.observacao ? <span className={s.pedidoObs}>“{i.observacao}” </span> : null}
                <button type="button" className={s.link} onClick={() => setEditando(i.id)}>{i.observacao ? "Mudar observação" : "Observação"}</button>
              </div>
            )}
            <div className={s.pedidoControles}>
              <span className={s.contador}>
                <button type="button" onClick={() => alterarQtd(i.id, -1)} aria-label={`Menos um ${p.nome}`} disabled={i.quantidade <= 1}><Minus size={18} aria-hidden="true" /></button>
                <output aria-live="polite">{i.quantidade}</output>
                <button type="button" onClick={() => alterarQtd(i.id, 1)} aria-label={`Mais um ${p.nome}`} disabled={i.quantidade >= 50}><Plus size={18} aria-hidden="true" /></button>
              </span>
              <button type="button" className={s.secundario} onClick={() => remover(i.id)} aria-label={`Tirar ${p.nome} do pedido`}><Trash2 size={16} aria-hidden="true" /> Tirar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sugestao({ cardapio, carrinho, adicionar }) {
  const sug = sugestaoParaCarrinho(carrinho, cardapio);
  if (!sug) return null;
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  return (
    <div className={s.sugestao}>
      <p>{sug.texto}</p>
      {sug.produto_ids.map((id) => {
        const p = porId.get(id);
        return (
          <div key={id} className={s.sugestaoLinha}>
            <span><span style={{ fontWeight: 600 }}>{p.nome}</span> <span className={s.preco}>{formatarPreco(p.preco)}</span></span>
            <button type="button" className={s.secundario} onClick={() => adicionar(id)}><Plus size={16} aria-hidden="true" /> Adicionar</button>
          </div>
        );
      })}
    </div>
  );
}

function Dados({ cardapio, carrinho, mesa, form, setForm, erros, deliveryFechado }) {
  const campo = (k) => ({ value: form[k] || "", onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  return (
    <div className={s.form}>
      {mesa ? <div className={s.mesaFixa}>Pedido para a mesa {mesa}</div> : null}
      {deliveryFechado ? <div className={s.aviso} style={{ margin: 0 }}>O delivery está fechado agora. Dá para olhar o cardápio à vontade; o envio volta quando a loja abrir.</div> : null}
      <label className={s.rotulo}>Seu nome
        <input className={s.campo} {...campo("nome")} autoComplete="given-name" maxLength={80} />
        {erros.nome ? <p className={s.erro}>{erros.nome}</p> : null}
      </label>
      <label className={s.rotulo}>WhatsApp {mesa ? <small>(opcional, se quiser receber aviso)</small> : null}
        <input className={s.campo} {...campo("telefone")} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" maxLength={20} />
        {erros.telefone ? <p className={s.erro}>{erros.telefone}</p> : null}
      </label>
      {!mesa ? (
        <>
          <label className={s.rotulo}>Endereço de entrega
            <textarea className={s.campo} {...campo("endereco")} autoComplete="street-address" placeholder="Rua, número, bairro e um ponto de referência" maxLength={300} />
            {erros.endereco ? <p className={s.erro}>{erros.endereco}</p> : null}
          </label>
          <label className={s.rotulo}>Troco para <small>(só se for pagar em dinheiro)</small>
            <input className={s.campo} {...campo("troco")} inputMode="decimal" placeholder="Ex.: 100" maxLength={20} />
          </label>
        </>
      ) : null}
      <Totais cardapio={cardapio} carrinho={carrinho} mesa={mesa} />
      <p className={s.pedidoObs} style={{ margin: 0 }}>O restaurante confere e confirma o pedido antes de começar. O valor é calculado na hora do envio.</p>
    </div>
  );
}

function Enviado({ cardapio, resultado, nome, mesa }) {
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  const mudou = Math.abs((resultado.total || 0) - (resultado.mostrado || 0)) > 0.004;
  return (
    <div>
      <div className={s.okIcone}><Check size={28} aria-hidden="true" /></div>
      <h3 className={s.detalheNome} style={{ fontSize: "1.4rem" }}>{aplicarNome(cardapio.textos.pedido_enviado, { nome, saudacao: saudacao() })}</h3>
      <p className={s.detalheDescricao}>{mesa ? `Mesa ${mesa}. ` : ""}A equipe confirma e a cozinha começa.</p>
      <div style={{ marginTop: 16 }}>
        {(resultado.itens || []).map((i) => (
          <div key={i.id} className={s.sugestaoLinha}>
            <span>{i.quantidade} × {porId.get(i.id)?.nome || "Item"}</span>
            <span className={s.preco}>{formatarPreco(i.preco * i.quantidade)}</span>
          </div>
        ))}
        <div className={s.totais}>
          {resultado.taxa ? <div><span>Entrega</span><span>{formatarPreco(resultado.taxa)}</span></div> : null}
          <div className={s.total}><span>Total</span><span>{formatarPreco(resultado.total)}</span></div>
        </div>
        {mudou ? <p className={s.pedidoObs}>Algum preço mudou desde que você abriu o cardápio (uma promoção começou ou terminou). Vale o total acima.</p> : null}
      </div>
    </div>
  );
}

export default function Pedido(props) {
  const { cardapio, carrinho, etapa, setEtapa, mesa, form, erros, erroEnvio, enviando, onEnviar, resultado, nome, modo, onFechar, previa } = props;
  const deliveryFechado = !mesa && !cardapio.unidade.delivery_aberto;
  const total = totalDoCarrinho(carrinho, cardapio, { tipo: mesa ? "qrcode" : "delivery" }).total;
  const qtd = carrinho.reduce((n, i) => n + i.quantidade, 0);

  let titulo = "Seu pedido";
  let corpo;
  let pe;
  if (etapa === "enviado" && resultado) {
    titulo = "Pedido enviado";
    corpo = <Enviado cardapio={cardapio} resultado={resultado} nome={nome} mesa={mesa} />;
    pe = <button type="button" className={`${s.primario} ${s.largo}`} onClick={() => { setEtapa("carrinho"); if (modo === "folha") onFechar?.(); }}>Voltar ao cardápio</button>;
  } else if (etapa === "dados" && carrinho.length) {
    titulo = mesa ? `Mesa ${mesa}` : "Entrega";
    corpo = (
      <>
        <button type="button" className={s.link} onClick={() => setEtapa("carrinho")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: -8 }}><ArrowLeft size={16} aria-hidden="true" /> Voltar ao pedido</button>
        <Dados {...props} deliveryFechado={deliveryFechado} />
      </>
    );
    pe = (
      <>
        {erroEnvio ? <p className={s.erro} role="alert">{erroEnvio}</p> : null}
        <button type="button" className={`${s.primario} ${s.largo}`} onClick={onEnviar} disabled={enviando || deliveryFechado || previa}>
          {previa ? "Prévia: o envio fica desligado" : enviando ? "Enviando…" : `Enviar pedido · ${formatarPreco(total)}`}
        </button>
      </>
    );
  } else {
    corpo = carrinho.length ? (
      <>
        <Itens {...props} />
        <Sugestao {...props} />
        <Totais cardapio={cardapio} carrinho={carrinho} mesa={mesa} />
      </>
    ) : (
      <div className={s.painelVazio}>
        <strong>Nada por aqui ainda</strong>
        <span>Toque no + de um prato para começar o seu pedido.</span>
      </div>
    );
    pe = carrinho.length ? (
      <button type="button" className={`${s.primario} ${s.largo}`} onClick={() => setEtapa("dados")}>
        Continuar · {qtd} {qtd === 1 ? "item" : "itens"} · {formatarPreco(total)}
      </button>
    ) : null;
  }

  if (modo === "folha") {
    return <Folha titulo={titulo} onFechar={onFechar} pe={pe}><div className={s.folhaCorpo}>{corpo}</div></Folha>;
  }
  return (
    <>
      <div className={s.folhaCabeca}><h2>{titulo}</h2></div>
      <div className={s.folhaCorpo}>{corpo}</div>
      {pe ? <div className={s.folhaPe}>{pe}</div> : null}
    </>
  );
}
