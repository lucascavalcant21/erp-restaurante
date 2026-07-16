"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas, salvarFicha, removerFicha, fetchInsumos, salvarInsumo, atualizarOrdemFichas } from "../../../lib/operacao";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchMontagens, inserirMontagem } from "../../../lib/montagem";
import { fetchParams, salvarParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { CATEGORIAS_INSUMO, adivinharCategoria } from "../../../lib/categorias-insumo";
import { fetchEmbalagens } from "../../../lib/embalagens";
import { unidadeVendaDaFicha, quantidadeVendaDaFicha } from "../../../lib/custos-receita";
import { LayoutList, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft, ArrowUp, ArrowDown, UtensilsCrossed, Wine, ChevronRight, Printer, Sparkles, Loader2, Camera, CheckCircle2, AlertTriangle, GripVertical, Calculator, Copy, FileText, Store, Clock3, TrendingUp, PackagePlus, Package, Link2 } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Categorias do cardápio (cozinha). Os pratos são divididos nessas seções.
const CATEGORIAS_CARDAPIO = [
  "Entradas", "Executivo", "Moquecas e Caldeirada", "Vatapá", "Maniçoba",
  "Menu Degustação", "Sobremesas", "Sucos",
];

const CATEGORIAS_CARDAPIO_PADRAO = [
  "Bebidas", "Drinks", "Entradas", "Pratos Principais", "Executivo",
  "Porções", "Combos", "Pizzas", "Lanches", "Sobremesas", "Sucos",
  ...CATEGORIAS_CARDAPIO,
];

const FORM_RECEITA_VAZIO = (departamento, metaCmv = PARAMS_PADRAO.meta_cmv) => ({
  id: null,
  departamento,
  nome_receita: "",
  categoria: departamento === "bar" ? "Drinks" : "Pratos Principais",
  rendimento_porcoes: "1",
  modo_preparo: "",
  eh_base: false,
  rendimento_unidade: "porcao",
  unidade_venda: "porcao",
  peso_porcao_g: "",
  imagem: "",
  imagem_url_original: "",
  imagem_removida: false,
  produto_id: null,
  preco_venda: "",
  tempo_preparo_base: "15",
  produto_ativo: false,
  meta_cmv: String(metaCmv),
  unidade_origem: null,
  nova_ficha: true,
});

const FORM_PRODUTO_VAZIO = (departamento) => ({
  id: null,
  unidade_origem: null,
  novo_produto: true,
  nome_produto: "",
  categoria: departamento === "bar" ? "Bebidas" : "Pratos Principais",
  departamento,
  preco_venda: "",
  tempo_preparo_base: "0",
  codigo_barras: "",
  imagem_url: "",
  ativo: false,
  vinculo_ficha_id: "",
});

// Converte um File de imagem em base64 puro (sem o prefixo "data:...;base64,")
function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
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
  const caminho = new Set(guard);
  caminho.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, caminho) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
    }
  });
  return total;
}

function unidadeVendaCalculada(unidadeRendimento, pesoPorcao) {
  if (Number(pesoPorcao) > 0) return "porcao";
  const unidade = String(unidadeRendimento || "porcao").toLowerCase();
  if (unidade === "kg" || unidade === "g") return "kg";
  if (unidade === "l" || unidade === "ml") return "l";
  if (unidade === "un") return "un";
  return "porcao";
}

function gerarUuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, caractere => {
    const aleatorio = Math.floor(Math.random() * 16);
    const valor = caractere === "x" ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}
// Custo por unidade-de-rendimento de uma base (usado quando ela vira ingrediente)
function custoUnitBase(base, todasFichas) {
  return custoTotalDaFicha(base, todasFichas) / (base.rendimento_porcoes || 1);
}

function fichaReferenciaOutra(fichaId, alvoId, todasFichas, visitadas = new Set()) {
  if (!fichaId || visitadas.has(fichaId)) return false;
  if (fichaId === alvoId) return true;
  const novasVisitadas = new Set(visitadas);
  novasVisitadas.add(fichaId);
  const ficha = todasFichas.find(item => item.id === fichaId);
  return (ficha?.fichas_ingredientes || []).some(item =>
    item?.subficha_id && fichaReferenciaOutra(item.subficha_id, alvoId, todasFichas, novasVisitadas)
  );
}

function porcoesDaFicha(f) {
  return quantidadeVendaDaFicha(f);
}

function componentesDoProduto(produto) {
  if (Array.isArray(produto?.composicao) && produto.composicao.length) return produto.composicao;
  return produto?.ficha_id ? [{ ficha_id: produto.ficha_id, qtd: 1 }] : [];
}

function produtosSimplesVinculados(ficha, produtos) {
  if (!ficha?.id) return [];
  return (produtos || []).filter(produto => {
    const componentes = componentesDoProduto(produto);
    return componentes.length === 1 && componentes[0]?.ficha_id === ficha.id;
  });
}

// Uma mesma ficha pode alimentar tamanhos/variantes diferentes. Só tratamos um
// produto como o item canônico da receita quando existe exatamente um vínculo
// simples e explícito; assim nunca sobrescrevemos uma variante arbitrária.
function produtoVinculado(ficha, produtos) {
  const candidatos = produtosSimplesVinculados(ficha, produtos);
  return candidatos.length === 1 ? candidatos[0] : null;
}

function fotoDaFicha(ficha, produtos) {
  if (ficha?.imagem) return `data:image/jpeg;base64,${ficha.imagem}`;
  return produtoVinculado(ficha, produtos)?.imagem_url || "";
}

function custoVendaDoProduto(produto, fichas, embalagens = []) {
  if (!produto) return null;
  let total = 0;
  let encontrouCusto = false;
  componentesDoProduto(produto).forEach(componente => {
    const ficha = fichas.find(item => item.id === componente?.ficha_id);
    if (!ficha) return;
    const unidadesVenda = porcoesDaFicha(ficha);
    if (!(unidadesVenda > 0)) return;
    encontrouCusto = true;
    total += (custoTotalDaFicha(ficha, fichas) / unidadesVenda) * (Number(componente?.qtd) || 1);
  });
  (Array.isArray(produto.embalagens) ? produto.embalagens : []).forEach(item => {
    const embalagem = embalagens.find(registro => registro.id === item?.embalagem_id);
    if (!embalagem) return;
    encontrouCusto = true;
    total += (Number(embalagem.preco_unitario) || 0) * (Number(item?.qtd) || 1);
  });
  return encontrouCusto ? total : null;
}

function metricasReceita(ficha, produto, fichas, embalagens = []) {
  const custoTotal = custoTotalDaFicha(ficha, fichas);
  const unidadeVenda = unidadeVendaDaFicha(ficha);
  const porcoes = unidadeVenda.quantidade;
  const custoReceitaUnitario = porcoes > 0 ? custoTotal / porcoes : null;
  const custoProdutoCompleto = custoVendaDoProduto(produto, fichas, embalagens);
  const custoPorcao = custoProdutoCompleto ?? custoReceitaUnitario;
  const precoVenda = Number(produto?.preco_venda) || 0;
  const cmv = precoVenda > 0 && custoPorcao !== null ? (custoPorcao / precoVenda) * 100 : null;
  const margem = precoVenda > 0 && custoPorcao !== null ? ((precoVenda - custoPorcao) / precoVenda) * 100 : null;
  const peso = infoPesoFicha(ficha, fichas);
  return { custoTotal, porcoes, custoPorcao, custoReceitaUnitario, precoVenda, cmv, margem, custoKg: peso?.custoKg ?? null, peso, unidadeVenda };
}

function fichaPrincipalDoProduto(produto, fichas) {
  if (!produto) return null;
  if (produto.ficha_id) return fichas.find(ficha => ficha.id === produto.ficha_id) || null;
  const componentes = componentesDoProduto(produto);
  if (componentes.length === 1) return fichas.find(ficha => ficha.id === componentes[0]?.ficha_id) || null;
  return null;
}

