"use client";

import { useMemo } from "react";
import { formatarPreco } from "../../../lib/cardapio-digital.mjs";
import { conviteDoCadastro, itensAgoraNaCasa, quantidadesNaSacola } from "../../../lib/cardapio-delivery.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { BarraNavegacao, Card, CarrosselAgora, Chip, ConviteDesconto, FotoPrato, Icone, Preco } from "../ui";
import s from "./delivery.module.css";

// Início do delivery (protótipo DeliveryInicio, 9.2 da spec), celular primeiro.
// Só desenho: estado, carrinho, pedido e as folhas (prato, sacola, idiomas,
// meus pedidos, fidelidade) continuam no CardapioDigital, que passa tudo aqui.
//
// Do protótipo ainda não entram: Entrega | Retirada (a retirada chega com o
// checkout novo), tema escuro e a aba Perfil (área do cliente, etapa própria).

function CardPrato({ produto, qtd, onAbrir, idioma, T }) {
  const promo = produto.preco_original && produto.preco_original > produto.preco;
  return (
    <Card as="button" type="button" className={`${s.prato} ${produto.imagem_url ? s.pratoComFoto : ""}`} onClick={() => onAbrir(produto.id)} aria-label={produto.nome}>
      <span className={s.pratoTextos}>
        <span className={s.pratoNome}>{produto.nome}</span>
        {produto.descricao ? <span className={s.pratoDesc}>{produto.descricao}</span> : null}
        <span className={s.pratoPreco}>
          <Preco valor={produto.preco} de={promo ? produto.preco_original : undefined} tamanho={14} principal fonteTexto idioma={idioma} />
        </span>
        {qtd ? <span className={s.pratoQtd}>{T("no_pedido", { n: qtd })}</span> : null}
      </span>
      {produto.imagem_url ? (
        <FotoPrato src={produto.imagem_url} largura={118} raio={0} video={produto.midias?.some((m) => m.tipo === "video")} etiquetaPequena style={{ alignSelf: "stretch", height: "auto" }} />
      ) : null}
    </Card>
  );
}

