"use client";

import { useEffect, useMemo, useState } from "react";
import { formatarPreco, grupoDeTamanho, precoDaLinha, rotuloSelo } from "../../../lib/cardapio-digital.mjs";
import { sugestoesDaSacola } from "../../../lib/cardapio-delivery.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, BotaoRedondo, Escolhas, Icone, Quantidade, Segmentado } from "../ui";
import s from "./detalhe.module.css";

// Detalhe do prato no tablet (protótipo TabletDetalhe, 9.3 da spec): fotos e
// vídeo à esquerda com "Combina com", e à direita nome, preço, selos,
// alergênicos, os complementos (Escolhas), observação, Aqui/Viagem,
// quantidade e "Adicionar ao pedido" com o total. O preço é o mesmo que o
// servidor cobra (precoDaLinha).

// `inicial` (Editar no pedido): { quantidade, observacao, opcoes, viagem } da linha; o botão vira "Salvar alterações".
export default function TabletDetalhe({ cardapio, produto, idioma = "pt", mesa = "", onFechar, onAdicionar, podePedir = true, inicial = null }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const [escolhas, setEscolhas] = useState({});
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");
  const [viagem, setViagem] = useState("aqui");
  const [fotoAtual, setFotoAtual] = useState(0);
  const [ampliada, setAmpliada] = useState(false);
  const [tentou, setTentou] = useState(false);
  useEffect(() => {
    setEscolhas(inicial?.opcoes || {}); setQtd(inicial?.quantidade || 1); setObs(inicial?.observacao || "");
    setViagem(inicial?.viagem ? "viagem" : "aqui"); setFotoAtual(0); setTentou(false);
  }, [produto?.id, inicial]);

  const midias = useMemo(() => {
    const lista = (produto?.midias || []).filter((m) => m.url);
    if (!lista.length && produto?.imagem_url) return [{ tipo: "foto", url: produto.imagem_url }];
    return lista;
  }, [produto]);
  const combina = useMemo(() => (produto ? sugestoesDaSacola([{ id: produto.id, quantidade: 1 }], cardapio) : []), [produto, cardapio]);
  if (!produto) return null;
  const linha = precoDaLinha(produto, escolhas);
  const faltando = (produto.grupos || []).find((g) => (escolhas[g.id] || []).length < g.min);
  const tamanho = (produto.grupos || []).find(grupoDeTamanho);
  const aPartir = tamanho ? (produto.preco || 0) + Math.min(...tamanho.opcoes.map((o) => o.preco)) : produto.preco;
  const total = (linha.ok ? linha.preco : produto.preco) * qtd;
  const atual = midias[fotoAtual];
  const adicionar = () => {
    if (!linha.ok) { setTentou(true); return; }
    onAdicionar?.(produto.id, qtd, obs.trim(), escolhas, false, viagem === "viagem");
  };

  return (
    <div className={s.fundo} role="dialog" aria-modal="true" aria-labelledby="t-prato" lang={idioma} onClick={(e) => { if (e.target === e.currentTarget) onFechar?.(); }}>
      <div className={s.caixa}>
        <div className={s.esquerda}>
          <div className={s.midia}>
            {atual?.tipo === "video" ? (
              <video className={s.midiaConteudo} src={atual.url} poster={atual.poster_url || undefined} muted playsInline loop autoPlay controls={false} />
            ) : atual?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={s.midiaConteudo} src={atual.url} alt={produto.nome} />
            ) : <span className={s.midiaVazia} aria-hidden="true" />}
            {produto.destaque ? <span className={s.selo}>{T("mais_pedido")}</span> : null}
            {atual?.url && atual.tipo !== "video" ? (
              <button type="button" className={s.ampliar} onClick={() => setAmpliada(true)}><Icone nome="ampliar" tamanho={16} />{T("ampliar")}</button>
            ) : null}
          </div>
          {midias.length > 1 ? (
            <div className={s.miniaturas}>
              {midias.map((m, i) => (
                <button key={i} type="button" aria-label={`${i + 1}`} aria-current={i === fotoAtual ? "true" : undefined}
                  className={`${s.miniatura} ${i === fotoAtual ? s.miniaturaAtual : ""}`} onClick={() => setFotoAtual(i)}>
                  {m.tipo === "video" ? <Icone nome="play" tamanho={16} /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" />
                  )}
                </button>
              ))}
            </div>
          ) : null}
          {combina.length ? (
            <section aria-labelledby="t-combina" className={s.combina}>
              <h3 id="t-combina" className={s.combinaTitulo}>{T("combina_prato", { prato: produto.nome })}</h3>
              <div className={s.combinaLista}>
                {combina.map((c) => (
                  <div key={c.id} className={s.combinaCard}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.foto ? <img className={s.combinaFoto} src={c.foto} alt="" /> : <span className={s.combinaFoto} aria-hidden="true" />}
                    <span className={s.combinaNome}>{c.nome}</span>
                    <span className={s.combinaSub}>{c.papel === "bebida" ? T("sem_bebida") : T("sem_sobremesa")} · + {formatarPreco(c.preco, idioma)}</span>
                    {podePedir ? <button type="button" className={s.combinaAdicionar} onClick={() => onAdicionar?.(c.id, 1, "", null, true)}>{T("adicionar")}</button> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className={s.direita}>
          <div className={s.rolagem}>
            <div className={s.topo}>
              <div>
                <h2 id="t-prato" className={s.nome}>{produto.nome}</h2>
                <p className={s.preco}>{tamanho ? T("a_partir_de", { valor: formatarPreco(aPartir, idioma) }) : formatarPreco(produto.preco, idioma)}</p>
              </div>
              <BotaoRedondo tipo="fechar" rotulo={T("fechar")} onClick={onFechar} />
            </div>
            {produto.descricao ? <p className={s.descricao}>{produto.descricao}</p> : null}
            {produto.selos?.length || produto.alergenicos?.length ? (
              <div className={s.chips}>
                {(produto.selos || []).map((sl) => <span key={sl} className={s.chipOk}><Icone nome="check" tamanho={14} />{rotuloSelo(sl, idioma)}</span>)}
                {(produto.alergenicos || []).map((a) => <span key={a} className={s.chipAlerta}><Icone nome="alerta" tamanho={14} />{T("contem_x", { x: a.toLowerCase() })}</span>)}
              </div>
            ) : null}
            {produto.pode_conter ? <p className={s.nota}>{produto.pode_conter}</p> : null}
            {produto.harmoniza ? <p className={s.nota}>{produto.harmoniza}</p> : null}

            <Escolhas produto={produto} valor={escolhas} onMudar={setEscolhas} idioma={idioma} destacarFaltando={tentou} largo />

            <label className={s.obs}>
              <span className={s.obsRotulo}>{T("observacao")}</span>
              <textarea className={s.obsCampo} rows={2} maxLength={160} value={obs} onChange={(e) => setObs(e.target.value)} placeholder={T("obs_exemplo")} />
            </label>
          </div>

          {podePedir ? (
            <div className={s.pe}>
              {tentou && faltando ? <span className={s.falta} role="alert">{T("falta_escolher", { grupo: faltando.nome })}</span> : null}
              <div className={s.peLinha}>
                {mesa ? (
                  <Segmentado tom="principal" largura={226} rotulo={`${T("aqui")} / ${T("viagem")}`} valor={viagem} onMudar={setViagem}
                    opcoes={[{ id: "aqui", rotulo: T("aqui") }, { id: "viagem", rotulo: T("viagem") }]} />
                ) : null}
                <Quantidade valor={qtd} onMudar={setQtd} min={1} max={50} nomeItem={produto.nome} />
                <Botao tamanho={54} className={s.adicionar} onClick={adicionar} valor={formatarPreco(total, idioma)}>{inicial ? T("salvar_alteracoes") : T("adicionar_pedido")}</Botao>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {ampliada && atual?.url ? (
        <button type="button" className={s.lupa} onClick={() => setAmpliada(false)} aria-label={T("fechar")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={atual.url} alt={produto.nome} />
        </button>
      ) : null}
    </div>
  );
}