function produtoParaSalvar(produto, patch = {}) {
  const {
    fichas_tecnicas: _fichaJoin,
    created_at: _createdAt,
    updated_at: _updatedAt,
    unidade_origem: _unidadeOrigem,
    novo_produto: _novoProduto,
    vinculo_ficha_id: _vinculoFichaId,
    ...campos
  } = produto || {};
  return { ...campos, ...patch, id: produto?.id || patch.id || null };
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
  
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [embalagens, setEmbalagens] = useState([]);
  const [insumosAtivos, setInsumosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("recentes");
  const [metaCmv, setMetaCmv] = useState(PARAMS_PADRAO.meta_cmv);
  const [salvando, setSalvando] = useState(false);
  
  const [modalNovo, setModalNovo] = useState(false);
  const [modalProduto, setModalProduto] = useState(false);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [formProduto, setFormProduto] = useState(() => FORM_PRODUTO_VAZIO(deptUrl));
  const [iaExplicacao, setIaExplicacao] = useState("");
  const [autoSoma, setAutoSoma] = useState(true);

  const [selecionadas, setSelecionadas] = useState([]);
  const [dragId, setDragId] = useState(null); // arrastar para reordenar

  // Estado do formulário da Ficha
  const [form, setForm] = useState(() => FORM_RECEITA_VAZIO(deptUrl));

  const [modalInsumo, setModalInsumo] = useState(false);
  const [salvandoInsumo, setSalvandoInsumo] = useState(false);
  const [formInsumo, setFormInsumo] = useState({
    nome: "", categoria: "", unidade_medida: "kg", custo_unitario: "",
    marca: "", fornecedor: "", observacoes: "",
  });
  
  const fileInputRef = useRef(null);
  const fileProdutoRef = useRef(null);
  const cargaAtualRef = useRef(0);
  const focoAnteriorRef = useRef(null);
  const focoAbrirInsumoRef = useRef(null);
  const focoSubstituicaoRef = useRef(null);
  const escopoAtualRef = useRef({ unidade: unidadeAtiva, departamento: deptUrl });
  escopoAtualRef.current = { unidade: unidadeAtiva, departamento: deptUrl };

  const fecharModalInsumo = () => {
    setModalInsumo(false);
    window.setTimeout(() => focoAbrirInsumoRef.current?.focus?.(), 20);
  };

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
      setForm(atual => ({ ...atual, imagem: base64Comprimido, imagem_removida: false }));
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
    setIaFImagem({ base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file), nomeArquivo: file.name });
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
      ...FORM_RECEITA_VAZIO(deptUrl, metaCmv),
      id: gerarUuid(), produto_id: gerarUuid(), departamento: deptUrl,
      unidade_origem: unidadeAtiva, nova_ficha: true,
      nome_receita: iaFResultado.nome_receita,
      rendimento_porcoes: pesoIA ? String(pesoIA.valor) : String(iaFResultado.rendimento_porcoes || 1),
      modo_preparo: iaFResultado.modo_preparo,
      eh_base: false,
      rendimento_unidade: pesoIA ? pesoIA.unidade : "porcao",
      peso_porcao_g: "",
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
    const unidadeDaCarga = unidadeAtiva;
    const departamentoDaCarga = deptUrl;
    if (escopoAtualRef.current.unidade !== unidadeDaCarga || escopoAtualRef.current.departamento !== departamentoDaCarga) return;
    const numeroCarga = ++cargaAtualRef.current;
    setLoading(true);
    setErroCarregamento("");
    const [resFichas, resInsumos, resProdutos, resParams, resEmbalagens] = await Promise.all([
       fetchFichas(unidadeDaCarga, departamentoDaCarga, { escopoEstrito: true }),
       fetchInsumos(unidadeDaCarga, departamentoDaCarga, { escopoEstrito: true }),
       fetchProdutos(unidadeDaCarga, departamentoDaCarga, { escopoEstrito: true }),
       fetchParams(unidadeDaCarga),
       fetchEmbalagens(unidadeDaCarga),
    ]);
    if (numeroCarga !== cargaAtualRef.current
      || escopoAtualRef.current.unidade !== unidadeDaCarga
      || escopoAtualRef.current.departamento !== departamentoDaCarga) return;
    const erroCarga = resFichas.error || resInsumos.error || resProdutos.error || resEmbalagens.error;
    if (erroCarga) {
      setLoading(false);
      const mensagemErro = typeof erroCarga === "string" ? erroCarga : (erroCarga?.message || "Falha de conexão");
      setErroCarregamento(mensagemErro);
      return;
    }
    setFichas(resFichas.data || []);
    setInsumosAtivos(resInsumos.data || []);
    setProdutos(resProdutos.data || []);
    setEmbalagens(resEmbalagens.data || []);
    setMetaCmv(Number(resParams?.data?.meta_cmv) || PARAMS_PADRAO.meta_cmv);
    setErroCarregamento("");
    setLoading(false);
  };

  useEffect(() => {
    cargaAtualRef.current += 1;
    setFichas([]);
    setProdutos([]);
    setEmbalagens([]);
    setInsumosAtivos([]);
    setSelecionadas([]);
    setTipoFiltro("Pratos");
    setDragId(null);
    setErroCarregamento("");
    setModalNovo(false);
    setModalProduto(false);
    setModalInsumo(false);
    setModalIAFicha(false);
    setModalSim(null);
    setSubstituirAlvo(null);
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const algumModalAberto = !!(modalNovo || modalProduto || modalInsumo || modalSim || substituirAlvo || modalIAFicha);
  useEffect(() => {
    if (!algumModalAberto) return undefined;
    focoAnteriorRef.current = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowAnterior;
      focoAnteriorRef.current?.focus?.();
    };
  }, [algumModalAberto]);

  useEffect(() => {
    if (!algumModalAberto) return undefined;
    const timerFoco = window.setTimeout(() => {
      const dialogo = [...document.querySelectorAll('[role="dialog"]')]
        .filter(elemento => elemento.getClientRects().length > 0 && elemento.getAttribute("aria-hidden") !== "true")
        .at(-1);
      const primeiro = dialogo?.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      (primeiro || dialogo)?.focus?.();
    }, 0);
    return () => window.clearTimeout(timerFoco);
  }, [algumModalAberto, modalNovo, modalProduto, modalInsumo, modalSim, substituirAlvo, modalIAFicha]);

  useEffect(() => {
    if (!algumModalAberto) return undefined;
    const dialogosVisiveis = () => [...document.querySelectorAll('[role="dialog"]')]
      .filter(elemento => elemento.getClientRects().length > 0 && elemento.getAttribute("aria-hidden") !== "true");
    const aoTeclar = evento => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        if (modalInsumo && !salvandoInsumo) fecharModalInsumo();
        else if (modalProduto && !salvandoProduto) setModalProduto(false);
        else if (substituirAlvo) fecharSubstituicao();
        else if (modalSim) setModalSim(null);
        else if (modalIAFicha && !iaFLoading) setModalIAFicha(false);
        else if (modalNovo && !salvando) setModalNovo(false);
        return;
      }
      if (evento.key !== "Tab") return;
      const dialogo = dialogosVisiveis().at(-1);
      if (!dialogo) return;
      const focaveis = [...dialogo.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(elemento => elemento.getClientRects().length > 0);
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [algumModalAberto, modalNovo, modalProduto, modalInsumo, modalSim, substituirAlvo, modalIAFicha, salvando, salvandoProduto, salvandoInsumo, iaFLoading]);

  // Rendimento automático: sempre que os ingredientes mudam (e não estiver no
  // modo manual), o rendimento passa a ser o PESO SOMADO dos ingredientes, na
  // unidade que domina (kg/g/l/ml). Sem porção, sem multiplicação.
  useEffect(() => {
    if (form && autoSoma && ingFicha.length > 0) {
      const est = rendimentoPelosIngredientes(ingFicha);
      if (est && est.totalG > 0) {
         setForm(f => ({
           ...f,
           rendimento_porcoes: String(est.valor),
           rendimento_unidade: est.unidade,
           unidade_venda: unidadeVendaCalculada(est.unidade, null),
           peso_porcao_g: "",
         }));
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
    if (tipoFiltro === "Pré-preparos") return !!f.eh_base;
    if (tipoFiltro === "Pratos") return !f.eh_base;
    return !f.eh_base && (f.categoria || produtoVinculado(f, produtos)?.categoria || "") === tipoFiltro;
  };
  const categoriasCardapio = [...new Set([
    ...CATEGORIAS_CARDAPIO_PADRAO,
    ...fichas.map(f => f.categoria),
    ...produtos.map(p => p.categoria),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const compararOrdenacao = (a, b) => {
    if (ordenacao === "manual") return ordenarFichas(a, b);
    if (ordenacao === "nome") return a.nome_receita.localeCompare(b.nome_receita, "pt-BR");
    if (ordenacao === "maior-custo") return custoTotalDaFicha(b, fichas) - custoTotalDaFicha(a, fichas);
    if (ordenacao === "maior-cmv") {
      const ma = metricasReceita(a, produtoVinculado(a, produtos), fichas, embalagens).cmv ?? -1;
      const mb = metricasReceita(b, produtoVinculado(b, produtos), fichas, embalagens).cmv ?? -1;
      return mb - ma;
    }
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (da !== db) return db - da;
    return ordenarFichas(a, b);
  };

  const filtradas = fichas
    .filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()) && passaFiltro(f))
    .sort(compararOrdenacao);

  const idsProdutosExibidosComFicha = new Set(
    fichas.map(ficha => produtoVinculado(ficha, produtos)?.id).filter(Boolean)
  );
  const produtosSemFicha = produtos.filter(produto => !idsProdutosExibidosComFicha.has(produto.id));
  const filtradosProdutosSemFicha = produtosSemFicha
    .filter(produto => {
      const combinaBusca = String(produto.nome_produto || "").toLowerCase().includes(busca.toLowerCase());
      if (!combinaBusca) return false;
      if (tipoFiltro === "Todos" || tipoFiltro === "Itens prontos") return true;
      if (tipoFiltro === "Pratos" || tipoFiltro === "Pré-preparos") return false;
      return produto.categoria === tipoFiltro;
    })
    .sort((a, b) => {
      if (ordenacao === "nome") return String(a.nome_produto || "").localeCompare(String(b.nome_produto || ""), "pt-BR");
      if (ordenacao === "maior-custo") {
        return (custoVendaDoProduto(b, fichas, embalagens) || 0) - (custoVendaDoProduto(a, fichas, embalagens) || 0);
      }
      if (ordenacao === "maior-cmv") {
        const custoA = custoVendaDoProduto(a, fichas, embalagens);
        const custoB = custoVendaDoProduto(b, fichas, embalagens);
        const cmvA = Number(a.preco_venda) > 0 && custoA !== null ? custoA / Number(a.preco_venda) : -1;
        const cmvB = Number(b.preco_venda) > 0 && custoB !== null ? custoB / Number(b.preco_venda) : -1;
        return cmvB - cmvA;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const ordemVisualGlobal = new Map([
    ...filtradas.map(ficha => {
      const metricas = metricasReceita(ficha, produtoVinculado(ficha, produtos), fichas, embalagens);
      return { chave: `f:${ficha.id}`, tipo: "ficha", nome: ficha.nome_receita, custo: metricas.custoPorcao ?? metricas.custoTotal, cmv: metricas.cmv, criado: ficha.created_at, ordem: ficha.ordem };
    }),
    ...filtradosProdutosSemFicha.map(produto => {
      const custo = custoVendaDoProduto(produto, fichas, embalagens);
      const preco = Number(produto.preco_venda) || 0;
      return { chave: `p:${produto.id}`, tipo: "produto", nome: produto.nome_produto, custo, cmv: preco > 0 && custo !== null ? (custo / preco) * 100 : null, criado: produto.created_at, ordem: null };
    }),
  ].sort((a, b) => {
    if (ordenacao === "nome") return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    if (ordenacao === "maior-custo") return (b.custo ?? -1) - (a.custo ?? -1);
    if (ordenacao === "maior-cmv") return (b.cmv ?? -1) - (a.cmv ?? -1);
    if (ordenacao === "manual") {
      if (a.tipo !== b.tipo) return a.tipo === "ficha" ? -1 : 1;
      if (a.tipo === "ficha") return (a.ordem ?? 1e9) - (b.ordem ?? 1e9);
    }
    return new Date(b.criado || 0).getTime() - new Date(a.criado || 0).getTime();
  }).map((item, indice) => [item.chave, indice]));

  const resumoReceitas = fichas.filter(f => !f.eh_base).map(f => ({
    ficha: f,
    produto: produtoVinculado(f, produtos),
    produtosVinculados: produtosSimplesVinculados(f, produtos),
    metricas: metricasReceita(f, produtoVinculado(f, produtos), fichas, embalagens),
  }));
  const resumoProdutosSemFicha = produtosSemFicha.map(produto => {
    const custo = custoVendaDoProduto(produto, fichas, embalagens);
    const preco = Number(produto.preco_venda) || 0;
    return { produto, cmv: preco > 0 && custo !== null ? (custo / preco) * 100 : null };
  });
  const cmvsCalculados = [
    ...resumoReceitas.map(item => item.metricas.cmv),
    ...resumoProdutosSemFicha.map(item => item.cmv),
  ].filter(v => v !== null);
  const cmvMedio = cmvsCalculados.length
    ? cmvsCalculados.reduce((soma, valor) => soma + valor, 0) / cmvsCalculados.length
    : null;
  const acimaDaMeta = resumoReceitas.filter(item => item.metricas.cmv !== null && item.metricas.cmv > metaCmv).length
    + resumoProdutosSemFicha.filter(item => item.cmv !== null && item.cmv > metaCmv).length;
  const aguardandoPreco = resumoReceitas.filter(item => item.produtosVinculados.length <= 1 && !(Number(item.produto?.preco_venda) > 0)).length
    + produtosSemFicha.filter(item => !(Number(item.preco_venda) > 0)).length;

  const salvarNovaOrdem = async (idsOrdenados) => {
    const idsEsperados = [...fichas].sort(ordenarFichas).map(ficha => ficha.id);
    const ordemMap = {};
    idsOrdenados.forEach((id, indice) => { ordemMap[id] = indice; });
    setFichas(prev => prev.map(f => ordemMap[f.id] !== undefined ? { ...f, ordem: ordemMap[f.id] } : f));
    setDragId(null);
    const resultado = await atualizarOrdemFichas(idsOrdenados, idsEsperados, unidadeAtiva, deptUrl);
    if (resultado?.error) {
      alert(`${resultado.error} A lista será recarregada sem alterações parciais.`);
      await carregar();
    }
  };

  // Reordena a lista completa, preservando a posição dos itens ocultos por filtros.
  const reordenar = async (arrastadoId, alvoId) => {
    if (!arrastadoId || arrastadoId === alvoId) return;
    const ids = [...fichas].sort(ordenarFichas).map(f => f.id);
    const from = ids.indexOf(arrastadoId), to = ids.indexOf(alvoId);
    if (from < 0 || to < 0) return;
    const nova = [...ids];
    nova.splice(from, 1);
    const indiceAlvo = nova.indexOf(alvoId);
    nova.splice(indiceAlvo, 0, arrastadoId);
    await salvarNovaOrdem(nova);
  };

  const moverFichaNaOrdem = async (fichaId, deslocamento) => {
    const idsVisiveis = filtradas.map(ficha => ficha.id);
    const indice = idsVisiveis.indexOf(fichaId);
    const alvoId = idsVisiveis[indice + deslocamento];
    if (!alvoId) return;
    const idsCompletos = [...fichas].sort(ordenarFichas).map(ficha => ficha.id);
    const nova = idsCompletos.filter(id => id !== fichaId);
    const indiceAlvo = nova.indexOf(alvoId);
    nova.splice(deslocamento < 0 ? indiceAlvo : indiceAlvo + 1, 0, fichaId);
    await salvarNovaOrdem(nova);
  };

  const abrirNova = () => {
    setForm({
      ...FORM_RECEITA_VAZIO(deptUrl, metaCmv),
      id: gerarUuid(),
      produto_id: gerarUuid(),
      unidade_origem: unidadeAtiva,
      nova_ficha: true,
    });
    setIngFicha([]);
    setAutoSoma(true);
    setCalcQtd("");
    setIaExplicacao("");
    setModalNovo(true);
  };

  const mapearIngredientesDaFicha = (ficha) => (ficha.fichas_ingredientes || []).map(fi => {
     if (fi.subficha_id) {
        const base = fichas.find(x => x.id === fi.subficha_id);
        return {
           chave: fi.subficha_id, tipo: "base", subficha_id: fi.subficha_id,
           nome: base?.nome_receita || "Base",
           unidade: base?.rendimento_unidade || "un",
           custo_unitario: base ? custoUnitBase(base, fichas) : 0,
           quantidade: fi.quantidade,
           modo: getSub(base?.rendimento_unidade) ? "sub" : "base",
        };
     }
     if (!fi.insumos) return null;
     return {
        chave: fi.insumos.id, tipo: "insumo", insumo_id: fi.insumos.id,
        nome: fi.insumos.nome, unidade: fi.insumos.unidade_medida,
        custo_unitario: fi.insumos.custo_unitario, quantidade: fi.quantidade,
        peso_medio_g: fi.insumos.peso_medio_g || null,
        modo: getSub(fi.insumos.unidade_medida) ? "sub" : "base",
     };
  }).filter(Boolean);

  const abrirEditar = (ficha, duplicar = false) => {
    const candidatosProduto = produtosSimplesVinculados(ficha, produtos);
    const produto = candidatosProduto.length === 1 ? candidatosProduto[0] : null;
    const imagemProdutoBase64 = String(produto?.imagem_url || "").startsWith("data:image")
      ? String(produto.imagem_url).split(",")[1] || ""
      : "";
    setAutoSoma(false);
    setForm({
       ...FORM_RECEITA_VAZIO(ficha.departamento || deptUrl, metaCmv),
       id: duplicar ? gerarUuid() : ficha.id,
       departamento: ficha.departamento,
       nome_receita: duplicar ? `Cópia de ${ficha.nome_receita}` : ficha.nome_receita,
       categoria: ficha.categoria || produto?.categoria || (ficha.departamento === "bar" ? "Drinks" : "Pratos Principais"),
       rendimento_porcoes: ficha.rendimento_porcoes,
       modo_preparo: ficha.modo_preparo || "",
       eh_base: !!ficha.eh_base,
       rendimento_unidade: ficha.rendimento_unidade || "porcao",
       unidade_venda: duplicar
         ? unidadeVendaCalculada(ficha.rendimento_unidade, ficha.peso_porcao_g)
         : (ficha.unidade_venda || ""),
       peso_porcao_g: ficha.peso_porcao_g || "",
       imagem: ficha.imagem || imagemProdutoBase64,
       imagem_url_original: !ficha.imagem && !imagemProdutoBase64 ? (produto?.imagem_url || "") : "",
       imagem_removida: false,
       produto_id: duplicar ? gerarUuid() : (produto?.id || null),
       preco_venda: produto?.preco_venda ? String(produto.preco_venda) : "",
       tempo_preparo_base: String(produto?.tempo_preparo_base ?? 15),
       produto_ativo: duplicar ? false : (!!produto && produto.ativo !== false && Number(produto.preco_venda) > 0),
       meta_cmv: String(metaCmv),
       unidade_origem: ficha.unidade_id || unidadeAtiva,
       nova_ficha: duplicar,
    });
    setCalcQtd("");
    // Reconstrói os ingredientes: cada um é um INSUMO ou uma BASE (sub-ficha).
    setIngFicha(mapearIngredientesDaFicha(ficha));
    setIaExplicacao("");
    setModalNovo(true);
  };

  const selecionarProdutoDaReceita = (valor) => {
    if (!valor) {
      setForm(atual => ({ ...atual, produto_id: null, preco_venda: "", produto_ativo: false }));
      return;
    }
    if (valor === "__novo__") {
      setForm(atual => ({
        ...atual,
        produto_id: gerarUuid(),
        preco_venda: "",
        tempo_preparo_base: "15",
        produto_ativo: false,
        imagem_url_original: "",
        imagem_removida: false,
      }));
      return;
    }
    const produto = produtos.find(item => item.id === valor);
    if (!produto) return;
    setForm(atual => ({
      ...atual,
      produto_id: produto.id,
      preco_venda: Number.isFinite(Number(produto.preco_venda)) ? String(produto.preco_venda) : "",
      tempo_preparo_base: String(produto.tempo_preparo_base ?? 0),
      produto_ativo: produto.ativo !== false && Number(produto.preco_venda) > 0,
      imagem_url_original: atual.imagem ? atual.imagem_url_original : (produto.imagem_url || atual.imagem_url_original),
    }));
  };

  const abrirProdutoSimples = (produto = null) => {
    const base = FORM_PRODUTO_VAZIO(deptUrl);
    const componentes = componentesDoProduto(produto);
    setFormProduto(produto ? {
      ...base,
      ...produto,
      preco_venda: produto.preco_venda ? String(produto.preco_venda) : "",
      tempo_preparo_base: String(produto.tempo_preparo_base ?? 0),
      vinculo_ficha_id: componentes.length === 1 ? (componentes[0]?.ficha_id || "") : "",
      unidade_origem: produto.unidade_id || unidadeAtiva,
      novo_produto: false,
    } : {
      ...base,
      id: gerarUuid(),
      unidade_origem: unidadeAtiva,
      novo_produto: true,
    });
    setModalProduto(true);
  };

  const handleMudarFotoProduto = async (evento) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    try {
      const base64 = await processarEComprimirImagem(arquivo);
      setFormProduto(atual => ({ ...atual, imagem_url: `data:image/jpeg;base64,${base64}` }));
    } catch {
      alert("Não foi possível processar esta imagem.");
    }
  };

  const salvarProdutoSimples = async () => {
    if (salvandoProduto) return;
    if (formProduto.unidade_origem !== unidadeAtiva) {
      return alert("A unidade foi alterada. Feche esta janela e abra o item novamente.");
    }
    const nome = String(formProduto.nome_produto || "").trim();
    const preco = Number(String(formProduto.preco_venda || "0").replace(",", "."));
    const tempoPreparo = Number(String(formProduto.tempo_preparo_base || "0").replace(",", "."));
    if (!nome) return alert("Digite o nome do item.");
    if (!Number.isFinite(preco) || preco < 0) return alert("Informe um preço válido.");
    if (!Number.isFinite(tempoPreparo) || tempoPreparo < 0) return alert("Informe um tempo de preparo igual ou maior que zero.");
    if (formProduto.ativo && preco <= 0) return alert("Para publicar, informe um preço maior que zero.");

    const componentesOriginais = componentesDoProduto(formProduto);
    const podeAlterarVinculo = componentesOriginais.length <= 1;
    const fichaVinculada = fichas.find(item => item.id === formProduto.vinculo_ficha_id);
    if (formProduto.vinculo_ficha_id && !fichaVinculada) return alert("A ficha técnica selecionada não está mais disponível.");
    const quantidadeAnterior = componentesOriginais.find(item => item?.ficha_id === formProduto.vinculo_ficha_id)?.qtd;
    const composicaoVinculada = formProduto.vinculo_ficha_id
      ? [{ ficha_id: formProduto.vinculo_ficha_id, qtd: Number(quantidadeAnterior) || 1 }]
      : [];

    setSalvandoProduto(true);
    try {
      const payload = produtoParaSalvar(formProduto, {
        unidade_id: unidadeAtiva,
        nome_produto: nome,
        categoria: String(formProduto.categoria || "").trim() || (deptUrl === "bar" ? "Bebidas" : "Pratos Principais"),
        departamento: deptUrl,
        preco_venda: preco,
        tempo_preparo_base: tempoPreparo,
        codigo_barras: String(formProduto.codigo_barras || "").trim() || null,
        imagem_url: formProduto.imagem_url || null,
        ativo: !!formProduto.ativo && preco > 0,
        ...(podeAlterarVinculo ? {
          ficha_id: formProduto.vinculo_ficha_id || null,
          composicao: composicaoVinculada,
        } : {}),
      });
      const resultado = await salvarProduto(payload, { unidadeId: unidadeAtiva, permitirInserirComId: true });
      if (resultado.error) throw new Error(resultado.error);
      await carregar();
      setModalProduto(false);
    } catch (error) {
      alert("Não foi possível salvar o item do cardápio.\n\n" + (error?.message || error));
    } finally {
      setSalvandoProduto(false);
    }
  };

  const criarFichaParaProduto = (produto = formProduto) => {
    if (componentesDoProduto(produto).length > 0) {
      return alert("Este item já possui uma composição. Use a edição avançada para revisar os componentes.");
    }
    const imagemBase64 = String(produto?.imagem_url || "").startsWith("data:image")
      ? String(produto.imagem_url).split(",")[1] || ""
      : "";
    setForm({
      ...FORM_RECEITA_VAZIO(deptUrl, metaCmv),
      id: gerarUuid(),
      produto_id: produto.id,
      unidade_origem: unidadeAtiva,
      nova_ficha: true,
      nome_receita: produto.nome_produto || "",
      categoria: produto.categoria || (deptUrl === "bar" ? "Bebidas" : "Pratos Principais"),
      preco_venda: produto.preco_venda ? String(produto.preco_venda) : "",
      tempo_preparo_base: String(produto.tempo_preparo_base ?? 0),
      produto_ativo: produto.ativo !== false && Number(produto.preco_venda) > 0,
      imagem: imagemBase64,
      imagem_url_original: imagemBase64 ? "" : (produto.imagem_url || ""),
    });
    setIngFicha([]);
    setAutoSoma(false);
    setModalProduto(false);
    setModalNovo(true);
  };

  const duplicarFicha = (ficha) => abrirEditar(ficha, true);

  const calcularCustoTotal = (ingredientesLista) => {
    return ingredientesLista.reduce((acc, ing) => acc + (ing.custo_unitario * ing.quantidade), 0);
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
    setIngFicha([...ingFicha, novo]);
  };

  // Recebe a quantidade JÁ em unidade-base (a conversão acontece no onChange do input)
  const updateQtd = (chave, qtdBase) => {
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, quantidade: Number(qtdBase) || 0 } : i));
  };

  const toggleModo = (chave) => {
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, modo: i.modo === 'sub' ? 'base' : 'sub' } : i));
  };

  const removeIngrediente = (chave) => {
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

  const fecharSubstituicao = () => {
    setSubstituirAlvo(null);
    setSubstitutoValor("");
    window.setTimeout(() => focoSubstituicaoRef.current?.focus?.(), 20);
  };

  // Escala os ingredientes de uma ficha por um fator (simulação de rendimento)
  const abrirCadastroInsumo = () => {
    focoAbrirInsumoRef.current = document.activeElement;
    setFormInsumo({
      nome: "", categoria: "", unidade_medida: "kg", custo_unitario: "",
      marca: "", fornecedor: "", observacoes: "",
    });
    setModalInsumo(true);
  };

  const salvarNovoInsumo = async () => {
    if (salvandoInsumo) return;
    const nome = formInsumo.nome.trim();
    const custo = Number(String(formInsumo.custo_unitario || "0").replace(",", "."));
    if (!nome) return alert("Digite o nome do ingrediente.");
    if (!Number.isFinite(custo) || custo < 0) return alert("Informe um custo válido.");
    setSalvandoInsumo(true);
    try {
      const categoria = formInsumo.categoria
        || adivinharCategoria(nome, deptUrl, formInsumo.marca)
        || "Outros";
      const resultado = await salvarInsumo({
        unidade_id: unidadeAtiva,
        departamento: deptUrl,
        nome,
        marca: formInsumo.marca.trim(),
        categoria,
        unidade_medida: formInsumo.unidade_medida,
        custo_unitario: custo,
        tamanho_embalagem: 1,
        custo_compra: custo,
        fornecedor: formInsumo.fornecedor.trim() || null,
        observacoes: formInsumo.observacoes.trim() || null,
      });
      if (resultado.error || !resultado.id) throw new Error(resultado.error || "Ingrediente sem identificador.");
      const novo = {
        id: resultado.id,
        nome,
        marca: formInsumo.marca.trim(),
        categoria,
        unidade_medida: formInsumo.unidade_medida,
        custo_unitario: custo,
        departamento: deptUrl,
      };
      setInsumosAtivos(lista => [...lista, novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setIngFicha(lista => [...lista, {
        chave: novo.id,
        tipo: "insumo",
        insumo_id: novo.id,
        nome: novo.nome,
        unidade: novo.unidade_medida,
        custo_unitario: novo.custo_unitario,
        quantidade: 0,
        peso_medio_g: null,
        modo: getSub(novo.unidade_medida) ? "sub" : "base",
      }]);
      fecharModalInsumo();
    } catch (error) {
      alert(error?.message || "Não foi possível cadastrar o ingrediente.");
    } finally {
      setSalvandoInsumo(false);
    }
  };

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
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Simulação — ${f.nome_receita}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px;max-width:620px;margin:0 auto}
      .tag{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
      h1{font-size:34px;margin:6px 0}.meta{font-size:20px;font-weight:bold;color:#0f172a;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:22px}td{padding:12px 6px;border-bottom:2px solid #e2e8f0;font-weight:600}
      @media print{@page{margin:14mm}}</style></head><body>
      <div class="tag">Simulação de Rendimento</div><h1>${f.nome_receita}</h1>
      <div class="meta">Para produzir: ${alvoTxt}</div>
      <table><tbody>${rows || '<tr><td>Sem ingredientes.</td></tr>'}</tbody></table>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const handleSalvar = async ({ criarOutra = false } = {}) => {
    if (salvando) return;
    if (form.unidade_origem !== unidadeAtiva) {
      return alert("A unidade foi alterada. Feche esta janela e abra a receita novamente.");
    }
    const nome = form.nome_receita.trim();
    const rendimento = Number(String(form.rendimento_porcoes).replace(",", "."));
    const precoVenda = Number(String(form.preco_venda || "0").replace(",", "."));
    const tempoPreparo = Number(String(form.tempo_preparo_base || "0").replace(",", "."));
    const pesoPorcao = form.peso_porcao_g === "" || form.peso_porcao_g === null
      ? null
      : Number(String(form.peso_porcao_g).replace(",", "."));
    const metaNova = Number(String(form.meta_cmv || metaCmv).replace(",", "."));

    if (!nome) return alert("Digite o nome da receita.");
    if (!Number.isFinite(rendimento) || rendimento <= 0) return alert("Informe um rendimento válido e maior que zero.");
    if (!Number.isFinite(precoVenda) || precoVenda < 0) return alert("Informe um preço de venda igual ou maior que zero.");
    if (!Number.isFinite(tempoPreparo) || tempoPreparo < 0) return alert("Informe um tempo de preparo igual ou maior que zero.");
    if (pesoPorcao !== null && (!Number.isFinite(pesoPorcao) || pesoPorcao <= 0)) {
      return alert("O peso ou volume por porção deve ser maior que zero.");
    }
    if (!form.eh_base && form.produto_ativo && (!Number.isFinite(precoVenda) || precoVenda <= 0)) {
      return alert("Para publicar no cardápio, informe um preço de venda maior que zero.");
    }
    if (!Number.isFinite(metaNova) || metaNova <= 0 || metaNova > 100) {
      return alert("A meta de CMV deve estar entre 1% e 100%.");
    }

    const ingValidos = ingFicha.filter(i => Number(i.quantidade) > 0);
    if (ingValidos.length === 0) return alert("Adicione pelo menos um ingrediente com quantidade válida.");
    const baseQueCriaCiclo = form.id && ingValidos.find(item =>
      item.tipo === "base" && fichaReferenciaOutra(item.subficha_id, form.id, fichas)
    );
    if (baseQueCriaCiclo) {
      return alert(`O pré-preparo "${baseQueCriaCiclo.nome}" já depende desta receita e criaria um ciclo. Escolha outra base.`);
    }
    if (form.eh_base && form.id && produtosSimplesVinculados({ id: form.id }, produtos).length > 1) {
      return alert("Esta receita possui mais de uma variante no cardápio. Desvincule as variantes antes de transformá-la em pré-preparo.");
    }

    const eraNovaFicha = !!form.nova_ficha;
    const fichaAnterior = eraNovaFicha ? null : fichas.find(item => item.id === form.id);
    const ingredientesAnteriores = (fichaAnterior?.fichas_ingredientes || []).map(item => ({
      insumo_id: item.insumo_id || item.insumos?.id || null,
      subficha_id: item.subficha_id || null,
      quantidade: Number(item.quantidade) || 0,
    }));

    setSalvando(true);
    try {
      const resultadoFicha = await salvarFicha(
        {
          id: form.id,
          unidade_id: unidadeAtiva,
          departamento: form.departamento,
          nome_receita: nome,
          categoria: form.eh_base ? null : (form.categoria?.trim() || null),
          rendimento_porcoes: rendimento,
          modo_preparo: form.modo_preparo,
          eh_base: !!form.eh_base,
          rendimento_unidade: form.rendimento_unidade || "porcao",
          unidade_venda: form.nova_ficha
            ? unidadeVendaCalculada(form.rendimento_unidade, pesoPorcao)
            : (form.unidade_venda || null),
          peso_porcao_g: pesoPorcao,
          imagem: form.imagem || null,
        },
        ingValidos.map(i => ({
           insumo_id: i.tipo === "insumo" ? i.insumo_id : null,
           subficha_id: i.tipo === "base" ? i.subficha_id : null,
           quantidade: Number(i.quantidade),
        })),
        { unidadeId: unidadeAtiva, permitirInserirComId: !!form.nova_ficha }
      );

      if (resultadoFicha.error || !resultadoFicha.id) {
        throw new Error(resultadoFicha.error || "A receita não retornou um identificador.");
      }

      const fichaIdSalva = resultadoFicha.id;

      const produtoAtual = form.produto_id ? produtos.find(p => p.id === form.produto_id) : null;

      const componentesAtuais = Array.isArray(produtoAtual?.composicao) ? produtoAtual.composicao : [];
      const componenteAnterior = componentesAtuais.find(c => c?.ficha_id === form.id || c?.ficha_id === fichaIdSalva);
      const composicao = [
        { ficha_id: fichaIdSalva, qtd: Number(componenteAnterior?.qtd) || 1 },
        ...componentesAtuais.filter(c => c?.ficha_id !== form.id && c?.ficha_id !== fichaIdSalva),
      ];

      if (form.produto_id && (!form.eh_base || produtoAtual)) {
        const ehVarianteEntreVarias = !!produtoAtual && produtosSimplesVinculados({ id: form.id }, produtos).length > 1;
        const imagemPublica = form.imagem
          ? `data:image/jpeg;base64,${form.imagem}`
          : (form.imagem_removida ? null : (form.imagem_url_original || produtoAtual?.imagem_url || null));
        const payloadProduto = produtoParaSalvar(produtoAtual, {
          id: form.produto_id || gerarUuid(),
          unidade_id: unidadeAtiva,
          nome_produto: ehVarianteEntreVarias ? produtoAtual.nome_produto : nome,
          categoria: ehVarianteEntreVarias
            ? (produtoAtual.categoria || form.categoria?.trim() || (form.departamento === "bar" ? "Drinks" : "Pratos Principais"))
            : (form.categoria?.trim() || (form.departamento === "bar" ? "Drinks" : "Pratos Principais")),
          departamento: form.departamento,
          tempo_preparo_base: tempoPreparo,
          preco_venda: Number.isFinite(precoVenda) ? precoVenda : 0,
          ficha_id: fichaIdSalva,
          composicao,
          imagem_url: ehVarianteEntreVarias ? (produtoAtual.imagem_url || null) : imagemPublica,
          ativo: !form.eh_base && !!form.produto_ativo && precoVenda > 0,
          embalagens: produtoAtual?.embalagens || [],
          modificadores: produtoAtual?.modificadores || [],
          codigo_barras: produtoAtual?.codigo_barras || null,
          ncm: produtoAtual?.ncm || null,
          cest: produtoAtual?.cest || null,
          cfop: produtoAtual?.cfop || "5102",
          csosn: produtoAtual?.csosn || "102",
          origem_icms: produtoAtual?.origem_icms || "0",
        });
        const resultadoProduto = await salvarProduto(payloadProduto, { unidadeId: unidadeAtiva, permitirInserirComId: true });
        if (resultadoProduto.error) {
          const verificacao = await fetchProdutos(unidadeAtiva, null, { escopoEstrito: true });
          if (verificacao.error) {
            throw new Error(`A conexão caiu durante a confirmação. Recarregue a tela antes de tentar novamente. Detalhe: ${resultadoProduto.error}`);
          }
          const produtoConfirmado = (verificacao.data || []).find(item => item.id === payloadProduto.id);
          const composicaoConfirmada = componentesDoProduto(produtoConfirmado);
          const assinaturaComposicao = lista => (lista || [])
            .map(item => `${item?.ficha_id || ""}:${Number(item?.qtd) || 1}`)
            .sort()
            .join("|");
          const chegouAoBanco = !!produtoConfirmado
            && normalizarNome(produtoConfirmado.nome_produto) === normalizarNome(payloadProduto.nome_produto)
            && String(produtoConfirmado.categoria || "") === String(payloadProduto.categoria || "")
            && String(produtoConfirmado.departamento || "") === String(payloadProduto.departamento || "")
            && Math.abs(Number(produtoConfirmado.preco_venda) - Number(payloadProduto.preco_venda)) < 0.0001
            && Number(produtoConfirmado.tempo_preparo_base || 0) === Number(payloadProduto.tempo_preparo_base || 0)
            && (produtoConfirmado.ativo !== false) === (payloadProduto.ativo !== false)
            && String(produtoConfirmado.imagem_url || "") === String(payloadProduto.imagem_url || "")
            && assinaturaComposicao(composicaoConfirmada) === assinaturaComposicao(payloadProduto.composicao);
          if (!chegouAoBanco) {
            const reversao = eraNovaFicha
              ? await removerFicha(fichaIdSalva, unidadeAtiva)
              : await salvarFicha({
                  id: fichaAnterior.id,
                  unidade_id: fichaAnterior.unidade_id,
                  departamento: fichaAnterior.departamento,
                  nome_receita: fichaAnterior.nome_receita,
                  categoria: fichaAnterior.categoria || null,
                  rendimento_porcoes: fichaAnterior.rendimento_porcoes,
                  modo_preparo: fichaAnterior.modo_preparo || "",
                  eh_base: !!fichaAnterior.eh_base,
                  rendimento_unidade: fichaAnterior.rendimento_unidade || "porcao",
                  unidade_venda: fichaAnterior.unidade_venda || null,
                  peso_porcao_g: fichaAnterior.peso_porcao_g || null,
                  imagem: fichaAnterior.imagem || null,
                }, ingredientesAnteriores, { unidadeId: unidadeAtiva, permitirInserirComId: false });
            if (reversao.error) {
              throw new Error(`O cardápio não foi salvo e não foi possível restaurar a ficha. Recarregue antes de editar novamente. Detalhe: ${reversao.error}`);
            }
            throw new Error(`O cardápio não foi salvo e a alteração da ficha foi desfeita com segurança. Detalhe: ${resultadoProduto.error}`);
          }
        }
      }

      if (eraNovaFicha) setForm(atual => ({ ...atual, id: fichaIdSalva, nova_ficha: false }));

      if (metaNova !== metaCmv) {
        const resultadoMeta = await salvarParams(unidadeAtiva, { meta_cmv: metaNova });
        if (resultadoMeta.error) alert(`A receita foi salva, mas a nova meta de CMV não pôde ser aplicada: ${resultadoMeta.error}`);
        else setMetaCmv(metaNova);
      }

      if (eraNovaFicha && !form.eh_base) {
        try {
          const { data: montagens } = await fetchMontagens(unidadeAtiva, form.departamento);
          const jaExiste = (montagens || []).some(m => normalizarNome(m.nome) === normalizarNome(nome));
          if (!jaExiste) {
            await inserirMontagem({
              nome,
              tipo: form.departamento === "bar" ? "drink" : "prato",
              departamento: form.departamento,
              descritivo: "",
              foto_url: form.imagem ? `data:image/jpeg;base64,${form.imagem}` : "",
              estrutura_ia: null,
              tempo_preparo: tempoPreparo || null,
              rendimento: `${rendimento} ${form.rendimento_unidade || "porcao"}`,
              observacoes: "Criado junto com a receita e o cardápio.",
            }, unidadeAtiva);
          }
        } catch { /* a montagem pode ser concluída depois */ }
      }

      await carregar();
      if (criarOutra) {
        setForm({
          ...FORM_RECEITA_VAZIO(deptUrl, metaNova),
          id: gerarUuid(),
          produto_id: gerarUuid(),
          unidade_origem: unidadeAtiva,
          nova_ficha: true,
        });
        setIngFicha([]);
        setAutoSoma(true);
        setIaExplicacao("");
        setCalcQtd("");
      } else {
        setModalNovo(false);
      }
    } catch (error) {
      alert(error?.message || "Não foi possível salvar a receita e o cardápio.");
      await carregar();
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (id) => {
    const ficha = fichas.find(f => f.id === id);
    if (!ficha) return;
    const usadaPorOutraFicha = fichas.find(outra => outra.id !== id &&
      (outra.fichas_ingredientes || []).some(item => item?.subficha_id === id));
    if (usadaPorOutraFicha) {
      return alert(`Esta receita não pode ser excluída porque é usada em "${usadaPorOutraFicha.nome_receita}". Remova esse vínculo primeiro.`);
    }

    const todosProdutosResp = await fetchProdutos(unidadeAtiva, null, { escopoEstrito: true });
    if (todosProdutosResp.error) return alert("Não foi possível conferir os vínculos do cardápio. Tente novamente.");
    const produtosDependentes = (todosProdutosResp.data || []).filter(produto =>
      produto.ficha_id === id || componentesDoProduto(produto).some(item => item?.ficha_id === id)
    );
    const composto = produtosDependentes.find(produto => componentesDoProduto(produto).length > 1);
    if (composto) {
      return alert(`A receita faz parte do combo "${composto.nome_produto}". Retire-a da composição avançada antes de excluir.`);
    }

    const avisoProduto = produtosDependentes.length ? "\n\nO item será retirado do cardápio sem apagar o histórico de pedidos." : "";
    if (!confirm(`Excluir a receita "${ficha.nome_receita}"?${avisoProduto}\n\nEssa ação não pode ser desfeita.`)) return;

    const produtosAlterados = [];
    for (const produto of produtosDependentes) {
      // Inclui o item antes da chamada: se a resposta falhar depois de o banco
      // aplicar a mudança, ele também será restaurado.
      produtosAlterados.push(produto);
      const resultadoProduto = await salvarProduto(produtoParaSalvar(produto, {
        ativo: false,
        ficha_id: null,
        composicao: null,
      }), { unidadeId: unidadeAtiva });
      if (resultadoProduto.error) {
        const errosRestauracao = [];
        for (const anterior of produtosAlterados) {
          const restaurado = await salvarProduto(produtoParaSalvar(anterior), { unidadeId: unidadeAtiva });
          if (restaurado.error) errosRestauracao.push(restaurado.error);
        }
        return alert("Não foi possível retirar o item do cardápio: " + resultadoProduto.error
          + (errosRestauracao.length ? "\n\nUma restauração falhou. Recarregue a tela antes de editar novamente." : ""));
      }
    }

    const resultado = await removerFicha(id, unidadeAtiva);
    if (resultado.error) {
      const errosRestauracao = [];
      for (const anterior of produtosAlterados) {
        const restaurado = await salvarProduto(produtoParaSalvar(anterior), { unidadeId: unidadeAtiva });
        if (restaurado.error) errosRestauracao.push(restaurado.error);
      }
      return alert("A receita não pôde ser excluída porque ainda está sendo usada em outra ficha ou produção."
        + (errosRestauracao.length ? "\n\nO cardápio precisa ser recarregado antes de novas alterações." : "")
        + "\n\n" + resultado.error);
    }
    setSelecionadas(lista => lista.filter(itemId => itemId !== id));
    await carregar();
  };

  const todosVisiveisSelecionados = filtradas.length > 0 && filtradas.every(ficha => selecionadas.includes(ficha.id));

  const toggleSelecionarTodas = () => {
    if (todosVisiveisSelecionados) {
      const idsVisiveis = new Set(filtradas.map(ficha => ficha.id));
      setSelecionadas(atuais => atuais.filter(id => !idsVisiveis.has(id)));
    } else {
      setSelecionadas(atuais => [...new Set([...atuais, ...filtradas.map(f => f.id)])]);
    }
  };

  const toggleSelecionar = (id) => {
    setSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const imprimirLivroSelecionadas = () => {
    if (selecionadas.length === 0) return;
    const fichasParaImprimir = fichas.filter(f => selecionadas.includes(f.id));
    imprimirFichas(fichasParaImprimir, { incluirCapa: true, incluirIndice: true });
  };

  const imprimirFicha = (f) => {
    imprimirFichas([f]);
  };

  const imprimirFichas = (listaDeFichas, opcoes = {}) => {
    const listaLivro = (listaDeFichas || []).filter(Boolean);
    if (!listaLivro.length) return alert("Nenhuma receita disponível para imprimir.");
    const incluirCapa = opcoes.incluirCapa ?? listaLivro.length > 1;
    const incluirIndice = opcoes.incluirIndice ?? listaLivro.length > 1;
    const tituloLivro = deptUrl === "bar" ? "Livro de Coquetelaria" : "Livro de Receitas";
    const setorLivro = deptUrl === "bar" ? "Bar" : "Cozinha";
    const setorLivroMaiusculo = setorLivro.toLocaleUpperCase("pt-BR");
    const nomeUnidadeLivro = unidadeInfo?.nome || unidadeAtiva || "Unidade";
    const dataLivro = new Date().toLocaleDateString("pt-BR");
    const win = window.open('', '_blank');
    if(!win) return alert("Habilite pop-ups para imprimir a ficha.");
    const escaparHtml = (valor) => String(valor ?? "").replace(/[&<>"']/g, caractere => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[caractere]);
    const SUB = { kg: { s: 'g', fa: 1000 }, l: { s: 'ml', fa: 1000 } };
    const fmtQtd = (qtd, un) => {
       const quantidade = Number(qtd) || 0;
       const c = SUB[String(un || '').toLowerCase()];
       return c
         ? `${(quantidade * c.fa).toLocaleString('pt-BR')} ${c.s}`
         : `${quantidade.toLocaleString('pt-BR')} ${String(un || '').toUpperCase()}`;
    };
    
    let conteudoHTML = `
       <!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escaparHtml(tituloLivro)}</title>
       <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:210mm;margin:0 auto;background:#eef2f7;padding:10mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .bloco,.capa,.indice{background:#fff;min-height:277mm;padding:12mm;position:relative}
          /* Cada ficha começa em sua própria folha A4. */
          .bloco{display:flex;flex-direction:column;page-break-after:always;break-after:page}
          .bloco:last-child{page-break-after:auto;break-after:auto}
          .head{display:grid;grid-template-columns:minmax(68mm,42%) 1fr;gap:7mm;align-items:start;border-bottom:4px solid #0f172a;padding-bottom:5mm;margin-bottom:4mm}
          .head-info{flex:1;min-width:0}
          .head-foto{width:100%;height:67mm;border-radius:5mm;object-fit:contain;background:#f8fafc;border:1px solid #cbd5e1;display:block}
          .foto-vazia{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm;color:#64748b;background:linear-gradient(145deg,#f8fafc,#e2e8f0);text-align:center}
          .foto-vazia strong{font-size:34px;line-height:1;color:#94a3b8}
          .foto-vazia span{font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase}
          .tag{font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:#475569;font-weight:900;margin-top:1mm}
          .categoria-ficha{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:#b45309;font-weight:900;margin-top:2mm}
          h1{font-size:28px;line-height:1.08;margin:3mm 0;overflow-wrap:anywhere}
          .metas{display:flex;flex-direction:column;gap:1.5mm;margin-top:3mm}
          .meta{font-size:14px;color:#0f172a;font-weight:800}
          h2{font-size:14px;text-transform:uppercase;letter-spacing:2.4px;color:#0f172a;margin:5mm 0 2mm;border-bottom:1px solid #cbd5e1;padding-bottom:2mm}
          table{width:100%;border-collapse:collapse;font-size:14px}
          tr{break-inside:avoid;page-break-inside:avoid}
          th,td{text-align:left;padding:2.5mm 2mm;border-bottom:1px solid #e2e8f0}
          th{font-size:9px;text-transform:uppercase;letter-spacing:1.4px;color:#475569}
          td{font-weight:600}
          td.c{text-align:center}td.r,th.r{text-align:right}
          .preparo{margin-top:2mm;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4mm;padding:4mm;font-weight:500}
          .rodape-ficha{margin-top:auto;padding-top:6mm;display:flex;justify-content:space-between;gap:8px;border-top:1px solid #cbd5e1;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px}
          .capa{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always;break-after:page;border:1px solid #cbd5e1}
          .capa:before{content:'';position:absolute;inset:8mm;border:2px solid #0f172a;pointer-events:none}
          .capa-selo,.indice-selo{font-size:11px!important;letter-spacing:4px;text-transform:uppercase;color:#475569!important;font-weight:900}
          .capa h1{font-size:52px;line-height:1;margin:8mm 0 4mm;max-width:150mm}
          .capa-setor{font-size:22px!important;color:#b45309!important;text-transform:uppercase;letter-spacing:5px;font-weight:900}
          .capa-dados{margin-top:25mm;display:flex;flex-direction:column;gap:2mm;color:#475569;font-size:13px}
          .capa-dados strong{font-size:18px;color:#0f172a}
          .indice{page-break-after:always;break-after:page}
          .indice h1{font-size:38px;margin:4mm 0 10mm}
          .indice ol{list-style:none;border-top:3px solid #0f172a}
          .indice li{display:grid;grid-template-columns:12mm minmax(0,1fr) auto;gap:4mm;align-items:center;padding:4mm 1mm;border-bottom:1px solid #cbd5e1;break-inside:avoid}
          .indice-numero{font-size:11px;font-weight:900;color:#b45309}
          .indice-nome{font-size:15px;font-weight:900;overflow-wrap:anywhere}
          .indice-categoria{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;text-align:right}
          @media screen{.bloco,.capa,.indice{box-shadow:0 10px 30px rgba(15,23,42,.12);margin-bottom:10mm}}
          @media print{
            @page{size:A4 portrait;margin:10mm}
            body{max-width:none;background:#fff;padding:0}
            .bloco,.capa,.indice{min-height:277mm;padding:7mm;box-shadow:none;margin:0;border:none}
            .capa:before{inset:2mm}
          }
       </style></head><body>
    `;

    if (incluirCapa) {
       conteudoHTML += `
         <div class="capa">
           <p class="capa-selo">RECEITUÁRIO PADRÃO</p>
           <h1>${escaparHtml(tituloLivro)}</h1>
           <p class="capa-setor">${escaparHtml(setorLivro)}</p>
           <div class="capa-dados">
             <strong>${escaparHtml(nomeUnidadeLivro)}</strong>
             <span>${listaLivro.length} receita${listaLivro.length === 1 ? "" : "s"} catalogada${listaLivro.length === 1 ? "" : "s"}</span>
             <span>Atualizado em ${escaparHtml(dataLivro)}</span>
           </div>
         </div>
       `;
    }

    if (incluirIndice) {
       conteudoHTML += `
         <section class="indice">
           <p class="indice-selo">${escaparHtml(tituloLivro)} · ${escaparHtml(setorLivro)}</p>
           <h1>Índice</h1>
           <ol>
             ${listaLivro.map((f, indice) => `
               <li>
                 <span class="indice-numero">${String(indice + 1).padStart(2, "0")}</span>
                 <span class="indice-nome">${escaparHtml(f.nome_receita)}</span>
                 <span class="indice-categoria">${escaparHtml(f.categoria || (f.eh_base ? "Pré-preparo" : "Receita"))}</span>
               </li>
             `).join("")}
           </ol>
         </section>
       `;
    }

    listaLivro.forEach((f, idxFicha) => {
      const rows = (f.fichas_ingredientes || []).map(fi => {
         let nome = '', unidade = '';
         if (fi.insumos) {
            nome = fi.insumos.nome;
            unidade = fi.insumos.unidade_medida;
         } else if (fi.subficha_id) {
            const base = fichas.find(x => x.id === fi.subficha_id);
            nome = base ? base.nome_receita : 'Base excluída';
            unidade = base?.rendimento_unidade || 'un';
         }
         return `<tr><td>${escaparHtml(nome)}</td><td class="c">${escaparHtml(fmtQtd(fi.quantidade, unidade))}</td></tr>`;
      }).join('');
      const rende = f.rendimento_porcoes || 1;
      const peso = infoPesoFicha(f, fichas);
      const unR = String(f.rendimento_unidade || 'porcao').toLowerCase();
      const labelUnPrint = { porcao: `porç${rende > 1 ? 'ões' : 'ão'}`, kg: 'kg', g: 'g', l: 'L', ml: 'ml', un: 'un' }[unR] || unR;
      const rendimentoTexto = `${Number(rende).toLocaleString('pt-BR')} ${labelUnPrint}`;
      const produto = produtoVinculado(f, produtos);
      const tempoPreparo = Number(produto?.tempo_preparo_base) || 0;
      const linhasCabecalho = [
        peso ? `<div class="meta">Peso do prato: ${escaparHtml(fmtG(peso.pesoTotalG))}</div>` : "",
        `<div class="meta">Rendimento: ${escaparHtml(rendimentoTexto)}</div>`,
        `<div class="meta">Tempo de preparo: ${tempoPreparo > 0 ? `${tempoPreparo.toLocaleString('pt-BR')} min` : "Não informado"}</div>`,
      ].filter(Boolean).join("");

      const urlFoto = fotoDaFicha(f, produtos);
      const nomeFicha = escaparHtml(f.nome_receita || "Receita sem nome");
      const inicialFicha = escaparHtml(String(f.nome_receita || "?").trim().charAt(0).toLocaleUpperCase("pt-BR") || "?");
      const tagFoto = urlFoto
        ? `<img src="${escaparHtml(urlFoto)}" class="head-foto" alt="Foto de ${nomeFicha}" />`
        : `<div class="head-foto foto-vazia" role="img" aria-label="Foto não cadastrada para ${nomeFicha}"><strong>${inicialFicha}</strong><span>Foto não cadastrada</span></div>`;
      const categoriaFicha = f.categoria || (f.eh_base ? "Pré-preparo" : "Receita");

      conteudoHTML += `
         <div class="bloco">
            <div class="head">
               ${tagFoto}
               <div class="head-info">
                  <div class="tag">FICHA DE MONTAGEM — ${escaparHtml(setorLivroMaiusculo)}</div>
                  <div class="categoria-ficha">${escaparHtml(categoriaFicha)}</div>
                  <h1>${nomeFicha}</h1>
                  <div class="metas">${linhasCabecalho}</div>
               </div>
            </div>
            <h2>Ingredientes</h2>
            <table>
               <thead><tr><th>Ingrediente</th><th class="c">Quantidade</th></tr></thead>
               <tbody>${rows || '<tr><td colspan="2">Sem ingredientes cadastrados.</td></tr>'}</tbody>
            </table>
            <h2>Montagem e Modo de Preparo</h2>
            <div class="preparo">${escaparHtml(f.modo_preparo || 'Não informado.')}</div>
            <div class="rodape-ficha">
              <span>${escaparHtml(nomeUnidadeLivro)}</span>
              <span>Receita ${idxFicha + 1} de ${listaLivro.length}</span>
            </div>
         </div>
      `;
    });

    conteudoHTML += `</body></html>`;
    win.document.write(conteudoHTML);
    win.document.close();
    const aguardarRecursosEImprimir = async () => {
      const imagens = [...win.document.images];
      const imagensProntas = imagens.map(imagem => {
        if (imagem.complete) return Promise.resolve();
        return new Promise(resolve => {
          imagem.addEventListener("load", resolve, { once: true });
          imagem.addEventListener("error", resolve, { once: true });
        });
      });
      const fontesProntas = win.document.fonts?.ready
        ? Promise.resolve(win.document.fonts.ready).catch(() => undefined)
        : Promise.resolve();
      const recursosProntos = Promise.allSettled([fontesProntas, ...imagensProntas]);
      const timeoutSeguro = new Promise(resolve => win.setTimeout(resolve, 5000));
      await Promise.race([recursosProntos, timeoutSeguro]);
      if (win.closed) return;
      win.focus();
      win.print();
    };
    void aguardarRecursosEImprimir();
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-200 py-4 sm:py-5 px-4 sm:px-6 sticky top-0 z-10">
         <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
               <div className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl items-center justify-center bg-amber-50 text-amber-700 border border-amber-100">
                 <UtensilsCrossed size={27} />
               </div>
              <div className="min-w-0">
                 <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 truncate">Ficha Técnica</h1>
                 <p className="text-slate-500 font-bold text-xs mt-1">Ficha técnica, custos e preço em um só lugar · {deptUrl === "bar" ? "Bar" : "Cozinha"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto overflow-x-auto">
               <button
                  onClick={() => imprimirFichas(fichas, { incluirCapa: true, incluirIndice: true })}
                  disabled={loading || !!erroCarregamento || fichas.length === 0}
                  title={deptUrl === "bar" ? "Imprimir todas as fichas do bar" : "Imprimir todas as fichas da cozinha"}
                  className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 sm:px-4 py-3 rounded-xl font-bold whitespace-nowrap hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
               >
                  <Printer size={18} /> <span className="hidden sm:inline">{deptUrl === "bar" ? "Livro de Coquetelaria" : "Livro de Receitas"} ({fichas.length})</span><span className="sm:hidden">Livro ({fichas.length})</span>
               </button>
               <button onClick={abrirModalIAFicha} disabled={!!erroCarregamento} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-3 sm:px-4 py-3 rounded-xl font-bold whitespace-nowrap hover:bg-emerald-50 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  <Sparkles size={18} /> <span className="hidden sm:inline">Montar com IA</span><span className="sm:hidden">IA</span>
               </button>
               <button onClick={() => abrirProdutoSimples()} disabled={!!erroCarregamento} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 sm:px-4 py-3 rounded-xl font-bold whitespace-nowrap hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  <Package size={18} /> <span className="hidden sm:inline">Novo item pronto</span><span className="sm:hidden">Item</span>
               </button>
               <button onClick={abrirNova} disabled={!!erroCarregamento} className="flex items-center gap-2 text-white px-4 sm:px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-colors shadow-lg bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus size={18} /> Nova Receita
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
         <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
               <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{deptUrl === "bar" ? "Drinks e preparos" : "Receitas"}</h2>
               <p className="text-sm font-medium text-slate-500 mt-1">{fichas.length} ficha{fichas.length !== 1 ? "s" : ""} técnica{fichas.length !== 1 ? "s" : ""} · {produtosSemFicha.length} item{produtosSemFicha.length !== 1 ? "s" : ""} pronto{produtosSemFicha.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
               <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2 text-center min-w-0 sm:min-w-[110px]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">CMV médio</p>
                  <p className={`text-lg font-black ${cmvMedio !== null && cmvMedio > metaCmv ? "text-rose-600" : "text-emerald-600"}`}>{cmvMedio !== null ? `${cmvMedio.toFixed(1)}%` : "—"}</p>
               </div>
               <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2 text-center min-w-0 sm:min-w-[110px]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Acima da meta</p>
                  <p className={`text-lg font-black ${acimaDaMeta ? "text-rose-600" : "text-emerald-600"}`}>{acimaDaMeta}</p>
               </div>
               <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2 text-center min-w-0 sm:min-w-[110px]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Sem preço</p>
                  <p className={`text-lg font-black ${aguardandoPreco ? "text-amber-600" : "text-emerald-600"}`}>{aguardandoPreco}</p>
               </div>
            </div>
         </div>
         {/* Abas: Pratos + categorias do cardápio + Pré-preparos + Todos */}
         <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
            {[
              ["Pratos", deptUrl === "bar" ? "Drinks" : "Pratos", fichas.filter(f => !f.eh_base).length],
               ...categoriasCardapio
                 .filter(c => fichas.some(f => !f.eh_base && (f.categoria || produtoVinculado(f, produtos)?.categoria || "") === c) || produtosSemFicha.some(p => p.categoria === c))
                 .map(c => [c, c, fichas.filter(f => !f.eh_base && (f.categoria || produtoVinculado(f, produtos)?.categoria || "") === c).length + produtosSemFicha.filter(p => p.categoria === c).length]),
               ["Itens prontos", "Itens e variantes", produtosSemFicha.length],
               ["Pré-preparos", "Pré-preparos", fichas.filter(f => !!f.eh_base).length],
               ["Todos", "Todos", fichas.length + produtosSemFicha.length],
            ].map(([t, label, n]) => (
              <button key={t} type="button" aria-pressed={tipoFiltro === t} onClick={() => setTipoFiltro(t)}
                className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${tipoFiltro === t ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                {label} <span className={tipoFiltro === t ? "text-emerald-200" : "text-slate-400"}>({n})</span>
              </button>
            ))}
         </div>
         {tipoFiltro === "Pratos" && (
            <p className="text-[11px] font-bold text-slate-400 mb-4 px-1">
              {deptUrl === "bar"
                ? "Monte o drink, calcule o custo, defina o preço e publique no cardápio sem sair desta tela."
                : "Monte o prato, calcule o custo, defina o preço e publique no cardápio sem sair desta tela."}
            </p>
         )}
         {tipoFiltro === "Pré-preparos" && (
            <p className="text-[11px] font-bold text-slate-400 mb-4 px-1">
              {deptUrl === "bar"
                ? "Bases usadas dentro dos drinks (xarope simples, mix de limão, infusões, espumas). Marque \"É uma base/pré-preparo\" ao criar."
                : "Bases usadas dentro de outros pratos (molhos, massas, caldos). Marque \"É uma base/pré-preparo\" ao criar."}
            </p>
         )}
         {tipoFiltro === "Itens prontos" && (
            <p className="text-[11px] font-bold text-slate-400 mb-4 px-1">
              Bebidas e embalados sem receita, além de tamanhos P/M/G vinculados à mesma ficha, ficam aqui.
            </p>
         )}
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex flex-col sm:flex-row items-center gap-3 shadow-sm justify-between">
            <div className="flex flex-1 items-center gap-2 px-2">
               <Search size={20} className="text-slate-500" />
               <input type="search" aria-label="Pesquisar cardápio e receitas por nome" placeholder="Pesquisar por nome..." value={busca} onChange={e=>setBusca(e.target.value)} className="w-full outline-none font-bold text-slate-700 p-2" />
            </div>
            <select aria-label="Ordenar cardápio e receitas" value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="w-full sm:w-auto p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-600 outline-none focus:border-amber-500">
               <option value="recentes">Mais recentes</option>
               <option value="manual">Ordem personalizada</option>
               <option value="nome">Nome (A–Z)</option>
               <option value="maior-cmv">Maior CMV</option>
               <option value="maior-custo">Maior custo</option>
            </select>
            
            {/* Controles de Livro de Receitas */}
             {tipoFiltro !== "Itens prontos" && <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-3 w-full sm:w-auto">
                <button type="button" aria-pressed={todosVisiveisSelecionados} onClick={toggleSelecionarTodas} className="min-h-11 text-xs font-bold text-slate-500 hover:text-emerald-600 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 whitespace-nowrap">
                  {todosVisiveisSelecionados ? "Desmarcar visíveis" : "Selecionar visíveis"}
               </button>
               {selecionadas.length > 0 && (
                  <button onClick={imprimirLivroSelecionadas} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 text-xs shadow-md">
                     <Printer size={16}/> Imprimir Livro ({selecionadas.length})
                  </button>
               )}
             </div>}
         </div>

         {loading ? (
            <p className="font-bold text-slate-500">Buscando receitas...</p>
         ) : erroCarregamento ? (
            <div className="text-center p-8 sm:p-10 bg-rose-50 border border-rose-200 rounded-3xl" role="alert">
               <AlertTriangle size={40} className="mx-auto text-rose-500 mb-4"/>
               <h3 className="text-xl font-black text-rose-800">Não foi possível carregar esta unidade</h3>
               <p className="text-rose-700 mt-2 font-medium">Seus dados não foram apagados. Verifique a internet e tente novamente.</p>
               <button onClick={carregar} className="mt-5 px-5 py-3 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700">Tentar novamente</button>
            </div>
         ) : filtradas.length === 0 && filtradosProdutosSemFicha.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <LayoutList size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">Nenhum item encontrado</h3>
               <p className="text-slate-500 mt-2 font-medium">{busca ? "Tente outro nome ou filtro." : (tipoFiltro === "Itens prontos" ? "Cadastre bebidas ou itens vendidos sem receita." : "Cadastre uma receita para calcular custos e preço.")}</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {filtradas.map((f, indiceVisivel) => {
                  const produto = produtoVinculado(f, produtos);
                  const variantes = produtosSimplesVinculados(f, produtos);
                  const m = metricasReceita(f, produto, fichas, embalagens);
                  const acima = m.cmv !== null && m.cmv > metaCmv;
                  const publicado = !!produto && produto.ativo !== false && m.precoVenda > 0;
                  const foto = f.imagem ? `data:image/jpeg;base64,${f.imagem}` : produto?.imagem_url;
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
                  const labelUn = { porcao: "porções", kg: "kg", g: "g", l: "L", ml: "ml", un: "unidades" }[unR] || unR;

                  return (
                     <article key={f.id}
                        style={{ order: ordemVisualGlobal.get(`f:${f.id}`) }}
                        onDragOver={e => { if (dragId) e.preventDefault(); }}
                        onDrop={() => reordenar(dragId, f.id)}
                        className={`bg-white rounded-[28px] border shadow-sm hover:shadow-lg transition-all relative group flex flex-col overflow-hidden ${dragId === f.id ? "opacity-50" : ""} ${selecionadas.includes(f.id) ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200"}`}>
                        <div className="h-52 sm:h-60 bg-slate-100 relative overflow-hidden">
                           {foto ? (
                              <img src={foto} alt={f.nome_receita} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                           ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-gradient-to-br from-slate-50 to-slate-100">
                                 {f.departamento === "bar" ? <Wine size={58}/> : <UtensilsCrossed size={58}/>}
                                 <span className="text-xs font-bold mt-2">Adicione uma foto</span>
                              </div>
                           )}
                           <label className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-xl p-2 cursor-pointer shadow-sm">
                              <input type="checkbox" aria-label={`Selecionar ${f.nome_receita} para impressão`} checked={selecionadas.includes(f.id)} onChange={() => toggleSelecionar(f.id)} className="w-5 h-5 accent-amber-600 cursor-pointer rounded-md block"/>
                           </label>
                           <div className="absolute top-3 right-3 flex gap-2">
                              {f.eh_base ? (
                                 <span className="px-3 py-1.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">Pré-preparo</span>
                              ) : variantes.length > 1 ? (
                                 <span className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">{variantes.length} variantes</span>
                              ) : (
                                 <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${publicado ? "bg-emerald-600 text-white" : "bg-white/95 text-amber-700"}`}>
                                    {publicado ? "Publicado" : "Rascunho"}
                                 </span>
                              )}
                           </div>
                           <div className="absolute bottom-3 left-3 flex items-center gap-1">
                              {ordenacao === "manual" && (
                                 <>
                                    <button type="button" aria-label={`Mover ${f.nome_receita} para cima`} disabled={indiceVisivel === 0} onClick={() => moverFichaNaOrdem(f.id, -1)} className="w-11 h-11 inline-flex items-center justify-center bg-white/95 backdrop-blur rounded-xl text-slate-600 shadow-sm disabled:opacity-30"><ArrowUp size={17}/></button>
                                    <button type="button" aria-label={`Mover ${f.nome_receita} para baixo`} disabled={indiceVisivel === filtradas.length - 1} onClick={() => moverFichaNaOrdem(f.id, 1)} className="w-11 h-11 inline-flex items-center justify-center bg-white/95 backdrop-blur rounded-xl text-slate-600 shadow-sm disabled:opacity-30"><ArrowDown size={17}/></button>
                                 </>
                              )}
                              {ordenacao === "manual" && (
                                 <button draggable onDragStart={() => setDragId(f.id)} onDragEnd={() => setDragId(null)}
                                    aria-label={`Arrastar ${f.nome_receita} para reordenar`}
                                    title="Arraste para reordenar"
                                    className="w-11 h-11 inline-flex items-center justify-center bg-white/95 backdrop-blur rounded-xl text-slate-500 shadow-sm cursor-grab active:cursor-grabbing">
                                    <GripVertical size={17} />
                                 </button>
                              )}
                           </div>
                           <button onClick={() => abrirEditar(f)} className="absolute bottom-3 right-3 min-h-11 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur rounded-xl text-slate-700 font-black text-xs shadow-sm hover:text-amber-700">
                              <Edit3 size={15}/> Editar tudo
                           </button>
                        </div>

                        <div className="p-5 sm:p-6 flex-1 flex flex-col">
                           <div className="min-h-[56px]">
                              {acima && (
                                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-black mb-2">
                                    <AlertTriangle size={13}/> Acima do CMV meta ({metaCmv}%)
                                 </span>
                              )}
                              {!f.eh_base && variantes.length === 0 && !m.precoVenda && (
                                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-black mb-2">
                                    Defina o preço para publicar
                                 </span>
                              )}
                              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{f.nome_receita}</h3>
                              <p className="text-xs font-bold text-slate-500 mt-1">
                                 {f.categoria || produto?.categoria || "Sem categoria"} · Rende {Number(f.rendimento_porcoes).toLocaleString("pt-BR")} {labelUn}
                                 {produto?.tempo_preparo_base ? ` · ${produto.tempo_preparo_base} min` : ""}
                              </p>
                           </div>

                           <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4 mt-5 pt-5 border-t border-slate-100">
                              <div><p className="text-xs font-medium text-slate-500">Custo total</p><p className="text-lg font-black text-amber-700">{fmtBRL(m.custoTotal)}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">Custo/{m.unidadeVenda.rotulo}</p><p className="text-lg font-black text-slate-900">{m.custoPorcao !== null ? fmtBRL(m.custoPorcao) : "—"}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">Custo da receita/{m.peso?.liquido ? "L" : "kg"}</p><p className="text-lg font-black text-slate-900">{m.custoKg !== null ? fmtBRL(m.custoKg) : "—"}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">Preço/{m.unidadeVenda.rotulo}</p><p className="text-lg font-black text-slate-900">{m.precoVenda > 0 ? fmtBRL(m.precoVenda) : "—"}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">CMV teórico</p><p className={`text-lg font-black ${acima ? "text-rose-600" : "text-emerald-600"}`}>{m.cmv !== null ? `${m.cmv.toFixed(1)}%` : "—"}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">Margem</p><p className={`text-lg font-black ${m.margem !== null && m.margem >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{m.margem !== null ? `${m.margem.toFixed(1)}%` : "—"}</p></div>
                           </div>

                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-5 pt-4 border-t border-slate-100">
                              <button onClick={() => duplicarFicha(f)} className="min-h-11 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-600 hover:text-amber-700 rounded-xl hover:bg-amber-50"><Copy size={16}/> Duplicar</button>
                              <button onClick={() => imprimirFicha(f)} className="min-h-11 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-600 hover:text-amber-700 rounded-xl hover:bg-amber-50"><FileText size={16}/> PDF</button>
                              <button onClick={() => abrirSimulacao(f)} className="min-h-11 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-600 hover:text-amber-700 rounded-xl hover:bg-amber-50"><Calculator size={16}/> Simular</button>
                              <button onClick={() => handleRemover(f.id)} className="min-h-11 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 rounded-xl hover:bg-rose-50"><Trash2 size={16}/> Remover</button>
                           </div>
                        </div>
                     </article>
                  );
               })}
               {filtradosProdutosSemFicha.map(produto => {
                  const custo = custoVendaDoProduto(produto, fichas, embalagens);
                  const preco = Number(produto.preco_venda) || 0;
                  const cmv = preco > 0 && custo !== null ? (custo / preco) * 100 : null;
                  const margem = preco > 0 && custo !== null ? ((preco - custo) / preco) * 100 : null;
                  const acima = cmv !== null && cmv > metaCmv;
                  const componentes = componentesDoProduto(produto);
                  const publicado = produto.ativo !== false && preco > 0;
                  return (
                     <article key={`produto-${produto.id}`} style={{ order: ordemVisualGlobal.get(`p:${produto.id}`) }} className="bg-white rounded-[28px] border border-slate-200 shadow-sm hover:shadow-lg transition-all relative group flex flex-col overflow-hidden">
                        <div className="h-52 sm:h-60 bg-slate-100 relative overflow-hidden">
                           {produto.imagem_url ? (
                              <img src={produto.imagem_url} alt={produto.nome_produto} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                           ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-gradient-to-br from-slate-50 to-slate-100">
                                 <Package size={58}/><span className="text-xs font-bold mt-2">Item sem foto</span>
                              </div>
                           )}
                           <div className="absolute top-3 left-3 flex gap-2">
                              <span className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">{componentes.length > 1 ? "Combo" : componentes.length === 1 ? "Variante" : "Item pronto"}</span>
                           </div>
                           <span className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${publicado ? "bg-emerald-600 text-white" : "bg-white/95 text-amber-700"}`}>
                              {publicado ? "Publicado" : "Rascunho"}
                           </span>
                           <button onClick={() => abrirProdutoSimples(produto)} className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur rounded-xl text-slate-700 font-black text-xs shadow-sm hover:text-amber-700">
                              <Edit3 size={15}/> Editar item
                           </button>
                        </div>
                        <div className="p-5 sm:p-6 flex-1 flex flex-col">
                           {acima && <span className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-black mb-2"><AlertTriangle size={13}/> Acima do CMV meta</span>}
                           <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{produto.nome_produto}</h3>
                           <p className="text-xs font-bold text-slate-500 mt-1">{produto.categoria || "Sem categoria"}{componentes.length === 1 ? " · vinculado a uma ficha técnica" : componentes.length > 1 ? ` · ${componentes.length} componentes` : " · sem ficha técnica"}</p>
                           <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4 mt-5 pt-5 border-t border-slate-100">
                              <div><p className="text-xs font-medium text-slate-500">Custo do item</p><p className="text-lg font-black text-amber-700">{custo !== null ? fmtBRL(custo) : "—"}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">Preço de venda</p><p className="text-lg font-black text-slate-900">{preco > 0 ? fmtBRL(preco) : "—"}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">CMV teórico</p><p className={`text-lg font-black ${acima ? "text-rose-600" : "text-emerald-600"}`}>{cmv !== null ? `${cmv.toFixed(1)}%` : "—"}</p></div>
                              <div><p className="text-xs font-medium text-slate-500">Margem</p><p className={`text-lg font-black ${margem !== null && margem >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{margem !== null ? `${margem.toFixed(1)}%` : "—"}</p></div>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-auto pt-5">
                              {componentes.length === 0 && <button onClick={() => criarFichaParaProduto(produto)} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black hover:bg-amber-100"><Link2 size={16}/> Criar ficha técnica</button>}
                              <button onClick={() => abrirProdutoSimples(produto)} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-100"><Edit3 size={16}/> Editar cardápio</button>
                           </div>
                        </div>
                     </article>
                  );
               })}
            </div>
         )}
      </div>

      {/* MODAL DE CRIAÇÃO DA FICHA TÉCNICA */}
      {modalNovo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
             <div role="dialog" aria-modal={!(modalInsumo || substituirAlvo)} aria-hidden={modalInsumo || !!substituirAlvo || undefined} aria-label={form.nova_ficha ? "Nova receita" : "Editar receita e cardápio"} tabIndex={-1} className="bg-white rounded-none sm:rounded-[32px] w-full max-w-5xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[94vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center gap-3 p-4 sm:p-6 border-b border-slate-100 bg-white shrink-0" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
                  <div>
                     <h2 className="font-black text-xl sm:text-2xl text-slate-900">{form.nova_ficha ? "Nova Receita" : "Editar Receita e Cardápio"}</h2>
                     <p className="text-xs font-bold text-slate-500 mt-1">Ficha técnica + preço + publicação · custo atual <span className="text-amber-700 font-black">{fmtBRL(calcularCustoTotal(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} aria-label="Fechar receita" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 custom-scrollbar grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-5 sm:gap-8">
                  
                   {/* COLUNA ESQUERDA: Dados Básicos e Foto */}
                  <div className="space-y-4">
                     <div className="space-y-4">
                        <div className="w-full h-48 sm:h-56 relative">
                           <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Adicionar ou trocar foto da receita" className="w-full h-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-amber-400 overflow-hidden relative group transition-colors">
                              {(form.imagem || form.imagem_url_original) ? (
                                 <>
                                    <img src={form.imagem ? `data:image/jpeg;base64,${form.imagem}` : form.imagem_url_original} className="w-full h-full object-cover" alt="Foto do Prato" />
                                    <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"><Camera size={24}/></div>
                                 </>
                              ) : (
                                 <div className="text-center">
                                     <Camera size={30} className="mx-auto text-slate-400 mb-2"/>
                                     <span className="text-xs font-bold text-slate-500">Adicionar foto da receita</span>
                                 </div>
                              )}
                           </button>
                           <input type="file" ref={fileInputRef} onChange={handleMudarFotoForm} accept="image/*" className="hidden" />
                           {(form.imagem || form.imagem_url_original) && (
                              <button type="button" aria-label="Remover foto da receita" onClick={() => setForm({ ...form, imagem: "", imagem_url_original: "", imagem_removida: true })} title="Remover foto"
                                 className="absolute top-3 right-3 w-11 h-11 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600">
                                 <X size={14} />
                              </button>
                           )}
                        </div>
                        <div className="flex-1">
                           <label htmlFor="receita-nome" className="text-xs font-bold text-slate-600">Nome da receita *</label>
                           <input id="receita-nome" type="text" placeholder="Ex: Filé mignon ao molho" value={form.nome_receita} onChange={e=>setForm({...form, nome_receita: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-amber-500 shadow-sm"/>
                        </div>
                     </div>
                     {/* Tipo da ficha: PRATO/DRINK (vai pro cardápio) ou PRÉ-PREPARO (base) */}
                     <div className="flex gap-2">
                        <button type="button" aria-pressed={!form.eh_base} onClick={() => setForm({ ...form, eh_base: false })}
                           className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${!form.eh_base ? "bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-600/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                           {deptUrl === "bar" ? "Drink" : "Prato"}
                           <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">vai pro cardápio · monte com insumos e pré-preparos</span>
                        </button>
                        <button type="button" aria-pressed={form.eh_base} onClick={() => {
                           const variantes = form.id ? produtosSimplesVinculados({ id: form.id }, produtos) : [];
                           if (variantes.length > 1) return alert("Esta receita possui variantes P/M/G. Desvincule essas variantes antes de transformá-la em pré-preparo.");
                           setForm({ ...form, eh_base: true });
                        }}
                           className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${form.eh_base ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-600/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                           Pré-preparo
                           <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">{deptUrl === "bar" ? "xarope, mix, infusão — usado dentro dos drinks" : "molho, massa, caldo — usado dentro dos pratos"}</span>
                        </button>
                     </div>
                     {/* Categoria do cardápio (só para pratos, não para bases) */}
                     {!form.eh_base && (
                        <div>
                           <label htmlFor="receita-categoria" className="text-xs font-bold text-slate-600">Categoria no cardápio</label>
                           <input id="receita-categoria" list="categorias-cardapio-receita" value={form.categoria || ""} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Selecione ou digite uma categoria" className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500 shadow-sm" />
                           <datalist id="categorias-cardapio-receita">
                              {categoriasCardapio.map(c => <option key={c} value={c} />)}
                           </datalist>
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
                              if (!est) return <p className="text-sm text-slate-500 font-medium py-2">Adicione ingredientes — o rendimento e o custo unitário aparecem aqui sozinhos.</p>;
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
                                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">1 {est.ehLiquido ? "L" : "kg"} custa</p>
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
                                       <input aria-label="Quantidade para calcular o custo" type="number" step="0.01" min="0" placeholder="0" value={calcQtd} onChange={e=>setCalcQtd(e.target.value)} className="w-20 p-2 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                                       <select aria-label="Unidade da quantidade calculada" value={["g","kg","l","ml"].includes(calcUn) ? calcUn : "g"} onChange={e=>setCalcUn(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 text-sm outline-none focus:border-emerald-500">
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                           <div>
                              <label htmlFor="receita-rendimento" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rendimento</label>
                              <input id="receita-rendimento" type="number" step="0.01" placeholder="Ex: 80" value={form.rendimento_porcoes} onChange={e=>{
                                 setForm({...form, rendimento_porcoes: e.target.value});
                                 setAutoSoma(false);
                              }} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-emerald-500 text-center"/>
                           </div>
                           <div>
                              <label htmlFor="receita-unidade-rendimento" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medido em</label>
                              <select id="receita-unidade-rendimento" value={form.rendimento_unidade} onChange={e=>{
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
                                    unidade_venda: unidadeVendaCalculada(newUn, form.peso_porcao_g),
                                    rendimento_porcoes: newVal > 0 ? String(newVal) : form.rendimento_porcoes
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
                           <div>
                              <label htmlFor="receita-peso-porcao" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                 {["l", "ml"].includes(String(form.rendimento_unidade || "").toLowerCase()) ? "Porção vendida (ml)" : "Porção vendida (g)"}
                              </label>
                              <input id="receita-peso-porcao" type="number" step="0.1" min="0" placeholder={["kg", "g", "l", "ml"].includes(String(form.rendimento_unidade || "").toLowerCase()) ? "Vazio = kg/L" : "Ex: 300"} value={form.peso_porcao_g} onChange={e=>{
                                 setForm({
                                    ...form,
                                    peso_porcao_g: e.target.value,
                                    unidade_venda: unidadeVendaCalculada(form.rendimento_unidade, e.target.value),
                                 });
                                 setAutoSoma(false);
                              }} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-emerald-500 text-center"/>
                              <p className="text-[9px] font-medium text-slate-400 mt-1 text-center">Opcional</p>
                           </div>
                        </div>

                        {/* Resumo em UMA linha do que isso significa */}
                        {(() => {
                           const rendimento = Number(String(form.rendimento_porcoes).replace(",", ".")) || 0;
                           const pesoPorcao = Number(String(form.peso_porcao_g).replace(",", ".")) || 0;
                           const unR = String(form.rendimento_unidade || "porcao").toLowerCase();
                           const ehLiquido = unR === "l" || unR === "ml";
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
                                          {pesoPorcao > 0 && <> de <span className="font-black text-slate-900">{pesoPorcao}{ehLiquido ? "ml" : "g"}</span> (Total: {ehLiquido ? `${(pesoTotalG / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L` : fmtG(pesoTotalG)})</>}
                                       </>
                                    ) : (
                                       <>
                                          Rende <span className="font-black text-slate-900">{rendimento} {unR}</span>
                                          {porcoesRendidas !== null && pesoPorcao > 0 && <> = <span className="font-black text-slate-900">{(+porcoesRendidas.toFixed(1)).toLocaleString("pt-BR")} porções de {pesoPorcao}{ehLiquido ? "ml" : "g"}</span></>}
                                       </>
                                    )}
                                    {custoPorc !== null && <> · porção custa <span className="font-black text-emerald-700">{fmtBRL(custoPorc)}</span></>}
                                    {custoKg !== null && <> · 1 {ehLiquido ? "L" : "kg"} custa <span className="font-black text-emerald-700">{fmtBRL(custoKg)}</span></>}
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
                           const ehLiquido = unR === "l" || unR === "ml";
                           const pesoTotalG = pesoTotalDaFicha(rendimento, unR, pesoPorcao);
                           if (!pesoTotalG) return null;
                           const custoKg = calcularCustoTotal(ingFicha) / (pesoTotalG / 1000);

                           const q = Number(calcQtd) || 0;
                           let quantidadeMil = 0;
                           if (calcUn === "g" || calcUn === "ml") quantidadeMil = q;
                           else if (calcUn === "kg" || calcUn === "l") quantidadeMil = q * 1000;
                           else quantidadeMil = pesoPorcao > 0 ? q * pesoPorcao : 0;
                           const custoCalc = custoKg * (quantidadeMil / 1000);
                           const unidadesCalc = pesoPorcao > 0 ? quantidadeMil / pesoPorcao : null;
                           const quantidadeFormatada = quantidadeMil >= 1000
                              ? `${(quantidadeMil / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${ehLiquido ? "L" : "kg"}`
                              : `${(+quantidadeMil.toFixed(1)).toLocaleString("pt-BR")} ${ehLiquido ? "ml" : "g"}`;

                           return (
                              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                                 <span className="text-[11px] font-bold text-slate-500">Quanto custa se eu usar</span>
                                 <input type="number" step="0.01" min="0" placeholder="0" value={calcQtd} onChange={e=>setCalcQtd(e.target.value)} className="w-20 p-2 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                                 <select value={ehLiquido ? (["ml", "l", "un"].includes(calcUn) ? calcUn : "ml") : (["g", "kg", "un"].includes(calcUn) ? calcUn : "g")} onChange={e=>setCalcUn(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 text-sm outline-none focus:border-emerald-500">
                                    <option value={ehLiquido ? "ml" : "g"}>{ehLiquido ? "ml" : "g"}</option>
                                    <option value={ehLiquido ? "l" : "kg"}>{ehLiquido ? "L" : "kg"}</option>
                                    {pesoPorcao > 0 && <option value="un">porções</option>}
                                 </select>
                                 {quantidadeMil > 0 && (
                                    <span className="text-sm font-bold text-slate-600">
                                       ? → <span className="font-black text-emerald-600">{fmtBRL(custoCalc)}</span>
                                       <span className="text-slate-500 font-medium text-xs"> ({quantidadeFormatada}{unidadesCalc !== null ? ` · ${(+unidadesCalc.toFixed(1)).toLocaleString("pt-BR")} porções` : ""})</span>
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

                     <div>
                        <label htmlFor="receita-modo-preparo" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de Preparo</label>

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

                        <textarea id="receita-modo-preparo" placeholder="Passo a passo da execução..." value={form.modo_preparo} onChange={e=>setForm({...form, modo_preparo: e.target.value})} className="w-full h-40 p-4 mt-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm resize-none"></textarea>
                     </div>

                     {(() => {
                        const custoTotal = calcularCustoTotal(ingFicha);
                        const rendimento = Number(String(form.rendimento_porcoes || "0").replace(",", ".")) || 0;
                        const unidade = String(form.rendimento_unidade || "porcao").toLowerCase();
                        const pesoPorcao = Number(String(form.peso_porcao_g || "0").replace(",", ".")) || 0;
                        const fichaRascunho = {
                           id: form.id,
                           rendimento_porcoes: rendimento,
                           rendimento_unidade: unidade,
                           peso_porcao_g: pesoPorcao || null,
                           fichas_ingredientes: ingFicha.map(item => item.tipo === "base"
                              ? { subficha_id: item.subficha_id, quantidade: Number(item.quantidade) || 0 }
                              : { insumos: { custo_unitario: Number(item.custo_unitario) || 0 }, quantidade: Number(item.quantidade) || 0 }),
                        };
                        const unidadeVenda = unidadeVendaDaFicha(fichaRascunho);
                        const porcoes = unidadeVenda.quantidade;
                        const produtoAtual = produtos.find(item => item.id === form.produto_id);
                        const produtosDisponiveisParaVinculo = produtos.filter(item => {
                           const componentes = componentesDoProduto(item);
                           return componentes.length === 0
                              || (componentes.length === 1 && componentes[0]?.ficha_id === form.id)
                              || item.id === form.produto_id;
                        });
                        const valorProdutoSelecionado = produtoAtual?.id || (form.produto_id ? "__novo__" : "");
                        const componentesAtuais = componentesDoProduto(produtoAtual).filter(item => item?.ficha_id !== form.id);
                        const componenteOriginal = componentesDoProduto(produtoAtual).find(item => item?.ficha_id === form.id);
                        const produtoRascunho = produtoAtual ? {
                           ...produtoAtual,
                           ficha_id: form.id,
                           composicao: [{ ficha_id: form.id, qtd: Number(componenteOriginal?.qtd) || 1 }, ...componentesAtuais],
                        } : null;
                        const fichasCalculo = [...fichas.filter(item => item.id !== form.id), fichaRascunho];
                        const custoPorcao = custoVendaDoProduto(produtoRascunho, fichasCalculo, embalagens)
                           ?? (porcoes > 0 ? custoTotal / porcoes : 0);
                        const preco = Number(String(form.preco_venda || "0").replace(",", ".")) || 0;
                        const meta = Number(String(form.meta_cmv || metaCmv).replace(",", ".")) || metaCmv;
                        const cmv = preco > 0 ? (custoPorcao / preco) * 100 : null;
                        const margem = preco > 0 ? ((preco - custoPorcao) / preco) * 100 : null;
                        const sugerido = meta > 0 ? custoPorcao / (meta / 100) : 0;
                        const acima = cmv !== null && cmv > meta;

                        return (
                           <div className="space-y-4">
                              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4">
                                 <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-amber-700"/> Resumo da receita</h3>
                                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div><p className="text-[10px] font-bold text-slate-500">Custo total</p><p className="text-lg font-black text-amber-700">{fmtBRL(custoTotal)}</p></div>
                                    <div><p className="text-[10px] font-bold text-slate-500">Custo/{unidadeVenda.rotulo}</p><p className="text-lg font-black text-slate-900">{porcoes > 0 ? fmtBRL(custoPorcao) : "—"}</p></div>
                                    <div><p className="text-[10px] font-bold text-slate-500">Ingredientes</p><p className="text-lg font-black text-slate-900">{ingFicha.filter(i => Number(i.quantidade) > 0).length}</p></div>
                                 </div>
                              </div>

                              {!form.eh_base && (
                                 <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 mb-4">
                                       <div>
                                          <h3 className="font-black text-slate-900 flex items-center gap-2"><Store size={18} className="text-amber-700"/> CMV e Precificação</h3>
                                          <p className="text-[11px] font-medium text-slate-500 mt-1">O preço e a ficha são salvos juntos.</p>
                                       </div>
                                       {cmv !== null && (
                                          <span className={`px-3 py-1.5 rounded-full text-xs font-black ${acima ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>{cmv.toFixed(1)}% CMV</span>
                                       )}
                                    </div>

                                    <div className="mb-4 rounded-xl bg-amber-50/60 border border-amber-200 p-3">
                                       <label htmlFor="receita-produto-vinculado" className="text-xs font-black text-slate-700">Item do cardápio vinculado</label>
                                       <select
                                          id="receita-produto-vinculado"
                                          value={valorProdutoSelecionado}
                                          onChange={evento => selecionarProdutoDaReceita(evento.target.value)}
                                          className="w-full p-3 mt-1.5 bg-white border border-amber-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500"
                                       >
                                          <option value="">Somente ficha técnica — não alterar o cardápio</option>
                                          <option value="__novo__">Criar um novo item no cardápio</option>
                                          {produtosDisponiveisParaVinculo.map(item => (
                                             <option key={item.id} value={item.id}>{item.nome_produto}{Number(item.preco_venda) > 0 ? ` — ${fmtBRL(Number(item.preco_venda))}` : " — rascunho"}</option>
                                          ))}
                                       </select>
                                       <p className="text-[10px] text-slate-500 font-medium mt-1.5">Se houver tamanhos P, M e G, escolha exatamente qual deles deseja editar. Nenhuma variante é alterada automaticamente.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                       <div>
                                          <label htmlFor="receita-tempo-preparo" className="text-xs font-bold text-slate-600 flex items-center gap-1"><Clock3 size={13}/> Preparo (min)</label>
                                          <input id="receita-tempo-preparo" disabled={!form.produto_id} type="number" min="0" step="1" value={form.tempo_preparo_base} onChange={e => setForm({ ...form, tempo_preparo_base: e.target.value })} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-amber-500 disabled:opacity-50" />
                                       </div>
                                       <div>
                                          <label htmlFor="receita-meta-cmv" className="text-xs font-bold text-slate-600">Meta CMV da unidade (%)</label>
                                          <input id="receita-meta-cmv" type="number" min="1" max="100" step="0.1" value={form.meta_cmv} onChange={e => setForm({ ...form, meta_cmv: e.target.value })} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-amber-500" />
                                       </div>
                                       <div>
                                          <label htmlFor="receita-preco-venda" className="text-xs font-bold text-slate-600">Preço por {unidadeVenda.rotulo} (R$) *</label>
                                          <input id="receita-preco-venda" disabled={!form.produto_id} type="number" min="0" step="0.01" placeholder="0,00" value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value })} className="w-full p-3 mt-1 bg-amber-50 border-2 border-amber-300 rounded-xl font-black text-amber-800 outline-none focus:border-amber-600 disabled:opacity-50" />
                                       </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                                       <div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-[10px] font-bold text-slate-500">Preço sugerido</p><p className="font-black text-amber-700">{sugerido > 0 ? fmtBRL(sugerido) : "—"}</p></div>
                                       <div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-[10px] font-bold text-slate-500">CMV teórico</p><p className={`font-black ${acima ? "text-rose-600" : "text-emerald-600"}`}>{cmv !== null ? `${cmv.toFixed(1)}%` : "—"}</p></div>
                                       <div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-[10px] font-bold text-slate-500">Margem</p><p className="font-black text-emerald-600">{margem !== null ? `${margem.toFixed(1)}%` : "—"}</p></div>
                                    </div>

                                    <button type="button" role="switch" aria-label="Publicar receita no cardápio" aria-checked={form.produto_ativo} disabled={!form.produto_id} onClick={() => setForm({ ...form, produto_ativo: !form.produto_ativo })} className={`w-full mt-4 p-3 rounded-xl border-2 flex items-center justify-between gap-3 text-left transition-all disabled:opacity-50 ${form.produto_ativo ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                                       <span><span className="block font-black text-sm">{form.produto_ativo ? "Publicado no cardápio" : "Salvar como rascunho"}</span><span className="block text-[10px] font-medium mt-0.5">Itens sem preço ficam protegidos como rascunho.</span></span>
                                       <span className={`w-12 h-7 rounded-full p-1 transition-colors ${form.produto_ativo ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${form.produto_ativo ? "translate-x-5" : "translate-x-0"}`}/></span>
                                    </button>
                                 </div>
                              )}
                           </div>
                        );
                     })()}
                  </div>

                  {/* COLUNA DIREITA: Ingredientes da Ficha */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-auto lg:h-full max-h-none lg:max-h-[760px]">
                     <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                           <h3 className="font-black text-lg text-slate-900">Ingredientes</h3>
                           <p className="text-[11px] font-medium text-slate-500">Informe a quantidade bruta usada, incluindo limpeza e perdas, para o CMV ficar correto.</p>
                        </div>
                        <button type="button" onClick={abrirCadastroInsumo} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-black text-xs hover:bg-amber-100">
                           <PackagePlus size={15}/> Novo
                        </button>
                     </div>
                     
                     {/* ADD INGREDIENTE */}
                     <div className="flex gap-2 mb-4">
                         <select onChange={e => { addIngrediente(e.target.value); e.target.value=""; }} className="flex-1 min-w-0 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-amber-500 text-sm">
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
                                    {ing.tipo === "base" && <span className="text-[8px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Base</span>}
                                 </p>
                                 <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Custo: {fmtBRL(ing.custo_unitario * ing.quantidade)}</p>
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
                                     aria-label={`Quantidade bruta de ${ing.nome}`}
                                     title="Quantidade bruta usada, incluindo perdas"
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
                              <button onClick={evento => { focoSubstituicaoRef.current = evento.currentTarget; setSubstitutoValor(""); setSubstituirAlvo(ing); }} title="Remover ou substituir" className="p-2 text-slate-500 hover:text-rose-600 transition-colors bg-white rounded-lg border border-slate-200">
                                 <Trash2 size={14}/>
                              </button>
                           </div>
                           );
                        })}
                     </div>

                  </div>

               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-4 sm:p-6 border-t border-slate-100 bg-white shrink-0" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1.2fr] gap-2 sm:gap-3">
                     <button type="button" onClick={() => setModalNovo(false)} disabled={salvando} className="order-3 sm:order-1 px-5 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
                     <button type="button" onClick={() => handleSalvar({ criarOutra: true })} disabled={salvando} className="order-2 px-5 py-3.5 rounded-xl font-black text-slate-800 bg-white border-2 border-slate-200 hover:border-amber-300 disabled:opacity-50 flex items-center justify-center gap-2">
                        {salvando ? <Loader2 size={18} className="animate-spin"/> : <Plus size={18}/>} Salvar e criar outra
                     </button>
                     <button type="button" onClick={() => handleSalvar()} disabled={salvando} className="order-1 sm:order-3 px-5 py-3.5 rounded-xl font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2">
                         {salvando ? <Loader2 size={19} className="animate-spin"/> : <Save size={19}/>} {salvando ? "Salvando..." : (form.produto_id ? "Salvar receita e cardápio" : "Salvar ficha técnica")}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {modalProduto && (
         <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" onClick={() => !salvandoProduto && setModalProduto(false)}>
            <div role="dialog" aria-modal="true" aria-label={formProduto.novo_produto ? "Novo item pronto" : "Editar item do cardápio"} tabIndex={-1} className="bg-white w-full max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:rounded-[30px] overflow-hidden shadow-2xl flex flex-col" onClick={evento => evento.stopPropagation()}>
               <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
                  <div>
                     <h2 className="text-xl sm:text-2xl font-black text-slate-900">{formProduto.novo_produto ? "Novo item pronto" : "Editar item do cardápio"}</h2>
                     <p className="text-xs font-medium text-slate-500 mt-1">Para bebidas, embalados e itens vendidos sem ficha técnica.</p>
                  </div>
                  <button type="button" onClick={() => setModalProduto(false)} aria-label="Fechar item do cardápio" disabled={salvandoProduto} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><X size={19}/></button>
               </div>
               <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/60">
                  <div className="relative h-48 sm:h-56 rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden">
                     <button type="button" onClick={() => fileProdutoRef.current?.click()} aria-label="Adicionar ou trocar foto do item" className="w-full h-full cursor-pointer">
                        {formProduto.imagem_url ? (
                           <img src={formProduto.imagem_url} alt="Foto do item" className="w-full h-full object-cover" />
                        ) : (
                           <span className="w-full h-full flex flex-col items-center justify-center text-slate-400"><Camera size={34}/><span className="font-bold text-xs mt-2">Adicionar foto</span></span>
                        )}
                     </button>
                     <input ref={fileProdutoRef} type="file" accept="image/*" onChange={handleMudarFotoProduto} className="hidden" />
                     {formProduto.imagem_url && <button type="button" aria-label="Remover foto do item" onClick={evento => { evento.stopPropagation(); setFormProduto({ ...formProduto, imagem_url: "" }); }} className="absolute top-3 right-3 w-11 h-11 rounded-full bg-rose-500 text-white flex items-center justify-center shadow"><X size={16}/></button>}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                      <div>
                         <label htmlFor="produto-nome" className="text-xs font-bold text-slate-600">Nome do item *</label>
                         <input id="produto-nome" autoFocus type="text" value={formProduto.nome_produto || ""} onChange={evento => setFormProduto({ ...formProduto, nome_produto: evento.target.value })} placeholder="Ex: Água sem gás 500 ml" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-amber-500" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="produto-categoria" className="text-xs font-bold text-slate-600">Categoria</label>
                            <input id="produto-categoria" list="categorias-cardapio-produto" value={formProduto.categoria || ""} onChange={evento => setFormProduto({ ...formProduto, categoria: evento.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" />
                            <datalist id="categorias-cardapio-produto">{categoriasCardapio.map(categoria => <option key={categoria} value={categoria}/>)}</datalist>
                         </div>
                         <div>
                            <label htmlFor="produto-preco" className="text-xs font-bold text-slate-600">Preço de venda (R$) *</label>
                            <input id="produto-preco" type="number" min="0" step="0.01" value={formProduto.preco_venda || ""} onChange={evento => setFormProduto({ ...formProduto, preco_venda: evento.target.value })} placeholder="0,00" className="w-full p-4 mt-1 bg-amber-50 border-2 border-amber-300 rounded-xl font-black text-amber-800 outline-none focus:border-amber-600" />
                         </div>
                         <div>
                            <label htmlFor="produto-tempo" className="text-xs font-bold text-slate-600">Tempo de preparo (min)</label>
                            <input id="produto-tempo" type="number" min="0" step="1" value={formProduto.tempo_preparo_base ?? ""} onChange={evento => setFormProduto({ ...formProduto, tempo_preparo_base: evento.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" />
                         </div>
                         <div>
                            <label htmlFor="produto-codigo" className="text-xs font-bold text-slate-600">Código de barras</label>
                            <input id="produto-codigo" type="text" inputMode="numeric" value={formProduto.codigo_barras || ""} onChange={evento => setFormProduto({ ...formProduto, codigo_barras: evento.target.value })} placeholder="Opcional" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" />
                         </div>
                      </div>
                      {componentesDoProduto(formProduto).length <= 1 && (
                         <div>
                            <label htmlFor="produto-ficha-vinculada" className="text-xs font-bold text-slate-600">Ficha técnica vinculada</label>
                            <select id="produto-ficha-vinculada" value={formProduto.vinculo_ficha_id || ""} onChange={evento => setFormProduto({ ...formProduto, vinculo_ficha_id: evento.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500">
                               <option value="">Sem ficha técnica</option>
                               {fichas.filter(ficha => !ficha.eh_base).map(ficha => <option key={ficha.id} value={ficha.id}>{ficha.nome_receita}</option>)}
                            </select>
                            <p className="text-[10px] text-slate-500 font-medium mt-1.5">O vínculo é sempre escolhido por você; nomes iguais não são ligados automaticamente.</p>
                         </div>
                      )}
                      <button type="button" role="switch" aria-label="Publicar item no cardápio" aria-checked={formProduto.ativo} onClick={() => setFormProduto({ ...formProduto, ativo: !formProduto.ativo })} className={`w-full p-3 rounded-xl border-2 flex items-center justify-between gap-3 text-left ${formProduto.ativo ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                        <span><span className="block font-black text-sm">{formProduto.ativo ? "Publicado no cardápio" : "Salvar como rascunho"}</span><span className="block text-[10px] font-medium mt-0.5">Só itens publicados aparecem para o cliente.</span></span>
                        <span className={`w-12 h-7 rounded-full p-1 ${formProduto.ativo ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${formProduto.ativo ? "translate-x-5" : "translate-x-0"}`}/></span>
                     </button>
                  </div>

                  {!formProduto.novo_produto && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {componentesDoProduto(formProduto).length === 0 && <button type="button" onClick={() => criarFichaParaProduto(formProduto)} className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-black text-sm flex items-center justify-center gap-2"><Link2 size={17}/> Criar ficha técnica</button>}
                        <button type="button" onClick={() => router.push(`/dashboard/operacao/produtos?dept=${deptUrl}`)} className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm flex items-center justify-center gap-2"><Package size={17}/> Composição avançada</button>
                     </div>
                  )}
               </div>
               <div className="p-4 sm:p-5 border-t border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2 shrink-0" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                  <button type="button" onClick={() => setModalProduto(false)} disabled={salvandoProduto} className="px-5 py-3.5 rounded-xl bg-slate-100 text-slate-600 font-bold">Cancelar</button>
                  <button type="button" onClick={salvarProdutoSimples} disabled={salvandoProduto} className="px-5 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50">{salvandoProduto ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} {salvandoProduto ? "Salvando..." : "Salvar item"}</button>
               </div>
            </div>
         </div>
      )}

      {modalInsumo && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4" onClick={() => !salvandoInsumo && fecharModalInsumo()}>
            <div role="dialog" aria-modal="true" aria-label="Cadastrar ingrediente" tabIndex={-1} className="bg-white rounded-[28px] w-full max-w-xl max-h-[94dvh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
                  <div>
                     <h2 className="text-xl sm:text-2xl font-black text-slate-900">Cadastrar ingrediente</h2>
                     <p className="text-xs font-medium text-slate-500 mt-1">Ele será adicionado à receita atual.</p>
                  </div>
                  <button type="button" onClick={fecharModalInsumo} aria-label="Fechar cadastro de ingrediente" disabled={salvandoInsumo} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><X size={19}/></button>
               </div>
               <div className="p-5 sm:p-6 space-y-4">
                  <div>
                     <label htmlFor="insumo-nome" className="text-xs font-bold text-slate-600">Nome do ingrediente *</label>
                     <input id="insumo-nome" autoFocus type="text" value={formInsumo.nome} onChange={e => setFormInsumo({ ...formInsumo, nome: e.target.value, categoria: formInsumo.categoria || adivinharCategoria(e.target.value, deptUrl, formInsumo.marca) || "" })} placeholder="Ex: Farinha de trigo" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-amber-500" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="insumo-categoria" className="text-xs font-bold text-slate-600">Categoria</label>
                        <select id="insumo-categoria" value={formInsumo.categoria} onChange={e => setFormInsumo({ ...formInsumo, categoria: e.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500">
                           <option value="">Selecione...</option>
                           {(CATEGORIAS_INSUMO[deptUrl] || CATEGORIAS_INSUMO.cozinha || []).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                     <div>
                        <label htmlFor="insumo-marca" className="text-xs font-bold text-slate-600">Marca — opcional</label>
                        <input id="insumo-marca" type="text" value={formInsumo.marca} onChange={e => setFormInsumo({ ...formInsumo, marca: e.target.value })} placeholder="Ex: Marca própria" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" />
                     </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="insumo-unidade" className="text-xs font-bold text-slate-600">Unidade de compra *</label>
                        <select id="insumo-unidade" value={formInsumo.unidade_medida} onChange={e => setFormInsumo({ ...formInsumo, unidade_medida: e.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:border-amber-500">
                           <option value="kg">Quilograma (kg)</option>
                           <option value="l">Litro (L)</option>
                           <option value="un">Unidade (un)</option>
                           <option value="g">Grama (g)</option>
                           <option value="ml">Mililitro (ml)</option>
                        </select>
                     </div>
                     <div>
                        <label htmlFor="insumo-custo" className="text-xs font-bold text-slate-600">Custo por {formInsumo.unidade_medida} (R$) *</label>
                        <input id="insumo-custo" type="number" min="0" step="0.01" value={formInsumo.custo_unitario} onChange={e => setFormInsumo({ ...formInsumo, custo_unitario: e.target.value })} placeholder="0,00" className="w-full p-4 mt-1 bg-amber-50 border-2 border-amber-200 rounded-xl font-black text-amber-800 outline-none focus:border-amber-500" />
                     </div>
                  </div>
                  <div>
                     <label htmlFor="insumo-fornecedor" className="text-xs font-bold text-slate-600">Fornecedor — opcional</label>
                     <input id="insumo-fornecedor" type="text" value={formInsumo.fornecedor} onChange={e => setFormInsumo({ ...formInsumo, fornecedor: e.target.value })} placeholder="Selecionar ou digitar..." className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" />
                  </div>
                  <div>
                     <label htmlFor="insumo-observacoes" className="text-xs font-bold text-slate-600">Observações — opcional</label>
                     <textarea id="insumo-observacoes" value={formInsumo.observacoes} onChange={e => setFormInsumo({ ...formInsumo, observacoes: e.target.value })} placeholder="Notas sobre o ingrediente..." className="w-full h-24 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-amber-500 resize-none" />
                  </div>
               </div>
               <div className="p-5 sm:p-6 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={fecharModalInsumo} disabled={salvandoInsumo} className="order-2 sm:order-1 py-3.5 rounded-xl font-bold bg-slate-100 text-slate-700 disabled:opacity-50">Cancelar</button>
                  <button type="button" onClick={salvarNovoInsumo} disabled={salvandoInsumo} className="order-1 sm:order-2 py-3.5 rounded-xl font-black bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
                     {salvandoInsumo ? <Loader2 size={18} className="animate-spin"/> : <PackagePlus size={18}/>} Cadastrar ingrediente
                  </button>
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
            <div role="dialog" aria-modal="true" aria-label="Simular rendimento" tabIndex={-1} className="bg-white rounded-[28px] w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between mb-1">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calculator size={20} className="text-emerald-600" /> Simular rendimento</h2>
                  <button onClick={() => setModalSim(null)} aria-label="Fechar simulação" className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={17} /></button>
               </div>
               <p className="text-sm font-bold text-slate-700">{modalSim.nome_receita}</p>
               <p className="text-xs font-medium text-slate-500 mb-4">Receita original rende <b>{(+original).toLocaleString("pt-BR")} {unLabel}</b>. Escolha o quanto quer produzir e os ingredientes se ajustam.</p>

               <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                     <label htmlFor="simulacao-rendimento" className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quero produzir</label>
                     <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500">
                        <input id="simulacao-rendimento" type="text" inputMode="decimal" value={simAlvo} onChange={e => setSimAlvo(e.target.value.replace(/[^0-9.,]/g, ""))} className="w-full p-3 text-center bg-transparent font-black text-lg text-slate-700 outline-none" />
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
             <div role="dialog" aria-modal="true" aria-label="Remover ou substituir ingrediente" tabIndex={-1} className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between mb-1">
                  <h3 className="text-xl font-black text-slate-800">Remover “{substituirAlvo.nome}”</h3>
                  <button onClick={fecharSubstituicao} aria-label="Fechar substituição" className="text-slate-400 hover:text-slate-600 p-1"><X size={20}/></button>
               </div>
               <p className="text-sm font-medium text-slate-500 mb-4">Quer substituir por outro ingrediente cadastrado ou só remover?</p>

               <label htmlFor="ingrediente-substituto" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Substituir por (opcional)</label>
               <select id="ingrediente-substituto" value={substitutoValor} onChange={e => setSubstitutoValor(e.target.value)} className="w-full mt-1 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-emerald-500 text-sm">
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
              <div role="dialog" aria-modal="true" aria-label="Montar ficha técnica com inteligência artificial" tabIndex={-1} className="bg-white rounded-3xl sm:rounded-[32px] w-full max-w-3xl my-0 sm:my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[100dvh] sm:max-h-[90vh]">
               <div className="flex justify-between items-center gap-3 p-4 sm:p-8 pb-4 sm:pb-6 border-b border-slate-100 shrink-0" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Sparkles size={22}/></div>
                     <div>
                         <h2 className="font-black text-xl sm:text-2xl text-slate-800">Montar Receita com IA</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Cole a receita ou envie uma foto — a IA monta nome, ingredientes e modo de preparo</p>
                     </div>
                  </div>
                  <button onClick={() => setModalIAFicha(false)} aria-label="Fechar montagem com inteligência artificial" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar space-y-5" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                  {!iaFResultado ? (
                     <>
                        <div>
                           <label htmlFor="ia-receita-texto" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Colar a receita (opcional se enviar foto)</label>
                           <textarea
                              id="ia-receita-texto"
                              placeholder={"Ex:\nTacacá: refogo camarão seco no azeite, junto tucupi e goma, cozinho 15 min mexendo, sirvo com jambu e pimenta..."}
                              value={iaFTexto}
                              onChange={e => setIaFTexto(e.target.value)}
                              className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                        </div>

                        <div>
                           <label htmlFor="ia-receita-foto" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ou enviar foto (caderno de receitas, print, etc)</label>
                           <input id="ia-receita-foto" ref={fileInputFichaRef} type="file" accept="image/*" onChange={handleSelecionarImagemFicha} className="hidden" />
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
                           <label htmlFor="ia-receita-nome" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do prato (vai pro cardápio)</label>
                           <input id="ia-receita-nome" type="text" value={iaFResultado.nome_receita} onChange={e=>setIaFResultado({...iaFResultado, nome_receita: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500" />
                           {(() => {
                              const pesoIA = rendimentoPelosIngredientes(
                                 iaFResultado.itens.map(it => {
                                    const ins = insumosAtivos.find(i => i.id === it.vinculoId);
                                    return { unidade: it.unidade_lida, quantidade: it.quantidade_lida, peso_medio_g: ins?.peso_medio_g || null };
                                 })
                              );
                              if (pesoIA) return (
                                 <>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 block">Rendimento (peso total)</p>
                                    <div className="mt-1 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                       <span className="font-black text-emerald-700 text-lg">{pesoIA.valor.toLocaleString("pt-BR")} {pesoIA.unidade}</span>
                                       <span className="block text-[10px] font-bold text-emerald-600/80 mt-0.5">Somado automaticamente dos ingredientes. Você pode ajustar na ficha (perdas do cozimento).</span>
                                    </div>
                                 </>
                              );
                              return (
                                 <>
                                    <label htmlFor="ia-receita-rendimento" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 block">Rendimento (porções)</label>
                                    <input id="ia-receita-rendimento" type="number" value={iaFResultado.rendimento_porcoes} onChange={e=>setIaFResultado({...iaFResultado, rendimento_porcoes: e.target.value})} className="w-24 p-3 mt-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 outline-none focus:border-emerald-500" />
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
                                             aria-label={`Vincular ${it.nomeOriginal} a um ingrediente`}
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
                                             <input aria-label={`Marca do novo ingrediente ${it.nomeOriginal}`} type="text" placeholder="Marca (opcional)" value={it.novo.marca} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, marca: e.target.value } })} className="w-32 p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500" />
                                             <select aria-label={`Unidade do novo ingrediente ${it.nomeOriginal}`} value={it.novo.unidade_medida} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, unidade_medida: e.target.value } })} className="w-20 p-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-emerald-500">
                                                <option value="kg">KG</option>
                                                <option value="l">L</option>
                                                <option value="un">UN</option>
                                                <option value="g">G</option>
                                                <option value="ml">ML</option>
                                             </select>
                                             <input aria-label={`Custo do novo ingrediente ${it.nomeOriginal}`} type="number" step="0.01" placeholder="Custo/base" value={it.novo.custo_unitario} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, custo_unitario: e.target.value } })} className="w-24 p-2 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-600 text-xs outline-none focus:border-emerald-500" />
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
                           <label htmlFor="ia-receita-preparo" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de preparo (editável)</label>
                           <textarea id="ia-receita-preparo" value={iaFResultado.modo_preparo} onChange={e=>setIaFResultado({...iaFResultado, modo_preparo: e.target.value})} className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 text-sm outline-none focus:border-emerald-500 resize-none"></textarea>
                        </div>

                        <button onClick={() => setIaFResultado(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Voltar e enviar outra receita/foto</button>
                     </>
                  )}
               </div>

               {iaFResultado && (
                  <div className="p-4 sm:p-8 sm:pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
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
