"use client";

import { useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import TabletInicio from "../../../components/cardapio-digital/tablet/TabletInicio";

// Tela principal do tablet com os dados de exemplo do protótipo Main (Casa
// Brasa, Mesa 12), só para comparar o desenho. A tela de verdade é o cardápio
// da mesa (/cardapio/<unidade>?mesa=N) num tablet.
const CARDAPIO = {
  idioma: "pt",
  unidade: { nome: "Casa Brasa" },
  tema: { cor_primaria: "#14532D", logo_url: "" },
  textos: {},
  entrega: {},
  categorias: [
    { id: "destaques", nome: "Destaques", produto_ids: ["picanha", "costela", "frango", "linguica", "feijoada", "chope"] },
    { id: "grelhados", nome: "Grelhados", produto_ids: ["picanha", "costela", "frango", "linguica"] },
    { id: "dia", nome: "Pratos do dia", produto_ids: ["feijoada"] },
    { id: "bebidas", nome: "Bebidas", produto_ids: ["chope"] },
  ],
  produtos: [
    { id: "picanha", nome: "Picanha na brasa", descricao: "300 g com farofa da casa, vinagrete e mandioca frita.", preco: 89.9, selos: [], midias: [{ tipo: "video" }] },
    { id: "costela", nome: "Costela no fogo de chão", descricao: "500 g desfiando, servida com mandioca cozida.", preco: 94, selos: ["sem_gluten"], midias: [{ tipo: "video" }] },
    { id: "frango", nome: "Frango ao chimichurri", descricao: "Sobrecoxa grelhada com chimichurri apimentado.", preco: 54.9, selos: ["sem_lactose", "picante"] },
    { id: "linguica", nome: "Linguiça artesanal", descricao: "Linguiça da casa na brasa.", preco: 42, selos: [] },
    { id: "feijoada", nome: "Feijoada completa", preco: 49.9, selos: [], destaque: true },
    { id: "chope", nome: "Chope em dobro", preco: 14, selos: [], destaque: true },
  ],
  promocoes: [],
  filtros: [{ id: "sem_gluten", rotulo: "Sem glúten", total: 1 }, { id: "sem_lactose", rotulo: "Sem lactose", total: 1 }],
  fidelidade: { cadastro: { desconto_pct: 10, aplica: "sempre" }, cashback: { percentual: 2 }, cartoes: [] },
};

export default function VitrineTablet() {
  const [busca, setBusca] = useState("");
  const [selos, setSelos] = useState([]);
  return (
    <TemaCardapio cor="#14532D">
      <TabletInicio cardapio={CARDAPIO} mesa="12" secaoAtiva="grelhados" busca={busca} onBusca={setBusca} selos={selos} onSelos={setSelos}
        onAbrirPrato={() => {}} onAdicionar={() => {}} onIrSecao={() => {}} onChamar={() => {}} onRecomendar={() => {}} temRecomendar temIdiomas
        acompanhamento={{ etapa: "Em preparação", pronto: false, hora: "20:14", itens: "Picanha na brasa, Chope em dobro" }} onAbrirPedidos={() => {}}
        linkCadastro="#" carrinho={[{ id: "picanha", quantidade: 1 }]} totalSacola={89.9} />
    </TemaCardapio>
  );
}
