"use client";

import { useEffect, useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import DeliveryInicio from "../../../components/cardapio-digital/delivery/DeliveryInicio";
import DeliverySacola from "../../../components/cardapio-digital/delivery/DeliverySacola";

// Sacola de exemplo (protótipo DeliveryCarrinho), em ?tela=sacola.
const SACOLA = {
  ...{ idioma: "pt", unidade: { nome: "Casa Brasa", delivery_aberto: true, taxa_entrega: 6 }, entrega: { pedido_minimo: 30 }, tema: { cor_primaria: "#14532D" }, textos: {}, banner: [], promocoes: [] },
  categorias: [
    { id: "g", nome: "Grelhados", papel: "comida", produto_ids: ["picanha", "tacaca"] },
    { id: "s", nome: "Sobremesas", papel: "sobremesa", produto_ids: ["pudim"] },
    { id: "b", nome: "Bebidas", papel: "bebida", produto_ids: ["cupuacu"] },
  ],
  produtos: [
    { id: "picanha", nome: "Picanha na brasa", preco: 89.9, categoria_id: "g" },
    { id: "tacaca", nome: "Tacacá", preco: 32, categoria_id: "g" },
    { id: "pudim", nome: "Pudim de leite", preco: 18, categoria_id: "s" },
    { id: "cupuacu", nome: "Suco de cupuaçu", preco: 12, categoria_id: "b" },
  ],
};
const CARRINHO = [{ id: "picanha", quantidade: 1, observacao: "Ao ponto · sem cebola" }, { id: "tacaca", quantidade: 1 }];

// Cardápio de exemplo no formato que o servidor manda (montarCardapioPublico),
// com os pratos e promoções do protótipo DeliveryInicio.
const EXEMPLO = {
  idioma: "pt",
  unidade: { nome: "Casa Brasa", delivery_aberto: true, taxa_entrega: 6, horario: "fecha às 23h" },
  entrega: { pedido_minimo: 30, gratis_acima: 0, tempo_min: 40, tempo_max: 50 },
  tema: { cor_primaria: "#14532D", capa_url: "", logo_url: "" },
  textos: {},
  banner: [],
  categorias: [
    { id: "grelhados", nome: "Grelhados", produto_ids: ["picanha", "frango"] },
    { id: "dia", nome: "Pratos do dia", produto_ids: ["feijoada"] },
    { id: "massas", nome: "Massas", produto_ids: [] },
    { id: "bebidas", nome: "Bebidas", produto_ids: ["chope"] },
  ],
  produtos: [
    { id: "picanha", nome: "Picanha na brasa", descricao: "300 g com farofa, vinagrete e mandioca frita.", preco: 89.9, imagem_url: "", midias: [] },
    { id: "frango", nome: "Frango ao chimichurri", descricao: "Sobrecoxa grelhada com chimichurri apimentado.", preco: 54.9, imagem_url: "" },
    { id: "tacaca", nome: "Tacacá", preco: 25.6, preco_original: 32, promocao_id: "terca", imagem_url: "/dev-cardapio/tacaca.jpg" },
    { id: "feijoada", nome: "Feijoada completa", preco: 49.9, destaque: true },
    { id: "combo", nome: "Picanha + refri", preco: 94.9, preco_original: 104.9, promocao_id: "combo" },
    { id: "pudim", nome: "Pudim de tapioca", preco: 18, destaque: true },
    { id: "chope", nome: "Chope em dobro", preco: 14, destaque: true },
  ],
  promocoes: [
    { id: "terca", tipo: "desconto", titulo: "Terça do Tacacá", produto_ids: ["tacaca"] },
    { id: "combo", tipo: "preco", titulo: "Combo", produto_ids: ["combo"] },
  ],
  fidelidade: { cadastro: { desconto_pct: 10, aplica: "sempre" }, cashback: { percentual: 2 }, cartoes: [] },
};

export default function VitrineDelivery() {
  const [cardapio, setCardapio] = useState(null);
  const [tela, setTela] = useState("");
  const [carrinho, setCarrinho] = useState(CARRINHO);
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setTela(q.get("tela") || "");
    const real = q.get("real") === "1";
    if (!real) { setCardapio(EXEMPLO); return; }
    fetch("/dev-cardapio/cardapio-real.json").then((r) => r.json()).then(setCardapio).catch(() => setCardapio(EXEMPLO));
  }, []);
  if (!cardapio) return null;
  if (tela === "sacola") {
    return (
      <TemaCardapio cor="#14532D">
        <DeliverySacola cardapio={SACOLA} carrinho={carrinho} onVoltar={() => {}} onContinuar={() => {}} onAbrirPrato={() => {}}
          alterarQtd={(id, d) => setCarrinho((c) => c.map((i) => (i.id === id ? { ...i, quantidade: i.quantidade + d } : i)))}
          remover={(id) => setCarrinho((c) => c.filter((i) => i.id !== id))}
          adicionar={(id) => setCarrinho((c) => [...c, { id, quantidade: 1 }])} />
      </TemaCardapio>
    );
  }
  const termo = busca.trim().toLowerCase();
  const resultados = termo ? cardapio.produtos.filter((p) => p.nome.toLowerCase().includes(termo)) : [];
  return (
    <TemaCardapio cor={cardapio.tema.cor_primaria} style={{ background: "#FFFFFF" }}>
      <DeliveryInicio
        cardapio={cardapio} carrinho={[{ id: cardapio.produtos[0]?.id, quantidade: 2 }]} totalSacola={116.9}
        busca={busca} buscaAberta={buscaAberta} onBusca={setBusca} onAbrirBusca={() => setBuscaAberta(true)}
        onFecharBusca={() => { setBusca(""); setBuscaAberta(false); }} resultados={resultados} filtrando={!!termo}
        secaoAtiva={cardapio.categorias[0]?.id} onAbrirPrato={() => {}} onIrSecao={() => {}} onAbrirSacola={() => {}}
        temIdiomas onAbrirIdiomas={() => {}} temInfo onAbrirInfo={() => {}} temAjuda onAjuda={() => {}}
        onAbrirPedidos={() => {}} temDescontos onAbrirDescontos={() => {}} qtdPedidos={0} linkCadastro="#" visitante
      />
    </TemaCardapio>
  );
}
