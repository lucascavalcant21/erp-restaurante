"use client";

import { useMemo, useState } from "react";
import { formatarPreco, rotuloSelo } from "../../../lib/cardapio-digital.mjs";
import { conviteDoCadastro, itensAgoraNaCasa, quantidadesNaSacola } from "../../../lib/cardapio-delivery.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, Card, CarrosselAgora, ConviteDesconto, Etiqueta, FotoPrato, Icone, Preco } from "../ui";
import s from "./tablet.module.css";

// Tela principal do tablet da mesa (protótipo Main, 9.1 da spec): lateral com
// a casa, a mesa, as categorias e as ações (chamar garçom, idioma), e à
// direita busca, filtro, convite de cadastro, banners, "Agora na casa" e os
// pratos em duas colunas. Só desenho: estado, carrinho e folhas continuam no
// CardapioDigital. Degustação e Nossa história entram nas etapas delas.

function CardPrato({ produto, qtd, onAbrir, onAdicionar, podePedir, idioma, T }) {
  const promo = produto.preco_original && produto.preco_original > produto.preco;
  const video = produto.midias?.some((m) => m.tipo === "video");
  return (
    <Card className={s.prato}>
      <button type="button" className={s.pratoAbrir} onClick={() => onAbrir(produto.id)} aria-label={produto.nome}>
        <FotoPrato src={produto.imagem_url || ""} largura={112} altura={112} video={video} etiquetaPequena />
        <span className={s.pratoTextos}>
          <span className={s.pratoNome}>{produto.nome}</span>
          {produto.descricao ? <span className={s.pratoDesc}>{produto.descricao}</span> : null}
          {produto.selos?.length ? (
            <span className={s.pratoSelos}>
              {produto.selos.slice(0, 3).map((sl) => <Etiqueta key={sl}>{rotuloSelo(sl, idioma)}</Etiqueta>)}
            </span>
          ) : null}
        </span>
      </button>
      <div className={s.pratoPe}>
        <Preco valor={produto.preco} de={promo ? produto.preco_original : undefined} tamanho={17} idioma={idioma} />
        {qtd ? <span className={s.pratoQtd}>{T("no_pedido", { n: qtd })}</span> : null}
        {podePedir ? <Botao tamanho={40} onClick={() => onAdicionar(produto.id)}>{T("adicionar_curto")}</Botao> : null}
      </div>
    </Card>
  );
}

