"use client";

// O pedido do cliente: itens, sugestão, dados e confirmação, no idioma
// escolhido. Os valores aqui são para MOSTRAR; quem cobra é o servidor, que
// recalcula com o preço do minuto do envio — e a confirmação mostra o total
// que o servidor devolveu.

import { useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Trash2 } from "lucide-react";
import { aplicarNome, formatarPreco, saudacao, sugestaoParaCarrinho, totalDoCarrinho } from "../../lib/cardapio-digital.mjs";
import { t } from "../../lib/cardapio-idiomas.mjs";
import { Folha } from "./partes";
import s from "./cardapio.module.css";

function Totais({ cardapio, carrinho, mesa, idioma, cashback = 0, desconto = 0, pctCadastro = 0 }) {
  const tot = totalDoCarrinho(carrinho, cardapio, { tipo: mesa ? "qrcode" : "delivery" });
  const T = (k, v) => t(idioma, k, v);
  return (
    <div className={s.totais}>
      <div><span>{T("subtotal")}</span><span>{formatarPreco(tot.subtotal, idioma)}</span></div>
      {!mesa ? <div><span>{T("entrega")}</span><span>{tot.taxa ? formatarPreco(tot.taxa, idioma) : T("gratis")}</span></div> : null}
      {desconto > 0 ? <div className={s.linhaCashback}><span>{T("cad_desconto_linha")} ({pctCadastro}%)</span><span>−{formatarPreco(desconto, idioma)}</span></div> : null}
      {cashback > 0 ? <div className={s.linhaCashback}><span>{T("fid_linha")}</span><span>−{formatarPreco(cashback, idioma)}</span></div> : null}
      <div className={s.total}><span>{T("total")}</span><span>{formatarPreco(Math.round((tot.total - desconto - cashback) * 100) / 100, idioma)}</span></div>
      {desconto > 0 ? <p className={s.pedidoObs} style={{ margin: 0 }}>{T("cad_estimado", { pct: pctCadastro })}</p> : null}
      {!mesa && tot.falta_minimo ? <p className={s.erro} style={{ fontWeight: 600 }}>{T("falta_minimo", { valor: formatarPreco(tot.falta_minimo, idioma) })}</p> : null}
      {!mesa && !tot.falta_minimo && tot.falta_gratis ? <p className={s.pedidoObs}>{T("falta_gratis", { valor: formatarPreco(tot.falta_gratis, idioma) })}</p> : null}
    </div>
  );
}

function Itens({ cardapio, carrinho, alterarQtd, definirObs, remover, onAbrirPrato, idioma }) {
  const [editando, setEditando] = useState(null);
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  const T = (k, v) => t(idioma, k, v);
  return (
    <div>
      {carrinho.map((i) => {
        const p = porId.get(i.id);
        if (!p) return null;
        return (
          <div key={i.id} className={s.pedidoItem}>
            <button type="button" className={s.itemAbrir} onClick={() => onAbrirPrato(i.id)}>
              <span className={s.pedidoNome}>{p.nome}</span>
              {p.nome_original ? <span className={s.nomeOriginal} lang="pt-BR">{p.nome_original}</span> : null}
              <span className={s.pedidoObs}>{i.quantidade} × {formatarPreco(p.preco, idioma)}</span>
            </button>
            <span className={s.preco}>{formatarPreco(p.preco * i.quantidade, idioma)}</span>
            {editando === i.id ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <textarea className={s.observacao} autoFocus value={i.observacao || ""} maxLength={200}
                  onChange={(e) => definirObs(i.id, e.target.value)} placeholder={T("obs_item_placeholder")} aria-label={T("obs_de", { prato: p.nome })} />
                <button type="button" className={s.link} onClick={() => setEditando(null)}>{T("pronto")}</button>
              </div>
            ) : (
              <div style={{ gridColumn: "1 / -1" }}>
                {i.observacao ? <span className={s.pedidoObs}>“{i.observacao}” </span> : null}
                <button type="button" className={s.link} onClick={() => setEditando(i.id)}>{i.observacao ? T("mudar_obs") : T("obs_btn")}</button>
              </div>
            )}
            <div className={s.pedidoControles}>
              <span className={s.contador}>
                <button type="button" onClick={() => alterarQtd(i.id, -1)} aria-label={T("menos_prato", { prato: p.nome })} disabled={i.quantidade <= 1}><Minus size={18} aria-hidden="true" /></button>
                <output aria-live="polite">{i.quantidade}</output>
                <button type="button" onClick={() => alterarQtd(i.id, 1)} aria-label={T("mais_prato_simples", { prato: p.nome })} disabled={i.quantidade >= 50}><Plus size={18} aria-hidden="true" /></button>
              </span>
              <button type="button" className={s.secundario} onClick={() => remover(i.id)} aria-label={T("tirar_prato", { prato: p.nome })}><Trash2 size={16} aria-hidden="true" /> {T("tirar")}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sugestao({ cardapio, carrinho, adicionar, idioma }) {
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
            <span><span style={{ fontWeight: 600 }}>{p.nome}</span> <span className={s.preco}>{formatarPreco(p.preco, idioma)}</span></span>
            <button type="button" className={s.secundario} onClick={() => adicionar(id)}><Plus size={16} aria-hidden="true" /> {t(idioma, "adicionar")}</button>
          </div>
        );
      })}
    </div>
  );
}

