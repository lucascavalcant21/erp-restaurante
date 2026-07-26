"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRightLeft, Boxes, CalendarDays, Check,
  ChevronRight, ClipboardCheck, Clock3, Edit3, Filter, History, Loader2,
  MapPin, MoreVertical, Package, PackageMinus, PackagePlus, Plus, Search,
  Settings2, Upload, User, Warehouse, X,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, salvarInsumo } from "../../../lib/operacao";
import { fetchColaboradores } from "../../../lib/rh";
import {
  atualizarItemEstoque, fetchEstoques, fetchItensEstoque, fetchMovimentosMulti,
  registrarContagemMulti, registrarMovimentoMulti, salvarEstoque,
  transferirEntreEstoques, vincularItemEstoque,
} from "../../../lib/estoques-multiplos";
import {
  filtrarItensEstoque, statusItemEstoque, TIPOS_ESTOQUE, tiposCompativeis,
} from "../../../lib/estoques-multiplos-utils.mjs";
import { fmtBRL } from "../../../components/ui";
import SimuladorRendimento from "../../../components/SimuladorRendimento";
import { entradaBebidaUnidades, baixaBebidaUnidades, baixaBebidaConteudo, contagemBebida, dividirSaldo } from "../../../lib/estoque-bebidas";

// Item fracionável = tem conteúdo por embalagem (>1) e permite controle
// fracionado (garrafa/lata/pacote). Nele a entrada é por unidade comercial e a
// baixa pode ser por unidade fechada ou por conteúdo (ml/g).
const ehFracionavel = (item) => item && Number(item.tamanho_embalagem) > 1 && item.permite_fracionado !== false && String(item.unidade_medida || "").toLowerCase() !== "un";
const conteudoDe = (item) => Number(item?.tamanho_embalagem) || 1;
const fmtQtd = (valor) => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
// Litro em maiúsculo (L), como manda a convenção; demais unidades como estão.
const mostrarUn = (u) => (String(u || "").toLowerCase() === "l" ? "L" : (u || "un"));

const fmtEquiv = (q, un) => {
  const n = Number(q) || 0; const u = String(un || "un").toLowerCase();
  if (u === "ml") return n >= 1000 ? `${(+(n / 1000).toFixed(3)).toLocaleString("pt-BR")} L` : `${(+n.toFixed(3)).toLocaleString("pt-BR")} ml`;
  if (u === "g") return n >= 1000 ? `${(+(n / 1000).toFixed(3)).toLocaleString("pt-BR")} kg` : `${(+n.toFixed(3)).toLocaleString("pt-BR")} g`;
  return `${(+n.toFixed(3)).toLocaleString("pt-BR")} ${mostrarUn(u)}`;
};

function calcularValorItem(item) {
  const qtd = Number(item.quantidade_atual) || 0;
  if (qtd <= 0) return 0;

  const custoUnit = Number(item.custo_unitario) || 0;
  const custoCompra = Number(item.custo_compra) || 0;

  if (ehFracionavel(item)) {
    const tamEmb = Number(item.tamanho_embalagem) || 1;
    const unComerciais = qtd / tamEmb;
    let custoEmbalagem = custoCompra;
    if (!custoEmbalagem || custoEmbalagem <= 0) {
      custoEmbalagem = custoUnit > 0 ? (custoUnit < 1 ? custoUnit * tamEmb : custoUnit) : 0;
    }
    return unComerciais * custoEmbalagem;
  }

  const custo = custoUnit > 0 ? custoUnit : custoCompra;
  return qtd * custo;
}
const fmtData = (valor, hora = false) => {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", hora
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" });
};
const nomeUsuario = sessao => sessao?.nome || sessao?.user_metadata?.nome || sessao?.email || "Usuário do sistema";
const idUsuario = sessao => sessao?.id || sessao?.user?.id || null;

