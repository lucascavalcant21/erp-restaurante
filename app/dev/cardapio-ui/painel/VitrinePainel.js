"use client";

import { useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import PainelCardapio from "../../../components/cardapio-digital/painel/PainelCardapio";

// Dados de exemplo do protótipo PainelCardapio (Casa Brasa), para comparação.
const MENU = ["Dashboard", "Clientes (CRM)", "Disparos WhatsApp", "Campanhas automáticas", "Cardápio", "Promoções e descontos", "Recomendações",
  "Fidelidade e selos", "Menu degustação", "Vitrine e banners", "Nossa história", "Idiomas", "Configurações"]
  .map((rotulo) => ({ id: rotulo === "Cardápio" ? "cardapio" : rotulo, rotulo, href: "#" }));
const CATS = [["Destaques", 6], ["Entradas", 9], ["Grelhados", 8], ["Pratos do dia", 3], ["Massas", 7], ["Bebidas", 14], ["Drinks", 11], ["Sobremesas", 6]]
  .map(([nome, qtd]) => ({ id: nome, nome, qtd }));
const LINHAS = [
  { id: "1", nome: "Picanha na brasa", info: ["2 grupos de adicionais", "25 min", "vídeo"], preco: 89.9, promocao: "", canais: { tablet: true, qr: true, delivery: true }, esgotado: false },
  { id: "2", nome: "Costela no fogo de chão", info: ["1 grupo", "25 min", "vídeo"], preco: 94, promocao: "Prato do dia: R$ 79,90", canais: { tablet: true, qr: true, delivery: true }, esgotado: false },
  { id: "3", nome: "Frango ao chimichurri", info: ["1 grupo", "20 min", "pimenta média"], preco: 54.9, promocao: "", canais: { tablet: true, qr: true, delivery: false }, esgotado: false },
  { id: "4", nome: "Linguiça artesanal", info: ["sem adicionais", "15 min"], preco: 42, promocao: "", canais: { tablet: true, qr: true, delivery: true }, esgotado: true },
  { id: "5", nome: "Fraldinha [rascunho]", info: ["sem foto", "tradução pendente"], preco: 0, promocao: "", canais: { tablet: false, qr: false, delivery: false }, esgotado: false },
];

export default function VitrinePainel() {
  const [cats, setCats] = useState(CATS);
  const [linhas, setLinhas] = useState(LINHAS);
  const [canal, setCanal] = useState("todos");
  const [busca, setBusca] = useState("");
  return (
    <TemaCardapio style={{ minHeight: "100vh", display: "flex" }}>
      <PainelCardapio
        nomeLoja="Casa Brasa"
        itensMenu={MENU}
        categorias={cats}
        categoriaAtiva="Grelhados"
        linhas={linhas}
        titulo="Grelhados"
        resumo="Estação: Cozinha · aparece em Tablet, QR, Delivery"
        canal={canal}
        onCanal={setCanal}
        busca={busca}
        onBusca={setBusca}
        onLigar={(id, c, v) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, canais: { ...l.canais, [c]: v } } : l)))}
        onEsgotado={(id, v) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, esgotado: v } : l)))}
        onOrdenar={(ids) => setCats((cs) => ids.map((i) => cs.find((c) => c.id === i)))}
      />
    </TemaCardapio>
  );
}