export default function DeliveryInicio({
  cardapio, idioma = "pt", carrinho = [], totalSacola = 0, offline = "",
  secaoAtiva, busca = "", buscaAberta = false, onBusca, onAbrirBusca, onFecharBusca, resultados = [], filtrando = false,
  onAbrirPrato, onIrSecao, onAbrirSacola, onAbrirIdiomas, temIdiomas, onAbrirInfo, temInfo, onAjuda, temAjuda,
  onAbrirPedidos, qtdPedidos = 0, onAbrirDescontos, temDescontos, linkCadastro, visitante = true, podePedir = true,
  banners = null, mesa = "", onChamar, onConvite,
}) {
  // Mesa pelo QR no celular usa esta mesma tela: no lugar de aberto/entrega,
  // o número da mesa e o garçom; o convite abre a entrada por CPF (QREntrar).
  const T = (k, v) => textoDelivery(idioma, k, v);
  const { unidade, tema } = cardapio;
  const ent = cardapio.entrega || {};
  const porId = useMemo(() => new Map(cardapio.produtos.map((p) => [p.id, p])), [cardapio]);
  const naSacola = useMemo(() => quantidadesNaSacola(carrinho), [carrinho]);
  const agora = useMemo(() => itensAgoraNaCasa(cardapio, { rotuloDestaque: T("destaque") }), [cardapio, idioma]); // eslint-disable-line react-hooks/exhaustive-deps
  const convite = visitante ? conviteDoCadastro(cardapio.fidelidade) : null;
  const qtdSacola = carrinho.reduce((n, i) => n + i.quantidade, 0);
  // Banners do dono (fotos e vídeos que passam sozinhos, com zoom lento) vêm
  // prontos do CardapioDigital; sem banner, a capa da loja com zoom lento.
  const capa = tema.capa_url || "";
  const iniciaisLoja = String(unidade.nome || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const aberto = unidade.delivery_aberto;

  return (
    <div className={s.pagina} lang={idioma}>
      <div className={`${s.capa} ${banners ? s.capaComBanner : ""}`}>
        {banners || (capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={`${s.capaImagem} ${s.zoomLento}`} src={capa} alt="" />
        ) : (
          // Sem capa cadastrada: degradê na cor da casa, com brilho andando devagar.
          <span className={s.capaSemFoto} aria-hidden="true"><span className={s.capaBrilho} /></span>
        ))}
        <div className={s.capaBotoes}>
          {temIdiomas ? (
            <button type="button" className={s.idioma} onClick={onAbrirIdiomas} aria-label="Idioma · Language">
              <Icone nome="globo" tamanho={18} />{idioma.toUpperCase()}
            </button>
          ) : null}
        </div>
      </div>

      <div className={s.loja}>
        <div className={s.lojaLinha}>
          <div className={s.logo} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {tema.logo_url ? <img className={s.logoImagem} src={tema.logo_url} alt="" /> : iniciaisLoja}
          </div>
          <div className={s.lojaTextos}>
            <h1 className={s.lojaNome}>{unidade.nome}</h1>
            {mesa ? (
              <span className={s.status}><span className={s.statusPonto} aria-hidden="true" />{T("mesa_n", { n: mesa })}</span>
            ) : (
              <span className={`${s.status} ${aberto ? "" : s.statusFechado}`}>
                <span className={s.statusPonto} aria-hidden="true" />
                {aberto ? T("aberto") : T("fechado")}{unidade.horario ? ` · ${unidade.horario}` : ""}
              </span>
            )}
          </div>
          {temInfo ? (
            <button type="button" className={s.info} onClick={onAbrirInfo}><Icone nome="info" tamanho={16} />{T("info")}</button>
          ) : null}
        </div>
        {mesa ? (
          onChamar ? (
            <button type="button" className={s.chamar} onClick={onChamar}><Icone nome="sino" tamanho={18} />{T("chamar_garcom")}</button>
          ) : null
        ) : (
          <div className={s.entrega}>
            <span className={unidade.taxa_entrega > 0 ? "" : s.entregaForte}>
              {unidade.taxa_entrega > 0 ? T("taxa", { valor: formatarPreco(unidade.taxa_entrega, idioma) }) : T("entrega_gratis")}
            </span>
            {ent.tempo_min && ent.tempo_max ? <span>{T("tempo", { min: ent.tempo_min, max: ent.tempo_max })}</span> : null}
            {ent.pedido_minimo > 0 ? <span>{T("minimo", { valor: formatarPreco(ent.pedido_minimo, idioma) })}</span> : null}
          </div>
        )}
      </div>

      <div className={s.corpo}>
        {offline ? <div className={s.aviso} role="status">{offline}</div> : null}

        {convite ? (
          <ConviteDesconto
            layout="celular" idioma={idioma} percentual={convite.percentual} href={onConvite ? undefined : linkCadastro} onClick={onConvite}
            rotulo={T("para_casa")} titulo={T("cadastre_ganhe")} acao={T("quero")}
            texto={[convite.todos ? T("todos_pedidos") : T("primeiro_pedido"), convite.pontos ? T("ponto") : ""].filter(Boolean).join(" · ")}
            rotuloAcessivel={`${T("cadastre_ganhe")} ${convite.percentual}`}
          />
        ) : null}

        {agora.length ? (
          <CarrosselAgora
            variante="celular" idioma={idioma} titulo={T("agora_na_casa")}
            itens={agora.map((a) => ({ ...a, onClick: () => onAbrirPrato(a.produto_id) }))}
          />
        ) : null}

        <div className={s.chips} role="toolbar" aria-label="Categorias">
          {buscaAberta ? (
            <>
              <label className={s.busca}>
                <Icone nome="busca" tamanho={18} />
                <input type="search" autoFocus value={busca} onChange={(e) => onBusca(e.target.value.slice(0, 60))} placeholder={T("buscar")} aria-label={T("buscar")} enterKeyHint="search" />
              </label>
              <button type="button" className={s.fecharBusca} onClick={onFecharBusca}>{T("fechar")}</button>
            </>
          ) : (
            <>
              <Chip aria-label={T("buscar")} onClick={onAbrirBusca} style={{ width: 44, padding: 0, height: 40 }}><Icone nome="busca" tamanho={18} /></Chip>
              {temAjuda ? <Chip claro icone="brilho" onClick={onAjuda}>{T("me_ajuda")}</Chip> : null}
              {cardapio.categorias.map((c) => (
                <Chip key={c.id} selecionado={secaoAtiva === c.id} onClick={() => onIrSecao(c.id)}>{c.nome}</Chip>
              ))}
            </>
          )}
        </div>

        {filtrando ? (
          <section className={s.secao} id="resultado">
            {resultados.length
              ? resultados.map((p) => <CardPrato key={p.id} produto={p} qtd={naSacola.get(p.id)} onAbrir={onAbrirPrato} idioma={idioma} T={T} />)
              : <div className={s.vazio}>{T("nada")}</div>}
          </section>
        ) : cardapio.categorias.length ? (
          cardapio.categorias.map((c) => (
            <section key={c.id} id={`secao-${c.id}`} data-secao={c.id} className={s.secao} aria-labelledby={`titulo-${c.id}`}>
              <h2 className={s.secaoTitulo} id={`titulo-${c.id}`}>{c.nome}</h2>
              {c.produto_ids.map((id) => (porId.get(id)
                ? <CardPrato key={id} produto={porId.get(id)} qtd={naSacola.get(id)} onAbrir={onAbrirPrato} idioma={idioma} T={T} />
                : null))}
            </section>
          ))
        ) : (
          <div className={s.vazio}>{T("sem_pratos")}</div>
        )}

        {cardapio.textos?.rodape ? <p className={s.rodape} style={{ whiteSpace: "pre-line" }}>{cardapio.textos.rodape}</p> : null}
      </div>

      <div className={s.base}>
        <div className={s.baseCaixa}>
          {podePedir && qtdSacola > 0 ? (
            <button type="button" className={s.sacola} onClick={onAbrirSacola} data-sacola="">
              <span className={s.sacolaEsq}><span className={s.sacolaQtd}>{qtdSacola}</span>{T("ver_sacola")}</span>
              <span>{formatarPreco(totalSacola, idioma)}</span>
            </button>
          ) : null}
          <div className={s.barra}>
            <BarraNavegacao itens={[
              { rotulo: T("inicio"), icone: "casa", atual: true, onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
              { rotulo: T("pedidos"), icone: "pedidos", onClick: onAbrirPedidos, contador: qtdPedidos || undefined },
              ...(mesa && onChamar ? [{ rotulo: T("garcom_curto"), icone: "sino", onClick: onChamar }] : []),
              ...(!mesa && temDescontos ? [{ rotulo: T("descontos"), icone: "descontos", onClick: onAbrirDescontos }] : []),
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}
