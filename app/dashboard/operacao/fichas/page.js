"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  atualizarOrdemFicha, excluirFichasLote, fetchFichas, fetchInsumos,
  inativarFichasLote, registrarAuditoriaFichas, removerFicha, salvarFicha,
  salvarInsumo, verificarDependenciasFichas,
} from "../../../lib/operacao";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchMontagens, inserirMontagem } from "../../../lib/montagem";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BookOpen, Calculator, Camera,
  CheckCircle2, CheckSquare2, ChevronLeft, ChevronRight, Copy, Download, Edit3,
  FileDown, GripVertical, LayoutList, Loader2, Package, Plus, Printer, Save,
  Search, ShieldAlert, Sparkles, Trash2, UtensilsCrossed, Wine, X,
  Clock, Thermometer, MoreVertical,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { logoSeldeestrelaSVG } from "../../../lib/marca";
import { baixarPdfDeHtml } from "../../../lib/pdf";
import { fetchHistoricoCustoFicha, registrarCustoFicha } from "../../../lib/ficha-custos";
import {
  estimarPaginasDocumento,
  ordenarFichasDocumento,
  separarFichasPorDependencias,
} from "../../../lib/fichas-lote-utils.mjs";
import RecipeWorkspace from "../../../components/RecipeWorkspace";

// Botão "Fechar" + fechamento automático após imprimir — no celular a aba de
// impressão ficava presa e o usuário não conseguia voltar ao app.
function comFecharImpressao(html) {
  const extra = `
    <style>@media print{.__fechar-imp{display:none!important}}</style>
    <button class="__fechar-imp" onclick="window.close()" style="position:fixed;top:10px;right:10px;z-index:2147483647;padding:12px 18px;font:700 15px sans-serif;background:#0f172a;color:#fff;border:0;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer">✕ Fechar</button>
    <script>window.onafterprint=function(){setTimeout(function(){try{window.close()}catch(e){}},200)}<\/script>`;
  return html.includes("</body>") ? html.replace("</body>", extra + "</body>") : html + extra;
}

// Categorias do cardápio (cozinha). Os pratos são divididos nessas seções.
const CATEGORIAS_CARDAPIO = [
  "Entradas", "Executivo", "Moquecas e Caldeirada", "Vatapá", "Maniçoba",
  "Menu Degustação", "Sobremesas", "Sucos",
];

const CATEGORIAS_PRODUTO_PRONTO_BAR = [
  "Cervejas", "Águas", "Refrigerantes", "Energéticos", "Vinhos",
  "Espumantes", "Destilados", "Sucos prontos", "Outros produtos prontos",
];

