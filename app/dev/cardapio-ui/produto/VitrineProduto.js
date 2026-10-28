"use client";

import { useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import PainelProduto from "../../../components/cardapio-digital/painel/PainelProduto";
import { normalizarGrupos } from "../../../lib/cardapio-digital.mjs";

// Dados de exemplo do protótipo PainelProduto (Picanha na brasa), para comparação.
const MENU = ["Dashboard", "Clientes (CRM)", "Disparos WhatsApp", "Campanhas automáticas", "Cardápio", "Promoções e descontos", "Recomendações",
  "Fidelidade e selos", "Menu degustação", "Vitrine e banners", "Nossa história", "Idiomas", "Configurações"]
  .map((rotulo) => ({ id: rotulo === "Cardápio" ? "cardapio" : rotulo, rotulo, href: "#" }));
const cinza = (cor) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${cor}"/></svg>`)}`;
const GRUPOS = normalizarGrupos([
  { id: "ponto", nome: "Ponto da carne", min: 1, max: 1, opcoes: [{ nome: "Mal passado" }, { nome: "Ao ponto" }, { nome: "Bem passado" }] },
  { id: "adic", nome: "Adicionais", min: 0, max: 2, opcoes: [{ nome: "Queijo coalho", preco: 9, esgotado: true }, { nome: "Arroz biro-biro", preco: 12 }] },
  { id: "tirar", nome: "Retirar ingredientes", tipo: "retirar", max: 2, opcoes: [{ nome: "Sem cebola" }, { nome: "Sem vinagrete" }] },
]);
const TRAD = [["en", "English", "ok"], ["es", "Español", "ok"], ["it", "Italiano", "parcial"], ["fr", "Français", "parcial"], ["zh", "中文", "parcial"], ["ja", "日本語", "parcial"], ["ko", "한국어", "falta"]]
  .map(([idioma, nome, status]) => ({ idioma, nome, status, rotulo: { ok: "Traduzida", parcial: "Falta a descrição", falta: "Sem tradução" }[status] }));

export default function VitrineProduto() {
  const [form, setForm] = useState({
    nome: "Picanha na brasa",
    descricao: "300 g de picanha grelhada na brasa, servida com farofa da casa, vinagrete e mandioca frita. Serve 1 pessoa.",
    categoria_id: "g", tempo: "25",
    midias: [{ tipo: "foto", url: cinza("#4D4D4D") }, { tipo: "video", url: "" }, { tipo: "foto", url: cinza("#484848") }],
    grupos: ["ponto", "adic", "tirar"],
    canais: { tablet: true, qr: true, delivery: true },
    horario: { modo: "sempre", dias_semana: [], hora_inicio: "", hora_fim: "" },
    esgotado: false,
  });
  const [grupos, setGrupos] = useState(GRUPOS);
  return (
    <TemaCardapio style={{ minHeight: "100vh", display: "flex" }}>
      <PainelProduto
        nomeLoja="Casa Brasa" itensMenu={MENU} produto={{ nome_produto: "Picanha na brasa", preco_venda: 89.9 }} temFicha
        form={form} setForm={setForm} categorias={[{ id: "g", nome: "Grelhados" }]} estacao="cozinha"
        alergenicos={["Glúten"]} podeConter="" grupos={grupos} setGrupos={setGrupos} usos={{ ponto: 4, adic: 6, tirar: 9 }}
        traducoes={TRAD} onSalvar={() => {}} onEnviarArquivo={async () => ({ erro: "Só na tela de verdade." })} links={{}}
      />
    </TemaCardapio>
  );
}
