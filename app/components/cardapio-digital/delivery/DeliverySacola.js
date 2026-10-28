"use client";

import { useMemo, useState } from "react";
import { formatarPreco, totalDoCarrinho } from "../../../lib/cardapio-digital.mjs";
import { linhasDaSacola, sugestoesDaSacola } from "../../../lib/cardapio-delivery.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, BotaoRedondo, Quantidade } from "../ui";
import s from "./delivery.module.css";

// Sacola do delivery (protótipo DeliveryCarrinho, 9.6 e 9P da spec).
// Os valores são para MOSTRAR; quem cobra é o servidor, no envio. "Continuar"
// vai para os dados do pedido (a folha atual, até o checkout novo chegar).
// Sugestões: no máximo 2, com "×" (agora não), adicionar com 1 toque e nunca
// por cima da sacola. Com o "×", a mesma sugestão não volta neste pedido.

export default function DeliverySacola({ cardapio, idioma = "pt", carrinho = [], onVoltar, onContinuar, alterarQtd, remover, adicionar, onAbrirPrato }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const [dispensados, setDispensados] = useState([]);
  const linhas = useMemo(() => linhasDaSacola(carrinho, cardapio), [carrinho, cardapio]);
  const sugestoes = useMemo(() => sugestoesDaSacola(carrinho, cardapio, { dispensados }), [carrinho, cardapio, dispensados]);
  const tot = totalDoCarrinho(carrinho, cardapio, { tipo: "delivery" });
  const minimo = cardapio.entrega?.pedido_minimo || 0;

  return (
    <div className={s.tela} role="dialog" aria-modal="true" aria-labelledby="t-sacola" lang={idioma}>
      <div className={s.telaCaixa}>
        <header className={s.telaTopo}>
          <BotaoRedondo tipo="voltar" rotulo={T("voltar")} onClick={onVoltar} />
          <h1 id="t-sacola" className={s.telaTitulo}>{T("sua_sacola")}</h1>
        </header>

        <div className={s.telaCorpo}>
          {!linhas.length ? (
            <div className={s.vazio}>
              <p>{T("sacola_vazia")}</p>
              <Botao variante="secundario" tamanho={44} onClick={onVoltar}>{T("ver_cardapio")}</Botao>
            </div>
          ) : linhas.map((i) => (
            <div key={i.id} className={s.item}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.foto ? <img className={s.itemFoto} src={i.foto} alt="" /> : <span className={s.itemFoto} aria-hidden="true" />}
              <div className={s.itemTextos}>
                <button type="button" className={s.itemNome} onClick={() => onAbrirPrato(i.id)} aria-label={`${T("editar")}: ${i.nome}`}>{i.quantidade}× {i.nome}</button>
                {i.observacao ? <span className={s.itemObs}>{i.observacao}</span> : null}
              </div>
              <div className={s.itemLado}>
                <span className={s.itemPreco}>{formatarPreco(i.total, idioma)}</span>
                <Quantidade pequeno valor={i.quantidade} min={0} max={50} nomeItem={i.nome}
                  onMudar={(n) => (n < 1 ? remover(i.id) : alterarQtd(i.id, n - i.quantidade))} />
              </div>
            </div>
          ))}

          {sugestoes.length ? (
            <section aria-labelledby="t-sug" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 id="t-sug" className={s.sugestoesTitulo}>{T("combina")}</h2>
              <div className={s.sugestoes}>
                {sugestoes.map((g) => (
                  <div key={g.id} className={s.sugestao}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {g.foto ? <img className={s.sugestaoFoto} src={g.foto} alt="" /> : <span className={s.sugestaoFoto} aria-hidden="true" />}
                    <button type="button" className={s.dispensar} aria-label={`${T("agora_nao")}: ${g.nome}`} onClick={() => setDispensados((d) => [...d, g.id])}>×</button>
                    <div className={s.sugestaoCorpo}>
                      <span className={s.sugestaoMotivo}>{g.papel === "bebida" ? T("para_acompanhar") : T("para_fechar")}</span>
                      <span className={s.sugestaoNome}>{g.nome}</span>
                      <span className={s.sugestaoPreco}>
                        {g.de ? <><span className={s.riscado}>{formatarPreco(g.de, idioma)}</span> </> : null}
                        <strong>{formatarPreco(g.preco, idioma)}</strong>
                      </span>
                      <button type="button" className={s.sugestaoAdicionar} onClick={() => adicionar(g.id)}>{T("adicionar")}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {linhas.length ? (
          <div className={s.telaPe}>
            <div className={s.totalLinha}><span>{T("total")}</span><span>{formatarPreco(tot.subtotal, idioma)}</span></div>
            {tot.falta_minimo > 0 ? (
              <span className={s.minimo} role="status">{T("falta_minimo", { minimo: formatarPreco(minimo, idioma), falta: formatarPreco(tot.falta_minimo, idioma) })}</span>
            ) : null}
            <Botao tamanho={54} larguraTotal onClick={onContinuar}>{T("continuar")}</Botao>
          </div>
        ) : null}
      </div>
    </div>
  );
}