function Dados({ cardapio, carrinho, mesa, form, setForm, erros, deliveryFechado, idioma, cashback }) {
  const T = (k, v) => t(idioma, k, v);
  const campo = (k) => ({ value: form[k] || "", onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  return (
    <div className={s.form}>
      {mesa ? <div className={s.mesaFixa}>{T("pedido_para_mesa", { mesa })}</div> : null}
      {deliveryFechado ? <div className={s.aviso} style={{ margin: 0 }}>{T("delivery_fechado_aviso")}</div> : null}
      <label className={s.rotulo}>{T("campo_nome")}
        <input className={s.campo} {...campo("nome")} autoComplete="given-name" maxLength={80} />
        {erros.nome ? <p className={s.erro}>{erros.nome}</p> : null}
      </label>
      <label className={s.rotulo}>{T("whatsapp")} {mesa ? <small>{T("whatsapp_opcional")}</small> : null}
        <input className={s.campo} {...campo("telefone")} inputMode="tel" autoComplete="tel" placeholder={T("whatsapp_placeholder")} maxLength={20} />
        {erros.telefone ? <p className={s.erro}>{erros.telefone}</p> : null}
      </label>
      {!mesa ? (
        <>
          <label className={s.rotulo}>{T("endereco")}
            <textarea className={s.campo} {...campo("endereco")} autoComplete="street-address" placeholder={T("endereco_placeholder")} maxLength={300} />
            {erros.endereco ? <p className={s.erro}>{erros.endereco}</p> : null}
          </label>
          <label className={s.rotulo}>{T("troco")} <small>{T("troco_dica")}</small>
            <input className={s.campo} {...campo("troco")} inputMode="decimal" placeholder={T("troco_placeholder")} maxLength={20} />
          </label>
        </>
      ) : null}
      {cashback?.possivel > 0 ? (
        <label className={s.usarCashback}>
          <input type="checkbox" checked={cashback.usar} onChange={(e) => cashback.setUsar(e.target.checked)} />
          <span>
            <strong>{T("fid_usar", { valor: formatarPreco(cashback.possivel, idioma) })}</strong>
            <small>{T("fid_usar_dica", { final: cashback.final })}</small>
          </span>
        </label>
      ) : null}
      <Totais cardapio={cardapio} carrinho={carrinho} mesa={mesa} idioma={idioma} cashback={cashback?.aplicado || 0} desconto={cashback?.desconto || 0} pctCadastro={cashback?.pctCadastro || 0} />
      <p className={s.pedidoObs} style={{ margin: 0 }}>{T("confere")}</p>
    </div>
  );
}

function Enviado({ cardapio, resultado, nome, mesa, idioma }) {
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  const mudou = Math.abs((resultado.total || 0) - (resultado.mostrado || 0)) > 0.004;
  const T = (k, v) => t(idioma, k, v);
  return (
    <div>
      <div className={s.okIcone}><Check size={28} aria-hidden="true" /></div>
      <h3 className={s.detalheNome} style={{ fontSize: "1.4rem" }}>{aplicarNome(cardapio.textos.pedido_enviado, { nome, saudacao: saudacao(new Date(), undefined, idioma) })}</h3>
      <p className={s.detalheDescricao}>{mesa ? `${T("mesa", { mesa })} · ` : ""}{T("equipe_confirma")}</p>
      <div style={{ marginTop: 16 }}>
        {(resultado.itens || []).map((i) => (
          <div key={i.id} className={s.sugestaoLinha}>
            <span>{i.quantidade} × {porId.get(i.id)?.nome || "—"}</span>
            <span className={s.preco}>{formatarPreco(i.preco * i.quantidade, idioma)}</span>
          </div>
        ))}
        <div className={s.totais}>
          {resultado.taxa ? <div><span>{T("entrega")}</span><span>{formatarPreco(resultado.taxa, idioma)}</span></div> : null}
          {resultado.desconto ? <div className={s.linhaCashback}><span>{T("cad_desconto_linha")}</span><span>−{formatarPreco(resultado.desconto, idioma)}</span></div> : null}
          {resultado.cashback ? <div className={s.linhaCashback}><span>{T("fid_linha")}</span><span>−{formatarPreco(resultado.cashback, idioma)}</span></div> : null}
          <div className={s.total}><span>{T("total")}</span><span>{formatarPreco(resultado.total, idioma)}</span></div>
        </div>
        {mudou ? <p className={s.pedidoObs}>{T("preco_mudou")}</p> : null}
      </div>
    </div>
  );
}

export default function Pedido(props) {
  const { cardapio, carrinho, etapa, setEtapa, mesa, erroEnvio, enviando, onEnviar, resultado, nome, modo, onFechar, previa, cashback } = props;
  const idioma = cardapio.idioma || "pt";
  const T = (k, v) => t(idioma, k, v);
  const deliveryFechado = !mesa && !cardapio.unidade.delivery_aberto;
  const tot = totalDoCarrinho(carrinho, cardapio, { tipo: mesa ? "qrcode" : "delivery" });
  const qtd = carrinho.reduce((n, i) => n + i.quantidade, 0);
  const itens = qtd === 1 ? T("itens_um") : T("itens_n", { n: qtd });

  let titulo = T("seu_pedido");
  let corpo;
  let pe;
  if (etapa === "enviado" && resultado) {
    titulo = T("pedido_enviado_titulo");
    corpo = <Enviado cardapio={cardapio} resultado={resultado} nome={nome} mesa={mesa} idioma={idioma} />;
    pe = <button type="button" className={`${s.primario} ${s.largo}`} onClick={() => { setEtapa("carrinho"); if (modo === "folha") onFechar?.(); }}>{T("voltar_cardapio")}</button>;
  } else if (etapa === "dados" && carrinho.length) {
    titulo = mesa ? T("mesa", { mesa }) : T("entrega_titulo");
    corpo = (
      <>
        <button type="button" className={s.link} onClick={() => setEtapa("carrinho")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: -8 }}><ArrowLeft size={16} aria-hidden="true" /> {T("voltar_pedido")}</button>
        <Dados {...props} deliveryFechado={deliveryFechado} idioma={idioma} />
      </>
    );
    pe = (
      <>
        {erroEnvio ? <p className={s.erro} role="alert">{erroEnvio}</p> : null}
        <button type="button" className={`${s.primario} ${s.largo}`} onClick={onEnviar} disabled={enviando || deliveryFechado || previa || tot.falta_minimo > 0}>
          {previa ? T("previa_envio") : enviando ? T("enviando") : T("enviar_pedido", { valor: formatarPreco(Math.round((tot.total - (cashback?.desconto || 0) - (cashback?.aplicado || 0)) * 100) / 100, idioma) })}
        </button>
      </>
    );
  } else {
    corpo = carrinho.length ? (
      <>
        <Itens {...props} idioma={idioma} />
        <Sugestao {...props} idioma={idioma} />
        <Totais cardapio={cardapio} carrinho={carrinho} mesa={mesa} idioma={idioma} />
      </>
    ) : (
      <div className={s.painelVazio}>
        <strong>{T("nada_aqui")}</strong>
        <span>{T("toque_mais")}</span>
      </div>
    );
    pe = carrinho.length ? (
      <button type="button" className={`${s.primario} ${s.largo}`} onClick={() => setEtapa("dados")}>
        {T("continuar")} · {itens} · {formatarPreco(tot.total, idioma)}
      </button>
    ) : null;
  }

  if (modo === "folha") {
    return <Folha titulo={titulo} onFechar={onFechar} pe={pe} idioma={idioma}><div className={s.folhaCorpo}>{corpo}</div></Folha>;
  }
  return (
    <>
      <div className={s.folhaCabeca}><h2>{titulo}</h2></div>
      <div className={s.folhaCorpo}>{corpo}</div>
      {pe ? <div className={s.folhaPe}>{pe}</div> : null}
    </>
  );
}
