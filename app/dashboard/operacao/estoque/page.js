"use client";

import React, { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRightLeft, Boxes, CalendarDays, Check,
  ChevronDown, ChevronRight, ChevronUp, ClipboardCheck, Clock3, Copy, Download, Edit3, FileText, Filter, History, Loader2,
  Lock, MapPin, Mic, MoreVertical, Package, PackageMinus, PackagePlus, Plus, Printer, Search,
  Settings2, Share2, Tablet, Upload, User, Warehouse, X,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, fetchNomesDePratosEDrinks, salvarInsumo } from "../../../lib/operacao";
import { fetchEmbalagens } from "../../../lib/embalagens";
import { fetchPins } from "../../../lib/seguranca";
import { fetchCategoriasCriadas, salvarCategoriasCriadas, mesclarCategorias, ehEmbutida, contarItensNaCategoria } from "../../../lib/categorias-estoque";
import { fetchColaboradores } from "../../../lib/rh";
import { criarEscuta, vozDisponivel } from "../../../lib/hefisto-voz";
import { equipeDaArea } from "../../../lib/equipe-area.mjs";
import {
  atualizarItemEstoque, fetchEstoques, fetchItensEstoque, fetchMovimentosMulti,
  registrarContagemMulti, registrarMovimentoMulti, realocarItemEstoque, salvarEstoque,
  transferirEntreEstoques, vincularItemEstoque, zerarEstoque,
} from "../../../lib/estoques-multiplos";
import {
  filtrarItensEstoque, grupoOperacionalItem, gruposOperacionaisEstoque,
  statusItemEstoque, TIPOS_ESTOQUE, tiposCompativeis,
} from "../../../lib/estoques-multiplos-utils.mjs";
import { fmtBRL } from "../../../components/ui";
import SimuladorRendimento from "../../../components/SimuladorRendimento";
import TabletSetor from "../../../components/TabletSetor";
import { entradaBebidaUnidades, baixaBebidaUnidades, baixaBebidaConteudo, contagemBebida, dividirSaldo } from "../../../lib/estoque-bebidas";

// Item fracionável = tem conteúdo por embalagem (>1) e permite controle
// fracionado (garrafa/lata/pacote). Nele a entrada é por unidade comercial e a
// baixa pode ser por unidade fechada ou por conteúdo (ml/g).
// Unidades que se CONTAM (não se medem): garrafa, lata, caixa... O sistema já
// entende que são peças inteiras e não pede conversão em ml/g.
const UNIDADES_CONTAVEIS = ["un", "unidade", "garrafa", "lata", "barril", "caixa", "cx", "pacote", "fardo", "maco", "maço"];
const ehUnidadeContavel = (u) => UNIDADES_CONTAVEIS.includes(String(u || "").toLowerCase());

// Fracionável = embalagem com conteúdo que se consome em partes (ml/g).
// Numa unidade contável isso só vale se a pessoa marcar explicitamente
// "permite fracionado" no cadastro (ex.: garrafa de whisky servida em doses).
const ehFracionavel = (item) => {
  if (!item || !(Number(item.tamanho_embalagem) > 1)) return false;
  if (ehUnidadeContavel(item.unidade_medida)) return item.permite_fracionado === true;
  return item.permite_fracionado !== false;
};
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

// Categorias oficiais da Cozinha na ordem exata solicitada pelo usuário
const CATEGORIAS_ESTOQUE_COZINHA = [
  "Carne vermelha",
  "Peixe",
  "Aves",
  "Frutos do mar",
  "Caranguejo",
  "Laticínios",
  "Hortifrúti",
  "Secos",
  "Líquidos",
  "Pré-preparos",
];

// Categorias oficiais do Bar na ordem exata solicitada pelo usuário
const CATEGORIAS_ESTOQUE_BAR = [
  "Cervejas",
  "Destilados",
  "Vinhos",
  "Chopp",
  "Água",
  "Refrigerantes",
  "Bombons",
  "Pré-preparos",
];

// O estoque é o lugar físico; o departamento é o setor dono do ingrediente.
// "Pré-preparos da Cozinha" e "Embalagens da Cozinha" são estoques diferentes,
// mas o ingrediente que nasce neles pertence à cozinha do mesmo jeito.
function departamentoDoEstoque(estoque) {
  const texto = `${estoque?.slug || ""} ${estoque?.nome || ""}`.toLowerCase();
  if (texto.includes("embalage")) return "embalagens";
  if (texto.includes("bar")) return "bar";
  if (texto.includes("cozinha")) return "cozinha";
  return String(estoque?.slug || "cozinha").toLowerCase();
}

// Categorias oferecidas no cadastro rápido, conforme o setor do estoque.
function categoriasDoEstoque(estoque) {
  const dept = departamentoDoEstoque(estoque);
  if (dept === "bar") return CATEGORIAS_ESTOQUE_BAR;
  if (dept === "cozinha") return CATEGORIAS_ESTOQUE_COZINHA;
  return [];
}

function calcularValorItem(item) {
  if (!item) return 0;
  const qtd = Number(item?.quantidade_atual) || 0;
  if (qtd <= 0) return 0;

  const custoUnit = Number(item?.custo_unitario || item?.preco_normalizado || item?.insumo?.preco_normalizado) || 0;
  const custoCompra = Number(item?.custo_compra || item?.preco_compra || item?.insumo?.custo_compra) || 0;
  const tamEmb = Number(item?.tamanho_embalagem) || 1;

  // 1. Custo por unidade comercial/embalagem (ex: R$ 13,00 por garrafa Amstel, R$ 14,00 Corona, R$ 40,00 Aperol)
  let custoEfetivo = custoUnit > 0 ? custoUnit : custoCompra;
  if (custoEfetivo > 0 && custoEfetivo < 0.5 && tamEmb > 1) {
    custoEfetivo = custoEfetivo * tamEmb;
  }

  if (custoEfetivo <= 0) return 0;

  // 2. Número de unidades comerciais/garrafas
  // Se a quantidade no banco for em ml/g totais (ex: 10800 ml com garrafas de 600ml), dividimos por 600 (10800 / 600 = 18 garrafas).
  // Se a quantidade no banco já for em unidades/garrafas (ex: 18 garrafas, 24 un, 6 un, 1 fardo), usaremos 18 diretamente.
  let numUnidades = qtd;
  if (tamEmb > 1 && qtd >= tamEmb * 1.5) {
    numUnidades = qtd / tamEmb;
  }

  return Math.round(numUnidades * custoEfetivo * 100) / 100;
}

