"use client";

// FICHAS TÉCNICAS — listagem da cozinha e do bar.
//
// Duas famílias de ficha, em abas: PRÉ-PREPAROS (fichas de produção) e PRATOS
// (fichas de montagem). O tipo vem de `eh_base` e decide tudo — editor,
// visualização, PDF e Livro de Receitas — pela configuração central de
// lib/ficha-modelo.mjs. Esta tela lista, filtra e escolhe o que abrir.

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  atualizarCategoriaFicha, excluirFichasLote, fetchFichas, fetchInsumos,
  inativarFichasLote, registrarAuditoriaFichas, salvarFicha,
} from "../../../lib/operacao";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchEmbalagens } from "../../../lib/embalagens";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, BookOpen, Calculator, Camera,
  CheckCircle2, CheckSquare2, ChefHat, ChevronLeft, ChevronRight, Copy, Download, Edit3,
  FileDown, FileText, FolderPlus, LayoutList, Loader2, MoreVertical, PieChart, Plus, Printer, Save,
  Search, Sparkles, Trash2, Wine, X,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { logoSeldeestrelaSVG } from "../../../lib/marca";
import { baixarPdfDeHtml } from "../../../lib/pdf";
import { fetchHistoricoCustoFicha, registrarCustoFicha } from "../../../lib/ficha-custos";
import { fetchCategoriasFichas, salvarCategoriasFichas, fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import PizzaDoPrato from "./PizzaDoPrato";
import { fetchComplementosDeFichas, duplicarFicha } from "../../../lib/ficha-tecnica";
import { estimarPaginasDocumento, ordenarFichasDocumento } from "../../../lib/fichas-lote-utils.mjs";
import {
  TIPOS_FICHA, tipoFichaDe, estiloDoTipo, categoriasDoTipo, configCategoriasDoTipo, CHAVE_CONFIG_CATEGORIA,
  podeVerCustosFicha, dadosDaFicha, entraNoReceituario, quantidadeComUnidade, custosDoPrePreparo, brlUnitario,
  comCustoDeEmbalagens,
} from "../../../lib/ficha-modelo.mjs";
import { montarDocumentoFichas, nomeDoArquivo } from "../../../lib/ficha-documento.mjs";
import { unidadeNormalizada } from "../../../lib/ingredientes-utils.mjs";
import {
  converterParaBaseDoInsumo, custoDeProduzirFicha as custoTotalDaFicha, fichasQueUsam,
  pesoTotalDaFicha, unidadePadraoDepartamento, rendimentoPadronizado,
} from "../../../lib/ficha-calculos.mjs";
import EditorFicha, { ICONE_DO_TIPO } from "./componentes/EditorFicha";
import ModalIAFicha from "./componentes/ModalIAFicha";
import { FichaDocumento } from "./componentes/VisualizacaoFicha";
import PainelCustosInternos from "./componentes/PainelCustosInternos";


// Botão "Fechar" + fechamento automático após imprimir — no celular a aba de
// impressão ficava presa e o usuário não conseguia voltar ao app.
function comFecharImpressao(html) {
  const extra = `
    <style>@media print{.__fechar-imp{display:none!important}}</style>
    <button class="__fechar-imp" onclick="window.close()" style="position:fixed;top:10px;right:10px;z-index:2147483647;padding:12px 18px;font:700 15px sans-serif;background:#0f172a;color:#fff;border:0;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer">✕ Fechar</button>
    <script>window.onafterprint=function(){setTimeout(function(){try{window.close()}catch(e){}},200)}<\/script>`;
  return html.includes("</body>") ? html.replace("</body>", extra + "</body>") : html + extra;
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

// Margem das páginas do PDF das fichas (mm): o conteúdo corre em fluxo e não
// pode encostar na borda quando passa de uma folha para a outra.
const MARGEM_PDF_MM = 12;

// Abas da tela, na ordem pedida: pré-preparos primeiro, pratos depois.
const ABAS = ["pre_preparo", "prato"];
const DESCRICAO_ABA = { pre_preparo: "Fichas de produção", prato: "Fichas de montagem" };

function FichasRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") === "bar" ? "bar" : "cozinha";
  const { abrirMenu, unidadeAtiva, unidadeInfo, sessao } = useERP();

  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]); // preços de venda (vêm do cardápio interno)
  const [insumosAtivos, setInsumosAtivos] = useState([]);
  const [embalagensCat, setEmbalagensCat] = useState([]); // catálogo de Embalagens (dept embalagens)
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState(() => searchParams.get("q") || "");
  // Aba = tipo da ficha. A página da ficha volta para a aba certa com ?tipo=.
  const [tipoAba, setTipoAba] = useState(() => (searchParams.get("tipo") === "pre_preparo" ? "pre_preparo" : "prato"));
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [categoriasConfig, setCategoriasConfig] = useState({});
  const [modalCategorias, setModalCategorias] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [alterandoCategoriaId, setAlterandoCategoriaId] = useState("");
  const [mostrarIndicadores, setMostrarIndicadores] = useState(false);
  const [apenasAcimaMeta, setApenasAcimaMeta] = useState(false);
  // Ficha inativada continua no banco e volta quando o usuário quiser ver.
  const [filtroStatus, setFiltroStatus] = useState("ativas"); // ativas | inativas | todas
  const [categoriasRecolhidas, setCategoriasRecolhidas] = useState(false);
  const [acoesCardAberto, setAcoesCardAberto] = useState("");

  // Permissão de ver custos (falha para o lado aberto onde o controle de
  // acesso ainda não foi ligado — ver podeVerCustosFicha).
  const podeVerCustos = podeVerCustosFicha(sessao, deptUrl);

  // Editor único: { tipo, ficha (null = nova), rascunho (da IA), chave }.
  const [editor, setEditor] = useState(null);
  const [modalIA, setModalIA] = useState(false);
  const [modalEscolhaNovo, setModalEscolhaNovo] = useState(false);
  const [modalTitulosLote, setModalTitulosLote] = useState(false);
  const [titulosLote, setTitulosLote] = useState("");
  const [salvandoTitulosLote, setSalvandoTitulosLote] = useState(false);
  const [avisoSalvar, setAvisoSalvar] = useState("");

  // Visualização: a ficha aberta vem sempre da lista, para refletir o que foi salvo.
  const [fichaViewId, setFichaViewId] = useState(null);
  const fichaView = fichaViewId ? fichas.find(f => f.id === fichaViewId) || null : null;
  const [complementosView, setComplementosView] = useState(null);
  const [viewTab, setViewTab] = useState("ficha"); // ficha | custos
  const [histCustos, setHistCustos] = useState([]); // histórico de custos da ficha aberta
  const [histStatus, setHistStatus] = useState("idle"); // idle | carregando | ok | sem_tabela
  const [registrandoCusto, setRegistrandoCusto] = useState(false);
  const [semeandoCustos, setSemeandoCustos] = useState(false);

  const [selecionadas, setSelecionadas] = useState([]);
  // Pizza do prato: vale para a grade inteira, nao por cartao. O gestor quer
  // comparar a fatia de lucro de um prato com a do outro lado a lado.
  const [verPizza, setVerPizza] = useState(false);
  // Custo fixo e CMO vem dos parametros do Ponto de Equilibrio; sem eles a
  // pizza mostra so o que a propria ficha sabe.
  const [paramsSis, setParamsSis] = useState(PARAMS_PADRAO);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(12);
  const [modalImpressao, setModalImpressao] = useState(null); // { modo, lista }
  const [configImpressao, setConfigImpressao] = useState(null);
  // Armazenamento, equipamentos, alergênicos etc. das fichas que vão para o
  // documento. `null` enquanto carrega: gerar antes disso sairia incompleto.
  const [complementosImpressao, setComplementosImpressao] = useState(null);
  const [ordemPersonalizada, setOrdemPersonalizada] = useState([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [mensagemLote, setMensagemLote] = useState("");
  const [erroLote, setErroLote] = useState("");

  // Simulação de rendimento: recalcula os ingredientes para outra quantidade
  const [modalSim, setModalSim] = useState(null); // ficha sendo simulada
  const [simAlvo, setSimAlvo] = useState("");      // rendimento desejado (mesma unidade)
  const abrirSimulacao = (f) => {
    const padrao = rendimentoPadronizado(f);
    const fichaPadronizada = { ...f, rendimento_porcoes: padrao.valor, rendimento_unidade: padrao.unidade };
    setModalSim(fichaPadronizada);
    setSimAlvo(String(padrao.valor || 1));
  };

  const carregar = async () => {
    setLoading(true);
    const [resFichas, resInsumos, resProd, resEmbalagens, resEstoqueEmbalagens] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, deptUrl, { excluirPrePreparos: true }),
       fetchProdutos(unidadeAtiva),
       fetchInsumos(unidadeAtiva, "embalagens"),
       fetchEmbalagens(unidadeAtiva, deptUrl),
    ]);
    const produtosCarregados = resProd.data || [];
    // Embalagem do produto do cardápio entra no custo da ficha (CMV), como antes.
    setFichas(comCustoDeEmbalagens(resFichas.data || [], produtosCarregados, resEstoqueEmbalagens.data || []));
    setInsumosAtivos(resInsumos.data || []);
    setProdutos(produtosCarregados);
    setEmbalagensCat(resEmbalagens.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva, deptUrl]);

  useEffect(() => { setCategoriaFiltro(""); }, [deptUrl]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    fetchCategoriasFichas(unidadeAtiva).then(({ data }) => setCategoriasConfig(data || {}));
    // Rateio do custo fixo e da mao de obra. Se nao vier nada, ficam os
    // padroes e a pizza avisa na propria legenda que faltam preencher.
    fetchParams(unidadeAtiva).then(({ data }) => setParamsSis({ ...PARAMS_PADRAO, ...(data || {}) }));
  }, [unidadeAtiva]);

  // ── Tipo (aba) e categorias ──────────────────────────────────────────────
  const cfgAba = TIPOS_FICHA[tipoAba];
  const rotuloAba = tipoAba === "prato" ? "prato" : "pré-preparo";
  const categoriasDe = (departamento, tipo) => categoriasDoTipo({ departamento, tipo, config: categoriasConfig, fichas });
  const categoriasDaAba = categoriasDe(deptUrl, tipoAba);
  // Produto comprado pronto (cerveja, refrigerante) não é receita: fica fora
  // das duas abas — quem cuida dele é o Cardápio e o Estoque.
  const fichasDaAba = fichas.filter(f => tipoFichaDe(f) === tipoAba);
  const contagem = {
    prato: fichas.filter(f => tipoFichaDe(f) === "prato").length,
    pre_preparo: fichas.filter(f => tipoFichaDe(f) === "pre_preparo").length,
  };

  const trocarAba = (tipo) => {
    setTipoAba(tipo);
    setCategoriaFiltro("");
    setApenasAcimaMeta(false);
    setCategoriasRecolhidas(false);
  };

  // A configuração guardada tem uma lista por setor e por tipo. Configuração
  // antiga (plana) vira a lista de pratos na primeira gravação.
  const persistirCategorias = async (proximoDoTipo) => {
    const doSetor = categoriasConfig?.[deptUrl] || {};
    const lista = (v) => (Array.isArray(v) ? v : []);
    const normalizado = doSetor.principais || doSetor.preparos
      ? doSetor
      : {
          principais: { adicionais: lista(doSetor.adicionais), excluidas: lista(doSetor.excluidas) },
          preparos: { adicionais: [], excluidas: [] },
        };
    const proximo = { ...categoriasConfig, [deptUrl]: { ...normalizado, [CHAVE_CONFIG_CATEGORIA[tipoAba]]: proximoDoTipo } };
    setSalvandoCategoria(true);
    const { error } = await salvarCategoriasFichas(unidadeAtiva, proximo);
    setSalvandoCategoria(false);
    if (error) { alert("Não foi possível salvar as categorias: " + error); return false; }
    setCategoriasConfig(proximo);
    return true;
  };

  const criarCategoria = async () => {
    const nome = novaCategoria.trim();
    if (!nome) return;
    if (categoriasDaAba.some(item => item.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
      return alert("Essa categoria já existe.");
    }
    const atual = configCategoriasDoTipo(categoriasConfig, deptUrl, tipoAba);
    const ok = await persistirCategorias({
      adicionais: [...atual.adicionais, nome],
      excluidas: atual.excluidas.filter(item => item !== nome),
    });
    if (ok) setNovaCategoria("");
  };

  const excluirCategoria = async (nome) => {
    const quantidade = fichasDaAba.filter(ficha => ficha.categoria === nome).length;
    const aviso = quantidade
      ? `A categoria "${nome}" tem ${quantidade} ficha(s). Ela será removida da lista, mas as fichas não serão apagadas. Continuar?`
      : `Excluir a categoria "${nome}"?`;
    if (!confirm(aviso)) return;
    const atual = configCategoriasDoTipo(categoriasConfig, deptUrl, tipoAba);
    const ok = await persistirCategorias({
      adicionais: atual.adicionais.filter(item => item !== nome),
      excluidas: [...new Set([...atual.excluidas, nome])],
    });
    if (ok && categoriaFiltro === nome) setCategoriaFiltro("");
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
    if (tipoFichaDe(f) !== tipoAba) return false;
    if (filtroStatus === "ativas" && statusDaFicha(f) === "inativa") return false;
    if (filtroStatus === "inativas" && statusDaFicha(f) !== "inativa") return false;
    if (apenasAcimaMeta && !ehAcimaDaMeta(f)) return false;
    if (categoriaFiltro && (f.categoria || "") !== categoriaFiltro) return false;
    return true;
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

  useEffect(() => { setPagina(1); }, [busca, tipoAba, categoriaFiltro, porPagina, filtroStatus]);
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  // ── Criar, editar e visualizar ──────────────────────────────────────────
  // O tipo vem da aba (criar) ou da própria ficha (editar); o editor não
  // pergunta de novo.
  const abrirNova = (tipo = tipoAba, rascunho = null) => setEditor({ tipo, ficha: null, rascunho, chave: `nova-${Date.now()}` });
  const abrirEditar = (ficha) => setEditor({
    tipo: tipoFichaDe(ficha) === "pre_preparo" ? "pre_preparo" : "prato", ficha, rascunho: null, chave: ficha.id,
  });
  const abrirOpcaoNovo = () => {
    if (tipoAba === "pre_preparo") return abrirNova("pre_preparo");
    setModalEscolhaNovo(true);
  };

  const aoSalvarFicha = async ({ avisos = [], continuar }) => {
    if (!continuar) setEditor(null);
    setAvisoSalvar(avisos.join(" "));
    setMensagemLote(continuar ? "Ficha salva. Pode cadastrar a próxima." : "Ficha salva.");
    window.setTimeout(() => setMensagemLote(""), 3500);
    await carregar();
  };

  // "Gerenciar" no editor abre as categorias do tipo que está sendo editado.
  const gerenciarCategoriasDoEditor = (tipo) => {
    if (tipo !== tipoAba) trocarAba(tipo);
    setModalCategorias(true);
  };

  const abrirFicha = (f) => {
    setViewTab("ficha");
    setComplementosView(null);
    setFichaViewId(f.id);
    fetchComplementosDeFichas([f.id]).then(r => setComplementosView(r.data?.[f.id] || {}));
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
  }, [fichaViewId]);
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

  // Escala os ingredientes de uma ficha por um fator (simulação de rendimento).
  // Quantidade e custo pelas mesmas regras da ficha e do CMV.
  const linhasSimuladas = (f, factor) => (f.fichas_ingredientes || []).map((fi, i) => {
    const base = fi.subficha_id ? fichas.find(x => x.id === fi.subficha_id) : null;
    const insumo = fi.insumos;
    const unidade = base
      ? (base.rendimento_unidade || "kg")
      : (unidadeNormalizada(insumo?.unidade_medida) || String(insumo?.unidade_medida || "un").toLowerCase());
    const quantidade = base ? Number(fi.quantidade) || 0 : converterParaBaseDoInsumo(fi.quantidade, insumo?.unidade_medida, unidade);
    return {
      nome: insumo?.nome || base?.nome_receita || "Item",
      qtdFmt: quantidadeComUnidade(quantidade * factor, unidade),
      custo: custoTotalDaFicha({ id: `sim-${f.id}-${i}`, fichas_ingredientes: [fi] }, fichas) * factor,
    };
  });


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
      trocarAba("prato");
      setMensagemLote(`${criados} ${criados === 1 ? "título criado" : "títulos criados"}. Agora abra Editar em cada ficha para completar os dados.`);
      await carregar();
    }
    if (falhas.length) alert(`Alguns títulos não foram criados:\n\n${falhas.join("\n")}`);
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

  // Cópia completa (ingredientes e, no pré-preparo, armazenamento,
  // equipamentos e alergênicos). Nasce como rascunho, sem código; o tipo e o
  // setor são os da original.
  const duplicarFichasSelecionadas = async () => {
    if (!fichasSelecionadas.length || !confirm(`Duplicar ${fichasSelecionadas.length} ficha(s) selecionada(s)?`)) return;
    setProcessandoLote(true);
    const nomes = new Set(fichas.map(f => String(f.nome_receita || "").toLocaleLowerCase("pt-BR")));
    const criadas = [];
    const falhas = [];
    for (const origem of fichasSelecionadas) {
      let indice = 1;
      let sufixo = "(cópia)";
      while (nomes.has(`${origem.nome_receita} ${sufixo}`.toLocaleLowerCase("pt-BR"))) {
        indice += 1;
        sufixo = `(cópia ${indice})`;
      }
      const nome = `${origem.nome_receita} ${sufixo}`;
      nomes.add(nome.toLocaleLowerCase("pt-BR"));
      const resultado = await duplicarFicha(origem.id, { sufixo });
      if (resultado.error) falhas.push(`${origem.nome_receita}: ${resultado.error}`);
      else criadas.push({ id: resultado.id, nome_receita: nome });
    }
    await registrarAuditoriaFichas({
      ...usuarioAuditoria,
      acao: "duplicacao",
      fichas: criadas,
      detalhes: { originais: fichasSelecionadas.map(f => f.id) },
    });
    setProcessandoLote(false);
    setSelecionadas([]);
    setMensagemLote(`${criadas.length} cópia(s) criada(s) como rascunho, sem alterar as fichas originais.`);
    if (falhas.length) setErroLote(`Não foi possível duplicar: ${falhas.join(" · ")}`);
    await carregar();
    window.setTimeout(() => setMensagemLote(""), 3500);
  };

  // ── Documento: impressão, PDF e Livro de Receitas ───────────────────────
  // Todos saem de montarDocumentoFichas: cada ficha no template do seu tipo.
  const montarDocumento = (lista, { livro = false, capa = livro, indice = livro, foto = true, custos = true, complementos = {} } = {}) =>
    montarDocumentoFichas(lista, {
      todasFichas: fichas,
      complementos,
      // Custo só sai na ficha de pré-preparo, e só para quem pode ver custo.
      mostrarCustos: podeVerCustos && custos,
      livro, capa, indice,
      incluirFoto: foto,
      logoHtml: logoSeldeestrelaSVG(34),
      logoCapaHtml: logoSeldeestrelaSVG(70),
      nomeUnidade: unidadeInfo?.nome || "",
      data: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });

  const abrirJanelaDeImpressao = (html) => {
    const win = window.open("", "_blank");
    if (!win) return alert("O navegador bloqueou a janela pop-up. Habilite os pop-ups para imprimir.");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  const abrirPreviaImpressao = (modo, lista = fichasSelecionadas) => {
    const livro = modo === "livro";
    // O livro é o receituário: sem produto pronto e sem ficha inativada. Uma
    // seleção avulsa imprime o que a pessoa escolheu.
    const receitas = (lista || []).filter(f => (livro ? entraNoReceituario(f) : tipoFichaDe(f) !== "produto_pronto"));
    if (!receitas.length) return alert("Nenhuma ficha de prato ou de pré-preparo para imprimir.");
    // Os complementos chegam antes de a pessoa clicar em gerar: assim a janela
    // de impressão abre direto no clique e o navegador não a bloqueia.
    setComplementosImpressao(null);
    fetchComplementosDeFichas(receitas.map(f => f.id)).then(r => setComplementosImpressao(r.data || {}));
    setOrdemPersonalizada(receitas.map(f => f.id));
    setConfigImpressao({ ordem: livro ? "tipo" : "selecao", livro, capa: livro, indice: livro, foto: true, custos: true });
    setModalImpressao({ modo, lista: receitas });
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
      if (!lista.length) return alert("Nenhuma ficha selecionada.");
      const cfg = configImpressao;
      const html = montarDocumento(lista, {
        livro: cfg.livro, capa: cfg.livro && cfg.capa, indice: cfg.livro && cfg.indice,
        foto: cfg.foto, custos: cfg.custos, complementos: complementosImpressao || {},
      });
      if (acao === "pdf") baixarPdfDeHtml(html, nomeDoArquivo(lista, { livro: cfg.livro }), { margemMm: MARGEM_PDF_MM });
      else abrirJanelaDeImpressao(html);
      await registrarAuditoriaFichas({
        ...usuarioAuditoria,
        acao: cfg.livro ? "livro" : acao === "pdf" ? "pdf" : "impressao",
        fichas: lista,
        detalhes: cfg,
      });
    } catch (err) {
      console.error("Erro ao gerar documento:", err);
      alert("Ocorreu um erro ao gerar o documento: " + (err?.message || err));
    }
  };

  // PDF direto, sem prévia: a ficha avulsa, a seleção ou — com 6 ou mais — o
  // Livro de Receitas com capa e índice.
  const baixarPdfFichas = async (lista) => {
    const receitas = (lista || []).filter(f => tipoFichaDe(f) !== "produto_pronto");
    if (!receitas.length) return alert("Nenhuma ficha de prato ou de pré-preparo para baixar.");
    const livro = receitas.length >= 6;
    // A janela abre já no clique (senão o navegador bloqueia) e recebe o PDF
    // quando os dados chegam.
    let win = null;
    try { win = window.open("", "_blank", "width=900,height=1000"); } catch { win = null; }
    if (win) {
      win.document.write("<!DOCTYPE html><html><head><title>Gerando PDF...</title></head><body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#64748b;background:#f8fafc'><h3>Gerando PDF, aguarde um instante...</h3></body></html>");
    }
    try {
      const { data } = await fetchComplementosDeFichas(receitas.map(f => f.id));
      const html = montarDocumento(receitas, { livro, complementos: data || {} });
      baixarPdfDeHtml(html, nomeDoArquivo(receitas, { livro }), { windowRef: win, margemMm: MARGEM_PDF_MM });
      registrarAuditoriaFichas({ ...usuarioAuditoria, acao: livro ? "livro" : "pdf", fichas: receitas, detalhes: { origem: "baixar_pdf" } });
    } catch (err) {
      if (win) win.close();
      alert("Ocorreu um erro ao gerar o PDF: " + (err?.message || err));
    }
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

  return (
    <div className="erp-fichas-theme min-h-screen bg-slate-50 pb-24 text-slate-800">
      <style>{`
        .erp-fichas-theme { font-family: Aptos, "Segoe UI Variable", "Segoe UI", Arial, sans-serif; letter-spacing: -0.006em; }
        .erp-fichas-theme .font-black { font-weight: 700 !important; }
        .erp-fichas-theme .font-bold { font-weight: 600 !important; }
        .erp-fichas-theme input, .erp-fichas-theme select, .erp-fichas-theme textarea, .erp-fichas-theme button { font-family: inherit; }
        .erp-fichas-card { box-shadow: 0 5px 18px rgb(30 41 59 / .06); }
        .erp-fichas-card:hover { box-shadow: 0 12px 28px rgb(30 41 59 / .10); }
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
                <div className="flex items-center rounded-xl border border-slate-200/80 bg-elevated p-1" role="group" aria-label="Setor">
                  {[["cozinha", "Cozinha", ChefHat], ["bar", "Bar", Wine]].map(([id, rotulo, Icone]) => (
                    <button key={id} type="button" aria-pressed={deptUrl === id}
                      onClick={() => router.push(`/dashboard/operacao/fichas?dept=${id}${tipoAba === "pre_preparo" ? "&tipo=pre_preparo" : ""}`)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${deptUrl === id ? "bg-card text-accent shadow-sm" : "text-muted hover:text-slate-800"}`}>
                      <Icone size={14} /> {rotulo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="erp-busca-fixa flex flex-col gap-3 sm:flex-row" style={estiloDoTipo(cfgAba)}>
              <label className="flex min-w-0 items-center gap-2 rounded-2xl border-2 border-slate-300 bg-card px-3.5 shadow-sm transition-all focus-within:border-[color:var(--tipo)] sm:w-[400px]">
                <Search size={19} className="shrink-0 text-fg-soft" />
                <input value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar ficha"
                  placeholder={tipoAba === "pre_preparo" ? "Buscar pré-preparo por nome..." : deptUrl === "bar" ? "Buscar drink ou prato..." : "Buscar prato por nome..."}
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-fg outline-none placeholder:font-medium placeholder:text-subtle" />
                {busca && <button onClick={() => setBusca("")} className="text-subtle hover:text-fg-soft" title="Limpar busca"><X size={16} /></button>}
              </label>
              <button onClick={() => setModalIA(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--tipo)] bg-[color:var(--tipo-soft)] px-4 text-sm font-black text-[color:var(--tipo)] shadow-sm">
                <Sparkles size={18} /> Criar {rotuloAba} com IA
              </button>
              <button onClick={abrirOpcaoNovo} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[color:var(--tipo)] px-5 text-sm font-black text-[color:var(--tipo-fg)] shadow-lg">
                <Plus size={18} /> Criar {rotuloAba}
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto rounded-xl border border-line bg-slate-50 p-2">
            <button onClick={() => abrirPreviaImpressao("livro", fichas)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-elevated"><BookOpen size={14} /> Livro de receitas</button>
            <button onClick={() => baixarPdfFichas(selecionadas.length ? fichasSelecionadas : fichas.filter(entraNoReceituario))} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-elevated"><Download size={14} /> Baixar PDF</button>
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
         {avisoSalvar ? (
           <div role="status" className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-[color:var(--warning)] bg-[color:var(--warning-soft)] px-4 py-3 text-sm font-bold text-[color:var(--warning-strong)]">
             <span className="flex items-start gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{avisoSalvar}</span>
             <button onClick={() => setAvisoSalvar("")} aria-label="Fechar aviso"><X size={16} /></button>
           </div>
         ) : null}
         {/* Kanban de indicadores: CMV médio, margem, custo, ticket */}
         <div className="mb-2 flex justify-end">
           <button type="button" onClick={() => setMostrarIndicadores(valor => !valor)} className="flex min-h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50">
             <BarChart3 size={15} /> {mostrarIndicadores ? "Ocultar indicadores" : "Ver indicadores"}
           </button>
         </div>

         {mostrarIndicadores && (() => {
            const base = fichasDaAba;
            if (!base.length) return null;
            if (tipoAba === "pre_preparo") {
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
                    <div key={c.rot} className={`rounded-2xl border shadow-sm px-3 py-2.5 ${c.alerta ? "bg-amber-50 border-amber-200" : "bg-card border-line"}`}>
                      <p className="text-3xs font-bold uppercase tracking-wider text-subtle leading-tight">{c.rot}</p>
                      <p className={`text-lg font-black mt-0.5 ${c.alerta ? "text-amber-700" : "text-[color:var(--ficha-preparo)]"}`}>{c.val}</p>
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
                                 ? "bg-amber-600 text-white border-amber-700 ring-4 ring-amber-500/20"
                                 : c.alerta
                                 ? "bg-amber-50 border-amber-200 hover:border-amber-300"
                                 : "bg-card border-line"
                           }`}
                        >
                           <p className={`text-3xs font-bold uppercase tracking-wider leading-tight flex items-center justify-between ${ativo ? "text-amber-100" : "text-subtle"}`}>
                              <span>{c.rot}</span>
                              {isAcima && <span className={`text-3xs font-bold ${ativo ? "text-white" : "text-amber-700"}`}>{ativo ? "FILTRADO" : "FILTRAR"}</span>}
                           </p>
                           <p className={`text-lg font-black mt-0.5 ${ativo ? "text-white" : c.alerta ? "text-amber-600" : "text-accent"}`}>{c.val}</p>
                           <p className={`text-3xs font-bold truncate ${ativo ? "text-amber-100" : "text-subtle"}`}>{c.sub}</p>
                        </div>
                     );
                  })}
               </div>
            );
         })()}

         {apenasAcimaMeta && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3.5 shadow-sm">
               <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
                     <AlertTriangle size={20} />
                  </div>
                  <div className="min-w-0">
                     <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Filtrando: pratos acima da meta de CMV</p>
                     <p className="text-xs font-bold text-amber-800 mt-0.5 truncate">{filtradas.length} prato(s) com CMV calculado maior que a meta definida.</p>
                  </div>
               </div>
               <button
                  onClick={() => setApenasAcimaMeta(false)}
                  className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2.5 shadow-sm transition-colors cursor-pointer"
               >
                  Ver todas
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

         {/* Tipo da ficha: a aba escolhida fica preenchida com a cor do tipo. */}
         <div className="mb-3 grid grid-cols-2 gap-2" role="tablist" aria-label="Tipo de ficha">
            {ABAS.map(tipo => {
              const cfg = TIPOS_FICHA[tipo];
              const Icone = ICONE_DO_TIPO[tipo];
              const ativa = tipoAba === tipo;
              return (
                <button key={tipo} type="button" role="tab" aria-selected={ativa} onClick={() => trocarAba(tipo)} style={estiloDoTipo(cfg)}
                  className={`flex min-h-[64px] items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition-all sm:min-h-[72px] sm:p-3 ${
                    ativa ? "border-[color:var(--tipo)] bg-[color:var(--tipo)] text-[color:var(--tipo-fg)] shadow-md" : "border-line bg-card text-fg-soft hover:border-[color:var(--tipo)]"}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${ativa ? "bg-white/15" : "bg-[color:var(--tipo-soft)] text-[color:var(--tipo)]"}`}>
                    <Icone size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black uppercase tracking-wider sm:text-base">{cfg.rotuloPlural}</span>
                    <span className={`hidden text-xs font-semibold sm:block ${ativa ? "opacity-85" : "text-muted"}`}>{DESCRICAO_ABA[tipo]}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-black ${ativa ? "bg-white/20" : "bg-[color:var(--tipo-soft)] text-[color:var(--tipo)]"}`}>{contagem[tipo]}</span>
                </button>
              );
            })}
         </div>

         <div style={estiloDoTipo(cfgAba)} className="mb-3 rounded-2xl border border-[color:var(--tipo)] bg-[color:var(--tipo-soft)] p-2.5">
           <div className={`flex items-center justify-between gap-3 ${categoriasRecolhidas ? "" : "mb-2"}`}>
             <button type="button" onClick={() => setCategoriasRecolhidas(valor => !valor)} aria-expanded={!categoriasRecolhidas}
               className="flex min-h-10 flex-1 items-center gap-2 rounded-lg px-2 text-left text-sm font-black text-fg">
               <ChevronRight size={18} className={`transition-transform ${categoriasRecolhidas ? "" : "rotate-90"}`} />
               Categorias de {cfgAba.rotuloPlural.toLowerCase()}
               <span className="rounded-full bg-card px-2 py-0.5 text-3xs text-muted">{categoriasDaAba.length}</span>
             </button>
             <button type="button" onClick={() => setModalCategorias(true)} className="flex min-h-9 items-center gap-2 rounded-lg bg-[color:var(--tipo)] px-3 text-xs font-bold text-[color:var(--tipo-fg)] hover:opacity-90">
               <FolderPlus size={15} /> <span className="hidden sm:inline">Gerenciar</span>
             </button>
           </div>
           {!categoriasRecolhidas && (
             <div className="flex flex-wrap items-center justify-center gap-2 py-1">
               {[["", tipoAba === "prato" ? "Todos os pratos" : "Todos os pré-preparos", fichasDaAba.length],
                 ...categoriasDaAba.map(cat => [cat, cat, fichasDaAba.filter(f => (f.categoria || "") === cat).length])].map(([valor, rotulo, n]) => (
                 <button key={valor || "todas"} type="button" onClick={() => setCategoriaFiltro(valor)} aria-pressed={categoriaFiltro === valor}
                   className={`min-h-10 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-4 sm:text-sm ${categoriaFiltro === valor
                     ? "bg-[color:var(--tipo)] text-[color:var(--tipo-fg)] shadow-sm"
                     : "border border-line bg-card text-fg-soft hover:border-[color:var(--tipo)]"}`}>
                   {rotulo} <span className={categoriaFiltro === valor ? "opacity-75" : "text-subtle"}>({n})</span>
                 </button>
               ))}
             </div>
           )}
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
            <div className="rounded-3xl border border-line bg-card p-10 text-center">
               <LayoutList size={40} className="mx-auto mb-4 text-muted"/>
               <h3 className="text-xl font-black text-fg-soft">Nenhum {rotuloAba} encontrado</h3>
               <p className="mt-2 font-medium text-muted">
                 {busca || categoriaFiltro || filtroStatus !== "ativas" || apenasAcimaMeta
                   ? "Nenhuma ficha passa pelos filtros escolhidos."
                   : tipoAba === "prato"
                     ? "Cadastre os pratos para ter a ficha de montagem e o CMV calculado pelos ingredientes."
                     : "Cadastre os pré-preparos para ter a ficha de produção e o custo por kg usado nos pratos."}
               </p>
            </div>
         ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
               {fichasPagina.map(f => {
                  const tipo = tipoFichaDe(f) === "pre_preparo" ? "pre_preparo" : "prato";
                  const cfg = TIPOS_FICHA[tipo];
                  const IconeTipo = ICONE_DO_TIPO[tipo];
                  const selecionada = selecionadas.includes(f.id);
                  const peso = infoPesoFicha(f, fichas);
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
                  const composicaoCount = (f.fichas_ingredientes || []).length;
                  const rendimentoTexto = textoRendimentoPadronizado(f);
                  const acoesMenu = [
                    { rotulo: "Ver ficha", icone: BookOpen, acao: () => abrirFicha(f) },
                    { rotulo: "Página da ficha", icone: FileText, acao: () => router.push(`/dashboard/operacao/fichas/${f.id}`) },
                    ...(tipo === "prato" ? [{ rotulo: "Guia de montagem", icone: LayoutList, acao: () => router.push(`/dashboard/operacao/montagem?dept=${f.departamento || deptUrl}&q=${encodeURIComponent(f.nome_receita)}`) }] : []),
                    { rotulo: "Simular", icone: Calculator, acao: () => abrirSimulacao(f) },
                    { rotulo: "Imprimir", icone: Printer, acao: () => abrirPreviaImpressao("imprimir", [f]) },
                    { rotulo: "PDF", icone: FileDown, acao: () => baixarPdfFichas([f]) },
                  ];

                  return (
                     <div key={f.id} style={estiloDoTipo(cfg)}
                       className={`erp-fichas-card relative flex flex-col justify-between rounded-3xl border border-t-4 border-t-[color:var(--tipo)] bg-card p-5 transition-all ${selecionada ? "border-[color:var(--tipo)] ring-2 ring-[color:var(--tipo-soft)]" : "border-slate-200/90"}`}>
                       <div>
                         <div className="mb-3 flex items-start justify-between gap-3">
                           <div className="flex min-w-0 flex-1 items-center gap-2">
                             <label className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-slate-50">
                               <input type="checkbox" checked={selecionada} onChange={() => toggleSelecionar(f.id)} aria-label={`Selecionar ${f.nome_receita}`}
                                 className="h-4 w-4 cursor-pointer rounded" style={{ accentColor: "var(--tipo)" }}/>
                             </label>
                             <h3 onClick={() => abrirFicha(f)} title={f.nome_receita}
                               className="cursor-pointer break-words text-xl font-black leading-snug text-fg transition-colors hover:text-[color:var(--tipo)]">
                               {f.nome_receita}
                             </h3>
                           </div>
                           <div className="flex shrink-0 items-center gap-1.5">
                             <button onClick={() => abrirEditar(f)} className="h-8 rounded-full bg-[color:var(--tipo)] px-4 text-xs font-bold text-[color:var(--tipo-fg)] shadow-sm">
                               Editar
                             </button>
                             <button onClick={() => setAcoesCardAberto(atual => atual === f.id ? "" : f.id)} title="Mais opções" aria-label="Mais opções"
                               className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-slate-50 text-muted hover:text-fg">
                               <MoreVertical size={16} />
                             </button>
                           </div>
                         </div>

                         {acoesCardAberto === f.id && (
                           <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-slate-50 p-2 text-xs font-bold shadow-lg">
                             {acoesMenu.map(({ rotulo, icone: IconeAcao, acao }) => (
                               <button key={rotulo} onClick={() => { setAcoesCardAberto(""); acao(); }} className="flex items-center gap-2 rounded-xl border border-line bg-card p-2 text-left text-fg-soft hover:text-fg">
                                 <IconeAcao size={14} className="shrink-0" /> {rotulo}
                               </button>
                             ))}
                             <button onClick={() => excluirImediatamente([f])} className="flex items-center gap-2 rounded-xl border border-[color:var(--danger)] bg-[color:var(--danger-soft)] p-2 text-left text-[color:var(--danger-strong)]">
                               <Trash2 size={14} className="shrink-0" /> Excluir
                             </button>
                           </div>
                         )}

                         <div className="mb-3 flex flex-wrap items-center gap-1.5">
                           <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--tipo)] px-3 py-1 text-3xs font-bold uppercase tracking-wider text-[color:var(--tipo-fg)]">
                             <IconeTipo size={12} /> {cfg.rotulo}
                           </span>
                           <span className="rounded-full bg-slate-100/90 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-slate-600">
                             {f.categoria || "SEM CATEGORIA"}
                           </span>
                           {f.codigo && (
                             <span className="rounded-full bg-slate-900 px-3 py-1 font-mono text-3xs font-bold tracking-wider text-white">{f.codigo}</span>
                           )}
                           {f.versao && f.versao !== "1.0" && (
                             <span className="rounded-full bg-slate-100/90 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-slate-600">v{f.versao}</span>
                           )}
                           {statusDaFicha(f) === "inativa" && (
                             <span className="rounded-full bg-slate-200 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-slate-600">INATIVA</span>
                           )}
                           {statusDaFicha(f) === "rascunho" && (
                             <span className="rounded-full bg-amber-100 px-3 py-1 text-3xs font-bold uppercase tracking-wider text-amber-800">RASCUNHO</span>
                           )}
                         </div>

                         <div className="mb-2 border-t border-line-soft pt-2">
                           <span className="block text-3xs font-bold uppercase tracking-widest text-subtle">COMPOSIÇÃO</span>
                           <span className="text-sm font-black text-fg">{composicaoCount} {composicaoCount === 1 ? "item" : "itens"}</span>
                         </div>

                         {tipo === "pre_preparo" ? (() => {
                           // Pré-preparo: rendimento e custo por kg (o que entra nos
                           // pratos). Sem embalagem, sem preço de venda.
                           const custos = custosDoPrePreparo(f, fichas);
                           const usadoEm = fichasQueUsam(f.id, fichas).length;
                           return (
                             <div className="divide-y divide-slate-100 text-xs font-bold">
                               <div className="flex items-center justify-between py-2">
                                 <span className="font-bold text-slate-600">Rendimento</span>
                                 <span className="text-sm font-black text-fg">{rendimentoTexto}</span>
                               </div>
                               <div className="flex items-center justify-between py-2">
                                 <span className="font-bold text-slate-600">Usado em</span>
                                 <span className="text-sm font-black text-fg">{usadoEm ? `${usadoEm} ${usadoEm === 1 ? "receita" : "receitas"}` : "—"}</span>
                               </div>
                               {podeVerCustos && <>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-bold text-slate-600">Custo dos ingredientes</span>
                                   <span className="text-sm font-black text-fg">{fmtBRL(custos.ingredientes)}</span>
                                 </div>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-black text-fg-soft">Custo por {custos.unidade}</span>
                                   <span className="text-sm font-black text-fg">{custos.porUnidade != null ? brlUnitario(custos.porUnidade) : "—"}</span>
                                 </div>
                               </>}
                             </div>
                           );
                         })() : (() => {
                           // Prato: os números de gestão (custo, venda, CMV). Não fazem
                           // parte da ficha de prato; ficam aqui e na aba de custos.
                           const custoTotal = custoTotalDaFicha(f, fichas);
                           const rend = Number(f.rendimento_porcoes) || 1;
                           const porcoes = (unR === "porcao" || unR === "un") ? rend : (peso?.porcoes || 0);
                           const custoPorcao = porcoes > 0 ? custoTotal / porcoes : custoTotal;
                           const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
                           const precoPorcao = (prod && Number(prod.preco_venda) > 0) ? Number(prod.preco_venda) : (Number(f.preco_venda) > 0 ? Number(f.preco_venda) : 0);
                           const meta = Number(f.cmv_meta) || 30;
                           const cmv = precoPorcao > 0 ? (custoPorcao / precoPorcao) * 100 : null;
                           const margem = cmv !== null ? 100 - cmv : null;

                           const custoEmb = (f.embalagens || []).reduce((acc, emb) => acc + (Number(emb.custo) || Number(emb.preco_unitario) || 0) * (Number(emb.qtd) || 1), 0);
                           const custoIngred = Math.max(0, custoPorcao - custoEmb);

                           const taxaMaqPct = Number(f.taxa_maquininha ?? prod?.taxa_cartao ?? 2.5);
                           const impostoPct = Number(f.imposto_pct ?? prod?.aliquota_imposto ?? 4.0);
                           const custoMaquininha = precoPorcao > 0 ? (precoPorcao * (taxaMaqPct / 100)) : 0;
                           const custoImposto = precoPorcao > 0 ? (precoPorcao * (impostoPct / 100)) : 0;
                           const custoTotalComGastos = custoPorcao + custoMaquininha + custoImposto;
                           const lucroReal = precoPorcao > 0 ? precoPorcao - custoTotalComGastos : null;

                           return (
                             <div className="divide-y divide-slate-100 text-xs font-bold">
                               {podeVerCustos && cmv !== null && cmv > meta && (
                                 <div className="pb-2">
                                   <span className="rounded-full bg-[color:var(--warning-soft)] px-3 py-1 text-3xs font-bold uppercase tracking-wider text-[color:var(--warning-strong)]">CMV ACIMA DA META</span>
                                 </div>
                               )}
                               <div className="flex items-center justify-between py-2">
                                 <span className="font-bold text-slate-600">Quantidade</span>
                                 <span className="text-sm font-black text-fg">{rendimentoTexto}</span>
                               </div>

                               {/* Daqui para baixo é tudo dinheiro: só para quem tem view_costs. */}
                               {podeVerCustos && verPizza && (
                                 <div className="py-3">
                                   <PizzaDoPrato compacta
                                     preco={precoPorcao}
                                     custoIngredientes={custoIngred}
                                     custoEmbalagem={custoEmb}
                                     impostoPct={impostoPct}
                                     taxaMaquininhaPct={taxaMaqPct}
                                     params={paramsSis} />
                                 </div>
                               )}
                               {podeVerCustos && !verPizza && <>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-bold text-slate-600">Custo</span>
                                   <span className="text-sm font-black text-fg">{fmtBRL(custoIngred)}</span>
                                 </div>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-bold text-slate-600">Embalagem</span>
                                   <span className="text-sm font-black text-fg">{fmtBRL(custoEmb)}</span>
                                 </div>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-bold text-slate-600">Custo maquininha ({taxaMaqPct}%)</span>
                                   <span className="text-sm font-black text-fg">{precoPorcao > 0 ? fmtBRL(custoMaquininha) : "—"}</span>
                                 </div>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-bold text-slate-600">Imposto ({impostoPct}%)</span>
                                   <span className="text-sm font-black text-fg">{precoPorcao > 0 ? fmtBRL(custoImposto) : "—"}</span>
                                 </div>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-black text-fg-soft">Custo total</span>
                                   <span className="text-sm font-black text-fg">{fmtBRL(custoTotalComGastos)}</span>
                                 </div>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-bold text-slate-600">Venda</span>
                                   <span className="text-sm font-black text-fg">{precoPorcao > 0 ? fmtBRL(precoPorcao) : "—"}</span>
                                 </div>
                                 <div className="flex items-center justify-between py-2">
                                   <span className="font-bold text-slate-600">Lucro por porção</span>
                                   <span className="text-base font-black text-success">{lucroReal !== null ? fmtBRL(lucroReal) : "—"}</span>
                                 </div>
                                 <div className="flex flex-col items-end pb-1 pt-2">
                                   <div className="flex w-full items-center justify-between">
                                     <span className="font-bold text-slate-600">CMV</span>
                                     <span className={`rounded-xl px-3 py-1 text-sm font-black ${
                                       cmv === null ? "bg-elevated text-muted"
                                         : cmv > meta ? "bg-[color:var(--warning-soft)] text-[color:var(--warning-strong)]"
                                         : "bg-[color:var(--tipo-soft)] text-[color:var(--tipo)]"}`}>
                                       {cmv !== null ? `${cmv.toFixed(1)}%` : "—"}
                                     </span>
                                   </div>
                                   {margem !== null && <span className="mt-1 text-2xs font-bold text-subtle">Margem {margem.toFixed(1)}%</span>}
                                 </div>
                               </>}
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

      {/* PRÉVIA DO DOCUMENTO — impressão, PDF e Livro de Receitas */}
      {modalImpressao && configImpressao && (() => {
        const lista = listaOrdenadaPrevia();
        const nPratos = lista.filter(f => tipoFichaDe(f) === "prato").length;
        const nPreparos = lista.length - nPratos;
        const carregandoDados = complementosImpressao === null;
        const livro = configImpressao.livro;
        const opcoes = [
          ["foto", "Foto da ficha"],
          ...(livro ? [["capa", "Capa"], ["indice", "Índice"]] : []),
          ...(podeVerCustos ? [["custos", "Custos na ficha de pré-preparo"]] : []),
        ];
        return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="previa-titulo" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-card shadow-2xl sm:max-h-[94vh]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
              <div>
                <p className="text-3xs font-bold uppercase tracking-[0.18em] text-accent">{livro ? "Livro de Receitas" : "Prévia do documento"}</p>
                <h2 id="previa-titulo" className="text-xl font-black text-fg sm:text-2xl">
                  {lista.length} {lista.length === 1 ? "ficha" : "fichas"}
                  <span className="ml-2 text-sm font-bold text-muted">{nPratos} {nPratos === 1 ? "prato" : "pratos"} · {nPreparos} {nPreparos === 1 ? "pré-preparo" : "pré-preparos"}</span>
                </h2>
              </div>
              <button onClick={() => setModalImpressao(null)} aria-label="Fechar" className="rounded-full bg-elevated p-3 text-muted hover:bg-slate-200"><X size={20}/></button>
            </div>

            <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-5 border-b border-line bg-slate-50 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Documento</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[[false, "Fichas avulsas", "Uma ficha por página"], [true, "Livro de receitas", "Com capa e índice"]].map(([valor, rotulo, ajuda]) => (
                      <button key={rotulo} type="button" aria-pressed={livro === valor}
                        onClick={() => setConfigImpressao(atual => ({ ...atual, livro: valor, capa: valor, indice: valor, ordem: valor ? "tipo" : atual.ordem }))}
                        className={`rounded-xl border-2 p-3 text-left ${livro === valor ? "border-accent bg-accent-soft" : "border-line bg-card"}`}>
                        <span className="block text-sm font-black text-fg">{rotulo}</span>
                        <span className="block text-xs font-semibold text-muted">{ajuda}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">Ordem
                    <select value={configImpressao.ordem} onChange={e => setConfigImpressao(atual => ({ ...atual, ordem: e.target.value }))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 text-sm outline-none">
                      <option value="selecao">Ordem da seleção</option>
                      <option value="nome">Nome A–Z</option>
                      <option value="categoria">Categoria</option>
                      <option value="tipo">Pratos, depois pré-preparos</option>
                      <option value="personalizada">Personalizada</option>
                    </select>
                  </label>
                  <div className="text-xs font-bold text-slate-600">Formato
                    <p className="mt-1 rounded-xl border border-line bg-card p-3 text-sm font-semibold text-fg-soft">A4 retrato</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Conteúdo</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {opcoes.map(([campo, rotulo]) => (
                      <label key={campo} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-fg-soft">
                        <input type="checkbox" checked={!!configImpressao[campo]} onChange={e => setConfigImpressao(atual => ({ ...atual, [campo]: e.target.checked }))} className="h-4 w-4 accent-emerald-700"/>
                        {rotulo}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-medium text-muted">
                    Cada ficha usa o modelo do seu tipo: ficha de prato (ingredientes e montagem) ou ficha de pré-preparo (produção, armazenamento e validade). Seção sem informação não é impressa.
                  </p>
                </div>

                {configImpressao.ordem === "personalizada" && lista.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Ordem com as setas</p>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line bg-card p-2">
                      {lista.map((ficha, indice) => (
                        <div key={ficha.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="w-6 text-xs font-bold text-subtle">{indice + 1}</span>
                          <span className="flex-1 truncate text-xs font-bold text-fg-soft">{ficha.nome_receita}</span>
                          <button onClick={() => moverFichaNaPrevia(ficha.id, -1)} disabled={indice === 0} aria-label="Subir" className="p-1 text-muted disabled:opacity-20"><ArrowUp size={15}/></button>
                          <button onClick={() => moverFichaNaPrevia(ficha.id, 1)} disabled={indice === lista.length - 1} aria-label="Descer" className="p-1 text-muted disabled:opacity-20"><ArrowDown size={15}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-card p-4 sm:p-6">
                <div className="mx-auto max-w-md rounded-lg border border-slate-300 bg-card p-5 shadow-xl">
                  <div className="flex items-start justify-between gap-3 border-b-2 border-line pb-3">
                    <div>
                      <p className="text-3xs font-bold uppercase tracking-[0.2em] text-muted">{livro ? "Livro de receitas" : "Fichas"}</p>
                      <h3 className="mt-1 text-lg font-black text-fg">{unidadeInfo?.nome || "Seldeestrela"}</h3>
                    </div>
                    <BookOpen size={28} className="text-muted"/>
                  </div>
                  <p className="mt-4 text-3xs font-bold uppercase tracking-wider text-subtle">Ordem do documento</p>
                  <ol className="mt-2 space-y-1.5">
                    {lista.slice(0, 8).map((ficha, indice) => {
                      const tipo = tipoFichaDe(ficha) === "pre_preparo" ? "pre_preparo" : "prato";
                      return (
                        <li key={ficha.id} style={estiloDoTipo(tipo)} className="flex items-center gap-2 rounded-lg border border-line-soft px-2.5 py-1.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--tipo)] text-3xs font-bold text-[color:var(--tipo-fg)]">{indice + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-bold text-fg-soft">{ficha.nome_receita}</span>
                          <span className="shrink-0 text-3xs font-bold uppercase tracking-wider text-[color:var(--tipo)]">{TIPOS_FICHA[tipo].rotulo}</span>
                        </li>
                      );
                    })}
                    {lista.length > 8 && <li className="text-center text-xs font-bold text-subtle">+ {lista.length - 8} fichas no documento</li>}
                  </ol>
                  <p className="mt-4 text-3xs font-bold text-subtle">
                    A partir de {estimarPaginasDocumento(lista.length, { capa: livro && configImpressao.capa, indice: livro && configImpressao.indice })} páginas A4 — ficha longa continua na folha seguinte.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-card p-4 sm:px-6">
              <button onClick={() => setModalImpressao(null)} className="mr-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-elevated"><ArrowLeft size={17}/> Voltar</button>
              {carregandoDados ? <span className="flex items-center gap-2 text-xs font-bold text-muted"><Loader2 size={14} className="animate-spin"/> Carregando dados das fichas...</span> : null}
              <button onClick={() => gerarDocumentoConfigurado("pdf")} disabled={carregandoDados} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-accent-soft px-4 py-2.5 text-sm font-black text-accent-strong disabled:opacity-50"><Download size={17}/> Gerar PDF</button>
              <button onClick={() => gerarDocumentoConfigurado("imprimir")} disabled={carregandoDados} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-accent-fg hover:opacity-90 disabled:opacity-50"><Printer size={17}/> Imprimir</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* GERENCIAR CATEGORIAS — do tipo da aba, no setor da tela */}
      {modalCategorias && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setModalCategorias(false)} style={estiloDoTipo(cfgAba)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="categorias-titulo">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--tipo)]">{cfgAba.rotuloPlural} · {deptUrl === "bar" ? "Bar" : "Cozinha"}</p>
                <h3 id="categorias-titulo" className="mt-1 text-2xl font-black text-fg">Categorias de {cfgAba.rotuloPlural.toLowerCase()}</h3>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">As categorias ficam disponíveis para toda a equipe desta unidade.</p>
              </div>
              <button type="button" onClick={() => setModalCategorias(false)} aria-label="Fechar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated text-muted hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input type="text" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} aria-label="Nova categoria"
                onKeyDown={e => { if (e.key === "Enter") criarCategoria(); }}
                placeholder={tipoAba === "pre_preparo" ? "Ex.: Molhos da casa" : deptUrl === "bar" ? "Ex.: Coquetéis autorais" : "Ex.: Pratos executivos"}
                className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 text-base font-bold text-slate-800 outline-none focus:border-[color:var(--tipo)]" />
              <button type="button" disabled={salvandoCategoria || !novaCategoria.trim()} onClick={criarCategoria}
                className="min-h-12 rounded-xl bg-[color:var(--tipo)] px-5 text-sm font-black text-[color:var(--tipo-fg)] disabled:opacity-50">
                {salvandoCategoria ? "Salvando..." : "Criar categoria"}
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {categoriasDaAba.map(cat => {
                const quantidade = fichasDaAba.filter(f => f.categoria === cat).length;
                return (
                  <div key={cat} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-800">{cat}</p>
                      <p className="text-xs font-semibold text-muted">{quantidade} {quantidade === 1 ? "ficha nesta categoria" : "fichas nesta categoria"}</p>
                    </div>
                    <button type="button" onClick={() => excluirCategoria(cat)} title={`Excluir categoria ${cat}`} aria-label={`Excluir categoria ${cat}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted hover:text-[color:var(--danger-strong)]"><Trash2 size={17} /></button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <h4 className="text-base font-black text-fg">Organizar {cfgAba.rotuloPlural.toLowerCase()}</h4>
              <p className="mt-1 text-xs font-semibold text-muted">Escolha diretamente em qual categoria cada ficha deve aparecer.</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {[...fichasDaAba].sort(ordenarFichas).map(ficha => (
                  <div key={ficha.id} className="grid gap-2 rounded-xl border border-line bg-card p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                    <p className="truncate text-sm font-black text-slate-800" title={ficha.nome_receita}>{ficha.nome_receita}</p>
                    <select value={ficha.categoria || ""} disabled={alterandoCategoriaId === ficha.id} onChange={e => organizarFichaNaCategoria(ficha, e.target.value)}
                      aria-label={`Categoria de ${ficha.nome_receita}`}
                      className="min-h-10 w-full rounded-lg border border-slate-300 bg-card px-3 text-sm font-bold text-fg-soft outline-none focus:border-[color:var(--tipo)] disabled:opacity-60">
                      <option value="">Sem categoria</option>
                      {ficha.categoria && !categoriasDaAba.includes(ficha.categoria) ? <option value={ficha.categoria}>{ficha.categoria}</option> : null}
                      {categoriasDaAba.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
                    </select>
                  </div>
                ))}
                {fichasDaAba.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm font-semibold text-muted">Nenhuma ficha cadastrada neste grupo.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISUALIZAÇÃO — a mesma ficha do PDF, e os custos numa aba à parte */}
      {fichaView && (() => {
        const f = fichaView;
        const tipo = tipoFichaDe(f) === "pre_preparo" ? "pre_preparo" : "prato";
        const cfg = TIPOS_FICHA[tipo];
        const IconeTipo = ICONE_DO_TIPO[tipo];
        const dados = dadosDaFicha(f, { todasFichas: fichas, complementos: complementosView, mostrarCustos: podeVerCustos });
        const { custoPorcao } = custoAtualDaFicha(f);
        const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
        const preco = Number(prod?.preco_venda) || 0;
        const abas = [["ficha", `Ficha de ${tipo === "prato" ? "prato" : "pré-preparo"}`], ...(podeVerCustos ? [["custos", "Custos (uso interno)"]] : [])];
        const fechar = () => setFichaViewId(null);
        return (
          <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" style={estiloDoTipo(cfg)}>
            <div role="dialog" aria-modal="true" aria-labelledby="ver-ficha-titulo" className="flex min-h-full w-full max-w-5xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:min-h-0 sm:max-h-[92vh] sm:rounded-[28px]">
              <div className="flex flex-wrap items-center gap-3 border-b-4 border-[color:var(--tipo)] bg-card px-4 py-4 sm:px-6">
                <button onClick={fechar} aria-label="Voltar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]"><IconeTipo size={20} /></span>
                <div className="min-w-0 flex-1">
                  <h2 id="ver-ficha-titulo" className="break-words text-lg font-black text-fg sm:text-xl">{f.nome_receita}</h2>
                  <p className="mt-0.5 text-2xs font-bold text-muted">{cfg.rotulo} · {f.categoria || "Sem categoria"} · {f.departamento === "bar" ? "Bar" : "Cozinha"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => abrirPreviaImpressao("imprimir", [f])} title="Imprimir" aria-label="Imprimir" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-slate-600 hover:border-[color:var(--tipo)]"><Printer size={17} /></button>
                  <button onClick={() => baixarPdfFichas([f])} title="Baixar PDF" aria-label="Baixar PDF" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-slate-600 hover:border-[color:var(--tipo)]"><Download size={17} /></button>
                  <button onClick={() => abrirSimulacao(f)} title="Simular rendimento" aria-label="Simular rendimento" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-slate-600 hover:border-[color:var(--tipo)]"><Calculator size={17} /></button>
                  <button onClick={() => abrirEditar(f)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--tipo)] px-4 text-sm font-black text-[color:var(--tipo-fg)] shadow-sm"><Edit3 size={16} /> Editar</button>
                </div>
              </div>

              {abas.length > 1 ? (
                <div className="flex gap-1 overflow-x-auto border-b border-line-soft bg-card px-4 sm:px-6" role="tablist">
                  {abas.map(([id, rotulo]) => (
                    <button key={id} role="tab" aria-selected={viewTab === id} onClick={() => setViewTab(id)}
                      className={`shrink-0 border-b-2 px-3 py-3 text-sm font-black transition-colors ${viewTab === id ? "border-[color:var(--tipo)] text-[color:var(--tipo)]" : "border-transparent text-subtle hover:text-slate-600"}`}>
                      {rotulo}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                {viewTab === "custos" && podeVerCustos ? (
                  <PainelCustosInternos ficha={f} fichas={fichas} custoPorcao={custoPorcao} preco={preco}
                    historico={histCustos} statusHistorico={histStatus} registrando={registrandoCusto}
                    onRegistrar={() => registrarCustoAtual(f, "manual")} onAbrirFicha={abrirFicha} />
                ) : (
                  <>
                    {complementosView === null && tipo === "pre_preparo" ? (
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold text-muted"><Loader2 size={13} className="animate-spin" /> Carregando armazenamento, equipamentos e alergênicos...</p>
                    ) : null}
                    <FichaDocumento dados={dados} />
                    <button onClick={() => router.push(`/dashboard/operacao/fichas/${f.id}`)} className="mt-3 flex items-center gap-2 text-sm font-bold text-[color:var(--tipo)] hover:underline">
                      <FileText size={15} /> Abrir a página da ficha (versões, histórico e modo cozinha)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* NOVO PRATO: completo agora ou só os títulos para completar depois */}
      {modalEscolhaNovo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setModalEscolhaNovo(false)} style={estiloDoTipo("prato")}>
          <div className="w-full max-w-lg rounded-t-3xl bg-card p-4 shadow-2xl sm:rounded-3xl sm:p-6" onClick={evento => evento.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="novo-prato-titulo">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-3xs font-bold uppercase tracking-[.16em] text-[color:var(--tipo)]">Novo prato</p>
                <h2 id="novo-prato-titulo" className="mt-1 text-xl font-black text-fg">Como deseja começar?</h2>
                <p className="mt-1 text-sm font-semibold text-muted">Você pode completar a ficha agora ou cadastrar vários títulos para preencher depois.</p>
              </div>
              <button onClick={() => setModalEscolhaNovo(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated text-muted"><X size={17}/></button>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button onClick={() => { setModalEscolhaNovo(false); abrirNova("prato"); }} className="flex min-h-[74px] items-center gap-3 rounded-2xl border-2 border-[color:var(--tipo)] bg-[color:var(--tipo-soft)] p-3 text-left text-fg">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]"><Edit3 size={19}/></span>
                <span><strong className="block text-sm font-black">Criar um prato</strong><small className="mt-0.5 block font-semibold text-muted">Ingredientes e montagem agora</small></span>
              </button>
              <button onClick={() => { setModalEscolhaNovo(false); setTitulosLote(""); setModalTitulosLote(true); }} className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-line bg-slate-50 p-3 text-left text-fg hover:border-[color:var(--tipo)]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-white"><LayoutList size={19}/></span>
                <span><strong className="block text-sm font-black">Adicionar vários títulos</strong><small className="mt-0.5 block font-semibold text-muted">Completar cada ficha depois</small></span>
              </button>
            </div>
          </div>
        </div>
      )}

      {modalTitulosLote && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !salvandoTitulosLote && setModalTitulosLote(false)} style={estiloDoTipo("prato")}>
          <div className="flex max-h-[100dvh] w-full max-w-xl flex-col rounded-t-3xl bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl" onClick={evento => evento.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulos-titulo">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-soft p-4 sm:p-5">
              <div>
                <p className="text-3xs font-bold uppercase tracking-[.16em] text-[color:var(--tipo)]">Cadastro rápido</p>
                <h2 id="titulos-titulo" className="mt-1 text-xl font-black text-fg">Adicionar títulos de pratos</h2>
                <p className="mt-1 text-sm font-semibold text-muted">Digite um prato por linha. Eles serão salvos para você completar depois.</p>
              </div>
              <button disabled={salvandoTitulosLote} onClick={() => setModalTitulosLote(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated text-muted disabled:opacity-40"><X size={17}/></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <label htmlFor="titulos-lote" className="text-xs font-bold uppercase tracking-wider text-muted">Títulos</label>
              <textarea id="titulos-lote" autoFocus value={titulosLote} onChange={evento => setTitulosLote(evento.target.value)} placeholder={deptUrl === "bar" ? "Ex.:\nCaipirinha de limão\nGin tônica\nMoscow mule" : "Ex.:\nAçaí de 300 ml\nAçaí de 500 ml\nBatata frita com cheddar"} className="mt-2 min-h-[220px] w-full resize-y rounded-2xl border-2 border-line bg-slate-50 p-4 text-base font-semibold leading-8 text-slate-800 outline-none focus:border-[color:var(--tipo)]"/>
              <p className="mt-2 text-xs font-semibold text-subtle">Títulos repetidos ou que já existem serão ignorados.</p>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line-soft bg-slate-50 p-3 sm:p-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
              <button disabled={salvandoTitulosLote} onClick={() => setModalTitulosLote(false)} className="min-h-10 rounded-xl px-4 text-sm font-black text-muted hover:bg-slate-200 disabled:opacity-40">Cancelar</button>
              <button disabled={salvandoTitulosLote || !titulosLote.trim()} onClick={salvarTitulosEmLote} className="flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--tipo)] px-5 text-sm font-black text-[color:var(--tipo-fg)] shadow-lg disabled:opacity-50">
                {salvandoTitulosLote ? <Loader2 size={17} className="animate-spin"/> : <Plus size={17}/>} {salvandoTitulosLote ? "Criando..." : "Criar títulos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDITOR — criar e editar, prato ou pré-preparo */}
      {editor ? (
        <EditorFicha key={editor.chave} tipo={editor.tipo} departamento={deptUrl} ficha={editor.ficha} rascunho={editor.rascunho}
          fichas={fichas} insumos={insumosAtivos} embalagens={embalagensCat}
          categoriasDe={categoriasDe} onGerenciarCategorias={gerenciarCategoriasDoEditor}
          unidadeId={unidadeAtiva} sessao={sessao} podeVerCustos={podeVerCustos}
          onFechar={() => setEditor(null)} onSalvo={aoSalvarFicha} />
      ) : null}

      {/* CRIAR COM IA — do tipo da aba */}
      {modalIA ? (
        <ModalIAFicha tipo={tipoAba} departamento={deptUrl} insumos={insumosAtivos} fichas={fichas} unidadeId={unidadeAtiva}
          onInsumoCriado={novo => setInsumosAtivos(lista => [...lista, novo])}
          onUsar={rascunho => { setModalIA(false); abrirNova(tipoAba, rascunho); }}
          onFechar={() => setModalIA(false)} />
      ) : null}


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