export default function TabletInicio({
  cardapio, idioma = "pt", mesa = "", carrinho = [], totalSacola = 0, offline = "",
  secaoAtiva, busca = "", onBusca, resultados = [], filtrando = false, selos = [], onSelos,
  onAbrirPrato, onAdicionar, onIrSecao, onAbrirSacola, onAbrirIdiomas, temIdiomas, onChamar, onRecomendar, temRecomendar,
  acompanhamento = null, onAbrirPedidos, linkCadastro, visitante = true, podePedir = true, banners = null, onConvite, onWifi,
}) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const { unidade, tema } = cardapio;
  const [filtroAberto, setFiltroAberto] = useState(false);
  const porId = useMemo(() => new Map(cardapio.produtos.map((p) => [p.id, p])), [cardapio]);
  const naSacola = useMemo(() => quantidadesNaSacola(carrinho), [carrinho]);
  const agora = useMemo(() => itensAgoraNaCasa(cardapio, { rotuloDestaque: T("destaque") }), [cardapio, idioma]); // eslint-disable-line react-hooks/exhaustive-deps
  const convite = visitante ? conviteDoCadastro(cardapio.fidelidade) : null;
  const qtdSacola = carrinho.reduce((n, i) => n + i.quantidade, 0);
  const iniciais = String(unidade.nome || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const prato = (p) => <CardPrato key={p.id} produto={p} qtd={naSacola.get(p.id)} onAbrir={onAbrirPrato} onAdicionar={onAdicionar} podePedir={podePedir} idioma={idioma} T={T} />;

  return (
    <div className={s.casca} lang={idioma}>
      <aside className={s.lateral} aria-label={T("recomendacoes")}>
        <div className={s.marca}>
          <div className={s.logo} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {tema.logo_url ? <img src={tema.logo_url} alt="" className={s.logoImagem} /> : iniciais}
          </div>
          <div className={s.marcaTextos}>
            <span className={s.marcaNome}>{unidade.nome}</span>
            {mesa ? <span className={s.marcaMesa}>{T("mesa_n", { n: mesa })}</span> : null}
          </div>
        </div>
        {temRecomendar ? (
          <button type="button" className={s.recomendar} onClick={onRecomendar}>
            <Icone nome="estrela" tamanho={18} />
            <span className={s.recomendarTextos}><span className={s.recomendarTitulo}>{T("recomendacoes")}</span><span className={s.recomendarSub}>{T("o_que_quer")}</span></span>
          </button>
        ) : null}
        <nav className={s.categorias} aria-label="Categorias">
          {cardapio.categorias.map((c) => {
            const atual = !filtrando && secaoAtiva === c.id;
            return (
              <button key={c.id} type="button" aria-current={atual ? "true" : undefined} className={`${s.categoria} ${atual ? s.categoriaAtual : ""}`} onClick={() => onIrSecao(c.id)}>
                <span>{c.nome}</span><span className={s.categoriaQtd}>{c.produto_ids.length}</span>
              </button>
            );
          })}
        </nav>
        <div className={s.lateralPe}>
          {mesa && onChamar ? <button type="button" className={s.acaoLateral} onClick={onChamar}><Icone nome="sino" tamanho={18} />{T("chamar_garcom")}</button> : null}
          {temIdiomas || onWifi ? (
            <div className={s.acoesPequenas}>
              {temIdiomas ? <button type="button" className={s.acaoLateral} onClick={onAbrirIdiomas} aria-label="Idioma · Language"><Icone nome="globo" tamanho={18} />{T("idioma_botao")}</button> : null}
              {onWifi ? <button type="button" className={s.acaoLateral} onClick={onWifi}><Icone nome="wifi" tamanho={18} />Wi-Fi</button> : null}
            </div>
          ) : null}
        </div>
      </aside>

      <main className={s.conteudo}>
        <div className={s.topo}>
          <label className={s.busca}>
            <Icone nome="busca" tamanho={18} />
            <input type="search" value={busca} onChange={(e) => onBusca(e.target.value.slice(0, 60))} placeholder={T("buscar_prato")} aria-label={T("buscar_prato")} enterKeyHint="search" />
          </label>
          {cardapio.filtros?.length ? (
            <div className={s.filtroCaixa}>
              <button type="button" className={`${s.filtro} ${selos.length ? s.filtroAtivo : ""}`} aria-expanded={filtroAberto} onClick={() => setFiltroAberto((v) => !v)}>
                <Icone nome="filtro" tamanho={18} />{T("filtrar_alergenicos")}{selos.length ? ` · ${selos.length}` : ""}
              </button>
              {filtroAberto ? (
                <div className={s.filtroLista} role="group" aria-label={T("filtrar_alergenicos")}>
                  {cardapio.filtros.map((f) => {
                    const ativo = selos.includes(f.id);
                    return (
                      <label key={f.id} className={s.filtroOpcao}>
                        <input type="checkbox" checked={ativo} onChange={() => onSelos(ativo ? selos.filter((x) => x !== f.id) : [...selos, f.id])} />
                        {f.rotulo}<span className={s.categoriaQtd}>{f.total}</span>
                      </label>
                    );
                  })}
                  {selos.length ? <button type="button" className={s.limpar} onClick={() => onSelos([])}>{T("limpar_filtros")}</button> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {offline ? <div className={s.aviso} role="status">{offline}</div> : null}

        {!filtrando && convite ? (
          <ConviteDesconto
            layout="tablet" idioma={idioma} percentual={convite.percentual} href={onConvite ? undefined : linkCadastro} onClick={onConvite}
            rotulo={T("para_casa")} titulo={T("cadastre_ganhe")} acao={T("quero")}
            texto={[convite.todos ? T("todos_pedidos") : T("primeiro_pedido"), convite.pontos ? T("ponto") : ""].filter(Boolean).join(" · ")}
            rotuloAcessivel={`${T("cadastre_ganhe")} ${convite.percentual}`}
          />
        ) : null}

        {!filtrando && banners ? <div className={s.banners}>{banners}</div> : null}

        {!filtrando && agora.length ? (
          <CarrosselAgora variante="tablet" idioma={idioma} titulo={T("agora_na_casa")} nota={T("atualiza_horario")}
            itens={agora.map((a) => ({
              ...a, onClick: () => onAbrirPrato(a.produto_id),
              detalhe: a.de ? `${formatarPreco(a.de, idioma)} → ${formatarPreco(a.preco, idioma)}` : formatarPreco(a.preco, idioma),
            }))} />
        ) : null}

        {filtrando ? (
          <section className={s.secao} id="resultado">
            {resultados.length ? <div className={s.grade}>{resultados.map(prato)}</div> : <div className={s.vazio}>{T("nada")}</div>}
          </section>
        ) : cardapio.categorias.length ? (
          cardapio.categorias.map((c) => (
            <section key={c.id} id={`secao-${c.id}`} data-secao={c.id} className={s.secao} aria-labelledby={`titulo-${c.id}`}>
              <h2 className={s.secaoTitulo} id={`titulo-${c.id}`}>{c.nome}</h2>
              <div className={s.grade}>{c.produto_ids.map((id) => (porId.get(id) ? prato(porId.get(id)) : null))}</div>
            </section>
          ))
        ) : <div className={s.vazio}>{T("sem_pratos")}</div>}

        {cardapio.textos?.rodape ? <p className={s.rodape} style={{ whiteSpace: "pre-line" }}>{cardapio.textos.rodape}</p> : null}
      </main>

      <div className={s.flutuantes}>
        {acompanhamento ? (
          <button type="button" className={s.acompanha} onClick={onAbrirPedidos}>
            <span className={s.acompanhaTopo}><strong>{mesa ? T("pedido_n_mesa", { mesa }) : T("pedidos")}</strong>{acompanhamento.hora ? <span className={s.acompanhaHora}>{acompanhamento.hora}</span> : null}</span>
            <span className={s.acompanhaLinha}>
              <span className={`${s.acompanhaPonto} ${acompanhamento.pronto ? s.acompanhaPronto : ""}`} aria-hidden="true" />
              <span className={s.acompanhaItens}>{acompanhamento.itens}</span>
              <strong className={acompanhamento.pronto ? s.acompanhaTextoPronto : s.acompanhaTextoPreparo}>{acompanhamento.etapa}</strong>
            </span>
            <span className={s.acompanhaNota}>{T("some_quando_pronto")}</span>
          </button>
        ) : null}
        {podePedir && qtdSacola > 0 ? (
          <button type="button" className={s.sacola} onClick={onAbrirSacola} data-sacola="">
            <span className={s.sacolaQtd}>{qtdSacola}</span>{T("ver_pedido_mesa")}<span className={s.sacolaTotal}>{formatarPreco(totalSacola, idioma)}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
