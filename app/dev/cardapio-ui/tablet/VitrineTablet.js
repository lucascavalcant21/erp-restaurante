"use client";

import { useEffect, useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import TabletInicio from "../../../components/cardapio-digital/tablet/TabletInicio";
import TabletDetalhe from "../../../components/cardapio-digital/tablet/TabletDetalhe";

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
    { id: "bebidas", nome: "Bebidas", papel: "bebida", produto_ids: ["chope", "cachaca"] },
    { id: "sobremesas", nome: "Sobremesas", papel: "sobremesa", produto_ids: ["pudim"] },
  ],
  produtos: [
    { id: "picanha", nome: "Picanha na brasa", descricao: "300 g com farofa da casa, vinagrete e mandioca frita.", preco: 89.9, selos: [], midias: [{ tipo: "video" }] },
    { id: "costela", nome: "Costela no fogo de chão", descricao: "500 g desfiando, servida com mandioca cozida.", preco: 94, selos: ["sem_gluten"], midias: [{ tipo: "video" }] },
    { id: "frango", nome: "Frango ao chimichurri", descricao: "Sobrecoxa grelhada com chimichurri apimentado.", preco: 54.9, selos: ["sem_lactose", "picante"] },
    { id: "linguica", nome: "Linguiça artesanal", descricao: "Linguiça da casa na brasa.", preco: 42, selos: [] },
    { id: "feijoada", nome: "Feijoada completa", preco: 49.9, selos: [], destaque: true },
    { id: "chope", nome: "Chope em dobro", preco: 14, selos: [], destaque: true },
    { id: "tacaca", nome: "Tacacá", descricao: "Caldo quente de tucupi com goma de tapioca, jambu e camarão seco, servido na cuia como no Norte.", preco: 32, destaque: true,
      selos: ["sem_gluten", "sem_lactose"], alergenicos: ["Crustáceos"], midias: [{ tipo: "foto", url: "/dev-cardapio/tacaca.jpg" }, { tipo: "video", url: "" }],
      grupos: [
        { id: "tam", nome: "Tamanho", tipo: "adicional", min: 1, max: 1, opcoes: [{ id: "m", nome: "Cuia média", preco: 0 }, { id: "g", nome: "Cuia grande", preco: 10 }] },
        { id: "tur", nome: "Turbine seu Tacacá", tipo: "adicional", min: 0, max: 2, opcoes: [{ id: "c", nome: "Camarão extra", preco: 8 }, { id: "j", nome: "Mais jambu", preco: 4 }] },
      ] },
    { id: "cachaca", nome: "Cachaça de jambu", preco: 12, selos: [], categoria_id: "bebidas" },
    { id: "pudim", nome: "Pudim de leite", preco: 18, selos: [], categoria_id: "sobremesas" },
  ],
  promocoes: [],
  filtros: [{ id: "sem_gluten", rotulo: "Sem glúten", total: 1 }, { id: "sem_lactose", rotulo: "Sem lactose", total: 1 }],
  fidelidade: { cadastro: { desconto_pct: 10, aplica: "sempre" }, cashback: { percentual: 2 }, cartoes: [] },
};

export default function VitrineTablet() {
  const [busca, setBusca] = useState("");
  const [selos, setSelos] = useState([]);
  // ?escuro=1: tema escuro com fotos quadradas (a aparência que o dono escolhe).
  const [loja, setLoja] = useState(null);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("escuro") === "1") setLoja({ cor_fundo: "#121212", cor_cartao: "#1E1E1E", cor_texto: "#F5F5F5", formato_foto: "quadrada" }); }, []);
  const [prato, setPrato] = useState("");
  useEffect(() => { setPrato(new URLSearchParams(window.location.search).get("prato") || ""); }, []);
  return (
    <TemaCardapio cor="#14532D" loja={loja}>
      {prato ? <TabletDetalhe cardapio={CARDAPIO} produto={CARDAPIO.produtos.find((p) => p.id === prato)} mesa="12" onFechar={() => setPrato("")} onAdicionar={() => {}} /> : null}
      <TabletInicio cardapio={CARDAPIO} mesa="12" secaoAtiva="grelhados" busca={busca} onBusca={setBusca} selos={selos} onSelos={setSelos}
        onAbrirPrato={() => {}} onAdicionar={() => {}} onIrSecao={() => {}} onChamar={() => {}} onRecomendar={() => {}} temRecomendar temIdiomas
        acompanhamento={{ etapa: "Em preparação", pronto: false, hora: "20:14", itens: "Picanha na brasa, Chope em dobro" }} onAbrirPedidos={() => {}}
        linkCadastro="#" carrinho={[{ id: "picanha", quantidade: 1 }]} totalSacola={89.9} />
    </TemaCardapio>
  );
}
