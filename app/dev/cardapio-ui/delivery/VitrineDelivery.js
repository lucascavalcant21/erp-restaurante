"use client";

import { useEffect, useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import DeliveryInicio from "../../../components/cardapio-digital/delivery/DeliveryInicio";
import DeliverySacola from "../../../components/cardapio-digital/delivery/DeliverySacola";
import DeliveryCheckout from "../../../components/cardapio-digital/delivery/DeliveryCheckout";
import DeliveryFidelidade from "../../../components/cardapio-digital/delivery/DeliveryFidelidade";
import ClienteArea from "../../../components/cardapio-digital/delivery/ClienteArea";
import { Abertura } from "../../../components/cardapio-digital/partes";
import antigo from "../../../components/cardapio-digital/cardapio.module.css";

// ?banner=1: os banners do dono (carrossel atual, com zoom lento) no topo.
const SLIDES = [
  { id: "b1", tipo: "imagem", url: "/dev-cardapio/tacaca.jpg", titulo: "Terça do Tacacá", texto: "Só hoje, com 20% de desconto", acao: null },
  { id: "b2", tipo: "imagem", url: "/dev-cardapio/tacaca.jpg", titulo: "Happy hour", texto: "Das 17h às 20h", acao: null },
];
const CORES_ANTIGAS = { "--c-primaria": "#14532d", "--c-sobre": "#fff", "--c-fundo": "#f4f4f4", "--c-texto": "#1a1a1a", "--c-suave": "#5c5c5c", "--c-cartao": "#fff", "--c-linha": "#e3e3e3", "--c-destaque": "#14532d", "--c-primaria-suave": "#eaf4ee" };

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
    setTela(q.get("banner") === "1" ? "banner" : q.get("tela") || "");
    const real = q.get("real") === "1";
    if (!real) { setCardapio(EXEMPLO); return; }
    fetch("/dev-cardapio/cardapio-real.json").then((r) => r.json()).then(setCardapio).catch(() => setCardapio(EXEMPLO));
  }, []);
  if (!cardapio) return null;
  if (tela === "checkout") return <VitrineCheckout />;
  if (tela === "fidelidade" || tela === "area") return <VitrineFidelidade tela={tela} />;
  if (tela === "sacola") {
    return (
      <TemaCardapio cor="#14532D">
        <DeliverySacola cardapio={SACOLA} carrinho={carrinho} incentivo={{ faltam: 1, percentual: 10, progresso: 0.66 }} onVoltar={() => {}} onContinuar={() => {}} onAbrirPrato={() => {}}
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
        banners={tela === "banner" ? <div className={antigo.capa} style={{ height: "100%", ...CORES_ANTIGAS }}><Abertura slides={SLIDES} onAcao={() => {}} previa={false} idioma="pt" /></div> : null}
      />
    </TemaCardapio>
  );
}

// Finalizar pedido de exemplo (protótipo DeliveryCheckout), em ?tela=checkout.
const CHECKOUT = { ...SACOLA, unidade: { ...SACOLA.unidade, endereco: "Rua das Mangueiras, 120 · Umarizal" }, entrega: { pedido_minimo: 30, tempo_min: 40, tempo_max: 50, retirada: true, formas: ["dinheiro", "cartao", "vale"] } };
function VitrineCheckout() {
  const [form, setForm] = useState({ nome: "Ana", telefone: "(91) 98888-7777", endereco: "Rua das Mangueiras, 120 · Umarizal", troco: "R$ 150,00" });
  const [tipo, setTipo] = useState("delivery");
  const [pagamento, setPagamento] = useState("dinheiro");
  return (
    <TemaCardapio cor="#14532D">
      <DeliveryCheckout cardapio={CHECKOUT} carrinho={CARRINHO} form={form} setForm={setForm} tipo={tipo} setTipo={setTipo}
        pagamento={pagamento} setPagamento={setPagamento} cashback={{ desconto: 11.09 }} onEnviar={() => {}} onVoltar={() => {}} />
    </TemaCardapio>
  );
}

// Minha fidelidade e Minha área de exemplo (protótipos DeliveryFidelidade e ClienteArea), em ?tela=fidelidade e ?tela=area.
const FID_CARDAPIO = {
  ...SACOLA,
  unidade: { ...SACOLA.unidade, nome: "Casa Brasa" },
  produtos: [
    { id: "tacaca", nome: "Tacacá", preco: 32 }, { id: "picanha", nome: "Picanha na brasa", preco: 89.9 },
    { id: "degust", nome: "Menu degustação", preco: 129 }, { id: "vatapa", nome: "Vatapá com arroz de jambu", preco: 58 },
    { id: "chope", nome: "Chope", preco: 14 }, { id: "pudim", nome: "Pudim", preco: 18 },
  ],
  fidelidade: {
    cartoes: [
      { id: "tacaca", nome: "Cartão Tacacá", selos: 6, por: "unidade", recompensa: "1 Tacacá", produto_ids: ["tacaca"] },
      { id: "hh", nome: "Cartão Happy hour", selos: 10, por: "unidade", recompensa: "1 porção", produto_ids: ["chope"] },
    ],
    cashback: { ativo: true, pontos_por_real: 1, valor_100: 2, percentual: 2 },
    cadastro: { desconto_pct: 20, aplica: "sempre" },
  },
};
const FID_STATUS = {
  identificado: true, disponivel: true, final: "7777", nome: "Manuela", cliente_desde: "2026-03-10T12:00:00Z",
  cartoes: { tacaca: { selos: 4 }, hh: { selos: 2 } }, cashback: { saldo: 22.4 },
  totais: { pedidos: 14, pago: 1163.2, desconto: 134.9, cashback_usado: 51.5 }, premios: {},
  pedidos: [
    { id: "p1", em: "2026-10-27T22:42:00Z", tipo: "qrcode", total: 141, economizou: 15.67, cashback: 2.82, selos: 1, itens: [{ id: "picanha", quantidade: 1 }, { id: "pudim", quantidade: 1 }] },
    { id: "p2", em: "2026-10-12T23:10:00Z", tipo: "delivery", total: 105.81, economizou: 11.09, cashback: 2.12, selos: 1, itens: [{ id: "tacaca", quantidade: 1 }, { id: "vatapa", quantidade: 1 }] },
  ],
};
function VitrineFidelidade({ tela }) {
  const Tela = tela === "area" ? ClienteArea : DeliveryFidelidade;
  return (
    <TemaCardapio cor="#14532D">
      <Tela cardapio={FID_CARDAPIO} status={FID_STATUS} onVoltar={() => {}} onPedir={() => {}} onAdicionar={() => {}} onPedirDeNovo={() => {}} onUsarCashback={() => {}} onArea={() => {}} />
    </TemaCardapio>
  );
}