function exportarExcel(estoque, itens, unidadeInfo) {
  let csv = "\uFEFF";
  csv += `Relatório de Estoque - ${estoque?.nome || "Estoque"} (${unidadeInfo?.nome || ""})\n`;
  csv += `Emitido em: ${new Date().toLocaleDateString("pt-BR")}\n\n`;
  csv += "Produto;Categoria;Embalagem;Unidade;Custo Unitário (R$);Saldo;Valor Total (R$);Estoque Mínimo;Local Interno;Validade\n";

  for (const item of itens) {
    const valTotal = calcularValorItem(item);
    csv += `"${item.nome || ""}";"${item.categoria || "Sem categoria"}";"${item.tamanho_embalagem || 1}";"${mostrarUn(item.unidade_medida)}";"${(item.custo_unitario || 0).toFixed(2)}";"${item.quantidade_atual || 0}";"${valTotal.toFixed(2)}";"${item.estoque_minimo ?? ""}";"${item.local_interno || ""}";"${item.validade || ""}"\n`;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Estoque_${estoque?.slug || "estoque"}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function gerarTextoWhatsApp(estoque, itens, unidadeInfo) {
  const totalValor = itens.reduce((soma, i) => soma + (calcularValorItem(i) || 0), 0);
  let txt = `📦 *ESTOQUE - ${estoque?.nome?.toUpperCase() || "ESTOQUE"}*\n`;
  txt += `📍 Unidade: ${unidadeInfo?.nome || "Restaurante"}\n`;
  txt += `📅 Data: ${new Date().toLocaleDateString("pt-BR")}\n`;
  txt += `💰 Valor Total: ${fmtBRL(totalValor)}\n`;
  txt += `-----------------------------------\n\n`;

  const mapa = new Map();
  for (const item of itens) {
    const cat = item.categoria || "Sem categoria";
    if (!mapa.has(cat)) mapa.set(cat, []);
    mapa.get(cat).push(item);
  }

  for (const [cat, list] of mapa.entries()) {
    txt += `📁 *${cat.toUpperCase()}* (${list.length} itens)\n`;
    for (const i of list) {
      const qtd = Number(i.quantidade_atual) || 0;
      const un = i.unidade_medida || "un";
      txt += `  • ${i.nome}: *${fmtQtd(qtd)} ${mostrarUn(un)}* (${fmtBRL(calcularValorItem(i))})\n`;
    }
    txt += `\n`;
  }

  return txt;
}

// Lista de COMPRAS: só itens abaixo do mínimo (se nenhum, lista todos), agrupados
// por fornecedor, com nome, marca, valor e a quantidade que falta comprar.
function gerarListaComprasWhatsApp(estoque, itens, unidadeInfo) {
  const abaixo = itens.filter(i => {
    const min = Number(i.estoque_minimo);
    return Number.isFinite(min) && min > 0 && (Number(i.quantidade_atual) || 0) < min;
  });
  const lista = abaixo.length ? abaixo : itens;
  let txt = `*LISTA DE COMPRAS*\n`;
  txt += `${estoque?.nome || "Estoque"} - ${unidadeInfo?.nome || "Restaurante"}\n`;
  txt += `${new Date().toLocaleDateString("pt-BR")}\n`;
  txt += `----------------------------------\n\n`;
  const porForn = new Map();
  for (const i of lista) {
    const f = (i.fornecedor && String(i.fornecedor).trim()) || "Sem fornecedor definido";
    if (!porForn.has(f)) porForn.set(f, []);
    porForn.get(f).push(i);
  }
  for (const [forn, arr] of porForn.entries()) {
    txt += `*${forn}*\n`;
    for (const i of arr) {
      const min = Number(i.estoque_minimo) || 0;
      const atual = Number(i.quantidade_atual) || 0;
      const falta = min > atual ? min - atual : 0;
      const un = mostrarUn(i.unidade_medida);
      const tam = Number(i.tamanho_embalagem) || 1;
      const valor = Number(i.custo_compra ?? i.custo_unitario) || 0;
      const marca = i.marca ? ` (${i.marca})` : "";
      txt += `- ${i.nome}${marca}`;
      if (falta > 0) txt += ` — comprar ~${fmtQtd(falta)} ${un}`;
      if (valor > 0) txt += ` — ${fmtBRL(valor)} (${tam > 1 ? `${fmtQtd(tam)} ${un}` : un})`;
      txt += `\n`;
    }
    txt += `\n`;
  }
  txt += abaixo.length ? `${abaixo.length} item(ns) abaixo do mínimo.` : `Nenhum item abaixo do mínimo — lista completa do estoque.`;
  return txt;
}

function imprimirRelatorio(estoque, itens, unidadeInfo) {
  const totalValor = itens.reduce((soma, i) => soma + (calcularValorItem(i) || 0), 0);
  const mapa = new Map();
  for (const item of itens) {
    const cat = item.categoria || "Sem categoria";
    if (!mapa.has(cat)) mapa.set(cat, []);
    mapa.get(cat).push(item);
  }
  const cats = Array.from(mapa.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));

  let rowsHtml = "";
  for (const cat of cats) {
    const list = mapa.get(cat).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    const subtotal = list.reduce((s, i) => s + (calcularValorItem(i) || 0), 0);
    rowsHtml += `
      <tr style="background:#f1f5f9; font-weight:bold;">
        <td colSpan="7" style="padding: 8px 12px; border-bottom: 2px solid #cbd5e1;">
          ${cat.toUpperCase()} (${list.length} itens) — Subtotal: ${fmtBRL(subtotal)}
        </td>
      </tr>
    `;
    for (const i of list) {
      const val = calcularValorItem(i);
      rowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px;"><strong>${i.nome || ""}</strong></td>
          <td style="padding: 8px 12px;">${i.categoria || "—"}</td>
          <td style="padding: 8px 12px;">${fmtBRL(i.custo_unitario || 0)}</td>
          <td style="padding: 8px 12px; font-weight:bold;">${fmtQtd(i.quantidade_atual)} ${mostrarUn(i.unidade_medida)}</td>
          <td style="padding: 8px 12px; font-weight:bold; color:#047857;">${fmtBRL(val)}</td>
          <td style="padding: 8px 12px;">${i.local_interno || "—"}</td>
          <td style="padding: 8px 12px;">${i.validade ? fmtData(i.validade) : "—"}</td>
        </tr>
      `;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório de Estoque - ${estoque?.nome || ""}</title>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
        h1 { margin: 0 0 4px 0; font-size: 22px; }
        p { margin: 0 0 16px 0; color: #64748b; font-size: 13px; }
        .header { border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
        th { background: #0f172a; color: white; text-align: left; padding: 10px 12px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${unidadeInfo?.nome || "Restaurante"} — Relatório de Estoque</h1>
          <p>Área: <strong>${estoque?.nome || "Estoque"}</strong> · Emitido em: ${new Date().toLocaleString("pt-BR")}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:12px; margin-bottom:2px; color:#64748b;">VALOR TOTAL DA ÁREA</p>
          <h2 style="margin:0; font-size:22px; color:#047857;">${fmtBRL(totalValor)}</h2>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Produto</th><th>Categoria</th><th>Custo un.</th><th>Saldo</th><th>Valor Total</th><th>Local</th><th>Validade</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }
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
  const router = useRouter();
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

  // Modo quiosque: o tablet fica no salão, à vista de todos. Custo e valor de
  // estoque são informação de gestão — quem faz contagem não precisa deles, e
  // deixá-los na tela expõe a margem da casa a qualquer um que passe.
  //
  // Fica no localStorage porque o tablet recarrega sozinho (service worker,
  // queda de rede) e voltar do quiosque sem querer mostraria tudo de novo.
  const [quiosque, setQuiosque] = useState(false);
  useEffect(() => {
    try { setQuiosque(localStorage.getItem("erp_estoque_quiosque") === "1"); } catch {}
  }, []);
  const definirQuiosque = (ligado) => {
    setQuiosque(ligado);
    try { localStorage.setItem("erp_estoque_quiosque", ligado ? "1" : "0"); } catch {}
  };

  // Uma função só para todo dinheiro da tela: esconder valor em quinze lugares
  // na mão deixaria um esquecido, e o esquecido é justamente o que aparece.
  const dinheiro = (valor) => (quiosque ? "—" : fmtBRL(valor));
  const [filtros, setFiltros] = useState({ busca: "", grupo: "Todos", categoria: "Todas", status: "todos", local: "Todos" });
  const [agruparPor, setAgruparPor] = useState("categoria");   // categoria | local
  const [modal, setModal] = useState(null);
  // Produto que não existe ainda: cadastra pelo próprio estoque.
  const [novoProduto, setNovoProduto] = useState(null);
  // Categorias criadas pela unidade, por departamento. As embutidas ficam no
  // código; estas moram em config_sistema.params.
  const [categoriasCriadas, setCategoriasCriadas] = useState({});
  const [novaCategoria, setNovaCategoria] = useState("");

  // Lista final: as embutidas do departamento mais as que a unidade criou.
  const categoriasDisponiveis = (estoque) => {
    const dept = departamentoDoEstoque(estoque);
    return mesclarCategorias(categoriasDoEstoque(estoque), categoriasCriadas[dept] || []);
  };

  async function criarCategoria(estoque) {
    const nome = String(novaCategoria || "").trim();
    if (!nome) return;
    const dept = departamentoDoEstoque(estoque);
    if (!dept) return avisar("Escolha um estoque de bar ou cozinha.", "erro");
    if (categoriasDisponiveis(estoque).some(x => x.toLowerCase() === nome.toLowerCase())) {
      setNovaCategoria("");
      return avisar("Essa categoria já existe.", "erro");
    }
    const mapa = { ...categoriasCriadas, [dept]: [...(categoriasCriadas[dept] || []), nome] };
    const res = await salvarCategoriasCriadas(unidadeAtiva, mapa);
    if (res.error) return avisar(res.error, "erro");
    setCategoriasCriadas(res.data || mapa);
    setNovoProduto(p => (p ? { ...p, categoria: nome } : p));
    setNovaCategoria("");
    avisar(`Categoria "${nome}" criada.`);
  }

  async function excluirCategoria(estoque, nome) {
    const dept = departamentoDoEstoque(estoque);
    // Embutida não sai: o código de relatório ainda a menciona, e apagá-la
    // deixaria itens apontando para uma categoria que não existe mais.
    if (ehEmbutida(nome, categoriasDoEstoque(estoque))) {
      return avisar("Categoria da casa não pode ser excluída.", "erro");
    }
    const emUso = await contarItensNaCategoria(unidadeAtiva, dept, nome);
    if (emUso > 0) {
      return avisar(`${emUso} produto(s) ainda usam "${nome}". Reclassifique antes de excluir.`, "erro");
    }
    if (!confirm(`Excluir a categoria "${nome}"?`)) return;
    const mapa = { ...categoriasCriadas, [dept]: (categoriasCriadas[dept] || []).filter(x => x !== nome) };
    const res = await salvarCategoriasCriadas(unidadeAtiva, mapa);
    if (res.error) return avisar(res.error, "erro");
    setCategoriasCriadas(res.data || mapa);
    setNovoProduto(p => (p && p.categoria === nome ? { ...p, categoria: "Sem categoria" } : p));
    avisar(`Categoria "${nome}" excluída.`);
  }
  const [modalZerar, setModalZerar] = useState(null);
  // Limites e unidade de medida afetam reposição e contagem. Por isso ficam
  // atrás do PIN do gerente — o mesmo de Configurações, 1234 de fábrica.
  const [pinGerente, setPinGerente] = useState("1234");
  const [unidadeLiberada, setUnidadeLiberada] = useState(false);
  const [pinDigitado, setPinDigitado] = useState(null); // null = não está pedindo
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
        return s.includes("cozinha") || t === "alimentos" || s === "embalagens";
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
    // Extras são prestadores eventuais: não aparecem como responsáveis pelo estoque.
    setColaboradores((resColabs.data || []).filter(c => c.tipo_contrato !== "Freelancer"));

    const preferencia = (searchParams.get("dept") || searchParams.get("modulo") || "").toLowerCase();

    let disponiveis = todosEstoques;
    if (preferencia.includes("cozinha")) {
      disponiveis = todosEstoques.filter(e => {
        const s = (e.slug || e.nome || "").toLowerCase();
        const t = (e.tipo || "").toLowerCase();
        return s.includes("cozinha") || t === "alimentos" || s === "embalagens";
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
    const ehEstoqueEmbalagem = /embalage/i.test(`${estoqueAtual?.slug || ""} ${estoqueAtual?.nome || ""}`);
    const [resItens, resMovimentos, resProntos, resEmbalagens] = await Promise.all([
      fetchItensEstoque(estoqueId, unidadeAtiva),
      fetchMovimentosMulti(unidadeAtiva, estoqueId),
      fetchNomesDePratosEDrinks(unidadeAtiva),
      ehEstoqueEmbalagem ? fetchEmbalagens(unidadeAtiva) : Promise.resolve({ data: [] }),
    ]);
    // Prato e drink montados na hora não têm saldo para contar: quem tem é o
    // ingrediente e o pré-preparo, que fica no estoque próprio dele. Comprado
    // pronto (cerveja, refrigerante) continua na lista, porque é estoque mesmo.
    const prontos = new Set(resProntos.data || []);
    // No estoque de embalagens só entra o que está cadastrado como embalagem.
    // Sem isso, produto do bar que foi vinculado ali por engano ficava na lista
    // e a contagem virava 93 itens de cerveja num estoque de pote e saco.
    const nomesEmbalagem = new Set(
      (resEmbalagens.data || []).map(e => String(e.nome || "").trim().toLowerCase()).filter(Boolean),
    );
    const idsEmbalagem = new Set(
      (resEmbalagens.data || []).map(e => e.insumo_id).filter(Boolean),
    );
    setItens((resItens.data || []).filter(item => {
      const nome = String(item.nome || item.insumo?.nome || "").trim().toLowerCase();
      if (prontos.has(nome)) return false;
      if (!ehEstoqueEmbalagem) return true;
      const dept = String(item.departamento || item.insumo?.departamento || "").toLowerCase();
      return dept.startsWith("embalage") || idsEmbalagem.has(item.insumo_id) || nomesEmbalagem.has(nome);
    }));
    setMovimentos(resMovimentos.data || []);
    if (resItens.error || resMovimentos.error) setErro(resItens.error || resMovimentos.error);
    setLoading(false);
  }, [estoqueId, unidadeAtiva, estoqueAtual]);

  useEffect(() => { carregarEstoques(); }, [carregarEstoques]);
  useEffect(() => { carregarArea(); }, [carregarArea]);
  useEffect(() => {
    if (unidadeAtiva) fetchPins(unidadeAtiva).then(r => setPinGerente(r.data?.pin_gerente || "1234")).catch(() => {});
    if (unidadeAtiva) fetchCategoriasCriadas(unidadeAtiva).then(r => setCategoriasCriadas(r.data || {})).catch(() => {});
  }, [unidadeAtiva]);
  useEffect(() => {
    setFiltros(atuais => ({ ...atuais, grupo: "Todos", categoria: "Todas", status: "todos", local: "Todos" }));
  }, [estoqueId]);

  const avisar = (mensagem, tipo = "sucesso") => {
    if (tipo === "erro") setErro(mensagem);
    else setSucesso(mensagem);
    window.setTimeout(() => tipo === "erro" ? setErro("") : setSucesso(""), 4500);
  };

  const atualizarTudo = async () => {
    await Promise.all([carregarArea(), carregarEstoques(estoqueId)]);
  };

  // Zerar não tem desfazer, então exige digitar ZERAR. Um confirm() se clica
  // por reflexo; digitar a palavra obriga a ler o que está escrito antes.
  const confirmarZerar = async () => {
    if (String(modalZerar?.confirmacao || "").trim().toUpperCase() !== "ZERAR") {
      avisar("Digite ZERAR para confirmar.", "erro");
      return;
    }
    const alvos = (modalZerar?.alvos || []).length ? modalZerar.alvos : [estoqueAtual?.id];
    const escolhidos = estoquesVisiveis.filter(e => alvos.includes(e.id));
    if (!escolhidos.length) { avisar("Escolha pelo menos um estoque.", "erro"); return; }
    setModalZerar(m => ({ ...m, salvando: true }));

    const resumo = [];
    for (const estoque of escolhidos) {
      const resposta = await zerarEstoque({
        unidadeId: unidadeAtiva,
        estoqueId: estoque.id,
        usuarioId: idUsuario(sessao),
        usuarioNome: nomeUsuario(sessao),
        motivo: String(modalZerar?.motivo || "").trim(),
      });
      resumo.push({ nome: estoque.nome, ...(resposta.data || {}), erro: resposta.error });
    }
    setModalZerar(null);

    const comErro = resumo.filter(r => r.erro);
    if (comErro.length) {
      avisar(`Não consegui zerar: ${comErro.map(r => `${r.nome} (${r.erro})`).join(" · ")}`, "erro");
    } else {
      const comFalha = resumo.filter(r => r.falhas > 0);
      avisar(`${resumo.map(r => `${r.nome}: ${r.zerados} de ${r.total} com saldo`).join(" · ")}. `
        + (comFalha.length
          ? `Atenção: ${comFalha.reduce((s, r) => s + r.falhas, 0)} baixa(s) não entraram no histórico.`
          : "Cada baixa está no histórico."));
    }
    await atualizarTudo();
  };

  // Cadastrar sem sair do estoque: o produto nasce no catálogo de ingredientes
  // e já entra vinculado a este estoque, pronto para receber a entrada.
  //
  // O departamento vinha do slug do estoque, então quem cadastrasse pelo
  // "Pré-preparos da Cozinha" criava um ingrediente de departamento
  // "pre-preparos-cozinha" — que não existe em lugar nenhum e sumia da lista de
  // ingredientes. Aqui o estoque é traduzido para o setor de verdade.
  const cadastrarProdutoAqui = async () => {
    const nome = String(novoProduto?.nome || "").trim();
    if (!nome) { avisar("Escreva o nome do produto.", "erro"); return; }
    if (!estoqueAtual?.id) { avisar("Abra um estoque primeiro.", "erro"); return; }
    setNovoProduto(p => ({ ...p, salvando: true }));
    const custo = Number(String(novoProduto.custo ?? "").replace(",", ".")) || 0;
    const criado = await salvarInsumo({
      unidade_id: unidadeAtiva, departamento: departamentoDoEstoque(estoqueAtual),
      nome, nome_original: nome,
      unidade_medida: novoProduto.unidade || "un",
      // O volume da embalagem vinha fixo em 1, então todo produto cadastrado
      // por aqui nascia sem volume — e a tela do tablet não tinha o que
      // mostrar, nem a ficha técnica o que dividir.
      tamanho_embalagem: Number(String(novoProduto.volume ?? "").replace(",", ".")) || 1,
      unidade_comercial: novoProduto.unidadeComercial || null,
      categoria: novoProduto.categoria || "Sem categoria",
      // Mínimo e máximo já dava para editar depois, mas não na hora de
      // cadastrar — e item que nasce sem mínimo nunca aparece no alerta de
      // "abaixo do mínimo". Ninguém volta para preencher o que não faltou.
      estoque_minimo: Number(String(novoProduto.minimo ?? "").replace(",", ".")) || null,
      estoque_maximo: Number(String(novoProduto.maximo ?? "").replace(",", ".")) || null,
      custo_unitario: custo, custo_compra: custo, ativo: true,
    }, { origem: `Cadastro pelo estoque ${estoqueAtual.nome}` });
    if (criado.error || !criado.id) {
      setNovoProduto(p => ({ ...p, salvando: false }));
      avisar(criado.error || "Não consegui cadastrar o produto.", "erro");
      return;
    }
    const vinculo = await vincularItemEstoque({
      unidadeId: unidadeAtiva, estoqueId: estoqueAtual.id, insumoId: criado.id,
      custoUnitario: custo, local: novoProduto.local || null,
    });
    setNovoProduto(null);
    if (vinculo.error) { avisar(vinculo.error, "erro"); return; }
    setOperacao(o => ({ ...o, insumo_id: criado.id }));
    avisar(`${nome} cadastrado e já disponível neste estoque.`);
    await atualizarTudo();
  };

  // Muda o produto de lugar dentro do estoque (depósito, expositor, balcão).
  const realocarItem = async (item, local) => {
    const { error } = await realocarItemEstoque(item.id, local);
    if (error) { avisar(error, "erro"); return; }
    avisar(local ? `${item.nome} agora fica em ${local}.` : `${item.nome} ficou sem lugar definido.`);
    await carregarArea();
  };

  // Responsáveis da área do estoque aberto — regra única do ERP:
  // sem extras, cada um no seu setor e liderança em todos.
  const colaboradoresFiltrados = useMemo(
    () => equipeDaArea(colaboradores, estoqueAtual?.nome || estoqueAtual?.slug || ""),
    [colaboradores, estoqueAtual]);

  const catalogoFiltradoPorArea = useMemo(() => {
    if (!catalogo?.length) return [];
    if (!estoqueAtual) return catalogo;

    const slug = (estoqueAtual.slug || estoqueAtual.nome || "").toLowerCase();
    const tipo = (estoqueAtual.tipo || "").toLowerCase();

    // Depósito é o estoque geral da casa: aceita tudo, ingrediente ou material.
    if (slug.includes("deposito") || slug.includes("depósito")) return catalogo;

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
        if (dept.includes("cozinha") || dept.includes("alimento")) return false;
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
    if (!estoqueAtual) return itens || [];

    const mapa = new Map();
    // 1. Adiciona todos os insumos do catálogo cadastrados para a área (Bar, Cozinha, etc.)
    for (const insumo of catalogoFiltradoPorArea || []) {
      if (!insumo) continue;
      const catResolvida = grupoOperacionalItem(insumo, estoqueAtual);
      const ehEstoqueBar = (estoqueAtual.slug || estoqueAtual.nome || "").toLowerCase().includes("bar");
      let unMed = insumo.unidade_medida;
      if (ehEstoqueBar && (unMed === "kg" || unMed === "g" || !unMed)) {
        unMed = (Number(insumo.tamanho_embalagem) >= 10) ? "ml" : "l";
      }

      mapa.set(insumo.id, {
        id: insumo.id,
        insumo_id: insumo.id,
        estoque_id: estoqueAtual.id,
        nome: insumo.nome,
        codigo_interno: insumo.codigo_interno,
        marca: insumo.marca,
        categoria: catResolvida,
        departamento: insumo.departamento,
        unidade_medida: unMed,
        tamanho_embalagem: insumo.tamanho_embalagem || 1,
        unidade_comercial: insumo.unidade_comercial || (["ml", "l"].includes(String(unMed).toLowerCase()) ? "garrafa" : unMed),
        custo_unitario: Number(insumo.custo_compra ?? insumo.custo_unitario) || 0,
        quantidade_atual: Number(insumo.quantidade_atual) || 0,
        estoque_minimo: insumo.estoque_minimo || null,
        estoque_maximo: insumo.estoque_maximo || null,
        validade: insumo.validade || null,
        ultima_movimentacao_em: insumo.updated_at || insumo.created_at,
        insumo: insumo,
      });
    }

    // 2. Sobrescreve com saldos ou metadados específicos da tabela estoque_itens (se existirem)
    for (const item of itens || []) {
      if (!item) continue;
      const insumoId = item.insumo_id || item.id;
      const insumo = item.insumo || catalogo.find(i => i.id === insumoId) || item;
      const catResolvida = grupoOperacionalItem(item, estoqueAtual) || grupoOperacionalItem(insumo, estoqueAtual);

      const ehEstoqueBar = (estoqueAtual.slug || estoqueAtual.nome || "").toLowerCase().includes("bar");
      let unMed = item.unidade_medida || insumo.unidade_medida;
      if (ehEstoqueBar && (unMed === "kg" || unMed === "g" || !unMed)) {
        unMed = (Number(item.tamanho_embalagem || insumo.tamanho_embalagem) >= 10) ? "ml" : "l";
      }

      mapa.set(insumoId, {
        ...insumo,
        ...item,
        id: item.id || insumoId,
        insumo_id: insumoId,
        estoque_id: estoqueAtual.id,
        nome: item.nome || insumo.nome,
        codigo_interno: item.codigo_interno || insumo.codigo_interno,
        marca: item.marca || insumo.marca,
        categoria: catResolvida,
        unidade_medida: unMed,
        tamanho_embalagem: item.tamanho_embalagem || insumo.tamanho_embalagem || 1,
        unidade_comercial: item.unidade_comercial || insumo.unidade_comercial,
        custo_unitario: Number(item.custo_unitario ?? insumo.custo_compra ?? insumo.custo_unitario) || 0,
        quantidade_atual: Number(item.quantidade_atual ?? insumo.quantidade_atual) || 0,
        estoque_minimo: item.estoque_minimo ?? insumo.estoque_minimo ?? null,
        estoque_maximo: item.estoque_maximo ?? insumo.estoque_maximo ?? null,
      });
    }

    return Array.from(mapa.values());
  }, [catalogoFiltradoPorArea, itens, estoqueAtual, catalogo]);

  const grupos = useMemo(() => gruposOperacionaisEstoque(estoqueAtual), [estoqueAtual]);
  const contagemGrupos = useMemo(() => Object.fromEntries(grupos.map(grupo => [
    grupo,
    grupo === "Todos"
      ? itensDaArea.length
      : itensDaArea.filter(item => grupoOperacionalItem(item, estoqueAtual) === grupo).length,
  ])), [grupos, itensDaArea, estoqueAtual]);
  const categorias = useMemo(() => ["Todas", ...[...new Set(itensDaArea.map(i => i.categoria || "Sem categoria"))].sort((a, b) => a.localeCompare(b, "pt-BR"))], [itensDaArea]);
  // Junta os lugares cadastrados no estoque com os que os itens já usam: o
  // filtro precisa mostrar "Balcão refrigerado" mesmo antes de ter algo lá.
  const locais = useMemo(() => {
    const cadastrados = (estoqueAtual?.locais_internos || []).map(String).filter(Boolean);
    const usados = [...new Set(itensDaArea.map(i => i.local_interno).filter(Boolean))]
      .filter(l => !cadastrados.includes(l))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["Todos", ...cadastrados, ...usados];
  }, [itensDaArea, estoqueAtual]);
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

  // Cálculo do CMV das Contagens (impacto financeiro de perdas/ajustes físicos)
  const resumoContagens = useMemo(() => {
    const movsContagem = (movimentos || []).filter(m => m.tipo === "contagem");
    let cmvPerdaTotal = 0;
    let cmvSobraTotal = 0;
    let totalContagens = movsContagem.length;
    let itensComDivergencia = 0;

    movsContagem.forEach(m => {
      const ins = m.insumo || itensDaArea.find(i => (i.insumo_id === m.insumo_id || i.id === m.insumo_id));
      const custo = Number(ins?.preco_normalizado || ins?.custo_unitario || ins?.insumo?.preco_normalizado || 0);
      const anterior = Number(m.saldo_anterior ?? m.quantidade_anterior ?? 0);
      const contado = Number(m.saldo_posterior ?? m.quantidade ?? 0);
      const diff = contado - anterior;
      if (Math.abs(diff) > 0.0001) {
        itensComDivergencia++;
        if (diff < 0) {
          cmvPerdaTotal += Math.abs(diff) * custo;
        } else {
          cmvSobraTotal += diff * custo;
        }
      }
    });

    const cmvLiquidoAjustes = cmvPerdaTotal - cmvSobraTotal;
    return {
      cmvPerdaTotal,
      cmvSobraTotal,
      cmvLiquidoAjustes,
      totalContagens,
      itensComDivergencia,
    };
  }, [movimentos, itensDaArea]);

  // ── CONTAGEM POR VOZ ────────────────────────────────────────────────────
  // "banana cinco quilos, tomate três caixas, arroz dez" — a pessoa dita o
  // inventário inteiro e confere na tela antes de gravar.
  const [vozAberta, setVozAberta] = useState(false);
  const [vozOuvindo, setVozOuvindo] = useState(false);
  const [vozTexto, setVozTexto] = useState("");
  const [vozLendo, setVozLendo] = useState(false);
  const [vozItens, setVozItens] = useState([]);      // [{ item, quantidade, nomeFalado }]
  const [vozNaoAchados, setVozNaoAchados] = useState([]);
  const [vozErro, setVozErro] = useState("");
  const [vozSalvando, setVozSalvando] = useState(false);
  const escutaRef = useRef(null);

  const semAcento = (v) => {
    const d = String(v || "").normalize("NFD");
    let out = "";
    for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
    return out.toLowerCase().trim();
  };

  const acharItemPorNome = (nome) => {
    const alvo = semAcento(nome);
    if (!alvo) return null;
    const lista = itensDaArea || [];
    return lista.find(i => semAcento(i.nome) === alvo)
      || lista.find(i => semAcento(i.nome).startsWith(alvo))
      || lista.find(i => semAcento(i.nome).includes(alvo))
      || lista.find(i => alvo.includes(semAcento(i.nome)));
  };

  const interpretarContagemFalada = async (texto) => {
    setVozLendo(true);
    setVozErro("");
    try {
      const r = await fetch("/api/ia-contagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const dados = await r.json();
      if (!r.ok || !dados?.itens?.length) {
        setVozErro(dados?.error || "Não consegui separar os itens. Diga assim: banana cinco quilos, tomate três caixas.");
        return;
      }
      const achados = [];
      const perdidos = [];
      dados.itens.forEach(linha => {
        const item = acharItemPorNome(linha.nome);
        if (item) achados.push({ item, quantidade: Number(linha.quantidade) || 0, nomeFalado: linha.nome });
        else perdidos.push(`${linha.nome} (${linha.quantidade})`);
      });
      setVozItens(a => [...a, ...achados]);
      setVozNaoAchados(perdidos);
      if (!achados.length) setVozErro("Nenhum produto falado existe neste estoque. Cadastre antes de contar.");
    } catch {
      setVozErro("Sem conexão para interpretar a contagem.");
    } finally {
      setVozLendo(false);
    }
  };

  const iniciarContagemVoz = () => {
    if (!vozDisponivel()) { setVozErro("Este navegador não reconhece voz. Use o Chrome no Android."); return; }
    if (vozOuvindo) { escutaRef.current?.parar(); return; }
    setVozErro(""); setVozTexto("");
    const sessao = criarEscuta({
      continuo: true,
      silencioMs: 4000,
      onParcial: t => setVozTexto(t),
      onFinal: t => { setVozTexto(t); interpretarContagemFalada(t); },
      onErro: e => { setVozErro(e); setVozOuvindo(false); },
      onFim: () => setVozOuvindo(false),
    });
    if (!sessao) { setVozErro("Não consegui acessar o microfone."); return; }
    escutaRef.current = sessao;
    setVozOuvindo(true);
    sessao.iniciar();
  };

  const gravarContagemVoz = async () => {
    if (!vozItens.length) return;
    if (!operacao.responsavel_id) { setVozErro("Escolha quem está fazendo a contagem."); return; }
    const colab = colaboradores.find(c => String(c.id) === String(operacao.responsavel_id));
    const nomeResp = colab ? `${colab.nome}${colab.cargo ? ` (${colab.cargo})` : ""}` : (nomeUsuario(sessao) || "Usuário do sistema");
    setVozSalvando(true);
    let ok = 0, falhas = 0;
    for (const linha of vozItens) {
      const r = await registrarContagemMulti({
        unidadeId: unidadeAtiva, estoqueId, insumoId: linha.item.insumo_id,
        saldoContado: linha.quantidade, usuarioId: colab?.id || idUsuario(sessao),
        usuarioNome: nomeResp, observacao: "Contagem ditada por voz",
      });
      if (r?.error) falhas += 1; else ok += 1;
    }
    setVozSalvando(false);
    setVozAberta(false);
    setVozItens([]); setVozTexto(""); setVozNaoAchados([]);
    avisar(`Contagem gravada: ${ok} item(ns)${falhas ? ` · ${falhas} falhou(aram)` : ""}.`, falhas ? "erro" : "sucesso");
    await atualizarTudo();
  };

  const abrirOperacao = (tipo, item = null) => {
    const frac = ehFracionavel(item);
    const div = frac ? dividirSaldo(item.quantidade_atual, conteudoDe(item), true) : null;
    const agoraStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setOperacao({
      insumo_id: item?.insumo_id || "",
      quantidade: tipo === "contagem" && !frac ? String(item?.quantidade_atual ?? "") : "",
      destino_id: "",
      observacao: "",
      responsavel_id: "",
      data: agoraStr,
      // Sempre começa em UNIDADE (peça inteira). Fracionar por conteúdo é a
      // exceção — quem vai servir dose escolhe na hora, sem vir marcado.
      modo: "unidade",
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

      // Quem está lançando/retirando é obrigatório — conferido ANTES de criar
      // qualquer vínculo, para não deixar registro órfão se o campo faltar.
      if (!operacao.responsavel_id) {
        avisar("Informe quem está lançando ou retirando o produto.", "erro");
        return;
      }

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

      // Conversão automática de unidade se o usuário digitou em g para item cadastrado em kg (ou ml para L)
      let qtdOperacao = operacao.quantidade;
      const unBase = String(item?.unidade_medida || "").toLowerCase();
      const unDig = String(operacao.unidade_digitada || unBase).toLowerCase();
      if (unBase === "kg" && unDig === "g") {
        qtdOperacao = String((Number(operacao.quantidade) || 0) / 1000);
      } else if (unBase === "l" && unDig === "ml") {
        qtdOperacao = String((Number(operacao.quantidade) || 0) / 1000);
      }

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
        resposta = await entradaBebidaUnidades({ ...bebArgs, unidades: qtdOperacao });
        if (resposta?.error) resposta = await stdMov("entrada", (Number(qtdOperacao) || 0) * conteudoFrac);
      } else if (frac && modal?.tipo === "saida") {
        resposta = operacao.modo === "unidade"
          ? await baixaBebidaUnidades({ ...bebArgs, unidades: qtdOperacao })
          : await baixaBebidaConteudo({ ...bebArgs, quantidade: qtdOperacao });
        if (resposta?.error) resposta = await stdMov("saida", operacao.modo === "unidade" ? (Number(qtdOperacao) || 0) * conteudoFrac : (Number(qtdOperacao) || 0));
      } else if (frac && modal?.tipo === "contagem") {
        resposta = await contagemBebida({ ...bebArgs, fechadas: operacao.fechadas, aberto: operacao.aberto });
        if (resposta?.error) resposta = await registrarContagemMulti({ unidadeId, estoqueId, insumoId: item?.insumo_id, saldoContado: (Number(operacao.fechadas) || 0) * conteudoFrac + (Number(operacao.aberto) || 0), usuarioId: usuarioIdFinal, usuarioNome: responsavelNome, observacao: operacao.observacao });
      } else if (modal?.tipo === "contagem") {
        resposta = await registrarContagemMulti({
          unidadeId, estoqueId, insumoId: item?.insumo_id,
          saldoContado: qtdOperacao, usuarioId: usuarioIdFinal,
          usuarioNome: responsavelNome, observacao: operacao.observacao,
        });
      } else if (modal?.tipo === "transferencia") {
        resposta = await transferirEntreEstoques({
          unidadeId, estoqueOrigem: estoqueAtual,
          estoqueDestino: estoques.find(i => i.id === operacao.destino_id),
          item, quantidade: qtdOperacao, usuarioId: usuarioIdFinal,
          usuarioNome: responsavelNome, observacao: operacao.observacao,
        });
      } else {
        resposta = await registrarMovimentoMulti({
          unidadeId, estoqueId, insumoId: item?.insumo_id,
          tipo: modal?.tipo, quantidade: qtdOperacao,
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

  // Zero salvo no banco entrava no campo como "0" e travava a digitação: para
  // escrever 12 era preciso apagar o zero antes, e em teclado de celular isso
  // quase nunca dá certo. Zero vira campo vazio com o placeholder mostrando 0 —
  // o valor gravado continua o mesmo se ninguém digitar nada.
  const abrirEdicaoItem = item => {
    // A liberação vale para UMA edição. Abrir outro item pede o PIN de novo,
    // senão bastaria destravar uma vez para trocar a unidade do estoque todo.
    setUnidadeLiberada(false);
    setPinDigitado(null);
    const semZero = (valor) => (valor == null || Number(valor) === 0 ? "" : valor);
    setFormItem({
      ...item,
      estoque_minimo: semZero(item.estoque_minimo),
      estoque_maximo: semZero(item.estoque_maximo),
      custo_unitario: semZero(item.custo_unitario),
    });
    setModal({ tipo: "item", item });
  };

  const salvarConfiguracaoItem = async event => {
    event.preventDefault();
    const minimo = Number(formItem.estoque_minimo || 0);
    const maximo = Number(formItem.estoque_maximo || 0);
    if (minimo > 0 && maximo > 0 && maximo < minimo) {
      return avisar("O estoque máximo não pode ser menor que o mínimo.", "erro");
    }
    setSalvando(true);
    const resposta = await atualizarItemEstoque(formItem.estoque_item_id, formItem);
    // Unidade comercial e "permite fracionado" ficam no insumo (valem p/ todos
    // os estoques do produto). Só grava se algum mudou.
    if (formItem.insumo_id) {
      await salvarInsumo({
        id: formItem.insumo_id, unidade_id: unidadeAtiva, nome: formItem.nome,
        unidade_comercial: formItem.unidade_comercial || null,
        permite_fracionado: formItem.permite_fracionado !== false,
        // A unidade só vai junto se o gerente destravou nesta edição. Mandar
        // sempre arriscaria regravar por acidente o valor que já estava lá.
        ...(unidadeLiberada && formItem.unidade_medida
          ? { unidade_medida: String(formItem.unidade_medida).toLowerCase() }
          : {}),
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
          <div className="flex flex-wrap gap-2">
            {/* Sair do quiosque pede o PIN do gerente: o modo existe justamente
                para quem está no salão não ver custo, e um botão livre de
                desligar não esconderia nada. */}
            {quiosque ? (
              <button
                onClick={() => {
                  const pin = prompt("PIN do gerente para mostrar os valores:");
                  if (pin === null) return;
                  if (pin === String(pinGerente)) definirQuiosque(false);
                  else avisar("PIN incorreto.", "erro");
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-black text-slate-600 hover:bg-slate-50"
                title="Valores ocultos — PIN do gerente para mostrar">
                <Lock size={18} /> Valores ocultos
              </button>
            ) : (
              <>
                <button onClick={() => definirQuiosque(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold hover:bg-slate-50"
                  title="Esconde custo e valor de estoque — para o tablet no salão">
                  <Lock size={18} /> Modo quiosque
                </button>
                <button onClick={() => router.push("/dashboard/operacao/estoque")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-black text-white shadow-sm hover:bg-indigo-700">
                  <Tablet size={18} /> Voltar ao Estoque
                </button>
                <button onClick={() => abrirEdicaoEstoque(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold hover:bg-slate-50">
                  <Settings2 size={18} /> Gerenciar estoques
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-7">
        {(erro || sucesso) && (
          <div className={`fixed right-4 top-4 z-[150] max-w-sm rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-xl ${erro ? "bg-red-600" : "bg-emerald-700"}`}>
            {erro || sucesso}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-2 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Setores de Estoque</p>
              <p className="text-xs text-slate-400">Selecione o estoque para visualizar os saldos</p>
            </div>
            <button onClick={() => abrirEdicaoEstoque(estoqueAtual)} disabled={!estoqueAtual} className="text-xs font-bold text-emerald-700 hover:underline">
              Editar Área
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {estoquesVisiveis.map(estoque => {
              const isSelected = estoque.id === estoqueId;
              return (
                <button
                  key={estoque.id}
                  type="button"
                  onClick={() => setEstoqueId(estoque.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                  } ${estoque.status !== "ativo" ? "opacity-55" : ""}`}
                >
                  <div className={`grid h-6 w-6 place-items-center rounded-md ${isSelected ? "bg-white/20 text-emerald-400" : "bg-slate-200 text-slate-600"}`}>
                    <Warehouse size={14} />
                  </div>
                  <span>{estoque.nome}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {estoque.itens || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {estoqueAtual && (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: estoqueAtual.cor || "#047857" }} />
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">{estoqueAtual.nome}</h2>
                  <span className="text-[11px] font-bold text-slate-500">{itensDaArea.length} produtos cadastrados</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button disabled={!ativo} onClick={() => abrirOperacao("entrada")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-700 shadow-sm disabled:opacity-40 transition-all active:scale-95 cursor-pointer">
                  <PackagePlus size={16} /> Nova entrada
                </button>
                <button disabled={!ativo || !itens.length} onClick={() => abrirOperacao("saida")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-extrabold text-white hover:bg-slate-800 shadow-sm disabled:opacity-40 transition-all active:scale-95 cursor-pointer">
                  <PackageMinus size={16} /> Nova baixa
                </button>
                <button disabled={!ativo || !itens.length} onClick={() => abrirOperacao("contagem")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer">
                  <ClipboardCheck size={16} className="text-emerald-600" /> Contagem
                </button>
                <button disabled={!ativo || !itens.length} onClick={() => { setVozAberta(true); setVozItens([]); setVozTexto(""); setVozErro(""); setVozNaoAchados([]); }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-3.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 transition-all cursor-pointer">
                  <Mic size={16} /> Contagem por voz
                </button>
                <button disabled={!ativo || !itens.length || !destinosCompativeis.length} onClick={() => abrirOperacao("transferencia")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer">
                  <ArrowRightLeft size={16} className="text-indigo-600" /> Transferência
                </button>
                <button disabled={!ativo} onClick={() => setModal({ tipo: "importar" })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer">
                  <Upload size={16} className="text-teal-600" /> Importar
                </button>
                <button disabled={!itens.length} onClick={() => setModal({ tipo: "exportar_relatorio" })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 transition-all cursor-pointer">
                  <FileText size={16} /> Relatórios / WhatsApp
                </button>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {[
                { icon: Package, label: "Valor no Estoque", value: dinheiro(valorTotal), oculto: quiosque, color: "text-emerald-700 bg-emerald-50", action: () => { setAba("atual"); setFiltros(f => ({ ...f, busca: "", status: "todos", grupo: "Todos", tempBar: "todos_temp", estadoCozinha: "todos_estado" })); } },
                { icon: ClipboardCheck, label: "CMV de Contagens", value: dinheiro(resumoContagens.cmvLiquidoAjustes), oculto: quiosque, color: "text-sky-700 bg-sky-50", action: () => setAba("movimentacoes") },
                { icon: AlertTriangle, label: "Abaixo do Mínimo", value: `${itensDaArea.filter(i => statusItemEstoque(i, estoqueAtual).abaixoMinimo).length} itens`, color: "text-red-700 bg-red-50", action: () => { setAba("alertas"); setFiltros(f => ({ ...f, status: "abaixo" })); } },
                { icon: CalendarDays, label: "Validades Próximas", value: estoqueAtual.controla_validade ? `${itensDaArea.filter(i => statusItemEstoque(i, estoqueAtual).validadeProxima).length} itens` : "Desativado", color: "text-amber-700 bg-amber-50", action: () => { setAba("alertas"); setFiltros(f => ({ ...f, status: "validade" })); } },
                { icon: Boxes, label: "Resumo da Área", value: `${itensDaArea.length} produtos`, color: "text-indigo-700 bg-indigo-50", action: () => { setAba("atual"); setFiltros(f => ({ ...f, busca: "", status: "todos", grupo: "Todos", tempBar: "todos_temp", estadoCozinha: "todos_estado" })); } },
              ].filter(cartao => !cartao.oculto).map(({ icon: Icon, label, value, color, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xs transition-all hover:border-slate-300 hover:shadow-sm active:scale-95 cursor-pointer"
                >
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black ${color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">{label}</p>
                    <strong className="text-sm font-black text-slate-900 leading-tight block truncate">{value}</strong>
                  </div>
                </button>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="grid grid-cols-2 gap-x-4 border-b border-slate-200 bg-slate-50/50 px-4 pt-1 sm:flex sm:gap-5 sm:overflow-x-auto sm:px-6">
                {[
                  ["atual", "Estoque atual"], ["historico", "Histórico completo"],
                  ["movimentacoes", "Movimentações"], ["alertas", `Alertas (${alertas.length})`],
                ].map(([id, label]) => (
                  <button key={id} onClick={() => setAba(id)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-xs font-black sm:py-3.5 sm:text-sm cursor-pointer ${aba === id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{label}</button>
                ))}
                {/* Entradas e saídas em forma de calendário, fora das abas. */}
                <button onClick={() => router.push("/dashboard/operacao/estoque/calendario")}
                  className="ml-auto whitespace-nowrap border-b-2 border-transparent px-1 py-3 text-xs font-black text-emerald-700 hover:text-emerald-800 sm:py-3.5 sm:text-sm">
                  Calendário
                </button>
                {/* Recomeço de contagem. Fica discreto de propósito: é a única
                    ação da tela que não tem desfazer. */}
                <button onClick={() => setModalZerar({ confirmacao: "", alvos: estoqueAtual?.id ? [estoqueAtual.id] : [], salvando: false })}
                  className="whitespace-nowrap border-b-2 border-transparent px-1 py-3 text-xs font-black text-slate-400 hover:text-red-600 sm:py-3.5 sm:text-sm">
                  Zerar estoque
                </button>
              </div>

              {aba === "atual" || aba === "alertas" ? (
                <>
                  <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
                    {grupos.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <span className="text-xs font-black text-slate-500 shrink-0">Grupo:</span>
                        {grupos.map(grupo => (
                          <button
                            key={grupo}
                            onClick={() => setFiltros(atuais => ({ ...atuais, grupo }))}
                            className={`shrink-0 rounded-lg px-3 py-1 text-xs font-black transition cursor-pointer ${filtros.grupo === grupo ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            {grupo} ({contagemGrupos[grupo] || 0})
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Bar Temperature / Cozinha Ready Food Quick Filter Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      {(estoqueAtual?.departamento === "bar" || estoqueAtual?.slug?.includes("bar") || estoqueAtual?.nome?.toLowerCase()?.includes("bar")) ? (
                        <>
                          <span className="text-xs font-black text-slate-500 mr-1">Temperatura Bar:</span>
                          {[
                            ["todos_temp", "Todos os Itens"],
                            ["apenas_gelado", "Gelados (Expositor)"],
                            ["apenas_quente", "Quentes (Depósito)"],
                          ].map(([id, label]) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setFiltros(atuais => ({ ...atuais, tempBar: id }))}
                              className={`rounded-lg px-3 py-1 text-xs font-black transition cursor-pointer ${(filtros.tempBar || "todos_temp") === id ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-black text-slate-500 mr-1">Estado Insumo/Comida:</span>
                          {[
                            ["todos_estado", "Todos os Itens"],
                            ["insumos", "Insumos Brutos"],
                            ["resfriados", "Resfriadas (Prontas)"],
                            ["congelados", "Congeladas (Prontas)"],
                          ].map(([id, label]) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setFiltros(atuais => ({ ...atuais, estadoCozinha: id }))}
                              className={`rounded-lg px-3 py-1 text-xs font-black transition cursor-pointer ${(filtros.estadoCozinha || "todos_estado") === id ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="erp-busca-fixa grid gap-3 p-4 lg:grid-cols-[1fr_180px_170px_160px] bg-slate-50/30">
                    <label className="relative flex items-center">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold z-10" size={18} />
                      <input
                        value={filtros.busca}
                        onChange={e => setFiltros({ ...filtros, busca: e.target.value })}
                        placeholder="Buscar por nome, marca ou código..."
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-xs font-bold text-slate-900 shadow-xs transition-all focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400"
                      />
                    </label>
                    <select value={filtros.categoria} onChange={e => setFiltros({ ...filtros, categoria: e.target.value })} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">{categorias.map(v => <option key={v}>{v}</option>)}</select>
                    <select value={filtros.status} onChange={e => setFiltros({ ...filtros, status: e.target.value })} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">
                      <option value="todos">Todos os status</option><option value="abaixo">Abaixo do mínimo</option><option value="validade">Validade próxima</option><option value="sem-saldo">Sem saldo</option>
                    </select>
                    <select value={filtros.local} onChange={e => setFiltros({ ...filtros, local: e.target.value })} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">{locais.map(v => <option key={v}>{v}</option>)}</select>
                    {/* Separar a lista por onde a coisa fica (expositor, balcão, depósito...) */}
                    {(estoqueAtual?.locais_internos || []).length > 0 && (
                      <select value={agruparPor} onChange={e => setAgruparPor(e.target.value)} className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-black text-emerald-800">
                        <option value="categoria">Separar por categoria</option>
                        <option value="local">Separar por lugar</option>
                      </select>
                    )}
                  </div>
                  <TabelaItens
                    itens={aba === "alertas" ? itensFiltrados.filter(i => alertas.some(a => a.id === i.id)) : itensFiltrados}
                    estoque={estoqueAtual} loading={loading} agruparPor={agruparPor}
                    dinheiro={dinheiro}
                    onEntrada={item => abrirOperacao("entrada", item)}
                    onSaida={item => abrirOperacao("saida", item)}
                    onEditar={abrirEdicaoItem}
                    onHistorico={item => setModal({ tipo: "historico_item", item })}
                  />
                </>
              ) : (
                <ListaMovimentos movimentos={movimentos} modo={aba} dinheiro={dinheiro} />
              )}
            </section>
          </>
        )}
      </main>

      {/* CONTAGEM POR VOZ: dita o inventário e confere antes de gravar */}
      {vozAberta && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => !vozSalvando && setVozAberta(false)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">Contagem por voz</h2>
                <p className="text-sm text-slate-500">Fale item e quantidade: “banana cinco quilos, tomate três caixas”.</p>
              </div>
              <button onClick={() => setVozAberta(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>

            <button onClick={iniciarContagemVoz} disabled={vozLendo || vozSalvando}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black transition-all disabled:opacity-60 ${
                vozOuvindo ? "bg-emerald-600 text-white" : "border-2 border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}>
              {vozOuvindo ? <><span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span> Ouvindo... toque para parar</>
                : vozLendo ? <><Loader2 size={19} className="animate-spin" /> Entendendo...</>
                : <><Mic size={19} /> Falar a contagem</>}
            </button>

            {vozTexto && <p className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm font-medium text-slate-700">{vozTexto}</p>}
            {vozErro && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{vozErro}</p>}
            {vozNaoAchados.length > 0 && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800">
                Não achei no estoque: {vozNaoAchados.join(", ")}. Cadastre o produto e conte de novo.
              </p>
            )}

            {vozItens.length > 0 && (
              <>
                <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-500">Confira antes de gravar</p>
                <div className="mt-2 space-y-2">
                  {vozItens.map((linha, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-black text-slate-800 truncate">{linha.item.nome}</p>
                        <p className="text-[12px] font-bold text-slate-400">saldo atual {fmtQtd(linha.item.quantidade_atual)} {mostrarUn(linha.item.unidade_medida)}</p>
                      </div>
                      <input type="number" step="0.001" min="0" value={linha.quantidade}
                        onChange={e => setVozItens(a => a.map((x, j) => j === i ? { ...x, quantidade: Number(e.target.value) } : x))}
                        className="h-11 w-24 rounded-xl border-2 border-emerald-200 px-2 text-center font-black text-emerald-700 outline-none focus:border-emerald-500" />
                      <button onClick={() => setVozItens(a => a.filter((_, j) => j !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-rose-600"><X size={16} /></button>
                    </div>
                  ))}
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Quem está contando *</span>
                  <select value={operacao.responsavel_id} onChange={e => setOperacao({ ...operacao, responsavel_id: e.target.value })}
                    className={`mt-1.5 h-12 w-full rounded-xl border-2 px-3 font-bold outline-none ${operacao.responsavel_id ? "border-slate-200 bg-slate-50 text-slate-800" : "border-red-300 bg-red-50 text-red-700"}`}>
                    <option value="">Selecione o responsável...</option>
                    {colaboradoresDaArea.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` (${c.cargo})` : ""}</option>)}
                  </select>
                </label>

                <button onClick={gravarContagemVoz} disabled={vozSalvando || !operacao.responsavel_id}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                  {vozSalvando ? <><Loader2 size={19} className="animate-spin" /> Gravando...</> : <>Gravar contagem de {vozItens.length} item(ns)</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}

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

            {/* Produto que ainda não existe: cadastra aqui e já entra no estoque */}
            {modal.tipo === "entrada" && !modal.item && (novoProduto ? (
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-3.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Cadastrar produto novo</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Entra no cadastro de ingredientes e neste estoque de uma vez.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_90px_100px_120px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Produto</span>
                    <input autoFocus value={novoProduto.nome} onChange={e => setNovoProduto(p => ({ ...p, nome: e.target.value }))}
                      placeholder="Nome do produto" className="h-12 rounded-xl border border-slate-300 px-3 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                  </label>
                  {/* Volume da embalagem: 750 para uma garrafa de 750 ml, 1
                      para a de 1 L. Vinha fixo em 1, então todo produto
                      cadastrado aqui nascia sem volume — e sem volume a ficha
                      técnica não sabe quanto sai de cada garrafa. */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volume</span>
                    <input inputMode="decimal" value={novoProduto.volume} onChange={e => setNovoProduto(p => ({ ...p, volume: e.target.value }))}
                      placeholder="750" className="h-12 rounded-xl border border-slate-300 px-3 text-right font-bold text-slate-800 outline-none focus:border-emerald-600" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Medida</span>
                    <select value={novoProduto.unidade} onChange={e => setNovoProduto(p => ({ ...p, unidade: e.target.value }))}
                      className="h-12 rounded-xl border border-slate-300 px-2 font-bold text-slate-700 outline-none focus:border-emerald-600">
                      {["ml", "l", "g", "kg", "un"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custo</span>
                    <input inputMode="decimal" value={novoProduto.custo} onChange={e => setNovoProduto(p => ({ ...p, custo: e.target.value }))}
                      placeholder="0,00" className="h-12 rounded-xl border border-slate-300 px-3 text-right font-bold text-slate-800 outline-none focus:border-emerald-600" />
                  </label>
                </div>
                {/* Como se compra: garrafa, lata, caixa. É o par do volume — é
                    esta unidade que aparece na contagem ("3 garrafas"), e o
                    volume diz quanto tem em cada uma. */}
                <label className="mt-2 flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Como se compra (opcional)</span>
                  <select value={novoProduto.unidadeComercial || ""} onChange={e => setNovoProduto(p => ({ ...p, unidadeComercial: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-300 px-2 font-bold text-slate-700 outline-none focus:border-emerald-600">
                    <option value="">A granel — conta na própria medida</option>
                    {["garrafa", "lata", "caixa", "pacote", "fardo", "pote", "unidade"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                {/* Mínimo e máximo na hora do cadastro: item que nasce sem
                    mínimo nunca entra no alerta de reposição, e ninguém volta
                    depois para preencher o que ainda não faltou. */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estoque mínimo</span>
                    <input inputMode="decimal" value={novoProduto.minimo || ""} onChange={e => setNovoProduto(p => ({ ...p, minimo: e.target.value }))}
                      placeholder="Avisa quando cair abaixo" className="h-12 rounded-xl border border-slate-300 px-3 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estoque máximo</span>
                    <input inputMode="decimal" value={novoProduto.maximo || ""} onChange={e => setNovoProduto(p => ({ ...p, maximo: e.target.value }))}
                      placeholder="Quanto cabe / quanto comprar" className="h-12 rounded-xl border border-slate-300 px-3 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                  </label>
                </div>
                {/* Categoria já na hora do cadastro: item que nasce "Sem
                    categoria" nunca mais é classificado depois. */}
                {categoriasDisponiveis(estoqueAtual).length > 0 && (
                  <div className="mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categoria</span>
                    <div className="mt-1 flex gap-2">
                      <select value={novoProduto.categoria} onChange={e => setNovoProduto(p => ({ ...p, categoria: e.target.value }))}
                        className="h-12 flex-1 rounded-xl border border-slate-300 px-2 font-bold text-slate-700 outline-none focus:border-emerald-600">
                        {categoriasDisponiveis(estoqueAtual).map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Sem categoria">Sem categoria</option>
                      </select>
                      {/* Excluir só aparece na categoria criada pela unidade, e
                          só se ninguém estiver usando. */}
                      {novoProduto.categoria && novoProduto.categoria !== "Sem categoria"
                        && !ehEmbutida(novoProduto.categoria, categoriasDoEstoque(estoqueAtual)) && (
                        <button type="button" onClick={() => excluirCategoria(estoqueAtual, novoProduto.categoria)}
                          title={`Excluir a categoria "${novoProduto.categoria}"`}
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50">
                          <X size={18} />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); criarCategoria(estoqueAtual); } }}
                        placeholder="Criar nova categoria..."
                        className="h-11 flex-1 rounded-xl border border-slate-200 px-3 font-bold text-slate-700 outline-none focus:border-emerald-600" />
                      <button type="button" onClick={() => criarCategoria(estoqueAtual)} disabled={!novaCategoria.trim()}
                        className="h-11 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 disabled:opacity-40">
                        Criar
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setNovoProduto(null)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">Cancelar</button>
                  <button type="button" onClick={cadastrarProdutoAqui} disabled={novoProduto.salvando}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    {novoProduto.salvando ? "Cadastrando..." : "Cadastrar e usar"}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setNovoProduto({ nome: "", volume: "", unidade: "ml", unidadeComercial: "", custo: "", minimo: "", maximo: "", categoria: categoriasDisponiveis(estoqueAtual)[0] || "Sem categoria", salvando: false })}
                className="text-sm font-black text-emerald-700 hover:underline">
                Não está na lista? Cadastrar produto novo
              </button>
            ))}

            <Campo label={`Responsável pela Operação * (${estoqueAtual?.nome || "Estoque"})`}>
              <select required value={operacao.responsavel_id} onChange={e => setOperacao({ ...operacao, responsavel_id: e.target.value })} className="h-14 w-full rounded-2xl border-2 border-slate-300 px-3 font-bold text-slate-800 text-base outline-none focus:border-emerald-500">
                <option value="">Selecione o colaborador responsável (Obrigatório)...</option>
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
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      {(estoqueAtual?.departamento === "bar" || estoqueAtual?.slug === "bar" || modal.item?.departamento === "bar") && modal.tipo === "contagem" ? (
                        <div className="col-span-2 space-y-3 rounded-2xl border-2 border-sky-200 bg-sky-50/80 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-1">
                              🍺 Controle de Estoque do Bar (Estoque Frio vs Quente)
                            </span>
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md">Soma Automática</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-sky-900 mb-1">❄️ Estoque Frio (Expositor / Geladeira)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                placeholder="0"
                                value={operacao.qtd_frio ?? ""}
                                onChange={e => {
                                  const frio = e.target.value;
                                  const quente = operacao.qtd_quente || "0";
                                  const tot = (Number(frio) || 0) + (Number(quente) || 0);
                                  setOperacao({ ...operacao, qtd_frio: frio, quantidade: String(tot) });
                                }}
                                className="h-12 w-full rounded-xl border-2 border-sky-300 bg-white text-center font-black text-lg text-sky-950 outline-none focus:border-sky-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-amber-900 mb-1">🔥 Estoque Quente (Depósito / Seco)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                placeholder="0"
                                value={operacao.qtd_quente ?? ""}
                                onChange={e => {
                                  const quente = e.target.value;
                                  const frio = operacao.qtd_frio || "0";
                                  const tot = (Number(frio) || 0) + (Number(quente) || 0);
                                  setOperacao({ ...operacao, qtd_quente: quente, quantidade: String(tot) });
                                }}
                                className="h-12 w-full rounded-xl border-2 border-amber-300 bg-white text-center font-black text-lg text-amber-950 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs font-black text-slate-700 bg-white p-2.5 rounded-xl border border-sky-200">
                            <span>📦 Saldo Total do Bar (Frio + Quente):</span>
                            <span className="text-sm font-black text-emerald-600">{fmtQtd(operacao.quantidade)} {mostrarUn(itemMod?.unidade_medida)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-700">
                              {modal.tipo === "contagem" ? "Saldo contado" : "Quantidade"}
                            </label>
                            {itemMod && (
                              <span className="text-[10px] font-bold text-slate-500">
                                Cadastro: <strong className="text-slate-800 uppercase">{mostrarUn(itemMod.unidade_medida)}</strong>
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              required
                              min="0"
                              step="0.001"
                              type="number"
                              value={operacao.quantidade}
                              onChange={e => setOperacao({ ...operacao, quantidade: e.target.value })}
                              className="h-14 flex-1 min-w-0 rounded-2xl border-2 border-slate-300 px-4 text-center font-black text-xl text-slate-900 outline-none focus:border-emerald-500"
                              placeholder="0"
                            />
                            {itemMod && ["kg", "g", "l", "ml"].includes(String(itemMod.unidade_medida || "").toLowerCase()) && (
                              <select
                                value={operacao.unidade_digitada || String(itemMod.unidade_medida).toLowerCase()}
                                onChange={e => {
                                  const novaUn = e.target.value;
                                  const unBase = String(itemMod.unidade_medida).toLowerCase();
                                  setOperacao({ ...operacao, unidade_digitada: novaUn });
                                }}
                                className="h-14 rounded-2xl border-2 border-slate-300 bg-slate-100 px-3 font-black text-xs text-slate-800 outline-none"
                              >
                                {["kg", "g"].includes(String(itemMod.unidade_medida).toLowerCase()) ? (
                                  <>
                                    <option value="kg">kg (Quilos)</option>
                                    <option value="g">g (Gramas)</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="l">L (Litros)</option>
                                    <option value="ml">ml (Mililitros)</option>
                                  </>
                                )}
                              </select>
                            )}
                          </div>
                          {itemMod && operacao.unidade_digitada && operacao.unidade_digitada.toLowerCase() !== String(itemMod.unidade_medida).toLowerCase() && Number(operacao.quantidade) > 0 && (() => {
                            const unBase = String(itemMod.unidade_medida).toLowerCase();
                            const unDig = String(operacao.unidade_digitada).toLowerCase();
                            const val = Number(operacao.quantidade) || 0;
                            let emBase = val;
                            if (unBase === "kg" && unDig === "g") emBase = val / 1000;
                            if (unBase === "l" && unDig === "ml") emBase = val / 1000;
                            return (
                              <p className="rounded-xl bg-emerald-50 p-2 text-xs font-bold text-emerald-900 border border-emerald-200">
                                💡 Conversão automática: {val} {unDig} = <strong>{emBase} {mostrarUn(unBase)}</strong> (saldo final no estoque em {mostrarUn(unBase)}).
                              </p>
                            );
                          })()}
                        </div>
                      )}
                      {modal.tipo === "transferencia" ? (
                        <Campo label="Estoque de destino">
                          <select required value={operacao.destino_id} onChange={e => setOperacao({ ...operacao, destino_id: e.target.value })} className="h-14 w-full rounded-2xl border border-slate-200 px-3 font-bold text-slate-800">
                            <option value="">Selecione...</option>{destinosCompativeis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                          </select>
                        </Campo>
                      ) : (
                        <Campo label="Data da Operação *"><input required type="datetime-local" value={operacao.data} onChange={e => setOperacao({ ...operacao, data: e.target.value })} className="h-14 w-full rounded-2xl border border-slate-200 px-3 font-semibold text-slate-800" /></Campo>
                      )}
                    </div>
                    {modal.tipo === "contagem" && itemMod && (() => {
                      const custo = Number(itemMod?.preco_normalizado || itemMod?.custo_unitario || itemMod?.insumo?.preco_normalizado || 0);
                      const saldoSistema = Number(itemMod?.quantidade_atual || 0);
                      const saldoContado = Number(operacao.quantidade) || 0;
                      const diff = saldoContado - saldoSistema;
                      const valorDiff = diff * custo;
                      const unName = mostrarUn(itemMod?.unidade_medida || itemMod?.unidade_comercial || "un");
                      return (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                          <div className="flex justify-between items-center text-slate-600 font-medium">
                            <span>Saldo no Sistema: <b>{saldoSistema.toFixed(2)} {unName}</b> ({dinheiro(saldoSistema * custo)})</span>
                            <span>Custo Un.: <b>{dinheiro(custo)}/{unName}</b></span>
                          </div>
                          <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-black ${
                            diff < -0.001
                              ? "bg-red-100 text-red-900 border border-red-200"
                              : diff > 0.001
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                              : "bg-sky-100 text-sky-900 border border-sky-200"
                          }`}>
                            <span>Divergência: {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} {unName}</span>
                            <span>Impacto no CMV: {diff > 0 ? `+${dinheiro(valorDiff)} (Sobra)` : diff < 0 ? `${dinheiro(valorDiff)} (Quebra/Perda)` : "100% Exato (R$ 0,00)"}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {modal.tipo !== "contagem" && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="w-full text-[11px] font-black uppercase text-slate-400 tracking-wider">Atalhos Rápidos de Quantidade:</span>
                        {[1, 2, 5, 10, 20, 50].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setOperacao(prev => ({ ...prev, quantidade: String((Number(prev.quantidade) || 0) + val) }))}
                            className="flex-1 min-w-[48px] py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-900 hover:text-emerald-900 font-black text-sm border border-slate-200 active:scale-95 transition-all"
                          >
                            +{val}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setOperacao(prev => ({ ...prev, quantidade: "" }))}
                          className="px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs border border-red-200 active:scale-95 transition-all"
                        >
                          Zerar
                        </button>
                      </div>
                    )}
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
            {modal.tipo === "transferencia" && !destinosCompativeis.length && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Não há outro estoque ativo e compatível com esta área.</p>}
            <div className="flex justify-end"><BotaoSalvar carregando={salvando}>Confirmar</BotaoSalvar></div>
          </form>
        </Modal>
      )}

      {modal?.tipo === "item" && (
        <Modal titulo={`Configurar ${modal.item.nome}`} descricao={`Parâmetros válidos apenas em ${estoqueAtual?.nome}.`} onClose={() => setModal(null)}>
          <form onSubmit={salvarConfiguracaoItem} className="space-y-4">
            {/* Pedido do PIN, dentro do próprio modal para não perder o que já
                foi digitado nos outros campos. */}
            {pinDigitado !== null && !unidadeLiberada && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-black text-amber-900">PIN do gerente para alterar limites ou unidade</p>
                <p className="mt-1 text-xs font-semibold text-amber-800">
                  O PIN protege o estoque mínimo, o máximo e a unidade de medida deste item.
                </p>
                <div className="mt-2 flex gap-2">
                  <input type="password" inputMode="numeric" autoFocus value={pinDigitado}
                    onChange={e => setPinDigitado(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (pinDigitado === String(pinGerente)) { setUnidadeLiberada(true); setPinDigitado(null); } else avisar("PIN incorreto.", "erro"); } }}
                    placeholder="••••" className="h-11 w-32 rounded-xl border border-amber-300 px-3 text-center font-black tracking-widest" />
                  <button type="button" onClick={() => { if (pinDigitado === String(pinGerente)) { setUnidadeLiberada(true); setPinDigitado(null); } else avisar("PIN incorreto.", "erro"); }}
                    className="h-11 rounded-xl bg-amber-600 px-4 text-sm font-black text-white">Liberar</button>
                  <button type="button" onClick={() => setPinDigitado(null)}
                    className="h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-amber-800">Cancelar</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Estoque mínimo"><input disabled={!unidadeLiberada} type="number" min="0" step="0.001" value={formItem.estoque_minimo} placeholder="0" onChange={e => setFormItem({ ...formItem, estoque_minimo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /></Campo>
              <Campo label="Estoque máximo"><input disabled={!unidadeLiberada} type="number" min="0" step="0.001" value={formItem.estoque_maximo} placeholder="0" onChange={e => setFormItem({ ...formItem, estoque_maximo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /></Campo>
              {!unidadeLiberada && (
                <button type="button" onClick={() => setPinDigitado("")} className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-sm font-black text-amber-800">
                  <Lock size={16} /> Liberar mínimo e máximo com PIN
                </button>
              )}
              <Campo label="Custo unitário">
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm font-extrabold text-slate-500">R$</span>
                  <input type="number" min="0" step="0.01" value={formItem.custo_unitario} onChange={e => setFormItem({ ...formItem, custo_unitario: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 pl-10 pr-3 font-semibold" placeholder="0,00" />
                </div>
              </Campo>
              {/* Unidade de medida: trocar não converte o saldo que já existe,
                  então fica atrás do PIN do gerente. */}
              <Campo label="Unidade de medida">
                {unidadeLiberada ? (
                  <select value={String(formItem.unidade_medida || "un").toLowerCase()}
                    onChange={e => setFormItem({ ...formItem, unidade_medida: e.target.value })}
                    className="h-12 w-full rounded-xl border-2 border-amber-400 bg-amber-50 px-3 font-bold">
                    {["un", "kg", "g", "l", "ml"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <button type="button" onClick={() => { setPinDigitado(""); }}
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-left">
                    <span className="font-bold text-slate-700">{String(formItem.unidade_medida || "un").toLowerCase()}</span>
                    <span className="text-xs font-black text-emerald-700">Alterar</span>
                  </button>
                )}
              </Campo>
              {estoqueAtual?.controla_validade && <Campo label="Validade"><input type="date" value={formItem.validade || ""} onChange={e => setFormItem({ ...formItem, validade: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>}
              {/* Onde a coisa fica dentro do estoque: expositor, balcão, depósito... */}
              <Campo label="Onde fica">
                <input list="locais-do-estoque" value={formItem.local_interno || ""} onChange={e => setFormItem({ ...formItem, local_interno: e.target.value })}
                  placeholder={(estoqueAtual?.locais_internos || [])[0] || "Ex.: Balcão refrigerado"}
                  className="h-12 w-full rounded-xl border border-slate-200 px-3" />
                <datalist id="locais-do-estoque">
                  {(estoqueAtual?.locais_internos || []).map(l => <option key={l} value={l} />)}
                </datalist>
              </Campo>
            </div>
            {/* Embalagem — valem para o produto em todos os estoques */}
            {Number(formItem.tamanho_embalagem) > 1 && String(formItem.unidade_medida || "").toLowerCase() !== "un" && (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Bebida / embalado</p>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Unidade comercial">
                    {(() => {
                      const ehBar = estoqueAtual?.departamento === "bar" || modal?.item?.departamento === "bar" || formItem?.departamento === "bar";
                      const cat = String(formItem?.categoria || modal?.item?.categoria || "").toLowerCase();
                      const nome = String(formItem?.nome || modal?.item?.nome || "").toLowerCase();
                      const ehFruta = cat.includes("fruta") || cat.includes("horti") || cat.includes("fresco") ||
                                      nome.includes("limão") || nome.includes("laranja") || nome.includes("abacaxi") ||
                                      nome.includes("hortelã") || nome.includes("morango") || nome.includes("maracujá") ||
                                      nome.includes("fruta");
                      let opcoes = ["garrafa", "lata", "unidade", "caixa", "pacote", "barril", "outro"];
                      if (ehBar) {
                        opcoes = ehFruta ? ["unidade", "g", "kg"] : ["garrafa", "lata", "barril"];
                      }
                      return (
                        <select value={formItem.unidade_comercial || ""} onChange={e => setFormItem({ ...formItem, unidade_comercial: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">
                          <option value="">Selecione...</option>
                          {opcoes.map(u => (
                            <option key={u} value={u}>
                              {u === "garrafa" ? "Garrafa" : u === "lata" ? "Lata" : u === "barril" ? "Barril (Chopp)" : u === "unidade" ? "Unidade (un)" : u === "g" ? "Grama (g)" : u === "kg" ? "Quilo (kg)" : u}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </Campo>
                  <Campo label="Conteúdo por unidade">
                    <div className="grid h-12 place-items-center rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-600">{fmtQtd(formItem.tamanho_embalagem)} {String(formItem.unidade_medida).toLowerCase() === "l" ? "L" : formItem.unidade_medida}</div>
                  </Campo>
                </div>
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

      {modal?.tipo === "historico_item" && (
        <Modal titulo={`Histórico — ${modal.item?.nome}`} descricao={`Todas as movimentações gravadas de ${modal.item?.nome} em ${estoqueAtual?.nome}.`} onClose={() => setModal(null)} largo>
          <div className="space-y-4">
            {(() => {
              const movsItem = movimentos.filter(m => String(m.insumo_id) === String(modal.item?.insumo_id) || String(m.insumo_nome || "").toLowerCase() === String(modal.item?.nome || "").toLowerCase());
              if (!movsItem.length) {
                return <div className="p-8 text-center text-slate-500 font-bold">Nenhuma movimentação registrada para este produto.</div>;
              }
              return (
                <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="p-3">Data/Hora</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Qtd.</th>
                        <th className="p-3">Responsável</th>
                        <th className="p-3">Observação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movsItem.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-600">{fmtData(m.data_movimento, true)}</td>
                          <td className="p-3"><span className={`rounded-md px-2 py-0.5 font-bold uppercase text-[10px] ${m.tipo === "entrada" ? "bg-emerald-100 text-emerald-800" : m.tipo === "saida" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{m.tipo}</span></td>
                          <td className="p-3 font-extrabold text-slate-900">{fmtQtd(m.quantidade)} {mostrarUn(m.unidade_medida)}</td>
                          <td className="p-3 text-slate-600">{m.usuario_nome || m.responsavel_nome || "Sistema"}</td>
                          <td className="p-3 text-slate-500 italic">{m.observacao || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            <div className="flex justify-end">
              <button onClick={() => setModal(null)} className="h-11 rounded-xl bg-slate-100 px-5 font-bold text-slate-700 hover:bg-slate-200">Fechar</button>
            </div>
          </div>
        </Modal>
      )}

      {modalZerar && (
        <Modal titulo={`Zerar ${estoqueAtual?.nome}`} descricao="Todos os saldos deste estoque vão a zero. Não tem desfazer." onClose={() => setModalZerar(null)}>
          <div className="space-y-3 pt-2">
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              Cada baixa fica no histórico com o seu nome, para a contagem poder ser conferida depois. Não tem desfazer.
            </p>
            {/* Marcar mais de um é possível, mas exige marcar: zerar bar e
                cozinha de um clique só seria fácil demais para uma ação sem volta. */}
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Quais estoques zerar</span>
              <div className="mt-1.5 max-h-44 space-y-1 overflow-auto rounded-xl border border-slate-200 p-2">
                {estoquesVisiveis.map(e => {
                  const marcado = (modalZerar.alvos || []).includes(e.id);
                  return (
                    <label key={e.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 hover:bg-slate-50">
                      <input type="checkbox" checked={marcado} className="h-4 w-4 accent-red-600"
                        onChange={() => setModalZerar(m => ({
                          ...m,
                          alvos: marcado
                            ? (m.alvos || []).filter(id => id !== e.id)
                            : [...(m.alvos || []), e.id],
                        }))} />
                      <span className="text-sm font-bold text-slate-700">{e.nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Motivo (opcional)</span>
              <input value={modalZerar.motivo || ""} onChange={e => setModalZerar(m => ({ ...m, motivo: e.target.value }))}
                placeholder="Ex.: recontagem geral de agosto"
                className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-3 font-semibold text-slate-800 outline-none focus:border-emerald-600" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Digite ZERAR para confirmar</span>
              <input autoFocus value={modalZerar.confirmacao} onChange={e => setModalZerar(m => ({ ...m, confirmacao: e.target.value }))}
                className="mt-1 h-12 w-full rounded-xl border-2 border-slate-300 px-3 text-center font-black tracking-widest text-slate-900 outline-none focus:border-red-500" />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setModalZerar(null)} className="h-12 flex-1 rounded-xl border border-slate-200 bg-white font-bold text-slate-600">Cancelar</button>
              <button onClick={confirmarZerar} disabled={modalZerar.salvando}
                className="h-12 flex-1 rounded-xl bg-red-600 font-black text-white hover:bg-red-700 disabled:opacity-60">
                {modalZerar.salvando ? "Zerando..." : "Zerar estoque"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal?.tipo === "exportar_relatorio" && (
        <Modal titulo={`Exportar Relatório — ${estoqueAtual?.nome}`} descricao="Escolha o formato como deseja exportar o balanço do estoque." onClose={() => setModal(null)}>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                setModal(null);
                imprimirRelatorio(estoqueAtual, itensDaArea, unidadeInfo);
              }}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 p-4 text-left hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Printer size={24} />
              </div>
              <div>
                <strong className="block text-base font-extrabold text-slate-900">Gerar PDF / Imprimir Relatório</strong>
                <p className="text-xs text-slate-500">Relatório formatado por categorias com subtotais e valor total.</p>
              </div>
            </button>

            <button
              onClick={() => {
                setModal(null);
                exportarExcel(estoqueAtual, itensDaArea, unidadeInfo);
                avisar("Relatório em Excel (.csv) gerado com sucesso!");
              }}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 p-4 text-left hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Download size={24} />
              </div>
              <div>
                <strong className="block text-base font-extrabold text-slate-900">Baixar Planilha Excel (.csv)</strong>
                <p className="text-xs text-slate-500">Arquivo formatado compatível com Microsoft Excel e Google Sheets.</p>
              </div>
            </button>

            <button
              onClick={() => {
                setModal(null);
                const txt = gerarListaComprasWhatsApp(estoqueAtual, itensDaArea, unidadeInfo);
                window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
              }}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4 text-left hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white transition-colors">
                <Share2 size={24} />
              </div>
              <div>
                <strong className="block text-base font-extrabold text-slate-900">Lista de compras no WhatsApp</strong>
                <p className="text-xs text-slate-500">Abre o WhatsApp com os itens abaixo do mínimo — nome, marca, valor e fornecedor, agrupados por fornecedor.</p>
              </div>
            </button>

            <button
              onClick={() => {
                setModal(null);
                const txt = gerarTextoWhatsApp(estoqueAtual, itensDaArea, unidadeInfo);
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(txt);
                  avisar("Texto formatado copiado! Cole direto no WhatsApp.");
                } else {
                  avisar("Não foi possível acessar a área de transferência.");
                }
              }}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 p-4 text-left hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-800 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Share2 size={24} />
              </div>
              <div>
                <strong className="block text-base font-extrabold text-slate-900">Copiar resumo do estoque</strong>
                <p className="text-xs text-slate-500">Copia o resumo completo (saldos por categoria) para colar no grupo do WhatsApp.</p>
              </div>
            </button>

            <div className="flex justify-end pt-2">
              <button onClick={() => setModal(null)} className="h-11 rounded-xl bg-slate-100 px-5 font-bold text-slate-700 hover:bg-slate-200">Cancelar</button>
            </div>
          </div>
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

function TabelaItens({ itens, estoque = {}, loading, onEntrada, onSaida, onEditar, onHistorico, agruparPor = "categoria", dinheiro = fmtBRL }) {
  const [colapsadas, setColapsadas] = useState({});

  const toggleColapso = (cat) => {
    setColapsadas(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const agrupadoPorCategoria = useMemo(() => {
    if (!itens || !itens.length) return [];
    const porLocal = agruparPor === "local";
    const mapa = new Map();
    for (const item of itens) {
      if (!item) continue;
      const cat = porLocal
        ? (String(item.local_interno || "").trim() || "Sem lugar definido")
        : (item.categoria || "Sem categoria");
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat).push(item);
    }

    // Por lugar: segue a ordem cadastrada no estoque; o resto vem depois.
    if (porLocal) {
      const ordem = (estoque?.locais_internos || []).map(String);
      const chaves = Array.from(mapa.keys()).sort((a, b) => {
        const ia = ordem.indexOf(a); const ib = ordem.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        if (a === "Sem lugar definido") return 1;
        if (b === "Sem lugar definido") return -1;
        return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
      });
      return chaves.map(cat => {
        const lista = (mapa.get(cat) || []).sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR", { sensitivity: "base" }));
        return { categoria: cat, lista, subtotal: lista.reduce((soma, i) => soma + (calcularValorItem(i) || 0), 0) };
      });
    }

    // Vale para pre-preparos-bar e embalagens-bar também, não só o slug "bar".
    const ehBar = departamentoDoEstoque(estoque) === "bar";
    const listaOficial = ehBar ? CATEGORIAS_ESTOQUE_BAR : CATEGORIAS_ESTOQUE_COZINHA;

    const categoriasOrdenadas = Array.from(mapa.keys()).sort((a, b) => {
      const idxA = listaOficial.indexOf(a);
      const idxB = listaOficial.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
    });
    return categoriasOrdenadas.map(cat => {
      const lista = (mapa.get(cat) || []).sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR", { sensitivity: "base" }));
      const subtotal = lista.reduce((soma, i) => soma + (calcularValorItem(i) || 0), 0);
      return { categoria: cat, lista, subtotal };
    });
  }, [itens, agruparPor, estoque]);

  const expandirTodas = () => setColapsadas({});
  const recolherTodas = () => {
    const mapa = {};
    agrupadoPorCategoria.forEach(c => { mapa[c.categoria] = true; });
    setColapsadas(mapa);
  };

  if (loading) return <div className="grid min-h-64 place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>;
  if (!itens || !itens.length) return <div className="grid min-h-64 place-items-center px-5 text-center"><div><Package size={42} className="mx-auto mb-3 text-slate-300" /><p className="font-black text-slate-700">Nenhum item encontrado neste estoque</p><p className="mt-1 text-sm text-slate-500">Use “Nova entrada” ou “Importar lista” para começar.</p></div></div>;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 text-xs font-bold text-slate-600">
        <span>Total de {agrupadoPorCategoria.length} {agruparPor === "local" ? "lugar(es)" : "categoria(s)"} no resultado</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={expandirTodas} className="rounded-lg px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition">Expandir todas</button>
          <button type="button" onClick={recolherTodas} className="rounded-lg px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition">Recolher todas</button>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block rounded-b-2xl border-x border-b border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-20 bg-slate-900 text-xs font-black uppercase tracking-wider text-white shadow-md"><tr>
            <th className="px-5 py-4 whitespace-nowrap">Produto</th>
            <th className="px-4 py-4 whitespace-nowrap">Categoria</th>
            <th className="px-4 py-4 whitespace-nowrap">Embalagem</th>
            <th className="px-4 py-4 whitespace-nowrap">Custo / Un.</th>
            <th className="px-4 py-4 whitespace-nowrap">Saldo Atual</th>
            <th className="px-4 py-4 whitespace-nowrap">Valor Total</th>
            <th className="px-3 py-4 whitespace-nowrap">Mínimo</th>
            <th className="px-3 py-4 whitespace-nowrap">Máximo</th>
            {estoque?.controla_validade && <th className="px-4 py-4 whitespace-nowrap">Validade</th>}
            <th className="px-4 py-4 whitespace-nowrap">Última Movimentação</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">Ações</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {agrupadoPorCategoria.map(({ categoria, lista, subtotal }) => {
              const isColapsed = !!colapsadas[categoria];
              return (
                <Fragment key={categoria}>
                  <tr
                    onClick={() => toggleColapso(categoria)}
                    className="bg-slate-100/90 border-y border-slate-200 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                  >
                    <td colSpan={estoque?.controla_validade ? 11 : 10} className="px-5 py-3">
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-2.5 text-xs font-black uppercase tracking-wider text-slate-900">
                          <div className="grid h-6 w-6 place-items-center rounded-lg bg-slate-200 text-slate-700">
                            {isColapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          </div>
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
                          {categoria}
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-slate-700 shadow-sm border border-slate-200">
                            {lista.length} {lista.length === 1 ? "item" : "itens"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                            Subtotal: {dinheiro(subtotal)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            {isColapsed ? "Clique para abrir" : "Clique para recolher"}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {!isColapsed && lista.map(item => {
                    const status = statusItemEstoque(item, estoque || {});
                    const valTotalItem = calcularValorItem(item);
                    return <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 min-w-[240px] max-w-[320px]"><strong className="block text-slate-900 font-black text-sm leading-snug whitespace-normal break-words">{item.nome}</strong><span className="text-xs text-slate-400 font-extrabold block mt-0.5">{item.codigo_interno || item.marca || "Sem código"}</span></td>
                      <td className="px-4 py-3.5 whitespace-nowrap">{(() => {
                        const cat = String(item.categoria || "").trim();
                        const cores = {
                          "Cervejas": "bg-amber-100 text-amber-950 border-amber-300",
                          "Destilados": "bg-purple-100 text-purple-950 border-purple-300",
                          "Vinhos": "bg-rose-100 text-rose-950 border-rose-300",
                          "Chopp": "bg-yellow-100 text-yellow-950 border-yellow-300",
                          "Água": "bg-sky-100 text-sky-950 border-sky-300",
                          "Refrigerantes": "bg-red-100 text-red-950 border-red-300",
                          "Bombons": "bg-pink-100 text-pink-950 border-pink-300",
                          "Pré-preparos": "bg-indigo-100 text-indigo-950 border-indigo-300",
                          "Carne vermelha": "bg-red-100 text-red-950 border-red-300",
                          "Peixe": "bg-cyan-100 text-cyan-950 border-cyan-300",
                          "Aves": "bg-amber-100 text-amber-950 border-amber-300",
                          "Frutos do mar": "bg-teal-100 text-teal-950 border-teal-300",
                          "Caranguejo": "bg-orange-100 text-orange-950 border-orange-300",
                          "Laticínios": "bg-yellow-100 text-yellow-950 border-yellow-300",
                          "Hortifrúti": "bg-emerald-100 text-emerald-950 border-emerald-300",
                          "Secos": "bg-stone-100 text-stone-950 border-stone-300",
                          "Líquidos": "bg-blue-100 text-blue-950 border-blue-300",
                        };
                        const cl = cores[cat] || "bg-emerald-100 text-emerald-950 border-emerald-300";
                        return <span className={`inline-block rounded-xl px-3 py-1 text-xs font-black border shadow-xs ${cl}`}>{cat || "Sem categoria"}</span>;
                      })()}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold text-slate-700">{fmtQtd(item.tamanho_embalagem || 1)} {mostrarUn(item.unidade_medida)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><strong className="font-extrabold text-slate-900">{dinheiro(item.custo_unitario || 0)}</strong></td>
                      <td className={`px-4 py-3.5 whitespace-nowrap font-black ${status.abaixoMinimo ? "text-red-600" : "text-emerald-700"}`}>{(() => { const s = saldoEmbalado(item); return s ? <><span>{s.principal}</span><span className="block text-[11px] font-bold text-slate-400 mt-0.5">{s.secundario}</span></> : <>{fmtQtd(item.quantidade_atual)} {mostrarUn(item.unidade_medida)}</>; })()}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><strong className="font-black text-emerald-800 text-base">{dinheiro(valTotalItem)}</strong></td>
                      <td className="px-3 py-3.5 whitespace-nowrap font-extrabold text-slate-700">{item.estoque_minimo == null || item.estoque_minimo === "" ? "—" : `${fmtQtd(item.estoque_minimo)} ${item.unidade_comercial || (["ml", "l"].includes(String(item.unidade_medida).toLowerCase()) ? "garrafa" : mostrarUn(item.unidade_medida))}`}</td>
                      <td className="px-3 py-3.5 whitespace-nowrap font-extrabold text-slate-700">{item.estoque_maximo == null || item.estoque_maximo === "" ? "—" : `${fmtQtd(item.estoque_maximo)} ${item.unidade_comercial || (["ml", "l"].includes(String(item.unidade_medida).toLowerCase()) ? "garrafa" : mostrarUn(item.unidade_medida))}`}</td>
                      {estoque?.controla_validade && <td className={`px-4 py-3.5 whitespace-nowrap ${status.vencido || status.validadeProxima ? "font-black text-amber-700" : "font-semibold text-slate-600"}`}>{fmtData(item.validade)}</td>}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-600">{fmtData(item.ultima_movimentacao_em, true)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => onEntrada(item)} className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold shadow-sm active:scale-95 transition-all" title="Entrada / Adicionar"><Plus size={18} /></button>
                        <button onClick={() => onSaida(item)} className="grid h-9 w-9 place-items-center rounded-xl border border-rose-600 bg-rose-600 text-white hover:bg-rose-700 font-extrabold shadow-sm active:scale-95 transition-all" title="Baixa / Retirar"><span className="text-xl leading-none">−</span></button>
                        <button onClick={() => onHistorico && onHistorico(item)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-200 font-bold" title="Histórico do produto"><History size={17} /></button>
                        <SimuladorRendimento item={item} variant="icon" />
                        <button onClick={() => onEditar(item)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-200 font-bold" title="Configurar"><MoreVertical size={17} /></button>
                      </div></td>
                    </tr>;
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 lg:hidden">
        {agrupadoPorCategoria.map(({ categoria, lista, subtotal }) => {
          const isColapsed = !!colapsadas[categoria];
          return (
            <div key={categoria} className="p-3 space-y-3">
              <div
                onClick={() => toggleColapso(categoria)}
                className="flex items-center justify-between rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-extrabold text-slate-800 cursor-pointer active:bg-slate-200 transition"
              >
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  {isColapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span>{categoria} ({lista.length})</span>
                </div>
                <span className="text-emerald-800">Subtotal: {dinheiro(subtotal)}</span>
              </div>
              {!isColapsed && lista.map(item => {
                const status = statusItemEstoque(item, estoque);
                const valTotalItem = calcularValorItem(item);
                return <article key={item.id} className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm active:border-emerald-500 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <strong className="text-base sm:text-lg font-black text-slate-900 leading-snug block truncate">{item.nome}</strong>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{item.categoria || "Sem categoria"}</span>
                        {(estoqueAtual?.locais_internos || []).length > 0 ? (
                          // Realocar é escolher o lugar aqui mesmo: um toque e
                          // o produto muda de grupo na lista.
                          <select value={item.local_interno || ""} onChange={e => realocarItem(item, e.target.value)}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-600 outline-none focus:border-emerald-500"
                            aria-label={`Lugar de ${item.nome}`}>
                            <option value="">Sem lugar</option>
                            {(estoqueAtual.locais_internos || []).map(l => <option key={l} value={l}>{l}</option>)}
                            {item.local_interno && !(estoqueAtual.locais_internos || []).includes(item.local_interno) && (
                              <option value={item.local_interno}>{item.local_interno}</option>
                            )}
                          </select>
                        ) : item.local_interno ? (
                          <span className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">{item.local_interno}</span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-slate-500">Mín: {item.estoque_minimo ?? "—"} · Máx: {item.estoque_maximo ?? "—"} · Valor: <strong className="text-emerald-800">{dinheiro(valTotalItem)}</strong></p>
                    </div>
                    <div className="text-right shrink-0 rounded-2xl bg-slate-900 px-3.5 py-2.5 text-white shadow-inner min-w-[100px]">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Saldo Atual</span>
                      {(() => {
                        const s = saldoEmbalado(item);
                        return s ? (
                          <>
                            <strong className={`text-base sm:text-lg font-black ${status.abaixoMinimo ? "text-red-400" : "text-emerald-400"}`}>{s.principal}</strong>
                            <span className="block text-[9px] font-semibold text-slate-300">{s.secundario}</span>
                          </>
                        ) : (
                          <strong className={`text-lg sm:text-xl font-black ${status.abaixoMinimo ? "text-red-400" : "text-emerald-400"}`}>{fmtQtd(item.quantidade_atual)} {mostrarUn(item.unidade_medida)}</strong>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <button onClick={() => onEntrada(item)} className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all">
                      <Plus size={20} /> + ADICIONAR
                    </button>
                    <button onClick={() => onSaida(item)} className="h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-95 transition-all">
                      <span className="text-2xl leading-none">−</span> − RETIRAR
                    </button>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <button onClick={() => onHistorico && onHistorico(item)} className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 active:bg-slate-300 transition-all">
                      <History size={16} /> Histórico
                    </button>
                    <button onClick={() => onEditar(item)} className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 active:bg-slate-300 transition-all">
                      <Settings2 size={16} /> Configurar
                    </button>
                  </div>
                  <div className="mt-2.5"><SimuladorRendimento item={item} variant="full" /></div>
                </article>;
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ListaMovimentos({ movimentos, modo, dinheiro = fmtBRL }) {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [colabFiltro, setColabFiltro] = useState("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");

  const colaboradoresUnicos = useMemo(() => {
    const set = new Set();
    (movimentos || []).forEach(m => {
      const nome = m.usuario_nome || m.responsavel_nome;
      if (nome) set.add(nome);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [movimentos]);

  const listaFiltrada = useMemo(() => {
    let base = movimentos || [];
    if (modo === "movimentacoes") {
      base = base.filter(m => ["entrada", "saida", "transferencia_saida", "transferencia_entrada", "contagem"].includes(m.tipo));
    }
    const termo = busca.toLowerCase().trim();
    const agora = new Date();

    return base.filter(m => {
      const prod = (m.insumo?.nome || m.insumo_nome || "").toLowerCase();
      if (termo && !prod.includes(termo)) return false;
      if (tipoFiltro !== "todos") {
        if (tipoFiltro === "entrada" && !["entrada", "transferencia_entrada"].includes(m.tipo)) return false;
        if (tipoFiltro === "saida" && !["saida", "transferencia_saida"].includes(m.tipo)) return false;
        if (tipoFiltro === "contagem" && m.tipo !== "contagem") return false;
      }
      if (colabFiltro !== "todos") {
        const nome = m.usuario_nome || m.responsavel_nome || "";
        if (nome !== colabFiltro) return false;
      }
      if (periodoFiltro !== "todos") {
        const rawDate = m.data_movimento || m.created_at;
        if (!rawDate) return false;
        const d = new Date(rawDate);
        if (periodoFiltro === "hoje") {
          if (d.toDateString() !== agora.toDateString()) return false;
        } else if (periodoFiltro === "semana") {
          const diffDias = (agora.getTime() - d.getTime()) / (1000 * 3600 * 24);
          if (diffDias > 7 || diffDias < 0) return false;
        } else if (periodoFiltro === "mes") {
          if (d.getMonth() !== agora.getMonth() || d.getFullYear() !== agora.getFullYear()) return false;
        }
      }
      return true;
    });
  }, [movimentos, modo, busca, tipoFiltro, colabFiltro, periodoFiltro]);

  if (!movimentos || !movimentos.length) {
    return <div className="grid min-h-64 place-items-center text-sm font-semibold text-slate-500">Nenhuma movimentação registrada nesta área.</div>;
  }

  return (
    <div className="space-y-4 p-4">
      {/* Filtros do Histórico */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Filtrar produto..."
            className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-medium outline-none focus:border-emerald-500"
          />
        </label>

        <select
          value={periodoFiltro}
          onChange={e => setPeriodoFiltro(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800"
        >
          <option value="todos">🗓️ Todos os períodos</option>
          <option value="hoje">📅 Hoje</option>
          <option value="semana">📆 Esta Semana (7 dias)</option>
          <option value="mes">📊 Este Mês</option>
        </select>

        <select
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800"
        >
          <option value="todos">Todos os tipos de ação</option>
          <option value="entrada">🟢 Entradas (+ Adicionar)</option>
          <option value="saida">🔴 Baixas (- Retirar)</option>
          <option value="contagem">🔵 Contagens</option>
        </select>

        <select
          value={colabFiltro}
          onChange={e => setColabFiltro(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800"
        >
          <option value="todos">Todos os colaboradores</option>
          {colaboradoresUnicos.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Lista de Movimentações */}
      {!listaFiltrada.length ? (
        <div className="p-8 text-center text-sm font-bold text-slate-500">Nenhum registro encontrado com esses filtros.</div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {listaFiltrada.map(mov => {
            const ehEntrada = ["entrada", "transferencia_entrada"].includes(mov.tipo);
            const ehSaida = ["saida", "transferencia_saida"].includes(mov.tipo);
            const ehContagem = mov.tipo === "contagem";

            const badgeConfig = ehEntrada
              ? { bg: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "ENTRADA", icon: "+" }
              : ehSaida
              ? { bg: "bg-red-100 text-red-800 border-red-300", label: "RETIRADA", icon: "−" }
              : ehContagem
              ? { bg: "bg-sky-100 text-sky-800 border-sky-300", label: "CONTAGEM", icon: "📋" }
              : { bg: "bg-purple-100 text-purple-800 border-purple-300", label: "TRANSFERÊNCIA", icon: "⇄" };

            const nomeProduto = mov.insumo?.nome || mov.insumo_nome || "Produto";
            const unMedida = mostrarUn(mov.insumo?.unidade_medida || mov.unidade_medida);
            const qtd = Math.abs(Number(mov.quantidade) || 0);

            return (
              <div key={mov.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-slate-50/90 transition-colors">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-black text-lg border ${badgeConfig.bg}`}>
                    {badgeConfig.icon}
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-base font-black text-slate-900">{nomeProduto}</strong>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className={`rounded-md px-2 py-0.5 font-black uppercase text-[10px] border ${badgeConfig.bg}`}>{badgeConfig.label}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                        <User size={13} className="text-slate-400" />
                        {mov.usuario_nome || mov.responsavel_nome || "Sistema"}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-600">📅 {fmtData(mov.data_movimento, true)}</span>
                    </div>
                    {mov.observacao && <p className="mt-1 text-xs text-slate-500 italic">“{mov.observacao}”</p>}
                    {ehContagem && (() => {
                      const ins = mov.insumo || itensDaArea.find(i => (i.insumo_id === mov.insumo_id || i.id === mov.insumo_id));
                      const custo = Number(ins?.preco_normalizado || ins?.custo_unitario || 0);
                      const anterior = Number(mov.saldo_anterior ?? 0);
                      const posterior = Number(mov.saldo_posterior ?? mov.quantidade ?? 0);
                      const diff = posterior - (mov.saldo_anterior !== undefined ? anterior : posterior);
                      const valorDiff = diff * custo;

                      return (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-bold">
                          {mov.saldo_anterior !== undefined && (
                            <span className="text-slate-500">Sistema: {fmtQtd(anterior)} → Contado: {fmtQtd(posterior)}</span>
                          )}
                          {custo > 0 && Math.abs(diff) > 0.001 && (
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black ${
                              diff < 0 ? "bg-red-100 text-red-800 border border-red-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}>
                              {diff < 0 ? `CMV / Quebra: ${dinheiro(Math.abs(valorDiff))}` : `Sobra: +${dinheiro(valorDiff)}`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <strong className={`text-lg font-black ${ehEntrada ? "text-emerald-700" : ehSaida ? "text-red-600" : "text-slate-900"}`}>
                    {ehEntrada ? "+" : ehSaida ? "−" : ""} {fmtQtd(qtd)} {unMedida}
                  </strong>
                  {mov.destino?.nome && <p className="text-xs font-bold text-slate-500">Destino: {mov.destino.nome}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EstoquePage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div>}><EstoqueUnificado /></Suspense>;
}

function EstoqueUnificado() {
  const searchParams = useSearchParams();
  if (searchParams.get("gestao") === "1") return <EstoqueRunner />;
  // Mesmo respiro das rotas /tablet: sem ele o "voltar" encosta na barra de
  // status do celular.
  return <div className="fixed inset-0 z-[200] overflow-auto bg-slate-50"
    style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}><TabletSetor titulo="Estoque" voltarHref="/dashboard" /></div>;
}