const CATEGORIAS_PREPARO_BAR = [
  "Xaropes", "Espumas", "Geleias", "Mixes e infusões", "Outros pré-preparos",
];

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

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
// guard evita loop infinito se alguém criar uma referência circular.
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    // Fator de correção (%) do item: a quantidade BRUTA (líquida × 1+fc) é a que custa
    const fc = 1 + (Number(fi.fator_correcao) || 0) / 100;
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0) * fc;
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0) * fc;
    }
  });
  return total;
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
    // "un" sem peso médio cadastrado: continua de fora
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
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  const [fichaView, setFichaView] = useState(null); // ficha aberta em modo visualização (igual à foto)
  const [simPesoView, setSimPesoView] = useState(""); // simulador de porções da tela de visualização
  const [viewTab, setViewTab] = useState("ficha"); // aba ativa na tela de visualização
  const [histCustos, setHistCustos] = useState([]); // histórico de custos da ficha aberta
  const [histStatus, setHistStatus] = useState("idle"); // idle | carregando | ok | sem_tabela
  const [registrandoCusto, setRegistrandoCusto] = useState(false);
  const [semeandoCustos, setSemeandoCustos] = useState(false);
  const [iaExplicacao, setIaExplicacao] = useState("");
  const [autoSoma, setAutoSoma] = useState(true);

  const [selecionadas, setSelecionadas] = useState([]);
  const [dragId, setDragId] = useState(null); // arrastar para reordenar
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(12);
  const [modalImpressao, setModalImpressao] = useState(null);
  const [configImpressao, setConfigImpressao] = useState(null);
  const [ordemPersonalizada, setOrdemPersonalizada] = useState([]);
  const [modalExclusao, setModalExclusao] = useState(false);
  const [dependenciasExclusao, setDependenciasExclusao] = useState(null);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [mensagemLote, setMensagemLote] = useState("");

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
    const [resFichas, resInsumos, resProd, resMontagens] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, deptUrl),
       fetchProdutos(unidadeAtiva),
       fetchMontagens(unidadeAtiva, deptUrl),
    ]);
    setFichas(resFichas.data || []);
    setInsumosAtivos(resInsumos.data || []);
    setProdutos(resProd.data || []);
    setMontagens(resMontagens.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

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
  const [tipoFiltro, setTipoFiltro] = useState("Pratos");
  const ordenarFichas = (a, b) => {
    const oa = a.ordem ?? 1e9, ob = b.ordem ?? 1e9;
    if (oa !== ob) return oa - ob;
    return a.nome_receita.localeCompare(b.nome_receita, "pt-BR");
  };
  const passaFiltro = (f) => {
    if (tipoFiltro === "Todos") return true;
    if (tipoFiltro === "Pré-preparos") return !!f.eh_base && f.tipo_base !== "receita";
    if (tipoFiltro === "Receitas base") return !!f.eh_base && f.tipo_base === "receita";
    if (tipoFiltro === "Produtos prontos") return !f.eh_base && f.tipo_base === "produto_pronto";
    if (tipoFiltro === "Pratos") return !f.eh_base && f.tipo_base !== "produto_pronto";
    if (CATEGORIAS_PREPARO_BAR.includes(tipoFiltro)) return !!f.eh_base && f.tipo_base !== "receita" && categoriaPreparoBar(f) === tipoFiltro;
    return !f.eh_base && (f.categoria || "") === tipoFiltro; // categoria específica
  };
  const filtradas = fichas
    .filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()) && passaFiltro(f))
    .sort(ordenarFichas);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const fichasPagina = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);
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
    setForm({ id: null, departamento: deptUrl, nome_receita: "", categoria: "", rendimento_porcoes: "1", modo_preparo: "", eh_base: false, produto_pronto: false, tipo_base: null, rendimento_unidade: "porcao", peso_porcao_g: "", imagem: "", tempo_preparo: "", validade_dias: "", observacoes: "", preco_venda: "", cmv_meta: 30 });
    setIngFicha([]);
    setAutoSoma(true);
    setCalcQtd("");
    setIaExplicacao("");
    setModalNovo(true);
  };

  const abrirEditar = (ficha) => {
    setAutoSoma(false);
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
       observacoes: ficha.observacoes || "",
       cmv_meta: ficha.cmv_meta != null ? Number(ficha.cmv_meta) : 30,
       preco_venda: (() => {
          const prod = produtos.find(x => x.ficha_id === ficha.id || String(x.nome_produto || "").toLowerCase() === String(ficha.nome_receita || "").toLowerCase());
          return prod && Number(prod.preco_venda) > 0 ? String(prod.preco_venda) : "";
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
       return {
          chave: fi.insumos.id, tipo: "insumo", insumo_id: fi.insumos.id,
          nome: fi.insumos.nome, unidade: fi.insumos.unidade_medida,
          custo_unitario: fi.insumos.custo_unitario, quantidade: fi.quantidade,
          fator: Number(fi.fator_correcao) || 0,
          peso_medio_g: fi.insumos.peso_medio_g || null,
          modo: getSub(fi.insumos.unidade_medida) ? "sub" : "base",
       };
    });
    setIngFicha(mapIng);
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
    return ingredientesLista.reduce((acc, ing) => acc + (ing.custo_unitario * ing.quantidade * (1 + (Number(ing.fator) || 0) / 100)), 0);
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
    const insumoDb = insumosAtivos.find(i => i.id === id);
    if (!insumoDb) return null;
    return {
       chave: insumoDb.id, tipo: "insumo", insumo_id: insumoDb.id,
       nome: insumoDb.nome, unidade: insumoDb.unidade_medida,
       custo_unitario: insumoDb.custo_unitario, quantidade,
       peso_medio_g: insumoDb.peso_medio_g || null,
       modo: getSub(insumoDb.unidade_medida) ? "sub" : "base",
    };
  };

  const addIngrediente = (valor) => {
    if (!valor) return;
    const [, id] = valor.split(":");
    if (ingFicha.find(i => i.chave === id)) return; // já existe
    const novo = construirIng(valor, 0);
    if (!novo) return;
    setAutoSoma(true);
    setIngFicha([...ingFicha, novo]);
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
          categoria: form.eh_base && form.departamento !== "bar" ? null : (form.categoria || null),
          rendimento_porcoes: Number(form.rendimento_porcoes),
          modo_preparo: form.modo_preparo,
          eh_base: !!form.eh_base,
          tipo_base: form.produto_pronto ? "produto_pronto" : (form.eh_base ? (form.tipo_base || "pre") : null),
          cmv_meta: form.cmv_meta != null && form.cmv_meta !== "" ? Number(form.cmv_meta) : 30,
          rendimento_unidade: form.rendimento_unidade || "porcao",
          peso_porcao_g: form.peso_porcao_g ? Number(form.peso_porcao_g) : null,
          imagem: form.imagem || null,
          tempo_preparo: form.tempo_preparo ? Number(form.tempo_preparo) : null,
          validade_dias: form.validade_dias ? Number(form.validade_dias) : null,
          observacoes: form.observacoes || null
       },
       ingValidos.map(i => ({
          insumo_id: i.tipo === "insumo" ? i.insumo_id : null,
          subficha_id: i.tipo === "base" ? i.subficha_id : null,
          quantidade: i.quantidade,
          fator_correcao: Number(i.fator) || 0
       }))
    );

    if(erro.error) return alert("Erro ao salvar: " + erro.error);

    if (!criarOutra) setModalNovo(false);
    carregar();

    // Registra um retrato do custo no histórico (não bloqueia o salvar).
    const fichaIdHist = erro.id;
    if (fichaIdHist && !form.produto_pronto) {
      const custoTotalS = calcularCustoTotal(ingValidos);
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
        if (prodExistente && Math.abs((Number(prodExistente.preco_venda) || 0) - precoVendaNum) > 0.004) {
          await salvarProduto({ id: prodExistente.id, preco_venda: precoVendaNum });
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
          });
        }

        // 2) Guia de Montagem: entra como ficha pendente de montagem
        if (!form.produto_pronto) {
          const { data: monts } = await fetchMontagens(unidadeAtiva, form.departamento);
          const jaTemMontagem = (monts || []).some(m => (m.nome || "").toLowerCase() === nome.toLowerCase());
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

    // "Salvar e criar outra": limpa o formulário e continua no modal
    if (criarOutra) {
      setForm({ id: null, departamento: form.departamento, nome_receita: "", categoria: "", rendimento_porcoes: "1", modo_preparo: "", eh_base: false, produto_pronto: false, tipo_base: null, rendimento_unidade: "porcao", peso_porcao_g: "", imagem: "", tempo_preparo: "", validade_dias: "", observacoes: "", preco_venda: "", cmv_meta: 30 });
      setIngFicha([]);
      setAutoSoma(true);
      setIaExplicacao("");
    }
  };

  const handleRemover = async (id) => {
    if(confirm("Deseja excluir esta ficha técnica permanentemente?")) {
       await removerFicha(id);
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

  const abrirExclusaoSegura = async (lista = fichasSelecionadas) => {
    if (!lista.length) return;
    setProcessandoLote(true);
    setMensagemLote("");
    setDependenciasExclusao(null);
    setModalExclusao({ lista });
    const resposta = await verificarDependenciasFichas(lista, unidadeAtiva);
    setDependenciasExclusao(resposta);
    setProcessandoLote(false);
  };

  const concluirExclusaoLote = async (modo) => {
    const alvo = modalExclusao?.lista || [];
    const { vinculadas, livres } = separarFichasPorDependencias(alvo, dependenciasExclusao);
    const verificacaoIncompleta = dependenciasExclusao?.avisos?.length > 0;
    const lista = modo === "livres" ? livres : modo === "inativar" ? (verificacaoIncompleta ? alvo : vinculadas) : alvo;
    if (!lista.length) return;
    setProcessandoLote(true);
    const resposta = modo === "inativar"
      ? await inativarFichasLote(lista, usuarioAuditoria)
      : await excluirFichasLote(lista, usuarioAuditoria);
    setProcessandoLote(false);
    if (resposta.error) return setMensagemLote(resposta.error);
    setSelecionadas(prev => prev.filter(id => !lista.some(f => f.id === id)));
    setMensagemLote(`${lista.length} ficha(s) ${modo === "inativar" ? "inativada(s)" : "excluída(s)"} com registro no histórico.`);
    await carregar();
    window.setTimeout(() => {
      setModalExclusao(false);
      setMensagemLote("");
    }, 1400);
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
      const labelUnPrint = { porcao: `porç${rende > 1 ? 'ões' : 'ão'}`, kg: 'kg', g: 'g', l: 'L', ml: 'ml', un: 'un' }[unR] || unR;
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
                     ${incluir("atualizacao") ? `<div class="campo"><b>Data de criação:</b> ${fmtDataBR(f.created_at)}</div>
                     <div class="campo"><b>Última atualização:</b> ${fmtDataBR(f.updated_at)}</div>` : ""}
                     ${incluir("responsaveis") && f.responsavel ? `<div class="campo full"><b>Responsável:</b> ${esc(f.responsavel)}</div>` : ""}
                     ${incluir("observacoes") && f.observacoes ? `<div class="campo full"><b>Observações:</b> ${esc(f.observacoes)}</div>` : ''}
                  </div>
               </div>
            </div>

            <h2>Rendimento</h2>
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
          departamento: item.categoria === "Drink" ? "bar" : (deptUrl || "cozinha"),
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
      <RecipeWorkspace
        active="fichas"
        dept={deptUrl}
        title={deptUrl === "bar" ? "Fichas técnicas do Bar" : "Fichas técnicas da Cozinha"}
        description={deptUrl === "bar"
          ? "Organize drinks, bases, dosagens, custos e margem em um receituário conectado ao guia de montagem."
          : "Transforme ingredientes em receitas padronizadas, acompanhe custo, rendimento, CMV e envie o resultado para a montagem."}
        total={fichas.length}
        onPrimary={abrirNova}
        primaryLabel="Nova ficha"
      >
               <button onClick={() => {
                     if (!fichas.length) return alert("Nenhuma ficha para o livro.");
                     abrirPreviaImpressao("livro", fichas);
                  }}
                  title="Livro completo: capa, índice, páginas numeradas e seções (pré-preparos, preparos, molhos, pratos, sobremesas, sucos)"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
                  <Printer size={17} /> Livro de receitas
               </button>
               <button onClick={() => {
                     if (!fichas.length) return alert("Nenhuma ficha para o livro.");
                     abrirPreviaImpressao("pdf", fichas);
                  }}
                  title="Baixar o Livro de Receitas completo em PDF"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
                  <Download size={17} /> Baixar PDF
               </button>
               <button onClick={imprimirPlanilhaCustos} title="Tabela com custo, preço de venda, CMV de cada receita e o CMV médio" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
                  <Calculator size={17} /> Custos e CMV
               </button>
               <button onClick={registrarCustoTodasFichas} disabled={semeandoCustos} title="Registra o custo atual de todas as fichas no histórico (primeiro ponto)" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-60">
                  {semeandoCustos ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} {semeandoCustos ? "Registrando..." : "Registrar custos"}
               </button>
               <input ref={inputCardapioRef} type="file" accept="image/*" multiple onChange={importarCardapioFoto} className="hidden" />
               <button onClick={() => inputCardapioRef.current?.click()} disabled={importandoCardapio} title="Envie a foto do cardápio para criar fichas" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-60">
                  {importandoCardapio ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />} Importar cardápio
               </button>
               <button onClick={abrirModalIAFicha} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
                  <Sparkles size={17} /> Criar com IA
               </button>
      </RecipeWorkspace>

      <div className="max-w-7xl mx-auto px-3 sm:px-5 mt-5 sm:mt-6">
         {/* Kanban de indicadores: CMV médio, margem, custo, ticket */}
         {(() => {
            const base = fichas.filter(f => !f.eh_base && f.tipo_base !== "produto_pronto");
            if (!base.length) return null;
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
            const cmvMedio = nCmv ? somaCmv / nCmv : null;
            const cards = [
               { rot: "Fichas", val: base.length, sub: "pratos/receitas" },
               { rot: "CMV médio", val: cmvMedio != null ? cmvMedio.toFixed(1) + "%" : "—", sub: `${nCmv} precificadas`, alerta: cmvMedio != null && cmvMedio > 35 },
               { rot: "Margem média", val: nCmv ? (somaMargem / nCmv).toFixed(1) + "%" : "—", sub: "bruta" },
               { rot: "Custo médio/porção", val: nCusto ? fmtBRL(somaCusto / nCusto) : "—", sub: "por porção" },
               { rot: "Ticket médio", val: nPreco ? fmtBRL(somaPreco / nPreco) : "—", sub: "preço de venda" },
               { rot: "Acima da meta", val: acimaMeta, sub: semPreco ? `${semPreco} sem preço` : "CMV alto", alerta: acimaMeta > 0 },
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
         {/* Abas: Pratos + categorias do cardápio + Pré-preparos + Todos */}
         <div className="flex flex-wrap gap-2 mb-4">
            {[
              ["Pratos", deptUrl === "bar" ? "Drinks" : "Pratos", fichas.filter(f => !f.eh_base && f.tipo_base !== "produto_pronto").length],
              ...(deptUrl === "bar" ? [["Produtos prontos", "Produtos prontos", fichas.filter(f => !f.eh_base && f.tipo_base === "produto_pronto").length]] : []),
              ...(deptUrl === "bar" ? CATEGORIAS_PREPARO_BAR.map(c => [c, c, fichas.filter(f => !!f.eh_base && f.tipo_base !== "receita" && categoriaPreparoBar(f) === c).length]) : []),
              ...(deptUrl === "bar" ? [] : CATEGORIAS_CARDAPIO.map(c => [c, c, fichas.filter(f => !f.eh_base && (f.categoria || "") === c).length])),
              ["Pré-preparos", "Pré-preparos", fichas.filter(f => !!f.eh_base && f.tipo_base !== "receita").length],
              ["Receitas base", "Receitas base", fichas.filter(f => !!f.eh_base && f.tipo_base === "receita").length],
              ["Todos", "Todos", fichas.length],
            ].map(([t, label, n]) => (
              <button key={t} onClick={() => setTipoFiltro(t)}
                className={`px-3 sm:px-4 py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all ${tipoFiltro === t ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                {label} <span className={tipoFiltro === t ? "text-emerald-200" : "text-slate-400"}>({n})</span>
              </button>
            ))}
         </div>
         {tipoFiltro === "Pratos" && (
            <p className="text-[11px] font-bold text-slate-400 mb-4 px-1">
              {deptUrl === "bar"
                ? "Monte o drink aqui: adicione os insumos e os pré-preparos (xaropes, mixes, infusões) como componentes. O Cardápio só precifica em cima do que você montar."
                : "Monte o prato aqui: adicione insumos e os pré-preparos como componentes. O Cardápio só precifica em cima do que você montar."}
            </p>
         )}
         {tipoFiltro === "Pré-preparos" && (
            <p className="text-[11px] font-bold text-slate-400 mb-4 px-1">
              {deptUrl === "bar"
                ? "Bases usadas dentro dos drinks (xarope simples, mix de limão, infusões, espumas). Marque \"É uma base/pré-preparo\" ao criar."
                : "Bases usadas dentro de outros pratos (molhos, massas, caldos). Marque \"É uma base/pré-preparo\" ao criar."}
            </p>
         )}
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 shadow-sm justify-between">
            <div className="flex flex-1 items-center gap-2 px-2">
               <Search size={20} className="text-slate-500" />
               <input type="text" placeholder="Buscar receita..." value={busca} onChange={e=>setBusca(e.target.value)} className="w-full outline-none font-bold text-slate-700 p-2" />
            </div>
            
             <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-200 pt-3 lg:pt-0 lg:pl-3">
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
           <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
             <span className="flex items-center gap-2"><CheckCircle2 size={18}/>{mensagemLote}</span>
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
               {fichasPagina.map(f => {
                  const peso = infoPesoFicha(f, fichas);
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
                  const labelUn = { porcao: "porções", kg: "kg", g: "g", l: "L", ml: "ml", un: "un" }[unR] || unR;
                  const pesoTxt = peso ? `Peso: ${fmtG(peso.pesoTotalG)}` : `Rende: ${Number(f.rendimento_porcoes).toLocaleString("pt-BR")} ${labelUn}${unR === "porcao" && f.peso_porcao_g ? ` de ${f.peso_porcao_g}g` : ''}`;

                  return (
                     <div key={f.id}
                        onDragOver={e => { if (dragId) e.preventDefault(); }}
                        onDrop={() => reordenar(dragId, f.id)}
                        className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all relative group flex flex-col overflow-hidden ${dragId === f.id ? 'opacity-50' : ''} ${selecionadas.includes(f.id) ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}>
                        {/* Foto do prato (compacta) */}
                        <div className="h-28 sm:h-32 bg-slate-100 relative">
                           {f.imagem ? (
                              <img onClick={() => { setSimPesoView(""); setViewTab("ficha"); setFichaView(f); }} title="Ver ficha completa" src={`data:image/jpeg;base64,${f.imagem}`} alt={f.nome_receita} className="w-full h-full object-cover cursor-pointer" />
                           ) : (
                              <div onClick={() => { setSimPesoView(""); setViewTab("ficha"); setFichaView(f); }} title="Ver ficha completa" className="w-full h-full flex items-center justify-center text-slate-300 cursor-pointer">
                                 {f.departamento === 'bar' ? <Wine size={34}/> : <UtensilsCrossed size={34}/>}
                              </div>
                           )}
                           {/* Alça para arrastar e reordenar */}
                           <div draggable onDragStart={() => setDragId(f.id)} onDragEnd={() => setDragId(null)}
                              title="Arraste para reordenar"
                              className="absolute bottom-2 left-2 bg-white/90 backdrop-blur rounded-md p-1 text-slate-500 shadow-sm cursor-grab active:cursor-grabbing">
                              <GripVertical size={13} />
                           </div>
                           <label className="absolute top-2 left-2 bg-white/90 backdrop-blur rounded-md p-0.5 cursor-pointer shadow-sm">
                              <input type="checkbox" checked={selecionadas.includes(f.id)} onChange={() => toggleSelecionar(f.id)} className="w-4 h-4 accent-emerald-600 cursor-pointer rounded block"/>
                           </label>
                            <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              {!f.eh_base && (
                                 <button onClick={() => router.push(`/dashboard/operacao/montagem?dept=${f.departamento || deptUrl}&q=${encodeURIComponent(f.nome_receita)}`)} title="Abrir a Guia de Montagem deste prato" className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-emerald-600 shadow-sm"><LayoutList size={13}/></button>
                              )}
                              <button onClick={() => abrirSimulacao(f)} title="Simular outro rendimento" className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-emerald-600 shadow-sm"><Calculator size={13}/></button>
                              <button onClick={() => abrirPreviaImpressao("imprimir", [f])} title="Imprimir ficha técnica" className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-emerald-600 shadow-sm"><Printer size={13}/></button>
                              <button onClick={() => abrirPreviaImpressao("pdf", [f])} title="Baixar ficha técnica em PDF" className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-emerald-600 shadow-sm"><Download size={13}/></button>
                              <button onClick={() => abrirEditar(f)} title="Editar" className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-emerald-600 shadow-sm"><Edit3 size={13}/></button>
                              <button onClick={() => abrirExclusaoSegura([f])} title="Remover" className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-rose-600 shadow-sm"><Trash2 size={13}/></button>
                           </div>
                        </div>
                        <div className="p-3 cursor-pointer" onClick={() => { setSimPesoView(""); setViewTab("ficha"); setFichaView(f); }} title="Ver ficha completa">
                           {(() => {
                              // Métricas estilo "app de gestão": custo, preço, CMV e margem
                              const custoTotal = custoTotalDaFicha(f, fichas);
                              const rend = Number(f.rendimento_porcoes) || 1;
                              const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
                              const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
                              const custoKg = peso?.pesoTotalG > 0 ? custoTotal / (peso.pesoTotalG / 1000) : null;
                              const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
                              const precoPorcao = Number(prod?.preco_venda) || 0;
                              const meta = Number(f.cmv_meta) || 30;
                              const cmv = precoPorcao > 0 ? (custoPorcao / precoPorcao) * 100 : null;
                              const margem = cmv !== null ? 100 - cmv : null;
                              return (
                                 <>
                                    {cmv !== null && cmv > meta && (
                                       <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 mb-1">Acima do CMV meta</span>
                                    )}
                                    <h3 className="text-sm font-black text-slate-800 leading-tight mb-0.5 line-clamp-2">{f.nome_receita}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{pesoTxt}</p>
                                    {!f.eh_base && (
                                       <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] border-t border-slate-100 pt-1.5">
                                          <div><span className="block text-slate-400 font-bold">Custo total</span><span className="font-black text-slate-700">{fmtBRL(custoTotal)}</span></div>
                                          <div><span className="block text-slate-400 font-bold">Custo/porção</span><span className="font-black text-slate-700">{fmtBRL(custoPorcao)}</span></div>
                                          {custoKg !== null && <div><span className="block text-slate-400 font-bold">Custo/kg</span><span className="font-black text-slate-700">{fmtBRL(custoKg)}</span></div>}
                                          <div><span className="block text-slate-400 font-bold">Venda/porção</span><span className="font-black text-slate-700">{precoPorcao > 0 ? fmtBRL(precoPorcao) : "—"}</span></div>
                                          <div><span className="block text-slate-400 font-bold">CMV teórico</span><span className={`font-black ${cmv === null ? "text-slate-400" : cmv > meta ? "text-red-600" : "text-emerald-600"}`}>{cmv !== null ? `${cmv.toFixed(1)}%` : "—"}</span></div>
                                          <div><span className="block text-slate-400 font-bold">Margem</span><span className={`font-black ${margem === null ? "text-slate-400" : "text-emerald-600"}`}>{margem !== null ? `${margem.toFixed(1)}%` : "—"}</span></div>
                                       </div>
                                    )}
                                    {!f.eh_base && precoPorcao === 0 && (
                                       <p className="text-[9px] font-bold text-amber-600 mt-1">Sem preço — defina em Editar → CMV e Precificação</p>
                                    )}
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
               Mostrando {(pagina - 1) * porPagina + 1} a {Math.min(pagina * porPagina, filtradas.length)} de {filtradas.length} fichas
             </p>
             <div className="flex flex-wrap items-center justify-center gap-2">
               <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none">
                 {[8, 12, 24, 48].map(valor => <option key={valor} value={valor}>{valor} por página</option>)}
               </select>
               <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1} title="Página anterior" className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ChevronLeft size={17}/></button>
               <span className="min-w-24 text-center text-xs font-black text-slate-700">Página {pagina} de {totalPaginas}</span>
               <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas} title="Próxima página" className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ChevronRight size={17}/></button>
             </div>
           </div>
         )}
      </div>

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

      {/* EXCLUSÃO SEGURA EM LOTE */}
      {modalExclusao && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
              <div className="flex gap-3">
                <div className="rounded-2xl bg-rose-100 p-3 text-rose-700"><AlertTriangle size={24}/></div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Confirmar exclusão segura</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">Você está prestes a excluir {modalExclusao.lista.length} {modalExclusao.lista.length === 1 ? "ficha técnica" : "fichas técnicas"}.</p>
                </div>
              </div>
              <button onClick={() => setModalExclusao(false)} disabled={processandoLote} className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18}/></button>
            </div>

            <div className="max-h-[62vh] space-y-4 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fichas selecionadas</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{modalExclusao.lista.slice(0, 8).map(f => f.nome_receita).join(", ")}{modalExclusao.lista.length > 8 ? ` e mais ${modalExclusao.lista.length - 8}` : ""}.</p>
              </div>

              {!dependenciasExclusao ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 p-6 text-sm font-bold text-slate-500"><Loader2 size={18} className="animate-spin"/> Verificando cardápio, outras receitas, montagem e histórico...</div>
              ) : (() => {
                const { vinculadas, livres } = separarFichasPorDependencias(modalExclusao.lista, dependenciasExclusao);
                return (
                  <>
                    {dependenciasExclusao.avisos?.length > 0 && (
                      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                        <ShieldAlert size={18} className="shrink-0"/> A verificação não foi concluída em todas as áreas. Por segurança, a exclusão definitiva foi bloqueada; use apenas inativar ou cancelar.
                      </div>
                    )}
                    {vinculadas.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-black text-slate-800">{vinculadas.length} {vinculadas.length === 1 ? "ficha possui vínculo" : "fichas possuem vínculos"} e não será excluída diretamente:</p>
                        {vinculadas.map(ficha => (
                          <div key={ficha.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm font-black text-slate-800">{ficha.nome_receita}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(dependenciasExclusao.porFicha?.[ficha.id] || []).map((item, indice) => <span key={`${item.tipo}-${indice}`} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-amber-800">{item.tipo}: {item.nome}</span>)}
                            </div>
                          </div>
                        ))}
                        <p className="text-xs font-bold text-slate-500">Inativar preserva custos, vendas, produção e histórico. Os vínculos não são removidos automaticamente.</p>
                      </div>
                    ) : (
                      <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 size={19} className="shrink-0"/> Nenhum vínculo encontrado. As fichas podem ser excluídas com segurança.</div>
                    )}
                    {livres.length > 0 && vinculadas.length > 0 && <p className="text-xs font-bold text-emerald-700">{livres.length} ficha(s) sem vínculos podem ser excluídas separadamente.</p>}
                  </>
                );
              })()}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:px-6">
              <button onClick={() => setModalExclusao(false)} disabled={processandoLote} className="mr-auto rounded-xl px-4 py-2.5 text-sm font-black text-slate-600">Cancelar</button>
              {dependenciasExclusao && (() => {
                const { vinculadas, livres } = separarFichasPorDependencias(modalExclusao.lista, dependenciasExclusao);
                const verificacaoIncompleta = dependenciasExclusao.avisos?.length > 0;
                return (
                  <>
                    {livres.length > 0 && vinculadas.length > 0 && !verificacaoIncompleta && <button onClick={() => concluirExclusaoLote("livres")} disabled={processandoLote} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-700 disabled:opacity-50">Excluir somente livres ({livres.length})</button>}
                    {(vinculadas.length > 0 || verificacaoIncompleta) && <button onClick={() => concluirExclusaoLote("inativar")} disabled={processandoLote} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{verificacaoIncompleta ? `Inativar com segurança (${modalExclusao.lista.length})` : `Inativar vinculadas (${vinculadas.length})`}</button>}
                    {vinculadas.length === 0 && !verificacaoIncompleta && <button onClick={() => concluirExclusaoLote("todos")} disabled={processandoLote} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{processandoLote ? "Excluindo..." : `Excluir ${modalExclusao.lista.length} ficha(s)`}</button>}
                  </>
                );
              })()}
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
         const labelUn = { porcao: "porções", kg: "kg", g: "g", l: "L", ml: "ml", un: "un" }[unR] || unR;
         const rend = Number(f.rendimento_porcoes) || 0;
         const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
         const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
         const custoKg = peso?.pesoTotalG > 0 ? custoTotal / (peso.pesoTotalG / 1000) : null;
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
               <div className="bg-slate-50 w-full max-w-6xl min-h-full sm:min-h-0 sm:max-h-[92vh] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
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
                     <div className="space-y-4 sm:space-y-5">
                        {viewTab === "ficha" && (<>
                        {/* INFORMAÇÕES GERAIS */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                           <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-4">Informações gerais</p>
                           <div className="flex flex-col sm:flex-row gap-4">
                              <div className="grid grid-cols-2 gap-3 flex-1">
                                 {[
                                    ["Categoria", f.categoria || "—"],
                                    ["Setor", setorTxt],
                                    ["Rendimento", `${nf(rend)} ${labelUn}`],
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
                        {!f.eh_base && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                           <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Ingredientes e custos</p>
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
                                    {linhas.map((l, i) => (
                                       <tr key={i} className="border-b border-slate-50">
                                          <td className="py-2.5 pr-2 font-bold text-slate-800">{l.nome}{l.base && <span className="ml-1.5 text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Base</span>}</td>
                                          <td className="py-2.5 px-1 text-center font-bold text-slate-500">{l.un}</td>
                                          <td className="py-2.5 px-1 text-right font-bold text-slate-700">{nf(l.bruta)}</td>
                                          <td className="py-2.5 px-1 text-right font-bold text-slate-500">{l.fc ? `${nf(l.fc)}%` : "—"}</td>
                                          <td className="py-2.5 px-1 text-right font-bold text-slate-700">{nf(l.liquida)}</td>
                                          <td className="py-2.5 px-1 text-right font-bold text-slate-600">{fmtBRL(l.custoUnit)}</td>
                                          <td className="py-2.5 pl-1 text-right font-black text-slate-800">{fmtBRL(l.custoTot)}</td>
                                       </tr>
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
                                 <p className="text-xl font-black text-emerald-700">{nf(rend)} {labelUn}</p>
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
                              {custoKg !== null && <div className="flex items-center justify-between"><span className="text-slate-500 font-bold">Custo por kg</span><span className="font-black text-slate-800">{fmtBRL(custoKg)}</span></div>}
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
                                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Markup</p>
                                 <p className="text-lg font-black text-emerald-700">{markup ? `${markup.toFixed(2)}×` : "—"}</p>
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
             <div className="bg-white rounded-3xl sm:rounded-[32px] w-full max-w-6xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center gap-3 p-4 sm:p-6 border-b border-slate-100 bg-white">
                  <div>
                     <h2 className="font-black text-xl sm:text-2xl text-slate-800">{form.id ? "Editar Receita" : "Nova Receita"}</h2>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Custo Total Atual: <span className="text-emerald-600 font-black">{fmtBRL(calcularCustoTotal(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 custom-scrollbar grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5 sm:gap-8 md:items-start">
                  
                   {/* COLUNA ESQUERDA: Dados Básicos e Foto */}
                  <div className="space-y-4">
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
                     {/* Tipo da ficha: PRATO/DRINK (cardápio), PRÉ-PREPARO ou RECEITA BASE */}
                     <div className={`grid gap-2 ${deptUrl === "bar" ? "grid-cols-2" : "grid-cols-3"}`}>
                        <button type="button" onClick={() => setForm({ ...form, eh_base: false, produto_pronto: false, tipo_base: null, categoria: "" })}
                           className={`min-h-[92px] py-3 px-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${!form.eh_base && !form.produto_pronto ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                           {deptUrl === "bar" ? "Drink" : "Prato"}
                           <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">vai pro cardápio</span>
                        </button>
                        {deptUrl === "bar" && (
                          <button type="button" onClick={() => { setForm({ ...form, eh_base: false, produto_pronto: true, tipo_base: "produto_pronto", categoria: form.categoria || "Cervejas", rendimento_porcoes: "1", rendimento_unidade: "un", peso_porcao_g: "", modo_preparo: "" }); setIngFicha([]); setAutoSoma(false); }}
                            className={`min-h-[92px] py-3 px-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${form.produto_pronto ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                            Produto pronto
                            <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">garrafa, lata, água, cerveja</span>
                          </button>
                        )}
                        <button type="button" onClick={() => setForm({ ...form, eh_base: true, produto_pronto: false, tipo_base: "pre", categoria: deptUrl === "bar" ? (CATEGORIAS_PREPARO_BAR.includes(form.categoria) ? form.categoria : "Xaropes") : "" })}
                           className={`min-h-[92px] py-3 px-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${form.eh_base && form.tipo_base !== "receita" ? "bg-emerald-700 border-emerald-700 text-white shadow-lg shadow-emerald-700/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                           Pré-preparo
                           <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">{deptUrl === "bar" ? "xarope, mix, infusão" : "molho, massa, caldo"}</span>
                        </button>
                        <button type="button" onClick={() => setForm({ ...form, eh_base: true, produto_pronto: false, tipo_base: "receita", categoria: "" })}
                           className={`min-h-[92px] py-3 px-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${form.eh_base && form.tipo_base === "receita" ? "bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-600/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                           Receita base
                           <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">arroz, feijão, farofa — produção do dia</span>
                        </button>
                     </div>
                      {form.produto_pronto && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                           <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Tipo de produto pronto</label>
                           <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-2 bg-white border border-emerald-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                              {CATEGORIAS_PRODUTO_PRONTO_BAR.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                           <p className="mt-2 text-[11px] font-medium text-emerald-700">Produto vendido como vem do fornecedor. Não exige ingredientes, receita ou guia de montagem.</p>
                        </div>
                      )}
                      {deptUrl === "bar" && form.eh_base && form.tipo_base !== "receita" && (
                         <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Tipo de preparo do Bar</label>
                            <select value={form.categoria || "Xaropes"} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-2 bg-white border border-emerald-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                               {CATEGORIAS_PREPARO_BAR.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <p className="mt-2 text-[11px] font-medium text-emerald-700">Este preparo poderá ser usado como componente de vários drinks e aparecerá na seção correta do Livro de Receitas.</p>
                         </div>
                      )}
                     {/* Categoria do cardápio (só para pratos, não para bases) */}
                     {!form.eh_base && deptUrl !== "bar" && (
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Categoria no cardápio</label>
                           <select value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                              <option value="">Sem categoria</option>
                              {CATEGORIAS_CARDAPIO.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                     )}
                     {/* RENDIMENTO — automático pela soma dos ingredientes (peso + custo de 1 kg) */}
                     <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rendimento da receita</p>
                           {autoSoma
                              ? <button type="button" onClick={() => setAutoSoma(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline">ajustar manualmente</button>
                              : <button type="button" onClick={() => setAutoSoma(true)} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline">← voltar ao automático</button>}
                        </div>
                        {autoSoma ? (
                           (() => {
                              const est = rendimentoPelosIngredientes(ingFicha);
                              const custoTotal = calcularCustoTotal(ingFicha);
                              if (!est) return <p className="text-sm text-slate-400 font-medium py-2">Adicione ingredientes — o rendimento e o custo de 1 kg aparecem aqui sozinhos.</p>;
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
                                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">1 kg custa</p>
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
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                                       <span className="text-[11px] font-bold text-slate-500">Quanto custa se eu usar</span>
                                       <input type="number" step="0.01" min="0" placeholder="0" value={calcQtd} onChange={e=>setCalcQtd(e.target.value)} className="w-20 p-2 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                                       <select value={["g","kg","l","ml"].includes(calcUn) ? calcUn : "g"} onChange={e=>setCalcUn(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 text-sm outline-none focus:border-emerald-500">
                                          <option value="g">g</option>
                                          <option value="kg">kg</option>
                                          <option value="l">L</option>
                                          <option value="ml">ml</option>
                                       </select>
                                       {(() => {
                                          const q = Number(calcQtd) || 0;
                                          let base = 0;
                                          if (calcUn === "g" || calcUn === "ml") base = q;
                                          else if (calcUn === "kg" || calcUn === "l") base = q * 1000;
                                          if (base <= 0) return null;
                                          return <span className="text-sm font-bold text-slate-600">? → <span className="font-black text-emerald-600">{fmtBRL(custoKg * (base / 1000))}</span></span>;
                                       })()}
                                    </div>
                                 </>
                              );
                           })()
                        ) : (
                        <>
                        <div className={`grid ${["kg", "g", "l", "ml"].includes(String(form.rendimento_unidade || "porcao").toLowerCase()) ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rendimento</label>
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
                                 <option value="porcao">porções</option>
                                 <option value="kg">kg</option>
                                 <option value="g">g</option>
                                 <option value="l">L</option>
                                 <option value="ml">ml</option>
                                 <option value="un">unidades</option>
                              </select>
                           </div>
                           {!["kg", "g", "l", "ml"].includes(String(form.rendimento_unidade || "porcao").toLowerCase()) && (
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Porção pesa (g)</label>
                                 <input type="number" step="0.1" min="0" placeholder="Ex: 300" value={form.peso_porcao_g} onChange={e=>{
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
                                    {custoKg !== null && <> · 1 kg custa <span className="font-black text-emerald-700">{fmtBRL(custoKg)}</span></>}
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
                              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                                 <span className="text-[11px] font-bold text-slate-500">Quanto custa se eu usar</span>
                                 <input type="number" step="0.01" min="0" placeholder="0" value={calcQtd} onChange={e=>setCalcQtd(e.target.value)} className="w-20 p-2 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                                 <select value={calcUn} onChange={e=>setCalcUn(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 text-sm outline-none focus:border-emerald-500">
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                    {pesoPorcao > 0 && <option value="un">porções</option>}
                                 </select>
                                 {gramas > 0 && (
                                    <span className="text-sm font-bold text-slate-600">
                                       ? → <span className="font-black text-emerald-600">{fmtBRL(custoCalc)}</span>
                                       <span className="text-slate-400 font-medium text-xs"> ({fmtG(gramas)}{unidadesCalc !== null ? ` · ${(+unidadesCalc.toFixed(1)).toLocaleString("pt-BR")} porções` : ""})</span>
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
                     {!form.eh_base && (() => {
                        const custoTotalForm = calcularCustoTotal(ingFicha);
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
                        const markup = precoNum > 0 && custoPorc > 0 ? precoNum / custoPorc : null;
                        const lucro = precoNum > 0 ? precoNum - custoPorc : null;
                        const custoKgForm = pesoTotalF > 0 ? custoTotalForm / (pesoTotalF / 1000) : 0;
                        return (
                           <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 shadow-sm">
                              <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-3">CMV e Precificação</p>
                              {/* Custos base — sempre visíveis, recalculam ao digitar */}
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                 <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-center">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Custo total</p>
                                    <p className="text-sm font-black text-slate-800">{fmtBRL(custoTotalForm)}</p>
                                 </div>
                                 <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-center">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Custo/porção</p>
                                    <p className="text-sm font-black text-slate-800">{fmtBRL(custoPorc)}</p>
                                 </div>
                                 <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-center">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Custo/kg</p>
                                    <p className="text-sm font-black text-slate-800">{custoKgForm > 0 ? fmtBRL(custoKgForm) : "—"}</p>
                                 </div>
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
                                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                    <div className={`rounded-xl p-2.5 text-center border ${cmvTeo > meta ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">CMV teórico</p>
                                       <p className={`text-lg font-black ${cmvTeo > meta ? "text-red-600" : "text-emerald-700"}`}>{cmvTeo.toFixed(1)}%</p>
                                    </div>
                                    <div className="rounded-xl p-2.5 text-center border bg-emerald-50 border-emerald-200">
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Margem</p>
                                       <p className="text-lg font-black text-emerald-700">{margem.toFixed(1)}%</p>
                                    </div>
                                    <div className="rounded-xl p-2.5 text-center border bg-emerald-50 border-emerald-200">
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Markup</p>
                                       <p className="text-lg font-black text-emerald-700">{markup ? markup.toFixed(2) + "×" : "—"}</p>
                                    </div>
                                    <div className={`rounded-xl p-2.5 text-center border ${lucro < 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                                       <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Lucro/porção</p>
                                       <p className={`text-lg font-black ${lucro < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtBRL(lucro)}</p>
                                    </div>
                                 </div>
                              ) : (
                                 <p className="text-[11px] font-medium text-slate-400 mt-2">Defina o preço de venda para ver CMV teórico, margem, markup e lucro por porção.</p>
                              )}
                           </div>
                        );
                     })()}

                     <div>
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

                        <textarea placeholder="Passo a passo da execução..." value={form.modo_preparo} onChange={e=>setForm({...form, modo_preparo: e.target.value})} className="w-full h-40 p-4 mt-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm resize-none"></textarea>
                     </div>

                     {/* Dados extras da ficha técnica: tempo, validade e observações */}
                     <div>
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tempo de preparo (min)</label>
                              <input type="number" min="0" step="1" placeholder="Ex: 15" value={form.tempo_preparo} onChange={e=>setForm({...form, tempo_preparo: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Validade (dias)</label>
                              <input type="number" min="0" step="1" placeholder="Ex: 3" value={form.validade_dias} onChange={e=>setForm({...form, validade_dias: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm"/>
                           </div>
                        </div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-3 block">Observações</label>
                        <textarea placeholder="Observações da ficha (opcional)..." value={form.observacoes} onChange={e=>setForm({...form, observacoes: e.target.value})} className="w-full h-20 p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm resize-none"></textarea>
                     </div>
                  </div>

                  {/* COLUNA DIREITA: Ingredientes da Ficha */}
                  {form.produto_pronto ? (
                  <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-200 shadow-sm flex flex-col items-center justify-center min-h-[320px] text-center">
                     <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4"><Package size={28} /></div>
                     <h3 className="text-xl font-black text-slate-800">Produto pronto para venda</h3>
                     <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-500">Cadastre a categoria e o preço. O item entrará no cardápio do Bar sem exigir ingredientes ou montagem.</p>
                     <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-2 text-left">
                        <div className="rounded-xl border border-emerald-100 bg-white p-3"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Quantidade</span><span className="font-black text-slate-800">1 unidade</span></div>
                        <div className="rounded-xl border border-emerald-100 bg-white p-3"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Composição</span><span className="font-black text-slate-800">Não se aplica</span></div>
                     </div>
                  </div>
                  ) : (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[500px]">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Composição (Ingredientes)</label>
                     
                     {/* ADD INGREDIENTE */}
                     <div className="flex gap-2 mb-4">
                        <select onChange={e => { addIngrediente(e.target.value); e.target.value=""; }} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 outline-none focus:border-emerald-500 text-sm">
                           <option value="">+ Adicionar insumo ou base...</option>
                           <optgroup label="Insumos">
                              {insumosAtivos.map(i => <option key={i.id} value={`insumo:${i.id}`}>{i.nome} ({i.unidade_medida})</option>)}
                           </optgroup>
                           {basesDisponiveis.length > 0 && (
                              <optgroup label="Bases / Pré-preparos">
                                 {basesDisponiveis.map(b => <option key={b.id} value={`base:${b.id}`}>{b.nome_receita} ({b.rendimento_unidade})</option>)}
                              </optgroup>
                           )}
                        </select>
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
                           <div className="text-center p-6 text-slate-500 font-medium text-sm">
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
                           <div key={ing.chave} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 group">
                              <div className="flex-1 min-w-0">
                                 <p className="font-bold text-slate-800 text-sm truncate flex items-center gap-1.5">
                                    {ing.nome}
                                    {ing.tipo === "base" && <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Base</span>}
                                 </p>
                                 <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Custo: {fmtBRL(ing.custo_unitario * ing.quantidade * (1 + (Number(ing.fator) || 0) / 100))} <span className="text-slate-400 normal-case">· {fmtBRL(ing.custo_unitario)}/{String(ing.unidade).toUpperCase()}</span></p>
                                 {/* Fator de correção (%): qtd bruta = líquida × (1 + fc) — o custo usa a bruta */}
                                 <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">FC %</span>
                                    <input type="number" min="0" max="300" step="1" value={ing.fator || ""} placeholder="0"
                                       onChange={e => updateFator(ing.chave, e.target.value)}
                                       className="w-14 p-1 text-center bg-white border border-slate-200 rounded-md font-bold text-[11px] text-slate-700 outline-none focus:border-emerald-500" />
                                    {Number(ing.fator) > 0 && ing.quantidade > 0 && (
                                       <span className="text-[9px] font-bold text-amber-600">bruta: {(+(ing.quantidade * (emSub ? fator : 1) * (1 + Number(ing.fator) / 100)).toFixed(2)).toLocaleString("pt-BR")} {unidadeLabel}</span>
                                    )}
                                 </div>
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

               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-3">
                  <button onClick={() => handleSalvar(false)} className="flex-1 py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> {form.produto_pronto ? "Salvar produto pronto" : `Salvar receita (${fmtBRL(calcularCustoTotal(ingFicha))})`}
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
                                    return { unidade: it.unidade_lida, quantidade: it.quantidade_lida, peso_medio_g: ins?.peso_medio_g || null };
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
