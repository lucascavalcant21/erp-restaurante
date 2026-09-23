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
  atualizarCategoriaFicha, atualizarOrdemFicha, excluirFichasLote, fetchFichas, fetchInsumos,
  inativarFichasLote, registrarAuditoriaFichas, salvarFicha, salvarInsumo,
} from "../../../lib/operacao";
import { fetchEstoques, vincularItemEstoque } from "../../../lib/estoques-multiplos";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchEmbalagens, salvarEmbalagem } from "../../../lib/embalagens";
import { garantirFichaNoEstoquePreparo } from "../../../lib/estoques-multiplos";
import { fetchMontagens, inserirMontagem } from "../../../lib/montagem";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, BookOpen, Calculator, Camera,
  CheckCircle2, CheckSquare2, ChevronLeft, ChevronRight, Copy, Download, Edit3,
  FileDown, FolderPlus, GripVertical, LayoutList, Loader2, Package, Plus, Printer, Save,
  Search, Sparkles, Trash2, UtensilsCrossed, Wine, X,
  Clock, Thermometer, MoreVertical, PieChart,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { logoSeldeestrelaSVG } from "../../../lib/marca";
import { baixarPdfDeHtml } from "../../../lib/pdf";
import { fetchHistoricoCustoFicha, registrarCustoFicha } from "../../../lib/ficha-custos";
import { fetchCategoriasFichas, salvarCategoriasFichas, fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import PizzaDoPrato from "./PizzaDoPrato";
import { METODOS_BAR, metodoBar, fetchComplementosDeFichas } from "../../../lib/ficha-tecnica";
import { hasPermission, permissionKey } from "../../../lib/permissions-catalog.mjs";
import {
  estimarPaginasDocumento,
  ordenarFichasDocumento,
} from "../../../lib/fichas-lote-utils.mjs";
import {
  unidadeNormalizada,
} from "../../../lib/ingredientes-utils.mjs";
/* O calculo de custo mora na lib, com testes. Esta tela mantinha copias
 * proprias das mesmas contas — a tela de DETALHE da ficha ja importava daqui,
 * entao o mesmo prato tinha duas rotas de calculo dependendo de onde voce
 * estava olhando.
 *
 * Conferido antes de trocar: 800 fichas geradas (com subfichas encadeadas)
 * deram o MESMO custo nas duas implementacoes, ate o centavo. A unica
 * divergencia aparece com fator_correcao negativo — peso bruto menor que o
 * liquido, dado impossivel —, onde a copia da tela reduzia o custo e a lib
 * ignora a correcao. Se alguma ficha sua tiver esse valor, a lista e o detalhe
 * mostravam custos diferentes ate hoje; agora mostram o da lib.
 *
 * Os apelidos preservam os nomes usados nesta tela: sao 22 pontos de chamada,
 * e renomear todos e como se cria `ReferenceError` de identificador orfao. */
import {
  converterParaBaseDoInsumo as converterParaBase,
  custoUnitarioEfetivoInsumo as custoUnitEfetivo,
  custoDeProduzirFicha as custoTotalDaFicha,
  pesoTotalDaFicha,
  unidadePadraoDepartamento,
  rendimentoPadronizado,
  rendimentoPelosIngredientes,
} from "../../../lib/ficha-calculos.mjs";

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
// METODOS_BAR e metodoBar vivem em lib/ficha-tecnica.js: a ficha técnica grava
// o mesmo `metodo_bar`, e duas listas separadas divergiriam nos ids.
const CATEGORIAS_PREPARO_COZINHA = [
  "Empanamentos e farinhas",
  "Salmouras e marinadas",
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

// Sub-unidades para lançamento em ficha. O custo do insumo é por unidade-base
// (R$/kg, R$/L). Em receita pensamos em g/ml, então convertemos: 1 base = `f` sub.
// Ex: kg → g (f=1000). Insumos em "un" não têm sub-unidade.
const SUB_UNIDADES = {
  kg: { sub: "g",  f: 1000 },
  l:  { sub: "ml", f: 1000 },
};
const getSub = (unidade) => SUB_UNIDADES[String(unidade || "").toLowerCase()] || null;

// Custo por unidade-de-rendimento de uma base (usado quando ela vira ingrediente)
function custoUnitBase(base, todasFichas) {
  return custoTotalDaFicha(base, todasFichas) / (base.rendimento_porcoes || 1);
}

function textoRendimentoPadronizado(ficha) {
  const padrao = rendimentoPadronizado(ficha);
  const unidade = padrao.unidade === "l" ? "L" : "kg";
  return `${padrao.valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unidade}`;
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
const fmtG = (g) => g >= 1000
  ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`
  : `${(+g.toFixed(1)).toLocaleString("pt-BR")} g`;

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
  const custo = (Number(ing.custo_unitario) || 0) * q;
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
  const [alterandoCategoriaId, setAlterandoCategoriaId] = useState("");
  const [modoFicha, setModoFicha] = useState("principais");
  const [tipoFiltro, setTipoFiltro] = useState("Pratos principais");
  const [mostrarIndicadores, setMostrarIndicadores] = useState(false);
  const [apenasAcimaMeta, setApenasAcimaMeta] = useState(false);
  // Ficha inativada continua no banco e volta quando o usuário quiser ver.
  const [filtroStatus, setFiltroStatus] = useState("ativas"); // ativas | inativas | todas

  // Permissão de ver custos. Falha para o lado aberto onde o controle de acesso
  // ainda não foi ligado (`gerenciado` falso), igual ao guarda de rota do
  // dashboard — senão ninguém veria custo nenhum nessas instalações.
  const podeVerCustos = !sessao?.gerenciado
    || hasPermission(sessao, permissionKey("fichas", "recipes", "view_costs"))
    || hasPermission(sessao, permissionKey(deptUrl === "bar" ? "bar" : "cozinha", "recipes", "view_costs"));
  const [categoriasRecolhidas, setCategoriasRecolhidas] = useState(false);
  const [acoesCardAberto, setAcoesCardAberto] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEscolhaNovo, setModalEscolhaNovo] = useState(false);
  const [modalTitulosLote, setModalTitulosLote] = useState(false);
  const [titulosLote, setTitulosLote] = useState("");
  const [salvandoTitulosLote, setSalvandoTitulosLote] = useState(false);
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
  const [salvandoFicha, setSalvandoFicha] = useState(false);

  const [selecionadas, setSelecionadas] = useState([]);
  const [dragId, setDragId] = useState(null); // arrastar para reordenar
  // Pizza do prato: vale para a grade inteira, nao por cartao. O gestor quer
  // comparar a fatia de lucro de um prato com a do outro lado a lado.
  const [verPizza, setVerPizza] = useState(false);
  // Custo fixo e CMO vem dos parametros do Ponto de Equilibrio; sem eles a
  // pizza mostra so o que a propria ficha sabe.
  const [paramsSis, setParamsSis] = useState(PARAMS_PADRAO);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(12);
  const [modalImpressao, setModalImpressao] = useState(null);
  // Etapas, equipamentos, alergênicos e armazenamento das fichas que vão para a
  // impressão. Ficam fora da listagem porque só a impressão precisa deles.
  const [complementosImpressao, setComplementosImpressao] = useState({});
  const [configImpressao, setConfigImpressao] = useState(null);
  const [ordemPersonalizada, setOrdemPersonalizada] = useState([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [mensagemLote, setMensagemLote] = useState("");
  const [erroLote, setErroLote] = useState("");

  // Estado do formulário da Ficha
  const [form, setForm] = useState({
    id: null,
    codigo: "",
    versao: "",
    responsavel: "",
    tempo_coccao: "",
    padrao_montagem: "",
    departamento: deptUrl,
    nome_receita: "",
    categoria: "",
    rendimento_porcoes: "1",
    modo_preparo: "",
    eh_base: false,
    produto_pronto: false,
    tipo_base: null,
    rendimento_unidade: deptUrl === "bar" ? "l" : "kg",
    peso_porcao_g: "",
    imagem: "", // Base64 da foto
    preco_venda: "",
    cmv_meta: 30
  });
  
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
  const [calcQtd, setCalcQtd] = useState("");
  const [calcUn, setCalcUn] = useState("g");

  // Ingredientes da ficha. Cada item tem `chave` (insumo_id OU subficha_id),
  // `tipo` ('insumo'|'base'), `custo_unitario` (por unidade-base) e `unidade`.
  const [ingFicha, setIngFicha] = useState([]);
  // Remoção de ingrediente: pergunta se quer substituir por outro cadastrado
  const [substituirAlvo, setSubstituirAlvo] = useState(null); // ingrediente sendo removido
  const [substitutoValor, setSubstitutoValor] = useState(""); // "insumo:<id>" | "base:<id>"

  // Simulação de rendimento: recalcula os ingredientes para outra quantidade
  const [modalSim, setModalSim] = useState(null); // ficha sendo simulada
  const [simAlvo, setSimAlvo] = useState("");      // rendimento desejado (mesma unidade)
  const abrirSimulacao = (f) => {
    const padrao = rendimentoPadronizado(f);
    const fichaPadronizada = { ...f, rendimento_porcoes: padrao.valor, rendimento_unidade: padrao.unidade };
    setModalSim(fichaPadronizada);
    setSimAlvo(String(padrao.valor || 1));
  };

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
      const unBase = unidadeNormalizada(insumo.unidade_medida) || String(insumo.unidade_medida || "un").toLowerCase();
      const quantidade = converterParaBase(it.quantidade_lida, it.unidade_lida, unBase);
      return {
        chave: insumo.id, tipo: "insumo", insumo_id: insumo.id,
        nome: insumo.nome, unidade: unBase,
        custo_unitario: custoUnitEfetivo(insumo), quantidade,
        peso_medio_g: insumo.peso_medio_g || null,
        modo: getSub(unBase) ? "sub" : "base",
      };
    });

    // Rendimento = peso total somado dos ingredientes (kg/g/l/ml), automático.
    // Usa peso médio do insumo p/ incluir itens em "un". Só cai para "porção"
    // se os ingredientes forem todos em unidades sem peso conhecido.
    const pesoIA = rendimentoPelosIngredientes(novosIngFicha, deptUrl);
    setForm({
      id: null, departamento: deptUrl,
      nome_receita: iaFResultado.nome_receita,
      categoria: "",
      rendimento_porcoes: pesoIA ? String(pesoIA.valor) : String(iaFResultado.rendimento_porcoes || 1),
      modo_preparo: iaFResultado.modo_preparo,
      eh_base: false,
      produto_pronto: false,
      tipo_base: null,
      rendimento_unidade: pesoIA ? pesoIA.unidade : unidadePadraoDepartamento(deptUrl),
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
       fetchInsumos(unidadeAtiva, deptUrl, { excluirPrePreparos: true }),
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
      const rendimento = Math.max(1, Number(ficha.rendimento_porcoes) || 1);
      return { ...ficha, custo_embalagens_total: custoPorPorcao * rendimento };
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

  useEffect(() => {
    setModoFicha("principais");
    setTipoFiltro("Pratos principais");
  }, [deptUrl]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    fetchCategoriasFichas(unidadeAtiva).then(({ data }) => setCategoriasConfig(data || {}));
    // Rateio do custo fixo e da mao de obra. Se nao vier nada, ficam os
    // padroes e a pizza avisa na propria legenda que faltam preencher.
    fetchParams(unidadeAtiva).then(({ data }) => setParamsSis({ ...PARAMS_PADRAO, ...(data || {}) }));
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
    if (ok && tipoFiltro === nome) setTipoFiltro(modoFicha === "preparos" ? "Pré-preparos" : "Pratos principais");
  };

  const organizarFichaNaCategoria = async (ficha, categoria) => {
    const categoriaAnterior = ficha.categoria || "";
    setAlterandoCategoriaId(ficha.id);
    setFichas(lista => lista.map(item => item.id === ficha.id ? { ...item, categoria: categoria || null } : item));
    const { error } = await atualizarCategoriaFicha(ficha.id, categoria);
    setAlterandoCategoriaId("");
    if (error) {
      setFichas(lista => lista.map(item => item.id === ficha.id ? { ...item, categoria: categoriaAnterior || null } : item));
      alert("Não foi possível mudar a categoria: " + error);
    }
  };

  // Rendimento automático: sempre que os ingredientes mudam (e não estiver no
  // modo manual), o rendimento passa a ser o PESO SOMADO dos ingredientes, na
  // unidade padrão do setor: cozinha em kg e bar em litros.
  useEffect(() => {
    if (form && autoSoma && ingFicha.length > 0) {
      const est = rendimentoPelosIngredientes(ingFicha, form.departamento || deptUrl);
      if (est && est.totalG > 0) {
         setForm(f => ({ ...f, rendimento_porcoes: String(est.valor), rendimento_unidade: est.unidade, peso_porcao_g: "" }));
      }
    }
  }, [ingFicha, autoSoma, form.departamento, deptUrl]);

  // Divisão do receituário: Pratos (prontos p/ cardápio) × Pré-preparos (bases
  // usadas dentro de outros pratos: molhos, massas, caldos...)
  const ordenarFichas = (a, b) => {
    return String(a.nome_receita || "").localeCompare(String(b.nome_receita || ""), "pt-BR", { sensitivity: "base" });
  };
  // Produto pronto (cerveja, refrigerante) não tem receita: é compra, não
  // receituário. Fica fora do receituário inteiro — quem cuida dele é o
  // cardápio e o estoque, não a ficha técnica.
  const ehAcimaDaMeta = (f) => {
    if (f.eh_base) return false;
    const peso = infoPesoFicha(f, fichas);
    const custoTotal = custoTotalDaFicha(f, fichas);
    const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
    const rend = Number(f.rendimento_porcoes) || 0;
    const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
    const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
    const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
    const preco = (prod && Number(prod.preco_venda) > 0) ? Number(prod.preco_venda) : (Number(f.preco_venda) > 0 ? Number(f.preco_venda) : 0);
    const meta = Number(f.cmv_meta) || 30;
    if (preco <= 0) return false;
    const cmv = (custoPorcao / preco) * 100;
    return cmv > meta;
  };

  // `status` só existe depois da migração da ficha técnica. Ficha sem status
  // gravado conta como ativa, senão a listagem esvaziaria de uma vez.
  const statusDaFicha = (f) => String(f.status || "ativa").toLowerCase();

  const passaFiltro = (f) => {
    if (!f.eh_base && f.tipo_base === "produto_pronto") return false;
    if (filtroStatus === "ativas" && statusDaFicha(f) === "inativa") return false;
    if (filtroStatus === "inativas" && statusDaFicha(f) !== "inativa") return false;
    if (apenasAcimaMeta && !ehAcimaDaMeta(f)) return false;
    if (tipoFiltro === "Pratos principais") return !f.eh_base;
    if (tipoFiltro === "Pré-preparos") return !!f.eh_base;
    if (tipoFiltro === "Pratos") return !f.eh_base;
    if (modoFicha === "preparos") return !!f.eh_base && (f.categoria || "") === tipoFiltro;
    return !f.eh_base && (f.categoria || "") === tipoFiltro; // categoria específica
  };
  const filtradas = fichas
    .filter(f => normalizarNome(f.nome_receita).includes(normalizarNome(busca)) && passaFiltro(f))
    .sort(ordenarFichas);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const fichasPagina = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);
  const fichasSelecionadas = selecionadas.map(id => fichas.find(f => f.id === id)).filter(Boolean);
  const usuarioAuditoria = {
    unidadeId: unidadeAtiva,
    usuarioId: sessao?.id || sessao?.user?.id || null,
    usuarioNome: sessao?.nome || sessao?.user_metadata?.nome || sessao?.email || "Usuário do sistema",
    origem: "Ação em lote — fichas técnicas",
  };

  useEffect(() => { setPagina(1); }, [busca, tipoFiltro, porPagina, filtroStatus]);
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
    setForm({ id: null, codigo: "", versao: "", responsavel: "", tempo_coccao: "", padrao_montagem: "", departamento: deptUrl, nome_receita: "", categoria: categoriaInicial, rendimento_porcoes: "1", modo_preparo: "", eh_base: criandoPreparo, produto_pronto: false, tipo_base: criandoPreparo ? "pre" : null, rendimento_unidade: unidadePadraoDepartamento(deptUrl), peso_porcao_g: "", imagem: "", tempo_preparo: "", validade_dias: "", observacoes: "", metodo_bar: "", preco_venda: "", cmv_meta: 30 });
    setIngFicha([]);
    setFichaEmbalagens([]);
    setNovaEmbalagem({ nome: "", custo: "" });
    setAutoSoma(true);
    setCalcQtd("");
    setIaExplicacao("");
    setModalNovo(true);
  };

  const abrirOpcaoNovo = () => {
    if (modoFicha === "preparos") return abrirNova();
    setModalEscolhaNovo(true);
  };

  const salvarTitulosEmLote = async () => {
    const existentes = new Set(fichas.map(ficha => normalizarNome(ficha.nome_receita)));
    const vistos = new Set();
    const titulos = String(titulosLote || "")
      .split(/\r?\n|;/)
      .map(titulo => titulo.trim())
      .filter(titulo => {
        const chave = normalizarNome(titulo);
        if (!chave || existentes.has(chave) || vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
    if (!titulos.length) return alert("Digite ao menos um título novo, usando uma linha para cada prato.");

    setSalvandoTitulosLote(true);
    const falhas = [];
    let criados = 0;
    for (const titulo of titulos) {
      const resultado = await salvarFicha({
        unidade_id: unidadeAtiva,
        departamento: deptUrl,
        nome_receita: titulo,
        categoria: null,
        rendimento_porcoes: 1,
        rendimento_unidade: unidadePadraoDepartamento(deptUrl),
        peso_porcao_g: null,
        modo_preparo: "",
        eh_base: false,
        tipo_base: null,
        cmv_meta: 30,
        imagem: null,
        tempo_preparo: null,
        validade_dias: null,
        observacoes: null,
        metodo_bar: null,
      }, []);
      if (resultado.error) falhas.push(`${titulo}: ${resultado.error}`);
      else criados++;
    }
    setSalvandoTitulosLote(false);
    if (criados > 0) {
      setModalTitulosLote(false);
      setTitulosLote("");
      setModoFicha("principais");
      setTipoFiltro("Pratos principais");
      setMensagemLote(`${criados} ${criados === 1 ? "título criado" : "títulos criados"}. Agora abra Editar em cada ficha para completar os dados.`);
      await carregar();
    }
    if (falhas.length) alert(`Alguns títulos não foram criados:\n\n${falhas.join("\n")}`);
  };

  const abrirEditar = (ficha) => {
    setAutoSoma(false);
    const produtoFicha = produtos.find(x => x.ficha_id === ficha.id || String(x.nome_produto || "").toLowerCase() === String(ficha.nome_receita || "").toLowerCase());
    const rendimentoSetor = rendimentoPadronizado(ficha);
    setForm({
       id: ficha.id,
       codigo: ficha.codigo || "",
       versao: ficha.versao || "",
       responsavel: ficha.responsavel || "",
       tempo_coccao: ficha.tempo_coccao != null ? String(ficha.tempo_coccao) : "",
       padrao_montagem: ficha.padrao_montagem || "",
       departamento: ficha.departamento,
       nome_receita: ficha.nome_receita,
       categoria: ficha.departamento === "bar" && ficha.eh_base ? categoriaPreparoBar(ficha) : (ficha.categoria || ""),
       rendimento_porcoes: rendimentoSetor.valor,
       modo_preparo: ficha.modo_preparo || "",
       eh_base: !!ficha.eh_base,
       tipo_base: ficha.tipo_base || "pre",
       produto_pronto: ficha.tipo_base === "produto_pronto",
       rendimento_unidade: rendimentoSetor.unidade,
       peso_porcao_g: ficha.peso_porcao_g || "",
       imagem: ficha.imagem || "",
       tempo_preparo: ficha.tempo_preparo != null ? String(ficha.tempo_preparo) : "",
       validade_dias: ficha.validade_dias != null ? String(ficha.validade_dias) : "",
       observacoes: ficha.observacoes || "", metodo_bar: ficha.metodo_bar || "",
       cmv_meta: ficha.cmv_meta != null ? Number(ficha.cmv_meta) : 30,
       preco_venda: (() => {
          const prod = produtos.find(x => x.ficha_id === ficha.id || String(x.nome_produto || "").toLowerCase() === String(ficha.nome_receita || "").toLowerCase());
          return (prod && Number(prod.preco_venda) > 0) ? String(prod.preco_venda) : (ficha.preco_venda && Number(ficha.preco_venda) > 0 ? String(ficha.preco_venda) : "");
       })()
    });
    setCalcQtd("");
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
       const unBase = unidadeNormalizada(fi.insumos.unidade_medida) || String(fi.insumos.unidade_medida || "un").toLowerCase();
       const custoNorm = custoUnitEfetivo(fi.insumos);
       const qtdBase = converterParaBase(fi.quantidade || 0, fi.insumos.unidade_medida, unBase);
       return {
          chave: fi.insumos.id, tipo: "insumo", insumo_id: fi.insumos.id,
          nome: fi.insumos.nome, unidade: unBase,
          custo_unitario: custoNorm, quantidade: qtdBase,
          // Perda vem do cadastro do ingrediente; cai no FC legado se não houver.
          fator: fi.insumos.empanado ? 0 : (Number(fi.insumos.perda_pct) || Number(fi.fator_correcao) || 0),
          empanado: !!fi.insumos.empanado,
          peso_medio_g: fi.insumos.peso_medio_g || null,
          modo: getSub(unBase) ? "sub" : "base",
       };
    });
    setIngFicha(mapIng);
    setFichaEmbalagens(Array.isArray(produtoFicha?.embalagens) ? produtoFicha.embalagens.map(item => ({ embalagem_id: item.embalagem_id, qtd: Number(item.qtd) || 1 })) : []);
    setNovaEmbalagem({ nome: "", custo: "" });
    setIaExplicacao("");
    setModalNovo(true);
  };

  const irSecaoEditorFicha = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    return ingredientesLista.reduce((acc, ing) => acc + (ing.custo_unitario * ing.quantidade * (1 + (Number(ing.fator) || 0) / 100)), 0);
  };

  const numeroPorcoesFormulario = () => {
    const rendimento = Number(String(form.rendimento_porcoes || "").replace(",", ".")) || 0;
    const unidade = String(form.rendimento_unidade || "porcao").toLowerCase();
    if (unidade === "porcao" || unidade === "un") return rendimento;
    const pesoPorcao = Number(form.peso_porcao_g) || 0;
    const pesoTotal = pesoTotalDaFicha(rendimento, unidade, pesoPorcao);
    return pesoPorcao > 0 && pesoTotal > 0 ? pesoTotal / pesoPorcao : rendimento;
  };

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
    const unBase = unidadeNormalizada(insumoDb.unidade_medida) || String(insumoDb.unidade_medida || "un").toLowerCase();
    const custoNorm = custoUnitEfetivo(insumoDb);
    return {
       chave: insumoDb.id, tipo: "insumo", insumo_id: insumoDb.id,
       nome: insumoDb.nome, unidade: unBase,
       custo_unitario: custoNorm, quantidade,
       peso_medio_g: insumoDb.peso_medio_g || null,
       // Perda vem do cadastro do ingrediente. Empanado usa o ganho (não soma perda).
       fator: insumoDb.empanado ? 0 : (Number(insumoDb.perda_pct) || 0),
       empanado: !!insumoDb.empanado,
       modo: getSub(unBase) ? "sub" : "base",
    };
  };

  // Digitar é mais rápido do que rolar uma lista com centenas de opções.
  const opcoesIngrediente = useMemo(() => [
    ...insumosAtivos.map(i => ({ valor: `insumo:${i.id}`, nome: i.nome, detalhe: i.unidade_medida, tipo: "Insumo" })),
    ...basesDisponiveis.map(b => ({ valor: `base:${b.id}`, nome: b.nome_receita, detalhe: b.rendimento_unidade, tipo: "Pré-preparo" })),
    ...embalagensCat.map(i => ({ valor: `insumo:${i.id}`, nome: i.nome, detalhe: i.unidade_medida, tipo: "Embalagem" })),
  ], [insumosAtivos, basesDisponiveis, embalagensCat]);

  const sugestoesIngrediente = useMemo(() => {
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
    if (salvandoFicha) return;
    if(!form.nome_receita.trim()) return alert("Digite o nome da receita");
    if(!form.rendimento_porcoes) return alert("Digite o rendimento");
    const unidadeRendimento = unidadePadraoDepartamento(form.departamento);
    const precoVendaNum = Number(String(form.preco_venda ?? "").replace(",", ".")) || 0;

    // Filtra ingredientes que estão com qtd = 0
    const ingValidos = ingFicha.filter(i => i.quantidade > 0);
    if(ingValidos.length === 0 && !form.produto_pronto) return alert("Adicione pelo menos um ingrediente com quantidade válida.");

    setSalvandoFicha(true);
    try {
      const erro = await salvarFicha(
         {
            id: form.id,
            unidade_id: unidadeAtiva,
            codigo: form.codigo || null,
            versao: form.versao || "1.0",
            responsavel: form.responsavel || null,
            tempo_coccao: form.tempo_coccao ? Number(form.tempo_coccao) : null,
            padrao_montagem: form.padrao_montagem || null,
            departamento: form.departamento,
            nome_receita: form.nome_receita,
            categoria: form.categoria || null,
            rendimento_porcoes: Number(form.rendimento_porcoes),
            modo_preparo: form.eh_base ? form.modo_preparo : "",
            eh_base: !!form.eh_base,
            tipo_base: form.produto_pronto ? "produto_pronto" : (form.eh_base ? "pre" : null),
            cmv_meta: form.cmv_meta != null && form.cmv_meta !== "" ? Number(form.cmv_meta) : 30,
            preco_venda: precoVendaNum,
            rendimento_unidade: unidadeRendimento,
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

      if(erro?.error) return alert("Erro ao salvar: " + erro.error);

      const fichaIdSalva = form.id || erro?.id;

      if (form.eh_base && fichaIdSalva) {
        const custoUnitarioPreparo = calcularCustoTotal(ingValidos) / Math.max(1, Number(form.rendimento_porcoes) || 1);
        const estoquePreparo = await garantirFichaNoEstoquePreparo({
          unidadeId: unidadeAtiva,
          ficha: { ...form, id: fichaIdSalva },
          departamento: form.departamento,
          custoUnitario: custoUnitarioPreparo,
        });
        if (estoquePreparo.error) alert(`A ficha foi salva, mas não entrou no estoque de preparos: ${estoquePreparo.error}`);
      }

      if (!criarOutra) setModalNovo(false);
      if (fichaIdSalva) {
        setForm(f => ({ ...f, id: fichaIdSalva }));
        setFichas(fichasAntigas => {
          const existe = fichasAntigas.some(f => f.id === fichaIdSalva);
          const novaFichaObjeto = {
            id: fichaIdSalva,
            unidade_id: unidadeAtiva,
            codigo: form.codigo || null,
            versao: form.versao || "1.0",
            responsavel: form.responsavel || null,
            tempo_coccao: form.tempo_coccao ? Number(form.tempo_coccao) : null,
            padrao_montagem: form.padrao_montagem || null,
            departamento: form.departamento,
            nome_receita: form.nome_receita,
            categoria: form.categoria || null,
            rendimento_porcoes: Number(form.rendimento_porcoes),
            modo_preparo: form.eh_base ? form.modo_preparo : "",
            eh_base: !!form.eh_base,
            tipo_base: form.produto_pronto ? "produto_pronto" : (form.eh_base ? "pre" : null),
            cmv_meta: form.cmv_meta != null && form.cmv_meta !== "" ? Number(form.cmv_meta) : 30,
            preco_venda: precoVendaNum,
            rendimento_unidade: unidadeRendimento,
            peso_porcao_g: form.peso_porcao_g ? Number(form.peso_porcao_g) : null,
            imagem: form.imagem || null,
            fichas_ingredientes: ingValidos.map(i => ({
               ficha_id: fichaIdSalva,
               insumo_id: i.insumo_id || null,
               subficha_id: i.subficha_id || null,
               quantidade: i.quantidade,
               insumos: i.insumo_id ? insumosAtivos.find(x => x.id === i.insumo_id) : null
            })),
          };
          return existe ? fichasAntigas.map(f => f.id === fichaIdSalva ? { ...f, ...novaFichaObjeto } : f) : [novaFichaObjeto, ...fichasAntigas];
        });
      }
      await carregar();

      // As embalagens usadas na receita entram no estoque de Embalagens do setor.
      if (fichaIdSalva) {
        try {
          const dept = (form.departamento || deptUrl || "cozinha").toLowerCase();
          const { data: estoques } = await fetchEstoques(unidadeAtiva);
          const acharEstoque = (slug) => (estoques || []).find(e => String(e.slug || "").toLowerCase() === slug);

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
      }

      // Registra um retrato do custo no histórico (não bloqueia o salvar).
      if (fichaIdSalva && !form.produto_pronto) {
        const custoTotalS = custoTotalFormulario(ingValidos);
        const unRs = String(form.rendimento_unidade || "porcao").toLowerCase();
        const rendS = Number(form.rendimento_porcoes) || 0;
        const pesoPorcaoS = Number(form.peso_porcao_g) || 0;
        const pesoTotalS = pesoTotalDaFicha(rendS, unRs, pesoPorcaoS);
        const porcS = (unRs === "porcao" || unRs === "un") ? rendS : (pesoPorcaoS > 0 && pesoTotalS > 0 ? pesoTotalS / pesoPorcaoS : rendS);
        const custoPorcaoS = porcS > 0 ? custoTotalS / porcS : custoTotalS;
        registrarCustoFicha({
          unidadeId: unidadeAtiva, fichaId: fichaIdSalva, custoTotal: custoTotalS, custoPorcao: custoPorcaoS,
          origem: "edicao_ficha", usuarioNome: sessao?.nome || sessao?.user?.email || "",
        }).catch(() => {});
      }

      // PREÇO DE VENDA sincroniza com o produto do cardápio interno
      if (!form.eh_base && fichaIdSalva) {
        try {
          const nome = form.nome_receita.trim();
          const { data: prodsAtu } = await fetchProdutos(unidadeAtiva, form.departamento);
          const prodExistente = (prodsAtu || []).find(p =>
            p.ficha_id === fichaIdSalva || (p.nome_produto || "").toLowerCase() === nome.toLowerCase()
          );
          if (prodExistente) {
            await salvarProduto({ id: prodExistente.id, ficha_id: fichaIdSalva, preco_venda: precoVendaNum, embalagens: fichaEmbalagens });
          } else {
            const ehBarDept = form.departamento === "bar";
            await salvarProduto({
              unidade_id: unidadeAtiva,
              ficha_id: fichaIdSalva,
              nome_produto: nome,
              preco_venda: precoVendaNum,
              categoria: ehBarDept ? (form.produto_pronto ? (form.categoria || "Outros produtos prontos") : "Drinks") : "Pratos Principais",
              departamento: form.departamento,
              observacoes: "Criado automaticamente pela Ficha Técnica.",
            }, unidadeAtiva);
          }
        } catch { /* sincronização de preço não bloqueia o salvar */ }
      }
    } catch (errGlobal) {
      console.error("[handleSalvar] Erro ao salvar ficha:", errGlobal);
    } finally {
      setSalvandoFicha(false);
    }

    // "Salvar e criar outra": limpa o formulário e continua no modal
    if (criarOutra) {
      setForm({ id: null, departamento: form.departamento, nome_receita: "", categoria: "", rendimento_porcoes: "1", modo_preparo: "", eh_base: false, produto_pronto: false, tipo_base: null, rendimento_unidade: unidadePadraoDepartamento(form.departamento), peso_porcao_g: "", imagem: "", tempo_preparo: "", validade_dias: "", observacoes: "", metodo_bar: "", preco_venda: "", cmv_meta: 30 });
      setIngFicha([]);
      setFichaEmbalagens([]);
      setNovaEmbalagem({ nome: "", custo: "" });
      setAutoSoma(true);
      setIaExplicacao("");
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

  const excluirImediatamente = async (lista = fichasSelecionadas) => {
    if (!lista.length) return;
    setProcessandoLote(true);
    setMensagemLote("");
    setErroLote("");
    let resposta = await excluirFichasLote(lista, usuarioAuditoria);
    let arquivada = false;
    // Se houver histórico ou outra receita ligada, preserva os registros e
    // arquiva a ficha. Para o usuário ela desaparece da lista no mesmo clique.
    if (resposta.error) {
      resposta = await inativarFichasLote(lista, usuarioAuditoria);
      arquivada = !resposta.error;
    }
    setProcessandoLote(false);
    if (resposta.error) return setErroLote(`Não foi possível excluir: ${resposta.error}`);
    setSelecionadas(prev => prev.filter(id => !lista.some(f => f.id === id)));
    setAcoesCardAberto("");
    setMensagemLote(arquivada
      ? `${lista.length} ficha(s) removida(s) da lista; o histórico vinculado foi preservado.`
      : `${lista.length} ficha(s) excluída(s) definitivamente.`);
    await carregar();
    window.setTimeout(() => setMensagemLote(""), 3500);
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
    // Busca em lote; a prévia abre na hora e o conteúdo novo entra quando chega.
    setComplementosImpressao({});
    fetchComplementosDeFichas(lista.map(f => f.id))
      .then(r => setComplementosImpressao(r.data || {}))
      .catch(() => setComplementosImpressao({}));
    const livroAutomatico = modo === "livro" || lista.length >= 6;
    const modelo = modo === "livro" ? "livro" : "operacional";
    setOrdemPersonalizada(lista.map(f => f.id));
    setConfigImpressao({
      ordem: "selecao", formato: "a4-retrato", modelo,
      foto: true, ingredientes: true,
      custos: false, preco: false, cmv: false, margem: false,
      preparo: true, montagem: false, observacoes: false,
      responsaveis: false, atualizacao: false,
      codigo: true, equipamentos: true, armazenamento: true, alergenicos: true,
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
    try {
      const lista = listaOrdenadaPrevia();
      if (!lista.length) return alert("Nenhuma ficha técnica selecionada.");
      const html = montarHtmlFichas(lista, configImpressao);
      if (acao === "pdf") {
        baixarPdfDeHtml(html, configImpressao?.livro ? "livro-de-fichas" : "fichas-tecnicas");
      } else {
        const win = window.open("", "_blank");
        if (!win) return alert("O navegador bloqueou a janela pop-up. Habilite os pop-ups para visualizar ou imprimir.");
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
    } catch (err) {
      console.error("Erro ao gerar documento:", err);
      alert("Ocorreu um erro ao gerar o documento: " + (err?.message || err));
    }
  };

  const salvarModeloImpressao = () => {
    try {
      localStorage.setItem("hefisto_modelo_impressao_fichas", JSON.stringify(configImpressao));
      alert("Modelo de impressão salvo com sucesso!");
    } catch {
      alert("Não foi possível salvar o modelo de impressão.");
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
  const baixarPdfFichas = async (listaDeFichas, nomeArquivo) => {
    if (!listaDeFichas || !listaDeFichas.length) return alert("Nenhuma ficha técnica selecionada.");
    let win = null;
    try { win = window.open("", "_blank", "width=900,height=1000"); } catch { win = null; }
    if (win) {
      win.document.write("<!DOCTYPE html><html><head><title>Gerando PDF...</title></head><body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#64748b;background:#f8fafc'><h3>Gerando PDF, aguarde um instante...</h3></body></html>");
    }

    try {
      let complementos = complementosImpressao;
      try {
        const res = await fetchComplementosDeFichas(listaDeFichas.map(f => f.id));
        if (res?.data) {
          complementos = res.data;
          setComplementosImpressao(res.data);
        }
      } catch (e) {
        console.error("Erro ao carregar complementos:", e);
      }
      const nome = nomeArquivo || (listaDeFichas.length === 1
        ? (listaDeFichas[0].nome_receita || "ficha-tecnica")
        : "livro-de-receitas");
      baixarPdfDeHtml(montarHtmlFichas(listaDeFichas, { complementos }), nome, { windowRef: win });
    } catch (err) {
      if (win) win.close();
      alert("Ocorreu um erro ao gerar o PDF: " + (err?.message || err));
    }
  };

  const montarHtmlFichas = (listaDeFichas, opcoes = {}) => {
    const SUB = { kg: { s: 'g', fa: 1000 }, l: { s: 'ml', fa: 1000 } };
    const fmtQtd = (qtd, un) => {
       const c = SUB[String(un || '').toLowerCase()];
       return c ? `${(+(qtd * c.fa)).toLocaleString('pt-BR')} ${c.s}` : `${qtd} ${String(un || '').toUpperCase()}`;
    };
    
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const fmtDataBR = (d) => { if (!d) return '—'; const dt = new Date(d); return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR'); };
    const incluir = (campo, padrao = true) => opcoes[campo] === undefined ? padrao : !!opcoes[campo];
    const paginaPaisagem = opcoes.formato === "a4-paisagem";

    let conteudoHTML = `
       <!DOCTYPE html><html><head><meta charset="utf-8"/><title>Livro de Receitas</title>
       <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;background:#ffffff;padding:10mm;max-width:840px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          
          .ficha{page-break-inside:avoid;margin-bottom:24px;background:#ffffff;border:1.5px solid #5b2418;border-radius:0;overflow:hidden}
          .quebra{page-break-after:always}
          
          /* TOP HEADER */
          .header-top{display:grid;grid-template-columns:220px 1fr 240px;gap:12px;padding:12px 14px;align-items:center;background:#ffffff;border-bottom:1px solid #d3d3d3}
          .header-brand{display:flex;flex-direction:column;justify-content:center}
          .brand-logo-text{font-family:'Playfair Display','Georgia',serif;font-size:24px;font-weight:900;color:#5b2418;line-height:1}
          .brand-sub-text{font-size:9px;font-weight:800;letter-spacing:3px;color:#5b2418;text-transform:uppercase;margin-top:2px}
          
          .header-title-box{display:flex;flex-direction:column;justify-content:center;border-left:1px solid #d3d3d3;padding-left:14px}
          .header-main-title{font-size:18px;font-weight:900;letter-spacing:1px;color:#0f172a;text-transform:uppercase}
          .header-sub-title{font-size:10px;font-weight:800;letter-spacing:3px;color:#64748b;text-transform:uppercase;margin-top:1px}
          
          .meta-table{width:100%;border-collapse:collapse;font-size:10.5px;border:1px solid #cbd5e1}
          .meta-table td{padding:4px 7px;border:1px solid #cbd5e1;color:#334155}
          .meta-table td.lbl{font-weight:800;color:#475569;background:#f8fafc;width:40%;text-transform:uppercase;font-size:9.5px;letter-spacing:0.5px}
          .meta-table td.val{font-weight:700;color:#0f172a}
          
          /* DISH NAME BANNER */
          .banner-nome{padding:10px 14px;color:#ffffff;font-weight:900;text-transform:uppercase;letter-spacing:1px}
          .banner-nome h1{font-size:20px;font-weight:900;margin:0;letter-spacing:1.5px}
          
          .banner-cozinha-prato{background-color:#5b2418}
          .banner-cozinha-base{background-color:#78350f}
          .banner-bar-prato{background-color:#0f172a}
          .banner-bar-base{background-color:#581c87}
          
          /* FOTO + DADOS GERAIS */
          .grid-foto-info{display:grid;grid-template-columns:220px 1fr;gap:14px;padding:12px 14px}
          .foto-box{width:100%;height:180px;object-fit:cover;border:1px solid #cbd5e1;background:#f1f5f9}
          .foto-vazia-box{width:100%;height:180px;border:1px dashed #cbd5e1;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-weight:800;text-transform:uppercase}
          
          .tbl-geral{width:100%;border-collapse:collapse;font-size:11px;border:1px solid #cbd5e1}
          .tbl-geral td{padding:5.5px 8px;border:1px solid #cbd5e1}
          .tbl-geral td.lbl{font-weight:800;color:#475569;background:#f8fafc;width:40%;text-transform:uppercase;font-size:9.5px;letter-spacing:0.5px}
          .tbl-geral td.val{font-weight:700;color:#0f172a}
          
          /* SECTION BLOCKS & BANNERS */
          .sec-block{margin:0 14px 12px}
          .sec-banner{padding:6px 10px;color:#ffffff;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px}
          
          .tbl-dados{width:100%;border-collapse:collapse;font-size:11px;border:1px solid #cbd5e1}
          .tbl-dados th{background:#f8fafc;padding:6px 8px;border:1px solid #cbd5e1;font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#475569;text-align:left}
          .tbl-dados td{padding:6px 8px;border:1px solid #cbd5e1;color:#1e293b}
          .tbl-dados td.lbl{font-weight:800;color:#475569;background:#f8fafc;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px}
          .tbl-dados td.val{font-weight:600;color:#0f172a}
          
          /* 2-COLUMN GRIDS */
          .grid-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 14px 12px}
          .grid-2col .sec-block{margin:0}
          
          .box-text-content{border:1px solid #cbd5e1;padding:8px 10px;font-size:11px;line-height:1.45;color:#334155;background:#ffffff}
          
          /* FOOTER DELICADO */
          .footer-delicado{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px 14px;margin-top:8px}
          .footer-line-left,.footer-line-right{flex:1;height:1px;background:#cbd5e1}
          .footer-text{font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#64748b}
          
          @media print{
            @page{size:A4 ${paginaPaisagem ? "landscape" : "portrait"};margin:8mm}
            body{padding:0}
            .ficha{box-shadow:none;border-color:#5b2418}
          }
          .capa{height:88vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}
          .capa h1{font-size:44px;margin-bottom:14px;color:#0f172a;font-weight:900}
          .capa p{font-size:16px;color:#64748b;font-weight:600}
          
          .pagina-livro{page-break-after:always;display:flex;flex-direction:column;height:252mm;overflow:hidden;margin-bottom:0}
          .pagina-livro:last-child{page-break-after:auto}
          .conteudo-pg{flex:1;min-height:0}
          .rodape-livro{margin-top:auto;padding:8px 0 0;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:1px}
          
          .indice{page-break-after:always;min-height:252mm;display:flex;flex-direction:column;padding:10px 0}
          .indice h1{font-size:24px;text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;border-bottom:3px solid #0f172a;padding-bottom:8px;font-weight:900}
          .ind-sec{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#0f172a;margin:14px 0 6px;padding-bottom:2px;border-bottom:1px solid #e2e8f0}
          .ind-item{display:flex;align-items:baseline;gap:6px;font-size:12.5px;font-weight:600;padding:3px 0;color:#334155}
          .ind-item .pontos{flex:1;border-bottom:2px dotted #cbd5e1}
          .ind-item .pg{font-weight:900;color:#0f172a}
       </style></head><body>
    `;

    const ORDEM_SECOES = ['Empanamentos', 'Salmouras e Marinadas', 'Molhos', 'Xaropes', 'Espumas', 'Geleias', 'Mixes e Infusões', 'Pré-preparos', 'Preparos', 'Sobremesas', 'Sucos'];
    const secaoDe = (f) => {
      const nome = String(f.nome_receita || '').toLowerCase();
      const cat = String(f.categoria || '').toLowerCase();
      if (cat.includes('empan') || nome.includes('empan')) return 'Empanamentos';
      if (cat.includes('salmoura') || cat.includes('marinad') || nome.includes('salmoura') || nome.includes('marinad')) return 'Salmouras e Marinadas';
      if (nome.includes('xarope') || cat.includes('xarope')) return 'Xaropes';
      if (nome.includes('espuma') || cat.includes('espuma')) return 'Espumas';
      if (nome.includes('geleia') || nome.includes('geléia') || cat.includes('geleia')) return 'Geleias';
      if (cat.includes('mix') || cat.includes('infus') || nome.includes('infusão') || nome.includes('infusao')) return 'Mixes e Infusões';
      if (nome.includes('molho') || cat.includes('molho')) return 'Molhos';
      if (f.eh_base) return 'Pré-preparos';
      if (cat === 'sobremesas') return 'Sobremesas';
      if (cat === 'sucos') return 'Sucos';
      return 'Preparos';
    };
    const ehLivro = !!opcoes.livro || listaDeFichas.length >= 6;
    const lista = [...listaDeFichas];

    const dados = lista.map((f) => {
      const rendimentoSetor = rendimentoPadronizado(f);
      const rendimentoSetorTexto = textoRendimentoPadronizado(f);

      const rowsIngredientes = (f.fichas_ingredientes || []).map(fi => {
         let nome = '', unidade = '', obs = '—';
         if (fi.insumos) {
            nome = fi.insumos.nome;
            unidade = fi.insumos.unidade_medida || '';
            if (fi.insumos.marca) obs = fi.insumos.marca;
         } else if (fi.subficha_id) {
            const base = fichas.find(x => x.id === fi.subficha_id);
            nome = base ? base.nome_receita : 'Base excluída';
            unidade = base?.rendimento_unidade || 'un';
            obs = 'Base / Pré-preparo';
         }
         return `<tr>
            <td style="font-weight:700">${esc(nome)}</td>
            <td>${esc(String(unidade || '').toLowerCase())}</td>
            <td style="font-weight:700">${fmtQtd(fi.quantidade, unidade)}</td>
            <td style="color:#64748b">${esc(obs)}</td>
         </tr>`;
      }).join('');

      const extra = (opcoes?.complementos && opcoes.complementos[f.id]) || (typeof complementosImpressao !== "undefined" && complementosImpressao && complementosImpressao[f.id]) || {};
      const etapasNovas = extra.etapas || [];

      let passosRows = '';
      if (etapasNovas.length > 0) {
        passosRows = etapasNovas.map((e, i) => `
          <tr>
            <td style="width:30px;text-align:center;font-weight:900;background:#f8fafc">${i + 1}</td>
            <td style="width:160px;font-weight:800;color:#0f172a">${esc(e.titulo || `Etapa ${i + 1}`)}</td>
            <td style="color:#334155">${esc(e.instrucao || "")}${e.tempo_min ? ` <i style="color:#64748b;font-size:11px">(${e.tempo_min} min)</i>` : ''}</td>
          </tr>
        `).join('');
      } else {
        const passos = String(f.modo_preparo || '')
           .split(/\r?\n+/).map(s => s.trim().replace(/^\d+[.)-]\s*/, '')).filter(Boolean);
        passosRows = passos.length
           ? passos.map((s, i) => {
               let tit = `Etapa ${i + 1}`;
               let txt = s;
               if (s.includes(":")) {
                 const pts = s.split(":");
                 tit = pts[0].trim();
                 txt = pts.slice(1).join(":").trim();
               } else if (s.includes(" - ")) {
                 const pts = s.split(" - ");
                 tit = pts[0].trim();
                 txt = pts.slice(1).join(" - ").trim();
               }
               return `<tr>
                 <td style="width:30px;text-align:center;font-weight:900;background:#f8fafc">${i + 1}</td>
                 <td style="width:160px;font-weight:800;color:#0f172a">${esc(tit)}</td>
                 <td style="color:#334155">${esc(txt)}</td>
               </tr>`;
             }).join('')
           : `<tr><td colspan="3" style="color:#94a3b8;padding:10px">Não informado.</td></tr>`;
      }

      const montagemPassosExtra = (extra.montagem && extra.montagem.length > 0)
        ? extra.montagem
        : (f.montagem_passos || []);

      let montagemRows = '';
      if (montagemPassosExtra.length > 0) {
        montagemRows = montagemPassosExtra.map((m, i) => `
          <tr>
            <td style="width:30px;text-align:center;font-weight:900;background:#f8fafc">${i + 1}</td>
            <td style="color:#0f172a;font-weight:700" colspan="2">${esc(m.descricao || m)}</td>
          </tr>
        `).join('');
      } else {
        montagemRows = passosRows;
      }

      const arm = extra.armazenamento;
      const validadesArm = arm ? [
        arm.validade_refrigerado_dias ? `Refrigerado: ${esc(String(arm.validade_refrigerado_dias))} dias` : "",
        arm.validade_congelado_dias ? `Congelado: ${esc(String(arm.validade_congelado_dias))} dias` : "",
        arm.validade_apos_aberto_dias ? `Após aberto: ${esc(String(arm.validade_apos_aberto_dias))} dias` : "",
        arm.validade_apos_preparo_horas ? `Após preparo: ${esc(String(arm.validade_apos_preparo_horas))} h` : "",
      ].filter(Boolean) : [];

      const blocoArmazenamentoLinhas = `
         <tr><td class="lbl" style="width:45%">Forma & Recipiente</td><td class="val">${esc([arm?.forma, arm?.recipiente].filter(Boolean).join(" · ") || '—')}</td></tr>
         <tr><td class="lbl">Local & Validade</td><td class="val">${esc(arm?.local_armazenamento || "")}${validadesArm.length ? (arm?.local_armazenamento ? " · " : "") + validadesArm.join(" · ") : (arm?.local_armazenamento ? "" : "—")}</td></tr>
         <tr><td class="lbl">Observações</td><td class="val">${esc(arm?.observacoes || '—')}</td></tr>
      `;

      const dept = String(f.departamento || '').toLowerCase();
      const isBar = dept === 'bar';
      const ehBase = !!f.eh_base;
      const deptLabel = isBar ? 'Bar' : 'Cozinha';

      let bannerClass = 'banner-cozinha-prato';
      if (isBar) {
        bannerClass = ehBase ? 'banner-bar-base' : 'banner-bar-prato';
      } else {
        bannerClass = ehBase ? 'banner-cozinha-base' : 'banner-cozinha-prato';
      }

      const equipamentosList = (extra.equipamentos || []).map(x => x.nome).filter(Boolean);
      const blocoEquipamentos = `
         <div class="sec-block">
            <div class="sec-banner ${bannerClass}">EQUIPAMENTOS E UTENSÍLIOS</div>
            <div class="box-text-content">
               ${equipamentosList.length ? esc(equipamentosList.join(", ")) : '—'}
            </div>
         </div>
      `;

      const alergsList = (extra.alergenicos || []).map(x => x.alergenico).filter(Boolean);
      const blocoAlergenicos = `
         <div class="sec-block" style="margin-top:10px">
            <div class="sec-banner ${bannerClass}">ALERGÊNICOS</div>
            <div class="box-text-content">
               ${alergsList.length ? `<b>Contém:</b> ${esc(alergsList.join(", ").toLowerCase())}.` : '<b>Contém:</b> Não declarado.'}
               ${f.alergenicos_pode_conter ? `<br/><b>Pode conter:</b> ${esc(f.alergenicos_pode_conter)}` : ''}
            </div>
         </div>
      `;

      const custoFicha = custoTotalDaFicha(f, fichas);
      const infoPeso = infoPesoFicha(f, fichas);
      const porcoesFicha = (() => {
        const un = String(f.rendimento_unidade || "").toLowerCase();
        const rend = Number(f.rendimento_porcoes) || 0;
        return (un === "porcao" || un === "un") ? rend : (infoPeso?.porcoes || 0);
      })();
      const custoPorcaoFicha = porcoesFicha > 0 ? custoFicha / porcoesFicha : custoFicha;
      const precoFicha = Number(f.preco_venda) || 0;
      const cmvFicha = precoFicha > 0 ? (custoPorcaoFicha / precoFicha) * 100 : null;

      const blocoCustosTabela = podeVerCustos ? `
         <div class="sec-block">
            <div class="sec-banner ${bannerClass}">CUSTO DA RECEITA (POR UNIDADE)</div>
            <table class="tbl-dados">
               <tr><td class="lbl" style="width:60%">Custo dos ingredientes</td><td class="val">${fmtBRL(custoPorcaoFicha)}</td></tr>
               <tr><td class="lbl">Custo de embalagem</td><td class="val">R$ 0,00</td></tr>
               <tr><td class="lbl" style="font-weight:800;color:#0f172a">Custo total</td><td class="val" style="font-weight:900;color:#0f172a">${fmtBRL(custoPorcaoFicha)}</td></tr>
               ${precoFicha > 0 ? `<tr><td class="lbl" style="font-weight:800;color:#0f172a">Preço de venda sugerido</td><td class="val" style="font-weight:900;color:#0f172a">${fmtBRL(precoFicha)}</td></tr>` : ''}
               ${cmvFicha !== null ? `<tr><td class="lbl" style="font-weight:800;color:#0f172a">CMV</td><td class="val" style="font-weight:900;color:#0f172a">${cmvFicha.toFixed(1).replace(".", ",")}%</td></tr>` : ''}
            </table>
         </div>
      ` : '';

      const foto = incluir("foto") && f.imagem
         ? `<img src="data:image/jpeg;base64,${f.imagem}" class="foto-box" />`
         : incluir("foto") ? `<div class="foto-vazia-box">SEM FOTO</div>` : "";

      const codigoVal = f.codigo || `FT-${String(f.id || '').slice(0, 4).toUpperCase()}`;
      const versaoVal = f.versao || '1.0';
      const respVal = f.responsavel || deptLabel;
      const dataVal = fmtDataBR(f.updated_at || f.created_at);
      const pesoFinalTexto = f.peso_porcao_g ? `${f.peso_porcao_g} g` : '—';

      const corpo = `
         <!-- TOP HEADER -->
         <div class="header-top">
            <div class="header-brand">
               <div class="brand-logo-text">Seldeestrela</div>
               <div class="brand-sub-text">RESTAURANTE AMAZÔNICO</div>
            </div>
            <div class="header-title-box">
               <div class="header-main-title">FICHA TÉCNICA</div>
               <div class="header-sub-title">LIVRO DE RECEITAS</div>
            </div>
            <div class="header-meta">
               <table class="meta-table">
                  <tr><td class="lbl">CÓDIGO</td><td class="val">${esc(codigoVal)}</td></tr>
                  <tr><td class="lbl">VERSÃO</td><td class="val">${esc(versaoVal)}</td></tr>
                  <tr><td class="lbl">DATA</td><td class="val">${esc(dataVal)}</td></tr>
                  <tr><td class="lbl">RESPONSÁVEL</td><td class="val">${esc(respVal)}</td></tr>
               </table>
            </div>
         </div>

         <!-- BANNER COM NOME DO PRATO -->
         <div class="banner-nome ${bannerClass}">
            <h1>${esc(f.nome_receita)}</h1>
         </div>

         <!-- FOTO + INFORMAÇÕES GERAIS -->
         <div class="grid-foto-info">
            <div>
               ${foto}
            </div>
            <div>
               <table class="tbl-geral">
                  <tr><td class="lbl">CATEGORIA</td><td class="val">${esc(f.categoria || (isBar ? 'Bar' : 'Cozinha'))}</td></tr>
                  <tr><td class="lbl">RENDIMENTO</td><td class="val">${rendimentoSetor.valor > 0 ? rendimentoSetorTexto : '—'}</td></tr>
                  <tr><td class="lbl">TEMPO DE PREPARO</td><td class="val">${f.tempo_preparo != null && f.tempo_preparo !== '' ? esc(String(f.tempo_preparo)) + ' minutos' : '—'}</td></tr>
                  <tr><td class="lbl">TEMPO DE COCÇÃO</td><td class="val">${f.tempo_coccao != null && f.tempo_coccao !== '' ? esc(String(f.tempo_coccao)) + ' minutos' : '—'}</td></tr>
                  ${f.guarnicao ? `<tr><td class="lbl">GUARNIÇÃO</td><td class="val" style="font-weight:800;color:#0f172a">${esc(f.guarnicao)}</td></tr>` : ''}
                  <tr><td class="lbl">PESO FINAL (aprox.)</td><td class="val">${esc(pesoFinalTexto)}</td></tr>
                  <tr><td class="lbl">SETOR</td><td class="val">${esc(deptLabel)}</td></tr>
               </table>
            </div>
         </div>

         <!-- BANNER E TABELA DE INGREDIENTES -->
         ${incluir("ingredientes") ? `
         <div class="sec-block">
            <div class="sec-banner ${bannerClass}">INGREDIENTES</div>
            <table class="tbl-dados">
               <thead>
                  <tr>
                     <th style="width:35%">INGREDIENTE</th>
                     <th style="width:15%">UNIDADE</th>
                     <th style="width:20%">QUANTIDADE</th>
                     <th style="width:30%">OBSERVAÇÃO</th>
                  </tr>
               </thead>
               <tbody>
                  ${rowsIngredientes || '<tr><td colspan="4" style="text-align:center">Sem ingredientes cadastrados.</td></tr>'}
               </tbody>
            </table>
         </div>` : ""}

         <!-- BANNER MONTAGEM DO PRATO OU MODO DE PREPARO -->
         ${incluir("preparo") ? `
         <div class="sec-block">
            <div class="sec-banner ${bannerClass}">${ehBase ? "MODO DE PREPARO" : (isBar ? "MONTAGEM NO COPO" : "MONTAGEM DO PRATO")}</div>
            <table class="tbl-dados">
               <tbody>
                  ${ehBase ? passosRows : montagemRows}
               </tbody>
            </table>
         </div>` : ""}

         ${!ehBase && f.guarnicao ? `
         <div class="sec-block" style="margin-top:10px">
            <div class="sec-banner ${bannerClass}">GUARNIÇÃO / ACOMPANHAMENTO</div>
            <div class="box-text-content" style="font-weight:800;color:#0f172a">
               ${esc(f.guarnicao)}
            </div>
         </div>` : ""}

         <!-- 2 COLUNAS: ARMAZENAMENTO vs EQUIPAMENTOS & ALERGÊNICOS -->
         <div class="grid-2col">
            <div>
               <div class="sec-block">
                  <div class="sec-banner ${bannerClass}">ARMAZENAMENTO E VALIDADE</div>
                  <table class="tbl-dados">
                     ${blocoArmazenamentoLinhas}
                  </table>
               </div>
            </div>
            <div>
               ${blocoEquipamentos}
               ${blocoAlergenicos}
            </div>
         </div>

         <!-- 2 COLUNAS: CUSTO DA RECEITA vs INFORMAÇÕES ADICIONAIS -->
         <div class="grid-2col">
            <div>
               ${blocoCustosTabela}
            </div>
            <div>
               <div class="sec-block">
                  <div class="sec-banner ${bannerClass}">INFORMAÇÕES ADICIONAIS</div>
                  <table class="tbl-dados">
                     <tr><td class="lbl" style="width:45%">Padrão de montagem</td><td class="val">${esc(f.padrao_montagem || 'Conforme foto')}</td></tr>
                     <tr><td class="lbl">Observações</td><td class="val">${esc(f.observacoes || '—')}</td></tr>
                  </table>
               </div>
            </div>
         </div>

         <!-- FOOTER DELICADO SEM BARRA ESCURA -->
         <div class="footer-delicado">
            <div class="footer-line-left"></div>
            <div class="footer-text">RESTAURANTE AMAZÔNICO</div>
            <div class="footer-line-right"></div>
         </div>
      `;

      const score = (f.imagem ? 80 : 38) + 34 + (f.fichas_ingredientes || []).length * 7 + 10 + (passosRows ? 30 : 0);
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

    const getOrdemCategoria = (cat) => {
      const c = String(cat || "").toLowerCase();
      if (c.includes("entrada")) return 1;
      if (c.includes("prato") || c.includes("massa") || c.includes("carne") || c.includes("principal")) return 2;
      if (c.includes("sobremesa") || c.includes("doce") || c.includes("açaí") || c.includes("acai")) return 3;
      if (c.includes("adiciona") || c.includes("adicional") || c.includes("extra") || c.includes("acompanha") || c.includes("bebida") || c.includes("suco")) return 4;
      return 5;
    };

    const linhas = fichas.filter(f => !f.eh_base).map(f => {
      const custoTotal = custoTotalDaFicha(f, fichas);
      const peso = infoPesoFicha(f, fichas);
      const unR = String(f.rendimento_unidade || 'porcao').toLowerCase();
      const porcoes = (unR === 'porcao' || unR === 'un') ? (Number(f.rendimento_porcoes) || 1) : (peso?.porcoes || 0);
      const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
      const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || '').toLowerCase() === String(f.nome_receita || '').toLowerCase());
      const preco = (prod && Number(prod.preco_venda) > 0) ? Number(prod.preco_venda) : (Number(f.preco_venda) > 0 ? Number(f.preco_venda) : 0);
      const cmv = preco > 0 ? (custoPorcao / preco) * 100 : null;
      return { nome: f.nome_receita, cat: f.categoria || (f.departamento === 'bar' ? 'Bar' : 'Cozinha'), custoTotal, custoPorcao, preco, cmv };
    }).sort((a, b) => {
      const oA = getOrdemCategoria(a.cat);
      const oB = getOrdemCategoria(b.cat);
      if (oA !== oB) return oA - oB;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    const comCmv = linhas.filter(l => l.cmv !== null);
    const cmvMedio = comCmv.length ? comCmv.reduce((s, l) => s + l.cmv, 0) / comCmv.length : null;

    const comPreco = linhas.filter(l => l.preco > 0);
    const ticketMedio = comPreco.length ? comPreco.reduce((s, l) => s + l.preco, 0) / comPreco.length : null;

    const rows = linhas.map(l => `<tr><td>${esc2(l.nome)}</td><td>${esc2(l.cat)}</td><td class="r">${brl(l.custoTotal)}</td><td class="r">${l.preco > 0 ? brl(l.preco) : '—'}</td><td class="r ${l.cmv === null ? '' : l.cmv > 35 ? 'ruim' : 'bom'}">${l.cmv !== null ? l.cmv.toFixed(1) + '%' : '—'}</td></tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Planilha de Custos e CMV</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;padding:12mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #0f172a;padding-bottom:6px;margin-bottom:4px}
      .sub{font-size:11px;color:#64748b;font-weight:bold;margin-bottom:12px}
      .kpi-container{display:flex;gap:14px;margin-bottom:16px;margin-top:10px}
      .kpi-card{flex:1;border:2px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:12px 16px;text-align:center}
      .kpi-cmv{border-color:#fecaca;background:#fef2f2}
      .kpi-ticket{border-color:#bbf7d0;background:#f0fdf4}
      .kpi-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;display:block}
      .kpi-value{font-size:26px;font-weight:900;line-height:1.2;margin-top:2px;display:block}
      .kpi-sub{font-size:10px;font-weight:700;color:#64748b;margin-top:2px;display:block}
      .kpi-bom{color:#047857}
      .kpi-alerta{color:#dc2626}
      .text-emerald{color:#047857}
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
      
      <div class="kpi-container">
        <div class="kpi-card kpi-cmv">
          <span class="kpi-label">CMV Médio da Carta</span>
          <span class="kpi-value ${cmvMedio !== null && cmvMedio > 35 ? 'kpi-alerta' : 'kpi-bom'}">${cmvMedio !== null ? cmvMedio.toFixed(1) + '%' : '—'}</span>
          <span class="kpi-sub">${comCmv.length} receita(s) precificada(s)</span>
        </div>
        <div class="kpi-card kpi-ticket">
          <span class="kpi-label">Ticket Médio (Preço de Venda)</span>
          <span class="kpi-value text-emerald">${ticketMedio !== null ? brl(ticketMedio) : '—'}</span>
          <span class="kpi-sub">${comPreco.length} item(ns) precificado(s)</span>
        </div>
      </div>

      <table><thead><tr><th>Receita</th><th>Categoria</th><th class="r">Custo Total</th><th class="r">Preço de Venda</th><th class="r">CMV</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">CMV médio da carta (${comCmv.length} precificada(s))</td><td class="r">${cmvMedio !== null ? cmvMedio.toFixed(1) + '%' : '—'}</td></tr></tfoot></table>
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
          departamento: item.categoria === "Drink" ? "bar" : (deptUrl || "cozinha"),
          nome_receita: item.nome,
          categoria: catFicha || null,
          rendimento_porcoes: 1,
          rendimento_unidade: item.categoria === "Drink" ? "l" : "kg",
          modo_preparo: "",
          eh_base: false,
        }, []);
        if (r?.id) {
          await salvarProduto({
            unidade_id: unidadeAtiva,
            nome_produto: item.nome,
            categoria: item.categoria === "Drink" ? "Drinks" : (catFicha || "Pratos Principais"),
            departamento: item.categoria === "Drink" ? "bar" : (deptUrl || "cozinha"),
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
      const rendimentoSetor = rendimentoPadronizado(f);
      return `
      <div class="item">
        <div class="foto">${foto}</div>
        <div class="info">
          <h3>${f.nome_receita}${rendimentoSetor.valor > 0 ? `<span class="peso"> · ${textoRendimentoPadronizado(f)}</span>` : ""}</h3>
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
    <div className="erp-fichas-theme min-h-screen bg-slate-50 pb-24 text-slate-800">
      <style>{`
        .erp-fichas-theme { font-family: Aptos, "Segoe UI Variable", "Segoe UI", Arial, sans-serif; letter-spacing: -0.006em; }
        .erp-fichas-theme .font-black { font-weight: 700 !important; }
        .erp-fichas-theme .font-bold { font-weight: 600 !important; }
        .erp-fichas-theme [class*="bg-emerald-600"] { background-color: #ea580c !important; }
        .erp-fichas-theme [class*="bg-emerald-700"] { background-color: #c2410c !important; }
        .erp-fichas-theme [class*="hover:bg-emerald-700"]:hover, .erp-fichas-theme [class*="hover:bg-emerald-800"]:hover { background-color: #9a3412 !important; }
        .erp-fichas-theme [class*="bg-emerald-50"] { background-color: #fff7ed !important; }
        .erp-fichas-theme [class*="bg-emerald-100"] { background-color: #ffedd5 !important; }
        .erp-fichas-theme [class*="text-emerald-600"] { color: #ea580c !important; }
        .erp-fichas-theme [class*="text-emerald-700"], .erp-fichas-theme [class*="text-emerald-800"] { color: #9a3412 !important; }
        .erp-fichas-theme [class*="border-emerald-100"], .erp-fichas-theme [class*="border-emerald-200"], .erp-fichas-theme [class*="border-emerald-300"] { border-color: #fed7aa !important; }
        .erp-fichas-theme [class*="border-emerald-500"], .erp-fichas-theme [class*="border-emerald-600"], .erp-fichas-theme [class*="ring-emerald-500"] { border-color: #f97316 !important; --tw-ring-color: rgb(249 115 22 / .22) !important; }
        .erp-fichas-theme [class*="shadow-emerald"] { --tw-shadow-color: rgb(234 88 12 / .22) !important; }
        .erp-fichas-theme input[class*="accent-emerald"] { accent-color: #ea580c; }
        .erp-fichas-theme .erp-status-ativo { background-color: #ffedd5 !important; color: #9a3412 !important; }
        .erp-fichas-theme input, .erp-fichas-theme select, .erp-fichas-theme textarea, .erp-fichas-theme button { font-family: inherit; }
        .erp-fichas-card { border-color: #dbe2ee; box-shadow: 0 5px 18px rgb(30 41 59 / .06); }
        .erp-fichas-card:hover { box-shadow: 0 12px 28px rgb(154 52 18 / .10); }
      `}</style>
      <header className="border-b border-line bg-card">
        <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <button onClick={abrirMenu} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-slate-50 text-muted hover:text-fg" title="Voltar ao menu">
                <ArrowLeft size={19} />
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-slate-950">Fichas Técnicas</h1>
                <div className="flex items-center rounded-xl bg-elevated p-1 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/fichas?dept=cozinha")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${deptUrl !== "bar" ? "bg-card text-accent shadow-sm" : "text-muted hover:text-slate-800"}`}
                  >
                    👨‍🍳 Cozinha
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/fichas?dept=bar")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${deptUrl === "bar" ? "bg-card text-accent shadow-sm" : "text-muted hover:text-slate-800"}`}
                  >
                    🍹 Bar
                  </button>
                </div>
              </div>
            </div>
            <div className="erp-busca-fixa flex flex-col gap-3 sm:flex-row">
              <label className="flex min-w-0 items-center gap-2 rounded-2xl border-2 border-slate-300 bg-card px-3.5 shadow-sm transition-all focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-500/20 sm:w-[430px]">
                <Search size={19} className="shrink-0 text-fg-soft" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={modoFicha === "preparos" ? "Buscar preparo por nome..." : deptUrl === "bar" ? "Buscar drink ou produto..." : "Buscar prato por nome..."} className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-fg outline-none placeholder:font-medium placeholder:text-subtle" />
                {busca && <button onClick={() => setBusca("")} className="text-subtle hover:text-fg-soft" title="Limpar busca"><X size={16} /></button>}
              </label>
              <button onClick={abrirModalIAFicha} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-accent-soft px-4 text-sm font-black text-accent-strong shadow-sm hover:bg-emerald-100"><Sparkles size={18} /> Criar com IA</button>
              <button onClick={abrirOpcaoNovo} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-black text-accent-fg shadow-lg shadow-emerald-600/20 hover:bg-accent"><Plus size={18} /> {modoFicha === "preparos" ? "Criar receita" : deptUrl === "bar" ? "Criar drink" : "Criar prato"}</button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto rounded-xl border border-line bg-slate-50 p-2">
            <button onClick={() => { if (!fichas.length) return alert("Nenhuma ficha para o livro."); abrirPreviaImpressao("livro", fichas); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-elevated"><Printer size={14} /> Livro de receitas</button>
            <button onClick={() => { if (!fichas.length) return alert("Nenhuma ficha para baixar."); baixarPdfFichas(selecionadas.length ? fichas.filter(f => selecionadas.includes(f.id)) : fichas); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-elevated"><Download size={14} /> Baixar PDF</button>
            {podeVerCustos && <button onClick={imprimirPlanilhaCustos} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-elevated"><Calculator size={14} /> Custos e CMV</button>}
            {podeVerCustos && (
              <button onClick={() => setVerPizza(v => !v)} title="Mostra em cada ficha para onde vai cada real da venda"
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${verPizza ? "bg-accent text-accent-fg" : "border border-line bg-card text-fg-soft hover:bg-elevated"}`}>
                <PieChart size={14} /> {verPizza ? "Ver números" : "Pizza do lucro"}
              </button>
            )}
            <button onClick={registrarCustoTodasFichas} disabled={semeandoCustos} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-elevated disabled:opacity-50">{semeandoCustos ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{semeandoCustos ? "Registrando..." : "Registrar custos"}</button>
            <input ref={inputCardapioRef} type="file" accept="image/*" multiple onChange={importarCardapioFoto} className="hidden" />
            <button onClick={() => inputCardapioRef.current?.click()} disabled={importandoCardapio} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-elevated disabled:opacity-50">{importandoCardapio ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Importar cardápio</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-4 sm:px-5">
         {/* Kanban de indicadores: CMV médio, margem, custo, ticket */}
         <div className="mb-2 flex justify-end">
           <button type="button" onClick={() => setMostrarIndicadores(valor => !valor)} className="flex min-h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50">
             <BarChart3 size={15} /> {mostrarIndicadores ? "Ocultar indicadores" : "Ver indicadores"}
           </button>
         </div>
         {mostrarIndicadores && (() => {
            const base = fichas.filter(f => modoFicha === "preparos"
              ? !!f.eh_base
              : (!f.eh_base && f.tipo_base !== "produto_pronto"));
            if (!base.length) return null;
            if (modoFicha === "preparos") {
              const comCusto = base.filter(f => custoTotalDaFicha(f, fichas) > 0).length;
              const semModo = base.filter(f => !String(f.modo_preparo || "").trim()).length;
              const tempos = base.map(f => Number(f.tempo_preparo) || 0).filter(Boolean);
              const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
              const cardsPreparo = [
                { rot: "Preparos", val: base.length, sub: deptUrl === "bar" ? "bases do bar" : "bases da cozinha" },
                { rot: "Pré-preparos", val: base.length, sub: "usados em montagens" },
                { rot: "Com custo", val: comCusto, sub: `${base.length - comCusto} sem custo` },
                { rot: "Tempo médio", val: tempoMedio ? `${tempoMedio} min` : "—", sub: `${tempos.length} informados` },
                { rot: "Sem instruções", val: semModo, sub: "modo de preparo", alerta: semModo > 0 },
              ];
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
                  {cardsPreparo.map(c => (
                    <div key={c.rot} className={`rounded-2xl border shadow-sm px-3 py-2.5 ${c.alerta ? "bg-amber-50 border-amber-200" : "bg-card border-amber-100"}`}>
                      <p className="text-3xs font-bold uppercase tracking-wider text-subtle leading-tight">{c.rot}</p>
                      <p className={`text-lg font-black mt-0.5 ${c.alerta ? "text-amber-700" : "text-orange-700"}`}>{c.val}</p>
                      <p className="text-3xs font-bold text-subtle truncate">{c.sub}</p>
                    </div>
                  ))}
                </div>
              );
            }
            if (!podeVerCustos) return null; // indicadores são todos financeiros
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
               const preco = (prod && Number(prod.preco_venda) > 0) ? Number(prod.preco_venda) : (Number(f.preco_venda) > 0 ? Number(f.preco_venda) : 0);
               const meta = Number(f.cmv_meta) || 30;
               if (preco > 0) {
                  const cmv = (custoPorcao / preco) * 100;
                  somaCmv += cmv; nCmv++; somaPreco += preco; nPreco++; somaMargem += (100 - cmv);
                  if (cmv > meta) acimaMeta++;
               } else semPreco++;
            });
            const cmvMedio = nCmv ? somaCmv / nCmv : null;
            const cards = [
               { key: "fichas", rot: "Fichas", val: base.length, sub: "pratos/receitas" },
               { key: "cmv", rot: "CMV médio", val: cmvMedio != null ? cmvMedio.toFixed(1) + "%" : "—", sub: `${nCmv} precificadas`, alerta: cmvMedio != null && cmvMedio > 35 },
               { key: "margem", rot: "Margem média", val: nCmv ? (somaMargem / nCmv).toFixed(1) + "%" : "—", sub: "bruta" },
               { key: "custo", rot: "Custo médio/porção", val: nCusto ? fmtBRL(somaCusto / nCusto) : "—", sub: "por porção" },
               { key: "ticket", rot: "Ticket médio", val: nPreco ? fmtBRL(somaPreco / nPreco) : "—", sub: "preço de venda" },
               { key: "acima_meta", rot: "Acima da meta", val: acimaMeta, sub: apenasAcimaMeta ? "Filtrado (clique p/ limpar)" : (semPreco ? `${semPreco} sem preço · clique p/ ver` : "clique para filtrar"), alerta: acimaMeta > 0, clicavel: true },
            ];
            return (
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
                  {cards.map(c => {
                     const isAcima = c.key === "acima_meta";
                     const ativo = isAcima && apenasAcimaMeta;
                     return (
                        <div
                           key={c.rot}
                           onClick={() => { if (isAcima) setApenasAcimaMeta(v => !v); }}
                           title={isAcima ? (apenasAcimaMeta ? "Clique para mostrar todas as fichas" : "Clique para ver somente fichas acima da meta") : ""}
                           className={`rounded-2xl border shadow-sm px-3 py-2.5 transition-all ${
                              isAcima ? "cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-95" : ""
                           } ${
                              ativo
                                 ? "bg-red-600 text-white border-red-700 ring-4 ring-red-500/20"
                                 : c.alerta
                                 ? "bg-red-50 border-red-200 hover:border-red-300"
                                 : "bg-card border-line"
                           }`}
                        >
                           <p className={`text-3xs font-bold uppercase tracking-wider leading-tight flex items-center justify-between ${ativo ? "text-red-100" : "text-subtle"}`}>
                              <span>{c.rot}</span>
                              {isAcima && <span className={`text-3xs font-bold ${ativo ? "text-white" : "text-red-500"}`}>{ativo ? "✓ FILTRADO" : "🔍 FILTRAR"}</span>}
                           </p>
                           <p className={`text-lg font-black mt-0.5 ${ativo ? "text-white" : c.alerta ? "text-red-600" : "text-accent"}`}>{c.val}</p>
                           <p className={`text-3xs font-bold truncate ${ativo ? "text-red-100" : "text-subtle"}`}>{c.sub}</p>
                        </div>
                     );
                  })}
               </div>
            );
         })()}

         {apenasAcimaMeta && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-red-200 bg-red-50/90 p-3.5 shadow-sm">
               <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white font-black shadow-sm">
                     ⚠️
                  </div>
                  <div className="min-w-0">
                     <p className="text-xs font-bold uppercase tracking-wider text-red-900">Filtrando: Fichas Técnicas Acima da Meta</p>
                     <p className="text-xs font-bold text-red-700 mt-0.5 truncate">{filtradas.length} receita(s) com CMV calculado maior que a meta definida.</p>
                  </div>
               </div>
               <button
                  onClick={() => setApenasAcimaMeta(false)}
                  className="shrink-0 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-2.5 shadow-sm transition-colors cursor-pointer"
               >
                  Ver todas ✕
               </button>
            </div>
         )}
         {/* Ativas / inativas. Inativar não apaga: a ficha some da lista e
             volta quando o usuário quiser vê-la de novo. */}
         <div className="mb-3 flex items-center gap-1.5">
            {[
              { id: "ativas", rotulo: "Ativas" },
              { id: "inativas", rotulo: "Inativas" },
              { id: "todas", rotulo: "Todas" },
            ].map(op => (
              <button
                key={op.id}
                onClick={() => setFiltroStatus(op.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  filtroStatus === op.id
                    ? "bg-slate-900 text-white"
                    : "border border-line bg-card text-muted hover:bg-slate-50"
                }`}
              >
                {op.rotulo}
              </button>
            ))}
            {filtroStatus !== "ativas" && (
              <span className="text-2xs font-bold text-subtle">
                {filtradas.length} ficha(s)
              </span>
            )}
         </div>

         <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              {
                id: "Pré-preparos",
                modo: "preparos",
                titulo: "Pré-preparos",
                quantidade: fichas.filter(f => !!f.eh_base).length,
                icone: <BookOpen size={24} />,
              },
              {
                id: "Pratos principais",
                modo: "principais",
                titulo: deptUrl === "bar" ? "Drinks" : "Pratos",
                quantidade: fichas.filter(f => !f.eh_base).length,
                icone: <UtensilsCrossed size={24} />,
              },
            ].map(item => (
              <button
                type="button"
                key={item.id}
                onClick={() => { setModoFicha(item.modo); setTipoFiltro(item.id); setCategoriasRecolhidas(false); }}
                className={`min-h-[58px] rounded-xl border p-2.5 text-left transition-all sm:min-h-[66px] sm:p-3 ${modoFicha === item.modo ? (item.modo === "preparos" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-emerald-500 bg-emerald-50 shadow-sm") : "border-line bg-card hover:border-slate-300 hover:shadow-sm"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10 ${modoFicha === item.modo ? (item.modo === "preparos" ? "bg-amber-600 text-accent-fg" : "bg-accent text-accent-fg") : "bg-elevated text-slate-600"}`}>{item.icone}</span>
                  <span className="min-w-0">
                    <span className="block text-sm sm:text-base font-black leading-tight text-fg">{item.titulo} <span className={item.modo === "preparos" ? "text-amber-600" : "text-emerald-600"}>({item.quantidade})</span></span>
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
               <span className="rounded-full bg-card px-2 py-0.5 text-3xs text-muted">{categoriasDisponiveis.length}</span>
             </button>
             <button type="button" onClick={() => setModalCategorias(true)} className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-accent-fg ${modoFicha === "preparos" ? "bg-amber-700 hover:bg-amber-800" : "bg-accent hover:opacity-90"}`}>
               <FolderPlus size={15} /> <span className="hidden sm:inline">Gerenciar</span>
             </button>
           </div>
         {!categoriasRecolhidas && <div className="flex flex-wrap items-center justify-center gap-2 py-1">
            {categoriasDisponiveis.map(cat => {
              const n = fichasDoModo.filter(f => (f.categoria || "") === cat).length;
              return (
                <div key={cat} className="flex items-center">
                  <button onClick={() => setTipoFiltro(cat)}
                    className={`min-h-10 rounded-xl px-3 py-2 font-bold text-xs transition-all sm:px-4 sm:text-sm ${tipoFiltro === cat ? (modoFicha === "preparos" ? "bg-amber-600 text-accent-fg shadow-lg shadow-amber-600/20" : "bg-accent text-accent-fg shadow-lg shadow-emerald-600/20") : "bg-card text-fg-soft border border-line hover:bg-slate-50"}`}>
                    {cat} <span className={tipoFiltro === cat ? "text-white/75" : "text-subtle"}>({n})</span>
                  </button>
                </div>
              );
            })}
            {(modoFicha === "preparos" ? [
              ["Pré-preparos", "Pré-preparos", fichas.filter(f => !!f.eh_base).length],
            ] : [
              ["Pratos principais", deptUrl === "bar" ? "Todos os drinks" : "Todos os pratos", fichas.filter(f => !f.eh_base && f.tipo_base !== "produto_pronto").length],
            ]).map(([t, label, n]) => (
              <button key={t} onClick={() => setTipoFiltro(t)}
                className={`min-h-10 rounded-xl px-3 py-2 font-bold text-xs transition-all sm:px-4 sm:text-sm ${tipoFiltro === t ? (modoFicha === "preparos" ? "bg-amber-600 text-accent-fg shadow-lg shadow-amber-600/20" : "bg-accent text-accent-fg shadow-lg shadow-emerald-600/20") : "bg-card text-muted border border-line hover:bg-slate-50"}`}>
                {label} <span className={tipoFiltro === t ? "text-white/75" : "text-subtle"}>({n})</span>
              </button>
            ))}
         </div>}
         </div>
         <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-2 shadow-sm">
             <p className="px-2 text-xs font-bold text-muted">{filtradas.length} {filtradas.length === 1 ? "ficha encontrada" : "fichas encontradas"}</p>
             <div className="flex flex-wrap items-center gap-2">
                <button onClick={selecionarPaginaLote} disabled={!fichasPagina.length} className="text-xs font-bold text-slate-600 hover:text-accent px-3 py-2 rounded-lg bg-slate-50 border border-line disabled:opacity-50">
                  <CheckSquare2 size={15} className="inline mr-1.5" /> Selecionar página
                </button>
                <button onClick={selecionarResultadoLote} disabled={!filtradas.length} className="text-xs font-bold text-slate-600 hover:text-accent px-3 py-2 rounded-lg bg-slate-50 border border-line disabled:opacity-50">
                  Selecionar resultado ({filtradas.length})
                </button>
                {selecionadas.length > 0 && <button onClick={limparSelecaoLote} className="text-xs font-bold text-muted hover:text-rose-600 px-3 py-2">Limpar seleção</button>}
             </div>
         </div>

         {selecionadas.length > 0 && (
           <div className="sticky top-2 z-30 mb-4 rounded-2xl border border-emerald-200 bg-card p-3 shadow-lg shadow-emerald-900/10">
             <div className="flex flex-col xl:flex-row xl:items-center gap-3">
               <div className="flex items-center justify-between gap-3 xl:min-w-48">
                 <div>
                   <p className="text-sm font-black text-slate-800">{selecionadas.length} {selecionadas.length === 1 ? "ficha selecionada" : "fichas selecionadas"}</p>
                   <p className="text-3xs font-bold text-subtle uppercase tracking-wider">A seleção continua ao trocar de página</p>
                 </div>
                 <button onClick={limparSelecaoLote} title="Fechar ações e limpar seleção" className="xl:hidden p-2 rounded-lg bg-elevated text-muted"><X size={16}/></button>
               </div>
               <div className="flex flex-wrap gap-2 xl:flex-1 xl:justify-end">
                 <button onClick={() => abrirPreviaImpressao("imprimir")} className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-fg hover:opacity-90"><Printer size={15}/> Imprimir</button>
                 <button onClick={() => abrirPreviaImpressao("livro")} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-fg-soft hover:bg-slate-50"><BookOpen size={15}/> Gerar livro</button>
                 <button onClick={() => { const lista = fichas.filter(f => selecionadas.includes(f.id)); if (lista.length) baixarPdfFichas(lista); }} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-fg-soft hover:bg-slate-50"><FileDown size={15}/> Exportar PDF</button>
                 <button onClick={duplicarFichasSelecionadas} disabled={processandoLote} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-fg-soft hover:bg-slate-50 disabled:opacity-50"><Copy size={15}/> Duplicar</button>
                  <button onClick={() => excluirImediatamente()} disabled={processandoLote} className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 size={15}/> {processandoLote ? "Excluindo..." : "Excluir"}</button>
                 <button onClick={limparSelecaoLote} title="Fechar ações e limpar seleção" className="hidden xl:flex p-2 rounded-lg bg-elevated text-muted hover:text-slate-800"><X size={16}/></button>
               </div>
             </div>
           </div>
         )}

         {mensagemLote && (
           <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-accent-soft px-4 py-3 text-sm font-bold text-accent-strong">
             <span className="flex items-center gap-2"><CheckCircle2 size={18}/>{mensagemLote}</span>
             <button onClick={() => setMensagemLote("")}><X size={16}/></button>
           </div>
         )}
         {erroLote && (
           <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
             <span className="flex items-center gap-2"><AlertTriangle size={18}/>{erroLote}</span>
             <button onClick={() => setErroLote("")}><X size={16}/></button>
           </div>
         )}

         {loading ? (
            <p className="font-bold text-muted">Buscando receitas...</p>
         ) : filtradas.length === 0 ? (
            <div className="text-center p-10 bg-card border border-line rounded-3xl">
               <LayoutList size={40} className="mx-auto text-muted mb-4"/>
               <h3 className="text-xl font-black text-fg-soft">Nenhuma ficha encontrada</h3>
               <p className="text-muted mt-2 font-medium">Cadastre suas receitas para calcular automaticamente o custo do prato.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
               {fichasPagina.map(f => {
                  const peso = infoPesoFicha(f, fichas);
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();

                  return (
                     <div
                       key={f.id}
                       onDragOver={e => { if (dragId) e.preventDefault(); }}
                       onDrop={() => reordenar(dragId, f.id)}
                       className={`erp-fichas-card bg-card rounded-3xl border p-5 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between ${dragId === f.id ? 'opacity-50' : ''} ${selecionadas.includes(f.id) ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/90'}`}
                     >
                       <div>
                         {/* TOP ROW: Nome e Botão Editar verde */}
                         <div className="flex items-start justify-between gap-3 mb-3">
                           <div className="flex items-center gap-2 min-w-0 flex-1">
                             <label className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-slate-50 cursor-pointer">
                               <input type="checkbox" checked={selecionadas.includes(f.id)} onChange={() => toggleSelecionar(f.id)} className="h-4 w-4 cursor-pointer rounded accent-emerald-600"/>
                             </label>
                             <h3
                               onClick={() => abrirFicha(f)}
                               className="text-xl font-black leading-snug text-fg break-words cursor-pointer hover:text-accent transition-colors"
                               title={f.nome_receita}
                             >
                               {f.nome_receita}
                             </h3>
                           </div>
                           <div className="flex items-center gap-1.5 shrink-0">
                             <button
                               onClick={() => abrirEditar(f)}
                               className="h-8 px-4 rounded-full bg-accent hover:bg-accent text-accent-fg font-bold text-xs transition-colors shadow-sm"
                             >
                               Editar
                             </button>
                             <button
                               onClick={() => setAcoesCardAberto(atual => atual === f.id ? "" : f.id)}
                               title="Mais opções"
                               className="h-8 w-8 rounded-full border border-line bg-slate-50 text-muted hover:text-fg flex items-center justify-center"
                             >
                               <MoreVertical size={16} />
                             </button>
                           </div>
                         </div>

                         {/* Menu suspenso de ações rápidas se clicado */}
                         {acoesCardAberto === f.id && (
                           <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-slate-50 p-2 shadow-lg text-xs font-bold">
                             <button onClick={() => { setAcoesCardAberto(""); abrirFicha(f); }} className="p-2 rounded-xl bg-card border border-line text-fg-soft text-left">📖 Ver Ficha</button>
                             {/* Ficha técnica completa: código, pesos, perdas, precificação e simulador de CMV */}
                             <button onClick={() => router.push(`/dashboard/operacao/fichas/${f.id}`)} className="p-2 rounded-xl bg-card border border-line text-fg-soft text-left">📑 Ficha técnica</button>
                             {!f.eh_base && <button onClick={() => router.push(`/dashboard/operacao/montagem?dept=${f.departamento || deptUrl}&q=${encodeURIComponent(f.nome_receita)}`)} className="p-2 rounded-xl bg-card border border-line text-fg-soft text-left">📋 Montagem</button>}
                             <button onClick={() => abrirSimulacao(f)} className="p-2 rounded-xl bg-card border border-line text-fg-soft text-left">🧮 Simular</button>
                             <button onClick={() => abrirPreviaImpressao("imprimir", [f])} className="p-2 rounded-xl bg-card border border-line text-fg-soft text-left">🖨️ Imprimir</button>
                             <button onClick={() => { setAcoesCardAberto(""); baixarPdfFichas([f]); }} className="p-2 rounded-xl bg-card border border-line text-fg-soft text-left">📄 PDF</button>
                             <button onClick={() => excluirImediatamente([f])} className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-left">🗑️ Excluir</button>
                           </div>
                         )}

                         {/* BADGES & CONTEÚDO */}
                          {(() => {
                            const custoTotalIng = custoTotalDaFicha(f, fichas);
                            const rend = Number(f.rendimento_porcoes) || 1;
                            const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
                            const precoPorcao = (prod && Number(prod.preco_venda) > 0) ? Number(prod.preco_venda) : (Number(f.preco_venda) > 0 ? Number(f.preco_venda) : 0);
                            const meta = Number(f.cmv_meta) || 30;
                            const composicaoCount = (f.fichas_ingredientes || []).length;
                            const rendimentoTexto = textoRendimentoPadronizado(f);

                            const custoEmb = Number(f.custo_embalagem) >= 0 && f.custo_embalagem !== null && f.custo_embalagem !== undefined
                              ? Number(f.custo_embalagem)
                              : (f.embalagens || []).reduce((acc, emb) => acc + (Number(emb.custo) || Number(emb.preco_unitario) || 0) * (Number(emb.qtd) || 1), 0);

                            const taxaMaqPct = Number(f.taxa_maquininha ?? prod?.taxa_cartao ?? paramsSis?.taxaMaquininha ?? paramsSis?.taxa_maquininha ?? 2.5);
                            const impostoPct = Number(f.imposto_pct ?? prod?.aliquota_imposto ?? paramsSis?.impostoPct ?? paramsSis?.imposto_pct ?? 4.0);

                            const finCard = calculateFichaFinanceiro({
                              custoTotalIngredientes: custoTotalIng,
                              rendimentoPorcoes: rend,
                              custoEmbalagemPorPorcao: custoEmb,
                              precoVenda: precoPorcao,
                              taxaMaquininhaPct: f.eh_base ? 0 : taxaMaqPct,
                              impostoPct: f.eh_base ? 0 : impostoPct,
                            });

                            const custoIngred = finCard.custoIngredientesPorPorcao;
                            const custoMaquininha = finCard.valorMaquininha;
                            const custoImposto = finCard.valorImposto;
                            const custoTotalComGastos = finCard.custoTotal;
                            const lucroReal = finCard.lucroPorPorcao;
                            const cmv = finCard.cmv;
                            const margem = finCard.margem;

                           return (
                             <div>
                               <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                 <span className={`rounded-full px-3 py-1 text-3xs font-bold uppercase tracking-wider ${f.eh_base ? "bg-amber-100 text-amber-900" : "bg-emerald-100/80 text-emerald-800"}`}>
                                   {f.eh_base ? "PREPARO" : "PRATO"}
                                 </span>
                                 <span className="rounded-full bg-slate-100/90 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-slate-600">
                                   {f.categoria || "SEM CATEGORIA"}
                                 </span>
                                 {f.codigo && (
                                   <span className="rounded-full bg-slate-900 px-3 py-1 font-mono text-3xs font-bold tracking-wider text-white">
                                     {f.codigo}
                                   </span>
                                 )}
                                 {f.versao && f.versao !== "1.0" && (
                                   <span className="rounded-full bg-slate-100/90 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-slate-600">
                                     v{f.versao}
                                   </span>
                                 )}
                                 {statusDaFicha(f) === "inativa" && (
                                   <span className="rounded-full bg-slate-200 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-slate-600">
                                     INATIVA
                                   </span>
                                 )}
                                 {statusDaFicha(f) === "rascunho" && (
                                   <span className="rounded-full bg-amber-100 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-amber-800">
                                     RASCUNHO
                                   </span>
                                 )}
                                 {podeVerCustos && cmv !== null && cmv > meta && (
                                   <span className="rounded-full bg-red-100/80 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-red-600">
                                     CMV ALTO
                                   </span>
                                 )}
                               </div>

                               <div className="border-t border-line-soft pt-2 mb-2">
                                 <span className="text-3xs font-bold uppercase tracking-widest text-subtle block">COMPOSIÇÃO</span>
                                 <span className="text-sm font-black text-fg">{composicaoCount} {composicaoCount === 1 ? "item" : "itens"}</span>
                               </div>

                               {/* TABELA DE VALORES COM LINHAS DIVISORAS LIMPAS */}
                               <div className="divide-y divide-slate-100 text-xs font-bold">
                                 <div className="py-2 flex items-center justify-between">
                                   <span className="text-slate-600 font-bold">Quantidade</span>
                                   <span className="text-sm font-black text-fg">{rendimentoTexto}</span>
                                 </div>

                                 {/* Daqui para baixo é tudo dinheiro: só para quem tem view_costs. */}
                                 {podeVerCustos && verPizza && (
                                   <div className="py-3">
                                     <PizzaDoPrato compacta
                                       preco={precoPorcao}
                                       custoIngredientes={custoIngred}
                                       custoEmbalagem={custoEmb}
                                       impostoPct={f.eh_base ? 0 : impostoPct}
                                       taxaMaquininhaPct={f.eh_base ? 0 : taxaMaqPct}
                                       params={paramsSis} />
                                   </div>
                                 )}
                                 {podeVerCustos && !verPizza && <>
                                 <div className="py-2 flex items-center justify-between">
                                   <span className="text-slate-600 font-bold">Custo</span>
                                   <span className="text-sm font-black text-fg">{fmtBRL(custoIngred)}</span>
                                 </div>

                                 <div className="py-2 flex items-center justify-between">
                                   <span className="text-slate-600 font-bold">Embalagem</span>
                                   <span className="text-sm font-black text-fg">{fmtBRL(custoEmb)}</span>
                                 </div>

                                 {!f.eh_base && (
                                   <>
                                     <div className="py-2 flex items-center justify-between">
                                       <span className="text-slate-600 font-bold">Custo maquininha ({taxaMaqPct}%)</span>
                                       <span className="text-sm font-black text-fg">{precoPorcao > 0 ? fmtBRL(custoMaquininha) : "—"}</span>
                                     </div>

                                     <div className="py-2 flex items-center justify-between">
                                       <span className="text-slate-600 font-bold">Imposto ({impostoPct}%)</span>
                                       <span className="text-sm font-black text-fg">{precoPorcao > 0 ? fmtBRL(custoImposto) : "—"}</span>
                                     </div>
                                   </>
                                 )}

                                 <div className="py-2 flex items-center justify-between">
                                   <span className="text-fg-soft font-black">Custo total</span>
                                   <span className="text-sm font-black text-fg">{fmtBRL(custoTotalComGastos)}</span>
                                 </div>

                                 {!f.eh_base && (
                                   <>
                                     <div className="py-2 flex items-center justify-between">
                                       <span className="text-slate-600 font-bold">Venda</span>
                                       <span className="text-sm font-black text-fg">{precoPorcao > 0 ? fmtBRL(precoPorcao) : "—"}</span>
                                     </div>

                                     <div className="py-2 flex items-center justify-between">
                                       <span className="text-slate-600 font-bold">Lucro por porção</span>
                                       <span className="text-base font-black text-success">{lucroReal !== null ? fmtBRL(lucroReal) : "—"}</span>
                                     </div>

                                     <div className="pt-2 pb-1 flex flex-col items-end">
                                       <div className="w-full flex items-center justify-between">
                                         <span className="text-slate-600 font-bold">CMV</span>
                                         <span className={`px-3 py-1 rounded-xl text-sm font-black ${
                                           cmv === null
                                             ? "bg-elevated text-muted"
                                             : cmv > meta
                                             ? "bg-red-100/90 text-red-600"
                                             : "bg-emerald-100/90 text-emerald-800"
                                         }`}>
                                           {cmv !== null ? `${cmv.toFixed(1)}%` : "—"}
                                         </span>
                                       </div>
                                       {margem !== null && (
                                         <span className="text-2xs font-bold text-subtle mt-1">Margem {margem.toFixed(1)}%</span>
                                       )}
                                     </div>
                                   </>
                                 )}
                                 </>}
                               </div>
                             </div>
                           );
                         })()}
                       </div>
                     </div>
                  );
               })}
            </div>
         )}
         {!loading && filtradas.length > 0 && (
           <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-sm">
             <p className="text-xs font-bold text-muted">
               Mostrando {(pagina - 1) * porPagina + 1} a {Math.min(pagina * porPagina, filtradas.length)} de {filtradas.length} fichas
             </p>
             <div className="flex flex-wrap items-center justify-center gap-2">
               <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))} className="rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-fg-soft outline-none">
                 {[8, 12, 24, 48].map(valor => <option key={valor} value={valor}>{valor} por página</option>)}
               </select>
               <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1} title="Página anterior" className="rounded-xl border border-line p-2 text-slate-600 disabled:opacity-30"><ChevronLeft size={17}/></button>
               <span className="min-w-24 text-center text-xs font-bold text-fg-soft">Página {pagina} de {totalPaginas}</span>
               <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas} title="Próxima página" className="rounded-xl border border-line p-2 text-slate-600 disabled:opacity-30"><ChevronRight size={17}/></button>
             </div>
           </div>
         )}
      </main>

      {/* PRÉVIA E CONFIGURAÇÃO DA IMPRESSÃO / PDF */}
      {modalImpressao && configImpressao && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-card shadow-2xl sm:max-h-[94vh]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
              <div>
                <p className="text-3xs font-bold uppercase tracking-[0.18em] text-accent">Prévia do documento</p>
                <h2 className="text-xl font-black text-fg sm:text-2xl">{modalImpressao.lista.length} {modalImpressao.lista.length === 1 ? "ficha técnica" : "fichas técnicas"}</h2>
              </div>
              <button onClick={() => setModalImpressao(null)} className="rounded-full bg-elevated p-3 text-muted hover:bg-slate-200"><X size={20}/></button>
            </div>

            <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-5 border-b border-line bg-slate-50 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="text-xs font-bold text-slate-600">Modelo
                    <select value={configImpressao.modelo} onChange={e => {
                      const modelo = e.target.value;
                      setConfigImpressao(atual => ({
                        ...atual, modelo,
                        livro: modelo === "livro",
                        capa: modelo === "livro",
                        indice: modelo === "livro",
                        custos: false,
                        preco: false,
                        cmv: false,
                        margem: false,
                        montagem: false,
                        observacoes: false,
                        responsaveis: false,
                        atualizacao: false,
                      }));
                    }} className="mt-1 w-full rounded-xl border border-line bg-card p-3 text-sm outline-none">
                      <option value="operacional">Operacional</option>
                      <option value="resumido">Resumo rápido</option>
                      <option value="livro">Livro completo</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">Ordem
                    <select value={configImpressao.ordem} onChange={e => setConfigImpressao(atual => ({...atual, ordem: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 text-sm outline-none">
                      <option value="selecao">Ordem da seleção</option>
                      <option value="nome">Nome A–Z</option>
                      <option value="categoria">Categoria</option>
                      <option value="tipo">Tipo</option>
                      <option value="personalizada">Personalizada</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">Formato
                    <select value={configImpressao.formato} onChange={e => setConfigImpressao(atual => ({...atual, formato: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 text-sm outline-none">
                      <option value="a4-retrato">A4 retrato</option>
                      <option value="a4-paisagem">A4 paisagem</option>
                    </select>
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Conteúdo incluído</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["foto", "Foto"], ["ingredientes", "Ingredientes"], ["preparo", "Preparo"],
                      ["codigo", "Código e versão"], ["equipamentos", "Equipamentos"],
                      ["armazenamento", "Armazenamento"], ["alergenicos", "Alergênicos"],
                      ["observacoes", "Observações"], ["responsaveis", "Responsável"],
                      ["atualizacao", "Datas"],
                      // Financeiro: só para quem pode ver custo.
                      ...(podeVerCustos ? [["custos", "Custo"], ["preco", "Preço"],
                                           ["cmv", "CMV"], ["margem", "Margem"]] : []),
                      ["capa", "Capa"], ["indice", "Índice"],
                    ].map(([campo, label]) => (
                      <label key={campo} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-fg-soft">
                        <input type="checkbox" checked={!!configImpressao[campo]} onChange={e => setConfigImpressao(atual => ({...atual, [campo]: e.target.checked, ...(campo === "capa" || campo === "indice" ? { livro: e.target.checked || atual.livro } : {})}))} className="h-4 w-4 accent-emerald-700"/>
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {configImpressao.ordem === "personalizada" && modalImpressao.lista.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Arraste a ordem com as setas</p>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line bg-card p-2">
                      {listaOrdenadaPrevia().map((ficha, indice, lista) => (
                        <div key={ficha.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="w-6 text-xs font-bold text-subtle">{indice + 1}</span>
                          <span className="flex-1 truncate text-xs font-bold text-fg-soft">{ficha.nome_receita}</span>
                          <button onClick={() => moverFichaNaPrevia(ficha.id, -1)} disabled={indice === 0} className="p-1 text-muted disabled:opacity-20"><ArrowUp size={15}/></button>
                          <button onClick={() => moverFichaNaPrevia(ficha.id, 1)} disabled={indice === lista.length - 1} className="p-1 text-muted disabled:opacity-20"><ArrowDown size={15}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-card p-4 sm:p-6">
                <div className={`mx-auto min-h-[420px] max-w-2xl rounded-lg border border-slate-300 bg-card p-5 shadow-xl ${configImpressao.formato === "a4-paisagem" ? "aspect-[1.414/1]" : "aspect-[1/1.414]"}`}>
                  <div className="flex items-start justify-between gap-3 border-b-2 border-emerald-700 pb-3">
                    <div>
                      <p className="text-3xs font-bold uppercase tracking-[0.2em] text-accent">{configImpressao.livro ? "Livro de fichas técnicas" : "Fichas técnicas"}</p>
                      <h3 className="mt-1 text-xl font-black text-fg">{unidadeInfo?.nome || "Seldeestrela"}</h3>
                    </div>
                    <BookOpen size={30} className="text-accent"/>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-3xs font-bold uppercase text-subtle">Fichas</p><p className="text-2xl font-black text-slate-800">{modalImpressao.lista.length}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-3xs font-bold uppercase text-subtle">Estimativa</p><p className="text-2xl font-black text-slate-800">{estimarPaginasDocumento(modalImpressao.lista.length, configImpressao)} pág.</p></div>
                  </div>
                  <p className="mt-5 text-3xs font-bold uppercase tracking-wider text-subtle">Ordem do documento</p>
                  <div className="mt-2 space-y-2">
                    {listaOrdenadaPrevia().slice(0, 6).map((ficha, indice) => (
                      <div key={ficha.id} className="flex items-center gap-3 rounded-lg border border-line-soft px-3 py-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-3xs font-bold text-accent-strong">{indice + 1}</span>
                        <span className="truncate text-xs font-bold text-fg-soft">{ficha.nome_receita}</span>
                      </div>
                    ))}
                    {modalImpressao.lista.length > 6 && <p className="text-center text-xs font-bold text-subtle">+ {modalImpressao.lista.length - 6} fichas no documento</p>}
                  </div>
                  <p className="mt-5 text-3xs font-bold text-subtle">Modelo {configImpressao.modelo} · {configImpressao.formato === "a4-paisagem" ? "Paisagem" : "Retrato"} · {configImpressao.capa ? "Com capa" : "Sem capa"} · {configImpressao.indice ? "Com índice" : "Sem índice"}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-card p-4 sm:px-6">
              <button onClick={() => setModalImpressao(null)} className="mr-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-elevated"><ArrowLeft size={17}/> Voltar</button>
              <button onClick={salvarModeloImpressao} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-black text-fg-soft"><Save size={17}/> Salvar modelo</button>
              <button onClick={() => gerarDocumentoConfigurado("pdf")} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-accent-soft px-4 py-2.5 text-sm font-black text-accent-strong"><Download size={17}/> Gerar PDF</button>
              <button onClick={() => gerarDocumentoConfigurado("imprimir")} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-accent-fg hover:opacity-90"><Printer size={17}/> Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {modalCategorias && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setModalCategorias(false)}>
          <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card p-5 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${modoFicha === "preparos" ? "text-amber-700" : "text-accent"}`}>{modoFicha === "preparos" ? "Ambiente de preparos" : "Ambiente de pratos e montagens"}</p>
                <h3 className="mt-1 text-2xl font-black text-fg">Gerenciar categorias de {modoFicha === "preparos" ? "preparos" : deptUrl === "bar" ? "drinks e produtos" : "pratos"}</h3>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">As categorias ficam disponíveis para toda a equipe desta unidade.</p>
              </div>
              <button type="button" onClick={() => setModalCategorias(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated text-muted hover:bg-slate-200"><X size={20} /></button>
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
              <button type="button" disabled={salvandoCategoria || !novaCategoria.trim()} onClick={criarCategoria} className="min-h-12 rounded-xl bg-accent px-5 text-sm font-black text-accent-fg hover:bg-accent disabled:opacity-50">
                {salvandoCategoria ? "Salvando..." : "Criar categoria"}
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {categoriasDisponiveis.map(cat => {
                const quantidade = fichasDoModo.filter(f => f.categoria === cat).length;
                return (
                  <div key={cat} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-800">{cat}</p>
                      <p className="text-xs font-semibold text-muted">{quantidade} {quantidade === 1 ? "ficha nesta categoria" : "fichas nesta categoria"}</p>
                    </div>
                    <button type="button" onClick={() => excluirCategoria(cat)} title={`Excluir categoria ${cat}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-card text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <h4 className="text-base font-black text-fg">Organizar {modoFicha === "preparos" ? "receitas" : deptUrl === "bar" ? "drinks" : "pratos"}</h4>
              <p className="mt-1 text-xs font-semibold text-muted">Escolha diretamente em qual categoria cada item deve aparecer.</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {[...fichasDoModo].sort(ordenarFichas).map(ficha => (
                  <div key={ficha.id} className="grid gap-2 rounded-xl border border-line bg-card p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                    <p className="truncate text-sm font-black text-slate-800" title={ficha.nome_receita}>{ficha.nome_receita}</p>
                    <select
                      value={ficha.categoria || ""}
                      disabled={alterandoCategoriaId === ficha.id}
                      onChange={e => organizarFichaNaCategoria(ficha, e.target.value)}
                      className="min-h-10 w-full rounded-lg border border-slate-300 bg-card px-3 text-sm font-bold text-fg-soft outline-none focus:border-emerald-500 disabled:opacity-60"
                    >
                      <option value="">Sem categoria</option>
                      {categoriasDisponiveis.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
                    </select>
                  </div>
                ))}
                {fichasDoModo.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm font-semibold text-muted">Nenhuma ficha cadastrada neste grupo.</p>}
              </div>
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
         const rendimentoOriginal = Number(f.rendimento_porcoes) || 0;
         const porcoes = (unR === "porcao" || unR === "un") ? rendimentoOriginal : (peso?.porcoes || 0);
         const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
         const padraoSetor = rendimentoPadronizado(f);
         const rend = padraoSetor.valor;
         const labelUn = padraoSetor.unidade === "l" ? "L" : "kg";
         const custoKg = rend > 0 ? custoTotal / rend : null;
         const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
         const preco = Number(prod?.preco_venda) || 0;
         const meta = Number(f.cmv_meta) || 30;
         const cmv = preco > 0 ? (custoPorcao / preco) * 100 : null;
         const margem = cmv !== null ? 100 - cmv : null;
         const markup = preco > 0 && custoPorcao > 0 ? preco / custoPorcao : null;
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
                  <div className="bg-card border-b border-line-soft px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
                     <button onClick={fechar} className="w-10 h-10 rounded-full bg-elevated hover:bg-slate-200 flex items-center justify-center text-slate-600 shrink-0"><ArrowLeft size={19} /></button>
                     <div className="w-11 h-11 rounded-2xl bg-accent text-accent-fg flex items-center justify-center shrink-0">
                        {f.departamento === "bar" ? <Wine size={20} /> : <UtensilsCrossed size={20} />}
                     </div>
                     <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                           <h2 className="text-lg sm:text-xl font-black text-fg break-words">{f.nome_receita}</h2>
                           <span className="erp-status-ativo inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wider text-emerald-700">Ativo</span>
                        </div>
                        <p className="text-2xs font-bold text-muted mt-0.5">{f.categoria || (f.eh_base ? "Pré-preparo" : "Prato")} · {setorTxt}</p>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                        {!f.eh_base && (
                           <>
                              <button onClick={() => abrirPreviaImpressao("imprimir", [f])} title="Imprimir" className="w-10 h-10 rounded-xl border border-line bg-card text-slate-600 hover:border-emerald-400 flex items-center justify-center"><Printer size={17} /></button>
                              <button onClick={() => abrirPreviaImpressao("pdf", [f])} title="Gerar PDF" className="w-10 h-10 rounded-xl border border-line bg-card text-slate-600 hover:border-emerald-400 flex items-center justify-center"><Download size={17} /></button>
                              <button onClick={() => abrirSimulacao(f)} title="Simular rendimento" className="w-10 h-10 rounded-xl border border-line bg-card text-slate-600 hover:border-emerald-400 flex items-center justify-center"><Calculator size={17} /></button>
                           </>
                        )}
                        <button onClick={() => { fechar(); abrirEditar(f); }} className="inline-flex items-center gap-2 rounded-xl bg-accent hover:bg-accent text-accent-fg font-black text-sm px-4 h-10 shadow-sm"><Edit3 size={16} /> Editar ficha</button>
                     </div>
                  </div>

                  {/* ABAS */}
                  <div className="bg-card border-b border-line-soft px-4 sm:px-6 flex gap-1 overflow-x-auto">
                     {[["ficha", "Ficha técnica"], ["preparo", f.eh_base ? "Modo de preparo" : "Montagem e guarnição"], ["custos", "Histórico de custos"]].map(([id, rot]) => (
                        <button key={id} onClick={() => setViewTab(id)}
                           className={`shrink-0 px-3 py-3 text-sm font-black border-b-2 transition-colors ${viewTab === id ? "border-emerald-600 text-accent" : "border-transparent text-subtle hover:text-slate-600"}`}>
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
                        <div className="order-2 bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                           <p className="text-2xs font-bold uppercase tracking-widest text-accent mb-4">Informações gerais</p>
                           <div className="flex flex-col sm:flex-row gap-4">
                              <div className="grid grid-cols-2 gap-3 flex-1">
                                 {[
                                     ["Categoria", f.categoria || "—"],
                                     ["Setor", setorTxt],
                                     ["Quantidade da receita", `${nf(rend)} ${labelUn}`],
                                     ...(podeVerCustos ? [[`1 ${labelUn} custa`, custoKg !== null ? fmtBRL(custoKg) : "—"]] : []),
                                     ["Unidade padrão", labelUn],
                                     ["Custo total", fmtBRL(custoTotal)],
                                  ].map(([rot, val]) => (
                                    <div key={rot} className="rounded-xl bg-slate-50 border border-line-soft px-3 py-2">
                                       <p className="text-3xs font-bold uppercase tracking-wider text-subtle">{rot}</p>
                                       <p className="text-sm font-black text-slate-800 mt-0.5 truncate">{val}</p>
                                    </div>
                                 ))}
                              </div>
                              <div onClick={() => { fechar(); abrirEditar(f); }} className="w-full sm:w-40 h-32 sm:h-auto shrink-0 rounded-2xl overflow-hidden bg-elevated border border-line cursor-pointer relative group">
                                 {f.imagem ? (
                                    <img src={`data:image/jpeg;base64,${f.imagem}`} alt={f.nome_receita} className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-dim gap-1"><Camera size={26} /><span className="text-3xs font-bold uppercase tracking-widest">Sem foto</span></div>
                                 )}
                                 <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 text-white text-3xs font-bold py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"><Camera size={12} /> Alterar imagem</div>
                              </div>
                           </div>
                        </div>

                        {/* INGREDIENTES E CUSTOS */}
                        {!f.produto_pronto && (
                        <div className="order-1 bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                           <p className="text-2xs font-bold uppercase tracking-widest text-accent mb-3">Ingredientes / composição</p>
                           <div className="overflow-x-auto">
                              <table className="w-full text-sm min-w-[560px]">
                                 <thead>
                                    <tr className="text-3xs font-bold uppercase tracking-wider text-subtle border-b border-line">
                                       <th className="text-left font-black py-2 pr-2">Ingrediente</th>
                                       <th className="text-center font-black py-2 px-1">Unid.</th>
                                       <th className="text-right font-black py-2 px-1">Qtd. bruta</th>
                                       <th className="text-right font-black py-2 px-1">FC %</th>
                                       <th className="text-right font-black py-2 px-1">Qtd. líq.</th>
                                       {podeVerCustos && <th className="text-right font-black py-2 px-1">Custo un.</th>}
                                       {podeVerCustos && <th className="text-right font-black py-2 pl-1">Custo total</th>}
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {linhas.length === 0 && (
                                       <tr><td colSpan={7} className="py-6 text-center text-subtle font-medium">Sem ingredientes cadastrados.</td></tr>
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
                                            <td colSpan={podeVerCustos ? 7 : 5} className="pt-4 pb-1.5">
                                              <span className="text-2xs font-bold uppercase tracking-widest text-accent">{grupo.titulo}</span>
                                            </td>
                                          </tr>
                                        )}
                                        {grupo.itens.map((l, i) => (
                                          <tr key={`${grupo.titulo}-${i}`} className="border-b border-slate-50">
                                            <td className="py-3 pr-2 text-[15px] font-bold text-slate-800">{l.nome}{l.base && <span className="ml-1.5 text-3xs font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Preparo</span>}</td>
                                            <td className="py-3 px-1 text-center font-bold text-muted">{l.un}</td>
                                            <td className="py-3 px-1 text-right font-bold text-fg-soft">{nf(l.bruta)}</td>
                                            <td className="py-3 px-1 text-right font-bold text-muted">{l.fc ? `${nf(l.fc)}%` : "—"}</td>
                                            <td className="py-3 px-1 text-right font-bold text-fg-soft">{nf(l.liquida)}</td>
                                            {podeVerCustos && <td className="py-3 px-1 text-right font-bold text-slate-600">{fmtBRL(l.custoUnit)}</td>}
                                            {podeVerCustos && <td className="py-3 pl-1 text-right font-black text-slate-800">{fmtBRL(l.custoTot)}</td>}
                                          </tr>
                                        ))}
                                      </Fragment>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                           <button onClick={() => { fechar(); abrirEditar(f); }} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 text-accent-strong font-black text-sm px-4 py-2.5 hover:bg-accent-soft"><Plus size={16} /> Adicionar ingrediente</button>
                           {podeVerCustos && (
                           <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
                              <span className="text-muted font-bold">Custo total da receita: <b className="text-accent font-black">{fmtBRL(custoTotal)}</b></span>
                              {custoKg !== null && <span className="text-muted font-bold">1 {labelUn} custa: <b className="text-accent font-black">{fmtBRL(custoKg)}</b></span>}
                           </div>
                           )}
                        </div>
                        )}
                        </>)}

                        {/* ABA: MODO DE PREPARO / MONTAGEM E GUARNIÇÃO */}
                        {viewTab === "preparo" && (
                           <div className="bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                              <p className="text-2xs font-bold uppercase tracking-widest text-accent mb-3">
                                 {f.eh_base ? "Modo de preparo" : "Montagem do prato e guarnição"}
                              </p>
                              {f.guarnicao ? (
                                 <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-line">
                                    <p className="text-3xs font-bold uppercase tracking-wider text-muted">Guarnição / Acompanhamento</p>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{f.guarnicao}</p>
                                 </div>
                              ) : null}
                              {(() => {
                                 const passos = String(f.modo_preparo || f.padrao_montagem || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
                                 if (!passos.length) return <p className="text-sm text-subtle font-medium">Nenhum passo de {f.eh_base ? "modo de preparo" : "montagem"} cadastrado. Use <b>Editar ficha</b> para adicionar.</p>;
                                 return (
                                    <ol className="space-y-2.5">
                                       {passos.map((p, i) => (
                                          <li key={i} className="flex gap-3">
                                             <span className="w-7 h-7 shrink-0 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center">{i + 1}</span>
                                             <span className="text-sm text-fg-soft font-medium leading-relaxed pt-0.5">{p.replace(/^\d+[.)\-\s]+/, "")}</span>
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
                              <div className="bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                                 <div className="flex items-center justify-between gap-2 mb-3">
                                    <p className="text-2xs font-bold uppercase tracking-widest text-accent">Histórico de custos</p>
                                    <button onClick={() => registrarCustoAtual(f, "manual")} disabled={registrandoCusto || histStatus === "sem_tabela"}
                                       className="inline-flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent disabled:opacity-50 text-accent-fg font-bold text-xs px-3 py-2">
                                       <Plus size={14} /> {registrandoCusto ? "Registrando..." : "Registrar custo atual"}
                                    </button>
                                 </div>
                                 {histStatus === "sem_tabela" ? (
                                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 font-medium leading-relaxed">
                                       Para guardar a variação de custo ao longo do tempo, rode a migração <b>db/migracao_ficha_custo_historico.sql</b> no SQL Editor do Supabase. Depois disso, cada alteração de custo fica registrada aqui automaticamente.
                                    </div>
                                 ) : histStatus === "carregando" ? (
                                    <p className="text-sm text-subtle font-medium">Carregando histórico...</p>
                                 ) : histCustos.length === 0 ? (
                                    <p className="text-sm text-subtle font-medium">Nenhum custo registrado ainda. Toque em <b>Registrar custo atual</b> para criar o primeiro ponto — ou salve a ficha após mudar ingredientes.</p>
                                 ) : (
                                    <div className="space-y-2">
                                       {histCustos.map((h, i) => {
                                          const dif = h.diferenca == null ? null : Number(h.diferenca);
                                          const pct = h.diferenca_pct == null ? null : Number(h.diferenca_pct);
                                          const subiu = dif != null && dif > 0.005;
                                          const desceu = dif != null && dif < -0.005;
                                          const origemTxt = h.origem === "edicao_ficha" ? "edição" : h.origem === "variacao_preco" ? "variação de preço" : "manual";
                                          return (
                                             <div key={h.id || i} className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-slate-50 px-3 py-2.5">
                                                <div className="min-w-0">
                                                   <p className="text-sm font-black text-slate-800">{fmtBRL(Number(h.custo_total) || 0)}<span className="text-2xs font-bold text-subtle ml-1.5">total{h.custo_porcao != null ? ` · ${fmtBRL(Number(h.custo_porcao))}/porção` : ""}</span></p>
                                                   <p className="text-3xs font-bold text-subtle">{new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {origemTxt}{h.usuario_nome ? ` · ${h.usuario_nome}` : ""}</p>
                                                </div>
                                                {dif == null ? (
                                                   <span className="text-3xs font-bold uppercase tracking-wider text-subtle shrink-0">1º registro</span>
                                                ) : (
                                                   <span className={`text-xs font-bold shrink-0 ${subiu ? "text-red-600" : desceu ? "text-accent" : "text-subtle"}`}>
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
                              <div className="bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                                 <p className="text-2xs font-bold uppercase tracking-widest text-accent mb-1">Composição do custo atual</p>
                                 <p className="text-2xs font-medium text-subtle mb-3">Participação de cada ingrediente no custo total ({fmtBRL(custoTotal)}).</p>
                                 <div className="space-y-2.5">
                                    {[...linhas].sort((a, b) => b.custoTot - a.custoTot).map((l, i) => {
                                       const pct = custoTotal > 0 ? (l.custoTot / custoTotal) * 100 : 0;
                                       return (
                                          <div key={i}>
                                             <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="font-bold text-fg-soft truncate pr-2">{l.nome}</span>
                                                <span className="font-black text-slate-800 shrink-0">{fmtBRL(l.custoTot)} <span className="text-subtle font-bold">· {pct.toFixed(1)}%</span></span>
                                             </div>
                                             <div className="h-2 rounded-full bg-elevated overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                                          </div>
                                       );
                                    })}
                                    {linhas.length === 0 && <p className="text-sm text-subtle font-medium">Sem ingredientes para compor o custo.</p>}
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>

                     {/* SIDEBAR */}
                     <div className="space-y-4 lg:sticky lg:top-0">
                        {/* RENDIMENTO E PORÇÕES */}
                        <div className="bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                           <p className="text-2xs font-bold uppercase tracking-widest text-accent mb-3">Rendimento e porções</p>
                           <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                                 <p className="text-3xs font-bold uppercase tracking-wider text-subtle">Esta receita rende</p>
                                 <p className="text-xl font-black text-accent">{nf(rend)} {labelUn}</p>
                              </div>
                              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                                 <p className="text-3xs font-bold uppercase tracking-wider text-subtle">Peso total</p>
                                 <p className="text-xl font-black text-accent">{padraoSetor.valor > 0 ? textoRendimentoPadronizado(f) : "—"}</p>
                              </div>
                           </div>
                           <div className="flex items-center justify-between mt-3 text-sm">
                              <span className="text-muted font-bold">Porção padrão</span>
                              <span className="font-black text-slate-800">{pesoPorcaoG ? `${nf(pesoPorcaoG)} g` : "—"}</span>
                           </div>
                           {pesoPorcaoG > 0 && (
                              <div className="mt-3 pt-3 border-t border-line-soft">
                                 <p className="text-2xs font-bold text-fg-soft">Simulador de porções</p>
                                 <p className="text-3xs font-medium text-subtle mb-2">Informe o peso disponível para ver quantas porções dá para servir.</p>
                                 <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center rounded-xl border border-line bg-slate-50 overflow-hidden">
                                       <input type="text" inputMode="decimal" value={simPesoView} onChange={e => setSimPesoView(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Peso disponível" className="flex-1 min-w-0 px-3 py-2.5 bg-transparent font-black text-slate-800 outline-none" />
                                       <span className="px-3 text-xs font-bold text-subtle">g</span>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-lg font-black text-accent leading-none">{simN > 0 ? `${simPorcoes} porç.` : "—"}</p>
                                       <p className="text-3xs font-bold text-subtle mt-0.5">{simN > 0 ? `sobra ${nf(simSobra)} g` : `de ${nf(pesoPorcaoG)} g`}</p>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>

                        {/* CUSTO E PRECIFICAÇÃO */}
                        {!f.eh_base && (
                        <div className="bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                           <p className="text-2xs font-bold uppercase tracking-widest text-accent mb-3">Custo e precificação</p>
                           <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between"><span className="text-muted font-bold">Custo total da receita</span><span className="font-black text-slate-800">{fmtBRL(custoTotal)}</span></div>
                              <div className="flex items-center justify-between"><span className="text-muted font-bold">Custo de 1 {labelUn}</span><span className="font-black text-slate-800">{custoKg !== null ? fmtBRL(custoKg) : "—"}</span></div>
                           </div>
                           <div className="grid grid-cols-2 gap-2 mt-3">
                              <div className={`rounded-xl px-3 py-2 text-center border ${cmv !== null && cmv > meta ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-100"}`}>
                                 <p className="text-3xs font-bold uppercase tracking-wider text-subtle">CMV</p>
                                 <p className={`text-lg font-black ${cmv !== null && cmv > meta ? "text-red-600" : "text-accent"}`}>{cmv !== null ? `${cmv.toFixed(1)}%` : "—"}</p>
                              </div>
                              <div className="rounded-xl px-3 py-2 text-center border bg-emerald-50 border-emerald-100">
                                 <p className="text-3xs font-bold uppercase tracking-wider text-subtle">Margem</p>
                                 <p className="text-lg font-black text-accent">{margem !== null ? `${margem.toFixed(1)}%` : "—"}</p>
                              </div>
                              <div className="rounded-xl px-3 py-2 text-center border bg-emerald-50 border-emerald-100">
                                 <p className="text-3xs font-bold uppercase tracking-wider text-subtle">Markup</p>
                                 <p className="text-lg font-black text-accent">{markup ? `${markup.toFixed(2)}×` : "—"}</p>
                              </div>
                              <div className="rounded-xl px-3 py-2 text-center border bg-slate-50 border-line">
                                 <p className="text-3xs font-bold uppercase tracking-wider text-subtle">Preço/porção</p>
                                 <p className="text-lg font-black text-slate-800">{preco > 0 ? fmtBRL(preco) : "—"}</p>
                              </div>
                           </div>
                           <div className="mt-3 flex items-center justify-between rounded-xl bg-accent text-accent-fg px-3 py-2.5">
                              <span className="text-2xs font-bold uppercase tracking-wider">Preço sugerido (CMV {meta}%)</span>
                              <span className="text-lg font-black">{precoSugerido > 0 ? fmtBRL(precoSugerido) : "—"}</span>
                           </div>
                        </div>
                        )}

                        {/* INFORMAÇÕES ADICIONAIS */}
                        <div className="bg-card rounded-2xl border border-line shadow-sm p-4 sm:p-5">
                           <p className="text-2xs font-bold uppercase tracking-widest text-accent mb-3">Informações adicionais</p>
                           <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-slate-600"><Clock size={15} className="text-success shrink-0" /><span className="font-bold">Tempo de preparo:</span> <b className="text-slate-800">{f.tempo_preparo ? `${f.tempo_preparo} min` : "—"}</b></div>
                              <div className="flex items-center gap-2 text-slate-600"><Thermometer size={15} className="text-success shrink-0" /><span className="font-bold">Validade:</span> <b className="text-slate-800">{f.validade_dias ? `${f.validade_dias} dia${Number(f.validade_dias) !== 1 ? "s" : ""}` : "—"}</b></div>
                              {metodoBar(f.metodo_bar) && <div className="flex items-center gap-2 text-slate-600"><Wine size={15} className="text-success shrink-0" /><span className="font-bold">Método:</span> <b className="text-slate-800">{metodoBar(f.metodo_bar).nome}</b></div>}
                              {f.observacoes && <p className="text-[13px] text-muted font-medium pt-1 leading-relaxed border-t border-line-soft mt-2">{f.observacoes}</p>}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         );
      })()}

      {modalEscolhaNovo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setModalEscolhaNovo(false)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-card p-4 shadow-2xl sm:rounded-3xl sm:p-6" onClick={evento => evento.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-3xs font-bold uppercase tracking-[.16em] text-orange-600">Nova ficha técnica</p>
                <h2 className="mt-1 text-xl font-black text-fg">Como deseja começar?</h2>
                <p className="mt-1 text-sm font-semibold text-muted">Você pode completar uma ficha agora ou cadastrar vários títulos para preencher depois.</p>
              </div>
              <button onClick={() => setModalEscolhaNovo(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated text-muted"><X size={17}/></button>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button onClick={() => { setModalEscolhaNovo(false); abrirNova(); }} className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-left text-orange-950 hover:border-orange-400">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-600 text-white"><Edit3 size={19}/></span>
                <span><strong className="block text-sm font-black">Criar um {deptUrl === "bar" ? "drink" : "prato"}</strong><small className="mt-0.5 block font-semibold text-orange-700">Preencher a ficha completa agora</small></span>
              </button>
              <button onClick={() => { setModalEscolhaNovo(false); setTitulosLote(""); setModalTitulosLote(true); }} className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-line bg-slate-50 p-3 text-left text-fg hover:border-orange-300">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-white"><LayoutList size={19}/></span>
                <span><strong className="block text-sm font-black">Adicionar vários títulos</strong><small className="mt-0.5 block font-semibold text-muted">Completar cada ficha depois</small></span>
              </button>
            </div>
          </div>
        </div>
      )}

      {modalTitulosLote && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !salvandoTitulosLote && setModalTitulosLote(false)}>
          <div className="flex max-h-[100dvh] w-full max-w-xl flex-col rounded-t-3xl bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl" onClick={evento => evento.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-soft p-4 sm:p-5">
              <div>
                <p className="text-3xs font-bold uppercase tracking-[.16em] text-orange-600">Cadastro rápido</p>
                <h2 className="mt-1 text-xl font-black text-fg">Adicionar títulos de {deptUrl === "bar" ? "drinks" : "pratos"}</h2>
                <p className="mt-1 text-sm font-semibold text-muted">Digite um {deptUrl === "bar" ? "drink" : "prato"} por linha. Eles serão salvos para você completar depois.</p>
              </div>
              <button disabled={salvandoTitulosLote} onClick={() => setModalTitulosLote(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated text-muted disabled:opacity-40"><X size={17}/></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Títulos</label>
              <textarea autoFocus value={titulosLote} onChange={evento => setTitulosLote(evento.target.value)} placeholder={deptUrl === "bar" ? "Ex.:\nCaipirinha de limão\nGin tônica\nMoscow mule" : "Ex.:\nAçaí de 300 ml\nAçaí de 500 ml\nBatata frita com cheddar"} className="mt-2 min-h-[220px] w-full resize-y rounded-2xl border-2 border-line bg-slate-50 p-4 text-base font-semibold leading-8 text-slate-800 outline-none focus:border-orange-500"/>
              <p className="mt-2 text-xs font-semibold text-subtle">Títulos repetidos ou que já existem serão ignorados.</p>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line-soft bg-slate-50 p-3 sm:p-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
              <button disabled={salvandoTitulosLote} onClick={() => setModalTitulosLote(false)} className="min-h-10 rounded-xl px-4 text-sm font-black text-muted hover:bg-slate-200 disabled:opacity-40">Cancelar</button>
              <button disabled={salvandoTitulosLote || !titulosLote.trim()} onClick={salvarTitulosEmLote} className="flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-black text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700 disabled:opacity-50">
                {salvandoTitulosLote ? <Loader2 size={17} className="animate-spin"/> : <Plus size={17}/>} {salvandoTitulosLote ? "Criando..." : "Criar títulos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO DA FICHA TÉCNICA */}
      {modalNovo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4">
             <div className="erp-ficha erp-editor-ficha bg-card rounded-3xl sm:rounded-[32px] w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[94vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               <style>{`
                 .erp-editor-ficha label { font-size: 13px !important; line-height: 1.4; }
                 .erp-editor-ficha input, .erp-editor-ficha select, .erp-editor-ficha textarea { font-size: 16px !important; line-height: 1.5; }
                 .erp-editor-ficha input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), .erp-editor-ficha select { min-height: 48px; }
                 .erp-editor-ficha textarea { line-height: 1.65; }
                 .erp-editor-ficha [class*="text-3xs"], .erp-editor-ficha [class*="text-3xs"] { font-size: 12px !important; }
                 .erp-editor-ficha [class*="text-2xs"] { font-size: 13px !important; }
               `}</style>
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center gap-3 p-4 sm:px-6 sm:py-5 border-b border-line-soft bg-card">
                  <div className="min-w-0">
                     <p className={`text-3xs font-bold uppercase tracking-[.18em] ${form.eh_base ? "text-amber-700" : "text-accent"}`}>{form.eh_base ? "Pré-preparo" : form.produto_pronto ? "Produto pronto" : deptUrl === "bar" ? "Montagem de drink" : "Montagem de prato"}</p>
                     <h2 className="font-black text-2xl sm:text-3xl text-slate-800">{form.id ? "Editar ficha técnica" : "Nova ficha técnica"}</h2>
                     <p className="text-sm font-bold text-muted mt-1">{ingFicha.length} ingrediente(s) · custo atual <span className="text-success font-black">{fmtBRL(custoTotalFormulario(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-12 h-12 shrink-0 bg-elevated rounded-full flex items-center justify-center text-muted hover:bg-slate-200"><X size={21}/></button>
               </div>

               <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-line-soft bg-slate-50 px-4 py-3 sm:px-6">
                  {[
                    ["ficha-dados", "1. Dados", !!form.nome_receita],
                    ["ficha-ingredientes", "2. Ingredientes", form.produto_pronto || ingFicha.length > 0],
                    ["ficha-rendimento", "3. Rendimento", !!form.rendimento_porcoes],
                    ...(!form.eh_base && !form.produto_pronto ? [["ficha-custos", "4. Custos e preço", Number(form.preco_venda) > 0]] : []),
                    ...(form.eh_base ? [["ficha-preparo", "4. Preparo", !!form.modo_preparo]] : []),
                  ].map(([id, label, completo]) => <button key={id} type="button" onClick={() => irSecaoEditorFicha(id)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl border bg-card px-3 text-xs font-bold transition-colors ${completo ? "border-emerald-200 text-accent" : "border-line text-muted hover:border-emerald-300"}`}><span className={`h-2 w-2 rounded-full ${completo ? "bg-emerald-500" : "bg-slate-300"}`} />{label}</button>)}
               </nav>

               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-4 sm:p-7 bg-slate-50/50 custom-scrollbar">
                  
                   {/* COLUNA ESQUERDA: Dados Básicos e Foto */}
                  <div id="ficha-dados" className="space-y-4 scroll-mt-24">
                     <div className="flex gap-4">
                        <div className="w-24 h-24 shrink-0 relative">
                           <div onClick={() => fileInputRef.current?.click()} className="w-full h-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-elevated hover:border-emerald-400 overflow-hidden relative group transition-colors">
                              {form.imagem ? (
                                 <>
                                    <img src={`data:image/jpeg;base64,${form.imagem}`} className="w-full h-full object-cover" alt="Foto do Prato" />
                                    <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"><Camera size={24}/></div>
                                 </>
                              ) : (
                                 <div className="text-center">
                                    <Camera size={24} className="mx-auto text-subtle mb-1"/>
                                    <span className="text-3xs font-bold text-muted uppercase tracking-widest">Foto</span>
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
                           <label className="text-xs font-bold text-muted uppercase tracking-widest">{form.produto_pronto ? "Nome do produto" : "Nome da receita"}</label>
                           <input type="text" placeholder={form.produto_pronto ? "Ex: Água sem gás 500 ml" : "Ex: Caipirinha de Morango"} value={form.nome_receita} onChange={e=>setForm({...form, nome_receita: e.target.value})} className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                           {form.imagem && <button type="button" onClick={() => setForm({ ...form, imagem: "" })} className="text-2xs font-bold text-rose-500 hover:text-rose-600 mt-1.5">Remover foto</button>}
                        </div>
                     </div>
                     {/* Escolha principal, no mesmo padrão rápido do estoque */}
                     {!form.id ? <div>
                       <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">O que você vai cadastrar?</p>
                       <div className="grid grid-cols-2 gap-3">
                         <button type="button" onClick={() => setForm({ ...form, eh_base: true, produto_pronto: false, tipo_base: "pre", categoria: categoriasPreparoDisponiveis.includes(form.categoria) ? form.categoria : categoriasPreparoDisponiveis[0] || "" })}
                           className={`min-h-[76px] rounded-2xl border-2 p-3 text-left transition-all sm:min-h-[94px] sm:p-4 ${form.eh_base ? "border-amber-600 bg-amber-50 text-amber-900 shadow-lg shadow-amber-600/10" : "border-line bg-card text-muted hover:border-amber-300"}`}>
                           <BookOpen size={24} className={form.eh_base ? "text-amber-700" : "text-subtle"} />
                           <strong className="mt-2 block text-base">Pré-preparo</strong><span className="block text-xs font-semibold">base usada em outras fichas</span>
                         </button>
                         <button type="button" onClick={() => setForm({ ...form, eh_base: false, produto_pronto: false, tipo_base: null, categoria: categoriasPrincipaisDisponiveis.includes(form.categoria) ? form.categoria : "", modo_preparo: "" })}
                           className={`min-h-[76px] rounded-2xl border-2 p-3 text-left transition-all sm:min-h-[94px] sm:p-4 ${!form.eh_base && !form.produto_pronto ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-lg shadow-emerald-600/10" : "border-line bg-card text-muted hover:border-emerald-300"}`}>
                           <UtensilsCrossed size={24} className={!form.eh_base && !form.produto_pronto ? "text-emerald-700" : "text-subtle"} />
                           <strong className="mt-2 block text-base">{deptUrl === "bar" ? "Montagem de drink" : "Montagem de prato"}</strong><span className="block text-xs font-semibold">item final do cardápio</span>
                         </button>
                       </div>
                       {/* O botão "É um produto pronto" saiu daqui: garrafa, lata e
                           cerveja não são receituário e não aparecem mais na ficha
                           técnica. Criar por aqui só geraria registro invisível.
                           Esses itens se cadastram no Cardápio e no Estoque. */}
                     </div> : (
                       <div className={`flex items-center gap-3 rounded-2xl border p-4 ${form.eh_base ? "border-amber-200 bg-amber-50" : form.produto_pronto ? "border-orange-200 bg-orange-50" : "border-emerald-200 bg-emerald-50"}`}>
                         <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-accent-fg ${form.eh_base ? "bg-amber-600" : form.produto_pronto ? "bg-orange-600" : "bg-accent"}`}>{form.eh_base ? <BookOpen size={21} /> : form.produto_pronto ? <Package size={21} /> : <UtensilsCrossed size={21} />}</span>
                         <div>
                           <p className="text-2xs font-bold uppercase tracking-widest text-muted">Tipo da ficha</p>
                           <p className="text-base font-black text-fg">{form.eh_base ? "Pré-preparo" : form.produto_pronto ? "Produto pronto" : deptUrl === "bar" ? "Montagem de drink" : "Montagem de prato"}</p>
                           <p className="text-xs font-semibold text-muted">O tipo é definido no cadastro e não precisa ser escolhido novamente ao editar.</p>
                         </div>
                       </div>
                     )}
                      {form.produto_pronto && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                           <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Tipo de produto pronto</label>
                           <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-2 bg-card border border-emerald-200 rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500 shadow-sm">
                              {CATEGORIAS_PRODUTO_PRONTO_BAR.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                           <p className="mt-2 text-2xs font-medium text-accent">Produto vendido como vem do fornecedor. Não exige ingredientes, receita ou guia de montagem.</p>
                        </div>
                      )}
                      {form.eh_base && (
                         <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Categoria deste preparo</label>
                              <button type="button" onClick={() => { setModoFicha("preparos"); setModalCategorias(true); }} className="text-xs font-bold text-accent hover:underline">+ Gerenciar</button>
                            </div>
                            <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-2 bg-card border border-emerald-200 rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500 shadow-sm">
                               <option value="">Sem categoria</option>
                               {form.categoria && !categoriasPreparoDisponiveis.includes(form.categoria) && <option value={form.categoria}>{form.categoria}</option>}
                               {categoriasPreparoDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <p className="mt-2 text-2xs font-medium text-amber-700">{deptUrl === "bar" ? "Este preparo poderá ser usado em vários drinks." : "Este preparo poderá ser reutilizado na montagem de vários pratos."}</p>
                         </div>
                      )}
                     {/* Categoria do cardápio (pratos e drinks finais, não bases) */}
                     {!form.eh_base && !form.produto_pronto && (
                        <div>
                           <div className="flex items-center justify-between">
                             <label className="text-xs font-bold text-muted uppercase tracking-widest">{deptUrl === "bar" ? "Categoria do drink" : "Categoria no cardápio"}</label>
                             <button
                               type="button"
                               onClick={() => { setModoFicha("principais"); setModalCategorias(true); }}
                               className="text-sm font-black text-success hover:underline"
                             >
                               + Gerenciar categorias
                             </button>
                           </div>
                           <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500 shadow-sm">
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
                        <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-muted">Cadastre a categoria e o preço. O item entrará no cardápio do Bar sem exigir ingredientes ou montagem.</p>
                        <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-2 text-left">
                           <div className="rounded-xl border border-emerald-100 bg-card p-3"><span className="block text-3xs font-bold uppercase tracking-widest text-subtle">Quantidade</span><span className="font-black text-slate-800">1 unidade</span></div>
                           <div className="rounded-xl border border-emerald-100 bg-card p-3"><span className="block text-3xs font-bold uppercase tracking-widest text-subtle">Composição</span><span className="font-black text-slate-800">Não se aplica</span></div>
                        </div>
                     </div>
                     ) : (
                     <div id="ficha-ingredientes" className="bg-card p-5 rounded-2xl border-2 border-emerald-200 shadow-sm flex flex-col scroll-mt-24">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                           <div>
                              <label className="block text-xs font-bold uppercase tracking-widest text-accent">Ingredientes / composição</label>
                              <p className="mt-1 text-xs font-semibold text-muted">Comece por aqui: rendimento, CMV e preço saem desta lista.</p>
                           </div>
                           <span className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-right">
                              <span className="block text-3xs font-bold uppercase tracking-widest text-accent">{ingFicha.length} item(ns)</span>
                              <span className="block text-sm font-black text-emerald-800">{fmtBRL(custoTotalFormulario(ingFicha))}</span>
                           </span>
                        </div>
                     
                        {/* ADD INGREDIENTE — busca por digitação: a lista tem centenas de itens */}
                        <div className="relative mb-4">
                           <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3">
                              <Search size={17} className="shrink-0 text-subtle" />
                              <input value={buscaIng} onChange={e => setBuscaIng(e.target.value)}
                                 placeholder="Digite para achar insumo, pré-preparo ou embalagem"
                                 className="h-12 w-full bg-transparent font-bold text-fg-soft outline-none" />
                              {buscaIng && <button type="button" onClick={() => setBuscaIng("")} className="shrink-0 text-subtle hover:text-slate-600"><X size={16} /></button>}
                           </div>
                           {buscaIng.trim() && (
                              <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card shadow-sm">
                                 {sugestoesIngrediente.length === 0 ? (
                                    <p className="p-3 text-sm font-bold text-subtle">Nada encontrado com esse nome.</p>
                                 ) : sugestoesIngrediente.map(o => (
                                    <button key={o.valor + o.nome} type="button" onClick={() => addIngrediente(o.valor)}
                                       className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2.5 text-left last:border-0 hover:bg-emerald-50">
                                       <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">{o.nome}</span>
                                       <span className="shrink-0 text-3xs font-bold uppercase tracking-wider text-subtle">{o.tipo}{o.detalhe ? ` · ${o.detalhe}` : ""}</span>
                                    </button>
                                 ))}
                              </div>
                           )}
                        </div>

                        {/* Cabeçalho estilo tabela (como na ficha de referência) */}
                        {ingFicha.length > 0 && (
                           <div className="flex items-center gap-3 px-3 pb-2 mb-1 border-b border-line">
                              <span className="flex-1 text-3xs font-bold uppercase tracking-wider text-subtle">Ingrediente</span>
                              <span className="w-20 text-center text-3xs font-bold uppercase tracking-wider text-subtle">Qtd.</span>
                              <span className="w-9 text-center text-3xs font-bold uppercase tracking-wider text-subtle">Un.</span>
                              <span className="w-8" />
                           </div>
                        )}

                        {/* LISTA DE INGREDIENTES */}
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                           {ingFicha.length === 0 && (
                              <div className="text-center p-6 text-muted font-medium text-sm">
                                 Selecione ingredientes acima para montar a ficha técnica e calcular o custo.
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
                              <div key={ing.chave} className="p-3 bg-slate-50 border border-line-soft rounded-xl flex items-center gap-3 group">
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate flex items-center gap-1.5">
                                       {ing.nome}
                                       {ing.tipo === "base" && <span className="text-3xs font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Base</span>}
                                    </p>
                                    <p className="text-3xs font-bold text-success uppercase tracking-widest mt-0.5">Custo: {fmtBRL(ing.custo_unitario * ing.quantidade * (1 + (Number(ing.fator) || 0) / 100))} <span className="text-subtle normal-case">· {fmtBRL(ing.custo_unitario)}/{String(ing.unidade).toUpperCase()}</span></p>
                                    {/* Perda vem do cadastro do ingrediente (o FC saiu da ficha). O custo usa a qtd bruta = líquida × (1 + perda). */}
                                    {ing.tipo !== "base" && Number(ing.fator) > 0 && (
                                       <div className="flex items-center gap-1.5 mt-1">
                                          <span className="text-3xs font-bold uppercase tracking-wider text-subtle">Perda do ingrediente</span>
                                          <span className="text-3xs font-bold text-accent">{Number(ing.fator).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                                          {ing.quantidade > 0 && (
                                             <span className="text-3xs font-bold text-subtle">· bruta {(+(ing.quantidade * (emSub ? fator : 1) * (1 + Number(ing.fator) / 100)).toFixed(2)).toLocaleString("pt-BR")} {unidadeLabel}</span>
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
                                          <p className="text-3xs font-bold text-subtle mt-0.5">
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
                                       className="w-20 p-2 text-center bg-card border border-line rounded-lg font-black text-fg-soft outline-none focus:border-emerald-500"
                                    />
                                    {sub ? (
                                       <button
                                          type="button"
                                          onClick={() => toggleModo(ing.chave)}
                                          title="Alternar unidade de lançamento"
                                          className="text-3xs font-bold text-accent-strong bg-accent-soft hover:bg-emerald-100 border border-emerald-200 rounded-md px-1.5 py-1 uppercase w-9 transition-colors"
                                       >
                                          {unidadeLabel}
                                       </button>
                                    ) : (
                                       <span className="text-3xs font-bold text-muted uppercase w-9 text-center">{unidadeLabel}</span>
                                    )}
                                 </div>
                                 <button onClick={() => { setSubstitutoValor(""); setSubstituirAlvo(ing); }} title="Remover ou substituir" className="p-2 text-muted hover:text-rose-600 transition-colors bg-card rounded-lg border border-line">
                                    <Trash2 size={14}/>
                                 </button>
                              </div>
                              );
                           })}
                        </div>

                     </div>
                     )}

                     {/* RENDIMENTO — cozinha em kg; bar em litros */}
                     <div id="ficha-rendimento" className="bg-card border border-line rounded-2xl p-4 shadow-sm scroll-mt-24">
                        <div className="flex items-center justify-between mb-3">
                           <p className="text-xs font-bold text-muted uppercase tracking-widest">Rendimento da receita</p>
                           {autoSoma
                              ? <button type="button" onClick={() => setAutoSoma(false)} className="text-3xs font-bold text-subtle hover:text-slate-600 underline">ajustar manualmente</button>
                              : <button type="button" onClick={() => setAutoSoma(true)} className="text-3xs font-bold text-success hover:text-accent underline">← voltar ao automático</button>}
                        </div>
                        {autoSoma ? (
                           (() => {
                               const est = rendimentoPelosIngredientes(ingFicha, form.departamento || deptUrl);
                               const custoTotal = calcularCustoTotal(ingFicha);
                               const unidadeSetor = unidadePadraoDepartamento(form.departamento || deptUrl);
                               const unidadeLabelSetor = unidadeSetor === "l" ? "L" : "kg";
                               if (!est) return <p className="text-sm text-subtle font-medium py-2">Adicione ingredientes — o rendimento e o custo de 1 {unidadeLabelSetor} aparecem aqui sozinhos.</p>;
                               const custoKg = custoTotal / (est.totalG / 1000);
                               const unLabel = ({ kg: "kg", g: "g", l: "L", ml: "ml" })[est.unidade];
                              return (
                                 <>
                                    <div className="grid grid-cols-2 gap-3">
                                       <div className="bg-slate-50 border border-line rounded-xl p-3 text-center">
                                          <p className="text-3xs font-bold text-subtle uppercase tracking-widest">Rende</p>
                                          <p className="text-2xl font-black text-slate-800 mt-1">{est.valor.toLocaleString("pt-BR")} <span className="text-base">{unLabel}</span></p>
                                          <p className="text-3xs font-medium text-subtle">somado dos ingredientes</p>
                                       </div>
                                       <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                          <p className="text-3xs font-bold text-success uppercase tracking-widest">1 {unidadeLabelSetor} custa</p>
                                          <p className="text-2xl font-black text-accent mt-1">{fmtBRL(custoKg)}</p>
                                          <p className="text-3xs font-medium text-emerald-600/70">custo total {fmtBRL(custoTotal)}</p>
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
                                                <p className="text-2xs font-bold text-red-600 leading-relaxed">
                                                   Preço suspeito inflando o custo: {suspeitos.map(x => `${x.ing.nome} está ${fmtBRL(x.ing.custo_unitario)} por ${String(x.ing.unidade).toLowerCase()} (= ${fmtBRL((Number(x.ing.custo_unitario) || 0) * 1000)}/kg)`).join("; ")}. Se esse é o preço do maço/pacote, corrija no cadastro de Ingredientes.
                                                </p>
                                             </div>
                                          )}
                                          <details className="mt-3 bg-slate-50 border border-line rounded-xl px-3.5 py-2.5">
                                             <summary className="text-2xs font-bold text-muted cursor-pointer select-none">Ver a conta (ingrediente por ingrediente)</summary>
                                             <div className="mt-2 space-y-1">
                                                {detalhes.map(({ ing, d }) => (
                                                   <div key={ing.chave} className="flex justify-between items-baseline text-2xs font-medium gap-2">
                                                      <span className="text-slate-600 truncate">
                                                         {ing.nome}
                                                         {d.precoSuspeito && <span className="ml-1 text-amber-600 font-bold">(confira o preço!)</span>}
                                                      </span>
                                                      <span className="shrink-0 text-muted">
                                                         {d.pesoG !== null ? fmtG(d.pesoG) : <span className="text-amber-600 font-bold">fora do peso</span>}
                                                         <span className="text-subtle"> · </span>
                                                         <span className="font-bold text-fg-soft">{fmtBRL(d.custo)}</span>
                                                      </span>
                                                   </div>
                                                ))}
                                                <div className="flex justify-between items-baseline text-2xs font-bold pt-1.5 mt-1 border-t border-line">
                                                   <span className="text-fg-soft">
                                                      TOTAL
                                                      {est.solidosG > 0 && est.liquidosMl > 0 && (
                                                         <span className="font-medium text-subtle"> (sólidos {fmtG(est.solidosG)} + líquidos {fmtG(est.liquidosMl).replace(" kg", " L").replace(" g", " ml")})</span>
                                                      )}
                                                   </span>
                                                   <span className="text-slate-800 shrink-0">{fmtG(est.totalG)} · {fmtBRL(custoTotal)}</span>
                                                </div>
                                                {foraDaSoma.length > 0 && (
                                                   <p className="text-3xs font-bold text-amber-600 pt-1">
                                                      Fora da soma de peso (o custo conta, o peso não): {foraDaSoma.map(x => x.ing.nome).join(", ")}. Cadastre o peso médio desses insumos para entrarem.
                                                   </p>
                                                )}
                                             </div>
                                          </details>
                                          </>
                                       );
                                    })()}
                                    <div className="mt-3 pt-3 border-t border-line-soft flex items-center gap-2 flex-wrap">
                                       <span className="text-2xs font-bold text-muted">Quanto custa se eu usar</span>
                                       <input type="number" step="0.01" min="0" placeholder="0" value={calcQtd} onChange={e=>setCalcQtd(e.target.value)} className="w-20 p-2 text-center bg-slate-50 border border-line rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                                       <select value={unidadeSetor === "l" ? (["l","ml"].includes(calcUn) ? calcUn : "ml") : (["g","kg"].includes(calcUn) ? calcUn : "g")} onChange={e=>setCalcUn(e.target.value)} className="p-2 bg-slate-50 border border-line rounded-lg font-bold text-slate-600 text-sm outline-none focus:border-emerald-500">
                                          {unidadeSetor === "l" ? <><option value="ml">ml</option><option value="l">L</option></> : <><option value="g">g</option><option value="kg">kg</option></>}
                                       </select>
                                       {(() => {
                                          const q = Number(calcQtd) || 0;
                                          let base = 0;
                                          if (calcUn === "g" || calcUn === "ml") base = q;
                                          else if (calcUn === "kg" || calcUn === "l") base = q * 1000;
                                          if (base <= 0) return null;
                                          return <span className="text-sm font-bold text-slate-600">? → <span className="font-black text-success">{fmtBRL(custoKg * (base / 1000))}</span></span>;
                                       })()}
                                    </div>
                                 </>
                              );
                           })()
                        ) : (
                        <>
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <label className="text-3xs font-bold text-subtle uppercase tracking-widest">Rendimento</label>
                              <input type="number" step="0.01" placeholder="Ex: 80" value={form.rendimento_porcoes} onChange={e=>{
                                 setForm({...form, rendimento_porcoes: e.target.value});
                                 setAutoSoma(false);
                              }} className="w-full p-3 mt-1 bg-slate-50 border border-line rounded-xl font-black text-slate-800 outline-none focus:border-emerald-500 text-center"/>
                           </div>
                           <div>
                              <label className="text-3xs font-bold text-subtle uppercase tracking-widest">Medido em</label>
                              <select value={unidadePadraoDepartamento(form.departamento || deptUrl)} disabled className="w-full p-3 mt-1 bg-elevated border border-line rounded-xl font-black text-fg-soft outline-none disabled:opacity-100">
                                 {unidadePadraoDepartamento(form.departamento || deptUrl) === "l" ? <option value="l">L (padrão do bar)</option> : <option value="kg">kg (padrão da cozinha)</option>}
                              </select>
                           </div>
                        </div>

                        {/* Resumo em UMA linha do que isso significa */}
                        {(() => {
                           const rendimento = Number(form.rendimento_porcoes) || 0;
                           const pesoPorcao = Number(form.peso_porcao_g) || 0;
                           const unR = String(form.rendimento_unidade || "porcao").toLowerCase();
                           const est = rendimentoPelosIngredientes(ingFicha, form.departamento || deptUrl);
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
                                 <p className="text-2xs font-bold text-muted mt-3">
                                    Os ingredientes somam <span className="text-slate-800">{est.valor.toLocaleString("pt-BR")} {({ kg: "kg", g: "g", l: "L", ml: "ml" })[est.unidade]}</span>.
                                    <button type="button" onClick={() => setForm(f => ({ ...f, rendimento_porcoes: String(est.valor), rendimento_unidade: est.unidade }))} className="ml-1.5 text-success underline hover:text-accent">Usar como rendimento</button>
                                 </p>
                              ) : null;
                           }
                           return (
                              <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                                 <p className="text-sm font-bold text-fg-soft leading-relaxed">
                                    {unR === "porcao" ? (
                                       <>
                                          Rende <span className="font-black text-fg">{rendimento} {rendimento >= 2 ? "porções" : "porção"}</span>
                                          {pesoPorcao > 0 && <> de <span className="font-black text-fg">{pesoPorcao}g</span> (Total: {fmtG(pesoTotalG)})</>}
                                       </>
                                    ) : (
                                       <>
                                          Rende <span className="font-black text-fg">{rendimento} {unR}</span>
                                          {porcoesRendidas !== null && pesoPorcao > 0 && <> = <span className="font-black text-fg">{(+porcoesRendidas.toFixed(1)).toLocaleString("pt-BR")} porções de {pesoPorcao}g</span></>}
                                       </>
                                    )}
                                    {custoPorc !== null && <> · porção custa <span className="font-black text-accent">{fmtBRL(custoPorc)}</span></>}
                                    {custoKg !== null && <> · 1 {unidadePadraoDepartamento(form.departamento || deptUrl) === "l" ? "L" : "kg"} custa <span className="font-black text-accent">{fmtBRL(custoKg)}</span></>}
                                 </p>
                                 {est && Math.abs(est.totalG - pesoTotalG) / Math.max(est.totalG, pesoTotalG) > 0.05 && (
                                    <p className="text-3xs font-medium text-subtle mt-1">
                                       Ingredientes somam {fmtG(est.totalG)} (diferença = água/perdas do preparo).
                                       <button type="button" onClick={() => setForm(f => ({ ...f, rendimento_porcoes: String(est.valor), rendimento_unidade: est.unidade }))} className="ml-1 text-success underline hover:text-accent">Usar esse valor</button>
                                    </p>
                                 )}
                              </div>
                           );
                        })()}

                        {/* Calculadora: quanto custa a quantidade que vou usar */}
                        {(() => {
                           const rendimento = Number(form.rendimento_porcoes) || 0;
                           const pesoPorcao = Number(form.peso_porcao_g) || 0;
                           const unR = String(form.rendimento_unidade || "porcao").toLowerCase();
                           const pesoTotalG = pesoTotalDaFicha(rendimento, unR, pesoPorcao);
                           if (!pesoTotalG) return null;
                           const custoKg = calcularCustoTotal(ingFicha) / (pesoTotalG / 1000);

                           const q = Number(calcQtd) || 0;
                           let gramas = 0;
                           if (calcUn === "g") gramas = q;
                           else if (calcUn === "kg") gramas = q * 1000;
                           else gramas = pesoPorcao > 0 ? q * pesoPorcao : 0;
                           const custoCalc = custoKg * (gramas / 1000);
                           const unidadesCalc = pesoPorcao > 0 ? gramas / pesoPorcao : null;

                           return (
                              <div className="mt-3 pt-3 border-t border-line-soft flex items-center gap-2 flex-wrap">
                                 <span className="text-2xs font-bold text-muted">Quanto custa se eu usar</span>
                                 <input type="number" step="0.01" min="0" placeholder="0" value={calcQtd} onChange={e=>setCalcQtd(e.target.value)} className="w-20 p-2 text-center bg-slate-50 border border-line rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                                 <select value={calcUn} onChange={e=>setCalcUn(e.target.value)} className="p-2 bg-slate-50 border border-line rounded-lg font-bold text-slate-600 text-sm outline-none focus:border-emerald-500">
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                    {pesoPorcao > 0 && <option value="un">porções</option>}
                                 </select>
                                 {gramas > 0 && (
                                    <span className="text-sm font-bold text-slate-600">
                                       ? → <span className="font-black text-success">{fmtBRL(custoCalc)}</span>
                                       <span className="text-subtle font-medium text-xs"> ({fmtG(gramas)}{unidadesCalc !== null ? ` · ${(+unidadesCalc.toFixed(1)).toLocaleString("pt-BR")} porções` : ""})</span>
                                    </span>
                                 )}
                              </div>
                           );
                        })()}
                        </>
                        )}
                     </div>

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
                           <div className="bg-card border border-line rounded-2xl p-4 shadow-sm">
                              <p className="text-3xs font-bold uppercase tracking-widest text-muted mb-3">Composição da porção{pesoPorcaoFinal > 0 ? ` (${pesoPorcaoFinal}g final)` : ''}</p>
                              <div className="space-y-2">
                                 {composicao.map((c, i) => {
                                    const pct = (c.g / baseRef) * 100;
                                    return (
                                       <div key={i}>
                                          <div className="flex justify-between text-xs font-bold text-fg-soft mb-0.5">
                                             <span className="truncate">{c.nome}</span>
                                             <span className="shrink-0 ml-2">{(+c.g.toFixed(1)).toLocaleString("pt-BR")} g · {pct.toFixed(0)}%</span>
                                          </div>
                                          <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                                             <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                              <div className="flex justify-between items-center mt-3 pt-3 border-t border-line-soft text-3xs font-bold text-muted">
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
                     {!form.eh_base && <div className="rounded-2xl border-2 border-pink-200 bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                           <div><p className="text-xs font-bold uppercase tracking-widest text-pink-700">Embalagens</p><p className="mt-1 text-xs font-medium text-muted">Selecione o que acompanha cada prato ou drink. O custo entra automaticamente no CMV.</p></div>
                           <span className="shrink-0 rounded-lg bg-pink-50 px-3 py-2 text-sm font-black text-pink-700">{fmtBRL(custoEmbalagensPorPorcao())}/porcao</span>
                        </div>
                        {embalagensEstoque.length > 0 ? <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                           {embalagensEstoque.map(emb => {
                              const selecionada = fichaEmbalagens.find(item => String(item.embalagem_id) === String(emb.id));
                              return <div key={emb.id} className={`rounded-xl border p-3 ${selecionada ? "border-pink-400 bg-pink-50" : "border-line bg-slate-50"}`}>
                                 <button type="button" onClick={() => alternarEmbalagemFicha(emb.id)} className="flex w-full items-center gap-2 text-left">
                                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${selecionada ? "bg-pink-600 text-white" : "bg-card text-subtle"}`}>{selecionada ? <CheckSquare2 size={16}/> : <Package size={16}/>}</span>
                                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{emb.nome}</strong><small className="font-bold text-muted">{fmtBRL(emb.preco_unitario)} cada · saldo {Number(emb.quantidade_atual) || 0}</small></span>
                                 </button>
                                 {selecionada && <label className="mt-2 flex items-center justify-between gap-2 border-t border-pink-200 pt-2 text-xs font-bold text-pink-800"><span>Quantidade por venda</span><input type="number" min="0.01" step="0.01" value={selecionada.qtd} onChange={e => alterarQuantidadeEmbalagem(emb.id, e.target.value)} className="h-9 w-24 rounded-lg border border-pink-300 bg-card px-2 text-right font-black outline-none" /></label>}
                              </div>;
                           })}
                        </div> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-bold text-muted">Nenhuma embalagem cadastrada neste setor.</p>}
                        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-pink-300 bg-pink-50 p-3 sm:grid-cols-[1fr_140px_auto]">
                           <input value={novaEmbalagem.nome} onChange={e => setNovaEmbalagem({ ...novaEmbalagem, nome: e.target.value })} placeholder="Nova embalagem (ex.: Marmita 500 ml)" className="h-11 min-w-0 rounded-lg border border-pink-200 bg-card px-3 text-sm font-bold outline-none focus:border-pink-500" />
                           <input value={novaEmbalagem.custo} onChange={e => setNovaEmbalagem({ ...novaEmbalagem, custo: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="Custo R$" inputMode="decimal" className="h-11 min-w-0 rounded-lg border border-pink-200 bg-card px-3 text-sm font-bold outline-none focus:border-pink-500" />
                           <button type="button" disabled={salvandoEmbalagem} onClick={cadastrarEmbalagemDaFicha} className="h-11 rounded-lg bg-pink-600 px-4 text-sm font-black text-white disabled:opacity-50">{salvandoEmbalagem ? "Salvando..." : "Cadastrar e usar"}</button>
                        </div>
                     </div>}

                     {(() => {
                        const custoTotalForm = custoTotalFormulario(ingFicha);
                        const rendForm = Number(String(form.rendimento_porcoes).replace(",", ".")) || 1;
                        const embForm = Number(String(form.custo_embalagem || "").replace(",", ".")) || 0;
                        const precoForm = Number(String(form.preco_venda || "").replace(",", ".")) || 0;
                        const taxaMaqForm = form.taxa_maquininha !== "" && form.taxa_maquininha != null
                          ? Number(String(form.taxa_maquininha).replace(",", "."))
                          : Number(paramsSis?.taxaMaquininha ?? paramsSis?.taxa_maquininha ?? 2.5);
                        const impostoForm = form.imposto_pct !== "" && form.imposto_pct != null
                          ? Number(String(form.imposto_pct).replace(",", "."))
                          : Number(paramsSis?.impostoPct ?? paramsSis?.imposto_pct ?? 4.0);

                        const finModal = calculateFichaFinanceiro({
                          custoTotalIngredientes: custoTotalForm,
                          rendimentoPorcoes: rendForm,
                          custoEmbalagemPorPorcao: embForm,
                          precoVenda: precoForm,
                          taxaMaquininhaPct: form.eh_base ? 0 : taxaMaqForm,
                          impostoPct: form.eh_base ? 0 : impostoForm,
                        });

                        const meta = Number(form.cmv_meta) || 30;
                        const sugerido = meta > 0 ? finModal.custoProdutoPorPorcao / (meta / 100) : 0;
                        const markup = finModal.precoVenda > 0 && finModal.custoProdutoPorPorcao > 0
                          ? finModal.precoVenda / finModal.custoProdutoPorPorcao
                          : null;

                        return (
                           <div id="ficha-custos" className="bg-card border-2 border-emerald-200 rounded-2xl p-4 shadow-sm scroll-mt-24">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-black uppercase tracking-widest text-emerald-800">Custos e Precificação</p>
                                <span className="text-3xs font-bold text-muted bg-slate-100 px-2.5 py-1 rounded-full">Recálculo automático</span>
                              </div>

                              {/* Entradas Editáveis da Ficha */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                 <div>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest">Rendimento (porções)</label>
                                    <input type="number" min="1" step="1" value={form.rendimento_porcoes} onChange={e => setForm({ ...form, rendimento_porcoes: e.target.value })} className="w-full p-2.5 mt-1 bg-slate-50 border border-line rounded-xl font-bold text-sm outline-none focus:border-emerald-500" />
                                 </div>
                                 <div>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest">Embalagem (R$ / porção)</label>
                                    <input type="text" inputMode="decimal" placeholder="0,00" value={form.custo_embalagem} onChange={e => setForm({ ...form, custo_embalagem: e.target.value.replace(/[^0-9.,]/g, "") })} className="w-full p-2.5 mt-1 bg-slate-50 border border-line rounded-xl font-bold text-sm outline-none focus:border-emerald-500" />
                                 </div>
                                 <div>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest">Preço de venda (R$)</label>
                                    <input type="text" inputMode="decimal" placeholder={sugerido > 0 ? sugerido.toFixed(2) : "0,00"} value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value.replace(/[^0-9.,]/g, "") })} className="w-full p-2.5 mt-1 bg-emerald-50/60 border-2 border-emerald-400/80 rounded-xl font-black text-emerald-900 text-sm outline-none focus:border-emerald-600" />
                                 </div>
                              </div>

                              {/* Configurações secundárias (CMV Meta, Taxa Maquininha, Imposto) */}
                              <div className="grid grid-cols-3 gap-2.5 mb-3 bg-slate-50/70 p-3 rounded-xl border border-line-soft">
                                 <div>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest">CMV meta (%)</label>
                                    <input type="number" min="1" max="90" value={form.cmv_meta} onChange={e => setForm({ ...form, cmv_meta: e.target.value })} className="w-full p-2 mt-1 bg-card border border-line rounded-lg font-bold text-xs outline-none focus:border-emerald-500" />
                                 </div>
                                 <div>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest">Taxa Maquininha (%)</label>
                                    <input type="text" inputMode="decimal" placeholder={String(paramsSis?.taxaMaquininha ?? 2.5)} value={form.taxa_maquininha} onChange={e => setForm({ ...form, taxa_maquininha: e.target.value.replace(/[^0-9.,]/g, "") })} className="w-full p-2 mt-1 bg-card border border-line rounded-lg font-bold text-xs outline-none focus:border-emerald-500" />
                                 </div>
                                 <div>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest">Imposto (%)</label>
                                    <input type="text" inputMode="decimal" placeholder={String(paramsSis?.impostoPct ?? 4.0)} value={form.imposto_pct} onChange={e => setForm({ ...form, imposto_pct: e.target.value.replace(/[^0-9.,]/g, "") })} className="w-full p-2 mt-1 bg-card border border-line rounded-lg font-bold text-xs outline-none focus:border-emerald-500" />
                                 </div>
                              </div>

                              {sugerido > 0 && (
                                 <button type="button" onClick={() => setForm({ ...form, preco_venda: sugerido.toFixed(2) })} className="mb-3 w-full text-left bg-emerald-50/50 border border-emerald-200 rounded-xl p-2.5 hover:bg-emerald-100/50 transition-colors flex items-center justify-between">
                                    <div>
                                       <span className="text-3xs font-bold text-emerald-800 uppercase tracking-widest block">Preço sugerido (CMV Meta {meta}%)</span>
                                       <span className="text-base font-black text-slate-800">{fmtBRL(sugerido)}</span>
                                    </div>
                                    <span className="text-2xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">Toque para usar</span>
                                 </button>
                              )}

                              {/* Quadro RESULTADO DA FICHA */}
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-3xs font-black uppercase tracking-widest text-slate-700 mb-2.5">Resultado da Ficha (Por Porção)</p>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
                                  <div className="bg-card border border-line rounded-lg p-2 text-center">
                                    <p className="text-3xs font-bold text-muted uppercase">Ingredientes</p>
                                    <p className="text-xs font-black text-slate-800">{fmtBRL(finModal.custoIngredientesPorPorcao)}</p>
                                  </div>
                                  <div className="bg-card border border-line rounded-lg p-2 text-center">
                                    <p className="text-3xs font-bold text-muted uppercase">Embalagem</p>
                                    <p className="text-xs font-black text-slate-800">{fmtBRL(finModal.custoEmbalagemPorPorcao)}</p>
                                  </div>
                                  <div className="bg-card border border-line rounded-lg p-2 text-center">
                                    <p className="text-3xs font-bold text-muted uppercase">Maquininha ({finModal.taxaMaquininhaPct}%)</p>
                                    <p className="text-xs font-black text-slate-800">{finModal.precoVenda > 0 ? fmtBRL(finModal.valorMaquininha) : "—"}</p>
                                  </div>
                                  <div className="bg-card border border-line rounded-lg p-2 text-center">
                                    <p className="text-3xs font-bold text-muted uppercase">Imposto ({finModal.impostoPct}%)</p>
                                    <p className="text-xs font-black text-slate-800">{finModal.precoVenda > 0 ? fmtBRL(finModal.valorImposto) : "—"}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div className="bg-card border border-emerald-200 rounded-lg p-2 text-center">
                                    <p className="text-3xs font-bold text-muted uppercase">Custo Total</p>
                                    <p className="text-sm font-black text-slate-900">{fmtBRL(finModal.custoTotal)}</p>
                                  </div>
                                  <div className="bg-card border border-emerald-200 rounded-lg p-2 text-center">
                                    <p className="text-3xs font-bold text-muted uppercase">Preço Venda</p>
                                    <p className="text-sm font-black text-emerald-700">{finModal.precoVenda > 0 ? fmtBRL(finModal.precoVenda) : "—"}</p>
                                  </div>
                                  <div className={`bg-card border rounded-lg p-2 text-center ${finModal.lucroPorPorcao !== null && finModal.lucroPorPorcao < 0 ? 'border-red-300 bg-red-50' : 'border-emerald-200'}`}>
                                    <p className="text-3xs font-bold text-muted uppercase">Lucro/porção</p>
                                    <p className={`text-sm font-black ${finModal.lucroPorPorcao !== null && finModal.lucroPorPorcao < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                      {finModal.lucroPorPorcao !== null ? fmtBRL(finModal.lucroPorPorcao) : "—"}
                                    </p>
                                  </div>
                                  <div className={`bg-card border rounded-lg p-2 text-center ${finModal.cmv !== null && finModal.cmv > meta ? 'border-red-300 bg-red-50' : 'border-emerald-200'}`}>
                                    <p className="text-3xs font-bold text-muted uppercase">CMV</p>
                                    <p className={`text-sm font-black ${finModal.cmv !== null && finModal.cmv > meta ? 'text-red-600' : 'text-emerald-700'}`}>
                                      {finModal.cmv !== null ? `${finModal.cmv.toFixed(1)}%` : "—"}
                                    </p>
                                    {finModal.margem !== null && (
                                      <span className="text-3xs font-bold text-subtle block">Margem {finModal.margem.toFixed(1)}%</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                           </div>
                        );
                     })()

                     {form.eh_base && <div id="ficha-preparo" className="scroll-mt-24 rounded-2xl border border-line bg-card p-4 shadow-sm">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest">Modo de Preparo</label>

                        {/* Assistente de IA: você explica solto, a IA estrutura em etapas */}
                        <div className="mt-1 mb-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                           <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={15} className="text-success" />
                              <span className="text-2xs font-bold uppercase tracking-widest text-accent">Explique com suas palavras — a IA organiza</span>
                           </div>
                           <textarea
                              placeholder="Ex: refogo a cebola no azeite numa panela, junto o camarão, deixo uns 5 min, jogo o leite de coco e o tucupi e cozinho até engrossar..."
                              value={iaExplicacao}
                              onChange={e => setIaExplicacao(e.target.value)}
                              className="w-full h-20 p-3 bg-card border border-emerald-200 rounded-lg text-sm font-medium text-fg-soft outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                           <button
                              type="button"
                              onClick={gerarPreparoIA}
                              disabled={iaLoading}
                              className="mt-2 w-full py-2.5 bg-accent hover:bg-accent disabled:opacity-50 text-accent-fg font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                           >
                              {iaLoading
                                 ? <><Loader2 size={16} className="animate-spin" /> Estruturando etapas...</>
                                 : <><Sparkles size={16} /> Gerar modo de preparo</>}
                           </button>
                           <p className="text-3xs text-emerald-700/70 font-medium mt-1.5 leading-tight">A IA deduz panela, se vai ao fogo, o tempo de cada etapa e o tempo total. Você pode editar o texto depois.</p>
                        </div>

                        <textarea placeholder="Passo a passo da execução..." value={form.modo_preparo} onChange={e=>setForm({...form, modo_preparo: e.target.value})} className="w-full h-52 p-4 mt-1 bg-card border border-line rounded-xl font-medium text-fg-soft outline-none focus:border-emerald-500 shadow-sm resize-y"></textarea>
                     </div>}

                     {/* Só drink pronto tem método: xarope e infusão não se batem nem se mexem. */}
                     {form.departamento === "bar" && !form.eh_base && (
                        <div>
                           <label className="text-xs font-bold text-muted uppercase tracking-widest">Método de preparo</label>
                           <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                              {METODOS_BAR.map(metodo => {
                                 const ativo = form.metodo_bar === metodo.id;
                                 return (
                                    <button key={metodo.id} type="button"
                                       onClick={() => setForm({ ...form, metodo_bar: ativo ? "" : metodo.id })}
                                       className={`rounded-xl border-2 p-3 text-left transition ${ativo ? "border-emerald-500 bg-emerald-50" : "border-line bg-card hover:border-emerald-300"}`}>
                                       <span className={`block text-sm font-black ${ativo ? "text-accent" : "text-fg-soft"}`}>{metodo.nome}</span>
                                       <span className="mt-0.5 block text-2xs font-semibold text-muted">{metodo.ajuda}</span>
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     )}

                  </div>


               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-3 sm:p-4 border-t border-line-soft bg-card flex flex-col sm:flex-row gap-3">
                  <button
                     type="button"
                     onMouseDown={e => e.preventDefault()}
                     onClick={() => handleSalvar(false)}
                     disabled={salvandoFicha}
                     className="flex-1 py-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                     {salvandoFicha ? (
                        <><Loader2 size={20} className="animate-spin" /> Salvando alterações...</>
                     ) : (
                        <><Save size={20}/> {form.id ? "Salvar alterações" : form.produto_pronto ? "Salvar produto pronto" : `Salvar ficha (${fmtBRL(custoTotalFormulario(ingFicha))})`}</>
                     )}
                  </button>
                  {!form.id && (
                     <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleSalvar(true)}
                        disabled={salvandoFicha}
                        className="sm:w-56 py-5 bg-card border-2 border-slate-300 hover:border-slate-900 disabled:opacity-50 text-slate-800 font-black text-base rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                     >
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
            <div className="bg-card rounded-[28px] w-full max-w-lg max-h-[88vh] p-6 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between mb-1">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calculator size={20} className="text-success" /> Simular rendimento</h2>
                  <button onClick={() => setModalSim(null)} className="w-9 h-9 bg-elevated rounded-full flex items-center justify-center text-muted hover:bg-slate-200"><X size={17} /></button>
               </div>
               <p className="text-sm font-bold text-fg-soft">{modalSim.nome_receita}</p>
               <p className="text-xs font-medium text-muted mb-4">Receita original rende <b>{(+original).toLocaleString("pt-BR")} {unLabel}</b>. Escolha o quanto quer produzir e os ingredientes se ajustam.</p>

               <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                     <label className="text-3xs font-bold text-subtle uppercase tracking-widest block mb-1">Quero produzir</label>
                     <div className="flex bg-slate-50 border border-line rounded-xl overflow-hidden focus-within:border-emerald-500">
                        <input type="text" inputMode="decimal" value={simAlvo} onChange={e => setSimAlvo(e.target.value.replace(/[^0-9.,]/g, ""))} className="w-full p-3 text-center bg-transparent font-black text-lg text-fg-soft outline-none" />
                        <div className="flex items-center justify-center px-3 bg-elevated border-l border-line text-sm font-bold text-muted shrink-0">{unLabel}</div>
                     </div>
                  </div>
                  <div className="text-center">
                     <p className="text-3xs font-bold text-subtle uppercase tracking-widest">Fator</p>
                     <p className="text-lg font-black text-success">{factor > 0 ? `${(+factor.toFixed(3)).toLocaleString("pt-BR")}×` : "—"}</p>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto -mx-1 px-1">
                  <div className="rounded-xl border border-line overflow-hidden">
                     <div className="bg-slate-50 px-4 py-2 grid grid-cols-[1fr_auto] text-3xs font-bold uppercase tracking-widest text-subtle border-b border-line">
                        <span>Ingrediente</span><span>Quantidade</span>
                     </div>
                     {linhas.length === 0 ? (
                        <p className="p-4 text-sm text-subtle font-medium">Esta ficha não tem ingredientes cadastrados.</p>
                     ) : linhas.map((l, i) => (
                        <div key={i} className="px-4 py-2.5 grid grid-cols-[1fr_auto] items-center border-b border-slate-50 last:border-0">
                           <span className="font-bold text-fg-soft text-sm truncate">{l.nome}</span>
                           <span className="font-black text-slate-800 text-sm">{l.qtdFmt}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="flex items-center justify-between mt-4 mb-3 px-1">
                  <span className="text-xs font-bold text-muted uppercase tracking-widest">Custo desta produção</span>
                  <span className="text-xl font-black text-success">{fmtBRL(custoSim)}</span>
               </div>
               <div className="flex gap-3">
                  <button onClick={() => setModalSim(null)} className="flex-1 py-3 rounded-xl font-bold bg-elevated text-fg-soft hover:bg-slate-200">Fechar</button>
                  <button onClick={() => imprimirSimulacao(modalSim, factor, alvoTxt)} disabled={!(factor > 0)} className="flex-1 py-3 rounded-xl font-black bg-accent text-accent-fg hover:bg-accent disabled:opacity-40 flex items-center justify-center gap-2"><Printer size={16} /> Imprimir</button>
               </div>
            </div>
         </div>
         );
      })()}

      {/* REMOVER / SUBSTITUIR INGREDIENTE DA FICHA */}
      {substituirAlvo && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={fecharSubstituicao}>
            <div className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between mb-1">
                  <h3 className="text-xl font-black text-slate-800">Remover “{substituirAlvo.nome}”</h3>
                  <button onClick={fecharSubstituicao} className="text-subtle hover:text-slate-600 p-1"><X size={20}/></button>
               </div>
               <p className="text-sm font-medium text-muted mb-4">Quer substituir por outro ingrediente cadastrado ou só remover?</p>

               <label className="text-3xs font-bold uppercase tracking-widest text-subtle">Substituir por (opcional)</label>
               <select value={substitutoValor} onChange={e => setSubstitutoValor(e.target.value)} className="w-full mt-1 mb-4 p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-600 outline-none focus:border-emerald-500 text-sm">
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
                  <button onClick={soRemover} className="flex-1 py-3 rounded-xl font-bold bg-elevated text-fg-soft hover:bg-slate-200 transition-colors">Não, só remover</button>
                  <button onClick={confirmarSubstituicao} disabled={!substitutoValor} className="flex-1 py-3 rounded-xl font-black bg-accent text-accent-fg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Substituir</button>
               </div>
            </div>
         </div>
      )}

      {/* MONTAR FICHA COM IA (texto/foto da receita) */}
      {modalIAFicha && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
             <div className="bg-card rounded-3xl sm:rounded-[32px] w-full max-w-3xl my-2 sm:my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]">
               <div className="flex justify-between items-center gap-3 p-4 sm:p-8 pb-4 sm:pb-6 border-b border-line-soft shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-accent-soft text-accent-strong flex items-center justify-center"><Sparkles size={22}/></div>
                     <div>
                         <h2 className="font-black text-xl sm:text-2xl text-slate-800">Montar Ficha Técnica com IA</h2>
                        <p className="text-xs font-bold text-muted mt-0.5">Cole a receita ou envie uma foto — a IA monta nome, ingredientes e modo de preparo</p>
                     </div>
                  </div>
                  <button onClick={() => setModalIAFicha(false)} className="w-10 h-10 bg-elevated rounded-full flex items-center justify-center text-muted hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar space-y-5">
                  {!iaFResultado ? (
                     <>
                        <div>
                           <label className="text-xs font-bold text-muted uppercase tracking-widest">Colar a receita (opcional se enviar foto)</label>
                           <textarea
                              placeholder={"Ex:\nTacacá: refogo camarão seco no azeite, junto tucupi e goma, cozinho 15 min mexendo, sirvo com jambu e pimenta..."}
                              value={iaFTexto}
                              onChange={e => setIaFTexto(e.target.value)}
                              className="w-full h-32 p-4 mt-1 bg-slate-50 border border-line rounded-xl font-medium text-fg-soft outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-muted uppercase tracking-widest">Ou enviar foto (caderno de receitas, print, etc)</label>
                           <input ref={fileInputFichaRef} type="file" accept="image/*" onChange={handleSelecionarImagemFicha} className="hidden" />
                           {iaFImagem ? (
                              <div className="mt-1 flex items-center gap-3 bg-slate-50 border border-line rounded-xl p-3">
                                 <img src={iaFImagem.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-line" />
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-fg-soft truncate">{iaFImagem.nomeArquivo}</p>
                                    <button onClick={() => setIaFImagem(null)} className="text-xs font-bold text-red-500 hover:text-red-600 mt-1">Remover foto</button>
                                 </div>
                              </div>
                           ) : (
                              <button type="button" onClick={() => fileInputFichaRef.current?.click()} className="w-full mt-1 p-6 bg-slate-50 border-2 border-dashed border-line rounded-xl flex flex-col items-center gap-2 text-subtle hover:text-success hover:border-emerald-300 transition-colors">
                                 <Camera size={24} />
                                 <span className="font-bold text-sm">Tirar foto ou escolher da galeria</span>
                              </button>
                           )}
                        </div>

                        <button
                           onClick={gerarFichaIA}
                           disabled={iaFLoading}
                           className="w-full py-4 bg-accent hover:bg-accent disabled:opacity-50 text-accent-fg font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                           {iaFLoading ? <><Loader2 size={18} className="animate-spin"/> Montando ficha técnica...</> : <><Sparkles size={18}/> Montar ficha técnica</>}
                        </button>
                     </>
                  ) : (
                     <>
                        <div className="bg-slate-50 border border-line rounded-xl p-4">
                           <label className="text-3xs font-bold text-muted uppercase tracking-widest">Nome do prato (vai pro cardápio)</label>
                           <input type="text" value={iaFResultado.nome_receita} onChange={e=>setIaFResultado({...iaFResultado, nome_receita: e.target.value})} className="w-full p-3 mt-1 bg-card border border-line rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500" />
                           {(() => {
                               const pesoIA = rendimentoPelosIngredientes(
                                  iaFResultado.itens.map(it => {
                                     const ins = insumosAtivos.find(i => i.id === it.vinculoId);
                                     return { unidade: it.unidade_lida, quantidade: it.quantidade_lida, peso_medio_g: ins?.peso_medio_g || null };
                                  }),
                                  deptUrl,
                               );
                              if (pesoIA) return (
                                 <>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest mt-3 block">Rendimento (peso total)</label>
                                    <div className="mt-1 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                       <span className="font-black text-accent text-lg">{pesoIA.valor.toLocaleString("pt-BR")} {pesoIA.unidade}</span>
                                       <span className="block text-3xs font-bold text-emerald-600/80 mt-0.5">Somado automaticamente dos ingredientes. Você pode ajustar na ficha (perdas do cozimento).</span>
                                    </div>
                                 </>
                              );
                              return (
                                 <>
                                    <label className="text-3xs font-bold text-muted uppercase tracking-widest mt-3 block">Rendimento (porções)</label>
                                    <input type="number" value={iaFResultado.rendimento_porcoes} onChange={e=>setIaFResultado({...iaFResultado, rendimento_porcoes: e.target.value})} className="w-24 p-3 mt-1 bg-card border border-line rounded-lg font-bold text-slate-800 outline-none focus:border-emerald-500" />
                                    <span className="block text-3xs font-medium text-subtle mt-1">Ingredientes em unidades (sem peso) — informe as porções manualmente.</span>
                                 </>
                              );
                           })()}
                        </div>

                        <div>
                           <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Ingredientes identificados</p>
                           <div className="space-y-2">
                              {iaFResultado.itens.map((it, idx) => {
                                 const vinculado = it.vinculoId !== "novo";
                                 return (
                                    <div key={idx} className={`p-3 rounded-xl border ${vinculado ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                       <div className="flex items-center gap-2 flex-wrap">
                                          {vinculado ? <CheckCircle2 size={16} className="text-success shrink-0"/> : <AlertTriangle size={16} className="text-amber-600 shrink-0"/>}
                                          <span className="font-bold text-slate-800 text-sm">{it.nomeOriginal}</span>
                                          <span className="text-xs font-bold text-subtle">({it.quantidade_lida}{it.unidade_lida})</span>
                                          <select
                                             value={it.vinculoId}
                                             onChange={e => atualizarItemIAFicha(idx, { vinculoId: e.target.value })}
                                             className="ml-auto p-2 bg-card border border-line rounded-lg font-bold text-xs outline-none focus:border-emerald-500"
                                          >
                                             <option value="novo">-- Cadastrar novo --</option>
                                             {insumosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                                          </select>
                                       </div>

                                       {!vinculado && (
                                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                                             <input type="text" placeholder="Marca (opcional)" value={it.novo.marca} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, marca: e.target.value } })} className="w-32 p-2 bg-card border border-line rounded-lg text-xs outline-none focus:border-emerald-500" />
                                             <select value={it.novo.unidade_medida} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, unidade_medida: e.target.value } })} className="w-20 p-2 bg-card border border-line rounded-lg font-bold text-xs outline-none focus:border-emerald-500">
                                                <option value="kg">KG</option>
                                                <option value="l">L</option>
                                                <option value="un">UN</option>
                                                <option value="g">G</option>
                                                <option value="ml">ML</option>
                                             </select>
                                             <input type="number" step="0.01" placeholder="Custo/base" value={it.novo.custo_unitario} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, custo_unitario: e.target.value } })} className="w-24 p-2 bg-accent-soft border border-emerald-200 rounded-lg font-bold text-accent-strong text-xs outline-none focus:border-emerald-500" />
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
                           <label className="text-xs font-bold text-muted uppercase tracking-widest">Modo de preparo (editável)</label>
                           <textarea value={iaFResultado.modo_preparo} onChange={e=>setIaFResultado({...iaFResultado, modo_preparo: e.target.value})} className="w-full h-32 p-4 mt-1 bg-slate-50 border border-line rounded-xl font-medium text-fg-soft text-sm outline-none focus:border-emerald-500 resize-none"></textarea>
                        </div>

                        <button onClick={() => setIaFResultado(null)} className="text-xs font-bold text-muted hover:text-fg-soft">← Voltar e enviar outra receita/foto</button>
                     </>
                  )}
               </div>

               {iaFResultado && (
                  <div className="p-4 sm:p-8 sm:pt-4 border-t border-line-soft bg-slate-50 rounded-b-[32px] shrink-0">
                     <button onClick={usarFichaIA} className="w-full py-5 bg-accent hover:bg-accent text-accent-fg font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
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
    <Suspense fallback={<div className="p-10 text-center font-bold text-muted">Carregando módulo...</div>}>
       <FichasRunner />
    </Suspense>
  );
}
