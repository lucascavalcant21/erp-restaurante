"use client";

function comprimirFotoParaIA(file, maxDim = 1000, qualidade = 0.70) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const b64 = canvas.toDataURL("image/jpeg", qualidade).split(",")[1] || "";
      resolve(b64);
    };
    img.onerror = reject;
    img.src = url;
  });
}

import { useState, useEffect, useMemo, useRef, Suspense, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  atualizarOrdemFicha, excluirFichasComVinculos, fetchFichas, fetchInsumos,
  registrarAuditoriaFichas, removerFicha, salvarFicha, salvarInsumo,
} from "../../../lib/operacao";
import { fetchEstoques, vincularItemEstoque } from "../../../lib/estoques-multiplos";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchEmbalagens, salvarEmbalagem } from "../../../lib/embalagens";
import { garantirFichaNoEstoquePreparo } from "../../../lib/estoques-multiplos";
import { chaveNomeMontagem, fetchMontagens, inserirMontagem } from "../../../lib/montagem";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, BookOpen, Calculator, Camera,
  CheckCircle2, CheckSquare2, ChevronLeft, ChevronRight, Copy, Download, Edit3,
  FileDown, FolderPlus, GripVertical, LayoutList, Loader2, Package, Plus, Printer, Save,
  Search, ShieldAlert, Sparkles, Trash2, UtensilsCrossed, Wine, X,
  Clock, Thermometer, MoreVertical,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { logoSeldeestrelaSVG } from "../../../lib/marca";
import { baixarPdfDeHtml } from "../../../lib/pdf";
import { fetchHistoricoCustoFicha, registrarCustoFicha } from "../../../lib/ficha-custos";
import { rotuloPesoUnitario, rotuloVolumeUnitario, volumeUnitarioMl } from "../../../lib/ingredientes-utils.mjs";
import { fetchCategoriasFichas, salvarCategoriasFichas } from "../../../lib/parametros";
import {
  estimarPaginasDocumento,
  ordenarFichasDocumento,
} from "../../../lib/fichas-lote-utils.mjs";

// Botão "Fechar" + fechamento automático após imprimir — no celular a aba de
// impressão ficava presa e o usuário não conseguia voltar ao app.
function comFecharImpressao(html) {
  const extra = `
    <style>@media print{.__fechar-imp{display:none!important}}</style>
    <button class="__fechar-imp" onclick="window.close()" style="position:fixed;top:10px;right:10px;z-index:2147483647;padding:12px 18px;font:700 15px sans-serif;background:#0f172a;color:#fff;border:0;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer">✕ Fechar</button>
    <script>window.onafterprint=function(){setTimeout(function(){try{window.close()}catch(e){}},200)}<\/script>`;
  return html.includes("</body>") ? html.replace("</body>", extra + "</body>") : html + extra;
}

// Categorias oficiais da Cozinha na ordem exata solicitada pelo usuário
const CATEGORIAS_CARDAPIO = [
  "Prato principal 1 pessoa",
  "Prato principal 2 pessoas",
  "Entradas",
  "Sobremesas",
  "Acompanhamentos",
];

// Categorias oficiais do Bar na ordem exata solicitada pelo usuário (incluindo Chopp no barril, águas, refrigerantes e bombons)
const CATEGORIAS_BAR = [
  "Cervejas",
  "Destilados",
  "Vinhos",
  "Chopp",
  "Água",
  "Refrigerantes",
  "Bombons",
];

const CATEGORIAS_PREPARO_BAR = ["Xaropes", "Espumas", "Geleias", "Mixes e infusões", "Outros pré-preparos"];

// Método do drink. Batido e mexido não são estilo: mudam o resultado no copo —
// o shaker aera, gela e dilui mais; o mixing glass mantém o drink límpido e
// com corpo. Quem monta no balcão precisa disso escrito, não subentendido.
const METODOS_BAR = [
  { id: "batido", nome: "Batido (shaker)" },
  { id: "mexido", nome: "Mexido (mixing glass)" },
  { id: "montado", nome: "Montado no copo" },
  { id: "liquidificador", nome: "Liquidificador" },
  { id: "dose", nome: "Dose pura" },
];
const metodoBar = (id) => METODOS_BAR.find(m => m.id === id) || null;
const CATEGORIAS_PREPARO_COZINHA = [
  "Molhos e caldos",
  "Arroz, feijão e grãos",
  "Massas e recheios",
  "Carnes e proteínas",
  "Guarnições e acompanhamentos",
  "Sobremesas e bases doces",
  "Outros preparos",
];
const CATEGORIAS_PRODUTO_PRONTO_BAR = ["Cervejas", "Destilados", "Vinhos", "Chopp", "Água", "Refrigerantes", "Bombons", "Outros produtos prontos"];

function obterTodasCategoriasFicha(deptUrl, fichas = []) {
  const base = deptUrl === "bar" ? CATEGORIAS_BAR : CATEGORIAS_CARDAPIO;
  let custom = [];
  try {
    const salvas = typeof window !== "undefined" ? localStorage.getItem(`custom_categorias_fichas_${deptUrl || "cozinha"}`) : null;
    custom = salvas ? JSON.parse(salvas) : [];
  } catch {}
  let excluidas = [];
  try {
    const exc = typeof window !== "undefined" ? localStorage.getItem(`excluidas_categorias_fichas_${deptUrl || "cozinha"}`) : null;
    excluidas = exc ? JSON.parse(exc) : [];
  } catch {}

  const vindosDasFichas = fichas.map(f => f.categoria).filter(Boolean);
  const todas = [...new Set([...base, ...custom, ...vindosDasFichas])].filter(c => !excluidas.includes(c));

  return todas.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function salvarNovaCategoriaFicha(novaCat, deptUrl) {
  const cat = String(novaCat || "").trim();
  if (!cat) return;
  try {
    const key = `custom_categorias_fichas_${deptUrl || "cozinha"}`;
    const salvas = localStorage.getItem(key);
    const atuais = salvas ? JSON.parse(salvas) : [];
    if (!atuais.includes(cat)) {
      localStorage.setItem(key, JSON.stringify([...atuais, cat]));
    }
  } catch {}
}

function excluirCategoriaFicha(catExcluir, deptUrl) {
  const cat = String(catExcluir || "").trim();
  if (!cat) return;
  const dept = deptUrl || "cozinha";
  try {
    const keyCustom = `custom_categorias_fichas_${dept}`;
    const salvas = localStorage.getItem(keyCustom);
    const atuais = salvas ? JSON.parse(salvas) : [];
    localStorage.setItem(keyCustom, JSON.stringify(atuais.filter(c => c !== cat)));

    const keyExc = `excluidas_categorias_fichas_${dept}`;
    const excSalvas = localStorage.getItem(keyExc);
    const excAtuais = excSalvas ? JSON.parse(excSalvas) : [];
    if (!excAtuais.includes(cat)) {
      localStorage.setItem(keyExc, JSON.stringify([...excAtuais, cat]));
    }
  } catch {}
}

function categoriaPreparoBar(ficha) {
  if (CATEGORIAS_PREPARO_BAR.includes(ficha?.categoria)) return ficha.categoria;
  const texto = normalizarNome(`${ficha?.categoria || ""} ${ficha?.nome_receita || ""}`);
  if (texto.includes("xarope")) return "Xaropes";
  if (texto.includes("espuma")) return "Espumas";
  if (texto.includes("geleia")) return "Geleias";
  if (texto.includes("mix") || texto.includes("infus")) return "Mixes e infusões";
  return "Outros pré-preparos";
}

// Converte um File de imagem em base64 puro (sem o prefixo "data:...;base64,")
// Comprime a foto antes de enviar: celulares tiram fotos de 5-10MB, que estouram
// o limite de ~4,5MB da Vercel e faziam a IA "sempre dar erro". Reduz para no
// máximo 1800px (nitidez suficiente para ler cardápio/receita) em JPEG 85%.
function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          const MAX = 1800;
          if (w > h && w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
          else if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1] || "");
        } catch {
          resolve(String(ev.target.result).split(",")[1] || "");
        }
      };
      img.onerror = () => resolve(String(ev.target.result).split(",")[1] || "");
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Normaliza texto pra comparação de nomes (minúsculo, sem acento, sem espaço extra)
const REGEX_DIACRITICOS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");
function normalizarNome(s) {
  const semAcento = String(s || "").toLowerCase().normalize("NFD").replace(REGEX_DIACRITICOS, "");
  return semAcento.trim();
}

// Converte uma quantidade lida (na unidade da receita) para a unidade-base do insumo vinculado
function converterParaBase(quantidadeLida, unidadeLida, unidadeBaseInsumo) {
  if (unidadeLida === unidadeBaseInsumo) return quantidadeLida;
  if (unidadeLida === "g" && unidadeBaseInsumo === "kg") return quantidadeLida / 1000;
  if (unidadeLida === "ml" && unidadeBaseInsumo === "l") return quantidadeLida / 1000;
  if (unidadeLida === "kg" && unidadeBaseInsumo === "g") return quantidadeLida * 1000;
  if (unidadeLida === "l" && unidadeBaseInsumo === "ml") return quantidadeLida * 1000;
  return quantidadeLida; // unidades incompatíveis — usa como veio, revisável na tela
}

// Sub-unidades para lançamento em ficha. O custo do insumo é por unidade-base
// (R$/kg, R$/L). Em receita pensamos em g/ml, então convertemos: 1 base = `f` sub.
// Ex: kg → g (f=1000). Insumos em "un" não têm sub-unidade.
const SUB_UNIDADES = {
  kg: { sub: "g",  f: 1000 },
  l:  { sub: "ml", f: 1000 },
};
const getSub = (unidade) => SUB_UNIDADES[String(unidade || "").toLowerCase()] || null;

// A perda informa quanto da compra não vira produto aproveitável. Por isso o
// custo correto é dividido pelo rendimento: R$ 39,90 com 30% de perda =
// 39,90 / 0,70 = R$ 57,00 por kg útil (e não 39,90 × 1,30).
function multiplicadorPerda(percentual) {
  const perda = Math.min(99.99, Math.max(0, Number(percentual) || 0));
  return 1 / (1 - perda / 100);
}

// Custo unitário efetivo do ingrediente. Empanados ganham peso (ganho_pct) e
// somam o custo do empanamento (custo_empanado_kg, por kg final). Só faz sentido
// em peso (g/kg); em outras unidades usa o custo base.
function custoUnitEfetivo(ins) {
  const base = Number(ins?.custo_unitario) || 0;
  if (!ins?.empanado) return base;
  const ganho = 1 + (Number(ins.ganho_pct) || 0) / 100;
  const u = String(ins.unidade_medida || "").toLowerCase();
  const empKg = Number(ins.custo_empanado_kg) || 0;
  const empNaUnidade = u === "g" ? empKg / 1000 : u === "kg" ? empKg : 0;
  return base / ganho + empNaUnidade;
}

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
// guard evita loop infinito se alguém criar uma referência circular.
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    // A quantidade da ficha é líquida/aproveitável; a compra bruta necessária
    // considera o percentual que será perdido no preparo.
    const fc = multiplicadorPerda(fi.insumos?.perda_pct || fi.fator_correcao);
    if (fi.insumos) {
      total += custoUnitEfetivo(fi.insumos) * (fi.quantidade || 0) * fc;
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, new Set(guard)) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0) * fc;
    }
  });
  return total + (Number(f.custo_embalagens_total) || 0);
}
// Custo por unidade-de-rendimento de uma base (usado quando ela vira ingrediente)
function custoUnitBase(base, todasFichas) {
  return custoTotalDaFicha(base, todasFichas) / (base.rendimento_porcoes || 1);
}

// Peso total produzido (g) a partir do rendimento + unidade + peso da porção
function pesoTotalDaFicha(rendimento, unidade, pesoPorcaoG) {
  const un = String(unidade || "porcao").toLowerCase();
  if (un === "kg" || un === "l") return rendimento * 1000;
  if (un === "g" || un === "ml") return rendimento;
  return pesoPorcaoG > 0 ? rendimento * pesoPorcaoG : 0; // porções ou unidades
}

// Base do custo por rótulo. Por dentro 1 ml conta como 1 g (densidade 1) para
// somar líquido e sólido na mesma conta, mas escrever "1 kg custa" numa receita
// medida em ml confunde quem lê: xarope se compra e se serve em volume. Quando
// a ficha não diz em que mede (rende em porções), vale o padrão do setor.
function baseCustoDaFicha(unidadeRendimento, padrao = "kg") {
  const un = String(unidadeRendimento || "").toLowerCase();
  if (un === "l" || un === "ml") return "L";
  if (un === "kg" || un === "g") return "kg";
  return padrao;
}

// Quantas embalagens a ficha consome: uma por porção servida. Quando o
// rendimento é em peso ou volume, o número de porções só existe se a ficha
// disser quanto pesa uma porção — 200 ml de rendimento não são 200 porções.
// Sem esse dado a receita conta como um lote só. Antes o número cru virava a
// quantidade de porções, e a embalagem era multiplicada pelo número de
// mililitros: uma tampa de R$ 1,60 somava R$ 320,00 ao custo da ficha.
function porcoesParaEmbalagem(rendimento, unidade, pesoPorcaoG) {
  const un = String(unidade || "porcao").toLowerCase();
  const rend = Number(rendimento) || 0;
  if (un === "porcao" || un === "un") return Math.max(1, rend);
  const pesoPorcao = Number(pesoPorcaoG) || 0;
  const pesoTotal = pesoTotalDaFicha(rend, un, pesoPorcao);
  return pesoPorcao > 0 && pesoTotal > 0 ? Math.max(1, pesoTotal / pesoPorcao) : 1;
}

// Info de peso de uma ficha: peso total produzido (g), custo por kg, peso por
// porção e QUANTAS porções renderam. Vale quando a ficha tem peso_porcao_g
// preenchido OU quando rende direto em peso/volume (kg/g/l/ml).
function infoPesoFicha(f, todasFichas) {
  const rendimento = Number(f.rendimento_porcoes) || 0;
  const pesoPorcao = Number(f.peso_porcao_g) || 0;
  const un = String(f.rendimento_unidade || "porcao").toLowerCase();
  const pesoTotalG = pesoTotalDaFicha(rendimento, un, pesoPorcao);
  if (!pesoTotalG || !rendimento) return null;
  const custoTotal = custoTotalDaFicha(f, todasFichas);
  // Nº de porções: direto do rendimento (porções/un) ou derivado do peso
  const porcoes = (un === "porcao" || un === "un")
    ? rendimento
    : (pesoPorcao > 0 ? pesoTotalG / pesoPorcao : null);
  return {
    pesoTotalG,
    custoKg: custoTotal / (pesoTotalG / 1000),
    custoPorcao: porcoes > 0 ? custoTotal / porcoes : null,
    pesoPorcaoG: pesoPorcao > 0 ? pesoPorcao : null,
    porcoes,
    liquido: un === "l" || un === "ml",
  };
}
// Insumo medido em g ou ml custa frações de centavo por unidade: R$ 1,00 a
// garrafa de 500 ml dá R$ 0,002/ml, que em duas casas vira "R$ 0,00" e parece
// custo zero. Mostramos por kg/L, que é o número do catálogo de ingredientes.
const fmtCustoUnitario = (custo, unidade) => {
  const un = String(unidade || "").toLowerCase();
  const valor = Number(custo) || 0;
  if (un === "g") return `${fmtBRL(valor * 1000)}/kg`;
  if (un === "ml") return `${fmtBRL(valor * 1000)}/L`;
  return `${fmtBRL(valor)}/${String(unidade || "").toUpperCase()}`;
};

