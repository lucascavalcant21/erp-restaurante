"use client";

// Painel → Cardápio: produtos por seção, liga/desliga por canal (Tablet, QR
// mesa, Delivery) e "Esgotado hoje" (protótipo PainelCardapio, 9K.1).
// Lê produtos de venda + fichas técnicas e grava só na vitrine do dono
// (cardapio-painel-dados.js). O que muda aqui o cliente vê na próxima vez que
// o cardápio dele se atualizar (até 2 minutos) e o servidor já cobra assim.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import PainelCardapio from "../../../components/cardapio-digital/painel/PainelCardapio";
import { caminhoDoCardapio } from "../../../lib/cardapio-link.mjs";
import { filtrarLinhas, itemComCanal, itemEsgotado, montarPainelCardapio, reordenarCategorias, resumoDaSecao } from "../../../lib/cardapio-painel.mjs";
import { alterarItemDoCardapio, carregarPainelCardapio, salvarOrdemDasSecoes } from "../../../lib/cardapio-painel-dados";

const fotoDaFicha = (unidade) => (produtoId) => `/api/public/cardapio/${encodeURIComponent(unidade)}/foto/${encodeURIComponent(produtoId)}`;
const EDITOR = "/dashboard/operacao/cardapio";

// Aba da página única do Cardápio (/dashboard/operacao/cardapio). Grava direto no banco.
export default function AbaProdutos() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [categoria, setCategoria] = useState(null);
  const [canal, setCanal] = useState("todos");
  const [busca, setBusca] = useState("");
  const [ocupados, setOcupados] = useState(() => new Set());

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    const r = await carregarPainelCardapio(unidadeAtiva);
    if (r.erro) { setErro(r.erro); setDados(null); return; }
    setErro("");
    setDados(r);
  }, [unidadeAtiva]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);

  const tela = useMemo(() => (dados && unidadeAtiva
    ? montarPainelCardapio({ ...dados, fotoDaFicha: fotoDaFicha(unidadeAtiva) })
    : null), [dados, unidadeAtiva]);

  const aberta = tela && (tela.categorias.some((c) => c.id === categoria) ? categoria : tela.categorias.find((c) => c.qtd)?.id || tela.categorias[0]?.id);
  const linhas = tela ? filtrarLinhas(tela.linhas, { canal, busca, categoria: aberta }) : [];
  const daSecao = tela ? tela.linhas.filter((l) => l.categoria_id === aberta) : [];
  const titulo = busca.trim() ? `Resultados para “${busca.trim()}”` : tela?.categorias.find((c) => c.id === aberta)?.nome || "";

  // Muda na tela na hora e grava; se o banco recusar, volta como estava e avisa.
  const mudarItem = useCallback(async (produtoId, mudar) => {
    if (!dados) return;
    const antes = dados.config;
    const itens = { ...(antes.itens || {}) };
    itens[produtoId] = mudar(itens[produtoId] || {});
    setDados((d) => ({ ...d, config: { ...d.config, itens } }));
    setOcupados((o) => new Set(o).add(produtoId));
    const r = await alterarItemDoCardapio(unidadeAtiva, produtoId, mudar);
    setOcupados((o) => { const n = new Set(o); n.delete(produtoId); return n; });
    if (r.erro) {
      setErro(r.erro);
      setDados((d) => ({ ...d, config: antes }));
    } else {
      setErro("");
      setDados((d) => ({ ...d, config: r.config }));
    }
  }, [dados, unidadeAtiva]);

  const ordenar = useCallback(async (ids) => {
    if (!dados || !tela) return;
    const antes = dados.config;
    setDados((d) => ({ ...d, config: { ...d.config, categorias: reordenarCategorias(tela.categorias, ids) } }));
    const r = await salvarOrdemDasSecoes(unidadeAtiva, ids, dados);
    if (r.erro) { setErro(r.erro); setDados((d) => ({ ...d, config: antes })); }
    else { setErro(""); setDados((d) => ({ ...d, config: r.config })); }
  }, [dados, tela, unidadeAtiva]);

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <TemaCardapio><p style={{ padding: 24 }}>Escolha uma unidade no topo para ver o cardápio dela.</p></TemaCardapio>;
  }
  if (!tela) {
    return <TemaCardapio><p role={erro ? "alert" : undefined} style={{ padding: 24 }}>{erro || "Carregando o cardápio…"}</p></TemaCardapio>;
  }
  const semProdutos = !tela.linhas.length;
  return (
    <TemaCardapio style={{ display: "flex" }}>
      <PainelCardapio
        semMenu
        nomeLoja={unidadeInfo?.nome_fantasia || unidadeInfo?.nome || ""}
        categorias={tela.categorias}
        categoriaAtiva={aberta}
        onCategoria={(id) => { setCategoria(id); setBusca(""); }}
        linhas={linhas}
        titulo={titulo}
        resumo={busca.trim() ? "" : resumoDaSecao(daSecao)}
        canal={canal}
        onCanal={setCanal}
        busca={busca}
        onBusca={setBusca}
        onLigar={(id, c, ligado) => mudarItem(id, (item) => itemComCanal(item, c, ligado))}
        onEsgotado={(id, sim) => mudarItem(id, (item) => itemEsgotado(item, sim))}
        onOrdenar={ordenar}
        ocupados={ocupados}
        erro={erro}
        aviso={semProdutos ? "Nenhum produto de venda ativo nesta unidade. Cadastre em Produtos de venda ou crie a partir de uma ficha no editor do cardápio." : ""}
        links={{
          verCliente: caminhoDoCardapio(unidadeAtiva),
          novaCategoria: `${EDITOR}?aba=secoes`,
          novoProduto: `${EDITOR}?aba=pratos`,
          editar: (id) => `/dashboard/operacao/cardapio/produtos/${encodeURIComponent(id)}`,
        }}
      />
    </TemaCardapio>
  );
}
