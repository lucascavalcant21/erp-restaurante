"use client";

import { useRef, useState } from "react";
import { CANAIS_CARDAPIO, formatarPreco } from "../../../lib/cardapio-digital.mjs";
import { FILTROS_CANAL, mover } from "../../../lib/cardapio-painel.mjs";
import { Icone } from "../ui";
import MenuPainel from "./MenuPainel";
import s from "./painel.module.css";

// Painel → Cardápio (protótipo PainelCardapio). Só desenho e gestos: quem lê e
// grava é a página (dashboard/operacao/cardapio/produtos). Seções à esquerda
// (arrastar pela alça ou Alt + seta para ordenar), produtos da seção à direita
// com liga/desliga por canal e "Esgotado hoje".

const ROTULO_COLUNA = { tablet: "TABLET", qr: "QR", delivery: "DELIVERY" };

export default function PainelCardapio({
  nomeLoja, categorias = [], categoriaAtiva, onCategoria, linhas = [], titulo, resumo, canal = "todos", onCanal,
  busca = "", onBusca, onLigar, onEsgotado, onOrdenar, ocupados = new Set(), links = {}, aviso, erro, itensMenu,
}) {
  const [arraste, setArraste] = useState(null); // { de, para }
  const listaRef = useRef(null);
  const ordem = arraste ? mover(categorias, arraste.de, arraste.para) : categorias;

  const indiceSob = (y) => {
    const itens = [...(listaRef.current?.querySelectorAll("[data-indice]") || [])];
    for (const el of itens) {
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return Number(el.dataset.indice);
    }
    return Math.max(0, itens.length - 1);
  };
  const soltar = () => {
    if (arraste && arraste.de !== arraste.para) onOrdenar?.(mover(categorias, arraste.de, arraste.para).map((c) => c.id));
    setArraste(null);
  };

  return (
    <div className={s.raiz}>
      <MenuPainel atual="cardapio" nomeLoja={nomeLoja} itens={itensMenu} />
      <main className={s.conteudo}>
        <div className={s.topo}>
          <h1 className={s.titulo}>Cardápio</h1>
          <a href={links.verCliente || "#"} target="_blank" rel="noopener noreferrer" className={s.acao}>Ver como cliente</a>
          <a href={links.novaCategoria || "#"} className={s.acao}>+ Categoria</a>
          <a href={links.novoProduto || "#"} className={s.acaoPrincipal}>+ Produto</a>
        </div>

        <div className={s.filtros}>
          <label className={s.busca}>
            <Icone nome="busca" tamanho={18} />
            <input type="search" placeholder="Buscar produto ou ingrediente" aria-label="Buscar produto" value={busca} onChange={(e) => onBusca?.(e.target.value)} />
          </label>
          <span className={s.mostrarNo}>Mostrar no:</span>
          {FILTROS_CANAL.map((f) => (
            <button key={f.id} type="button" aria-pressed={canal === f.id} onClick={() => onCanal?.(f.id)}
              className={`${s.filtroCanal} ${canal === f.id ? s.filtroCanalSel : ""}`}>
              {f.rotulo}
            </button>
          ))}
        </div>

        {erro ? <div role="alert" className={s.erro}>{erro}</div> : null}
        {aviso ? <div className={s.aviso}>{aviso}</div> : null}

        <div className={s.corpo}>
          <section aria-label="Categorias" className={s.secoes} ref={listaRef}
            onPointerMove={(e) => { if (arraste) setArraste((a) => ({ ...a, para: indiceSob(e.clientY) })); }}
            onPointerUp={soltar} onPointerCancel={() => setArraste(null)}>
            <span className={s.secoesRotulo}>CATEGORIAS · arraste para ordenar</span>
            {ordem.map((c, i) => {
              const atual = c.id === categoriaAtiva;
              return (
                <button key={c.id} type="button" data-indice={i} aria-current={atual ? "true" : undefined}
                  className={`${s.secao} ${atual ? s.secaoAtual : ""} ${arraste && categorias[arraste.de]?.id === c.id ? s.secaoArrastando : ""}`}
                  onClick={() => onCategoria?.(c.id)}
                  onKeyDown={(e) => {
                    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                    e.preventDefault();
                    const para = e.key === "ArrowUp" ? i - 1 : i + 1;
                    if (para >= 0 && para < categorias.length) onOrdenar?.(mover(categorias, i, para).map((x) => x.id));
                  }}>
                  <span aria-hidden="true" className={s.alca}
                    onPointerDown={(e) => { e.preventDefault(); e.currentTarget.releasePointerCapture?.(e.pointerId); setArraste({ de: i, para: i }); }}>
                    ⋮⋮
                  </span>
                  <span className={s.secaoNome}>{c.nome}</span>
                  <span className={s.secaoQtd}>{c.qtd}</span>
                </button>
              );
            })}
          </section>

          <section aria-label="Produtos da categoria" className={s.produtos}>
            <div className={s.produtosTopo}>
              <h2 className={s.produtosTitulo}>{titulo}</h2>
              {resumo ? <span className={s.produtosResumo}>{resumo}</span> : null}
            </div>
            <div className={s.tabelaCaixa}>
              <table className={s.tabela}>
                <thead>
                  <tr>
                    <th>PRODUTO</th>
                    <th>PREÇO</th>
                    {CANAIS_CARDAPIO.map((c) => <th key={c.id}>{ROTULO_COLUNA[c.id]}</th>)}
                    <th>ESGOTADO HOJE</th>
                    <th><span className={s.semVisao}>Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((p) => {
                    const ocupado = ocupados.has(p.id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className={s.produto}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.foto ? <img className={s.miniatura} src={p.foto} alt="" loading="lazy" /> : <div className={s.miniatura} />}
                            <div className={s.produtoTextos}>
                              <span className={s.produtoNome}>{p.nome}</span>
                              {p.info.length ? <span className={s.produtoInfo}>{p.info.join(" · ")}</span> : null}
                            </div>
                          </div>
                        </td>
                        <td className={s.preco}>
                          <span className={s.precoValor}>{formatarPreco(p.preco)}</span>
                          {p.promocao ? <span className={s.precoPromo}>{p.promocao}</span> : null}
                        </td>
                        {CANAIS_CARDAPIO.map((c) => (
                          <td key={c.id}>
                            <label className={s.marcar}>
                              <input type="checkbox" checked={p.canais[c.id]} disabled={ocupado} aria-label={`${c.rotulo}: ${p.nome}`}
                                onChange={(e) => onLigar?.(p.id, c.id, e.target.checked)} />
                              {p.canais[c.id] ? "Ativo" : "Oculto"}
                            </label>
                          </td>
                        ))}
                        <td>
                          <label className={`${s.marcar} ${s.esgotado} ${p.esgotado ? s.esgotadoSim : ""}`}>
                            <input type="checkbox" checked={p.esgotado} disabled={ocupado} aria-label={`Esgotado hoje: ${p.nome}`}
                              onChange={(e) => onEsgotado?.(p.id, e.target.checked)} />
                            {p.esgotado ? "Esgotado" : "Disponível"}
                          </label>
                        </td>
                        <td className={s.direita}>
                          <a href={links.editar ? links.editar(p.id) : "#"} className={s.editar}>Editar</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!linhas.length ? <div className={s.vazio}>{busca ? "Nenhum produto com esse nome ou ingrediente." : "Nenhum produto nesta categoria."}</div> : null}
            </div>
            <span className={s.nota}>&quot;Esgotado hoje&quot; tira o prato de todos os canais até o fim do dia e volta sozinho amanhã.</span>
          </section>
        </div>
      </main>
    </div>
  );
}
