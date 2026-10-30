"use client";

import { useEffect, useMemo, useState } from "react";
import { formatarPreco, totalDoCarrinho } from "../../../lib/cardapio-digital.mjs";
import { linhasDaSacola } from "../../../lib/cardapio-delivery.mjs";
import { pontosDoGasto } from "../../../lib/fidelidade.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, BotaoRedondo, Icone, PalavraDesconto, Quantidade, Segmentado } from "../ui";
import s from "./carrinho.module.css";

// Pedido da mesa no tablet (protótipos TabletCarrinho e TabletEnviado, 9.4).
// Painel à direita com cada item (quantidade, Excluir, Consumir aqui / Para
// viagem), subtotal e "Enviar para a cozinha". Depois do envio, a tela de
// confirmação volta sozinha ao cardápio. Quem cobra é o servidor.

export default function TabletCarrinho({
  cardapio, idioma = "pt", mesa = "", carrinho = [], nome = "", onNome, erro = "", enviando = false,
  onFechar, onEnviar, alterarQtd, remover, mudarViagem, onAbrirPrato, onEditar, cliente = null, desconto = 0, onEntrar, onSairCliente,
}) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const linhas = useMemo(() => linhasDaSacola(carrinho, cardapio), [carrinho, cardapio]);
  const porChave = useMemo(() => new Map(carrinho.map((i) => [i.linha || i.id, i])), [carrinho]);
  const tot = totalDoCarrinho(carrinho, cardapio, { tipo: "qrcode" });
  const qtd = carrinho.reduce((n, i) => n + i.quantidade, 0);
  const precisaNome = String(nome || "").trim().length < 2;
  const pct = cardapio.fidelidade?.cadastro?.desconto_pct || 0;

  return (
    <div className={s.fundo} role="dialog" aria-modal="true" aria-labelledby="t-pedido" lang={idioma} onClick={(e) => { if (e.target === e.currentTarget) onFechar?.(); }}>
      <aside className={s.painel}>
        <header className={s.topo}>
          <span className={s.topoIcone} aria-hidden="true"><Icone nome="pedidos" tamanho={20} /></span>
          <span className={s.topoTextos}>
            <h2 id="t-pedido" className={s.titulo}>{T("seu_pedido")}</h2>
            <span className={s.sub}>{[mesa ? T("mesa_n", { n: mesa }) : "", T("n_itens", { n: qtd })].filter(Boolean).join(" · ")}</span>
          </span>
          <BotaoRedondo tipo="fechar" rotulo={T("fechar")} onClick={onFechar} />
        </header>

        <div className={s.lista}>
          {!linhas.length ? <p className={s.vazio}>{T("sacola_vazia")}</p> : null}
          {linhas.map((l) => {
            const linha = porChave.get(l.chave) || {};
            return (
              <div key={l.chave} className={s.item}>
                <div className={s.itemTopo}>
                  <button type="button" className={s.itemNome} onClick={() => onAbrirPrato?.(l.id)}>{l.nome}</button>
                  <span className={s.itemPreco}>{formatarPreco(l.total, idioma)}</span>
                </div>
                {[l.escolhas, l.observacao].filter(Boolean).length ? <span className={s.itemObs}>{[l.escolhas, l.observacao].filter(Boolean).join(" · ")}</span> : null}
                <div className={s.itemAcoes}>
                  <Quantidade valor={l.quantidade} min={1} max={50} nomeItem={l.nome} onMudar={(n) => alterarQtd(l.chave, n - l.quantidade)} />
                  <span className={s.itemBotoes}>
                    {onEditar ? <button type="button" className={s.editar} onClick={() => onEditar(l.chave)}><Icone nome="lapis" tamanho={16} />{T("editar")}</button> : null}
                    <button type="button" className={s.excluir} onClick={() => remover(l.chave)}><Icone nome="lixeira" tamanho={16} />{T("excluir")}</button>
                  </span>
                </div>
                <Segmentado tom="principal" rotulo={`${T("consumir_aqui")} / ${T("para_viagem")}`} valor={linha.viagem ? "viagem" : "aqui"}
                  onMudar={(v) => mudarViagem(l.chave, v === "viagem")} className={s.viagem}
                  opcoes={[{ id: "aqui", rotulo: T("consumir_aqui") }, { id: "viagem", rotulo: T("para_viagem") }]} />
              </div>
            );
          })}
        </div>

        {linhas.length ? (
          <div className={s.pe}>
            {precisaNome ? (
              <label className={s.nome}>
                <span>{T("seu_nome")}</span>
                <input className={s.nomeCampo} value={nome} onChange={(e) => onNome?.(e.target.value)} maxLength={60} autoComplete="given-name" />
              </label>
            ) : null}
            {cliente ? (
              <div className={s.cliente}>
                <span>{T("bem_vindo_nome", { nome: cliente.nome || "" })}</span>
                <button type="button" className={s.sair} onClick={onSairCliente}>{T("sair_cpf")}</button>
              </div>
            ) : onEntrar && pct ? (
              <button type="button" className={s.entrarCpf} onClick={onEntrar}>{T("entrar_com_cpf", { pct })} <PalavraDesconto idioma={idioma} espacoAntes={false} /></button>
            ) : null}
            {desconto > 0 ? <div className={s.descontoLinha}><span><PalavraDesconto idioma={idioma} espacoAntes={false} /></span><strong>−{formatarPreco(desconto, idioma)}</strong></div> : null}
            <div className={s.subtotal}><span>{T("subtotal")}</span><strong>{formatarPreco(Math.max(0, tot.total - desconto), idioma)}</strong></div>
            {erro ? <span role="alert" className={s.erro}>{erro}</span> : null}
            <Botao tamanho={58} larguraTotal iconeDireita="seta" disabled={enviando || precisaNome} onClick={onEnviar}>{enviando ? T("enviando") : T("enviar_cozinha")}</Botao>
            <button type="button" className={s.continuar} onClick={onFechar}>{T("continuar_escolhendo")}</button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

/** "Pedido enviado para a cozinha!" — volta sozinho ao cardápio (TabletEnviado). */
export function TabletEnviado({ cardapio, idioma = "pt", mesa = "", nome = "", resultado = {}, segundos = 12, onVoltar }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const [resta, setResta] = useState(segundos);
  useEffect(() => {
    const tm = setInterval(() => setResta((r) => r - 1), 1000);
    return () => clearInterval(tm);
  }, []);
  useEffect(() => { if (resta <= 0) onVoltar?.(); }, [resta]); // eslint-disable-line react-hooks/exhaustive-deps
  const cb = cardapio.fidelidade?.cashback;
  const pontos = cb ? pontosDoGasto(resultado.total || 0, cb) : 0;
  const pct = cardapio.fidelidade?.cadastro?.desconto_pct;
  return (
    <div className={s.enviado} role="status" lang={idioma}>
      <span className={s.check} aria-hidden="true"><Icone nome="check" tamanho={40} traco={2.6} /></span>
      <h2 className={s.enviadoTitulo}>{T("enviado_titulo")}</h2>
      <p className={s.enviadoSub}>{T("obrigado_mesa", { nome: nome || "—", mesa })}</p>
      {resultado.desconto > 0 || pontos > 0 ? (
        <div className={s.cards}>
          {resultado.desconto > 0 ? (
            <div className={s.card}>
              <span className={s.cardRotulo}><PalavraDesconto idioma={idioma} espacoAntes={false} /> {T("de_cadastro")}{pct ? ` (${pct}%)` : ""}</span>
              <span className={s.cardDesconto}>−{formatarPreco(resultado.desconto, idioma)}</span>
            </div>
          ) : null}
          {pontos > 0 ? (
            <div className={s.card}>
              <span className={s.cardRotulo}>{T("pontos_apos")}</span>
              <span className={s.cardPontos}>+{pontos} {T("pontos")}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <button type="button" className={s.voltar} onClick={onVoltar}>{T("voltando_em", { s: Math.max(0, resta) })}</button>
      <div className={s.trilho} aria-hidden="true"><div className={s.barra} style={{ animationDuration: `${segundos}s` }} /></div>
    </div>
  );
}