const fmtG = (g) => g >= 1000
  ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`
  : `${(+g.toFixed(1)).toLocaleString("pt-BR")} g`;

// Como escrever o rendimento de uma ficha. Na cozinha tudo se pesa: a receita
// medida em ml ou L aparece em peso (1 ml conta como 1 g, a mesma densidade
// que o custo já usa por dentro), e a unidade acompanha o tamanho — gramas até
// 1 kg, kg daí para cima, como no resto do sistema. No bar a medida do balcão
// é volume, então L e ml continuam como foram cadastrados.
const MEDIDAS_DE_PESO = ["kg", "g", "l", "ml"];
function pesarNaCozinha(unidade, ehBar) {
  return !ehBar && MEDIDAS_DE_PESO.includes(String(unidade || "").toLowerCase());
}
function gramasRendimento(quantidade, unidade) {
  const un = String(unidade || "").toLowerCase();
  const qtd = Number(quantidade) || 0;
  return (un === "kg" || un === "l") ? qtd * 1000 : qtd;
}
function unidadeRendimento(unidade, ehBar, quantidade = 0) {
  const un = String(unidade || "porcao").toLowerCase();
  if (pesarNaCozinha(un, ehBar)) return gramasRendimento(quantidade, un) >= 1000 ? "kg" : "g";
  const umSo = Number(quantidade) === 1;
  return { porcao: ehBar ? (umSo ? "dose" : "doses") : (umSo ? "porção" : "porções"), kg: "kg", g: "g", l: "L", ml: "ml", un: "un" }[un] || un;
}
function textoRendimento(quantidade, unidade, ehBar) {
  const un = String(unidade || "porcao").toLowerCase();
  if (pesarNaCozinha(un, ehBar)) return fmtG(gramasRendimento(quantidade, un));
  const qtd = Number(quantidade) || 0;
  return `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} ${unidadeRendimento(un, ehBar, qtd)}`;
}

// Soma dos ingredientes → rendimento bruto estimado da receita (antes de perdas
// no cozimento). Separa sólidos (g) de líquidos (ml). Itens em "un" entram se o
// insumo tiver peso médio cadastrado (ex: 1 tomate ≈ 100g). Sugere a unidade
// conforme o que domina.
function rendimentoPelosIngredientes(ingLista) {
  let solidosG = 0, liquidosMl = 0;
  (ingLista || []).forEach(ing => {
    const u = String(ing.unidade || "").toLowerCase();
    const q = Number(ing.quantidade) || 0;
    const pm = Number(ing.peso_medio_g) || 0; // peso de 1 unidade, se conhecido
    if (u === "kg") solidosG += q * 1000;
    else if (u === "g") solidosG += q;
    else if (u === "l") liquidosMl += q * 1000;
    else if (u === "ml") liquidosMl += q;
    else if ((u === "un" || u === "unidade" || u === "porcao") && pm > 0) solidosG += q * pm;
    // Garrafa, lata e barril contam recipientes. Valem o que cabe dentro, se o
    // cadastro disser quanto é — 1 garrafa de 500 ml entra como 500 ml. Sem o
    // volume o item fica de fora, como o "un" sem peso médio.
    else if (volumeUnitarioMl(ing) > 0) liquidosMl += q * volumeUnitarioMl(ing);
  });
  const total = solidosG + liquidosMl;
  if (total <= 0) return null;
  const ehLiquido = liquidosMl > solidosG;
  const unidade = total >= 1000 ? (ehLiquido ? "l" : "kg") : (ehLiquido ? "ml" : "g");
  const valor = (unidade === "kg" || unidade === "l") ? total / 1000 : total;
  return { totalG: total, unidade, valor: Math.round(valor * 1000) / 1000, solidosG, liquidosMl };
}

// Detalhe por ingrediente: quanto de peso e custo cada um contribui na soma.
// pesoG = null quando o item não tem peso conhecido (fica fora do rendimento).
function detalheIngrediente(ing) {
  const u = String(ing.unidade || "").toLowerCase();
  const q = Number(ing.quantidade) || 0;
  const pm = Number(ing.peso_medio_g) || 0;
  let pesoG = null, liquido = false;
  if (u === "kg") pesoG = q * 1000;
  else if (u === "g") pesoG = q;
  else if (u === "l") { pesoG = q * 1000; liquido = true; }
  else if (u === "ml") { pesoG = q; liquido = true; }
  else if ((u === "un" || u === "unidade" || u === "porcao") && pm > 0) pesoG = q * pm;
  else if (volumeUnitarioMl(ing) > 0) { pesoG = q * volumeUnitarioMl(ing); liquido = true; }
  const custo = (Number(ing.custo_unitario) || 0) * q * multiplicadorPerda(ing.fator);
  // Preço por grama ≥ R$1 (= R$1000/kg): quase sempre é cadastro errado
  // (preço do pacote/maço salvo como preço da grama).
  const precoSuspeito = (u === "g" || u === "ml") && (Number(ing.custo_unitario) || 0) >= 1;
  return { pesoG, liquido, custo, precoSuspeito };
}

function FichasRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha"; // 'cozinha' ou 'bar'
  
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const [fichas, setFichas] = useState([]);
  const [montagens, setMontagens] = useState([]);
  const [produtos, setProdutos] = useState([]); // preços de venda (vêm do cardápio interno)
  const [insumosAtivos, setInsumosAtivos] = useState([]);
  const [embalagensCat, setEmbalagensCat] = useState([]); // catálogo de Embalagens (dept embalagens)
  const [embalagensEstoque, setEmbalagensEstoque] = useState([]);
  const [fichaEmbalagens, setFichaEmbalagens] = useState([]);
  const [novaEmbalagem, setNovaEmbalagem] = useState({ nome: "", custo: "" });
  const [salvandoEmbalagem, setSalvandoEmbalagem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriasConfig, setCategoriasConfig] = useState({});
  const [modalCategorias, setModalCategorias] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [modoFicha, setModoFicha] = useState("principais");
  const [tipoFiltro, setTipoFiltro] = useState("Pratos principais");
  const [mostrarIndicadores, setMostrarIndicadores] = useState(false);
  const [categoriasRecolhidas, setCategoriasRecolhidas] = useState(true);
  const [acoesCardAberto, setAcoesCardAberto] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  const [fichaView, setFichaView] = useState(null); // ficha aberta em modo visualização (igual à foto)
  const abrirFicha = (f) => { setSimPesoView(""); setViewTab("ficha"); setFichaView(f); };
  const [simPesoView, setSimPesoView] = useState(""); // simulador de porções da tela de visualização
  const [viewTab, setViewTab] = useState("ficha"); // aba ativa na tela de visualização
  const [histCustos, setHistCustos] = useState([]); // histórico de custos da ficha aberta
  const [histStatus, setHistStatus] = useState("idle"); // idle | carregando | ok | sem_tabela
  const [registrandoCusto, setRegistrandoCusto] = useState(false);
  const [semeandoCustos, setSemeandoCustos] = useState(false);
  const [iaExplicacao, setIaExplicacao] = useState("");
  const [autoSoma, setAutoSoma] = useState(true);
  const [buscaIng, setBuscaIng] = useState("");

  const [selecionadas, setSelecionadas] = useState([]);
  const [dragId, setDragId] = useState(null); // arrastar para reordenar
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(60);
  const [modalImpressao, setModalImpressao] = useState(null);
  const [configImpressao, setConfigImpressao] = useState(null);
  const [ordemPersonalizada, setOrdemPersonalizada] = useState([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [mensagemLote, setMensagemLote] = useState("");
  // Sem isso, erro e sucesso saíam iguais: verde, com ícone de check.
  const [erroLote, setErroLote] = useState(false);

  // Estado do formulário da Ficha
  const [form, setForm] = useState({
    id: null,
    departamento: deptUrl,
    nome_receita: "",
    categoria: "",
    rendimento_porcoes: "1",
    modo_preparo: "",
    eh_base: false,
    produto_pronto: false,
    tipo_base: null,
    rendimento_unidade: "porcao",
    peso_porcao_g: "",
    imagem: "", // Base64 da foto
    preco_venda: "",
    cmv_meta: 30
  });

  // Bar não é cozinha em miniatura: não embala nada e mede tudo em volume. A
  // tela era escrita para prato — falava kg, porção e embalagem — e no drink
  // isso vira ruído ou, pior, campo que ninguém sabe o que preencher.
  // Vale o departamento da ficha aberta; a URL só decide quando é ficha nova.
  const ehBarFicha = String(form?.departamento || deptUrl || "").toLowerCase() === "bar";
  const unPeso = ehBarFicha ? "ml" : "g";
  const unGrande = ehBarFicha ? "L" : "kg";
  
  const fileInputRef = useRef(null);

  const processarEComprimirImagem = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 600;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          // Retorna apenas o base64 puro (sem o prefixo data:image/jpeg;base64,)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl.split(",")[1]);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleMudarFotoForm = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64Comprimido = await processarEComprimirImagem(file);
      setForm({ ...form, imagem: base64Comprimido });
    } catch (err) {
      alert("Erro ao processar imagem.");
    }
  };

  // Calculadora de desmembramento (digita uma quantidade, vê custo/peso/unidades)

  // Ingredientes da ficha. Cada item tem `chave` (insumo_id OU subficha_id),
  // `tipo` ('insumo'|'base'), `custo_unitario` (por unidade-base) e `unidade`.
  const [ingFicha, setIngFicha] = useState([]);
  // Remoção de ingrediente: pergunta se quer substituir por outro cadastrado
  const [substituirAlvo, setSubstituirAlvo] = useState(null); // ingrediente sendo removido
  const [substitutoValor, setSubstitutoValor] = useState(""); // "insumo:<id>" | "base:<id>"

  // Simulação de rendimento: recalcula os ingredientes para outra quantidade
  const [modalSim, setModalSim] = useState(null); // ficha sendo simulada
  const [simAlvo, setSimAlvo] = useState("");      // rendimento desejado (mesma unidade)
  const abrirSimulacao = (f) => { setModalSim(f); setSimAlvo(String(f.rendimento_porcoes || 1)); };

  // Bases disponíveis (fichas marcadas como pré-preparo), exceto a própria ficha em edição
  const basesDisponiveis = fichas.filter(f => f.eh_base && f.id !== form.id);

  // ─── Montar Ficha Técnica inteira com IA (texto/foto da receita) ───────────
  const [modalIAFicha, setModalIAFicha] = useState(false);
  const [iaFTexto, setIaFTexto] = useState("");
  const [iaFImagem, setIaFImagem] = useState(null); // { base64, mediaType, previewUrl, nomeArquivo }
  const [iaFLoading, setIaFLoading] = useState(false);
  const [iaFResultado, setIaFResultado] = useState(null); // { nome_receita, rendimento_porcoes, modo_preparo, itens: [...] }
  const fileInputFichaRef = useRef(null);

  const abrirModalIAFicha = () => {
    setIaFTexto("");
    setIaFImagem(null);
    setIaFResultado(null);
    setModalIAFicha(true);
  };

  const handleSelecionarImagemFicha = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileParaBase64(file);
    setIaFImagem({ base64, mediaType: "image/jpeg", previewUrl: URL.createObjectURL(file), nomeArquivo: file.name });
  };

  // Tenta casar o nome extraído pela IA com um insumo já cadastrado no departamento
  const encontrarInsumoCorrespondente = (nome) => {
    const alvo = normalizarNome(nome);
    if (!alvo) return null;
    const exato = insumosAtivos.find(i => normalizarNome(i.nome) === alvo);
    if (exato) return exato;
    return insumosAtivos.find(i => {
      const n = normalizarNome(i.nome);
      return n.includes(alvo) || alvo.includes(n);
    }) || null;
  };

  const gerarFichaIA = async () => {
    if (!iaFTexto.trim() && !iaFImagem) return alert("Cole a receita em texto ou envie uma foto.");
    setIaFLoading(true);
    try {
      const res = await fetch("/api/ia-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: iaFTexto,
          imagem_base64: iaFImagem?.base64 || null,
          imagem_media_type: iaFImagem?.mediaType || null,
          departamento: deptUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao ler a receita.");
        return;
      }
      const itens = data.ingredientes.map(ing => {
        const match = encontrarInsumoCorrespondente(ing.nome);
        return {
          nomeOriginal: ing.nome,
          quantidade_lida: ing.quantidade_lida,
          unidade_lida: ing.unidade_lida,
          vinculoId: match ? match.id : "novo",
          novo: { marca: "", unidade_medida: ing.unidade_lida === "g" ? "kg" : ing.unidade_lida === "ml" ? "l" : ing.unidade_lida, custo_unitario: "" },
          cadastrando: false,
        };
      });
      setIaFResultado({
        nome_receita: data.nome_receita,
        rendimento_porcoes: data.rendimento_porcoes,
        modo_preparo: data.modo_preparo,
        itens,
      });
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaFLoading(false);
    }
  };

  const atualizarItemIAFicha = (idx, campos) => {
    setIaFResultado(res => ({
      ...res,
      itens: res.itens.map((it, i) => i === idx ? { ...it, ...campos } : it),
    }));
  };

  const cadastrarInsumoIAFicha = async (idx) => {
    const item = iaFResultado.itens[idx];
    if (!item.novo.custo_unitario || Number(item.novo.custo_unitario) <= 0) {
      return alert("Digite o custo do novo ingrediente antes de cadastrar.");
    }
    atualizarItemIAFicha(idx, { cadastrando: true });
    const resp = await salvarInsumo({
      departamento: deptUrl,
      nome: item.nomeOriginal,
      marca: item.novo.marca.trim(),
      unidade_medida: item.novo.unidade_medida,
      custo_unitario: Number(item.novo.custo_unitario),
      unidade_id: unidadeAtiva,
    });
    if (resp.error || !resp.id) {
      atualizarItemIAFicha(idx, { cadastrando: false });
      return alert("Erro ao cadastrar ingrediente: " + (resp.error || "id não retornado"));
    }
    const novoInsumo = {
      id: resp.id, nome: item.nomeOriginal, marca: item.novo.marca,
      unidade_medida: item.novo.unidade_medida, custo_unitario: Number(item.novo.custo_unitario),
      departamento: deptUrl,
    };
    setInsumosAtivos(lista => [...lista, novoInsumo]);
    atualizarItemIAFicha(idx, { vinculoId: resp.id, cadastrando: false });
  };

  const usarFichaIA = () => {
    const pendente = iaFResultado.itens.find(it => it.vinculoId === "novo");
    if (pendente) return alert(`Cadastre ou vincule "${pendente.nomeOriginal}" antes de continuar.`);

    const novosIngFicha = iaFResultado.itens.map(it => {
      const insumo = insumosAtivos.find(i => i.id === it.vinculoId);
      const quantidade = converterParaBase(it.quantidade_lida, it.unidade_lida, insumo.unidade_medida);
      return {
        chave: insumo.id, tipo: "insumo", insumo_id: insumo.id,
        nome: insumo.nome, unidade: insumo.unidade_medida,
        custo_unitario: insumo.custo_unitario, quantidade,
        peso_medio_g: insumo.peso_medio_g || null,
        unidade_medida: insumo.unidade_medida,
        unidade_comercial: insumo.unidade_comercial || null,
        tamanho_embalagem: insumo.tamanho_embalagem || null,
        volume_unidade_ml: insumo.volume_unidade_ml || null,
        modo: getSub(insumo.unidade_medida) ? "sub" : "base",
      };
    });

    // Rendimento = peso total somado dos ingredientes (kg/g/l/ml), automático.
    // Usa peso médio do insumo p/ incluir itens em "un". Só cai para "porção"
    // se os ingredientes forem todos em unidades sem peso conhecido.
    const pesoIA = rendimentoPelosIngredientes(novosIngFicha);
    setForm({
      id: null, departamento: deptUrl,
      nome_receita: iaFResultado.nome_receita,
      categoria: "",
      rendimento_porcoes: pesoIA ? String(pesoIA.valor) : String(iaFResultado.rendimento_porcoes || 1),
      modo_preparo: iaFResultado.modo_preparo,
      eh_base: false,
      produto_pronto: false,
      tipo_base: null,
      rendimento_unidade: pesoIA ? pesoIA.unidade : "porcao",
      peso_porcao_g: "",
      preco_venda: "",
      cmv_meta: 30,
    });
    setAutoSoma(true);
    setIngFicha(novosIngFicha);
    setFichaEmbalagens([]);
    setNovaEmbalagem({ nome: "", custo: "" });
    setIaExplicacao("");
    setModalIAFicha(false);
    setModalNovo(true);
  };

  // Assistente de IA para o Modo de Preparo
  const [iaLoading, setIaLoading] = useState(false);

  const gerarPreparoIA = async () => {
    if (!iaExplicacao.trim()) return alert("Explique com suas palavras como o prato é feito.");
    setIaLoading(true);
    try {
      const res = await fetch("/api/ia-preparo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explicacao: iaExplicacao,
          nome_receita: form.nome_receita,
          porcoes: form.rendimento_porcoes,
          ingredientes: ingFicha.map(i => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao gerar o modo de preparo.");
        return;
      }
      setForm(f => ({ ...f, modo_preparo: data.modo_preparo }));
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaLoading(false);
    }
  };

  const carregar = async () => {
    setLoading(true);
    const [resFichas, resInsumos, resProd, resMontagens, resEmbalagens, resEstoqueEmbalagens] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, deptUrl),
       fetchProdutos(unidadeAtiva),
       fetchMontagens(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, "embalagens"),
       fetchEmbalagens(unidadeAtiva, deptUrl),
    ]);
    const produtosCarregados = resProd.data || [];
    const embalagensCarregadas = resEstoqueEmbalagens.data || [];
    const fichasComEmbalagens = (resFichas.data || []).map(ficha => {
      const produto = produtosCarregados.find(item => item.ficha_id === ficha.id);
      const embalagensProduto = Array.isArray(produto?.embalagens) ? produto.embalagens : [];
      const custoPorPorcao = embalagensProduto.reduce((total, item) => {
        const embalagem = embalagensCarregadas.find(emb => String(emb.id) === String(item.embalagem_id));
        return total + (Number(embalagem?.preco_unitario) || 0) * (Number(item.qtd) || 0);
      }, 0);
      const porcoes = porcoesParaEmbalagem(ficha.rendimento_porcoes, ficha.rendimento_unidade, ficha.peso_porcao_g);
      return { ...ficha, custo_embalagens_total: custoPorPorcao * porcoes };
    });
    setFichas(fichasComEmbalagens);
    setInsumosAtivos(resInsumos.data || []);
    setProdutos(produtosCarregados);
    setMontagens(resMontagens.data || []);
    setEmbalagensCat(resEmbalagens.data || []);
    setEmbalagensEstoque(resEstoqueEmbalagens.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  // A ficha aberta em visualização é um retrato do momento em que foi aberta.
  // Sem reapontá-la para a versão recarregada, a tela continua mostrando os
  // números antigos depois de salvar — parece que a gravação não pegou.
  useEffect(() => {
    setFichaView(aberta => (aberta ? (fichas.find(f => f.id === aberta.id) || aberta) : aberta));
  }, [fichas]);

  useEffect(() => {
    setModoFicha("principais");
    setTipoFiltro("Pratos principais");
  }, [deptUrl]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    fetchCategoriasFichas(unidadeAtiva).then(({ data }) => setCategoriasConfig(data || {}));
  }, [unidadeAtiva]);

  const configCategoriasDept = categoriasConfig?.[deptUrl] || {};
  const configCategoriasModo = configCategoriasDept?.[modoFicha]
    || (modoFicha === "principais" ? configCategoriasDept : {});
  const categoriasAdicionais = Array.isArray(configCategoriasModo.adicionais) ? configCategoriasModo.adicionais : [];
  const categoriasExcluidas = Array.isArray(configCategoriasModo.excluidas) ? configCategoriasModo.excluidas : [];
  const categoriasBaseDept = modoFicha === "preparos"
    ? (deptUrl === "bar" ? CATEGORIAS_PREPARO_BAR : CATEGORIAS_PREPARO_COZINHA)
    : (deptUrl === "bar" ? CATEGORIAS_BAR : CATEGORIAS_CARDAPIO);
  // Base de tudo que a tela conta e categoriza. Produto comprado pronto fica de
  // fora aqui, senão as categorias e os contadores mostrariam número maior do
  // que a lista logo abaixo — e "Cervejas (12)" com 3 drinks na tela confunde.
  const fichasDoModo = fichas.filter(ficha => modoFicha === "preparos"
    ? !!ficha.eh_base
    : (!ficha.eh_base && ficha.tipo_base !== "produto_pronto"));
  const categoriasDisponiveis = [...new Set([
    ...categoriasBaseDept,
    ...categoriasAdicionais,
    ...fichasDoModo.map(ficha => ficha.categoria).filter(Boolean),
  ])].filter(categoria => !categoriasExcluidas.includes(categoria))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  const configCategoriasPreparo = configCategoriasDept?.preparos || {};
  const categoriasPreparoDisponiveis = [...new Set([
    ...(deptUrl === "bar" ? CATEGORIAS_PREPARO_BAR : CATEGORIAS_PREPARO_COZINHA),
    ...(Array.isArray(configCategoriasPreparo.adicionais) ? configCategoriasPreparo.adicionais : []),
    ...fichas.filter(ficha => !!ficha.eh_base).map(ficha => ficha.categoria).filter(Boolean),
  ])].filter(categoria => !(configCategoriasPreparo.excluidas || []).includes(categoria))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  const configCategoriasPrincipais = configCategoriasDept?.principais || configCategoriasDept || {};
  const categoriasPrincipaisDisponiveis = [...new Set([
    ...(deptUrl === "bar" ? CATEGORIAS_BAR : CATEGORIAS_CARDAPIO),
    ...(Array.isArray(configCategoriasPrincipais.adicionais) ? configCategoriasPrincipais.adicionais : []),
    ...fichas.filter(ficha => !ficha.eh_base).map(ficha => ficha.categoria).filter(Boolean),
  ])].filter(categoria => !(configCategoriasPrincipais.excluidas || []).includes(categoria))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

  const persistirCategorias = async (proximoModo) => {
    const temContextos = !!(configCategoriasDept?.principais || configCategoriasDept?.preparos);
    const deptNormalizado = temContextos
      ? configCategoriasDept
      : {
          principais: {
            adicionais: Array.isArray(configCategoriasDept.adicionais) ? configCategoriasDept.adicionais : [],
            excluidas: Array.isArray(configCategoriasDept.excluidas) ? configCategoriasDept.excluidas : [],
          },
          preparos: { adicionais: [], excluidas: [] },
        };
    const proximoDept = { ...deptNormalizado, [modoFicha]: proximoModo };
    const proximo = { ...categoriasConfig, [deptUrl]: proximoDept };
    setSalvandoCategoria(true);
    const { error } = await salvarCategoriasFichas(unidadeAtiva, proximo);
    setSalvandoCategoria(false);
    if (error) return alert("Não foi possível salvar as categorias: " + error);
    setCategoriasConfig(proximo);
    return true;
  };

  const criarCategoria = async () => {
    const nome = novaCategoria.trim();
    if (!nome) return;
    if (categoriasDisponiveis.some(item => item.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
      return alert("Essa categoria já existe.");
    }
    const ok = await persistirCategorias({
      adicionais: [...categoriasAdicionais, nome],
      excluidas: categoriasExcluidas.filter(item => item !== nome),
    });
    if (ok) setNovaCategoria("");
  };

  const excluirCategoria = async (nome) => {
    const quantidade = fichasDoModo.filter(ficha => ficha.categoria === nome).length;
    const aviso = quantidade
      ? `A categoria "${nome}" tem ${quantidade} ficha(s). Ela será removida da lista, mas as fichas não serão apagadas. Continuar?`
      : `Excluir a categoria "${nome}"?`;
    if (!confirm(aviso)) return;
    const ok = await persistirCategorias({
      adicionais: categoriasAdicionais.filter(item => item !== nome),
      excluidas: [...new Set([...categoriasExcluidas, nome])],
    });
    if (ok && tipoFiltro === nome) setTipoFiltro(modoFicha === "preparos" ? "Preparos e receitas" : "Pratos principais");
  };

  // Rendimento automático: sempre que os ingredientes mudam (e não estiver no
  // modo manual), o rendimento passa a ser o PESO SOMADO dos ingredientes, na
  // unidade que domina (kg/g/l/ml). Sem porção, sem multiplicação.
  useEffect(() => {
    if (form && autoSoma && ingFicha.length > 0) {
      const est = rendimentoPelosIngredientes(ingFicha);
      if (est && est.totalG > 0) {
         setForm(f => ({ ...f, rendimento_porcoes: String(est.valor), rendimento_unidade: est.unidade, peso_porcao_g: "" }));
      }
    }
  }, [ingFicha, autoSoma]);

  // Divisão do receituário: Pratos (prontos p/ cardápio) × Pré-preparos (bases
  // usadas dentro de outros pratos: molhos, massas, caldos...)
  const ordenarFichas = (a, b) => {
    return String(a.nome_receita || "").localeCompare(String(b.nome_receita || ""), "pt-BR", { sensitivity: "base" });
  };
  // Produto pronto (cerveja, refrigerante) não tem receita: é compra, não
  // receituário. Fica fora do receituário inteiro — quem cuida dele é o
  // cardápio e o estoque, não a ficha técnica.
  const passaFiltro = (f) => {
    if (!f.eh_base && f.tipo_base === "produto_pronto") return false;
    if (tipoFiltro === "Preparos e receitas") return !!f.eh_base;
    if (tipoFiltro === "Pratos principais") return !f.eh_base;
    if (tipoFiltro === "Pré-preparos") return !!f.eh_base && f.tipo_base !== "receita";
    if (tipoFiltro === "Receitas base") return !!f.eh_base && f.tipo_base === "receita";
    if (tipoFiltro === "Pratos") return !f.eh_base;
    if (modoFicha === "preparos") return !!f.eh_base && (f.categoria || "") === tipoFiltro;
    return !f.eh_base && (f.categoria || "") === tipoFiltro; // categoria específica
  };
  const filtradas = fichas
    // normalizarNome nos dois lados: quem digita "acai" tem de achar "Açaí",
    // e quem digita "á" tem de achar "Agua". Ninguém procura com acento.
    .filter(f => normalizarNome(f.nome_receita).includes(normalizarNome(busca)) && passaFiltro(f))
    .sort(ordenarFichas);
  // porPagina 0 = "Todas": a lista inteira numa página só.
  const tamanhoPagina = porPagina > 0 ? porPagina : Math.max(1, filtradas.length);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamanhoPagina));
  const fichasPagina = filtradas.slice((pagina - 1) * tamanhoPagina, pagina * tamanhoPagina);
  const fichasSelecionadas = selecionadas.map(id => fichas.find(f => f.id === id)).filter(Boolean);
  const papelUsuario = String(sessao?.papel || sessao?.role || "").toLowerCase();
  const podeImprimirCustos = ["admin", "administrador", "superadmin", "gestor", "gerente", "dono"]
    .some(papel => papelUsuario.includes(papel));
  const usuarioAuditoria = {
    unidadeId: unidadeAtiva,
    usuarioId: sessao?.id || sessao?.user?.id || null,
    usuarioNome: sessao?.nome || sessao?.user_metadata?.nome || sessao?.email || "Usuário do sistema",
    origem: "Ação em lote — fichas técnicas",
  };

  useEffect(() => { setPagina(1); }, [busca, tipoFiltro, porPagina]);
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  // Arrastar para reordenar: reposiciona o item arrastado antes do alvo e grava a ordem
  const reordenar = async (arrastadoId, alvoId) => {
    if (!arrastadoId || arrastadoId === alvoId) return;
    const ids = filtradas.map(f => f.id);
    const from = ids.indexOf(arrastadoId), to = ids.indexOf(alvoId);
    if (from < 0 || to < 0) return;
    const nova = [...ids];
    nova.splice(from, 1);
    nova.splice(to, 0, arrastadoId);
    const ordemMap = {};
    nova.forEach((id, i) => { ordemMap[id] = i; });
    setFichas(prev => prev.map(f => ordemMap[f.id] !== undefined ? { ...f, ordem: ordemMap[f.id] } : f));
    setDragId(null);
    for (const id of nova) await atualizarOrdemFicha(id, ordemMap[id]);
  };

  const abrirNova = () => {
    const criandoPreparo = modoFicha === "preparos";
    const categoriaInicial = criandoPreparo
      ? (deptUrl === "bar" ? CATEGORIAS_PREPARO_BAR[0] : CATEGORIAS_PREPARO_COZINHA[0])
      : "";
    setForm({ id: null, departamento: deptUrl, nome_receita: "", categoria: categoriaInicial, rendimento_porcoes: "1", modo_preparo: "", eh_base: criandoPreparo, produto_pronto: false, tipo_base: criandoPreparo ? "pre" : null, rendimento_unidade: deptUrl === "bar" ? "ml" : "porcao", peso_porcao_g: "", imagem: "", tempo_preparo: "", validade_dias: "", observacoes: "", metodo_bar: "", preco_venda: "", cmv_meta: 30 });
    setIngFicha([]);
    setFichaEmbalagens([]);
    setNovaEmbalagem({ nome: "", custo: "" });
    setAutoSoma(true);
    setIaExplicacao("");
    setModalNovo(true);
  };

  const abrirEditar = (ficha) => {
    setAutoSoma(false);
    const produtoFicha = produtos.find(x => x.ficha_id === ficha.id || String(x.nome_produto || "").toLowerCase() === String(ficha.nome_receita || "").toLowerCase());
    setForm({
       id: ficha.id,
       departamento: ficha.departamento,
       nome_receita: ficha.nome_receita,
       categoria: ficha.departamento === "bar" && ficha.eh_base && ficha.tipo_base !== "receita" ? categoriaPreparoBar(ficha) : (ficha.categoria || ""),
       rendimento_porcoes: ficha.rendimento_porcoes,
       modo_preparo: ficha.modo_preparo || "",
       eh_base: !!ficha.eh_base,
       tipo_base: ficha.tipo_base || "pre",
       produto_pronto: ficha.tipo_base === "produto_pronto",
       rendimento_unidade: ficha.rendimento_unidade || "porcao",
       peso_porcao_g: ficha.peso_porcao_g || "",
       imagem: ficha.imagem || "",
       tempo_preparo: ficha.tempo_preparo != null ? String(ficha.tempo_preparo) : "",
       validade_dias: ficha.validade_dias != null ? String(ficha.validade_dias) : "",
       observacoes: ficha.observacoes || "", metodo_bar: ficha.metodo_bar || "",
       cmv_meta: ficha.cmv_meta != null ? Number(ficha.cmv_meta) : 30,
       preco_venda: (() => {
          const prod = produtos.find(x => x.ficha_id === ficha.id || String(x.nome_produto || "").toLowerCase() === String(ficha.nome_receita || "").toLowerCase());
          return prod && Number(prod.preco_venda) > 0 ? String(prod.preco_venda) : "";
       })()
    });
    // Reconstrói os ingredientes: cada um é um INSUMO ou uma BASE (sub-ficha).
    const mapIng = (ficha.fichas_ingredientes || []).map(fi => {
       if (fi.subficha_id) {
          const base = fichas.find(x => x.id === fi.subficha_id);
          return {
             chave: fi.subficha_id, tipo: "base", subficha_id: fi.subficha_id,
             nome: base?.nome_receita || "Base",
             unidade: base?.rendimento_unidade || "un",
             custo_unitario: base ? custoUnitBase(base, fichas) : 0,
             quantidade: fi.quantidade,
             fator: Number(fi.fator_correcao) || 0,
             modo: getSub(base?.rendimento_unidade) ? "sub" : "base",
          };
       }
       return {
          chave: fi.insumos.id, tipo: "insumo", insumo_id: fi.insumos.id,
          nome: fi.insumos.nome, unidade: fi.insumos.unidade_medida,
          custo_unitario: custoUnitEfetivo(fi.insumos), quantidade: fi.quantidade,
          // Perda vem do cadastro do ingrediente; cai no FC legado se não houver.
          fator: fi.insumos.empanado ? 0 : (Number(fi.insumos.perda_pct) || Number(fi.fator_correcao) || 0),
          empanado: !!fi.insumos.empanado,
          peso_medio_g: fi.insumos.peso_medio_g || null,
          unidade_medida: fi.insumos.unidade_medida,
          unidade_comercial: fi.insumos.unidade_comercial || null,
          tamanho_embalagem: fi.insumos.tamanho_embalagem || null,
          volume_unidade_ml: fi.insumos.volume_unidade_ml || null,
          modo: getSub(fi.insumos.unidade_medida) ? "sub" : "base",
       };
    });
    setIngFicha(mapIng);
    setFichaEmbalagens(Array.isArray(produtoFicha?.embalagens) ? produtoFicha.embalagens.map(item => ({ embalagem_id: item.embalagem_id, qtd: Number(item.qtd) || 1 })) : []);
    setNovaEmbalagem({ nome: "", custo: "" });
    setIaExplicacao("");
    setModalNovo(true);
  };

  // ── Histórico de custos da ficha aberta em visualização ──
  const custoAtualDaFicha = (ficha) => {
    const custoTotal = custoTotalDaFicha(ficha, fichas);
    const peso = infoPesoFicha(ficha, fichas);
    const unR = String(ficha.rendimento_unidade || "porcao").toLowerCase();
    const rend = Number(ficha.rendimento_porcoes) || 0;
    const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
    const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
    return { custoTotal, custoPorcao };
  };
  const carregarHistoricoCusto = async (ficha) => {
    if (!ficha) return;
    setHistStatus("carregando");
    const { data, error } = await fetchHistoricoCustoFicha(unidadeAtiva, ficha.id);
    if (error === "sem_tabela") { setHistCustos([]); setHistStatus("sem_tabela"); return; }
    setHistCustos(data || []);
    setHistStatus("ok");
  };
  const registrarCustoAtual = async (ficha, origem = "manual") => {
    if (!ficha) return;
    setRegistrandoCusto(true);
    const { custoTotal, custoPorcao } = custoAtualDaFicha(ficha);
    const r = await registrarCustoFicha({
      unidadeId: unidadeAtiva, fichaId: ficha.id, custoTotal, custoPorcao, origem,
      usuarioNome: sessao?.nome || sessao?.user?.email || "",
    });
    setRegistrandoCusto(false);
    if (r.error === "sem_tabela") { setHistStatus("sem_tabela"); return; }
    await carregarHistoricoCusto(ficha);
  };
  useEffect(() => {
    if (fichaView) carregarHistoricoCusto(fichaView);
    else { setHistCustos([]); setHistStatus("idle"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaView]);
  // Semeia o custo atual de todas as fichas (primeiro ponto do histórico).
  const registrarCustoTodasFichas = async () => {
    const alvo = fichas.filter(f => !f.eh_base && f.tipo_base !== "produto_pronto");
    if (!alvo.length) return alert("Nenhuma ficha para registrar.");
    if (!confirm(`Registrar o custo atual de ${alvo.length} ficha(s) no histórico?`)) return;
    setSemeandoCustos(true);
    let ok = 0, pulados = 0, semTabela = false;
    for (const fc of alvo) {
      const { custoTotal, custoPorcao } = custoAtualDaFicha(fc);
      const r = await registrarCustoFicha({
        unidadeId: unidadeAtiva, fichaId: fc.id, custoTotal, custoPorcao,
        origem: "manual", usuarioNome: sessao?.nome || sessao?.user?.email || "",
      });
      if (r.error === "sem_tabela") { semTabela = true; break; }
      if (r.pulado) pulados++; else ok++;
    }
    setSemeandoCustos(false);
    if (semTabela) return alert("A tabela de histórico ainda não existe. Rode a migração db/migracao_ficha_custo_historico.sql no Supabase.");
    if (fichaView) await carregarHistoricoCusto(fichaView);
    alert(`Histórico atualizado.\n\n· ${ok} ponto(s) registrado(s)\n· ${pulados} sem mudança (já estavam no histórico)`);
  };

  // Custo considera o Fator de Correção (%) do item: bruta = líquida × (1 + fc)
  const calcularCustoTotal = (ingredientesLista) => {
    return ingredientesLista.reduce((acc, ing) => acc + (ing.custo_unitario * ing.quantidade * multiplicadorPerda(ing.fator)), 0);
  };

  const numeroPorcoesFormulario = () => porcoesParaEmbalagem(
    String(form.rendimento_porcoes || "").replace(",", "."),
    form.rendimento_unidade,
    form.peso_porcao_g,
  );

  const custoEmbalagensPorPorcao = () => fichaEmbalagens.reduce((total, item) => {
    const embalagem = embalagensEstoque.find(emb => String(emb.id) === String(item.embalagem_id));
    return total + (Number(embalagem?.preco_unitario) || 0) * (Number(item.qtd) || 0);
  }, 0);

  const custoTotalFormulario = (ingredientesLista = ingFicha) => {
    const porcoes = Math.max(1, numeroPorcoesFormulario());
    return calcularCustoTotal(ingredientesLista) + custoEmbalagensPorPorcao() * porcoes;
  };

  const alternarEmbalagemFicha = (embalagemId) => {
    setFichaEmbalagens(lista => lista.some(item => String(item.embalagem_id) === String(embalagemId))
      ? lista.filter(item => String(item.embalagem_id) !== String(embalagemId))
      : [...lista, { embalagem_id: embalagemId, qtd: 1 }]);
  };

  const alterarQuantidadeEmbalagem = (embalagemId, qtd) => {
    setFichaEmbalagens(lista => lista.map(item => String(item.embalagem_id) === String(embalagemId)
      ? { ...item, qtd: Math.max(0.01, Number(qtd) || 1) }
      : item));
  };

  const cadastrarEmbalagemDaFicha = async () => {
    const nome = novaEmbalagem.nome.trim();
    const custo = Number(String(novaEmbalagem.custo || "").replace(",", "."));
    if (!nome) return alert("Informe o nome da embalagem.");
    if (!Number.isFinite(custo) || custo < 0) return alert("Informe um custo valido.");
    setSalvandoEmbalagem(true);
    const resultado = await salvarEmbalagem(unidadeAtiva, {
      nome, categoria: "Embalagens de fichas", departamento: deptUrl,
      quantidade_atual: 0, quantidade_minima: 0, preco_unitario: custo,
    });
    setSalvandoEmbalagem(false);
    if (resultado.error) return alert("Erro ao cadastrar embalagem: " + (resultado.error.message || resultado.error));
    const criada = resultado.data;
    setEmbalagensEstoque(lista => [...lista, criada].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    setFichaEmbalagens(lista => [...lista, { embalagem_id: criada.id, qtd: 1 }]);
    setNovaEmbalagem({ nome: "", custo: "" });
  };

  // Adiciona insumo ou base. `valor` = "insumo:<id>" ou "base:<id>"
  // Constrói um item de ingFicha a partir de "insumo:<id>" ou "base:<id>"
  const construirIng = (valor, quantidade = 0) => {
    const [tipo, id] = valor.split(":");
    if (tipo === "base") {
       const base = fichas.find(f => f.id === id);
       if (!base) return null;
       return {
          chave: base.id, tipo: "base", subficha_id: base.id,
          nome: base.nome_receita, unidade: base.rendimento_unidade || "un",
          custo_unitario: custoUnitBase(base, fichas), quantidade,
          modo: getSub(base.rendimento_unidade) ? "sub" : "base",
       };
    }
    const insumoDb = insumosAtivos.find(i => i.id === id) || embalagensCat.find(i => i.id === id);
    if (!insumoDb) return null;
    return {
       chave: insumoDb.id, tipo: "insumo", insumo_id: insumoDb.id,
       nome: insumoDb.nome, unidade: insumoDb.unidade_medida,
       custo_unitario: custoUnitEfetivo(insumoDb), quantidade,
       peso_medio_g: insumoDb.peso_medio_g || null,
       unidade_medida: insumoDb.unidade_medida,
       unidade_comercial: insumoDb.unidade_comercial || null,
       tamanho_embalagem: insumoDb.tamanho_embalagem || null,
       volume_unidade_ml: insumoDb.volume_unidade_ml || null,
       // Perda vem do cadastro do ingrediente. Empanado usa o ganho (não soma perda).
       fator: insumoDb.empanado ? 0 : (Number(insumoDb.perda_pct) || 0),
       empanado: !!insumoDb.empanado,
       modo: getSub(insumoDb.unidade_medida) ? "sub" : "base",
    };
  };

  // Digitar é mais rápido do que rolar uma lista com centenas de opções.
  const opcoesIngrediente = useMemo(() => [
    ...insumosAtivos.map(i => ({ valor: `insumo:${i.id}`, nome: i.nome, detalhe: i.unidade_medida, tipo: "Insumo" })),
    ...basesDisponiveis.map(b => ({ valor: `base:${b.id}`, nome: b.nome_receita, detalhe: b.rendimento_unidade, tipo: "Pré-preparo" })),
    ...embalagensCat.map(i => ({ valor: `insumo:${i.id}`, nome: i.nome, detalhe: i.unidade_medida, tipo: "Embalagem" })),
  ], [insumosAtivos, basesDisponiveis, embalagensCat]);

  // Resumo de custo do cardápio (só fichas de montagem com preço de venda).
  // Alimenta o CMV médio do cabeçalho e o kanban de indicadores, para os dois
  // sempre falarem o mesmo número.
  const resumoCardapio = useMemo(() => {
    const base = fichas.filter(f => !f.eh_base && f.tipo_base !== "produto_pronto");
    let somaCmv = 0, nCmv = 0, somaCusto = 0, nCusto = 0, somaPreco = 0, nPreco = 0, somaMargem = 0, semPreco = 0, acimaMeta = 0;
    base.forEach(f => {
      const peso = infoPesoFicha(f, fichas);
      const custoTotal = custoTotalDaFicha(f, fichas);
      const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
      const rend = Number(f.rendimento_porcoes) || 0;
      const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
      const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
      if (custoPorcao > 0) { somaCusto += custoPorcao; nCusto++; }
      const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
      const preco = Number(prod?.preco_venda) || 0;
      const meta = Number(f.cmv_meta) || 30;
      if (preco > 0) {
        const cmv = (custoPorcao / preco) * 100;
        somaCmv += cmv; nCmv++; somaPreco += preco; nPreco++; somaMargem += (100 - cmv);
        if (cmv > meta) acimaMeta++;
      } else semPreco++;
    });
    return {
      totalFichas: base.length,
      precificadas: nCmv,
      semPreco,
      acimaMeta,
      cmvMedio: nCmv ? somaCmv / nCmv : null,
      margemMedia: nCmv ? somaMargem / nCmv : null,
      custoMedio: nCusto ? somaCusto / nCusto : null,
      ticketMedio: nPreco ? somaPreco / nPreco : null,
    };
  }, [fichas, produtos]);

  const sugestoesIngrediente = useMemo(() => {
    // Sem acento dos dois lados: "a" acha "Água" e "c" acha "Açaí", porque
    // normalizarNome tira o cedilha junto com os acentos.
    const termo = normalizarNome(buscaIng);
    if (!termo) return [];
    return opcoesIngrediente.filter(o => normalizarNome(o.nome).includes(termo)).slice(0, 8);
  }, [buscaIng, opcoesIngrediente]);

  const addIngrediente = (valor) => {
    if (!valor) return;
    const [, id] = valor.split(":");
    if (ingFicha.find(i => i.chave === id)) return; // já existe
    const novo = construirIng(valor, 0);
    if (!novo) return;
    setAutoSoma(true);
    setIngFicha([...ingFicha, novo]);
    setBuscaIng("");
  };

  // Recebe a quantidade JÁ em unidade-base (a conversão acontece no onChange do input)
  const updateQtd = (chave, qtdBase) => {
    setAutoSoma(true);
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, quantidade: Number(qtdBase) || 0 } : i));
  };

  const toggleModo = (chave) => {
    setAutoSoma(true);
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, modo: i.modo === 'sub' ? 'base' : 'sub' } : i));
  };

  // Fator de correção (%) do item — a bruta é calculada e o custo acompanha
  const updateFator = (chave, fator) => {
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, fator: Number(fator) || 0 } : i));
  };

  const removeIngrediente = (chave) => {
    setAutoSoma(true);
    setIngFicha(lista => lista.filter(i => i.chave !== chave));
  };

  // Confirma a substituição do ingrediente-alvo por outro cadastrado (mantém a qtd)
  const confirmarSubstituicao = () => {
    const alvo = substituirAlvo;
    if (!alvo || !substitutoValor) return;
    const [, novoId] = substitutoValor.split(":");
    if (novoId === alvo.chave) { fecharSubstituicao(); return; }
    const novo = construirIng(substitutoValor, alvo.quantidade || 0);
    if (!novo) return;
    setAutoSoma(true);
    setIngFicha(lista => {
      // Se o substituto já está na ficha, apenas remove o alvo (evita duplicar)
      if (lista.find(i => i.chave === novo.chave)) return lista.filter(i => i.chave !== alvo.chave);
      return lista.map(i => i.chave === alvo.chave ? novo : i);
    });
    fecharSubstituicao();
  };

  // Só remover (sem substituir)
  const soRemover = () => {
    if (substituirAlvo) removeIngrediente(substituirAlvo.chave);
    fecharSubstituicao();
  };

  const fecharSubstituicao = () => { setSubstituirAlvo(null); setSubstitutoValor(""); };

  // Escala os ingredientes de uma ficha por um fator (simulação de rendimento)
  const linhasSimuladas = (f, factor) => {
    const SUB = { kg: { s: "g", fa: 1000 }, l: { s: "ml", fa: 1000 } };
    const fmt = (qtd, un) => {
      const c = SUB[String(un || "").toLowerCase()];
      return c ? `${(+(qtd * c.fa)).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ${c.s}`
        : `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} ${String(un || "").toUpperCase()}`;
    };
    return (f.fichas_ingredientes || []).map(fi => {
      let nome = "", unidade = "", custoU = 0;
      if (fi.insumos) { nome = fi.insumos.nome; unidade = fi.insumos.unidade_medida; custoU = fi.insumos.custo_unitario || 0; }
      else if (fi.subficha_id) { const base = fichas.find(x => x.id === fi.subficha_id); nome = base ? base.nome_receita : "Base"; unidade = base?.rendimento_unidade || "un"; custoU = base ? custoUnitBase(base, fichas) : 0; }
      const qtd = (Number(fi.quantidade) || 0) * factor;
      return { nome, qtdFmt: fmt(qtd, unidade), custo: qtd * custoU };
    });
  };

  const imprimirSimulacao = (f, factor, alvoTxt) => {
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir.");
    const linhas = linhasSimuladas(f, factor);
    const rows = linhas.map(l => `<tr><td>${l.nome}</td><td style="text-align:right;font-weight:bold">${l.qtdFmt}</td></tr>`).join("");
    win.document.write(comFecharImpressao(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Simulação — ${f.nome_receita}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px;max-width:620px;margin:0 auto}
      .tag{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
      h1{font-size:34px;margin:6px 0}.meta{font-size:20px;font-weight:bold;color:#0f172a;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:22px}td{padding:12px 6px;border-bottom:2px solid #e2e8f0;font-weight:600}
      @media print{@page{margin:14mm}}</style></head><body>
      <div class="tag">Simulação de Rendimento</div><h1>${f.nome_receita}</h1>
      <div class="meta">Para produzir: ${alvoTxt}</div>
      <table><tbody>${rows || '<tr><td>Sem ingredientes.</td></tr>'}</tbody></table>
      </body></html>`));
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const handleSalvar = async (criarOutra = false) => {
    if(!form.nome_receita.trim()) return alert("Digite o nome da receita");
    if(!form.rendimento_porcoes) return alert("Digite o rendimento");

    // Filtra ingredientes que estão com qtd = 0
    const ingValidos = ingFicha.filter(i => i.quantidade > 0);
    if(ingValidos.length === 0 && !form.produto_pronto) return alert("Adicione pelo menos um ingrediente com quantidade válida.");

    const erro = await salvarFicha(
       {
          id: form.id,
          unidade_id: unidadeAtiva,
          departamento: form.departamento,
          nome_receita: form.nome_receita,
          categoria: form.categoria || null,
          rendimento_porcoes: Number(form.rendimento_porcoes),
          modo_preparo: form.eh_base ? form.modo_preparo : "",
          eh_base: !!form.eh_base,
          tipo_base: form.produto_pronto ? "produto_pronto" : (form.eh_base ? (form.tipo_base || "pre") : null),
          cmv_meta: form.cmv_meta != null && form.cmv_meta !== "" ? Number(form.cmv_meta) : 30,
          rendimento_unidade: form.rendimento_unidade || "porcao",
          peso_porcao_g: form.peso_porcao_g ? Number(form.peso_porcao_g) : null,
          imagem: form.imagem || null,
          tempo_preparo: form.tempo_preparo ? Number(form.tempo_preparo) : null,
          validade_dias: form.validade_dias ? Number(form.validade_dias) : null,
          observacoes: form.observacoes || null,
          // Coluna nova: salvarFicha remove sozinha se a migração ainda não rodou.
          metodo_bar: (form.departamento === "bar" && !form.eh_base && form.metodo_bar) ? form.metodo_bar : null
       },
       ingValidos.map(i => ({
          insumo_id: i.tipo === "insumo" ? i.insumo_id : null,
          subficha_id: i.tipo === "base" ? i.subficha_id : null,
          quantidade: i.quantidade,
          fator_correcao: Number(i.fator) || 0
       }))
    );

    if(erro.error) return alert("Erro ao salvar: " + erro.error);

    if (form.eh_base && erro.id) {
      const custoUnitarioPreparo = calcularCustoTotal(ingValidos) / Math.max(1, Number(form.rendimento_porcoes) || 1);
      const estoquePreparo = await garantirFichaNoEstoquePreparo({
        unidadeId: unidadeAtiva,
        ficha: { ...form, id: erro.id },
        departamento: form.departamento,
        custoUnitario: custoUnitarioPreparo,
      });
      if (estoquePreparo.error) {
        await carregar();
        return alert(`A ficha foi salva, mas nao entrou no estoque de preparos: ${estoquePreparo.error}`);
      }
    }

    if (!criarOutra) setModalNovo(false);

    // ── Liga as embalagens ao estoque certo (não bloqueia o salvar) ─────────
    // O pré-preparo já foi sincronizado acima, com identidade pela ficha. Antes
    // havia uma segunda criação aqui, por nome, que gerava itens duplicados.
    (async () => {
      try {
        const fichaId = erro.id;
        if (!fichaId) return;
        const dept = (form.departamento || deptUrl || "cozinha").toLowerCase();
        const { data: estoques } = await fetchEstoques(unidadeAtiva);
        const acharEstoque = (slug) => (estoques || []).find(e => String(e.slug || "").toLowerCase() === slug);

        // Embalagens usadas na ficha entram no estoque de Embalagens.
        const estoqueEmb = acharEstoque(dept === "bar" ? "embalagens-bar" : "embalagens-cozinha");
        if (estoqueEmb) {
          const idsEmbalagem = new Set(embalagensCat.map(e => e.id));
          for (const item of ingValidos) {
            if (item.tipo !== "insumo" || !idsEmbalagem.has(item.insumo_id)) continue;
            await vincularItemEstoque({
              unidadeId: unidadeAtiva, estoqueId: estoqueEmb.id,
              insumoId: item.insumo_id, custoUnitario: item.custo_unitario,
            });
          }
        }
      } catch { /* integração com estoque é acessória: nunca derruba o salvar */ }
    })();

    // Registra um retrato do custo no histórico (não bloqueia o salvar).
    const fichaIdHist = erro.id;
    if (fichaIdHist && !form.produto_pronto) {
      const custoTotalS = custoTotalFormulario(ingValidos);
      const unRs = String(form.rendimento_unidade || "porcao").toLowerCase();
      const rendS = Number(form.rendimento_porcoes) || 0;
      const pesoPorcaoS = Number(form.peso_porcao_g) || 0;
      const pesoTotalS = pesoTotalDaFicha(rendS, unRs, pesoPorcaoS);
      const porcS = (unRs === "porcao" || unRs === "un") ? rendS : (pesoPorcaoS > 0 && pesoTotalS > 0 ? pesoTotalS / pesoPorcaoS : rendS);
      const custoPorcaoS = porcS > 0 ? custoTotalS / porcS : custoTotalS;
      registrarCustoFicha({
        unidadeId: unidadeAtiva, fichaId: fichaIdHist, custoTotal: custoTotalS, custoPorcao: custoPorcaoS,
        origem: "edicao_ficha", usuarioNome: sessao?.nome || sessao?.user?.email || "",
      }).catch(() => {});
    }

    // O PREÇO DE VENDA agora é definido AQUI na ficha (seção CMV e Precificação)
    // e sincroniza com o produto do cardápio interno em toda gravação.
    const fichaIdSalva = erro.id;
    const precoVendaNum = Number(String(form.preco_venda ?? "").replace(",", ".")) || 0;
    if (!form.eh_base && fichaIdSalva) {
      try {
        const nome = form.nome_receita.trim();
        const { data: prodsAtu } = await fetchProdutos(unidadeAtiva, form.departamento);
        const prodExistente = (prodsAtu || []).find(p =>
          p.ficha_id === fichaIdSalva || (p.nome_produto || "").toLowerCase() === nome.toLowerCase()
        );
        if (prodExistente) {
          await salvarProduto({ id: prodExistente.id, preco_venda: precoVendaNum, embalagens: fichaEmbalagens });
        }
      } catch { /* sincronização de preço não bloqueia o salvar */ }
    }

    // PRATO/DRINK novo: cai automaticamente no Cardápio e no Guia de Montagem.
    // Pré-preparo não dispara nada (é só uma base).
    if (!form.id && !form.eh_base && fichaIdSalva) {
      try {
        const nome = form.nome_receita.trim();
        const ehBarDept = form.departamento === "bar";

        // 1) Cardápio: cria o produto já com o preço definido na ficha
        const { data: prods } = await fetchProdutos(unidadeAtiva, form.departamento);
        const jaTemProduto = (prods || []).some(p =>
          p.ficha_id === fichaIdSalva || (p.nome_produto || "").toLowerCase() === nome.toLowerCase()
        );
        if (!jaTemProduto) {
          await salvarProduto({
            unidade_id: unidadeAtiva,
            nome_produto: nome,
            categoria: ehBarDept ? (form.produto_pronto ? (form.categoria || "Outros produtos prontos") : "Drinks") : "Pratos Principais",
            departamento: form.departamento,
            tempo_preparo_base: 15,
            preco_venda: precoVendaNum,
            ficha_id: fichaIdSalva,
            composicao: form.produto_pronto ? [] : [{ ficha_id: fichaIdSalva, qtd: 1 }],
            embalagens: fichaEmbalagens,
          });
        }

        // 2) Guia de Montagem: entra como ficha pendente de montagem
        if (!form.produto_pronto) {
          const { data: monts } = await fetchMontagens(unidadeAtiva, form.departamento);
          const jaTemMontagem = (monts || []).some(m => chaveNomeMontagem(m.nome) === chaveNomeMontagem(nome));
          if (!jaTemMontagem) {
            await inserirMontagem({
              nome,
              tipo: ehBarDept ? "drink" : "prato",
              departamento: form.departamento,
              descritivo: "",
              foto_url: "",
              estrutura_ia: null,
              tempo_preparo: null,
              rendimento: "",
              observacoes: "Criado automaticamente pela Ficha Técnica.",
            }, unidadeAtiva);
          }
        }

        alert(`"${nome}" salvo!\n\n· Preço de venda: ${precoVendaNum > 0 ? "definido na ficha" : "pendente — edite a ficha e preencha em CMV e Precificação"}${form.produto_pronto ? "\n· Produto pronto — não exige ingredientes nem montagem" : "\n· Guia de Montagem — crie o passo a passo lá"}`);
      } catch { /* integrações não bloqueiam o salvar da ficha */ }
    }

    // A lista só recarrega agora, no fim. Preço de venda, embalagens e produto
    // do cardápio são gravados nos passos acima; recarregar antes deles trazia
    // a ficha sem essas informações e dava a impressão de que o salvar não
    // tinha pegado — só "pegava" no segundo salvamento, quando a leitura já
    // encontrava o que a primeira gravação tinha escrito.
    await carregar();

    // "Salvar e criar outra": limpa o formulário e continua no modal
    if (criarOutra) {
      setForm({ id: null, departamento: form.departamento, nome_receita: "", categoria: "", rendimento_porcoes: "1", modo_preparo: "", eh_base: false, produto_pronto: false, tipo_base: null, rendimento_unidade: "porcao", peso_porcao_g: "", imagem: "", tempo_preparo: "", validade_dias: "", observacoes: "", metodo_bar: "", preco_venda: "", cmv_meta: 30 });
      setIngFicha([]);
      setFichaEmbalagens([]);
      setNovaEmbalagem({ nome: "", custo: "" });
      setAutoSoma(true);
      setIaExplicacao("");
    }
  };

  const handleRemover = async (id) => {
    if(confirm("Deseja excluir esta ficha técnica permanentemente?")) {
       const { error } = await removerFicha(id);
       if (error) return alert(`Não consegui remover esta ficha: ${error}`);
       carregar();
    }
  };

  const toggleSelecionarTodas = () => {
    if (selecionadas.length === filtradas.length && filtradas.length > 0) {
      setSelecionadas([]);
    } else {
      setSelecionadas(filtradas.map(f => f.id));
    }
  };

  const toggleSelecionar = (id) => {
    setSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selecionarPaginaLote = () => {
    setSelecionadas(prev => [...new Set([...prev, ...fichasPagina.map(f => f.id)])]);
  };

  const selecionarResultadoLote = () => {
    setSelecionadas(prev => [...new Set([...prev, ...filtradas.map(f => f.id)])]);
  };

  const limparSelecaoLote = () => setSelecionadas([]);

  // Excluir exclui. Antes havia um diálogo que listava vínculo por vínculo e
  // oferecia inativar — e a ficha acabava não saindo. Uma confirmação do
  // navegador basta: quem apertou Excluir e confirmou já decidiu.
  //
  // Vai direto no caminho com vínculos: produto do cardápio, guia de montagem e
  // a linha desta ficha nas receitas que a usam saem junto. O histórico de
  // produção é preservado — as linhas ficam, só deixam de apontar para a ficha.
  const abrirExclusaoSegura = async (lista = fichasSelecionadas) => {
    if (!lista.length) return;
    const nomes = lista.slice(0, 6).map(f => f.nome_receita).join(", ");
    const resto = lista.length > 6 ? ` e mais ${lista.length - 6}` : "";
    if (!confirm(`Excluir ${lista.length} ficha(s)?\n\n${nomes}${resto}\n\nSaem junto o produto do cardápio, o guia de montagem e o uso como ingrediente de outras receitas. O histórico de produção é preservado. Não tem volta.`)) return;

    setProcessandoLote(true);
    setMensagemLote("");
    setErroLote(false);
    const resposta = await excluirFichasComVinculos(lista, usuarioAuditoria);
    setProcessandoLote(false);
    if (resposta.error) { setErroLote(true); return setMensagemLote(resposta.error); }
    setSelecionadas(prev => prev.filter(id => !lista.some(f => f.id === id)));
    await carregar();
  };

  const duplicarFichasSelecionadas = async () => {
    if (!fichasSelecionadas.length || !confirm(`Duplicar ${fichasSelecionadas.length} ficha(s) selecionada(s)?`)) return;
    setProcessandoLote(true);
    const nomes = new Set(fichas.map(f => String(f.nome_receita || "").toLocaleLowerCase("pt-BR")));
    const criadas = [];
    for (const origem of fichasSelecionadas) {
      let indice = 1;
      let nome = `${origem.nome_receita} (cópia)`;
      while (nomes.has(nome.toLocaleLowerCase("pt-BR"))) {
        indice += 1;
        nome = `${origem.nome_receita} (cópia ${indice})`;
      }
      nomes.add(nome.toLocaleLowerCase("pt-BR"));
      const { id, created_at, updated_at, fichas_ingredientes, ativo, ...campos } = origem;
      const ingredientes = (fichas_ingredientes || []).map(item => ({
        insumo_id: item.insumo_id || item.insumos?.id || null,
        subficha_id: item.subficha_id || null,
        quantidade: item.quantidade,
        fator_correcao: item.fator_correcao || 0,
      }));
      const resultado = await salvarFicha({ ...campos, nome_receita: nome, ativo: true }, ingredientes);
      if (!resultado.error) criadas.push({ id: resultado.id, nome_receita: nome });
    }
    await registrarAuditoriaFichas({
      ...usuarioAuditoria,
      acao: "duplicacao",
      fichas: criadas,
      detalhes: { originais: fichasSelecionadas.map(f => f.id) },
    });
    setProcessandoLote(false);
    setSelecionadas([]);
    setMensagemLote(`${criadas.length} cópia(s) criada(s) sem alterar as fichas originais.`);
    await carregar();
    window.setTimeout(() => setMensagemLote(""), 3500);
  };

  const abrirPreviaImpressao = (modo, lista = fichasSelecionadas) => {
    if (!lista.length) return;
    const livroAutomatico = modo === "livro" || lista.length >= 6;
    const modelo = modo === "livro" ? "livro" : podeImprimirCustos ? "gerencial" : "operacional";
    setOrdemPersonalizada(lista.map(f => f.id));
    setConfigImpressao({
      ordem: "selecao", formato: "a4-retrato", modelo,
      foto: true, ingredientes: true,
      custos: podeImprimirCustos && modelo !== "operacional",
      preco: podeImprimirCustos && modelo !== "operacional",
      cmv: podeImprimirCustos && modelo !== "operacional",
      margem: podeImprimirCustos && modelo !== "operacional",
      preparo: true, montagem: true, observacoes: true,
      responsaveis: true, atualizacao: true,
      capa: livroAutomatico, indice: livroAutomatico, livro: livroAutomatico,
    });
    setModalImpressao({ modo, lista });
  };

  const moverFichaNaPrevia = (id, direcao) => {
    setOrdemPersonalizada(atual => {
      const proxima = [...atual];
      const indice = proxima.indexOf(id);
      const destino = indice + direcao;
      if (indice < 0 || destino < 0 || destino >= proxima.length) return atual;
      [proxima[indice], proxima[destino]] = [proxima[destino], proxima[indice]];
      return proxima;
    });
    setConfigImpressao(atual => ({ ...atual, ordem: "personalizada" }));
  };

  const listaOrdenadaPrevia = () => ordenarFichasDocumento(
    modalImpressao?.lista || [],
    configImpressao?.ordem,
    ordemPersonalizada,
  );

  const gerarDocumentoConfigurado = async (acao) => {
    const lista = listaOrdenadaPrevia();
    if (!lista.length) return;
    const html = montarHtmlFichas(lista, configImpressao);
    if (acao === "pdf") {
      baixarPdfDeHtml(html, configImpressao?.livro ? "livro-de-fichas" : "fichas-tecnicas");
    } else {
      const win = window.open("", "_blank");
      if (!win) return alert("Habilite pop-ups para imprimir.");
      win.document.write(comFecharImpressao(html));
      win.document.close();
      setTimeout(() => win.print(), 800);
    }
    await registrarAuditoriaFichas({
      ...usuarioAuditoria,
      acao: configImpressao?.livro ? "livro" : acao === "pdf" ? "pdf" : "impressao",
      fichas: lista,
      detalhes: configImpressao,
    });
  };

  const salvarModeloImpressao = () => {
    try {
      localStorage.setItem("hefisto_modelo_impressao_fichas", JSON.stringify(configImpressao));
      setMensagemLote("Modelo de impressão salvo neste dispositivo.");
      window.setTimeout(() => setMensagemLote(""), 3000);
    } catch {
      setMensagemLote("Não foi possível salvar o modelo.");
    }
  };

  const imprimirLivroSelecionadas = () => {
    if (selecionadas.length === 0) return;
    const fichasParaImprimir = fichas.filter(f => selecionadas.includes(f.id));
    imprimirFichas(fichasParaImprimir);
  };

  const imprimirFicha = (f) => {
    imprimirFichas([f]);
  };

  const imprimirFichas = (listaDeFichas) => {
    const html = montarHtmlFichas(listaDeFichas);
    const win = window.open('', '_blank');
    if(!win) return alert("Habilite pop-ups para imprimir a ficha.");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  // PDF de verdade (download direto) — a ficha avulsa ou o Livro completo.
  const baixarPdfFichas = (listaDeFichas, nomeArquivo) => {
    const nome = nomeArquivo || (listaDeFichas.length === 1
      ? (listaDeFichas[0].nome_receita || "ficha-tecnica")
      : "livro-de-receitas");
    baixarPdfDeHtml(montarHtmlFichas(listaDeFichas), nome);
  };

  const montarHtmlFichas = (listaDeFichas, opcoes = {}) => {
    const SUB = { kg: { s: 'g', fa: 1000 }, l: { s: 'ml', fa: 1000 } };
    const fmtQtd = (qtd, un) => {
       const c = SUB[String(un || '').toLowerCase()];
       return c ? `${(+(qtd * c.fa)).toLocaleString('pt-BR')} ${c.s}` : `${qtd} ${String(un || '').toUpperCase()}`;
    };
    
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const fmtBRL = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDataBR = (d) => { if (!d) return '—'; const dt = new Date(d); return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR'); };
    const completo = !opcoes.modelo || opcoes.modelo === "gerencial" || opcoes.modelo === "livro";
    const incluir = (campo, padrao = true) => opcoes[campo] === undefined ? padrao : !!opcoes[campo];
    const paginaPaisagem = opcoes.formato === "a4-paisagem";
    const permitirCustos = podeImprimirCustos && completo && incluir("custos", false);

    let conteudoHTML = `
       <!DOCTYPE html><html><head><meta charset="utf-8"/><title>Livro de Receitas</title>
       <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:16mm 14mm;max-width:820px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .ficha{page-break-inside:avoid;margin-bottom:26px}
          .ficha + .ficha{border-top:1px solid #e2e8f0;padding-top:22px}
          .quebra{page-break-after:always}
          /* Cabeçalho: foto quadrada à esquerda, dados à direita */
          .topo{display:flex;gap:18px;align-items:flex-start;margin-bottom:16px}
          .foto{width:230px;height:230px;object-fit:cover;border-radius:6px;background:#f1f5f9;border:1px solid #cbd5e1;flex-shrink:0}
          .foto-vazia{width:230px;height:230px;border-radius:6px;background:#f1f5f9;border:1px dashed #cbd5e1;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;font-weight:bold}
          .cab{flex:1;min-width:0}
          .rotulo{text-align:right;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
          .titulo{text-align:right;font-size:22px;font-weight:800;line-height:1.15;margin:2px 0 14px;color:#0f172a}
          /* Metadados em grade (linhas e colunas) */
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 22px}
          .campo{font-size:12.5px;color:#334155}
          .campo b{color:#0f172a}
          .campo.full{grid-column:1 / -1}
          /* Seções e tabelas */
          h2{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#0f172a;margin:18px 0 6px;text-align:right;border-bottom:2px solid #0f172a;padding-bottom:4px}
          table{width:100%;border-collapse:collapse;font-size:13px}
          th,td{text-align:left;padding:7px 10px}
          thead th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:2px solid #cbd5e1;font-weight:bold}
          tbody td{font-weight:600;border-bottom:1px solid #eef2f7}
          tbody tr:nth-child(even){background:#f5f7fa}
          td.r,th.r{text-align:right}
          .rende td,.rende th{white-space:nowrap}
          /* Modo de preparo em passos com linhas alternadas */
          .passos{margin-top:4px}
          .passo{font-size:13px;line-height:1.5;padding:7px 10px;font-weight:600}
          .passo:nth-child(even){background:#f5f7fa}
          .passo b{color:#0f172a;margin-right:4px}
          @media print{@page{size:A4 ${paginaPaisagem ? "landscape" : "portrait"};margin:12mm}}
          .capa{height:88vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}
          .capa h1{font-size:46px;margin-bottom:14px}
          .capa p{font-size:18px;color:#64748b}
          /* Livro: cada ficha em 1 página numerada; índice por seções */
          .pagina-livro{page-break-after:always;display:flex;flex-direction:column;height:246mm;overflow:hidden;margin-bottom:0}
          .pagina-livro:last-child{page-break-after:auto}
          .conteudo-pg{flex:1;min-height:0}
          .ficha-metade + .ficha-metade{border-top:2px dashed #cbd5e1;margin-top:10px;padding-top:12px}
          .ficha-metade .foto,.ficha-metade .foto-vazia{width:150px;height:150px}
          .rodape-livro{margin-top:auto;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1px}
          .indice{page-break-after:always;min-height:246mm;display:flex;flex-direction:column}
          .indice h1{font-size:24px;text-transform:uppercase;letter-spacing:4px;margin-bottom:16px;border-bottom:3px solid #0f172a;padding-bottom:8px}
          .ind-sec{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#0f172a;margin:12px 0 5px}
          .ind-item{display:flex;align-items:baseline;gap:6px;font-size:13px;font-weight:600;padding:2.5px 0;color:#334155}
          .ind-item .pontos{flex:1;border-bottom:2px dotted #cbd5e1}
          .ind-item .pg{font-weight:900;color:#0f172a}
       </style></head><body>
    `;

    // ── LIVRO DE RECEITAS: seções, capa, índice e páginas numeradas ──────────
    // Seções do livro (nesta ordem). No Bar, xaropes, espumas e geleias ganham
    // capítulos próprios para facilitar a produção e a consulta da equipe.
    const ORDEM_SECOES = ['Xaropes', 'Espumas', 'Geleias', 'Mixes e Infusões', 'Pré-preparos', 'Preparos', 'Sobremesas', 'Sucos', 'Molhos'];
    const secaoDe = (f) => {
      const nome = String(f.nome_receita || '').toLowerCase();
      const cat = String(f.categoria || '').toLowerCase();
      if (nome.includes('xarope') || cat.includes('xarope')) return 'Xaropes';
      if (nome.includes('espuma') || cat.includes('espuma')) return 'Espumas';
      if (nome.includes('geleia') || nome.includes('geléia') || cat.includes('geleia')) return 'Geleias';
      if (cat.includes('mix') || cat.includes('infus') || nome.includes('infusão') || nome.includes('infusao')) return 'Mixes e Infusões';
      if (nome.includes('molho') || cat.includes('molho')) return 'Molhos';
      if (f.eh_base && f.tipo_base !== 'receita') return 'Pré-preparos';
      if (cat === 'sobremesas') return 'Sobremesas';
      if (cat === 'sucos') return 'Sucos';
      return 'Preparos';
    };
    const ehLivro = !!opcoes.livro || listaDeFichas.length >= 6;
    const lista = [...listaDeFichas];
    // Capa e índice são montados DEPOIS, quando as páginas já foram distribuídas
    // (receitas pequenas se combinam 2 por página; as grandes se comprimem).
    const dados = lista.map((f) => {
      const custoTotal = custoTotalDaFicha(f, fichas);
      const rende = Number(f.rendimento_porcoes) || 1;
      const peso = infoPesoFicha(f, fichas);
      const unR = String(f.rendimento_unidade || 'porcao').toLowerCase();
      const porcoesTxt = unR === 'porcao'
         ? Number(rende).toLocaleString('pt-BR')
         : (peso && peso.porcoes ? Number(peso.porcoes).toLocaleString('pt-BR') : '—');
      const custoPorcaoBase = unR === 'porcao' ? rende : (peso && peso.porcoes ? peso.porcoes : 0);
      const custoPorcao = custoPorcaoBase > 0 ? custoTotal / custoPorcaoBase : 0;
      const produto = produtos.find(item => item.ficha_id === f.id
        || String(item.nome_produto || "").toLocaleLowerCase("pt-BR") === String(f.nome_receita || "").toLocaleLowerCase("pt-BR"));
      const precoVenda = Number(produto?.preco_venda) || 0;
      const cmv = precoVenda > 0 ? (custoPorcao / precoVenda) * 100 : null;
      const margem = cmv === null ? null : 100 - cmv;
      const montagem = montagens.find(item =>
        String(item.nome || "").toLocaleLowerCase("pt-BR") === String(f.nome_receita || "").toLocaleLowerCase("pt-BR"));
      // Rendimento = só o peso em GRAMAS. Se estiver em kg (ou L), converte p/ g.
      const pesoGramas = (peso && peso.pesoTotalG) ? peso.pesoTotalG
         : (unR === 'kg' || unR === 'l') ? rende * 1000
         : (unR === 'g' || unR === 'ml') ? rende
         : 0;

      // Itens do preparo: Tipo | Nome | Medida | Quantidade total
      const rows = (f.fichas_ingredientes || []).map(fi => {
         let tipo = 'Insumo', nome = '', unidade = '';
         if (fi.insumos) {
            tipo = fi.insumos.categoria || 'Insumo';
            nome = fi.insumos.nome;
            unidade = fi.insumos.unidade_medida;
         } else if (fi.subficha_id) {
            const base = fichas.find(x => x.id === fi.subficha_id);
            tipo = 'Receita';
            nome = base ? base.nome_receita : 'Base excluída';
            unidade = base?.rendimento_unidade || 'un';
         }
         return `<tr><td>${esc(tipo)}</td><td>${esc(nome)}</td><td>${esc(String(unidade || '').toUpperCase())}</td><td class="r">${fmtQtd(fi.quantidade, unidade)}</td></tr>`;
      }).join('');

      const foto = incluir("foto") && f.imagem
         ? `<img src="data:image/jpeg;base64,${f.imagem}" class="foto" />`
         : incluir("foto") ? `<div class="foto-vazia">SEM FOTO</div>` : "";
      const tipoFicha = f.eh_base ? 'Receita base' : 'Produto de venda';
      const deptLabel = f.departamento === 'bar' ? 'Bar' : (f.departamento === 'cozinha' ? 'Cozinha' : (f.departamento || '—'));

      // Passos do modo de preparo (remove numeração já existente e re-enumera)
      const passos = String(f.modo_preparo || '')
         .split(/\r?\n+/).map(s => s.trim().replace(/^\d+[.)-]\s*/, '')).filter(Boolean);
      const passosHTML = passos.length
         ? passos.map((s, i) => `<div class="passo"><b>${i + 1}.</b> ${esc(s)}</div>`).join('')
         : `<div class="passo">Não informado.</div>`;

      const corpo = `
            <div class="topo">
               ${foto}
               <div class="cab">
                  <div class="rotulo">${ehLivro ? 'Livro de Receitas · ' + esc(secaoDe(f)) : 'Ficha Técnica'}</div>
                  <div class="titulo">${esc(f.nome_receita)}</div>
                  <div class="grid">
                     <div class="campo"><b>Categoria:</b> ${esc(f.categoria || deptLabel)}</div>
                     <div class="campo"><b>Área:</b> ${esc(deptLabel)}</div>
                     <div class="campo"><b>Tempo de preparo:</b> ${f.tempo_preparo != null && f.tempo_preparo !== '' ? esc(String(f.tempo_preparo)) + ' min' : '—'}</div>
                     ${metodoBar(f.metodo_bar) ? `<div class="campo"><b>Método:</b> ${esc(metodoBar(f.metodo_bar).nome)}</div>` : ''}
                     ${incluir("atualizacao") ? `<div class="campo"><b>Data de criação:</b> ${fmtDataBR(f.created_at)}</div>
                     <div class="campo"><b>Última atualização:</b> ${fmtDataBR(f.updated_at)}</div>` : ""}
                     ${incluir("responsaveis") && f.responsavel ? `<div class="campo full"><b>Responsável:</b> ${esc(f.responsavel)}</div>` : ""}
                     ${incluir("observacoes") && f.observacoes ? `<div class="campo full"><b>Observações:</b> ${esc(f.observacoes)}</div>` : ''}
                  </div>
               </div>
            </div>

            <h2>Quantidade</h2>
            <table class="rende">
               <thead><tr><th>Peso total</th></tr></thead>
               <tbody><tr><td>${pesoGramas > 0 ? Math.round(pesoGramas).toLocaleString('pt-BR') + ' g' : '—'}</td></tr></tbody>
            </table>

            ${incluir("ingredientes") ? `<h2>Itens do preparo</h2>
            <table>
               <thead><tr><th>Tipo</th><th>Nome</th><th>Medida</th><th class="r">Quantidade total</th></tr></thead>
               <tbody>${rows || '<tr><td colspan="4">Sem itens cadastrados.</td></tr>'}</tbody>
            </table>` : ""}

            ${permitirCustos ? `<h2>Custos e precificação</h2>
            <table><thead><tr>
              <th>Custo total</th><th>Custo/porção</th>
              ${incluir("preco", false) ? "<th>Preço de venda</th>" : ""}
              ${incluir("cmv", false) ? "<th>CMV</th>" : ""}
              ${incluir("margem", false) ? "<th>Margem</th>" : ""}
            </tr></thead><tbody><tr>
              <td>${fmtBRL(custoTotal)}</td><td>${fmtBRL(custoPorcao)}</td>
              ${incluir("preco", false) ? `<td>${precoVenda > 0 ? fmtBRL(precoVenda) : "—"}</td>` : ""}
              ${incluir("cmv", false) ? `<td>${cmv === null ? "—" : cmv.toFixed(1) + "%"}</td>` : ""}
              ${incluir("margem", false) ? `<td>${margem === null ? "—" : margem.toFixed(1) + "%"}</td>` : ""}
            </tr></tbody></table>` : ""}

            ${incluir("preparo") ? `<h2>Modo de preparo</h2><div class="passos">${passosHTML}</div>` : ""}
            ${incluir("montagem") ? `<h2>Guia de montagem</h2><div class="passos"><div class="passo">${esc(montagem?.descritivo || montagem?.observacoes || "Não informado.")}</div></div>` : ""}`;

      // Altura estimada (≈mm) para decidir se cabe DUAS na mesma página
      const score = (f.imagem ? 80 : 38) + 34 + (f.fichas_ingredientes || []).length * 7 + 10 + passos.length * 7 + (f.observacoes ? 8 : 0);
      return { f, corpo, score, secao: ehLivro ? secaoDe(f) : '' };
    });

    if (ehLivro) {
      // Distribui: duas receitas PEQUENAS da mesma seção dividem a página;
      // as demais ganham página inteira (e o script comprime se estourar).
      const paginasLivro = [];
      // Empacota até 4 receitas curtas da mesma seção por página (cards de
      // preparo rápido); as maiores ficam sozinhas e o script comprime.
      let i = 0;
      while (i < dados.length) {
        const pg = [dados[i]];
        let soma = dados[i].score;
        let j = i + 1;
        while (j < dados.length && pg.length < 4 && dados[j].secao === dados[i].secao && (soma + dados[j].score + 14 * pg.length) <= 226) {
          soma += dados[j].score;
          pg.push(dados[j]);
          j++;
        }
        paginasLivro.push(pg);
        i = j;
      }
      const paginasIniciais = (incluir("capa", true) ? 1 : 0) + (incluir("indice", true) ? 1 : 0);
      const paginaPorFicha = {};
      paginasLivro.forEach((pg, pi) => pg.forEach(x => { paginaPorFicha[x.f.id] = pi + paginasIniciais + 1; }));

      if (incluir("capa", true)) conteudoHTML += `
         <div class="capa">
           <div style="margin-bottom:26px">${logoSeldeestrelaSVG(70)}</div>
           <h1>Livro de Receitas</h1>
           <p>${lista.length} receitas catalogadas</p>
           <p style="margin-top:8px;font-size:15px">${esc(unidadeInfo?.nome || "")}</p>
           <p style="margin-top:8px;font-size:14px;color:#94a3b8">${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
         </div>
       `;
      let indiceHTML = '';
      ORDEM_SECOES.forEach((sec) => {
        const doGrupo = dados.filter(x => x.secao === sec);
        if (!doGrupo.length) return;
        indiceHTML += `<div class="ind-sec">${sec}</div>` + doGrupo.map(x =>
          `<div class="ind-item"><span>${esc(x.f.nome_receita)}</span><span class="pontos"></span><span class="pg">${paginaPorFicha[x.f.id]}</span></div>`
        ).join('');
      });
      if (incluir("indice", true)) conteudoHTML += `
         <div class="indice">
           <h1>Índice</h1>
           ${indiceHTML}
           <div class="rodape-livro"><span>${esc(unidadeInfo?.nome || '')}</span><span>Página ${incluir("capa", true) ? 2 : 1}</span></div>
         </div>
       `;
      paginasLivro.forEach((pg, pi) => {
        conteudoHTML += `
         <div class="pagina-livro">
            <div class="conteudo-pg">${pg.map(x => `<div class="ficha${pg.length >= 2 ? ' ficha-metade' : ''}">${x.corpo}</div>`).join('')}</div>
            <div class="rodape-livro"><span>${esc(pg[0].secao)} · ${esc(unidadeInfo?.nome || '')}</span><span>Página ${pi + paginasIniciais + 1}</span></div>
         </div>`;
      });
      // Receita/página maior que a folha? Comprime até caber — nunca vaza.
      conteudoHTML += `<script>addEventListener('load',function(){document.querySelectorAll('.pagina-livro').forEach(function(pg){var c=pg.querySelector('.conteudo-pg');if(!c)return;if(c.scrollHeight>c.clientHeight+4){c.style.zoom=Math.max(0.5,c.clientHeight/c.scrollHeight);}});});<\/script>`;
    } else {
      // Ficha(s) avulsa(s): logo da marca no topo de cada folha impressa.
      conteudoHTML += dados.map((x, indice) => `<div class="ficha${dados.length > 1 && indice < dados.length - 1 ? " quebra" : ""}"><div style="display:flex;justify-content:center;margin-bottom:10px">${logoSeldeestrelaSVG(40)}</div>${x.corpo}</div>`).join('');
    }

    conteudoHTML += `</body></html>`;
    return conteudoHTML;
  };

  // ── PLANILHA DE CUSTOS: custo, venda, CMV por receita + CMV médio ──────────
  const imprimirPlanilhaCustos = () => {
    const win = window.open('', '_blank');
    if (!win) return alert('Habilite pop-ups para imprimir.');
    const esc2 = (v) => String(v == null ? '' : v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const brl = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const linhas = fichas.filter(f => !f.eh_base).map(f => {
      const custoTotal = custoTotalDaFicha(f, fichas);
      const peso = infoPesoFicha(f, fichas);
      const unR = String(f.rendimento_unidade || 'porcao').toLowerCase();
      const porcoes = (unR === 'porcao' || unR === 'un') ? (Number(f.rendimento_porcoes) || 1) : (peso?.porcoes || 0);
      const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
      const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || '').toLowerCase() === String(f.nome_receita || '').toLowerCase());
      const preco = Number(prod?.preco_venda) || 0;
      const cmv = preco > 0 ? (custoPorcao / preco) * 100 : null;
      return { nome: f.nome_receita, cat: f.categoria || (f.departamento === 'bar' ? 'Bar' : 'Cozinha'), custoTotal, custoPorcao, preco, cmv };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const comCmv = linhas.filter(l => l.cmv !== null);
    const cmvMedio = comCmv.length ? comCmv.reduce((s, l) => s + l.cmv, 0) / comCmv.length : null;
    const rows = linhas.map(l => `<tr><td>${esc2(l.nome)}</td><td>${esc2(l.cat)}</td><td class="r">${brl(l.custoTotal)}</td><td class="r">${brl(l.custoPorcao)}</td><td class="r">${l.preco > 0 ? brl(l.preco) : '—'}</td><td class="r ${l.cmv === null ? '' : l.cmv > 35 ? 'ruim' : 'bom'}">${l.cmv !== null ? l.cmv.toFixed(1) + '%' : '—'}</td></tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Planilha de Custos</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;padding:12mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #0f172a;padding-bottom:6px;margin-bottom:4px}
      .sub{font-size:11px;color:#64748b;font-weight:bold;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
      th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:2px solid #cbd5e1}
      td.r,th.r{text-align:right}tbody tr:nth-child(even){background:#f5f7fa}
      td.bom{color:#047857;font-weight:900}td.ruim{color:#dc2626;font-weight:900}
      tfoot td{border-top:2px solid #0f172a;font-weight:900;font-size:13px;padding-top:8px}
      @media print{@page{margin:10mm}}
    </style></head><body>
      <div style="display:flex;justify-content:center;margin-bottom:10px">${logoSeldeestrelaSVG(42)}</div>
      <h1>Planilha de Custos e CMV</h1>
      <div class="sub">${esc2(unidadeInfo?.nome || '')} · ${new Date().toLocaleDateString('pt-BR')} · ${linhas.length} receita(s)</div>
      <table><thead><tr><th>Receita</th><th>Categoria</th><th class="r">Custo total</th><th class="r">Custo/porção</th><th class="r">Preço de venda</th><th class="r">CMV</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5">CMV médio da carta (${comCmv.length} precificada(s))</td><td class="r">${cmvMedio !== null ? cmvMedio.toFixed(1) + '%' : '—'}</td></tr></tfoot></table>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ── IMPORTAR CARDÁPIO (foto): IA extrai pratos/sobremesas/sucos com preço ──
  const inputCardapioRef = useRef(null);
  const [importandoCardapio, setImportandoCardapio] = useState(false);
  const importarCardapioFoto = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setImportandoCardapio(true);
    try {
      // Lê cada foto do cardápio (várias páginas de uma vez) e junta os itens,
      // sem repetir o mesmo prato que aparece em duas fotos.
      const itensTotais = [];
      const vistos = new Set();
      let falhas = 0;
      for (const file of files) {
        try {
          const base64 = await fileParaBase64(file);
          const res = await fetch("/api/ia-cardapio", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagem_base64: base64, media_type: "image/jpeg" }),
          });
          const data = await res.json();
          if (!res.ok || data.error) { falhas++; continue; }
          for (const i of (data.itens || [])) {
            const chave = i.nome.toLowerCase().trim();
            if (!vistos.has(chave)) { vistos.add(chave); itensTotais.push(i); }
          }
        } catch { falhas++; }
      }
      if (!itensTotais.length) { alert(falhas ? "Não consegui ler nenhuma das fotos. Tente fotos mais nítidas." : "Nenhum item lido no cardápio."); return; }
      const jaExiste = new Set(fichas.map(f => String(f.nome_receita || "").toLowerCase()));
      const novos = itensTotais.filter(i => !jaExiste.has(i.nome.toLowerCase()));
      if (!novos.length) { alert("Todos os itens das fotos já estão cadastrados."); return; }
      const avisoFalhas = falhas ? `\n(${falhas} foto(s) não puderam ser lidas.)` : "";
      const resumo = novos.map(i => `• ${i.nome} (${i.categoria}) — R$ ${i.preco.toFixed(2)}`).join("\n");
      if (!confirm(`A IA leu ${novos.length} item(ns) novos em ${files.length} foto(s):\n\n${resumo}${avisoFalhas}\n\nCriar as fichas já com o preço de venda? (depois é só abrir cada uma e pôr os ingredientes)`)) return;
      let ok = 0;
      for (const item of novos) {
        const catFicha = item.categoria === "Sobremesa" ? "Sobremesas" : item.categoria === "Suco" ? "Sucos" : "";
        const r = await salvarFicha({
          unidade_id: unidadeAtiva,
          // O setor é o da tela. Importar o cardápio na cozinha criava fichas
          // no bar quando a IA classificava o item como drink, e elas sumiam
          // da lista de quem acabou de importar.
          departamento: deptUrl,
          nome_receita: item.nome,
          categoria: catFicha || null,
          rendimento_porcoes: 1,
          rendimento_unidade: "porcao",
          modo_preparo: "",
          eh_base: false,
        }, []);
        if (r?.id) {
          await salvarProduto({
            unidade_id: unidadeAtiva,
            nome_produto: item.nome,
            categoria: item.categoria === "Drink" ? "Drinks" : (catFicha || "Pratos Principais"),
            departamento: deptUrl,
            tempo_preparo_base: 15,
            preco_venda: item.preco,
            ficha_id: r.id,
            composicao: [{ ficha_id: r.id, qtd: 1 }],
          });
          ok++;
        }
      }
      alert(`${ok} ficha(s) criadas com preço de venda a partir de ${files.length} foto(s)! Abra cada uma e adicione os ingredientes.`);
      carregar();
    } catch { alert("Não consegui falar com a IA."); } finally { setImportandoCardapio(false); }
  };

  // ── MANUAL estilo pôster (coquetelaria/cozinha): nome + foto + medidas ─────
  // Gera um cartaz em 2 colunas com todas as fichas do departamento, no estilo
  // "Manual de Coquetelaria": fundo creme, nome em destaque e ingredientes
  // com as quantidades — para imprimir e colar na parede do bar/cozinha.
  const fmtQtdManual = (q, un) => {
    const u = String(un || "").toLowerCase();
    const n = Number(q) || 0;
    if (u === "kg") return n < 1 ? `${Math.round(n * 1000)}g` : `${(+n.toFixed(2)).toLocaleString("pt-BR")}kg`;
    if (u === "l") return n < 1 ? `${Math.round(n * 1000)}ml` : `${(+n.toFixed(2)).toLocaleString("pt-BR")}L`;
    if (u === "g" || u === "ml") return `${(+n.toFixed(1)).toLocaleString("pt-BR")}${u}`;
    return `${(+n.toFixed(2)).toLocaleString("pt-BR")}un`;
  };

  const imprimirManual = () => {
    const lista = [...filtradas].sort((a, b) => a.nome_receita.localeCompare(b.nome_receita, "pt-BR"));
    if (!lista.length) return alert("Nenhuma ficha para montar o manual.");
    const ehBar = deptUrl === "bar";
    const titulo = ehBar ? "MANUAL DE COQUETELARIA" : "MANUAL DA COZINHA";

    const itens = lista.map(f => {
      const ings = (f.fichas_ingredientes || []).map(fi => {
        if (fi.insumos) return { nome: fi.insumos.nome, qtd: fmtQtdManual(fi.quantidade, fi.insumos.unidade_medida) };
        if (fi.subficha_id) {
          const base = fichas.find(x => x.id === fi.subficha_id);
          return base ? { nome: base.nome_receita, qtd: fmtQtdManual(fi.quantidade, base.rendimento_unidade || "un") } : null;
        }
        return null;
      }).filter(Boolean);
      const foto = f.imagem
        ? `<img src="data:image/jpeg;base64,${f.imagem}" alt=""/>`
        : `<span>${(f.nome_receita || "?")[0].toUpperCase()}</span>`;
      const peso = infoPesoFicha(f, fichas);
      const unR = String(f.rendimento_unidade || 'porcao').toLowerCase();
      const pesoG = (peso && peso.pesoTotalG) ? peso.pesoTotalG : (unR === 'kg' || unR === 'l') ? (Number(f.rendimento_porcoes) || 0) * 1000 : (unR === 'g' || unR === 'ml') ? (Number(f.rendimento_porcoes) || 0) : 0;
      return `
      <div class="item">
        <div class="foto">${foto}</div>
        <div class="info">
          <h3>${f.nome_receita}${pesoG > 0 ? `<span class="peso"> · ${Math.round(pesoG).toLocaleString("pt-BR")} g</span>` : ""}</h3>
          <ul>${ings.map(i => `<li><b>${i.qtd}</b> ${i.nome}</li>`).join("") || "<li>Sem ingredientes cadastrados</li>"}</ul>
        </div>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${titulo} - ${unidadeAtiva}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:12mm 10mm}
        .cabeca{border-bottom:3px solid #0f172a;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
        .cabeca h1{font-size:20px;letter-spacing:2px;font-weight:800;text-transform:uppercase}
        .cabeca p{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748b;font-weight:bold}
        .grade{column-count:2;column-gap:9mm}
        .item{display:flex;gap:10px;align-items:flex-start;break-inside:avoid;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #e2e8f0}
        .foto{width:50px;height:50px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#f1f5f9;color:#334155;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;border:1px solid #cbd5e1}
        .foto img{width:100%;height:100%;object-fit:cover}
        .info{min-width:0}
        .info h3{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;color:#0f172a}
        .info h3 .peso{font-weight:700;color:#64748b;text-transform:none;letter-spacing:0}
        .info ul{list-style:none}
        .info li{font-size:10.5px;color:#334155;line-height:1.55}
        .info li b{color:#059669}
        .rodape{text-align:center;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-top:12px;border-top:1px solid #cbd5e1;padding-top:8px}
        @media print{@page{margin:10mm}}
      </style></head><body>
      <div class="cabeca">
        <div style="display:flex;justify-content:center;margin-bottom:8px">${logoSeldeestrelaSVG(40)}</div>
        <h1>${titulo}</h1>
        <p>${unidadeInfo?.nome || ""} · receituário ${ehBar ? "do bar" : "da cozinha"}</p>
      </div>
      <div class="grade">${itens}</div>
      <div class="rodape">${lista.length} receitas · uso interno · ${new Date().toLocaleDateString("pt-BR")}</div>
      </body></html>`;

    let win2 = null;
    try { win2 = window.open("", "_blank", "width=860,height=1000"); } catch { win2 = null; }
    if (!win2) {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        document.body.appendChild(iframe);
        iframe.srcdoc = html;
        iframe.onload = () => {
          setTimeout(() => {
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert("Não consegui abrir a impressão: " + e.message); }
            setTimeout(() => iframe.remove(), 60000);
          }, 400);
        };
        return;
      } catch (e) {
        return alert("O navegador bloqueou a impressão. Habilite os popups.\n\nDetalhe: " + e.message);
      }
    }
    win2.document.write(comFecharImpressao(html));
    win2.document.close();
    setTimeout(() => win2.print(), 500);
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <button onClick={abrirMenu} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900" title="Voltar ao menu">
                <ArrowLeft size={19} />
              </button>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950">{deptUrl === "bar" ? "Fichas técnicas do Bar" : "Fichas técnicas da Cozinha"}</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">{modoFicha === "preparos"
                  ? (deptUrl === "bar" ? "Produção de xaropes, espumas, infusões e bases do bar" : "Produção de molhos, caldos, massas e receitas-base da cozinha")
                  : (deptUrl === "bar" ? "Montagem, custos e margens de drinks e bebidas" : "Montagem de pratos, rendimento, custo e CMV para o cardápio")}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
            <button onClick={() => { if (!fichas.length) return alert("Nenhuma ficha para o livro."); abrirPreviaImpressao("livro", fichas); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"><Printer size={14} /> Livro de receitas</button>
            <button onClick={() => { if (!fichas.length) return alert("Nenhuma ficha para o livro."); abrirPreviaImpressao("pdf", fichas); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"><Download size={14} /> Baixar PDF</button>
            <button onClick={imprimirPlanilhaCustos} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"><Calculator size={14} /> Custos e CMV</button>
            <button onClick={registrarCustoTodasFichas} disabled={semeandoCustos} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">{semeandoCustos ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{semeandoCustos ? "Registrando..." : "Registrar custos"}</button>
            <input ref={inputCardapioRef} type="file" accept="image/*" multiple onChange={importarCardapioFoto} className="hidden" />
            <button onClick={() => inputCardapioRef.current?.click()} disabled={importandoCardapio} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">{importandoCardapio ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Importar cardápio</button>
          </div>
        </div>
      </header>

      {/* A busca e o CMV médio ficam FORA do <header>. Um elemento sticky só
          gruda enquanto o pai está na tela: dentro do cabeçalho, ele saía de
          vista junto com o título logo na primeira rolagem. Aqui o pai é a
          página inteira, então a faixa acompanha a lista até o fim. */}
      {/* A faixa de busca gruda no topo com margens zeradas: a classe
          .erp-busca-fixa nasceu para viver dentro de um container com padding e
          traz margens negativas de 4px. Aqui ela ocupa a largura toda, e essas
          margens empurrariam a página 8px além da tela. */}
      <div className="erp-busca-fixa border-b border-slate-200 bg-white" style={{ marginLeft: 0, marginRight: 0 }}>
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-2.5 sm:flex-row sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {resumoCardapio.totalFichas > 0 && (() => {
              const cmv = resumoCardapio.cmvMedio;
              const alto = cmv != null && cmv > 35;
              return (
                <button type="button" onClick={() => setMostrarIndicadores(valor => !valor)} title="Ver todos os indicadores do cardápio"
                  className={`flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 shadow-sm transition-colors ${alto ? "border-red-200 bg-red-50 hover:bg-red-100" : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"}`}>
                  <Calculator size={18} className={`shrink-0 ${alto ? "text-red-600" : "text-emerald-700"}`} />
                  <span className="text-left">
                    <span className="block text-[9px] font-black uppercase tracking-wider leading-none text-slate-500">CMV médio</span>
                    <span className={`block text-lg font-black leading-tight ${alto ? "text-red-600" : "text-emerald-700"}`}>{cmv != null ? `${cmv.toFixed(1)}%` : "—"}</span>
                  </span>
                  <span className="hidden text-[10px] font-bold leading-tight text-slate-400 xl:block">
                    {resumoCardapio.precificadas} precificad{resumoCardapio.precificadas === 1 ? "a" : "as"}
                    {resumoCardapio.semPreco > 0 && <><br />{resumoCardapio.semPreco} sem preço</>}
                  </span>
                </button>
              );
            })()}
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-3.5 shadow-sm transition-all focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-500/20 sm:w-[430px] sm:flex-none">
              <Search size={19} className="shrink-0 text-slate-700" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={modoFicha === "preparos" ? "Buscar preparo por nome..." : deptUrl === "bar" ? "Buscar drink ou produto..." : "Buscar prato por nome..."} className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400" />
              {busca && <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-700" title="Limpar busca"><X size={16} /></button>}
            </label>
          </div>
          <button onClick={abrirModalIAFicha} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 text-sm font-black text-emerald-700 shadow-sm hover:bg-emerald-100"><Sparkles size={18} /> Criar com IA</button>
          <button onClick={abrirNova} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"><Plus size={18} /> {modoFicha === "preparos" ? "Novo preparo" : deptUrl === "bar" ? "Novo drink" : "Novo prato"}</button>
        </div>
      </div>

      <main className="mx-auto max-w-[1480px] px-4 py-4 sm:px-5">
         {/* Kanban de indicadores: CMV médio, margem, custo, ticket */}
         <div className="mb-2 flex justify-end">
           <button type="button" onClick={() => setMostrarIndicadores(valor => !valor)} className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50">
             <BarChart3 size={15} /> {mostrarIndicadores ? "Ocultar indicadores" : "Ver indicadores"}
           </button>
         </div>
         {mostrarIndicadores && (() => {
            if (modoFicha === "preparos") {
              const base = fichas.filter(f => !!f.eh_base);
              if (!base.length) return null;
              const prePreparos = base.filter(f => f.tipo_base !== "receita").length;
              const receitasBase = base.filter(f => f.tipo_base === "receita").length;
              const comCusto = base.filter(f => custoTotalDaFicha(f, fichas) > 0).length;
              const semModo = base.filter(f => !String(f.modo_preparo || "").trim()).length;
              const tempos = base.map(f => Number(f.tempo_preparo) || 0).filter(Boolean);
              const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
              const cardsPreparo = [
                { rot: "Preparos", val: base.length, sub: deptUrl === "bar" ? "bases do bar" : "bases da cozinha" },
                { rot: "Pré-preparos", val: prePreparos, sub: "usados em montagens" },
                { rot: "Receitas base", val: receitasBase, sub: "produção do dia" },
                { rot: "Com custo", val: comCusto, sub: `${base.length - comCusto} sem custo` },
                { rot: "Tempo médio", val: tempoMedio ? `${tempoMedio} min` : "—", sub: `${tempos.length} informados` },
                { rot: "Sem instruções", val: semModo, sub: "modo de preparo", alerta: semModo > 0 },
              ];
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
                  {cardsPreparo.map(c => (
                    <div key={c.rot} className={`rounded-2xl border shadow-sm px-3 py-2.5 ${c.alerta ? "bg-amber-50 border-amber-200" : "bg-white border-amber-100"}`}>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">{c.rot}</p>
                      <p className={`text-lg font-black mt-0.5 ${c.alerta ? "text-amber-700" : "text-orange-700"}`}>{c.val}</p>
                      <p className="text-[10px] font-bold text-slate-400 truncate">{c.sub}</p>
                    </div>
                  ))}
                </div>
              );
            }
            const r = resumoCardapio;
            if (!r.totalFichas) return null;
            const cards = [
               { rot: "Fichas", val: r.totalFichas, sub: "pratos/receitas" },
               { rot: "CMV médio", val: r.cmvMedio != null ? r.cmvMedio.toFixed(1) + "%" : "—", sub: `${r.precificadas} precificadas`, alerta: r.cmvMedio != null && r.cmvMedio > 35 },
               { rot: "Margem média", val: r.margemMedia != null ? r.margemMedia.toFixed(1) + "%" : "—", sub: "bruta" },
               { rot: "Custo médio/porção", val: r.custoMedio != null ? fmtBRL(r.custoMedio) : "—", sub: "por porção" },
               { rot: "Ticket médio", val: r.ticketMedio != null ? fmtBRL(r.ticketMedio) : "—", sub: "preço de venda" },
               { rot: "Acima da meta", val: r.acimaMeta, sub: r.semPreco ? `${r.semPreco} sem preço` : "CMV alto", alerta: r.acimaMeta > 0 },
            ];
            return (
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
                  {cards.map(c => (
                     <div key={c.rot} className={`rounded-2xl border shadow-sm px-3 py-2.5 ${c.alerta ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">{c.rot}</p>
                        <p className={`text-lg font-black mt-0.5 ${c.alerta ? "text-red-600" : "text-emerald-700"}`}>{c.val}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{c.sub}</p>
                     </div>
                  ))}
               </div>
            );
         })()}
         <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              {
                id: "Pratos principais",
                modo: "principais",
                titulo: deptUrl === "bar" ? "Drinks e montagens" : "Pratos principais e montagens",
                descricao: deptUrl === "bar" ? "Monte o drink final usando insumos e preparos já cadastrados." : "Monte o prato final separando claramente cada preparo e ingrediente.",
                quantidade: fichas.filter(f => !f.eh_base).length,
                icone: <UtensilsCrossed size={24} />,
              },
              {
                id: "Preparos e receitas",
                modo: "preparos",
                titulo: "Preparos e receitas",
                descricao: deptUrl === "bar" ? "Xaropes, espumas, infusões e bases usadas em outras fichas." : "Molhos, caldos, massas, arroz, feijão e outras bases do prato.",
                quantidade: fichas.filter(f => !!f.eh_base).length,
                icone: <BookOpen size={24} />,
              },
            ].map(item => (
              <button
                type="button"
                key={item.id}
                onClick={() => { setModoFicha(item.modo); setTipoFiltro(item.id); setCategoriasRecolhidas(true); }}
                className={`min-h-[74px] rounded-xl border p-3 text-left transition-all ${modoFicha === item.modo ? (item.modo === "preparos" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-emerald-500 bg-emerald-50 shadow-sm") : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${modoFicha === item.modo ? (item.modo === "preparos" ? "bg-amber-600 text-white" : "bg-emerald-600 text-white") : "bg-slate-100 text-slate-600"}`}>{item.icone}</span>
                  <span className="min-w-0">
                    <span className="block text-sm sm:text-base font-black leading-tight text-slate-900">{item.titulo} <span className={item.modo === "preparos" ? "text-amber-600" : "text-emerald-600"}>({item.quantidade})</span></span>
                  </span>
                </div>
              </button>
            ))}
         </div>

         <div className={`mb-3 rounded-xl border p-2.5 transition-colors ${modoFicha === "preparos" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
           <div className={`flex items-center justify-between gap-3 ${categoriasRecolhidas ? "" : "mb-2"}`}>
             <button type="button" onClick={() => setCategoriasRecolhidas(valor => !valor)} className="flex min-h-10 flex-1 items-center gap-2 rounded-lg px-2 text-left text-sm font-black text-slate-800 hover:bg-white/70" aria-expanded={!categoriasRecolhidas}>
               <ChevronRight size={18} className={`transition-transform ${categoriasRecolhidas ? "" : "rotate-90"}`} />
               {modoFicha === "preparos" ? "Categorias de preparos" : deptUrl === "bar" ? "Categorias de bebidas e drinks" : "Categorias de pratos"}
               <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">{categoriasDisponiveis.length}</span>
             </button>
             <button type="button" onClick={() => setModalCategorias(true)} className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-black text-white ${modoFicha === "preparos" ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-700 hover:bg-emerald-800"}`}>
               <FolderPlus size={15} /> <span className="hidden sm:inline">Gerenciar</span>
             </button>
           </div>
         {!categoriasRecolhidas && <div className="flex flex-wrap items-center gap-2">
            {categoriasDisponiveis.map(cat => {
              const n = fichasDoModo.filter(f => (f.categoria || "") === cat).length;
              return (
                <div key={cat} className="flex items-center">
                  <button onClick={() => setTipoFiltro(cat)}
                    className={`px-4 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${tipoFiltro === cat ? (modoFicha === "preparos" ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20") : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}`}>
                    {cat} <span className={tipoFiltro === cat ? "text-white/75" : "text-slate-400"}>({n})</span>
                  </button>
                </div>
              );
            })}
            {(modoFicha === "preparos" ? [
              ["Pré-preparos", "Pré-preparos", fichas.filter(f => !!f.eh_base && f.tipo_base !== "receita").length],
              ["Receitas base", "Receitas base", fichas.filter(f => !!f.eh_base && f.tipo_base === "receita").length],
              ["Preparos e receitas", "Todos os preparos", fichas.filter(f => !!f.eh_base).length],
            ] : [
              ["Pratos principais", deptUrl === "bar" ? "Todos os drinks" : "Todos os pratos", fichas.filter(f => !f.eh_base && f.tipo_base !== "produto_pronto").length],
            ]).map(([t, label, n]) => (
              <button key={t} onClick={() => setTipoFiltro(t)}
                className={`px-4 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${tipoFiltro === t ? (modoFicha === "preparos" ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20") : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                {label} <span className={tipoFiltro === t ? "text-white/75" : "text-slate-400"}>({n})</span>
              </button>
            ))}
         </div>}
         </div>
         <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
             <p className="px-2 text-xs font-bold text-slate-500">{filtradas.length} {filtradas.length === 1 ? "ficha encontrada" : "fichas encontradas"}</p>
             <div className="flex flex-wrap items-center gap-2">
                <button onClick={selecionarPaginaLote} disabled={!fichasPagina.length} className="text-xs font-bold text-slate-600 hover:text-emerald-700 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 disabled:opacity-50">
                  <CheckSquare2 size={15} className="inline mr-1.5" /> Selecionar página
                </button>
                <button onClick={selecionarResultadoLote} disabled={!filtradas.length} className="text-xs font-bold text-slate-600 hover:text-emerald-700 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 disabled:opacity-50">
                  Selecionar resultado ({filtradas.length})
                </button>
                {selecionadas.length > 0 && <button onClick={limparSelecaoLote} className="text-xs font-bold text-slate-500 hover:text-rose-600 px-3 py-2">Limpar seleção</button>}
             </div>
         </div>

         {selecionadas.length > 0 && (
           <div className="sticky top-2 z-30 mb-4 rounded-2xl border border-emerald-200 bg-white p-3 shadow-lg shadow-emerald-900/10">
             <div className="flex flex-col xl:flex-row xl:items-center gap-3">
               <div className="flex items-center justify-between gap-3 xl:min-w-48">
                 <div>
                   <p className="text-sm font-black text-slate-800">{selecionadas.length} {selecionadas.length === 1 ? "ficha selecionada" : "fichas selecionadas"}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">A seleção continua ao trocar de página</p>
                 </div>
                 <button onClick={limparSelecaoLote} title="Fechar ações e limpar seleção" className="xl:hidden p-2 rounded-lg bg-slate-100 text-slate-500"><X size={16}/></button>
               </div>
               <div className="flex flex-wrap gap-2 xl:flex-1 xl:justify-end">
                 <button onClick={() => abrirPreviaImpressao("imprimir")} className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800"><Printer size={15}/> Imprimir</button>
                 <button onClick={() => abrirPreviaImpressao("livro")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><BookOpen size={15}/> Gerar livro</button>
                 <button onClick={() => abrirPreviaImpressao("pdf")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><FileDown size={15}/> Exportar PDF</button>
                 <button onClick={duplicarFichasSelecionadas} disabled={processandoLote} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Copy size={15}/> Duplicar</button>
                 <button onClick={() => abrirExclusaoSegura()} disabled={processandoLote} className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 size={15}/> Excluir</button>
                 <button onClick={limparSelecaoLote} title="Fechar ações e limpar seleção" className="hidden xl:flex p-2 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800"><X size={16}/></button>
               </div>
             </div>
           </div>
         )}

         {mensagemLote && (
           <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${erroLote ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
             <span className="flex items-center gap-2">{erroLote ? <ShieldAlert size={18}/> : <CheckCircle2 size={18}/>}{mensagemLote}</span>
             <button onClick={() => setMensagemLote("")}><X size={16}/></button>
           </div>
         )}

         {loading ? (
            <p className="font-bold text-slate-500">Buscando receitas...</p>
         ) : filtradas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <LayoutList size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">Nenhuma ficha encontrada</h3>
               <p className="text-slate-500 mt-2 font-medium">Cadastre suas receitas para calcular automaticamente o custo do prato.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
               {fichasPagina.map(f => {
                  const peso = infoPesoFicha(f, fichas);
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
                  const ehBarCard = String(f.departamento || "").toLowerCase() === "bar";
                  return (
                     <div key={f.id}
                        onDragOver={e => { if (dragId) e.preventDefault(); }}
                        onDrop={() => reordenar(dragId, f.id)}
                        className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all relative group flex flex-col overflow-hidden ${dragId === f.id ? 'opacity-50' : ''} ${selecionadas.includes(f.id) ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}>
                        {/* Cabeçalho sem foto: nome e ações sempre fáceis de tocar */}
                        <div className="border-b border-slate-100 bg-slate-50 p-3">
                           <div className="flex items-center gap-2">
                             <div draggable onDragStart={() => setDragId(f.id)} onDragEnd={() => setDragId(null)} title="Arraste para reordenar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm cursor-grab active:cursor-grabbing"><GripVertical size={19} /></div>
                             <label className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white cursor-pointer shadow-sm">
                               <input type="checkbox" checked={selecionadas.includes(f.id)} onChange={() => toggleSelecionar(f.id)} className="block h-5 w-5 cursor-pointer rounded accent-emerald-600"/>
                             </label>
                             <span className="flex-1" />
                              <button onClick={() => setAcoesCardAberto(atual => atual === f.id ? "" : f.id)} title="Mais opções" className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"><MoreVertical size={19}/></button>
                           </div>
                           <div className="mt-3 flex items-center gap-3">
                             <button type="button" onClick={() => abrirFicha(f)} title="Abrir ficha" className="min-h-10 min-w-0 flex-1 text-left">
                               <span className="block break-words text-lg font-black leading-snug text-slate-900">{f.nome_receita}</span>
                             </button>
                             <button onClick={() => abrirEditar(f)} className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white shadow-md"><Edit3 size={17}/> Editar</button>
                           </div>
                           {acoesCardAberto === f.id && <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                              {!f.eh_base && <button onClick={() => router.push(`/dashboard/operacao/montagem?dept=${f.departamento || deptUrl}&q=${encodeURIComponent(f.nome_receita)}`)} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><LayoutList size={17}/> Montagem</button>}
                              <button onClick={() => abrirSimulacao(f)} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Calculator size={17}/> Simular</button>
                              <button onClick={() => abrirPreviaImpressao("imprimir", [f])} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Printer size={17}/> Imprimir</button>
                              <button onClick={() => abrirPreviaImpressao("pdf", [f])} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Download size={17}/> PDF</button>
                              <button onClick={() => abrirExclusaoSegura([f])} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-rose-600 hover:bg-rose-50"><Trash2 size={17}/> Remover</button>
                           </div>}
                        </div>
                        <div className="p-4 sm:p-5 cursor-pointer" onClick={() => abrirFicha(f)} title="Abrir ficha">
                           {(() => {
                              // Métricas estilo "app de gestão": custo, preço, CMV e margem
                              const custoTotal = custoTotalDaFicha(f, fichas);
                              const rend = Number(f.rendimento_porcoes) || 1;
                              const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
                              const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
                              const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
                              const precoPorcao = Number(prod?.preco_venda) || 0;
                              const meta = Number(f.cmv_meta) || 30;
                              const cmv = precoPorcao > 0 ? (custoPorcao / precoPorcao) * 100 : null;
                              const margem = cmv !== null ? 100 - cmv : null;
                              const composicao = (f.fichas_ingredientes || []).length;
                              const quantidadeTexto = textoRendimento(f.rendimento_porcoes, unR, ehBarCard);
                              const unidadesDoPeso = ["kg", "g", "l", "ml"].includes(unR) && peso?.porcoes > 0
                                ? `${Number(peso.porcoes).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${ehBarCard ? "doses" : "unidades/porções"}`
                                : "";
                              return (
                                 <>
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${f.eh_base ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{f.eh_base ? "Preparo" : deptUrl === "bar" ? "Drink / produto" : "Prato"}</span>
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{f.categoria || "Sem categoria"}</span>
                                      {cmv !== null && cmv > meta && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-700">CMV alto</span>}
                                    </div>
                                    <div className="border-y border-slate-100 py-3">
                                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Composição</p><p className="mt-1 text-sm font-black text-slate-800">{composicao} {composicao === 1 ? "item" : "itens"}</p>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                      <div className="flex min-h-12 items-center justify-between gap-3">
                                        <span className="text-sm font-bold text-slate-500">Quantidade</span>
                                        <span className="text-right"><strong className="block text-base text-slate-900">{quantidadeTexto}</strong>{unidadesDoPeso && <small className="block font-bold text-slate-400">rende {unidadesDoPeso}</small>}</span>
                                      </div>
                                      <div className="flex min-h-12 items-center justify-between gap-3"><span className="text-sm font-bold text-slate-500">Custo</span><strong className="text-base text-slate-900">{fmtBRL(custoPorcao)}</strong></div>
                                      {/* Venda vem logo acima do CMV: é o número que explica o CMV. */}
                                      {!f.eh_base && (
                                        <div className="flex min-h-12 items-center justify-between gap-3">
                                          <span className="text-sm font-bold text-slate-500">Venda</span>
                                          {precoPorcao > 0
                                            ? <strong className="text-base text-slate-900">{fmtBRL(precoPorcao)}</strong>
                                            : <span className="text-sm font-bold text-slate-400">não informada</span>}
                                        </div>
                                      )}
                                      <div className="flex min-h-12 items-center justify-between gap-3">
                                        <span className="text-sm font-black text-slate-600">{f.eh_base ? "Custo total" : "CMV"}</span>
                                        {f.eh_base ? <strong className="text-lg text-amber-700">{fmtBRL(custoTotal)}</strong> : <span className={`rounded-lg px-3 py-1.5 text-base font-black ${cmv === null ? "bg-slate-100 text-slate-400" : cmv > meta ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{cmv !== null ? `${cmv.toFixed(1)}%` : "—"}</span>}
                                      </div>
                                    </div>
                                    {!f.eh_base && <p className="mt-1 text-xs font-bold text-slate-400">Margem {margem !== null ? `${margem.toFixed(1)}%` : "—"}</p>}
                                 </>
                              );
                           })()}
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
         {!loading && filtradas.length > 0 && (
           <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
             <p className="text-xs font-bold text-slate-500">
               Mostrando {(pagina - 1) * tamanhoPagina + 1} a {Math.min(pagina * tamanhoPagina, filtradas.length)} de {filtradas.length} fichas
             </p>
             <div className="flex flex-wrap items-center justify-center gap-2">
               <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none">
                 {[12, 24, 48, 60, 120].map(valor => <option key={valor} value={valor}>{valor} por página</option>)}
                 <option value={0}>Todas as fichas</option>
               </select>
               <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1} title="Página anterior" className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ChevronLeft size={17}/></button>
               <span className="min-w-24 text-center text-xs font-black text-slate-700">Página {pagina} de {totalPaginas}</span>
               <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas} title="Próxima página" className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ChevronRight size={17}/></button>
             </div>
           </div>
         )}
      </main>

      {/* PRÉVIA E CONFIGURAÇÃO DA IMPRESSÃO / PDF */}
      {modalImpressao && configImpressao && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[94vh]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Prévia do documento</p>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl">{modalImpressao.lista.length} {modalImpressao.lista.length === 1 ? "ficha técnica" : "fichas técnicas"}</h2>
              </div>
              <button onClick={() => setModalImpressao(null)} className="rounded-full bg-slate-100 p-3 text-slate-500 hover:bg-slate-200"><X size={20}/></button>
            </div>

            <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-5 border-b border-slate-200 bg-slate-50 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="text-xs font-black text-slate-600">Modelo
                    <select value={configImpressao.modelo} onChange={e => {
                      const modelo = e.target.value;
                      setConfigImpressao(atual => ({
                        ...atual, modelo,
                        livro: modelo === "livro",
                        capa: modelo === "livro",
                        indice: modelo === "livro",
                        custos: modelo !== "operacional" && podeImprimirCustos,
                        preco: modelo !== "operacional" && podeImprimirCustos,
                        cmv: modelo !== "operacional" && podeImprimirCustos,
                        margem: modelo !== "operacional" && podeImprimirCustos,
                      }));
                    }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none">
                      <option value="operacional">Operacional</option>
                      {podeImprimirCustos && <option value="gerencial">Gerencial</option>}
                      <option value="resumido">Resumo rápido</option>
                      <option value="livro">Livro completo</option>
                    </select>
                  </label>
                  <label className="text-xs font-black text-slate-600">Ordem
                    <select value={configImpressao.ordem} onChange={e => setConfigImpressao(atual => ({...atual, ordem: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none">
                      <option value="selecao">Ordem da seleção</option>
                      <option value="nome">Nome A–Z</option>
                      <option value="categoria">Categoria</option>
                      <option value="tipo">Tipo</option>
                      <option value="personalizada">Personalizada</option>
                    </select>
                  </label>
                  <label className="text-xs font-black text-slate-600">Formato
                    <select value={configImpressao.formato} onChange={e => setConfigImpressao(atual => ({...atual, formato: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none">
                      <option value="a4-retrato">A4 retrato</option>
                      <option value="a4-paisagem">A4 paisagem</option>
                    </select>
                  </label>
                </div>

                {!podeImprimirCustos && (
                  <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                    <ShieldAlert size={18} className="shrink-0"/> Os custos, preços, CMV e margem ficam ocultos de acordo com a permissão do seu usuário.
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Conteúdo incluído</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["foto", "Foto"], ["ingredientes", "Ingredientes"], ["preparo", "Preparo"],
                      ["montagem", "Montagem"], ["observacoes", "Observações"], ["responsaveis", "Responsável"],
                      ["atualizacao", "Atualização"], ["capa", "Capa"], ["indice", "Índice"],
                      ...(podeImprimirCustos ? [["custos", "Custos"], ["preco", "Preço"], ["cmv", "CMV"], ["margem", "Margem"]] : []),
                    ].map(([campo, label]) => (
                      <label key={campo} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                        <input type="checkbox" checked={!!configImpressao[campo]} onChange={e => setConfigImpressao(atual => ({...atual, [campo]: e.target.checked, ...(campo === "capa" || campo === "indice" ? { livro: e.target.checked || atual.livro } : {})}))} className="h-4 w-4 accent-emerald-700"/>
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {configImpressao.ordem === "personalizada" && modalImpressao.lista.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Arraste a ordem com as setas</p>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                      {listaOrdenadaPrevia().map((ficha, indice, lista) => (
                        <div key={ficha.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="w-6 text-xs font-black text-slate-400">{indice + 1}</span>
                          <span className="flex-1 truncate text-xs font-bold text-slate-700">{ficha.nome_receita}</span>
                          <button onClick={() => moverFichaNaPrevia(ficha.id, -1)} disabled={indice === 0} className="p-1 text-slate-500 disabled:opacity-20"><ArrowUp size={15}/></button>
                          <button onClick={() => moverFichaNaPrevia(ficha.id, 1)} disabled={indice === lista.length - 1} className="p-1 text-slate-500 disabled:opacity-20"><ArrowDown size={15}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white p-4 sm:p-6">
                <div className={`mx-auto min-h-[420px] max-w-2xl rounded-lg border border-slate-300 bg-white p-5 shadow-xl ${configImpressao.formato === "a4-paisagem" ? "aspect-[1.414/1]" : "aspect-[1/1.414]"}`}>
                  <div className="flex items-start justify-between gap-3 border-b-2 border-emerald-700 pb-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">{configImpressao.livro ? "Livro de fichas técnicas" : "Fichas técnicas"}</p>
                      <h3 className="mt-1 text-xl font-black text-slate-900">{unidadeInfo?.nome || "Seldeestrela"}</h3>
                    </div>
                    <BookOpen size={30} className="text-emerald-700"/>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">Fichas</p><p className="text-2xl font-black text-slate-800">{modalImpressao.lista.length}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">Estimativa</p><p className="text-2xl font-black text-slate-800">{estimarPaginasDocumento(modalImpressao.lista.length, configImpressao)} pág.</p></div>
                  </div>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ordem do documento</p>
                  <div className="mt-2 space-y-2">
                    {listaOrdenadaPrevia().slice(0, 6).map((ficha, indice) => (
                      <div key={ficha.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-black text-emerald-700">{indice + 1}</span>
                        <span className="truncate text-xs font-bold text-slate-700">{ficha.nome_receita}</span>
                      </div>
                    ))}
                    {modalImpressao.lista.length > 6 && <p className="text-center text-xs font-bold text-slate-400">+ {modalImpressao.lista.length - 6} fichas no documento</p>}
                  </div>
                  <p className="mt-5 text-[10px] font-bold text-slate-400">Modelo {configImpressao.modelo} · {configImpressao.formato === "a4-paisagem" ? "Paisagem" : "Retrato"} · {configImpressao.capa ? "Com capa" : "Sem capa"} · {configImpressao.indice ? "Com índice" : "Sem índice"}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white p-4 sm:px-6">
              <button onClick={() => setModalImpressao(null)} className="mr-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-100"><ArrowLeft size={17}/> Voltar</button>
              <button onClick={salvarModeloImpressao} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700"><Save size={17}/> Salvar modelo</button>
              <button onClick={() => gerarDocumentoConfigurado("pdf")} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800"><Download size={17}/> Gerar PDF</button>
              <button onClick={() => gerarDocumentoConfigurado("imprimir")} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-800"><Printer size={17}/> Imprimir</button>
            </div>
          </div>
        </div>
      )}


      {modalCategorias && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setModalCategorias(false)}>
          <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-black uppercase tracking-widest ${modoFicha === "preparos" ? "text-amber-700" : "text-emerald-700"}`}>{modoFicha === "preparos" ? "Ambiente de preparos" : "Ambiente de pratos e montagens"}</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">Gerenciar categorias de {modoFicha === "preparos" ? "preparos" : deptUrl === "bar" ? "drinks e produtos" : "pratos"}</h3>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">As categorias ficam disponíveis para toda a equipe desta unidade.</p>
              </div>
              <button type="button" onClick={() => setModalCategorias(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={novaCategoria}
                onChange={e => setNovaCategoria(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") criarCategoria(); }}
                placeholder={modoFicha === "preparos" ? "Ex.: Molhos da casa" : deptUrl === "bar" ? "Ex.: Coquetéis autorais" : "Ex.: Pratos executivos"}
                className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-500"
              />
              <button type="button" disabled={salvandoCategoria || !novaCategoria.trim()} onClick={criarCategoria} className="min-h-12 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                {salvandoCategoria ? "Salvando..." : "Criar categoria"}
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {categoriasDisponiveis.map(cat => {
                const quantidade = fichasDoModo.filter(f => f.categoria === cat).length;
                return (
                  <div key={cat} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-800">{cat}</p>
                      <p className="text-xs font-semibold text-slate-500">{quantidade} {quantidade === 1 ? "ficha nesta categoria" : "fichas nesta categoria"}</p>
                    </div>
                    <button type="button" onClick={() => excluirCategoria(cat)} title={`Excluir categoria ${cat}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TELA DE VISUALIZAÇÃO DA FICHA (igual à referência) */}
      {fichaView && (() => {
         const f = fichaView;
         const peso = infoPesoFicha(f, fichas);
         const custoTotal = custoTotalDaFicha(f, fichas);
         const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
         const ehBarView = String(f.departamento || "").toLowerCase() === "bar";
         const labelUn = unidadeRendimento(unR, ehBarView, f.rendimento_porcoes);
         const rend = Number(f.rendimento_porcoes) || 0;
         const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
         const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
         const custoKg = peso?.pesoTotalG > 0 ? custoTotal / (peso.pesoTotalG / 1000) : null;
         const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
         const preco = Number(prod?.preco_venda) || 0;
         const meta = Number(f.cmv_meta) || 30;
         const cmv = preco > 0 ? (custoPorcao / preco) * 100 : null;
         const margem = cmv !== null ? 100 - cmv : null;
         // Markup saiu: "62,50×" não diz quanto entra no caixa. Lucro é o que
         // sobra em reais de cada porção vendida — preço menos o que ela custa.
         const lucro = preco > 0 ? preco - custoPorcao : null;
         const precoSugerido = meta > 0 ? custoPorcao / (meta / 100) : 0;
         const pesoPorcaoG = Number(f.peso_porcao_g) || 0;
         const simN = Number(String(simPesoView).replace(",", ".")) || 0;
         const simPorcoes = pesoPorcaoG > 0 ? Math.floor(simN / pesoPorcaoG) : 0;
         const simSobra = pesoPorcaoG > 0 ? simN - simPorcoes * pesoPorcaoG : 0;
         const linhas = (f.fichas_ingredientes || []).map(fi => {
            const base = fi.subficha_id ? fichas.find(x => x.id === fi.subficha_id) : null;
            const nome = fi.insumos?.nome || base?.nome_receita || "Item";
            const un = (fi.insumos?.unidade_medida || base?.rendimento_unidade || "un").toUpperCase();
            const liquida = Number(fi.quantidade) || 0;
            const fc = Number(fi.fator_correcao) || 0;
            const bruta = liquida * (1 + fc / 100);
            const custoUnit = fi.insumos?.custo_unitario != null ? Number(fi.insumos.custo_unitario) : (base ? custoUnitBase(base, fichas) : 0);
            return { nome, un, liquida, fc, bruta, custoUnit, custoTot: custoUnit * bruta, base: !!base };
         });
         const nf = (n) => (+Number(n || 0).toFixed(3)).toLocaleString("pt-BR");
         const setorTxt = f.departamento === "bar" ? "Bar" : "Cozinha";
         const fechar = () => setFichaView(null);
         return (
            <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
               <div className="erp-ficha bg-slate-50 w-full max-w-6xl min-h-full sm:min-h-0 sm:max-h-[92vh] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
                  {/* CABEÇALHO */}
                  <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
                     <button onClick={fechar} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 shrink-0"><ArrowLeft size={19} /></button>
                     <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        {f.departamento === "bar" ? <Wine size={20} /> : <UtensilsCrossed size={20} />}
                     </div>
                     <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                           <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">{f.nome_receita}</h2>
                           <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-0.5">Ativo</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">{f.categoria || (f.eh_base ? "Pré-preparo" : "Prato")} · {setorTxt}</p>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                        {!f.eh_base && (
                           <>
                              <button onClick={() => abrirPreviaImpressao("imprimir", [f])} title="Imprimir" className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 flex items-center justify-center"><Printer size={17} /></button>
                              <button onClick={() => abrirPreviaImpressao("pdf", [f])} title="Gerar PDF" className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 flex items-center justify-center"><Download size={17} /></button>
                              <button onClick={() => abrirSimulacao(f)} title="Simular rendimento" className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 flex items-center justify-center"><Calculator size={17} /></button>
                           </>
                        )}
                        <button onClick={() => { fechar(); abrirEditar(f); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-4 h-10 shadow-sm"><Edit3 size={16} /> Editar ficha</button>
                     </div>
                  </div>

                  {/* ABAS */}
                  <div className="bg-white border-b border-slate-100 px-4 sm:px-6 flex gap-1 overflow-x-auto">
                     {[["ficha", "Ficha técnica"], ["preparo", "Modo de preparo"], ["custos", "Histórico de custos"]].map(([id, rot]) => (
                        <button key={id} onClick={() => setViewTab(id)}
                           className={`shrink-0 px-3 py-3 text-sm font-black border-b-2 transition-colors ${viewTab === id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                           {rot}
                        </button>
                     ))}
                  </div>

                  {/* CORPO: conteúdo + sidebar */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 sm:gap-5 items-start">
                     {/* COLUNA PRINCIPAL */}
                     <div className="flex flex-col gap-4 sm:gap-5">
                        {viewTab === "ficha" && (<>
                        {/* INFORMAÇÕES GERAIS */}
                        <div className="order-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                           <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-4">Informações gerais</p>
                           <div className="flex flex-col sm:flex-row gap-4">
                              <div className="grid grid-cols-2 gap-3 flex-1">
                                 {[
                                    ["Categoria", f.categoria || "—"],
                                    ["Setor", setorTxt],
                                    ["Rendimento", textoRendimento(rend, unR, ehBarView)],
                                    ["Peso líquido", peso?.pesoTotalG ? fmtG(peso.pesoTotalG) : (pesoPorcaoG && porcoes ? fmtG(pesoPorcaoG * porcoes) : "—")],
                                    ["Unidade de venda", unR === "porcao" ? "Porção" : labelUn],
                                    ["Porção padrão", pesoPorcaoG ? `${nf(pesoPorcaoG)} g` : "—"],
                                 ].map(([rot, val]) => (
                                    <div key={rot} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{rot}</p>
                                       <p className="text-sm font-black text-slate-800 mt-0.5 truncate">{val}</p>
                                    </div>
                                 ))}
                              </div>
                              <div onClick={() => { fechar(); abrirEditar(f); }} className="w-full sm:w-40 h-32 sm:h-auto shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer relative group">
                                 {f.imagem ? (
                                    <img src={`data:image/jpeg;base64,${f.imagem}`} alt={f.nome_receita} className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1"><Camera size={26} /><span className="text-[9px] font-black uppercase tracking-widest">Sem foto</span></div>
                                 )}
                                 <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 text-white text-[10px] font-bold py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"><Camera size={12} /> Alterar imagem</div>
                              </div>
                           </div>
                        </div>

                        {/* INGREDIENTES E CUSTOS */}
                        {!f.produto_pronto && (
                        <div className="order-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                           <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Ingredientes / composição</p>
                           <div className="overflow-x-auto">
                              <table className="w-full text-sm min-w-[560px]">
                                 <thead>
                                    <tr className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                                       <th className="text-left font-black py-2 pr-2">Ingrediente</th>
                                       <th className="text-center font-black py-2 px-1">Unid.</th>
                                       <th className="text-right font-black py-2 px-1">Qtd. bruta</th>
                                       <th className="text-right font-black py-2 px-1">FC %</th>
                                       <th className="text-right font-black py-2 px-1">Qtd. líq.</th>
                                       <th className="text-right font-black py-2 px-1">Custo un.</th>
                                       <th className="text-right font-black py-2 pl-1">Custo total</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {linhas.length === 0 && (
                                       <tr><td colSpan={7} className="py-6 text-center text-slate-400 font-medium">Sem ingredientes cadastrados.</td></tr>
                                    )}
                                    {/* Preparos (bases) primeiro, depois os ingredientes soltos:
                                        na cozinha o preparo vem antes da montagem do prato. */}
                                    {[
                                      { titulo: "Preparos e bases", itens: linhas.filter(l => l.base) },
                                      { titulo: "Ingredientes do prato", itens: linhas.filter(l => !l.base) },
                                    ].filter(g => g.itens.length > 0).map(grupo => (
                                      <Fragment key={grupo.titulo}>
                                        {linhas.some(l => l.base) && linhas.some(l => !l.base) && (
                                          <tr>
                                            <td colSpan={7} className="pt-4 pb-1.5">
                                              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700">{grupo.titulo}</span>
                                            </td>
                                          </tr>
                                        )}
                                        {grupo.itens.map((l, i) => (
                                          <tr key={`${grupo.titulo}-${i}`} className="border-b border-slate-50">
                                            <td className="py-3 pr-2 text-[15px] font-bold text-slate-800">{l.nome}{l.base && <span className="ml-1.5 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Preparo</span>}</td>
                                            <td className="py-3 px-1 text-center font-bold text-slate-500">{l.un}</td>
                                            <td className="py-3 px-1 text-right font-bold text-slate-700">{nf(l.bruta)}</td>
                                            <td className="py-3 px-1 text-right font-bold text-slate-500">{l.fc ? `${nf(l.fc)}%` : "—"}</td>
                                            <td className="py-3 px-1 text-right font-bold text-slate-700">{nf(l.liquida)}</td>
                                            <td className="py-3 px-1 text-right font-bold text-slate-600">{fmtCustoUnitario(l.custoUnit, l.un)}</td>
                                            <td className="py-3 pl-1 text-right font-black text-slate-800">{fmtBRL(l.custoTot)}</td>
                                          </tr>
                                        ))}
                                      </Fragment>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                           <button onClick={() => { fechar(); abrirEditar(f); }} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 text-emerald-700 font-black text-sm px-4 py-2.5 hover:bg-emerald-50"><Plus size={16} /> Adicionar ingrediente</button>
                           <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
                              <span className="text-slate-500 font-bold">Custo total da receita: <b className="text-emerald-700 font-black">{fmtBRL(custoTotal)}</b></span>
                              {porcoes > 0 && <span className="text-slate-500 font-bold">Custo por porção{pesoPorcaoG ? ` (${nf(pesoPorcaoG)} g)` : ""}: <b className="text-emerald-700 font-black">{fmtBRL(custoPorcao)}</b></span>}
                           </div>
                        </div>
                        )}
                        </>)}

                        {/* ABA: MODO DE PREPARO */}
                        {viewTab === "preparo" && (
                           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Modo de preparo</p>
                              {(() => {
                                 const passos = String(f.modo_preparo || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
                                 if (!passos.length) return <p className="text-sm text-slate-400 font-medium">Nenhum modo de preparo cadastrado. Use <b>Editar ficha</b> para adicionar.</p>;
                                 return (
                                    <ol className="space-y-2.5">
                                       {passos.map((p, i) => (
                                          <li key={i} className="flex gap-3">
                                             <span className="w-7 h-7 shrink-0 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center">{i + 1}</span>
                                             <span className="text-sm text-slate-700 font-medium leading-relaxed pt-0.5">{p.replace(/^\d+[.)\-\s]+/, "")}</span>
                                          </li>
                                       ))}
                                    </ol>
                                 );
                              })()}
                           </div>
                        )}

                        {/* ABA: HISTÓRICO DE CUSTOS */}
                        {viewTab === "custos" && (
                           <div className="space-y-4 sm:space-y-5">
                              {/* Linha do tempo */}
                              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                                 <div className="flex items-center justify-between gap-2 mb-3">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Histórico de custos</p>
                                    <button onClick={() => registrarCustoAtual(f, "manual")} disabled={registrandoCusto || histStatus === "sem_tabela"}
                                       className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs px-3 py-2">
                                       <Plus size={14} /> {registrandoCusto ? "Registrando..." : "Registrar custo atual"}
                                    </button>
                                 </div>
                                 {histStatus === "sem_tabela" ? (
                                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800 font-medium leading-relaxed">
                                       Para guardar a variação de custo ao longo do tempo, rode a migração <b>db/migracao_ficha_custo_historico.sql</b> no SQL Editor do Supabase. Depois disso, cada alteração de custo fica registrada aqui automaticamente.
                                    </div>
                                 ) : histStatus === "carregando" ? (
                                    <p className="text-sm text-slate-400 font-medium">Carregando histórico...</p>
                                 ) : histCustos.length === 0 ? (
                                    <p className="text-sm text-slate-400 font-medium">Nenhum custo registrado ainda. Toque em <b>Registrar custo atual</b> para criar o primeiro ponto — ou salve a ficha após mudar ingredientes.</p>
                                 ) : (
                                    <div className="space-y-2">
                                       {histCustos.map((h, i) => {
                                          const dif = h.diferenca == null ? null : Number(h.diferenca);
                                          const pct = h.diferenca_pct == null ? null : Number(h.diferenca_pct);
                                          const subiu = dif != null && dif > 0.005;
                                          const desceu = dif != null && dif < -0.005;
                                          const origemTxt = h.origem === "edicao_ficha" ? "edição" : h.origem === "variacao_preco" ? "variação de preço" : "manual";
                                          return (
                                             <div key={h.id || i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                                <div className="min-w-0">
                                                   <p className="text-sm font-black text-slate-800">{fmtBRL(Number(h.custo_total) || 0)}<span className="text-[11px] font-bold text-slate-400 ml-1.5">total{h.custo_porcao != null ? ` · ${fmtBRL(Number(h.custo_porcao))}/porção` : ""}</span></p>
                                                   <p className="text-[10px] font-bold text-slate-400">{new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {origemTxt}{h.usuario_nome ? ` · ${h.usuario_nome}` : ""}</p>
                                                </div>
                                                {dif == null ? (
                                                   <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">1º registro</span>
                                                ) : (
                                                   <span className={`text-xs font-black shrink-0 ${subiu ? "text-red-600" : desceu ? "text-emerald-700" : "text-slate-400"}`}>
                                                      {subiu ? "▲" : desceu ? "▼" : "="} {fmtBRL(Math.abs(dif))}{pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}
                                                   </span>
                                                )}
                                             </div>
                                          );
                                       })}
                                    </div>
                                 )}
                              </div>

                              {/* Composição atual */}
                              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                                 <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-1">Composição do custo atual</p>
                                 <p className="text-[11px] font-medium text-slate-400 mb-3">Participação de cada ingrediente no custo total ({fmtBRL(custoTotal)}).</p>
                                 <div className="space-y-2.5">
                                    {[...linhas].sort((a, b) => b.custoTot - a.custoTot).map((l, i) => {
                                       const pct = custoTotal > 0 ? (l.custoTot / custoTotal) * 100 : 0;
                                       return (
                                          <div key={i}>
                                             <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="font-bold text-slate-700 truncate pr-2">{l.nome}</span>
                                                <span className="font-black text-slate-800 shrink-0">{fmtBRL(l.custoTot)} <span className="text-slate-400 font-bold">· {pct.toFixed(1)}%</span></span>
                                             </div>
                                             <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                                          </div>
                                       );
                                    })}
                                    {linhas.length === 0 && <p className="text-sm text-slate-400 font-medium">Sem ingredientes para compor o custo.</p>}
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>

                     {/* SIDEBAR */}
                     <div className="space-y-4 lg:sticky lg:top-0">
                        {/* RENDIMENTO E PORÇÕES */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                           <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Rendimento e porções</p>
                           <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Esta receita rende</p>
                                 <p className="text-xl font-black text-emerald-700">{textoRendimento(rend, unR, ehBarView)}</p>
                              </div>
                              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Peso total</p>
                                 <p className="text-xl font-black text-emerald-700">{peso?.pesoTotalG ? fmtG(peso.pesoTotalG) : (pesoPorcaoG && porcoes ? fmtG(pesoPorcaoG * porcoes) : "—")}</p>
                              </div>
                           </div>
                           <div className="flex items-center justify-between mt-3 text-sm">
                              <span className="text-slate-500 font-bold">Porção padrão</span>
                              <span className="font-black text-slate-800">{pesoPorcaoG ? `${nf(pesoPorcaoG)} g` : "—"}</span>
                           </div>
                           {pesoPorcaoG > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                 <p className="text-[11px] font-black text-slate-700">Simulador de porções</p>
                                 <p className="text-[10px] font-medium text-slate-400 mb-2">Informe o peso disponível para ver quantas porções dá para servir.</p>
                                 <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                       <input type="text" inputMode="decimal" value={simPesoView} onChange={e => setSimPesoView(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Peso disponível" className="flex-1 min-w-0 px-3 py-2.5 bg-transparent font-black text-slate-800 outline-none" />
                                       <span className="px-3 text-xs font-black text-slate-400">g</span>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-lg font-black text-emerald-700 leading-none">{simN > 0 ? `${simPorcoes} porç.` : "—"}</p>
                                       <p className="text-[10px] font-bold text-slate-400 mt-0.5">{simN > 0 ? `sobra ${nf(simSobra)} g` : `de ${nf(pesoPorcaoG)} g`}</p>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>

                        {/* CUSTO E PRECIFICAÇÃO */}
                        {!f.eh_base && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                           <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Custo e precificação</p>
                           <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between"><span className="text-slate-500 font-bold">Custo total da receita</span><span className="font-black text-slate-800">{fmtBRL(custoTotal)}</span></div>
                              <div className="flex items-center justify-between"><span className="text-slate-500 font-bold">Custo por porção</span><span className="font-black text-slate-800">{fmtBRL(custoPorcao)}</span></div>
                              {custoKg !== null && <div className="flex items-center justify-between"><span className="text-slate-500 font-bold">Custo por {baseCustoDaFicha(unR, unGrande)}</span><span className="font-black text-slate-800">{fmtBRL(custoKg)}</span></div>}
                           </div>
                           <div className="grid grid-cols-2 gap-2 mt-3">
                              <div className={`rounded-xl px-3 py-2 text-center border ${cmv !== null && cmv > meta ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-100"}`}>
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">CMV</p>
                                 <p className={`text-lg font-black ${cmv !== null && cmv > meta ? "text-red-600" : "text-emerald-700"}`}>{cmv !== null ? `${cmv.toFixed(1)}%` : "—"}</p>
                              </div>
                              <div className="rounded-xl px-3 py-2 text-center border bg-emerald-50 border-emerald-100">
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Margem</p>
                                 <p className="text-lg font-black text-emerald-700">{margem !== null ? `${margem.toFixed(1)}%` : "—"}</p>
                              </div>
                              <div className="rounded-xl px-3 py-2 text-center border bg-emerald-50 border-emerald-100">
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Lucro</p>
                                 <p className="text-lg font-black text-emerald-700">{lucro !== null ? fmtBRL(lucro) : "—"}</p>
                              </div>
                              <div className="rounded-xl px-3 py-2 text-center border bg-slate-50 border-slate-200">
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Preço/porção</p>
                                 <p className="text-lg font-black text-slate-800">{preco > 0 ? fmtBRL(preco) : "—"}</p>
                              </div>
                           </div>
                           <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-600 text-white px-3 py-2.5">
                              <span className="text-[11px] font-black uppercase tracking-wider">Preço sugerido (CMV {meta}%)</span>
                              <span className="text-lg font-black">{precoSugerido > 0 ? fmtBRL(precoSugerido) : "—"}</span>
                           </div>
                        </div>
                        )}

                        {/* INFORMAÇÕES ADICIONAIS */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                           <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Informações adicionais</p>
                           <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-slate-600"><Clock size={15} className="text-emerald-600 shrink-0" /><span className="font-bold">Tempo de preparo:</span> <b className="text-slate-800">{f.tempo_preparo ? `${f.tempo_preparo} min` : "—"}</b></div>
                              <div className="flex items-center gap-2 text-slate-600"><Thermometer size={15} className="text-emerald-600 shrink-0" /><span className="font-bold">Validade:</span> <b className="text-slate-800">{f.validade_dias ? `${f.validade_dias} dia${Number(f.validade_dias) !== 1 ? "s" : ""}` : "—"}</b></div>
                              {metodoBar(f.metodo_bar) && <div className="flex items-center gap-2 text-slate-600"><Wine size={15} className="text-emerald-600 shrink-0" /><span className="font-bold">Método:</span> <b className="text-slate-800">{metodoBar(f.metodo_bar).nome}</b></div>}
                              {f.observacoes && <p className="text-[13px] text-slate-500 font-medium pt-1 leading-relaxed border-t border-slate-100 mt-2">{f.observacoes}</p>}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         );
      })()}

      {/* MODAL DE CRIAÇÃO DA FICHA TÉCNICA */}
      {modalNovo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4">
             <div className="erp-ficha erp-editor-ficha bg-white rounded-3xl sm:rounded-[32px] w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[94vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               <style>{`
                 .erp-editor-ficha label { font-size: 13px !important; line-height: 1.4; }
                 .erp-editor-ficha input, .erp-editor-ficha select, .erp-editor-ficha textarea { font-size: 16px !important; line-height: 1.5; }
                 .erp-editor-ficha input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), .erp-editor-ficha select { min-height: 48px; }
                 .erp-editor-ficha textarea { line-height: 1.65; }
                 .erp-editor-ficha [class*="text-[9px]"], .erp-editor-ficha [class*="text-[10px]"] { font-size: 12px !important; }
                 .erp-editor-ficha [class*="text-[11px]"] { font-size: 13px !important; }
               `}</style>
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center gap-3 p-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-white">
                  <div className="min-w-0">
                     <p className={`text-[10px] font-black uppercase tracking-[.18em] ${form.eh_base ? "text-amber-700" : "text-emerald-700"}`}>{form.eh_base ? "Pré-preparo / receita base" : form.produto_pronto ? "Produto pronto" : deptUrl === "bar" ? "Montagem de drink" : "Montagem de prato"}</p>
                     <h2 className="font-black text-2xl sm:text-3xl text-slate-800">{form.id ? "Editar ficha técnica" : "Nova ficha técnica"}</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{ingFicha.length} ingrediente(s) · custo atual <span className="text-emerald-600 font-black">{fmtBRL(custoTotalFormulario(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-12 h-12 shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={21}/></button>
               </div>


               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-4 sm:p-7 bg-slate-50/50 custom-scrollbar">
                  
                   {/* COLUNA ESQUERDA: Dados Básicos e Foto */}
                  <div id="ficha-dados" className="space-y-4 scroll-mt-24">
                     <div className="flex gap-4">
                        <div className="w-24 h-24 shrink-0 relative">
                           <div onClick={() => fileInputRef.current?.click()} className="w-full h-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-emerald-400 overflow-hidden relative group transition-colors">
                              {form.imagem ? (
                                 <>
                                    <img src={`data:image/jpeg;base64,${form.imagem}`} className="w-full h-full object-cover" alt="Foto do Prato" />
                                    <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"><Camera size={24}/></div>
                                 </>
                              ) : (
                                 <div className="text-center">
                                    <Camera size={24} className="mx-auto text-slate-400 mb-1"/>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Foto</span>
                                 </div>
                              )}
                              <input type="file" ref={fileInputRef} onChange={handleMudarFotoForm} accept="image/*" className="hidden" />
                           </div>
                           {form.imagem && (
                              <button type="button" onClick={() => setForm({ ...form, imagem: "" })} title="Remover foto"
                                 className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600">
                                 <X size={14} />
                              </button>
                           )}
                        </div>
                        <div className="flex-1">
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{form.produto_pronto ? "Nome do produto" : "Nome da receita"}</label>
                           <input type="text" placeholder={form.produto_pronto ? "Ex: Água sem gás 500 ml" : "Ex: Caipirinha de Morango"} value={form.nome_receita} onChange={e=>setForm({...form, nome_receita: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                           {form.imagem && <button type="button" onClick={() => setForm({ ...form, imagem: "" })} className="text-[11px] font-bold text-rose-500 hover:text-rose-600 mt-1.5">Remover foto</button>}
                        </div>
                     </div>
                     {/* Escolha principal, no mesmo padrão rápido do estoque */}
                     {!form.id ? <div>
                       <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">O que você vai cadastrar?</p>
                       <div className="grid grid-cols-2 gap-3">
                         <button type="button" onClick={() => setForm({ ...form, eh_base: true, produto_pronto: false, tipo_base: form.tipo_base === "receita" ? "receita" : "pre", categoria: categoriasPreparoDisponiveis.includes(form.categoria) ? form.categoria : categoriasPreparoDisponiveis[0] || "" })}
                           className={`min-h-[94px] rounded-2xl border-2 p-4 text-left transition-all ${form.eh_base ? "border-amber-600 bg-amber-50 text-amber-900 shadow-lg shadow-amber-600/10" : "border-slate-200 bg-white text-slate-500 hover:border-amber-300"}`}>
                           <BookOpen size={24} className={form.eh_base ? "text-amber-700" : "text-slate-400"} />
                           <strong className="mt-2 block text-base">Pré-preparo</strong><span className="block text-xs font-semibold">base usada em outras fichas</span>
                         </button>
                         <button type="button" onClick={() => setForm({ ...form, eh_base: false, produto_pronto: false, tipo_base: null, categoria: categoriasPrincipaisDisponiveis.includes(form.categoria) ? form.categoria : "", modo_preparo: "" })}
                           className={`min-h-[94px] rounded-2xl border-2 p-4 text-left transition-all ${!form.eh_base && !form.produto_pronto ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-lg shadow-emerald-600/10" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300"}`}>
                           <UtensilsCrossed size={24} className={!form.eh_base && !form.produto_pronto ? "text-emerald-700" : "text-slate-400"} />
                           <strong className="mt-2 block text-base">{deptUrl === "bar" ? "Montagem de drink" : "Montagem de prato"}</strong><span className="block text-xs font-semibold">item final do cardápio</span>
                         </button>
                       </div>
                       {form.eh_base && (
                         <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-amber-50 p-2">
                           <button type="button" onClick={() => setForm({ ...form, tipo_base: "pre" })} className={`min-h-11 rounded-lg px-3 text-sm font-black ${form.tipo_base !== "receita" ? "bg-amber-700 text-white" : "bg-white text-slate-600"}`}>Pré-preparo</button>
                           <button type="button" onClick={() => setForm({ ...form, tipo_base: "receita" })} className={`min-h-11 rounded-lg px-3 text-sm font-black ${form.tipo_base === "receita" ? "bg-amber-700 text-white" : "bg-white text-slate-600"}`}>Receita base</button>
                         </div>
                       )}
                       {/* O botão "É um produto pronto" saiu daqui: garrafa, lata e
                           cerveja não são receituário e não aparecem mais na ficha
                           técnica. Criar por aqui só geraria registro invisível.
                           Esses itens se cadastram no Cardápio e no Estoque. */}
                     </div> : null}
                     {/* Ao editar havia um cartão "Tipo da ficha" que só dizia que
                         o tipo não podia ser mudado ali. O cabeçalho do modal já
                         mostra o tipo, então o cartão ocupava espaço para repetir
                         o que estava logo acima e avisar que nada podia ser feito. */}
                      {form.produto_pronto && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                           <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Tipo de produto pronto</label>
                           <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-2 bg-white border border-emerald-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                              {CATEGORIAS_PRODUTO_PRONTO_BAR.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                           <p className="mt-2 text-[11px] font-medium text-emerald-700">Produto vendido como vem do fornecedor. Não exige ingredientes, receita ou guia de montagem.</p>
                        </div>
                      )}
                      {form.eh_base && (
                         <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Categoria deste preparo</label>
                              <button type="button" onClick={() => { setModoFicha("preparos"); setModalCategorias(true); }} className="text-xs font-black text-emerald-700 hover:underline">+ Gerenciar</button>
                            </div>
                            <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-2 bg-white border border-emerald-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                               <option value="">Sem categoria</option>
                               {form.categoria && !categoriasPreparoDisponiveis.includes(form.categoria) && <option value={form.categoria}>{form.categoria}</option>}
                               {categoriasPreparoDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <p className="mt-2 text-[11px] font-medium text-amber-700">{deptUrl === "bar" ? "Este preparo poderá ser usado em vários drinks." : "Este preparo poderá ser reutilizado na montagem de vários pratos."}</p>
                         </div>
                      )}
                     {/* Categoria do cardápio (pratos e drinks finais, não bases) */}
                     {!form.eh_base && !form.produto_pronto && (
                        <div>
                           <div className="flex items-center justify-between">
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{deptUrl === "bar" ? "Categoria do drink" : "Categoria no cardápio"}</label>
                             <button
                               type="button"
                               onClick={() => { setModoFicha("principais"); setModalCategorias(true); }}
                               className="text-sm font-black text-emerald-600 hover:underline"
                             >
                               + Gerenciar categorias
                             </button>
                           </div>
                           <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                              <option value="">Sem categoria</option>
                              {form.categoria && !categoriasPrincipaisDisponiveis.includes(form.categoria) && <option value={form.categoria}>{form.categoria}</option>}
                              {categoriasPrincipaisDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                     )}
                     {/* INGREDIENTES — logo abaixo do nome: é deles que saem rendimento, CMV e preço */}
                     {form.produto_pronto ? (
                     <div id="ficha-ingredientes" className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-200 shadow-sm flex flex-col items-center justify-center min-h-[320px] text-center scroll-mt-24">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4"><Package size={28} /></div>
                        <h3 className="text-xl font-black text-slate-800">Produto pronto para venda</h3>
                        <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-500">Cadastre a categoria e o preço. O item entrará no cardápio do Bar sem exigir ingredientes ou montagem.</p>
                        <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-2 text-left">
                           <div className="rounded-xl border border-emerald-100 bg-white p-3"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Quantidade</span><span className="font-black text-slate-800">1 unidade</span></div>
                           <div className="rounded-xl border border-emerald-100 bg-white p-3"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Composição</span><span className="font-black text-slate-800">Não se aplica</span></div>
                        </div>
                     </div>
                     ) : (
                     <div id="ficha-ingredientes" className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col scroll-mt-24">
                        <div className="mb-2.5 flex items-center justify-between gap-3">
                           <label className="text-xs font-black uppercase tracking-widest text-emerald-700">Ingredientes</label>
                           <span className="shrink-0 text-sm font-black text-emerald-800">{ingFicha.length} · {fmtBRL(custoTotalFormulario(ingFicha))}</span>
                        </div>
                     
                        {/* ADD INGREDIENTE — busca por digitação: a lista tem centenas de itens */}
                        <div className="relative mb-4">
                           <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                              <Search size={17} className="shrink-0 text-slate-400" />
                              <input value={buscaIng} onChange={e => setBuscaIng(e.target.value)}
                                 placeholder="Digite para achar insumo, pré-preparo ou embalagem"
                                 className="h-12 w-full bg-transparent font-bold text-slate-700 outline-none" />
                              {buscaIng && <button type="button" onClick={() => setBuscaIng("")} className="shrink-0 text-slate-400 hover:text-slate-600"><X size={16} /></button>}
                           </div>
                           {buscaIng.trim() && (
                              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                 {sugestoesIngrediente.length === 0 ? (
                                    <p className="p-3 text-sm font-bold text-slate-400">Nada encontrado com esse nome.</p>
                                 ) : sugestoesIngrediente.map(o => (
                                    <button key={o.valor + o.nome} type="button" onClick={() => addIngrediente(o.valor)}
                                       className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2.5 text-left last:border-0 hover:bg-emerald-50">
                                       <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">{o.nome}</span>
                                       <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400">{o.tipo}{o.detalhe ? ` · ${o.detalhe}` : ""}</span>
                                    </button>
                                 ))}
                              </div>
                           )}
                        </div>

                        {/* Cabeçalho estilo tabela (como na ficha de referência) */}
                        {ingFicha.length > 0 && (
                           <div className="flex items-center gap-3 px-3 pb-2 mb-1 border-b border-slate-200">
                              <span className="flex-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Ingrediente</span>
                              <span className="w-20 text-center text-[9px] font-black uppercase tracking-wider text-slate-400">Qtd.</span>
                              <span className="w-9 text-center text-[9px] font-black uppercase tracking-wider text-slate-400">Un.</span>
                              <span className="w-8" />
                           </div>
                        )}

                        {/* LISTA DE INGREDIENTES */}
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                           {ingFicha.length === 0 && (
                              <div className="py-4 text-center text-sm font-medium text-slate-400">
                                 Nenhum ingrediente ainda.
                              </div>
                           )}
                           {ingFicha.map(ing => {
                              const sub = getSub(ing.unidade);
                              const emSub = sub && ing.modo === "sub";
                              const fator = emSub ? sub.f : 1;
                              const unidadeLabel = emSub ? sub.sub : ing.unidade;
                              // valor exibido = quantidade-base convertida pra unidade de digitação
                              const valorExibido = ing.quantidade ? +(ing.quantidade * fator).toFixed(4) : "";
                              const onChangeQtd = (e) => {
                                 const v = Number(e.target.value) || 0;
                                 updateQtd(ing.chave, v / fator); // sempre grava em unidade-base
                              };
                              return (
                              <div key={ing.chave} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 group">
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate flex items-center gap-1.5">
                                       {ing.nome}
                                       {ing.tipo === "base" && <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Base</span>}
                                    </p>
                                    {/* Quanto cabe em 1 garrafa/lata/barril. É o número que
                                        faz a receita saber o rendimento, e sem ele a linha
                                        avisa que falta preencher no cadastro. */}
                                    {/* Quanto rende 1 peca e em que ela vem: "500 ml por
                                        garrafa". Sem isso o item nao entra na soma do
                                        rendimento, e o aviso diz onde arrumar em vez de
                                        deixar a conta errada em silencio. */}
                                    {ing.tipo !== "base" && (() => {
                                       const rotulo = rotuloVolumeUnitario(ing) || rotuloPesoUnitario(ing);
                                       if (rotulo) return <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{rotulo}</p>;
                                       if (["ml", "l", "g", "kg"].includes(String(ing.unidade || "").toLowerCase())) return null;
                                       return <p className="text-[10px] font-bold text-slate-400 mt-0.5">Sem embalagem no cadastro — não entra no rendimento</p>;
                                    })()}
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Custo: {fmtBRL(ing.custo_unitario * ing.quantidade * multiplicadorPerda(ing.fator))} <span className="text-slate-400 normal-case">· {fmtCustoUnitario(ing.custo_unitario, ing.unidade)}</span></p>
                                    {/* Perda vem do cadastro do ingrediente. A quantidade
                                        bruta é a líquida dividida pelo percentual aproveitável. */}
                                    {ing.tipo !== "base" && Number(ing.fator) > 0 && (
                                       <div className="flex items-center gap-1.5 mt-1">
                                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Perda do ingrediente</span>
                                          <span className="text-[10px] font-black text-emerald-700">{Number(ing.fator).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                                          {ing.quantidade > 0 && (
                                             <span className="text-[9px] font-bold text-slate-400">· bruta {(+(ing.quantidade * (emSub ? fator : 1) * multiplicadorPerda(ing.fator)).toFixed(2)).toLocaleString("pt-BR")} {unidadeLabel}</span>
                                          )}
                                       </div>
                                    )}
                                    {/* Equivalência em peso: 5 un de bolinho de 35g = 175 g (0,175 kg) */}
                                    {(() => {
                                       if (ing.tipo !== "base" || String(ing.unidade).toLowerCase() !== "un" || !ing.quantidade) return null;
                                       const baseFicha = fichas.find(x => x.id === ing.subficha_id);
                                       const pg = Number(baseFicha?.peso_porcao_g) || 0;
                                       if (!pg) return null;
                                       const g = ing.quantidade * pg;
                                       return (
                                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                             = {(+g.toFixed(1)).toLocaleString("pt-BR")} g ({(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg)
                                          </p>
                                       );
                                    })()}
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <input
                                       type="number"
                                       step={emSub ? "1" : "0.001"}
                                       min="0"
                                       placeholder="0"
                                       value={valorExibido}
                                       onChange={onChangeQtd}
                                       className="w-20 p-2 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"
                                    />
                                    {sub ? (
                                       <button
                                          type="button"
                                          onClick={() => toggleModo(ing.chave)}
                                          title="Alternar unidade de lançamento"
                                          className="text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-1.5 py-1 uppercase w-9 transition-colors"
                                       >
                                          {unidadeLabel}
                                       </button>
                                    ) : (
                                       <span className="text-[10px] font-black text-slate-500 uppercase w-9 text-center">{unidadeLabel}</span>
                                    )}
                                 </div>
                                 <button onClick={() => { setSubstitutoValor(""); setSubstituirAlvo(ing); }} title="Remover ou substituir" className="p-2 text-slate-500 hover:text-rose-600 transition-colors bg-white rounded-lg border border-slate-200">
                                    <Trash2 size={14}/>
                                 </button>
                              </div>
                              );
                           })}
                        </div>

                     </div>
                     )}

                     {/* RENDIMENTO — automático pela soma dos ingredientes (peso + custo de 1 kg).
                         No modo automático e sem ingrediente nenhum o card não tem o que
                         mostrar: era um retângulo com uma frase cinza entre o receituário e
                         a precificação. Ele volta sozinho no primeiro ingrediente, e no modo
                         manual fica sempre — é lá que se corrige o rendimento de receita que
                         reduz no fogo. */}
                     {(!autoSoma || ingFicha.length > 0) && (
                     <div id="ficha-rendimento" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm scroll-mt-24">
                        <div className="flex items-center justify-between mb-3">
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quantidade da receita</p>
                           {autoSoma
                              ? <button type="button" onClick={() => setAutoSoma(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline">ajustar manualmente</button>
                              : <button type="button" onClick={() => setAutoSoma(true)} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline">← voltar ao automático</button>}
                        </div>
                        {autoSoma ? (
                           (() => {
                              const est = rendimentoPelosIngredientes(ingFicha);
                              const custoTotal = calcularCustoTotal(ingFicha);
                              // Duas coisas diferentes davam a mesma frase. Sem ingrediente
                              // nenhum o card nem aparece; se chegou aqui com ingrediente na
                              // lista, o que falta é peso ou volume no cadastro deles — dizer
                              // "adicione ingredientes" mandava procurar o problema no lugar
                              // errado, que foi o que aconteceu com a água em garrafa.
                              if (!est) return (
                                 <p className="text-sm text-slate-400 font-medium py-2">
                                    {ingFicha.length === 0
                                       ? `Adicione ingredientes — o rendimento e o custo de 1 ${unGrande} aparecem aqui sozinhos.`
                                       : "Nenhum ingrediente tem peso ou volume cadastrado. Abra cada um no cadastro e preencha quanto pesa ou quanto cabe em 1 unidade — o rendimento aparece aqui sozinho."}
                                 </p>
                              );
                              const custoKg = custoTotal / (est.totalG / 1000);
                              const unLabel = ({ kg: "kg", g: "g", l: "L", ml: "ml" })[est.unidade];
                              return (
                                 <>
                                    <div className="grid grid-cols-2 gap-3">
                                       <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rende</p>
                                          <p className="text-2xl font-black text-slate-800 mt-1">{est.valor.toLocaleString("pt-BR")} <span className="text-base">{unLabel}</span></p>
                                          <p className="text-[10px] font-medium text-slate-400">somado dos ingredientes</p>
                                       </div>
                                       <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">1 {baseCustoDaFicha(est.unidade, unGrande)} custa</p>
                                          <p className="text-2xl font-black text-emerald-700 mt-1">{fmtBRL(custoKg)}</p>
                                          <p className="text-[10px] font-medium text-emerald-600/70">custo total {fmtBRL(custoTotal)}</p>
                                       </div>
                                    </div>

                                    {/* Conferência: a conta aberta, item por item */}
                                    {(() => {
                                       const detalhes = ingFicha.map(ing => ({ ing, d: detalheIngrediente(ing) }));
                                       const foraDaSoma = detalhes.filter(x => x.d.pesoG === null);
                                       const suspeitos = detalhes.filter(x => x.d.precoSuspeito);
                                       return (
                                          <>
                                          {suspeitos.length > 0 && (
                                             <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                                                <p className="text-[11px] font-bold text-red-600 leading-relaxed">
                                                   Preço suspeito inflando o custo: {suspeitos.map(x => `${x.ing.nome} está ${fmtBRL(x.ing.custo_unitario)} por ${String(x.ing.unidade).toLowerCase()} (= ${fmtBRL((Number(x.ing.custo_unitario) || 0) * 1000)}/kg)`).join("; ")}. Se esse é o preço do maço/pacote, corrija no cadastro de Ingredientes.
                                                </p>
                                             </div>
                                          )}
                                          <details className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                                             <summary className="text-[11px] font-bold text-slate-500 cursor-pointer select-none">Ver a conta (ingrediente por ingrediente)</summary>
                                             <div className="mt-2 space-y-1">
                                                {detalhes.map(({ ing, d }) => (
                                                   <div key={ing.chave} className="flex justify-between items-baseline text-[11px] font-medium gap-2">
                                                      <span className="text-slate-600 truncate">
                                                         {ing.nome}
                                                         {d.precoSuspeito && <span className="ml-1 text-amber-600 font-bold">(confira o preço!)</span>}
                                                      </span>
                                                      <span className="shrink-0 text-slate-500">
                                                         {d.pesoG !== null ? fmtG(d.pesoG) : <span className="text-amber-600 font-bold">fora do peso</span>}
                                                         <span className="text-slate-400"> · </span>
                                                         <span className="font-bold text-slate-700">{fmtBRL(d.custo)}</span>
                                                      </span>
                                                   </div>
                                                ))}
                                                <div className="flex justify-between items-baseline text-[11px] font-black pt-1.5 mt-1 border-t border-slate-200">
                                                   <span className="text-slate-700">
                                                      TOTAL
                                                      {est.solidosG > 0 && est.liquidosMl > 0 && (
                                                         <span className="font-medium text-slate-400"> (sólidos {fmtG(est.solidosG)} + líquidos {fmtG(est.liquidosMl).replace(" kg", " L").replace(" g", " ml")})</span>
                                                      )}
                                                   </span>
                                                   <span className="text-slate-800 shrink-0">{fmtG(est.totalG)} · {fmtBRL(custoTotal)}</span>
                                                </div>
                                                {foraDaSoma.length > 0 && (
                                                   <p className="text-[10px] font-bold text-amber-600 pt-1">
                                                      Fora da soma de peso (o custo conta, o peso não): {foraDaSoma.map(x => x.ing.nome).join(", ")}. Cadastre o peso médio desses insumos para entrarem.
                                                   </p>
                                                )}
                                             </div>
                                          </details>
                                          </>
                                       );
                                    })()}
                                 </>
                              );
                           })()
                        ) : (
                        <>
                        <div className={`grid ${["kg", "g", "l", "ml"].includes(String(form.rendimento_unidade || "porcao").toLowerCase()) ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantidade</label>
                              <input type="number" step="0.01" placeholder="Ex: 80" value={form.rendimento_porcoes} onChange={e=>{
                                 setForm({...form, rendimento_porcoes: e.target.value});
                                 setAutoSoma(false);
                              }} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-emerald-500 text-center"/>
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medido em</label>
                              <select value={form.rendimento_unidade} onChange={e=>{
                                 const newUn = String(e.target.value).toLowerCase();
                                 const oldUn = String(form.rendimento_unidade || "porcao").toLowerCase();
                                 let newVal = Number(String(form.rendimento_porcoes).replace(',', '.')) || 0;
                                 
                                 if (newVal > 0) {
                                    if (oldUn === "kg" && newUn === "g") newVal = newVal * 1000;
                                    else if (oldUn === "g" && newUn === "kg") newVal = newVal / 1000;
                                    else if (oldUn === "l" && newUn === "ml") newVal = newVal * 1000;
                                    else if (oldUn === "ml" && newUn === "l") newVal = newVal / 1000;
                                 }

                                 setForm({
                                    ...form, 
                                    rendimento_unidade: newUn,
                                    rendimento_porcoes: newVal > 0 ? String(newVal).replace('.', ',') : form.rendimento_porcoes
                                 });
                                 setAutoSoma(false);
                              }} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                                 {ehBarFicha ? <>
                                    <option value="ml">ml</option>
                                    <option value="l">L</option>
                                    <option value="porcao">doses</option>
                                    <option value="un">unidades</option>
                                 </> : <>
                                    <option value="porcao">porções</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">L</option>
                                    <option value="ml">ml</option>
                                    <option value="un">unidades</option>
                                 </>}
                              </select>
                           </div>
                           {!["kg", "g", "l", "ml"].includes(String(form.rendimento_unidade || "porcao").toLowerCase()) && (
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ehBarFicha ? "Dose tem (ml)" : "Porção pesa (g)"}</label>
                                 <input type="number" step="0.1" min="0" placeholder={ehBarFicha ? "Ex: 50" : "Ex: 300"} value={form.peso_porcao_g} onChange={e=>{
                                    setForm({...form, peso_porcao_g: e.target.value});
                                    setAutoSoma(false);
                                 }} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-emerald-500 text-center"/>
                              </div>
                           )}
                        </div>

                        {/* Resumo em UMA linha do que isso significa */}
                        {(() => {
                           const rendimento = Number(form.rendimento_porcoes) || 0;
                           const pesoPorcao = Number(form.peso_porcao_g) || 0;
                           const unR = String(form.rendimento_unidade || "porcao").toLowerCase();
                           const est = rendimentoPelosIngredientes(ingFicha);
                           const pesoTotalG = pesoTotalDaFicha(rendimento, unR, pesoPorcao) || (est ? est.totalG : 0);
                           const custoTotal = calcularCustoTotal(ingFicha);
                           const porcoesRendidas = (unR === "porcao" || unR === "un")
                              ? rendimento
                              : (pesoPorcao > 0 && pesoTotalG > 0 ? pesoTotalG / pesoPorcao : null);
                           const custoKg = pesoTotalG > 0 ? custoTotal / (pesoTotalG / 1000) : null;
                           const custoPorc = porcoesRendidas > 0 ? custoTotal / porcoesRendidas : null;

                           if (!pesoTotalG && !porcoesRendidas) {
                              // Sem dados suficientes: só a sugestão pelos ingredientes, se houver
                              return est ? (
                                 <p className="text-[11px] font-bold text-slate-500 mt-3">
                                    Os ingredientes somam <span className="text-slate-800">{est.valor.toLocaleString("pt-BR")} {({ kg: "kg", g: "g", l: "L", ml: "ml" })[est.unidade]}</span>.
                                    <button type="button" onClick={() => setForm(f => ({ ...f, rendimento_porcoes: String(est.valor), rendimento_unidade: est.unidade }))} className="ml-1.5 text-emerald-600 underline hover:text-emerald-700">Usar como rendimento</button>
                                 </p>
                              ) : null;
                           }
                           return (
                              <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                                 <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                    {unR === "porcao" ? (
                                       <>
                                          Rende <span className="font-black text-slate-900">{rendimento} {rendimento >= 2 ? "porções" : "porção"}</span>
                                          {pesoPorcao > 0 && <> de <span className="font-black text-slate-900">{pesoPorcao}g</span> (Total: {fmtG(pesoTotalG)})</>}
                                       </>
                                    ) : (
                                       <>
                                          Rende <span className="font-black text-slate-900">{rendimento} {unR}</span>
                                          {porcoesRendidas !== null && pesoPorcao > 0 && <> = <span className="font-black text-slate-900">{(+porcoesRendidas.toFixed(1)).toLocaleString("pt-BR")} porções de {pesoPorcao}g</span></>}
                                       </>
                                    )}
                                    {custoPorc !== null && <> · porção custa <span className="font-black text-emerald-700">{fmtBRL(custoPorc)}</span></>}
                                    {custoKg !== null && <> · 1 {baseCustoDaFicha(unR, unGrande)} custa <span className="font-black text-emerald-700">{fmtBRL(custoKg)}</span></>}
                                 </p>
                                 {est && Math.abs(est.totalG - pesoTotalG) / Math.max(est.totalG, pesoTotalG) > 0.05 && (
                                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                                       Ingredientes somam {fmtG(est.totalG)} (diferença = água/perdas do preparo).
                                       <button type="button" onClick={() => setForm(f => ({ ...f, rendimento_porcoes: String(est.valor), rendimento_unidade: est.unidade }))} className="ml-1 text-emerald-600 underline hover:text-emerald-700">Usar esse valor</button>
                                    </p>
                                 )}
                              </div>
                           );
                        })()}
                        </>
                        )}
                     </div>
                     )}

                     {/* COMPOSIÇÃO DA PORÇÃO: quantas gramas de cada ingrediente vão em 1 porção */}
                     {(() => {
                        const rendimento = Number(form.rendimento_porcoes) || 0;
                        if (!rendimento) return null;
                        const pesoPorcaoFinal = Number(form.peso_porcao_g) || 0;

                        // Nº de porções: direto (porções/un) ou derivado do peso total
                        const unR = String(form.rendimento_unidade || "porcao").toLowerCase();
                        const pesoTotalG = pesoTotalDaFicha(rendimento, unR, pesoPorcaoFinal);
                        const nPorcoes = (unR === "porcao" || unR === "un")
                           ? rendimento
                           : (pesoPorcaoFinal > 0 && pesoTotalG > 0 ? pesoTotalG / pesoPorcaoFinal : 0);
                        if (!nPorcoes) return null;

                        // Converte cada ingrediente pesável para gramas por porção
                        const composicao = ingFicha.map(ing => {
                           const u = String(ing.unidade).toLowerCase();
                           let g = null;
                           if ((u === "kg" || u === "l") && ing.quantidade > 0) {
                              g = (ing.quantidade * 1000) / nPorcoes;
                           } else if (ing.tipo === "base" && u === "un" && ing.quantidade > 0) {
                              const b = fichas.find(x => x.id === ing.subficha_id);
                              const pg = Number(b?.peso_porcao_g) || 0;
                              if (pg) g = (ing.quantidade * pg) / nPorcoes;
                           }
                           return g ? { nome: ing.nome, g } : null;
                        }).filter(Boolean);

                        if (composicao.length < 2) return null;
                        const totalInNatura = composicao.reduce((a, c) => a + c.g, 0);
                        // % sobre o peso final da porção (se informado) ou sobre o total in natura
                        const baseRef = pesoPorcaoFinal > 0 ? pesoPorcaoFinal : totalInNatura;
                        const difPreparo = pesoPorcaoFinal > 0 ? ((pesoPorcaoFinal - totalInNatura) / totalInNatura) * 100 : null;

                        return (
                           <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Composição da porção{pesoPorcaoFinal > 0 ? ` (${pesoPorcaoFinal}g final)` : ''}</p>
                              <div className="space-y-2">
                                 {composicao.map((c, i) => {
                                    const pct = (c.g / baseRef) * 100;
                                    return (
                                       <div key={i}>
                                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-0.5">
                                             <span className="truncate">{c.nome}</span>
                                             <span className="shrink-0 ml-2">{(+c.g.toFixed(1)).toLocaleString("pt-BR")} g · {pct.toFixed(0)}%</span>
                                          </div>
                                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                             <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-500">
                                 <span>Total in natura: {(+totalInNatura.toFixed(1)).toLocaleString("pt-BR")} g / porção</span>
                                 {difPreparo !== null && Math.abs(difPreparo) >= 1 && (
                                    <span className={difPreparo < 0 ? "text-red-500" : "text-emerald-600"}>
                                       {difPreparo < 0 ? `Perda no preparo: ${Math.abs(difPreparo).toFixed(0)}%` : `Ganho no preparo: +${difPreparo.toFixed(0)}%`}
                                    </span>
                                 )}
                              </div>
                           </div>
                        );
                     })()}

                     {/* CMV E PRECIFICAÇÃO — o preço de venda vive AQUI (Produtos e Preços saiu do menu) */}
                     {!form.eh_base && !ehBarFicha && <div className="rounded-2xl border-2 border-pink-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                           <div><p className="text-xs font-black uppercase tracking-widest text-pink-700">Embalagens</p><p className="mt-1 text-xs font-medium text-slate-500">Selecione o que acompanha cada prato. O custo entra automaticamente no CMV.</p></div>
                           <span className="shrink-0 rounded-lg bg-pink-50 px-3 py-2 text-sm font-black text-pink-700">{fmtBRL(custoEmbalagensPorPorcao())}/porcao</span>
                        </div>
                        {embalagensEstoque.length > 0 ? <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                           {embalagensEstoque.map(emb => {
                              const selecionada = fichaEmbalagens.find(item => String(item.embalagem_id) === String(emb.id));
                              return <div key={emb.id} className={`rounded-xl border p-3 ${selecionada ? "border-pink-400 bg-pink-50" : "border-slate-200 bg-slate-50"}`}>
                                 <button type="button" onClick={() => alternarEmbalagemFicha(emb.id)} className="flex w-full items-center gap-2 text-left">
                                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${selecionada ? "bg-pink-600 text-white" : "bg-white text-slate-400"}`}>{selecionada ? <CheckSquare2 size={16}/> : <Package size={16}/>}</span>
                                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{emb.nome}</strong><small className="font-bold text-slate-500">{fmtBRL(emb.preco_unitario)} cada · saldo {Number(emb.quantidade_atual) || 0}</small></span>
                                 </button>
                                 {selecionada && <label className="mt-2 flex items-center justify-between gap-2 border-t border-pink-200 pt-2 text-xs font-bold text-pink-800"><span>Quantidade por venda</span><input type="number" min="0.01" step="0.01" value={selecionada.qtd} onChange={e => alterarQuantidadeEmbalagem(emb.id, e.target.value)} className="h-9 w-24 rounded-lg border border-pink-300 bg-white px-2 text-right font-black outline-none" /></label>}
                              </div>;
                           })}
                        </div> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">Nenhuma embalagem cadastrada neste setor.</p>}
                        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-pink-300 bg-pink-50 p-3 sm:grid-cols-[1fr_140px_auto]">
                           <input value={novaEmbalagem.nome} onChange={e => setNovaEmbalagem({ ...novaEmbalagem, nome: e.target.value })} placeholder="Nova embalagem (ex.: Marmita 500 ml)" className="h-11 min-w-0 rounded-lg border border-pink-200 bg-white px-3 text-sm font-bold outline-none focus:border-pink-500" />
                           <input value={novaEmbalagem.custo} onChange={e => setNovaEmbalagem({ ...novaEmbalagem, custo: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="Custo R$" inputMode="decimal" className="h-11 min-w-0 rounded-lg border border-pink-200 bg-white px-3 text-sm font-bold outline-none focus:border-pink-500" />
                           <button type="button" disabled={salvandoEmbalagem} onClick={cadastrarEmbalagemDaFicha} className="h-11 rounded-lg bg-pink-600 px-4 text-sm font-black text-white disabled:opacity-50">{salvandoEmbalagem ? "Salvando..." : "Cadastrar e usar"}</button>
                        </div>
                     </div>}

                     {/* Só drink pronto tem método: xarope e infusão não se batem nem se mexem. */}
                     {form.departamento === "bar" && !form.eh_base && (
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Método de preparo</label>
                           <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                              {METODOS_BAR.map(metodo => {
                                 const ativo = form.metodo_bar === metodo.id;
                                 return (
                                    <button key={metodo.id} type="button"
                                       onClick={() => setForm({ ...form, metodo_bar: ativo ? "" : metodo.id })}
                                       className={`rounded-xl border-2 p-3 text-left transition ${ativo ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                                       <span className={`block text-sm font-black ${ativo ? "text-emerald-700" : "text-slate-700"}`}>{metodo.nome}</span>
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     )}

                     {!form.eh_base && (() => {
                        const custoTotalForm = custoTotalFormulario(ingFicha);
                        const rendForm = Number(String(form.rendimento_porcoes).replace(",", ".")) || 0;
                        const unRF = String(form.rendimento_unidade || "porcao").toLowerCase();
                        const pesoPorcaoF = Number(form.peso_porcao_g) || 0;
                        const pesoTotalF = pesoTotalDaFicha(rendForm, unRF, pesoPorcaoF);
                        const nPorc = (unRF === "porcao" || unRF === "un") ? rendForm : (pesoPorcaoF > 0 && pesoTotalF > 0 ? pesoTotalF / pesoPorcaoF : 0);
                        const custoPorc = nPorc > 0 ? custoTotalForm / nPorc : custoTotalForm;
                        const meta = Number(form.cmv_meta) || 30;
                        const sugerido = meta > 0 ? custoPorc / (meta / 100) : 0;
                        const precoNum = Number(String(form.preco_venda ?? "").replace(",", ".")) || 0;
                        const cmvTeo = precoNum > 0 ? (custoPorc / precoNum) * 100 : null;
                        const margem = cmvTeo !== null ? 100 - cmvTeo : null;
                        const lucro = precoNum > 0 ? precoNum - custoPorc : null;
                        return (
                           <div id="ficha-custos" className="bg-white border-2 border-emerald-200 rounded-2xl p-4 shadow-sm scroll-mt-24">
                              <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-3">CMV e Precificação</p>
                              {/* Tres cartoes de custo viraram um. O que decide preco e
                                  o custo de UMA unidade vendida: total e custo por kg
                                  ficavam ao lado repetindo a mesma conta por outro
                                  caminho, e ninguem precificava por eles. */}
                              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{ehBarFicha ? "Custo do produto" : "Custo por porção"}</p>
                                 <p className="text-lg font-black text-slate-800">{fmtBRL(custoPorc)}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CMV meta (%)</label>
                                    <input type="number" min="1" max="90" value={form.cmv_meta} onChange={e => setForm({ ...form, cmv_meta: e.target.value })} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preço de venda/porção (R$)</label>
                                    <input type="text" inputMode="decimal" placeholder={sugerido > 0 ? sugerido.toFixed(2) : "0,00"} value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value.replace(/[^0-9.,]/g, "") })} className="w-full p-3 mt-1 bg-emerald-50 border-2 border-emerald-300 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500" />
                                 </div>
                              </div>
                              {sugerido > 0 && (
                                 <button type="button" onClick={() => setForm({ ...form, preco_venda: sugerido.toFixed(2) })} className="mt-2 w-full text-left bg-slate-50 border border-slate-200 rounded-xl p-2.5 hover:border-emerald-400 transition-colors">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Preço sugerido/porção (CMV {meta}%)</span>
                                    <span className="text-lg font-black text-slate-800">{fmtBRL(sugerido)}</span>
                                    <span className="text-[10px] font-bold text-slate-400 ml-2">toque para usar</span>
                                 </button>
                              )}
                              {cmvTeo !== null ? (
                                 <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className={`rounded-xl p-2.5 text-center border ${cmvTeo > meta ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">CMV teórico</p>
                                       <p className={`text-lg font-black ${cmvTeo > meta ? "text-red-600" : "text-emerald-700"}`}>{cmvTeo.toFixed(1)}%</p>
                                    </div>
                                    <div className="rounded-xl p-2.5 text-center border bg-emerald-50 border-emerald-200">
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Margem</p>
                                       <p className="text-lg font-black text-emerald-700">{margem.toFixed(1)}%</p>
                                    </div>
                                    <div className="rounded-xl p-2.5 text-center border bg-emerald-50 border-emerald-200">
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Lucro</p>
                                       <p className="text-lg font-black text-emerald-700">{lucro !== null ? fmtBRL(lucro) : "—"}</p>
                                    </div>
                                 </div>
                              ) : (
                                 <p className="text-[11px] font-medium text-slate-400 mt-2">Defina o preço de venda para ver CMV teórico, margem e lucro.</p>
                              )}
                           </div>
                        );
                     })()}

                     {form.eh_base && <div id="ficha-preparo" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de Preparo</label>

                        {/* Assistente de IA: você explica solto, a IA estrutura em etapas */}
                        <div className="mt-1 mb-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                           <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={15} className="text-emerald-600" />
                              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Explique com suas palavras — a IA organiza</span>
                           </div>
                           <textarea
                              placeholder="Ex: refogo a cebola no azeite numa panela, junto o camarão, deixo uns 5 min, jogo o leite de coco e o tucupi e cozinho até engrossar..."
                              value={iaExplicacao}
                              onChange={e => setIaExplicacao(e.target.value)}
                              className="w-full h-20 p-3 bg-white border border-emerald-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                           <button
                              type="button"
                              onClick={gerarPreparoIA}
                              disabled={iaLoading}
                              className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                           >
                              {iaLoading
                                 ? <><Loader2 size={16} className="animate-spin" /> Estruturando etapas...</>
                                 : <><Sparkles size={16} /> Gerar modo de preparo</>}
                           </button>
                           <p className="text-[10px] text-emerald-700/70 font-medium mt-1.5 leading-tight">A IA deduz panela, se vai ao fogo, o tempo de cada etapa e o tempo total. Você pode editar o texto depois.</p>
                        </div>

                        <textarea placeholder="Passo a passo da execução..." value={form.modo_preparo} onChange={e=>setForm({...form, modo_preparo: e.target.value})} className="w-full h-52 p-4 mt-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm resize-y"></textarea>
                     </div>}

                  </div>


               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-3">
                  <button onClick={() => handleSalvar(false)} className="flex-1 py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> {form.id ? "Salvar alterações" : form.produto_pronto ? "Salvar produto pronto" : `Salvar ficha (${fmtBRL(custoTotalFormulario(ingFicha))})`}
                  </button>
                  {!form.id && (
                     <button onClick={() => handleSalvar(true)} className="sm:w-56 py-5 bg-white border-2 border-slate-300 hover:border-slate-900 text-slate-800 font-black text-base rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Plus size={18}/> Salvar e criar outra
                     </button>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* SIMULAÇÃO DE RENDIMENTO — recalcula os ingredientes para outra quantidade */}
      {modalSim && (() => {
         const unLabel = { porcao: "porções", kg: "kg", g: "g", l: "L", ml: "ml", un: "un" }[String(modalSim.rendimento_unidade || "porcao").toLowerCase()] || modalSim.rendimento_unidade;
         const original = Number(modalSim.rendimento_porcoes) || 1;
         const alvo = Number(String(simAlvo).replace(",", ".")) || 0;
         const factor = original > 0 ? alvo / original : 0;
         const linhas = linhasSimuladas(modalSim, factor);
         const custoOrig = custoTotalDaFicha(modalSim, fichas);
         const custoSim = custoOrig * factor;
         const alvoTxt = `${(+alvo.toFixed(3)).toLocaleString("pt-BR")} ${unLabel}`;
         return (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setModalSim(null)}>
            <div className="bg-white rounded-[28px] w-full max-w-lg max-h-[88vh] p-6 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between mb-1">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calculator size={20} className="text-emerald-600" /> Simular rendimento</h2>
                  <button onClick={() => setModalSim(null)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={17} /></button>
               </div>
               <p className="text-sm font-bold text-slate-700">{modalSim.nome_receita}</p>
               <p className="text-xs font-medium text-slate-500 mb-4">Receita original rende <b>{(+original).toLocaleString("pt-BR")} {unLabel}</b>. Escolha o quanto quer produzir e os ingredientes se ajustam.</p>

               <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quero produzir</label>
                     <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500">
                        <input type="text" inputMode="decimal" value={simAlvo} onChange={e => setSimAlvo(e.target.value.replace(/[^0-9.,]/g, ""))} className="w-full p-3 text-center bg-transparent font-black text-lg text-slate-700 outline-none" />
                        <div className="flex items-center justify-center px-3 bg-slate-100 border-l border-slate-200 text-sm font-bold text-slate-500 shrink-0">{unLabel}</div>
                     </div>
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fator</p>
                     <p className="text-lg font-black text-emerald-600">{factor > 0 ? `${(+factor.toFixed(3)).toLocaleString("pt-BR")}×` : "—"}</p>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto -mx-1 px-1">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                     <div className="bg-slate-50 px-4 py-2 grid grid-cols-[1fr_auto] text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                        <span>Ingrediente</span><span>Quantidade</span>
                     </div>
                     {linhas.length === 0 ? (
                        <p className="p-4 text-sm text-slate-400 font-medium">Esta ficha não tem ingredientes cadastrados.</p>
                     ) : linhas.map((l, i) => (
                        <div key={i} className="px-4 py-2.5 grid grid-cols-[1fr_auto] items-center border-b border-slate-50 last:border-0">
                           <span className="font-bold text-slate-700 text-sm truncate">{l.nome}</span>
                           <span className="font-black text-slate-800 text-sm">{l.qtdFmt}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="flex items-center justify-between mt-4 mb-3 px-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Custo desta produção</span>
                  <span className="text-xl font-black text-emerald-600">{fmtBRL(custoSim)}</span>
               </div>
               <div className="flex gap-3">
                  <button onClick={() => setModalSim(null)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Fechar</button>
                  <button onClick={() => imprimirSimulacao(modalSim, factor, alvoTxt)} disabled={!(factor > 0)} className="flex-1 py-3 rounded-xl font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2"><Printer size={16} /> Imprimir</button>
               </div>
            </div>
         </div>
         );
      })()}

      {/* REMOVER / SUBSTITUIR INGREDIENTE DA FICHA */}
      {substituirAlvo && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={fecharSubstituicao}>
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between mb-1">
                  <h3 className="text-xl font-black text-slate-800">Remover “{substituirAlvo.nome}”</h3>
                  <button onClick={fecharSubstituicao} className="text-slate-400 hover:text-slate-600 p-1"><X size={20}/></button>
               </div>
               <p className="text-sm font-medium text-slate-500 mb-4">Quer substituir por outro ingrediente cadastrado ou só remover?</p>

               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Substituir por (opcional)</label>
               <select value={substitutoValor} onChange={e => setSubstitutoValor(e.target.value)} className="w-full mt-1 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-emerald-500 text-sm">
                  <option value="">Escolher um ingrediente...</option>
                  <optgroup label="Insumos">
                     {insumosAtivos.filter(i => i.id !== substituirAlvo.chave).map(i => <option key={i.id} value={`insumo:${i.id}`}>{i.nome} ({i.unidade_medida})</option>)}
                  </optgroup>
                  {basesDisponiveis.filter(b => b.id !== substituirAlvo.chave).length > 0 && (
                     <optgroup label="Bases / Pré-preparos">
                        {basesDisponiveis.filter(b => b.id !== substituirAlvo.chave).map(b => <option key={b.id} value={`base:${b.id}`}>{b.nome_receita} ({b.rendimento_unidade})</option>)}
                     </optgroup>
                  )}
               </select>

               <div className="flex gap-3">
                  <button onClick={soRemover} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">Não, só remover</button>
                  <button onClick={confirmarSubstituicao} disabled={!substitutoValor} className="flex-1 py-3 rounded-xl font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Substituir</button>
               </div>
            </div>
         </div>
      )}

      {/* MONTAR FICHA COM IA (texto/foto da receita) */}
      {modalIAFicha && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
             <div className="bg-white rounded-3xl sm:rounded-[32px] w-full max-w-3xl my-2 sm:my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]">
               <div className="flex justify-between items-center gap-3 p-4 sm:p-8 pb-4 sm:pb-6 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Sparkles size={22}/></div>
                     <div>
                         <h2 className="font-black text-xl sm:text-2xl text-slate-800">Montar Ficha Técnica com IA</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Cole a receita ou envie uma foto — a IA monta nome, ingredientes e modo de preparo</p>
                     </div>
                  </div>
                  <button onClick={() => setModalIAFicha(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar space-y-5">
                  {!iaFResultado ? (
                     <>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Colar a receita (opcional se enviar foto)</label>
                           <textarea
                              placeholder={"Ex:\nTacacá: refogo camarão seco no azeite, junto tucupi e goma, cozinho 15 min mexendo, sirvo com jambu e pimenta..."}
                              value={iaFTexto}
                              onChange={e => setIaFTexto(e.target.value)}
                              className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ou enviar foto (caderno de receitas, print, etc)</label>
                           <input ref={fileInputFichaRef} type="file" accept="image/*" onChange={handleSelecionarImagemFicha} className="hidden" />
                           {iaFImagem ? (
                              <div className="mt-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                 <img src={iaFImagem.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-700 truncate">{iaFImagem.nomeArquivo}</p>
                                    <button onClick={() => setIaFImagem(null)} className="text-xs font-bold text-red-500 hover:text-red-600 mt-1">Remover foto</button>
                                 </div>
                              </div>
                           ) : (
                              <button type="button" onClick={() => fileInputFichaRef.current?.click()} className="w-full mt-1 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors">
                                 <Camera size={24} />
                                 <span className="font-bold text-sm">Tirar foto ou escolher da galeria</span>
                              </button>
                           )}
                        </div>

                        <button
                           onClick={gerarFichaIA}
                           disabled={iaFLoading}
                           className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                           {iaFLoading ? <><Loader2 size={18} className="animate-spin"/> Montando ficha técnica...</> : <><Sparkles size={18}/> Montar ficha técnica</>}
                        </button>
                     </>
                  ) : (
                     <>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do prato (vai pro cardápio)</label>
                           <input type="text" value={iaFResultado.nome_receita} onChange={e=>setIaFResultado({...iaFResultado, nome_receita: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500" />
                           {(() => {
                              const pesoIA = rendimentoPelosIngredientes(
                                 iaFResultado.itens.map(it => {
                                    const ins = insumosAtivos.find(i => i.id === it.vinculoId);
                                    return { unidade: it.unidade_lida, quantidade: it.quantidade_lida, peso_medio_g: ins?.peso_medio_g || null,
                                       unidade_medida: ins?.unidade_medida, volume_unidade_ml: ins?.volume_unidade_ml || null };
                                 })
                              );
                              if (pesoIA) return (
                                 <>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 block">Rendimento (peso total)</label>
                                    <div className="mt-1 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                       <span className="font-black text-emerald-700 text-lg">{pesoIA.valor.toLocaleString("pt-BR")} {pesoIA.unidade}</span>
                                       <span className="block text-[10px] font-bold text-emerald-600/80 mt-0.5">Somado automaticamente dos ingredientes. Você pode ajustar na ficha (perdas do cozimento).</span>
                                    </div>
                                 </>
                              );
                              return (
                                 <>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 block">Rendimento (porções)</label>
                                    <input type="number" value={iaFResultado.rendimento_porcoes} onChange={e=>setIaFResultado({...iaFResultado, rendimento_porcoes: e.target.value})} className="w-24 p-3 mt-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 outline-none focus:border-emerald-500" />
                                    <span className="block text-[10px] font-medium text-slate-400 mt-1">Ingredientes em unidades (sem peso) — informe as porções manualmente.</span>
                                 </>
                              );
                           })()}
                        </div>

                        <div>
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ingredientes identificados</p>
                           <div className="space-y-2">
                              {iaFResultado.itens.map((it, idx) => {
                                 const vinculado = it.vinculoId !== "novo";
                                 return (
                                    <div key={idx} className={`p-3 rounded-xl border ${vinculado ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                       <div className="flex items-center gap-2 flex-wrap">
                                          {vinculado ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0"/> : <AlertTriangle size={16} className="text-amber-600 shrink-0"/>}
                                          <span className="font-bold text-slate-800 text-sm">{it.nomeOriginal}</span>
                                          <span className="text-xs font-bold text-slate-400">({it.quantidade_lida}{it.unidade_lida})</span>
                                          <select
                                             value={it.vinculoId}
                                             onChange={e => atualizarItemIAFicha(idx, { vinculoId: e.target.value })}
                                             className="ml-auto p-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-emerald-500"
                                          >
                                             <option value="novo">-- Cadastrar novo --</option>
                                             {insumosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                                          </select>
                                       </div>

                                       {!vinculado && (
                                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                                             <input type="text" placeholder="Marca (opcional)" value={it.novo.marca} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, marca: e.target.value } })} className="w-32 p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500" />
                                             <select value={it.novo.unidade_medida} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, unidade_medida: e.target.value } })} className="w-20 p-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-emerald-500">
                                                <option value="kg">KG</option>
                                                <option value="l">L</option>
                                                <option value="un">UN</option>
                                                <option value="g">G</option>
                                                <option value="ml">ML</option>
                                             </select>
                                             <input type="number" step="0.01" placeholder="Custo/base" value={it.novo.custo_unitario} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, custo_unitario: e.target.value } })} className="w-24 p-2 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-600 text-xs outline-none focus:border-emerald-500" />
                                             <button onClick={() => cadastrarInsumoIAFicha(idx)} disabled={it.cadastrando} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
                                                {it.cadastrando ? <Loader2 size={12} className="animate-spin"/> : null} Cadastrar e usar
                                             </button>
                                          </div>
                                       )}
                                    </div>
                                 );
                              })}
                           </div>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de preparo (editável)</label>
                           <textarea value={iaFResultado.modo_preparo} onChange={e=>setIaFResultado({...iaFResultado, modo_preparo: e.target.value})} className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 text-sm outline-none focus:border-emerald-500 resize-none"></textarea>
                        </div>

                        <button onClick={() => setIaFResultado(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Voltar e enviar outra receita/foto</button>
                     </>
                  )}
               </div>

               {iaFResultado && (
                  <div className="p-4 sm:p-8 sm:pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0">
                     <button onClick={usarFichaIA} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                        <Save size={20}/> Usar esta ficha
                     </button>
                  </div>
               )}
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando módulo...</div>}>
       <FichasRunner />
    </Suspense>
  );
}
