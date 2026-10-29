"use client";

import { useMemo, useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import PainelPromocoes from "../../../components/cardapio-digital/painel/PainelPromocoes";
import { linhasDaLista, resumoDaLista } from "../../../lib/cardapio-promocoes-painel.mjs";

// Dados de exemplo do protótipo PainelPromocoes (Casa Brasa), para comparação.
// Na tela de verdade custo e preço vêm da ficha técnica e do cardápio.
const MENU = ["Dashboard", "Clientes (CRM)", "Disparos WhatsApp", "Campanhas automáticas", "Cardápio", "Promoções e descontos", "Recomendações",
  "Fidelidade e selos", "Menu degustação", "Vitrine e banners", "Nossa história", "Idiomas", "Configurações"]
  .map((rotulo) => ({ id: rotulo === "Promoções e descontos" ? "promocoes" : rotulo, rotulo, href: "#" }));
const PRODUTOS = [
  { id: "tacaca", nome: "Tacacá", preco: 50, categoria_id: "dia", busca: "tacaca" },
  { id: "chope", nome: "Chope 300 ml", preco: 14, categoria_id: "bebidas", busca: "chope" },
  { id: "costela", nome: "Costela no fogo de chão", preco: 94, categoria_id: "grelhados", busca: "costela" },
  { id: "pudim", nome: "Pudim de leite", preco: 18, categoria_id: "sobremesas", busca: "pudim" },
];
const CATS = [{ id: "dia", nome: "Pratos do dia", qtd: 1 }, { id: "bebidas", nome: "Bebidas", qtd: 1 }, { id: "grelhados", nome: "Grelhados", qtd: 1 }, { id: "sobremesas", nome: "Sobremesas", qtd: 1 }];
const CUSTOS = { tacaca: { cmv: 14, variaveisPct: 3 }, chope: { cmv: 3.6, variaveisPct: 3 }, costela: { cmv: 31, variaveisPct: 3 }, pudim: { cmv: 13.9, variaveisPct: 3 } };
const PROMOS = [
  { id: "hh", titulo: "Happy hour · chope em dobro", tipo: "leve_mais", pague: 1, leve: 2, produto_ids: ["chope"], dias_semana: [1, 2, 3, 4, 5], hora_inicio: "17:00", hora_fim: "20:00", canais: ["tablet", "qr"] },
  { id: "pd", titulo: "Prato do dia · Costela", tipo: "preco", preco_promocional: "79,90", produto_ids: ["costela"], dias_semana: [3] },
  { id: "fr", titulo: "Frete grátis acima de R$ 80", tipo: "frete_gratis", frete_minimo: "80", canais: ["delivery"] },
  { id: "sb", titulo: "Sobremesas no domingo", tipo: "desconto", desconto_pct: 15, produto_ids: ["pudim"], dias_semana: [0], ativa: false },
];

export default function VitrinePromocoes() {
  const [form, setForm] = useState({ id: "novo", titulo: "Pegue 1, leve 2 · Tacacá", tipo: "leve_mais", pague: 1, leve: 2, produto_ids: ["tacaca"],
    dias_semana: [1, 2, 3, 4, 5], hora_inicio: "17:00", hora_fim: "20:00", canais: ["tablet", "qr"], mostrar_agora: true, acumula_cadastro: false, ativa: true });
  const porId = useMemo(() => new Map(PRODUTOS.map((p) => [p.id, p])), []);
  const lista = linhasDaLista(PROMOS, { produtosPorId: porId, custos: CUSTOS, metaPct: 30, taxaEntrega: 6, agora: new Date("2026-10-26T18:30:00-03:00") });
  return (
    <TemaCardapio style={{ minHeight: "100vh", display: "flex" }}>
      <PainelPromocoes nomeLoja="Casa Brasa" itensMenu={MENU} lista={lista} resumo={resumoDaLista(lista)} form={form} setForm={setForm}
        produtos={PRODUTOS} categorias={CATS} custos={CUSTOS} metaPct={30} taxaEntrega={6} pctCadastro={10}
        fotoDe={(id) => (id === "tacaca" ? "/dev-cardapio/tacaca.jpg" : "")} onNova={() => {}} onEditar={() => {}} onAtivar={() => {}} onSalvar={() => {}} />
    </TemaCardapio>
  );
}
