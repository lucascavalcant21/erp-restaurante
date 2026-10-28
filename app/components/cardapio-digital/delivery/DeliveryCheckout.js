"use client";

import { useState } from "react";
import { formatarPreco } from "../../../lib/cardapio-digital.mjs";
import { resumoDoCheckout } from "../../../lib/cardapio-checkout.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, BotaoRedondo, Icone, PalavraDesconto, Segmentado } from "../ui";
import s from "./delivery.module.css";

// Finalizar pedido do delivery (protótipo DeliveryCheckout, 9.7.1 da spec):
// uma tela só, com o botão final sempre visível e o motivo quando não dá para
// enviar. Os valores são para MOSTRAR; o servidor recalcula e confere tudo.
// Do protótipo ficam de fora (o servidor ainda não faz): agendar, cupom e
// pagar pelo app (precisa de um intermediador de pagamento).

export default function DeliveryCheckout({
  cardapio, idioma = "pt", carrinho = [], form, setForm, tipo, setTipo, pagamento, setPagamento,
  cashback = {}, erroEnvio = "", enviando = false, onEnviar, onVoltar,
}) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const ent = cardapio.entrega || {};
  const [editandoEndereco, setEditandoEndereco] = useState(!String(form.endereco || "").trim());
  const usarCashback = Boolean(cashback.usar && cashback.possivel > 0);
  const r = resumoDoCheckout({
    cardapio, carrinho, tipo, pagamento, form,
    descontoCadastro: cashback.desconto || 0, cashback: usarCashback ? cashback.possivel : 0,
  });
  const muda = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const nomeForma = (id) => T(`forma_${id}`);
  const tempo = tipo === "delivery" && ent.tempo_min && ent.tempo_max ? ` · ${ent.tempo_min}–${ent.tempo_max} min` : "";
  const motivoTexto = r.motivo === "falta_minimo"
    ? T("falta_minimo", { minimo: formatarPreco(ent.pedido_minimo, idioma), falta: formatarPreco(r.falta_minimo, idioma) })
    : r.motivo === "troco_menor" ? T("troco_menor", { valor: formatarPreco(r.total, idioma) })
      : r.motivo ? T(r.motivo) : "";

  return (
    <div className={s.tela} role="dialog" aria-modal="true" aria-labelledby="t-checkout" lang={idioma}>
      <div className={s.telaCaixa}>
        <header className={s.telaTopo}>
          <BotaoRedondo tipo="voltar" rotulo={T("voltar")} onClick={onVoltar} />
          <h1 id="t-checkout" className={s.telaTitulo}>{T("finalizar")}</h1>
        </header>

        <div className={s.telaCorpo}>
          {ent.retirada ? (
            <Segmentado leve rotulo={T("entrega")} valor={tipo} onMudar={setTipo}
              opcoes={[{ id: "delivery", rotulo: T("entrega") }, { id: "retirada", rotulo: T("retirada") }]} />
          ) : null}

          {tipo === "delivery" ? (
            <section aria-label={T("endereco")} className={s.bloco}>
              {editandoEndereco ? (
                <label className={s.campo}>{T("endereco")}
                  <textarea className={s.entrada} rows={2} maxLength={300} value={form.endereco} onChange={muda("endereco")}
                    placeholder={T("endereco_ph")} autoComplete="street-address" />
                </label>
              ) : (
                <div className={s.cartaoLinha}>
                  <Icone nome="casa" tamanho={22} />
                  <div className={s.cartaoTextos}>
                    <span className={s.cartaoTitulo}>{T("endereco")}</span>
                    <span className={s.cartaoSub}>{form.endereco}</span>
                  </div>
                  <button type="button" className={s.link} onClick={() => setEditandoEndereco(true)}>{T("trocar")}</button>
                </div>
              )}
            </section>
          ) : (
            <div className={s.cartaoLinha}>
              <Icone nome="casa" tamanho={22} />
              <div className={s.cartaoTextos}>
                <span className={s.cartaoTitulo}>{T("retire")}</span>
                {cardapio.unidade?.endereco ? <span className={s.cartaoSub}>{cardapio.unidade.endereco}</span> : null}
              </div>
            </div>
          )}

          <section aria-labelledby="t-dados" className={s.bloco}>
            <h2 id="t-dados" className={s.blocoTitulo}>{T("seus_dados")}</h2>
            <div className={s.dois}>
              <label className={s.campo}>{T("nome")}
                <input className={s.entrada} value={form.nome} onChange={muda("nome")} maxLength={80} autoComplete="name" />
              </label>
              <label className={s.campo}>{T("whatsapp")}
                <input className={s.entrada} value={form.telefone} onChange={muda("telefone")} inputMode="tel" autoComplete="tel" maxLength={20} />
              </label>
            </div>
          </section>

          <section aria-labelledby="t-quando" className={s.bloco}>
            <h2 id="t-quando" className={s.blocoTitulo}>{T("quando")}</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <span className={s.quando} aria-current="true">{T("agora")}{tempo}</span>
            </div>
          </section>

          <section aria-labelledby="t-pag" className={s.bloco}>
            <h2 id="t-pag" className={s.blocoTitulo}>{T("pagamento")}</h2>
            <div className={s.abaPagamento}><span>{tipo === "retirada" ? T("pagar_retirada") : T("pagar_entrega")}</span></div>
            <div className={s.formas} role="radiogroup" aria-labelledby="t-pag">
              {(ent.formas || ["dinheiro", "cartao"]).map((f) => (
                <FormaPagamento key={f} id={f} rotulo={nomeForma(f)} sel={pagamento === f} onEscolher={() => setPagamento(f)}>
                  {f === "dinheiro" && pagamento === "dinheiro" ? (
                    <div className={s.trocoLinha}>
                      <label htmlFor="troco">{T("troco")}</label>
                      <input id="troco" className={s.troco} value={form.troco} onChange={muda("troco")} inputMode="decimal" placeholder="R$" maxLength={20} />
                    </div>
                  ) : null}
                </FormaPagamento>
              ))}
            </div>
          </section>

          {cashback.possivel > 0 ? (
            <label className={s.cashback}>
              <input type="checkbox" checked={usarCashback} onChange={(e) => cashback.setUsar?.(e.target.checked)} />
              <span>{T("usar_cashback", { valor: formatarPreco(cashback.possivel, idioma) })} <strong>CASHBACK</strong></span>
            </label>
          ) : null}

          <section aria-label="Resumo" className={s.resumo}>
            <div><span className={s.resumoRotulo}>{T("subtotal")}</span><span>{formatarPreco(r.subtotal, idioma)}</span></div>
            {tipo === "delivery" ? (
              <div><span className={s.resumoRotulo}>{T("taxa_entrega")}</span>{r.taxa > 0 ? <span>{formatarPreco(r.taxa, idioma)}</span> : <span className={s.verde}>{T("gratis")}</span>}</div>
            ) : null}
            {r.desconto > 0 ? (
              <div><span><PalavraDesconto idioma={idioma} espacoAntes={false} /></span><span className={s.verde}>−{formatarPreco(r.desconto, idioma)}</span></div>
            ) : null}
            <div className={s.resumoTotal}><span>{T("total")}</span><span>{formatarPreco(r.total, idioma)}</span></div>
          </section>
        </div>

        <div className={s.telaPe}>
          {erroEnvio ? <span role="alert" className={s.erroEnvio}>{erroEnvio}</span> : null}
          <span className={`${s.motivo} ${r.pode ? "" : s.motivoAlerta}`} role="status">
            {r.pode ? T("voce_paga", { valor: formatarPreco(r.total, idioma), forma: nomeForma(pagamento).toLowerCase(), onde: T(tipo === "retirada" ? "na_retirada" : "na_entrega") }) : motivoTexto}
          </span>
          <Botao tamanho={54} larguraTotal disabled={!r.pode || enviando} onClick={onEnviar}>{enviando ? T("enviando") : T("fazer_pedido")}</Botao>
        </div>
      </div>
    </div>
  );
}

function FormaPagamento({ id, rotulo, sel, onEscolher, children }) {
  return (
    <>
      <label className={`${s.forma} ${sel ? s.formaSel : ""}`}>
        <input type="radio" name="forma-pagamento" value={id} checked={sel} onChange={onEscolher} />
        {rotulo}
      </label>
      {children}
    </>
  );
}
