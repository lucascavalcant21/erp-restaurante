"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas, salvarFicha, removerFicha, fetchInsumos, salvarInsumo, atualizarOrdemFicha } from "../../../lib/operacao";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchMontagens, inserirMontagem } from "../../../lib/montagem";
import { LayoutList, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft, UtensilsCrossed, Wine, ChevronRight, Printer, Sparkles, Loader2, Camera, CheckCircle2, AlertTriangle, GripVertical, Calculator } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Categorias do cardápio (cozinha). Os pratos são divididos nessas seções.
const CATEGORIAS_CARDAPIO = [
  "Entradas", "Executivo", "Moquecas e Caldeirada", "Vatapá", "Maniçoba",
  "Menu Degustação", "Sobremesas", "Sucos",
];

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
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
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
  
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [fichas, setFichas] = useState([]);
  const [insumosAtivos, setInsumosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  const [iaExplicacao, setIaExplicacao] = useState("");
  const [autoSoma, setAutoSoma] = useState(true);

  const [selecionadas, setSelecionadas] = useState([]);
  const [dragId, setDragId] = useState(null); // arrastar para reordenar

  // Estado do formulário da Ficha
  const [form, setForm] = useState({
    id: null,
    departamento: deptUrl,
    nome_receita: "",
    categoria: "",
    rendimento_porcoes: "1",
    modo_preparo: "",
    eh_base: false,
    rendimento_unidade: "porcao",
    peso_porcao_g: "",
    imagem: "" // Base64 da foto
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
      id: null, departamento: deptUrl,
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
    setLoading(true);
    const [resFichas, resInsumos] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, deptUrl)
    ]);
    setFichas(resFichas.data || []);
    setInsumosAtivos(resInsumos.data || []);
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
    if (tipoFiltro === "Pré-preparos") return !!f.eh_base;
    if (tipoFiltro === "Pratos") return !f.eh_base;
    return !f.eh_base && (f.categoria || "") === tipoFiltro; // categoria específica
  };
  const filtradas = fichas
    .filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()) && passaFiltro(f))
    .sort(ordenarFichas);

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
    setForm({ id: null, departamento: deptUrl, nome_receita: "", categoria: "", rendimento_porcoes: "1", modo_preparo: "", eh_base: false, rendimento_unidade: "porcao", peso_porcao_g: "", imagem: "" });
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
       categoria: ficha.categoria || "",
       rendimento_porcoes: ficha.rendimento_porcoes,
       modo_preparo: ficha.modo_preparo || "",
       eh_base: !!ficha.eh_base,
       rendimento_unidade: ficha.rendimento_unidade || "porcao",
       peso_porcao_g: ficha.peso_porcao_g || "",
       imagem: ficha.imagem || ""
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
             modo: getSub(base?.rendimento_unidade) ? "sub" : "base",
          };
       }
       return {
          chave: fi.insumos.id, tipo: "insumo", insumo_id: fi.insumos.id,
          nome: fi.insumos.nome, unidade: fi.insumos.unidade_medida,
          custo_unitario: fi.insumos.custo_unitario, quantidade: fi.quantidade,
          peso_medio_g: fi.insumos.peso_medio_g || null,
          modo: getSub(fi.insumos.unidade_medida) ? "sub" : "base",
       };
    });
    setIngFicha(mapIng);
    setIaExplicacao("");
    setModalNovo(true);
  };

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

  const handleSalvar = async () => {
    if(!form.nome_receita.trim()) return alert("Digite o nome da receita");
    if(!form.rendimento_porcoes) return alert("Digite o rendimento");

    // Filtra ingredientes que estão com qtd = 0
    const ingValidos = ingFicha.filter(i => i.quantidade > 0);
    if(ingValidos.length === 0) return alert("Adicione pelo menos um ingrediente com quantidade válida.");

    const erro = await salvarFicha(
       {
          id: form.id,
          unidade_id: unidadeAtiva,
          departamento: form.departamento,
          nome_receita: form.nome_receita,
          categoria: form.eh_base ? null : (form.categoria || null),
          rendimento_porcoes: Number(form.rendimento_porcoes),
          modo_preparo: form.modo_preparo,
          eh_base: !!form.eh_base,
          rendimento_unidade: form.rendimento_unidade || "porcao",
          peso_porcao_g: form.peso_porcao_g ? Number(form.peso_porcao_g) : null,
          imagem: form.imagem || null
       },
       ingValidos.map(i => ({
          insumo_id: i.tipo === "insumo" ? i.insumo_id : null,
          subficha_id: i.tipo === "base" ? i.subficha_id : null,
          quantidade: i.quantidade
       }))
    );

    if(erro.error) return alert("Erro ao salvar: " + erro.error);

    setModalNovo(false);
    carregar();

    // PRATO/DRINK novo: cai automaticamente no Cardápio (aguardando preço) e
    // no Guia de Montagem. Pré-preparo não dispara nada (é só uma base).
    const fichaIdSalva = erro.id;
    if (!form.id && !form.eh_base && fichaIdSalva) {
      try {
        const nome = form.nome_receita.trim();
        const ehBarDept = form.departamento === "bar";

        // 1) Cardápio: cria o produto com preço 0 (você precifica lá)
        const { data: prods } = await fetchProdutos(unidadeAtiva, form.departamento);
        const jaTemProduto = (prods || []).some(p =>
          p.ficha_id === fichaIdSalva || (p.nome_produto || "").toLowerCase() === nome.toLowerCase()
        );
        if (!jaTemProduto) {
          await salvarProduto({
            unidade_id: unidadeAtiva,
            nome_produto: nome,
            categoria: ehBarDept ? "Drinks" : "Pratos Principais",
            departamento: form.departamento,
            tempo_preparo_base: 15,
            preco_venda: 0,
            ficha_id: fichaIdSalva,
            composicao: [{ ficha_id: fichaIdSalva, qtd: 1 }],
          });
        }

        // 2) Guia de Montagem: entra como ficha pendente de montagem
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

        alert(`"${nome}" salvo!\n\nJá foi enviado para:\n· Produtos e Preços — defina o preço de venda lá\n· Montagem — crie o passo a passo lá`);
      } catch { /* integrações não bloqueiam o salvar da ficha */ }
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

  const imprimirLivroSelecionadas = () => {
    if (selecionadas.length === 0) return;
    const fichasParaImprimir = fichas.filter(f => selecionadas.includes(f.id));
    imprimirFichas(fichasParaImprimir);
  };

  const imprimirFicha = (f) => {
    imprimirFichas([f]);
  };

  const imprimirFichas = (listaDeFichas) => {
    const win = window.open('', '_blank');
    if(!win) return alert("Habilite pop-ups para imprimir a ficha.");
    const SUB = { kg: { s: 'g', fa: 1000 }, l: { s: 'ml', fa: 1000 } };
    const fmtQtd = (qtd, un) => {
       const c = SUB[String(un || '').toLowerCase()];
       return c ? `${(+(qtd * c.fa)).toLocaleString('pt-BR')} ${c.s}` : `${qtd} ${String(un || '').toUpperCase()}`;
    };
    
    let conteudoHTML = `
       <!DOCTYPE html><html><head><meta charset="utf-8"/><title>Livro de Receitas</title>
       <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:18px;max-width:780px;margin:0 auto}
          /* Bloco compacto: cabem 2 pratos por página */
          .bloco{page-break-inside:avoid;border-bottom:3px double #94a3b8;padding-bottom:14px;margin-bottom:16px}
          .bloco:last-child{border-bottom:none;margin-bottom:0}
          .quebra{page-break-after:always}
          .head{display:flex;gap:14px;align-items:flex-start;border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:8px}
          .head-info{flex:1;min-width:0}
          /* Foto do prato: mostra inteira (sem cortar), tamanho compacto */
          .head-foto{width:250px;height:180px;border-radius:12px;object-fit:contain;background:#f1f5f9;border:1px solid #cbd5e1;display:block;flex-shrink:0}
          .tag{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#475569;font-weight:bold}
          h1{font-size:26px;line-height:1.1;margin:4px 0}
          .meta{font-size:16px;color:#0f172a;font-weight:bold;margin-top:2px}
          h2{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#0f172a;margin:10px 0 4px;border-bottom:1px solid #cbd5e1;padding-bottom:3px}
          table{width:100%;border-collapse:collapse;font-size:15px}
          th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #e2e8f0}
          th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b}
          td{font-weight:600}
          td.c{text-align:center}td.r,th.r{text-align:right}
          .preparo{margin-top:4px;font-size:14px;line-height:1.55;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-weight:500}
          @media print{@page{margin:10mm}}
          .capa { height: 90vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
          .capa h1 { font-size: 48px; margin-bottom: 16px; }
          .capa p { font-size: 18px; color: #64748b; }
       </style></head><body>
    `;

    if (listaDeFichas.length > 1) {
       conteudoHTML += `
         <div class="capa">
           <h1>Livro de Receitas</h1>
           <p>${listaDeFichas.length} receitas catalogadas</p>
           <p style="margin-top: 40px; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Hephaestus ERP</p>
         </div>
       `;
    }

    listaDeFichas.forEach((f, idxFicha) => {
      const custoTotal = custoTotalDaFicha(f, fichas);
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
         return `<tr><td>${nome}</td><td class="c">${fmtQtd(fi.quantidade, unidade)}</td></tr>`;
      }).join('');
      const rende = f.rendimento_porcoes || 1;
      const peso = infoPesoFicha(f, fichas);
      const unR = String(f.rendimento_unidade || 'porcao').toLowerCase();
      const labelUnPrint = { porcao: `porç${rende > 1 ? 'ões' : 'ão'}`, kg: 'kg', g: 'g', l: 'L', ml: 'ml', un: 'un' }[unR] || unR;
      // No lugar do rendimento por quantidade, mostra o PESO do prato (quando dá)
      const linhaPesoOuRende = peso
         ? `<div class="meta">Peso do prato: ${fmtG(peso.pesoTotalG)}</div>`
         : `<div class="meta">Rendimento: ${Number(rende).toLocaleString('pt-BR')} ${labelUnPrint}</div>`;

      const tagFoto = f.imagem ? `<img src="data:image/jpeg;base64,${f.imagem}" class="head-foto" />` : '';

      const tagCat = f.categoria ? ` — ${f.categoria}` : (f.departamento ? ' — ' + f.departamento : '');

      // Quebra de página a cada 2 pratos (o bloco é compacto: tudo na mesma página)
      const quebra = (idxFicha % 2 === 1 && idxFicha < listaDeFichas.length - 1) ? ' quebra' : '';

      conteudoHTML += `
         <div class="bloco${quebra}">
            <div class="head">
               ${tagFoto}
               <div class="head-info">
                  <div class="tag">Ficha de Montagem${tagCat}</div>
                  <h1>${f.nome_receita}</h1>
                  ${linhaPesoOuRende}
               </div>
            </div>
            <h2>Ingredientes</h2>
            <table>
               <thead><tr><th>Ingrediente</th><th class="c">Quantidade</th></tr></thead>
               <tbody>${rows || '<tr><td colspan="2">Sem ingredientes cadastrados.</td></tr>'}</tbody>
            </table>
            <h2>Montagem e Modo de Preparo</h2>
            <div class="preparo">${f.modo_preparo ? f.modo_preparo : 'Não informado.'}</div>
         </div>
      `;
    });

    conteudoHTML += `</body></html>`;
    win.document.write(conteudoHTML);
    win.document.close();
    setTimeout(() => win.print(), 400);
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
      return `
      <div class="item">
        <div class="foto">${foto}</div>
        <div class="info">
          <h3>${f.nome_receita}</h3>
          <ul>${ings.map(i => `<li><b>${i.qtd}</b> ${i.nome}</li>`).join("") || "<li>Sem ingredientes cadastrados</li>"}</ul>
        </div>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${titulo} - ${unidadeAtiva}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#F3EBDC;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:Georgia,'Times New Roman',serif;color:#2B2118;padding:9mm 8mm}
        .cabeca{text-align:center;border-bottom:2px solid #2B2118;padding-bottom:10px;margin-bottom:14px}
        .cabeca h1{font-size:24px;letter-spacing:6px;font-weight:bold}
        .cabeca p{font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#7A5C43;margin-top:4px}
        .grade{column-count:2;column-gap:8mm}
        .item{display:flex;gap:10px;align-items:flex-start;break-inside:avoid;margin-bottom:12px;padding-bottom:10px;border-bottom:1px dotted #C8B69A}
        .foto{width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#2B2118;color:#F3EBDC;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold;border:2px solid #7A5C43}
        .foto img{width:100%;height:100%;object-fit:cover}
        .info h3{font-family:Arial,sans-serif;font-size:12.5px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
        .info ul{list-style:none}
        .info li{font-family:Arial,sans-serif;font-size:10.5px;color:#4A3B2A;line-height:1.55}
        .info li b{color:#8C2B2B}
        .rodape{text-align:center;font-family:Arial,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A5C43;margin-top:10px;border-top:2px solid #2B2118;padding-top:8px}
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="cabeca">
        <h1>${titulo}</h1>
        <p>${unidadeInfo?.nome || ""} · receituário padrão ${ehBar ? "do bar" : "da cozinha"}</p>
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
    win2.document.write(html);
    win2.document.close();
    setTimeout(() => win2.print(), 500);
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 py-4 sm:py-6 px-4 sm:px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
               <div className={`hidden sm:flex w-14 h-14 shrink-0 rounded-2xl items-center justify-center shadow-inner ${deptUrl === 'bar' ? 'bg-slate-100 text-emerald-600' : 'bg-slate-100 text-slate-800'}`}>
                 <LayoutList size={28} />
              </div>
              <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900">{deptUrl === "bar" ? "Receitas de Drinks" : "Receitas"}</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Receituário e Custos - {deptUrl}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto overflow-x-auto">
               <button onClick={imprimirManual} title={deptUrl === "bar" ? "Pôster com todos os drinks e medidas" : "Pôster com todas as receitas e medidas"} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 sm:px-5 py-3 rounded-xl font-bold whitespace-nowrap hover:bg-slate-50 transition-colors shadow-sm">
                  <Printer size={18} /> <span className="hidden md:inline">{deptUrl === "bar" ? "Manual de Coquetelaria" : "Manual da Cozinha"}</span><span className="md:hidden">Manual</span>
               </button>
               <button onClick={abrirModalIAFicha} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-3 sm:px-5 py-3 rounded-xl font-bold whitespace-nowrap hover:bg-emerald-50 transition-colors shadow-sm">
                  <Sparkles size={18} /> Montar com IA
               </button>
               <button onClick={abrirNova} className="flex items-center gap-2 text-white px-3 sm:px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-colors shadow-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20">
                  <Plus size={18} /> Nova Receita
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
         {/* Abas: Pratos + categorias do cardápio + Pré-preparos + Todos */}
         <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
            {[
              ["Pratos", deptUrl === "bar" ? "Drinks" : "Pratos", fichas.filter(f => !f.eh_base).length],
              ...(deptUrl === "bar" ? [] : CATEGORIAS_CARDAPIO.map(c => [c, c, fichas.filter(f => !f.eh_base && (f.categoria || "") === c).length])),
              ["Pré-preparos", "Pré-preparos", fichas.filter(f => !!f.eh_base).length],
              ["Todos", "Todos", fichas.length],
            ].map(([t, label, n]) => (
              <button key={t} onClick={() => setTipoFiltro(t)}
                className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${tipoFiltro === t ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                {label} <span className={tipoFiltro === t ? "text-emerald-200" : "text-slate-400"}>({n})</span>
              </button>
            ))}
         </div>
         {tipoFiltro === "Pratos" && (
            <p className="text-[11px] font-bold text-slate-400 mb-4 px-1">
              {deptUrl === "bar"
                ? "Monte o drink aqui: adicione os insumos e os pré-preparos (xaropes, mixes, infusões) como componentes. Produtos e Preços só faz a precificação."
                : "Monte o prato aqui: adicione insumos e os pré-preparos como componentes. Produtos e Preços só faz a precificação."}
            </p>
         )}
         {tipoFiltro === "Pré-preparos" && (
            <p className="text-[11px] font-bold text-slate-400 mb-4 px-1">
              {deptUrl === "bar"
                ? "Bases usadas dentro dos drinks (xarope simples, mix de limão, infusões, espumas). Marque \"É uma base/pré-preparo\" ao criar."
                : "Bases usadas dentro de outros pratos (molhos, massas, caldos). Marque \"É uma base/pré-preparo\" ao criar."}
            </p>
         )}
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex flex-col sm:flex-row items-center gap-3 shadow-sm justify-between">
            <div className="flex flex-1 items-center gap-2 px-2">
               <Search size={20} className="text-slate-500" />
               <input type="text" placeholder="Buscar receita..." value={busca} onChange={e=>setBusca(e.target.value)} className="w-full outline-none font-bold text-slate-700 p-2" />
            </div>
            
            {/* Controles de Livro de Receitas */}
             <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-3 w-full sm:w-auto">
                <button onClick={toggleSelecionarTodas} className="text-xs font-bold text-slate-500 hover:text-emerald-600 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 whitespace-nowrap">
                  {selecionadas.length === filtradas.length && filtradas.length > 0 ? "Desmarcar Todas" : "Selecionar Todas"}
               </button>
               {selecionadas.length > 0 && (
                  <button onClick={imprimirLivroSelecionadas} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 text-xs shadow-md">
                     <Printer size={16}/> Imprimir Livro ({selecionadas.length})
                  </button>
               )}
            </div>
         </div>

         {loading ? (
            <p className="font-bold text-slate-500">Buscando receitas...</p>
         ) : filtradas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <LayoutList size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">Nenhuma ficha encontrada</h3>
               <p className="text-slate-500 mt-2 font-medium">Cadastre suas receitas para calcular automaticamente o custo do prato.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filtradas.map(f => {
                  const peso = infoPesoFicha(f, fichas);
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
                  const labelUn = { porcao: "porções", kg: "kg", g: "g", l: "L", ml: "ml", un: "un" }[unR] || unR;
                  const pesoTxt = peso ? `Peso: ${fmtG(peso.pesoTotalG)}` : `Rende: ${Number(f.rendimento_porcoes).toLocaleString("pt-BR")} ${labelUn}${unR === "porcao" && f.peso_porcao_g ? ` de ${f.peso_porcao_g}g` : ''}`;

                  return (
                     <div key={f.id}
                        onDragOver={e => { if (dragId) e.preventDefault(); }}
                        onDrop={() => reordenar(dragId, f.id)}
                        className={`bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all relative group flex flex-col overflow-hidden ${dragId === f.id ? 'opacity-50' : ''} ${selecionadas.includes(f.id) ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}>
                        {/* Foto do prato em destaque */}
                        <div className="h-44 bg-slate-100 relative">
                           {f.imagem ? (
                              <img src={`data:image/jpeg;base64,${f.imagem}`} alt={f.nome_receita} className="w-full h-full object-cover" />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                 {f.departamento === 'bar' ? <Wine size={52}/> : <UtensilsCrossed size={52}/>}
                              </div>
                           )}
                           {/* Alça para arrastar e reordenar */}
                           <div draggable onDragStart={() => setDragId(f.id)} onDragEnd={() => setDragId(null)}
                              title="Arraste para reordenar"
                              className="absolute bottom-3 left-3 bg-white/90 backdrop-blur rounded-lg p-1.5 text-slate-500 shadow-sm cursor-grab active:cursor-grabbing">
                              <GripVertical size={16} />
                           </div>
                           <label className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-md p-1 cursor-pointer shadow-sm">
                              <input type="checkbox" checked={selecionadas.includes(f.id)} onChange={() => toggleSelecionar(f.id)} className="w-5 h-5 accent-emerald-600 cursor-pointer rounded-md block"/>
                           </label>
                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => abrirSimulacao(f)} title="Simular outro rendimento" className="p-2 bg-white/90 backdrop-blur rounded-lg text-slate-600 hover:text-emerald-600 shadow-sm"><Calculator size={16}/></button>
                              <button onClick={() => imprimirFicha(f)} title="Imprimir ficha técnica" className="p-2 bg-white/90 backdrop-blur rounded-lg text-slate-600 hover:text-emerald-600 shadow-sm"><Printer size={16}/></button>
                              <button onClick={() => abrirEditar(f)} className="p-2 bg-white/90 backdrop-blur rounded-lg text-slate-600 hover:text-emerald-600 shadow-sm"><Edit3 size={16}/></button>
                              <button onClick={() => handleRemover(f.id)} className="p-2 bg-white/90 backdrop-blur rounded-lg text-slate-600 hover:text-rose-600 shadow-sm"><Trash2 size={16}/></button>
                           </div>
                        </div>
                        <div className="p-5">
                           <h3 className="text-xl font-black text-slate-800 leading-tight mb-1">{f.nome_receita}</h3>
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{pesoTxt}</p>
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </div>

      {/* MODAL DE CRIAÇÃO DA FICHA TÉCNICA */}
      {modalNovo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4">
             <div className="bg-white rounded-3xl sm:rounded-[32px] w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center gap-3 p-4 sm:p-6 border-b border-slate-100 bg-white">
                  <div>
                     <h2 className="font-black text-xl sm:text-2xl text-slate-800">{form.id ? "Editar Receita" : "Nova Receita"}</h2>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Custo Total Atual: <span className="text-emerald-600 font-black">{fmtBRL(calcularCustoTotal(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                  
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
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Receita</label>
                           <input type="text" placeholder="Ex: Caipirinha de Morango" value={form.nome_receita} onChange={e=>setForm({...form, nome_receita: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                           {form.imagem && <button type="button" onClick={() => setForm({ ...form, imagem: "" })} className="text-[11px] font-bold text-rose-500 hover:text-rose-600 mt-1.5">Remover foto</button>}
                        </div>
                     </div>
                     {/* Tipo da ficha: PRATO/DRINK (vai pro cardápio) ou PRÉ-PREPARO (base) */}
                     <div className="flex gap-2">
                        <button type="button" onClick={() => setForm({ ...form, eh_base: false })}
                           className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${!form.eh_base ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                           {deptUrl === "bar" ? "Drink" : "Prato"}
                           <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">vai pro cardápio · monte com insumos e pré-preparos</span>
                        </button>
                        <button type="button" onClick={() => setForm({ ...form, eh_base: true })}
                           className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${form.eh_base ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-600/20" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                           Pré-preparo
                           <span className="block text-[9px] font-bold normal-case tracking-normal mt-0.5 opacity-80">{deptUrl === "bar" ? "xarope, mix, infusão — usado dentro dos drinks" : "molho, massa, caldo — usado dentro dos pratos"}</span>
                        </button>
                     </div>
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
                  </div>

                  {/* COLUNA DIREITA: Ingredientes da Ficha */}
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

               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-6 border-t border-slate-100 bg-white">
                  <button onClick={handleSalvar} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> Salvar Receita ({fmtBRL(calcularCustoTotal(ingFicha))})
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
                         <h2 className="font-black text-xl sm:text-2xl text-slate-800">Montar Receita com IA</h2>
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