function Modal({ titulo, descricao, onClose, children, largo = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${largo ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">{titulo}</h2>
            {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label>;
}

function BotaoSalvar({ carregando, children = "Salvar" }) {
  return (
    <button disabled={carregando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50">
      {carregando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}{children}
    </button>
  );
}

function EstoqueRunner() {
  const searchParams = useSearchParams();
  const { unidadeAtiva, unidadeInfo, abrirMenu, sessao } = useERP();
  const [estoques, setEstoques] = useState([]);
  const [estoqueId, setEstoqueId] = useState("");
  const [itens, setItens] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [aba, setAba] = useState("atual");
  const [filtros, setFiltros] = useState({ busca: "", categoria: "Todas", status: "todos", local: "Todos" });
  const [modal, setModal] = useState(null);
  const [operacao, setOperacao] = useState({ insumo_id: "", quantidade: "", destino_id: "", observacao: "", responsavel_id: "", data: "", modo: "unidade", fechadas: "", aberto: "" });
  const [formItem, setFormItem] = useState({});
  const [formEstoque, setFormEstoque] = useState({});
  const [textoImportacao, setTextoImportacao] = useState("");

  const moduloPref = (searchParams.get("dept") || searchParams.get("modulo") || "").toLowerCase();

  const estoquesVisiveis = useMemo(() => {
    if (!estoques?.length) return [];

    if (moduloPref.includes("cozinha")) {
      const filtrados = estoques.filter(e => {
        const s = (e.slug || e.nome || "").toLowerCase();
        const t = (e.tipo || "").toLowerCase();
        return s.includes("cozinha") || t === "alimentos" || s.includes("embalag") || t === "embalagens";
      });
      return filtrados.length ? filtrados : estoques;
    }

    if (moduloPref.includes("bar") || moduloPref.includes("bebida")) {
      const filtrados = estoques.filter(e => {
        const s = (e.slug || e.nome || "").toLowerCase();
        const t = (e.tipo || "").toLowerCase();
        return s.includes("bar") || t === "bebidas";
      });
      return filtrados.length ? filtrados : estoques;
    }

    if (moduloPref.includes("salão") || moduloPref.includes("salao") || moduloPref.includes("limpeza")) {
      const filtrados = estoques.filter(e => {
        const s = (e.slug || e.nome || "").toLowerCase();
        const t = (e.tipo || "").toLowerCase();
        return s.includes("limpeza") || t === "limpeza" || s.includes("salão") || s.includes("salao");
      });
      return filtrados.length ? filtrados : estoques;
    }

    return estoques;
  }, [estoques, moduloPref]);

  const estoqueAtual = useMemo(() => estoques.find(item => item.id === estoqueId) || estoquesVisiveis[0], [estoques, estoqueId, estoquesVisiveis]);

  const carregarEstoques = useCallback(async (manterId = "") => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const [resEstoques, resCatalogo, resColabs] = await Promise.all([
      fetchEstoques(unidadeAtiva, true),
      fetchInsumos(unidadeAtiva, null, { escopoEstrito: true }),
      fetchColaboradores(unidadeAtiva),
    ]);
    if (resEstoques.error) setErro(resEstoques.error);
    const todosEstoques = resEstoques.data || [];
    setEstoques(todosEstoques);
    setCatalogo(resCatalogo.data || []);
    setColaboradores(resColabs.data || []);

    const preferencia = (searchParams.get("dept") || searchParams.get("modulo") || "").toLowerCase();
    
    let disponiveis = todosEstoques;
    if (preferencia.includes("cozinha")) {
      disponiveis = todosEstoques.filter(e => {
        const s = (e.slug || e.nome || "").toLowerCase();
        const t = (e.tipo || "").toLowerCase();
        return s.includes("cozinha") || t === "alimentos" || s.includes("embalag") || t === "embalagens";
      });
    } else if (preferencia.includes("bar")) {
      disponiveis = todosEstoques.filter(e => {
        const s = (e.slug || e.nome || "").toLowerCase();
        const t = (e.tipo || "").toLowerCase();
        return s.includes("bar") || t === "bebidas";
      });
    } else if (preferencia.includes("salão") || preferencia.includes("salao") || preferencia.includes("limpeza")) {
      disponiveis = todosEstoques.filter(e => {
        const s = (e.slug || e.nome || "").toLowerCase();
        const t = (e.tipo || "").toLowerCase();
        return s.includes("limpeza") || t === "limpeza";
      });
    }

    if (!disponiveis.length) disponiveis = todosEstoques;

    const escolhido = disponiveis.find(item => item.id === manterId)
      || disponiveis.find(item => item.status === "ativo")
      || disponiveis[0];

    setEstoqueId(escolhido?.id || "");
  }, [unidadeAtiva, searchParams]);

  const carregarArea = useCallback(async () => {
    if (!estoqueId || !unidadeAtiva) return;
    setLoading(true);
    const [resItens, resMovimentos] = await Promise.all([
      fetchItensEstoque(estoqueId, unidadeAtiva),
      fetchMovimentosMulti(unidadeAtiva, estoqueId),
    ]);
    setItens(resItens.data || []);
    setMovimentos(resMovimentos.data || []);
    if (resItens.error || resMovimentos.error) setErro(resItens.error || resMovimentos.error);
    setLoading(false);
  }, [estoqueId, unidadeAtiva]);

  useEffect(() => { carregarEstoques(); }, [carregarEstoques]);
  useEffect(() => { carregarArea(); }, [carregarArea]);

  const avisar = (mensagem, tipo = "sucesso") => {
    if (tipo === "erro") setErro(mensagem);
    else setSucesso(mensagem);
    window.setTimeout(() => tipo === "erro" ? setErro("") : setSucesso(""), 4500);
  };

  const atualizarTudo = async () => {
    await Promise.all([carregarArea(), carregarEstoques(estoqueId)]);
  };

  const colaboradoresFiltrados = useMemo(() => {
    if (!colaboradores?.length) return [];
    const ativos = colaboradores.filter(c => c.status !== "inativo");
    const nomeArea = (estoqueAtual?.nome || estoqueAtual?.slug || "").toLowerCase();

    let areaChave = "";
    if (nomeArea.includes("bar")) areaChave = "bar";
    else if (nomeArea.includes("cozinha")) areaChave = "cozinha";
    else if (nomeArea.includes("salão") || nomeArea.includes("salao")) areaChave = "salão";

    if (!areaChave) return ativos;

    const especificos = ativos.filter(c => {
      const cargoStr = (c.cargo || "").toLowerCase();
      const setorStr = (c.setor || "").toLowerCase();
      if (areaChave === "bar") {
        return /(\bbar\b|barman|bartender|barista|copeir)/.test(cargoStr) || setorStr.includes("bar");
      }
      if (areaChave === "cozinha") {
        return /(cozinh|chapeir|confeit|pizzai|sushi|salgad|padeir|churrasqueir|a[cç]ougue|auxiliar|chefe)/.test(cargoStr) || setorStr.includes("cozinha");
      }
      if (areaChave === "salão") {
        return /(gar[çc]|atendente|sal[aã]o|hostess|maitre|maître|comand|gerente|supervisor)/.test(cargoStr) || setorStr.includes("salão") || setorStr.includes("salao");
      }
      return false;
    });

    return especificos.length ? especificos : ativos;
  }, [colaboradores, estoqueAtual]);

  const catalogoFiltradoPorArea = useMemo(() => {
    if (!catalogo?.length) return [];
    if (!estoqueAtual) return catalogo;

    const slug = (estoqueAtual.slug || estoqueAtual.nome || "").toLowerCase();
    const tipo = (estoqueAtual.tipo || "").toLowerCase();

    const filtrados = catalogo.filter(insumo => {
      const dept = (insumo.departamento || "").toLowerCase();
      const cat = (insumo.categoria || "").toLowerCase();
      const nome = (insumo.nome || "").toLowerCase();

      // 1. Limpeza
      if (slug.includes("limpeza") || tipo === "limpeza") {
        return (
          dept.includes("limpeza") ||
          cat.includes("limpeza") ||
          cat.includes("higiene") ||
          /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo)/.test(nome) ||
          /(limpeza|higiene)/.test(cat)
        );
      }

      // 2. Embalagens
      if (slug.includes("embalag") || tipo === "embalagens") {
        return (
          dept.includes("embalag") ||
          dept.includes("descartav") ||
          cat.includes("embalag") ||
          cat.includes("descartav") ||
          /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio)/.test(nome) ||
          /(embalag|descartav)/.test(cat)
        );
      }

      // 3. Bar
      if (slug.includes("bar") || tipo === "bebidas") {
        return (
          dept.includes("bar") ||
          dept.includes("bebida") ||
          dept.includes("drink") ||
          cat.includes("bebida") ||
          cat.includes("drink") ||
          cat.includes("cerveja") ||
          cat.includes("destilado") ||
          cat.includes("vinho") ||
          cat.includes("refrigerante") ||
          cat.includes("suco") ||
          cat.includes("xarope") ||
          cat.includes("gin") ||
          cat.includes("vodka") ||
          cat.includes("whisky") ||
          cat.includes("cachaça") ||
          cat.includes("rum") ||
          cat.includes("chopp") ||
          /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|vermute|bitter|espumante)/.test(nome) ||
          /(bar|bebida|drink|adega)/.test(dept)
        );
      }

      // 4. Cozinha (Alimentos / Insumos da Cozinha)
      if (slug.includes("cozinha") || tipo === "alimentos") {
        const ehLimpezaOuEmbalagem = dept.includes("limpeza") || dept.includes("embalag") || cat.includes("limpeza") || cat.includes("embalag");
        if (ehLimpezaOuEmbalagem) return false;
        return (
          dept.includes("cozinha") ||
          dept.includes("alimento") ||
          dept.includes("insumo") ||
          dept.includes("hortifruti") ||
          dept.includes("carne") ||
          dept.includes("frio") ||
          dept.includes("mercearia") ||
          cat.includes("laticinio") ||
          cat.includes("hortifruti") ||
          cat.includes("carne") ||
          cat.includes("graos") ||
          cat.includes("tempero") ||
          cat.includes("molho") ||
          cat.includes("farinha") ||
          cat.includes("massa") ||
          cat.includes("confeitaria") ||
          cat.includes("panificacao") ||
          cat.includes("queijo") ||
          cat.includes("proteina") ||
          cat.includes("vegetal") ||
          !dept || dept === "geral"
        );
      }

      return true;
    });

    return filtrados;
  }, [catalogo, estoqueAtual]);

  const itensDaArea = useMemo(() => {
    if (!itens?.length) return [];
    if (!estoqueAtual) return itens;

    const slug = (estoqueAtual.slug || estoqueAtual.nome || "").toLowerCase();
    const tipo = (estoqueAtual.tipo || "").toLowerCase();

    return itens.filter(item => {
      if (item.estoque_id && String(item.estoque_id) === String(estoqueAtual.id)) return true;

      const dept = (item.departamento || "").toLowerCase();
      const cat = (item.categoria || "").toLowerCase();
      const nome = (item.nome || "").toLowerCase();

      // 1. Limpeza
      if (slug.includes("limpeza") || tipo === "limpeza") {
        return (
          dept.includes("limpeza") ||
          cat.includes("limpeza") ||
          cat.includes("higiene") ||
          /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo|palha|alvejante|multiuso|pano)/.test(nome) ||
          /(limpeza|higiene)/.test(cat)
        );
      }

      // 2. Embalagens
      if (slug.includes("embalag") || tipo === "embalagens") {
        return (
          dept.includes("embalag") ||
          dept.includes("descartav") ||
          cat.includes("embalag") ||
          cat.includes("descartav") ||
          /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio|bobina)/.test(nome) ||
          /(embalag|descartav)/.test(cat)
        );
      }

      // 3. Bar
      if (slug.includes("bar") || tipo === "bebidas") {
        return (
          dept.includes("bar") ||
          dept.includes("bebida") ||
          dept.includes("drink") ||
          cat.includes("bebida") ||
          cat.includes("drink") ||
          cat.includes("cerveja") ||
          cat.includes("destilado") ||
          cat.includes("vinho") ||
          cat.includes("refrigerante") ||
          cat.includes("suco") ||
          cat.includes("xarope") ||
          cat.includes("gin") ||
          cat.includes("vodka") ||
          cat.includes("whisky") ||
          cat.includes("cachaça") ||
          cat.includes("rum") ||
          cat.includes("chopp") ||
          /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|vermute|bitter|espumante|poupa|hortela|morango|red bull|skol|brahma|heineken|amstel|stella|corona|budweiser|eisenbahn|sol|spaten|antarctica|coca|fanta|sprite|schweppes)/.test(nome) ||
          /(bar|bebida|drink|adega)/.test(dept)
        );
      }

      // 4. Cozinha (padrão para insumos alimentícios e gerais)
      if (slug.includes("cozinha") || tipo === "alimentos") {
        const ehLimpezaOuEmbalagem = dept.includes("limpeza") || dept.includes("embalag") || cat.includes("limpeza") || cat.includes("embalag");
        if (ehLimpezaOuEmbalagem) return false;
        if (dept.includes("bar") || dept.includes("bebida") || dept.includes("drink")) return false;
        return true;
      }

      return true;
    });
  }, [itens, estoqueAtual]);

  const categorias = useMemo(() => ["Todas", ...new Set(itensDaArea.map(i => i.categoria || "Sem categoria"))], [itensDaArea]);
  const locais = useMemo(() => ["Todos", ...new Set(itensDaArea.map(i => i.local_interno).filter(Boolean))], [itensDaArea]);
  const itensFiltrados = useMemo(
    () => {
      const res = filtrarItensEstoque(itensDaArea, filtros, estoqueAtual);
      return res.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));
    },
    [itensDaArea, filtros, estoqueAtual],
  );
  const alertas = useMemo(
    () => itensDaArea.filter(item => {
      const status = statusItemEstoque(item, estoqueAtual);
      return status.abaixoMinimo || status.validadeProxima || status.vencido;
    }),
    [itensDaArea, estoqueAtual],
  );

  const valorTotal = itensDaArea.reduce((soma, item) => soma + calcularValorItem(item), 0);
  const ultimaEntrada = movimentos.find(m => ["entrada", "transferencia_entrada"].includes(m.tipo));

  const abrirOperacao = (tipo, item = null) => {
    const frac = ehFracionavel(item);
    const div = frac ? dividirSaldo(item.quantidade_atual, conteudoDe(item), true) : null;
    setOperacao({
      insumo_id: item?.insumo_id || "",
      quantidade: tipo === "contagem" && !frac ? String(item?.quantidade_atual ?? "") : "",
      destino_id: "",
      observacao: "",
      responsavel_id: "",
      data: "",
      // Bebidas: entrada por unidade fechada; baixa por conteúdo (mais comum).
      modo: tipo === "saida" ? "conteudo" : "unidade",
      fechadas: div ? String(div.fechadas) : "",
      aberto: div ? String(div.aberto) : "",
    });
    setModal({ tipo, item });
  };

  const destinosCompativeis = estoques.filter(item =>
    item.id !== estoqueId && item.status === "ativo" && tiposCompativeis(estoqueAtual?.tipo, item.tipo));

  const executarOperacao = async event => {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const unidadeId = unidadeAtiva;
      let item = modal?.item || itens.find(i => i.insumo_id === operacao.insumo_id);
      const insumo = catalogo.find(i => i.id === operacao.insumo_id);
      
      const colabSel = colaboradores.find(c => String(c.id) === String(operacao.responsavel_id));
      const responsavelNome = colabSel
        ? `${colabSel.nome}${colabSel.cargo ? ` (${colabSel.cargo})` : ""}`
        : (nomeUsuario(sessao) || "Usuário do sistema");
      const usuarioIdFinal = colabSel ? colabSel.id : idUsuario(sessao);

      if (!item && insumo && modal?.tipo === "entrada") {
        const vinculo = await vincularItemEstoque({
          unidadeId, estoqueId, insumoId: insumo.id,
          custoUnitario: insumo.custo_compra ?? insumo.custo_unitario,
        });
        // Se o vínculo falhar (ex.: tabela estoque_itens ainda não migrada),
        // seguimos com um item sintético — o movimento cai no fallback legado.
        item = { ...insumo, insumo_id: insumo.id, estoque_item_id: vinculo.data?.id, permite_transferencia: true };
      }
      if (!item?.insumo_id) {
        avisar("Selecione um produto válido.", "erro");
        return;
      }
      let resposta;
      const frac = ehFracionavel(item);
      const conteudoFrac = conteudoDe(item);
      const bebArgs = {
        unidadeId, estoqueId, insumoId: item?.insumo_id,
        usuarioId: usuarioIdFinal, usuarioNome: responsavelNome,
        observacao: operacao.observacao,
      };
      const stdMov = (tipo, qtd) => registrarMovimentoMulti({
        unidadeId, estoqueId, insumoId: item?.insumo_id, tipo,
        quantidade: qtd, usuarioId: usuarioIdFinal, usuarioNome: responsavelNome,
        observacao: operacao.observacao, dataMovimento: operacao.data || null,
      });

      if (frac && modal?.tipo === "entrada") {
        resposta = await entradaBebidaUnidades({ ...bebArgs, unidades: operacao.quantidade });
        if (resposta?.error) resposta = await stdMov("entrada", (Number(operacao.quantidade) || 0) * conteudoFrac);
      } else if (frac && modal?.tipo === "saida") {
        resposta = operacao.modo === "unidade"
          ? await baixaBebidaUnidades({ ...bebArgs, unidades: operacao.quantidade })
          : await baixaBebidaConteudo({ ...bebArgs, quantidade: operacao.quantidade });
        if (resposta?.error) resposta = await stdMov("saida", operacao.modo === "unidade" ? (Number(operacao.quantidade) || 0) * conteudoFrac : (Number(operacao.quantidade) || 0));
      } else if (frac && modal?.tipo === "contagem") {
        resposta = await contagemBebida({ ...bebArgs, fechadas: operacao.fechadas, aberto: operacao.aberto });
        if (resposta?.error) resposta = await registrarContagemMulti({ unidadeId, estoqueId, insumoId: item?.insumo_id, saldoContado: (Number(operacao.fechadas) || 0) * conteudoFrac + (Number(operacao.aberto) || 0), usuarioId: usuarioIdFinal, usuarioNome: responsavelNome, observacao: operacao.observacao });
      } else if (modal?.tipo === "contagem") {
        resposta = await registrarContagemMulti({
          unidadeId, estoqueId, insumoId: item?.insumo_id,
          saldoContado: operacao.quantidade, usuarioId: usuarioIdFinal,
          usuarioNome: responsavelNome, observacao: operacao.observacao,
        });
      } else if (modal?.tipo === "transferencia") {
        resposta = await transferirEntreEstoques({
          unidadeId, estoqueOrigem: estoqueAtual,
          estoqueDestino: estoques.find(i => i.id === operacao.destino_id),
          item, quantidade: operacao.quantidade, usuarioId: usuarioIdFinal,
          usuarioNome: responsavelNome, observacao: operacao.observacao,
        });
      } else {
        resposta = await registrarMovimentoMulti({
          unidadeId, estoqueId, insumoId: item?.insumo_id,
          tipo: modal?.tipo, quantidade: operacao.quantidade,
          usuarioId: usuarioIdFinal, usuarioNome: responsavelNome,
          observacao: operacao.observacao, dataMovimento: operacao.data || null,
        });
      }
      if (resposta?.error) return avisar(resposta.error, "erro");
      setModal(null);
      avisar(modal?.tipo === "transferencia" ? "Transferência concluída nos dois estoques." : "Movimentação registrada.");
      await atualizarTudo();
    } catch (e) {
      console.error(e);
      avisar(e?.message || "Erro inesperado ao registrar operação.", "erro");
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoItem = item => {
    setFormItem({
      ...item,
      estoque_minimo: item.estoque_minimo ?? "",
      estoque_maximo: item.estoque_maximo ?? "",
      custo_unitario: item.custo_unitario ?? "",
    });
    setModal({ tipo: "item", item });
  };

  const salvarConfiguracaoItem = async event => {
    event.preventDefault();
    setSalvando(true);
    const resposta = await atualizarItemEstoque(formItem.estoque_item_id, formItem);
    // Unidade comercial e "permite fracionado" ficam no insumo (valem p/ todos
    // os estoques do produto). Só grava se algum mudou.
    if (formItem.insumo_id) {
      await salvarInsumo({
        id: formItem.insumo_id, unidade_id: unidadeAtiva, nome: formItem.nome,
        unidade_comercial: formItem.unidade_comercial || null,
        permite_fracionado: formItem.permite_fracionado !== false,
      });
    }
    setSalvando(false);
    if (resposta.error) return avisar(resposta.error, "erro");
    setModal(null);
    avisar("Configuração do item atualizada.");
    await carregarArea();
  };

  const abrirEdicaoEstoque = estoque => {
    setFormEstoque(estoque ? {
      ...estoque,
      locais_texto: (estoque.locais_internos || []).join(", "),
      permissoes_texto: (estoque.permissoes || []).join(", "),
    } : {
      unidade_id: unidadeAtiva, nome: "", tipo: "materiais", descricao: "",
      status: "ativo", cor: "#059669", controla_validade: false,
      controla_minimo: true, locais_texto: "", permissoes_texto: "",
      ordem: estoques.length,
    });
    setModal({ tipo: "estoque", item: estoque });
  };

  const salvarConfiguracaoEstoque = async event => {
    event.preventDefault();
    setSalvando(true);
    const resposta = await salvarEstoque({
      ...formEstoque,
      unidade_id: unidadeAtiva,
      locais_internos: formEstoque.locais_texto?.split(",").map(v => v.trim()).filter(Boolean),
      permissoes: formEstoque.permissoes_texto?.split(",").map(v => v.trim()).filter(Boolean),
    });
    setSalvando(false);
    if (resposta.error) return avisar(resposta.error, "erro");
    setModal(null);
    avisar(formEstoque.id ? "Estoque atualizado." : "Novo estoque criado.");
    await carregarEstoques(resposta.data?.id || estoqueId);
  };

  const importarLista = async event => {
    event.preventDefault();
    if (!textoImportacao.trim()) return;
    setSalvando(true);
    const linhas = textoImportacao.split("\n").map(l => l.trim()).filter(Boolean);
    let importados = 0;
    for (const linha of linhas) {
      const [nome, saldo = "0", unidade = "un", minimo = "", local = ""] = linha.split(/[;\t]/).map(v => v.trim());
      if (!nome || /^produto|^nome/i.test(nome)) continue;
      let insumo = catalogo.find(i => i.nome?.toLowerCase() === nome.toLowerCase());
      if (!insumo) {
        const novo = await salvarInsumo({
          unidade_id: unidadeAtiva, departamento: estoqueAtual.slug,
          nome, nome_original: nome, unidade_medida: unidade || "un",
          tamanho_embalagem: 1, categoria: "Sem categoria",
          custo_unitario: 0, custo_compra: 0, ativo: true,
        }, { origem: `Importação — estoque ${estoqueAtual.nome}` });
        if (novo.error) continue;
        insumo = { id: novo.id, nome, unidade_medida: unidade || "un" };
      }
      const vinculo = await vincularItemEstoque({
        unidadeId: unidadeAtiva, estoqueId, insumoId: insumo.id,
        minimo, local, custoUnitario: insumo.custo_compra ?? insumo.custo_unitario ?? 0,
      });
      if (vinculo.error) continue;
      const contagem = await registrarContagemMulti({
        unidadeId: unidadeAtiva, estoqueId, insumoId: insumo.id,
        saldoContado: Number(String(saldo).replace(",", ".")) || 0,
        usuarioId: idUsuario(sessao), usuarioNome: nomeUsuario(sessao),
        observacao: "Importação de lista",
      });
      if (!contagem.error) importados += 1;
    }
    setSalvando(false);
    setModal(null);
    setTextoImportacao("");
    avisar(`${importados} item(ns) importado(s) para ${estoqueAtual.nome}.`);
    await atualizarTudo();
  };

  const ativo = estoqueAtual?.status === "ativo";

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-7">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={abrirMenu} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Voltar ao módulo"><ArrowLeft size={21} /></button>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Estoque</h1>
              <p className="text-sm text-slate-500">Saldos e movimentações separados por área · {unidadeInfo?.nome || "Unidade"}</p>
            </div>
          </div>
          <button onClick={() => abrirEdicaoEstoque(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold hover:bg-slate-50">
            <Settings2 size={18} /> Gerenciar estoques
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-7">
        {(erro || sucesso) && (
          <div className={`fixed right-4 top-4 z-[150] max-w-sm rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-xl ${erro ? "bg-red-600" : "bg-emerald-700"}`}>
            {erro || sucesso}
          </div>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-sm font-extrabold text-slate-800">Área de estoque</p><p className="text-xs text-slate-500">Cada área mantém seu próprio saldo.</p></div>
            <button onClick={() => abrirEdicaoEstoque(estoqueAtual)} disabled={!estoqueAtual} className="text-sm font-bold text-emerald-700 hover:underline">Editar área</button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {estoquesVisiveis.map(estoque => (
              <button
                key={estoque.id}
                onClick={() => setEstoqueId(estoque.id)}
                className={`relative min-h-[110px] rounded-2xl border p-4 text-left transition ${estoque.id === estoqueId ? "border-transparent text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300"} ${estoque.status !== "ativo" ? "opacity-55" : ""}`}
                style={estoque.id === estoqueId ? { backgroundColor: estoque.cor || "#047857" } : undefined}
              >
                <div className="flex items-center justify-between"><Warehouse size={20} /><ChevronRight size={17} /></div>
                <strong className="mt-3 block text-base">{estoque.nome}</strong>
                <span className={`text-xs ${estoque.id === estoqueId ? "text-white/80" : "text-slate-500"}`}>{estoque.itens || 0} itens · {estoque.status}</span>
              </button>
            ))}
          </div>
        </section>

        {estoqueAtual && (
          <>
            <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mr-auto px-2 text-sm font-black" style={{ color: estoqueAtual.cor }}>{estoqueAtual.nome}</span>
              <button disabled={!ativo} onClick={() => abrirOperacao("entrada")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white disabled:opacity-40"><PackagePlus size={17} /> Nova entrada</button>
              <button disabled={!ativo || !itens.length} onClick={() => abrirOperacao("saida")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><PackageMinus size={17} /> Nova baixa</button>
              <button disabled={!ativo || !itens.length} onClick={() => abrirOperacao("contagem")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><ClipboardCheck size={17} /> Contagem</button>
              <button disabled={!ativo || !itens.length || !destinosCompativeis.length} onClick={() => abrirOperacao("transferencia")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><ArrowRightLeft size={17} /> Transferência</button>
              <button disabled={!ativo} onClick={() => setModal({ tipo: "importar" })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><Upload size={17} /> Importar lista</button>
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              {[
                { icon: Package, label: "Valor neste estoque", value: fmtBRL(valorTotal) },
                { icon: AlertTriangle, label: "Abaixo do mínimo", value: `${itensDaArea.filter(i => statusItemEstoque(i, estoqueAtual).abaixoMinimo).length} itens` },
                { icon: CalendarDays, label: "Próximas validades", value: estoqueAtual.controla_validade ? `${itensDaArea.filter(i => statusItemEstoque(i, estoqueAtual).validadeProxima).length} itens` : "Não controlada" },
                { icon: Clock3, label: "Última reposição", value: ultimaEntrada ? fmtData(ultimaEntrada.data_movimento, true) : "Sem registro" },
                { icon: Boxes, label: "Resumo da área", value: `${itensDaArea.length} itens` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon size={18} /></div>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-x-4 border-b border-slate-200 px-4 pt-1 sm:flex sm:gap-5 sm:overflow-x-auto sm:px-6">
                {[
                  ["atual", "Estoque atual"], ["historico", "Histórico completo"],
                  ["movimentacoes", "Movimentações"], ["alertas", `Alertas (${alertas.length})`],
                ].map(([id, label]) => (
                  <button key={id} onClick={() => setAba(id)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-xs font-extrabold sm:py-4 sm:text-sm ${aba === id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"}`}>{label}</button>
                ))}
              </div>

              {aba === "atual" || aba === "alertas" ? (
                <>
                  <div className="grid gap-3 p-4 lg:grid-cols-[1fr_190px_170px_180px]">
                    <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={19} /><input value={filtros.busca} onChange={e => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Buscar produto por nome, marca ou código..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 outline-none focus:border-emerald-500" /></label>
                    <select value={filtros.categoria} onChange={e => setFiltros({ ...filtros, categoria: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 font-semibold">{categorias.map(v => <option key={v}>{v}</option>)}</select>
                    <select value={filtros.status} onChange={e => setFiltros({ ...filtros, status: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 font-semibold">
                      <option value="todos">Todos os status</option><option value="abaixo">Abaixo do mínimo</option><option value="validade">Validade próxima</option><option value="sem-saldo">Sem saldo</option>
                    </select>
                    <select value={filtros.local} onChange={e => setFiltros({ ...filtros, local: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 font-semibold">{locais.map(v => <option key={v}>{v}</option>)}</select>
                  </div>
                  <TabelaItens
                    itens={aba === "alertas" ? itensFiltrados.filter(i => alertas.some(a => a.id === i.id)) : itensFiltrados}
                    estoque={estoqueAtual} loading={loading}
                    onEntrada={item => abrirOperacao("entrada", item)}
                    onSaida={item => abrirOperacao("saida", item)}
                    onEditar={abrirEdicaoItem}
                  />
                </>
              ) : (
                <ListaMovimentos movimentos={movimentos} modo={aba} />
              )}
            </section>
          </>
        )}
      </main>

      {["entrada", "saida", "contagem", "transferencia"].includes(modal?.tipo) && (
        <Modal
          titulo={{ entrada: "Nova entrada", saida: "Nova baixa", contagem: "Contagem de estoque", transferencia: "Transferir entre estoques" }[modal.tipo]}
          descricao={`Movimentação exclusiva do estoque ${estoqueAtual?.nome}.`}
          onClose={() => setModal(null)}
        >
          <form onSubmit={executarOperacao} className="space-y-4">
            <Campo label={`Produto (${modal.tipo === "entrada" ? `Estoque ${estoqueAtual?.nome || ""}` : "Disponível no estoque"})`}>
              <select required value={operacao.insumo_id} disabled={!!modal.item} onChange={e => setOperacao({ ...operacao, insumo_id: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3 disabled:bg-slate-100">
                <option value="">Selecione o produto...</option>
                {(modal.tipo === "entrada" ? catalogoFiltradoPorArea : itensDaArea).map(item => <option key={item.id} value={item.insumo_id || item.id}>{item.nome} {item.marca ? `· ${item.marca}` : ""}</option>)}
              </select>
            </Campo>

            <Campo label={`Responsável (${estoqueAtual?.nome || "Estoque"})`}>
              <select value={operacao.responsavel_id} onChange={e => setOperacao({ ...operacao, responsavel_id: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3 font-semibold text-slate-800">
                <option value="">Selecione o colaborador responsável...</option>
                {colaboradoresFiltrados.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} {c.cargo ? `· ${c.cargo}` : ""}</option>
                ))}
              </select>
            </Campo>

            {(() => {
              const itemMod = modal.item || itens.find(i => i.insumo_id === operacao.insumo_id) || catalogo.find(i => (i.insumo_id || i.id) === operacao.insumo_id);
              const frac = ehFracionavel(itemMod) && modal.tipo !== "transferencia";
              const conteudo = conteudoDe(itemMod);
              const unConteudo = mostrarUn(itemMod?.unidade_medida);
              const unLabel = itemMod?.unidade_comercial || "unidade";
              if (!frac) {
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label={modal.tipo === "contagem" ? "Saldo contado" : "Quantidade"}>
                      <input required min="0" step="0.001" type="number" value={operacao.quantidade} onChange={e => setOperacao({ ...operacao, quantidade: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" />
                    </Campo>
                    {modal.tipo === "transferencia" ? (
                      <Campo label="Estoque de destino">
                        <select required value={operacao.destino_id} onChange={e => setOperacao({ ...operacao, destino_id: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">
                          <option value="">Selecione...</option>{destinosCompativeis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                        </select>
                      </Campo>
                    ) : modal.tipo !== "contagem" ? (
                      <Campo label="Data (opcional)"><input type="datetime-local" value={operacao.data} onChange={e => setOperacao({ ...operacao, data: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
                    ) : <div />}
                  </div>
                );
              }
              // ---- Bebida/embalado fracionável ----
              if (modal.tipo === "entrada") {
                const un = Math.max(0, Number(operacao.quantidade) || 0);
                return (
                  <div className="space-y-2">
                    <Campo label={`Quantidade recebida (${unLabel}s)`}>
                      <input required min="0" step="1" type="number" value={operacao.quantidade} onChange={e => setOperacao({ ...operacao, quantidade: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" placeholder={`Ex.: 10 ${unLabel}s`} />
                    </Campo>
                    <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Conteúdo por {unLabel}: {fmtEquiv(conteudo, unConteudo)} · Volume equivalente: <b>{fmtEquiv(un * conteudo, unConteudo)}</b></p>
                  </div>
                );
              }
              if (modal.tipo === "saida") {
                const q = Math.max(0, Number(operacao.quantidade) || 0);
                const div = dividirSaldo(itemMod.quantidade_atual, conteudo, true);
                let preview = null;
                if (operacao.modo === "conteudo" && q > 0) {
                  const precisa = q - div.aberto;
                  const abrir = precisa > 1e-9 ? Math.ceil(precisa / conteudo) : 0;
                  const excede = q > (Number(itemMod.quantidade_atual) || 0) + 1e-9;
                  preview = excede
                    ? <span className="text-red-600">Saldo insuficiente (disponível {fmtEquiv(itemMod.quantidade_atual, unConteudo)}).</span>
                    : <>{abrir > 0 ? `${abrir} ${unLabel}(s) será(ão) aberta(s) automaticamente. ` : ""}Depois: {Math.max(0, div.fechadas - abrir)} {unLabel}s + {fmtEquiv((div.aberto + abrir * conteudo) - q, unConteudo)}.</>;
                }
                if (operacao.modo === "unidade" && q > 0) {
                  const excede = q > div.fechadas + 1e-9;
                  preview = excede ? <span className="text-red-600">Só há {div.fechadas} {unLabel}(s) fechada(s).</span> : <>Baixa de {q} {unLabel}(s) fechada(s) = {fmtEquiv(q * conteudo, unConteudo)}.</>;
                }
                return (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {[["conteudo", `Por conteúdo (${unConteudo})`], ["unidade", `Por ${unLabel} fechada`]].map(([v, l]) => (
                        <button type="button" key={v} onClick={() => setOperacao({ ...operacao, modo: v, quantidade: "" })} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${operacao.modo === v ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{l}</button>
                      ))}
                    </div>
                    <Campo label={operacao.modo === "unidade" ? `Quantidade (${unLabel}s)` : `Quantidade (${unConteudo})`}>
                      <input required min="0" step={operacao.modo === "unidade" ? "1" : "0.001"} type="number" value={operacao.quantidade} onChange={e => setOperacao({ ...operacao, quantidade: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" />
                    </Campo>
                    <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">Saldo: {div.fechadas} {unLabel}s{div.aberto > 0 ? ` + ${fmtEquiv(div.aberto, unConteudo)}` : ""}. {preview}</p>
                  </div>
                );
              }
              // contagem
              const total = (Number(operacao.fechadas) || 0) * conteudo + (Number(operacao.aberto) || 0);
              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label={`${unLabel.charAt(0).toUpperCase() + unLabel.slice(1)}s fechadas`}>
                      <input required min="0" step="1" type="number" value={operacao.fechadas} onChange={e => setOperacao({ ...operacao, fechadas: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" />
                    </Campo>
                    <Campo label={`Aberto (${unConteudo})`}>
                      <input min="0" step="0.001" type="number" value={operacao.aberto} onChange={e => setOperacao({ ...operacao, aberto: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" />
                    </Campo>
                  </div>
                  <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">Total contado: {operacao.fechadas || 0} {unLabel}s + {fmtEquiv(Number(operacao.aberto) || 0, unConteudo)} = <b>{fmtEquiv(total, unConteudo)}</b></p>
                </div>
              );
            })()}
            <Campo label="Observação"><textarea value={operacao.observacao} onChange={e => setOperacao({ ...operacao, observacao: e.target.value })} className="min-h-24 w-full rounded-xl border border-slate-200 p-3" placeholder="Motivo, documento ou observações adicionais..." /></Campo>
            {modal.tipo === "transferencia" && !destinosCompativeis.length && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Não há outro estoque ativo e compatível com esta área.</p>}
            <div className="flex justify-end"><BotaoSalvar carregando={salvando}>Confirmar</BotaoSalvar></div>
          </form>
        </Modal>
      )}

      {modal?.tipo === "item" && (
        <Modal titulo={`Configurar ${modal.item.nome}`} descricao={`Parâmetros válidos apenas em ${estoqueAtual?.nome}.`} onClose={() => setModal(null)}>
          <form onSubmit={salvarConfiguracaoItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Estoque mínimo"><input type="number" min="0" step="0.001" value={formItem.estoque_minimo} onChange={e => setFormItem({ ...formItem, estoque_minimo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              <Campo label="Estoque máximo"><input type="number" min="0" step="0.001" value={formItem.estoque_maximo} onChange={e => setFormItem({ ...formItem, estoque_maximo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              <Campo label="Custo unitário">
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm font-extrabold text-slate-500">R$</span>
                  <input type="number" min="0" step="0.01" value={formItem.custo_unitario} onChange={e => setFormItem({ ...formItem, custo_unitario: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 pl-10 pr-3 font-semibold" placeholder="0,00" />
                </div>
              </Campo>
              <Campo label="Local interno"><input value={formItem.local_interno || ""} onChange={e => setFormItem({ ...formItem, local_interno: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="Ex.: Câmara fria 01" /></Campo>
              {estoqueAtual?.controla_validade && <Campo label="Validade"><input type="date" value={formItem.validade || ""} onChange={e => setFormItem({ ...formItem, validade: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>}
            </div>
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={formItem.permite_transferencia !== false} onChange={e => setFormItem({ ...formItem, permite_transferencia: e.target.checked })} /> Permitir transferências deste item</label>
            {/* Embalagem/fracionamento — valem para o produto em todos os estoques */}
            {Number(formItem.tamanho_embalagem) > 1 && String(formItem.unidade_medida || "").toLowerCase() !== "un" && (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Bebida / embalado</p>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Unidade comercial">
                    <select value={formItem.unidade_comercial || ""} onChange={e => setFormItem({ ...formItem, unidade_comercial: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">
                      <option value="">Selecione...</option>
                      {["garrafa", "lata", "unidade", "caixa", "pacote", "fardo", "barril", "outro"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Conteúdo por unidade">
                    <div className="grid h-12 place-items-center rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-600">{fmtQtd(formItem.tamanho_embalagem)} {String(formItem.unidade_medida).toLowerCase() === "l" ? "L" : formItem.unidade_medida}</div>
                  </Campo>
                </div>
                <label className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={formItem.permite_fracionado !== false} onChange={e => setFormItem({ ...formItem, permite_fracionado: e.target.checked })} /> Permite controle fracionado (abrir e usar por conteúdo)</label>
              </div>
            )}
            <div className="flex justify-end"><BotaoSalvar carregando={salvando} /></div>
          </form>
        </Modal>
      )}

      {modal?.tipo === "estoque" && (
        <Modal titulo={formEstoque.id ? "Editar estoque" : "Novo estoque"} descricao="Cadastre uma área independente de saldo e movimentações." onClose={() => setModal(null)} largo>
          <form onSubmit={salvarConfiguracaoEstoque} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome"><input required value={formEstoque.nome || ""} onChange={e => setFormEstoque({ ...formEstoque, nome: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              <Campo label="Tipo"><select value={formEstoque.tipo || "materiais"} onChange={e => setFormEstoque({ ...formEstoque, tipo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">{TIPOS_ESTOQUE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Campo>
              <Campo label="Status"><select value={formEstoque.status || "ativo"} onChange={e => setFormEstoque({ ...formEstoque, status: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3"><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></Campo>
              <Campo label="Cor"><input type="color" value={formEstoque.cor || "#059669"} onChange={e => setFormEstoque({ ...formEstoque, cor: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 p-2" /></Campo>
              <Campo label="Locais internos (separados por vírgula)"><input value={formEstoque.locais_texto || ""} onChange={e => setFormEstoque({ ...formEstoque, locais_texto: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="Despensa, Câmara fria" /></Campo>
              <Campo label="Perfis autorizados (separados por vírgula)"><input value={formEstoque.permissoes_texto || ""} onChange={e => setFormEstoque({ ...formEstoque, permissoes_texto: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="administrador, estoque" /></Campo>
            </div>
            <Campo label="Descrição"><textarea value={formEstoque.descricao || ""} onChange={e => setFormEstoque({ ...formEstoque, descricao: e.target.value })} className="min-h-20 w-full rounded-xl border border-slate-200 p-3" /></Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={!!formEstoque.controla_validade} onChange={e => setFormEstoque({ ...formEstoque, controla_validade: e.target.checked })} /> Controlar validade</label>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={formEstoque.controla_minimo !== false} onChange={e => setFormEstoque({ ...formEstoque, controla_minimo: e.target.checked })} /> Controlar estoque mínimo</label>
            </div>
            <div className="flex justify-end"><BotaoSalvar carregando={salvando} /></div>
          </form>
        </Modal>
      )}

      {modal?.tipo === "importar" && (
        <Modal titulo={`Importar lista para ${estoqueAtual?.nome}`} descricao="Cada linha: produto; saldo; unidade; mínimo; local." onClose={() => setModal(null)} largo>
          <form onSubmit={importarLista} className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-3 font-mono text-xs text-emerald-900">Arroz branco; 12; kg; 5; Despensa seca<br />Detergente; 24; un; 6; Armário 02</div>
            <textarea required value={textoImportacao} onChange={e => setTextoImportacao(e.target.value)} className="min-h-64 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm" placeholder="Cole sua lista aqui..." />
            <div className="flex justify-end"><BotaoSalvar carregando={salvando}>Importar</BotaoSalvar></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Saldo de bebidas/embalados: mostra UNIDADES comerciais como principal e o
// equivalente (ml/L/g/kg) como secundário — quando o item tem conteúdo por
// embalagem (> 1). Ex.: 5000 ml de garrafas de 750 → "6 un + 500 ml".
function saldoEmbalado(item) {
  const conteudo = Number(item.tamanho_embalagem) || 1;
  const total = Number(item.quantidade_atual) || 0;
  const un = String(item.unidade_medida || "un").toLowerCase();
  if (conteudo <= 1 || un === "un") return null; // sem embalagem fracionável
  const unLabel = item.unidade_comercial || "un";
  const fechadas = Math.floor(total / conteudo);
  const aberto = +(total - fechadas * conteudo).toFixed(3);
  const fmtEq = (q, u) => {
    const n = Number(q) || 0;
    if (u === "ml") return n >= 1000 ? `${(+(n / 1000).toFixed(3)).toLocaleString("pt-BR")} L` : `${fmtQtd(n)} ml`;
    if (u === "g") return n >= 1000 ? `${(+(n / 1000).toFixed(3)).toLocaleString("pt-BR")} kg` : `${fmtQtd(n)} g`;
    return `${fmtQtd(n)} ${mostrarUn(u)}`;
  };
  const principal = `${fechadas} ${unLabel}${aberto > 0 ? ` + ${fmtEq(aberto, un)}` : ""}`;
  const secundario = `Conteúdo: ${fmtQtd(conteudo)} ${mostrarUn(un)}/un · Total: ${fmtEq(total, un)}`;
  return { principal, secundario };
}

function TabelaItens({ itens, estoque, loading, onEntrada, onSaida, onEditar }) {
  const agrupadoPorCategoria = useMemo(() => {
    if (!itens || !itens.length) return [];
    const mapa = new Map();
    for (const item of itens) {
      const cat = item.categoria || "Sem categoria";
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat).push(item);
    }
    const categoriasOrdenadas = Array.from(mapa.keys()).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    return categoriasOrdenadas.map(cat => {
      const lista = mapa.get(cat).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));
      const subtotal = lista.reduce((soma, i) => soma + calcularValorItem(i), 0);
      return { categoria: cat, lista, subtotal };
    });
  }, [itens]);

  if (loading) return <div className="grid min-h-64 place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>;
  if (!itens || !itens.length) return <div className="grid min-h-64 place-items-center px-5 text-center"><div><Package size={42} className="mx-auto mb-3 text-slate-300" /><p className="font-black text-slate-700">Nenhum item encontrado neste estoque</p><p className="mt-1 text-sm text-slate-500">Use “Nova entrada” ou “Importar lista” para começar.</p></div></div>;

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr>
            <th className="px-5 py-4">Produto</th><th className="px-4 py-4">Categoria</th><th className="px-4 py-4">Embalagem</th><th className="px-4 py-4 whitespace-nowrap">Custo/un.</th><th className="px-4 py-4">Saldo</th><th className="px-4 py-4 whitespace-nowrap">Valor total</th><th className="px-3 py-4">Mínimo</th><th className="px-3 py-4">Máximo</th>{estoque.controla_validade && <th className="px-4 py-4">Validade</th>}<th className="px-4 py-4">Local</th><th className="px-4 py-4">Última mov.</th><th className="px-4 py-4">Ações</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {agrupadoPorCategoria.map(({ categoria, lista, subtotal }) => (
              <React.Fragment key={categoria}>
                <tr className="bg-slate-100/90 border-y border-slate-200">
                  <td colSpan={estoque.controla_validade ? 12 : 11} className="px-5 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
                        {categoria} <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm border border-slate-200">{lista.length} {lista.length === 1 ? "item" : "itens"}</span>
                      </span>
                      <span className="text-xs font-extrabold text-emerald-800">
                        Subtotal: {fmtBRL(subtotal)}
                      </span>
                    </div>
                  </td>
                </tr>
                {lista.map(item => {
                  const status = statusItemEstoque(item, estoque);
                  const valTotalItem = calcularValorItem(item);
                  return <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3"><strong className="block">{item.nome}</strong><span className="text-xs text-slate-500">{item.codigo_interno || item.marca || "Sem código"}</span></td>
                    <td className="px-4 py-3"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{item.categoria || "Sem categoria"}</span></td>
                    <td className="px-4 py-3">{fmtQtd(item.tamanho_embalagem || 1)} {mostrarUn(item.unidade_medida)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><strong className="font-extrabold text-slate-900">{fmtBRL(item.custo_unitario || 0)}</strong></td>
                    <td className={`px-4 py-3 font-black ${status.abaixoMinimo ? "text-red-600" : "text-emerald-700"}`}>{(() => { const s = saldoEmbalado(item); return s ? <><span>{s.principal}</span><span className="block text-[10px] font-medium text-slate-400">{s.secundario}</span></> : <>{fmtQtd(item.quantidade_atual)} {mostrarUn(item.unidade_medida)}</>; })()}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><strong className="font-black text-emerald-800">{fmtBRL(valTotalItem)}</strong></td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{item.estoque_minimo == null || item.estoque_minimo === "" ? "—" : `${fmtQtd(item.estoque_minimo)} ${mostrarUn(item.unidade_medida)}`}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{item.estoque_maximo == null || item.estoque_maximo === "" ? "—" : `${fmtQtd(item.estoque_maximo)} ${mostrarUn(item.unidade_medida)}`}</td>
                    {estoque.controla_validade && <td className={`px-4 py-3 ${status.vencido || status.validadeProxima ? "font-bold text-amber-700" : ""}`}>{fmtData(item.validade)}</td>}
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><MapPin size={14} />{item.local_interno || "Não definido"}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtData(item.ultima_movimentacao_em, true)}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">
                      <button onClick={() => onEntrada(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-600 text-emerald-700" title="Entrada"><Plus size={17} /></button>
                      <button onClick={() => onSaida(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-600 text-emerald-700" title="Baixa"><span className="text-xl leading-none">−</span></button>
                      <SimuladorRendimento item={item} variant="icon" />
                      <button onClick={() => onEditar(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600" title="Configurar"><MoreVertical size={17} /></button>
                    </div></td>
                  </tr>;
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 lg:hidden">
        {agrupadoPorCategoria.map(({ categoria, lista, subtotal }) => (
          <div key={categoria} className="p-3 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-extrabold text-slate-800">
              <span className="uppercase tracking-wider">{categoria} ({lista.length})</span>
              <span className="text-emerald-800">Subtotal: {fmtBRL(subtotal)}</span>
            </div>
            {lista.map(item => {
              const status = statusItemEstoque(item, estoque);
              const valTotalItem = calcularValorItem(item);
              return <article key={item.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-slate-900">{item.nome}</strong>
                    <p className="mt-1 text-xs text-slate-500">{item.categoria || "Sem categoria"} · {item.local_interno || "Sem local"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Mín: {item.estoque_minimo ?? "—"} · Máx: {item.estoque_maximo ?? "—"}</p>
                    <p className="mt-0.5 text-xs font-black text-emerald-800">Valor total: {fmtBRL(valTotalItem)}</p>
                  </div>
                  <div className="text-right">{(() => { const s = saldoEmbalado(item); return s ? <><strong className={status.abaixoMinimo ? "text-red-600" : "text-emerald-700"}>{s.principal}</strong><span className="block text-[10px] font-medium text-slate-400">{s.secundario}</span></> : <strong className={status.abaixoMinimo ? "text-red-600" : "text-emerald-700"}>{fmtQtd(item.quantidade_atual)} {mostrarUn(item.unidade_medida)}</strong>; })()}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={() => onEntrada(item)} className="rounded-xl bg-emerald-50 py-2 text-sm font-bold text-emerald-700">+ Entrada</button><button onClick={() => onSaida(item)} className="rounded-xl bg-slate-100 py-2 text-sm font-bold">− Baixa</button><button onClick={() => onEditar(item)} className="rounded-xl bg-slate-100 py-2 text-sm font-bold">Configurar</button></div>
                <div className="mt-2"><SimuladorRendimento item={item} variant="full" /></div>
              </article>;
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function ListaMovimentos({ movimentos, modo }) {
  const lista = modo === "movimentacoes"
    ? movimentos.filter(m => ["entrada", "saida", "transferencia_saida", "transferencia_entrada", "contagem"].includes(m.tipo))
    : movimentos;

  if (!lista.length) return <div className="grid min-h-64 place-items-center text-sm font-semibold text-slate-500">Nenhuma movimentação registrada nesta área.</div>;

  return (
    <div className="divide-y divide-slate-100">
      {lista.map(mov => {
        const positivo = ["entrada", "transferencia_entrada"].includes(mov.tipo) || (mov.tipo === "contagem" && Number(mov.quantidade) >= 0);
        const tipoRotulo = {
          entrada: "Entrada",
          saida: "Baixa",
          contagem: "Contagem",
          transferencia_saida: "Transferência (Saída)",
          transferencia_entrada: "Transferência (Entrada)",
        }[mov.tipo] || mov.tipo;

        return (
          <div key={mov.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/80">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${positivo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {mov.tipo.includes("transferencia") ? <ArrowRightLeft size={18} /> : <History size={18} />}
              </div>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-black text-slate-900">{mov.insumo?.nome || "Produto"}</strong>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span className={`font-bold ${positivo ? "text-emerald-700" : "text-slate-700"}`}>{tipoRotulo}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-bold text-slate-800"><User size={13} className="text-slate-400" />{mov.usuario_nome || "Sistema"}</span>
                  <span>·</span>
                  <span className="font-medium text-slate-600">📅 {fmtData(mov.data_movimento, true)}</span>
                </div>
                {mov.observacao && <p className="mt-1 text-xs text-slate-400 italic">“{mov.observacao}”</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <strong className={`text-base font-black ${positivo ? "text-emerald-700" : "text-red-600"}`}>
                {positivo ? "+" : "−"} {fmtQtd(Math.abs(Number(mov.quantidade) || 0))} {mostrarUn(mov.insumo?.unidade_medida)}
              </strong>
              {mov.destino?.nome && <p className="text-xs font-medium text-slate-500">Destino: {mov.destino.nome}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EstoquePage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div>}><EstoqueRunner /></Suspense>;
}
