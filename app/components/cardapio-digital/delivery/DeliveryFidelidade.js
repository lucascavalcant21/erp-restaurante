"use client";

import { formatarPreco } from "../../../lib/cardapio-digital.mjs";
import { resumoDaFidelidade } from "../../../lib/cardapio-fidelidade-cliente.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { BotaoRedondo } from "../ui";
import s from "./delivery.module.css";

// Minha fidelidade (protótipo DeliveryFidelidade, 9N): pontos/cashback do
// cliente, cartões de selos com "Pedir 1 …" e o código do prêmio quando o
// cartão completa. Dados do servidor (telefone provado por este aparelho).

export function Aneis() {
  return (
    <span aria-hidden="true" className={s.aneis}>
      <span className={`${s.anel} ${s.anelA}`} />
      <span className={`${s.anel} ${s.anelB}`} />
      <span className={`${s.anel} ${s.anelC}`} />
      <span className={s.reflexo} />
    </span>
  );
}

function Folhinha() {
  return (
    <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z" /><path d="M5 19l8-8" />
    </svg>
  );
}

export default function DeliveryFidelidade({ cardapio, status, idioma = "pt", onVoltar, onUsarCashback, onAdicionar, onArea }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const fid = cardapio.fidelidade || {};
  const r = resumoDaFidelidade(fid, status, cardapio);
  const [principal, ...outros] = r.cartoes;
  const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString(idioma === "pt" ? "pt-BR" : idioma, { day: "2-digit", month: "2-digit" }) : "");

  return (
    <div className={s.tela} role="dialog" aria-modal="true" aria-labelledby="t-fid" lang={idioma}>
      <div className={s.telaCaixa}>
        <header className={s.telaTopo}>
          <BotaoRedondo tipo="voltar" rotulo={T("voltar")} onClick={onVoltar} />
          <h1 id="t-fid" className={s.telaTitulo}>{T("minha_fidelidade")}</h1>
        </header>
        <div className={s.telaCorpo}>
          {r.cashback ? (
            <section aria-label="Pontos e cashback" className={s.fidHeroi}>
              <Aneis />
              <span className={s.fidOla}>{r.nome ? T("ola", { nome: r.nome }) : T("ola_sem_nome")}</span>
              <div className={s.fidSaldos}>
                <div className={s.fidSaldo}>
                  <span className={s.fidPontos}>{r.cashback.pontos.toLocaleString("pt-BR")}</span>
                  <span className={s.fidSaldoRotulo}>{T("pontos")}</span>
                </div>
                <div className={`${s.fidSaldo} ${s.fidSaldoDireita}`}>
                  <span className={s.fidReais}>{formatarPreco(r.cashback.saldo, idioma)}</span>
                  <span className={s.fidSaldoRotulo}>{T("de_cashback")} <strong>CASHBACK</strong></span>
                </div>
              </div>
              <span className={s.fidRegraTexto}>{T("regra_pontos", { p: r.cashback.pontos_por_real, v: formatarPreco(r.cashback.valor_100, idioma) })}</span>
              {r.cashback.saldo > 0 ? <button type="button" className={s.fidUsar} onClick={onUsarCashback}>{T("usar_cashback_prox")}</button> : null}
            </section>
          ) : null}

          {!r.identificado ? <p className={s.fidAviso}>{T("comece_pontos")}</p> : null}

          {principal ? <CartaoGrande c={principal} T={T} idioma={idioma} onAdicionar={onAdicionar} dataCurta={dataCurta} /> : null}
          {outros.map((c) => (
            <div key={c.id} className={s.fidMini}>
              <span className={s.fidMiniSelos} aria-hidden="true">
                {Array.from({ length: Math.min(c.total, 4) }, (_, i) => <span key={i} className={`${s.fidMiniSelo} ${i < Math.round((c.tem / c.total) * Math.min(c.total, 4)) ? s.fidMiniCheio : ""}`} />)}
              </span>
              <span className={s.fidMiniTextos}>
                <span className={s.fidMiniNome}>{c.nome}</span>
                <span className={s.fidMiniSub}>{T("n_de", { n: c.tem, t: c.total })} · {c.recompensa}</span>
              </span>
            </div>
          ))}

          {r.identificado && onArea ? <button type="button" className={s.fidLinkArea} onClick={onArea}>{T("minha_area")} →</button> : null}
        </div>
      </div>
    </div>
  );
}

function CartaoGrande({ c, T, idioma, onAdicionar, dataCurta }) {
  if (c.completo) {
    return (
      <section aria-label={T("premio_liberado")} className={`${s.fidHeroi} ${s.fidParabens}`}>
        <Aneis />
        <span className={s.fidOla}>{c.nome}</span>
        <span className={s.fidPremioTitulo}>{T("premio_liberado")}</span>
        <span className={s.fidRegraTexto}>{c.recompensa}</span>
        {c.codigo ? (
          <>
            <span className={s.fidCodigoCliente}>{c.codigo.slice(0, 3)}-{c.codigo.slice(3)}</span>
            <span className={s.fidRegraTexto}>{T("mostre_codigo", { data: dataCurta(c.valido_ate) })}</span>
          </>
        ) : <span className={s.fidRegraTexto}>{T("codigo_em_breve")}</span>}
      </section>
    );
  }
  return (
    <section aria-label={c.nome} className={s.fidCartao}>
      <div className={s.fidCartaoTopo}>
        <h2 className={s.fidCartaoNome}>{c.nome}</h2>
        <span className={s.fidCartaoConta}>{T("n_de", { n: c.tem, t: c.total })}</span>
      </div>
      <span className={s.fidCartaoRegra}>{T("regra_cartao", { t: c.total, premio: c.recompensa })}</span>
      <div className={s.fidSelos} role="img" aria-label={T("n_de", { n: c.tem, t: c.total })}>
        {Array.from({ length: c.total }, (_, i) => (
          <span key={i} className={`${s.fidSelo} ${i < c.tem ? s.fidSeloCheio : ""} ${i === c.tem - 1 ? s.fidSeloNovo : ""}`}>
            {i < c.tem ? <Folhinha /> : i + 1}
          </span>
        ))}
      </div>
      <span className={s.fidFalta}>{T("faltam_selos", { n: c.faltam, premio: c.recompensa })}</span>
      {c.prato ? (
        <button type="button" className={s.fidPedirUm} onClick={() => onAdicionar?.(c.prato.id, 1)}>
          <span className={s.fidPedirTextos}><span className={s.fidPedirNome}>{T("pedir_um", { prato: c.prato.nome })}</span><span className={s.fidPedirSub}>{T("ganha_selo")}</span></span>
          <span className={s.fidPedirPreco}>{formatarPreco(c.prato.preco, idioma)} →</span>
        </button>
      ) : null}
      {c.completar ? (
        <button type="button" className={s.fidCompletar} onClick={() => onAdicionar?.(c.prato.id, c.completar.n)}>
          {T("pedir_n_premio", { n: c.completar.n, valor: formatarPreco(c.completar.valor, idioma) })}
        </button>
      ) : null}
    </section>
  );
}
