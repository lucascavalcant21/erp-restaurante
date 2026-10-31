"use client";

import { formatarPreco } from "../../../lib/cardapio-digital.mjs";
import { areaDoClienteVista } from "../../../lib/cardapio-fidelidade-cliente.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { PalavraDesconto } from "../ui";
import { Aneis } from "./DeliveryFidelidade";
import s from "./delivery.module.css";

// Minha área (protótipo ClienteArea, 9N.5): quanto o cliente economizou com o
// app, o que falta pouco (selos e pontos) e os pedidos com "Pedir de novo".
// Só com o telefone provado por este aparelho; os valores são do banco.

export default function ClienteArea({ cardapio, status, idioma = "pt", onVoltar, onPedir, onAdicionar, onPedirDeNovo }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const a = areaDoClienteVista(cardapio.fidelidade || {}, status, cardapio);
  const local = idioma === "pt" ? "pt-BR" : idioma;
  const mes = a.desde ? new Date(a.desde).toLocaleDateString(local, { month: "long", year: "numeric" }) : "";
  const quando = (iso) => new Date(iso).toLocaleString(local, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className={s.tela} role="dialog" aria-modal="true" aria-labelledby="t-area" lang={idioma}>
      <div className={s.telaCaixa}>
        <header className={s.areaTopo}>
          <button type="button" className={s.areaAvatar} onClick={onVoltar} aria-label={T("voltar")}>{(a.nome || "?").slice(0, 1).toUpperCase()}</button>
          <div className={s.areaTopoTextos}>
            <h1 id="t-area" className={s.areaOla}>{a.nome ? T("ola", { nome: a.nome }) : T("ola_sem_nome")}</h1>
            <span className={s.areaDesde}>{mes ? T("cliente_desde", { mes, n: a.nPedidos }) : T("n_de", { n: a.nPedidos, t: a.nPedidos })}</span>
          </div>
          <button type="button" className={s.areaPedir} onClick={onPedir}>{T("pedir")}</button>
        </header>

        <div className={s.telaCorpo}>
          <section aria-label={T("ja_economizou")} className={s.fidHeroi}>
            <Aneis />
            <span className={s.fidOla}>{T("ja_economizou")}</span>
            <span className={s.areaTotal}>{formatarPreco(a.economia.total, idioma)}</span>
            <div className={s.areaComparar}>
              <div className={s.areaBloco}><span className={s.areaBlocoRotulo}>{T("sem_app")}</span><span className={`${s.areaBlocoValor} ${s.areaRiscado}`}>{formatarPreco(a.economia.semApp, idioma)}</span></div>
              <div className={s.areaBloco}><span className={s.areaBlocoRotulo}>{T("com_app")}</span><span className={s.areaBlocoValor}>{formatarPreco(a.economia.comApp, idioma)}</span></div>
            </div>
            <span className={s.fidRegraTexto}>
              {formatarPreco(a.economia.desconto, idioma)} {T("de_cashback")} <PalavraDesconto idioma={idioma} espacoAntes={false} /> + {formatarPreco(a.economia.cashback, idioma)} {T("de_cashback")} <strong>CASHBACK</strong>
            </span>
          </section>

          {a.perto || a.pontos ? <h2 className={s.areaSecao}>{T("falta_pouco")}</h2> : null}
          {a.perto ? (
            <section className={`${s.fidCartao} ${s.areaPerto}`} aria-label={a.perto.nome}>
              <div className={s.fidMiniSelos} aria-hidden="true">
                {Array.from({ length: a.perto.total }, (_, i) => <span key={i} className={`${s.areaBolinha} ${i < a.perto.tem ? s.areaBolinhaCheia : ""}`} />)}
              </div>
              <span className={s.fidCartaoNome}>{T("faltam_selos", { n: a.perto.faltam, premio: a.perto.recompensa })}</span>
              {a.perto.prato ? (
                <button type="button" className={s.fidPedirUm} onClick={() => onAdicionar?.(a.perto.prato.id, a.perto.por === "pedido" ? 1 : a.perto.faltam)}>
                  <span className={s.fidPedirNome}>{a.perto.por === "pedido" ? T("pedir_um", { prato: a.perto.prato.nome }) : T("pedir_n_premio", { n: a.perto.faltam, valor: formatarPreco(a.perto.prato.preco * a.perto.faltam, idioma) })}</span>
                </button>
              ) : null}
            </section>
          ) : null}
          {a.pontos ? (
            <section className={s.fidCartao} aria-label="Pontos">
              <span className={s.fidCartaoNome}>{T("faltam_pontos", { n: a.pontos.faltam, v: formatarPreco(a.pontos.valor, idioma) })} <strong>CASHBACK</strong></span>
              <div className={s.incentivoTrilho} aria-hidden="true"><div className={s.incentivoBarra} style={{ width: `${Math.round(a.pontos.progresso * 100)}%` }} /></div>
              {a.pontos.pratos.length ? <span className={s.fidCartaoRegra}>{T("completam")}</span> : null}
              {a.pontos.pratos.map((p) => (
                <div key={p.id} className={s.areaPrato}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.foto ? <img className={s.areaPratoFoto} src={p.foto} alt="" /> : <span className={s.areaPratoFoto} aria-hidden="true" />}
                  <span className={s.areaPratoTextos}><span className={s.areaPratoNome}>{p.nome}</span><span className={s.areaPratoPontos}>{T("mais_pontos", { n: p.ganha })}</span></span>
                  <button type="button" className={s.areaPratoBotao} onClick={() => onAdicionar?.(p.id, 1)}>{T("pedir")}</button>
                </div>
              ))}
            </section>
          ) : null}

          {a.cadastro ? (
            <>
              <h2 className={s.areaSecao}>{T("so_cadastro")}</h2>
              <div className={s.areaVantagem}>
                <span className={s.areaVantagemSelo}><strong>{a.cadastro.desconto_pct}%</strong><PalavraDesconto idioma={idioma} espacoAntes={false} /></span>
                <span className={s.areaPratoTextos}>
                  <span className={s.areaPratoNome}>{cardapio.unidade?.nome}</span>
                  <span className={s.fidCartaoRegra}>{a.cadastro.aplica === "sempre" ? T("cadastro_regra") : T("cadastro_primeiro")}</span>
                </span>
              </div>
            </>
          ) : null}

          <h2 className={s.areaSecao}>{T("meus_pedidos")}</h2>
          {!a.pedidos.length ? <p className={s.fidAviso}>{T("sem_pedidos_area")}</p> : null}
          {a.pedidos.map((p) => (
            <article key={p.id} className={s.areaPedido}>
              <div className={s.areaPedidoTopo}>
                <span className={s.areaTipo}>{T(`tipo_${p.tipo}`) === `tipo_${p.tipo}` ? p.tipo : T(`tipo_${p.tipo}`)}</span>
                <span className={s.areaQuando}>{quando(p.em)}</span>
                <strong className={s.areaPedidoTotal}>{formatarPreco(p.total, idioma)}</strong>
              </div>
              {p.texto ? <span className={s.areaPedidoItens}>{p.texto}</span> : null}
              <div className={s.areaPedidoPe}>
                <span className={s.areaPedidoGanho}>
                  {[p.economizou > 0 ? T("economizou_pedido", { v: formatarPreco(p.economizou, idioma) }) : "", p.pontos > 0 ? T("mais_pontos", { n: p.pontos }) : "", p.selos > 0 ? T("n_selos", { n: p.selos }) : ""].filter(Boolean).join(" · ")}
                </span>
                {p.itens.length ? <button type="button" className={s.areaDeNovo} onClick={() => onPedirDeNovo?.(p.itens)}>{T("pedir_de_novo")}</button> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
