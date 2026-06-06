"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  Check,
  AlertCircle,
  Search,
  X,
  FlaskConical,
  ChefHat,
  TrendingUp,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  BookOpen,
} from "lucide-react";

import {
  INGREDIENTES_SEED,
  calcCustoUnitario,
  getIngredienteById,
  calcCustoLinha,
  getUnidade,
} from "../../../lib/ingredientes";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val, dec = 2) {
  return Number(val).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}
function fmtPct(val) {
  return `${Number(val).toFixed(1)}%`;
}

// ─── Catálogo de ingredientes ──────────────────────────────────────────────────
const CATALOGO = INGREDIENTES_SEED.map((i) => ({
  ...i,
  custo_por_unidade_base: calcCustoUnitario(i.preco_compra, i.unidade),
}));

// ─── Fichas Técnicas disponíveis (mock) ────────────────────────────────────────
// Supabase: supabase.from('fichas').select('*, ficha_itens(*)')
const FICHAS_MOCK = [
  {
    id: "ficha_001",
    nome: "Marmitex Executiva",
    itens: [
      { id: "l1", ingrediente_id: 1, quantidade: 150 },
      { id: "l2", ingrediente_id: 2, quantidade: 200 },
      { id: "l3", ingrediente_id: 3, quantidade: 1 },
    ],
  },
  {
    id: "ficha_002",
    nome: "Salada Completa",
    itens: [
      { id: "l4", ingrediente_id: 4, quantidade: 100 },
      { id: "l5", ingrediente_id: 5, quantidade: 20 },
    ],
  },
];

function calcCustoFicha(ficha) {
  if (!ficha) return 0;
  return ficha.itens.reduce((acc, item) => {
    const ing = getIngredienteById(item.ingrediente_id, CATALOGO);
    return acc + (ing ? calcCustoLinha(ing, item.quantidade) : 0);
  }, 0);
}

// ─── Categorias ───────────────────────────────────────────────────────────────
const CATEGORIAS = ["Todos", "Marmita", "Salada", "Prato Principal", "Bebida", "Sobremesa", "Lanche"];

// ─── Dados iniciais (seed) ─────────────────────────────────────────────────────
// Supabase: supabase.from('cardapio').select('*')
const PRATOS_SEED = [
  {
    id: "prato_001",
    nome: "Marmitex Executiva",
    categoria: "Marmita",
    preco_venda: 19.9,
    ficha_id: "ficha_001",
    ativo: true,
  },
  {
    id: "prato_002",
    nome: "Salada Completa",
    categoria: "Salada",
    preco_venda: 14.9,
    ficha_id: "ficha_002",
    ativo: true,
  },
];

// ─── Componente: Card de prato ─────────────────────────────────────────────────
function CardPrato({ prato, onEditar, onToggle, onDeletar }) {
  const ficha = FICHAS_MOCK.find((f) => f.id === prato.ficha_id);
  const custo = calcCustoFicha(ficha);
  const preco = parseFloat(prato.preco_venda) || 0;
  const mc_reais = preco - custo;
  const mc_pct = preco > 0 ? (mc_reais / preco) * 100 : 0;
  const cmv_pct = preco > 0 ? (custo / preco) * 100 : 0;
  const margem_ok = mc_pct >= 30;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${prato.ativo ? "border-neutral-100" : "border-neutral-200 opacity-60"}`}>
      {/* Topo do card */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                {prato.categoria}
              </span>
              <span
                className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                  prato.ativo
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {prato.ativo ? "Ativo" : "Pausado"}
              </span>
            </div>
            <p className="text-base font-black text-neutral-900 leading-tight truncate">{prato.nome}</p>
            {ficha && (
              <p className="text-[11px] text-neutral-400 font-medium mt-0.5 truncate">
                Ficha: {ficha.nome}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black text-neutral-900">{fmtBRL(preco)}</p>
            <p className="text-[11px] text-neutral-400 font-medium">preço venda</p>
          </div>
        </div>

        {/* Barra de CMV/MC */}
        {ficha ? (
          <>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden flex mb-1.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(cmv_pct, 100)}%`,
                  backgroundColor: margem_ok ? "#10b981" : "#f43f5e",
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-black">
              <span className={margem_ok ? "text-emerald-600" : "text-rose-500"}>
                CMV {fmtPct(cmv_pct)} · Custo {fmtBRL(custo)}
              </span>
              <span className={margem_ok ? "text-emerald-600" : "text-rose-500"}>
                MC {fmtPct(mc_pct)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-bold bg-amber-50 rounded-xl px-3 py-2">
            <AlertCircle size={12} />
            Sem ficha técnica vinculada — custo desconhecido
          </div>
        )}
      </div>

      {/* Rodapé com ações */}
      <div className="flex items-center border-t border-neutral-50 divide-x divide-neutral-50">
        <button
          onClick={() => onEditar(prato)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-neutral-600 active:bg-neutral-50 transition-colors"
        >
          <Edit3 size={13} />
          Editar
        </button>
        <button
          onClick={() => onToggle(prato.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black transition-colors active:bg-neutral-50 ${
            prato.ativo ? "text-neutral-500" : "text-emerald-600"
          }`}
        >
          {prato.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          {prato.ativo ? "Pausar" : "Ativar"}
        </button>
        <button
          onClick={() => onDeletar(prato.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-rose-400 active:bg-rose-50 transition-colors"
        >
          <Trash2 size={13} />
          Remover
        </button>
      </div>
    </div>
  );
}

// ─── Formulário: Adicionar / Editar Prato ─────────────────────────────────────
function FormPrato({ inicial, onSalvar, onCancelar }) {
  const [nome,       setNome]      = useState(inicial?.nome       ?? "");
  const [categoria,  setCategoria] = useState(inicial?.categoria  ?? "Marmita");
  const [preco,      setPreco]     = useState(inicial?.preco_venda ?? "");
  const [fichaId,    setFichaId]   = useState(inicial?.ficha_id   ?? "");
  const [erro,       setErro]      = useState("");

  const fichaPreview = fichaId ? FICHAS_MOCK.find((f) => f.id === fichaId) : null;
  const custoPreview = calcCustoFicha(fichaPreview);
  const precoN       = parseFloat(preco) || 0;
  const mc_pct       = precoN > 0 ? ((precoN - custoPreview) / precoN) * 100 : null;
  const margem_ok    = mc_pct !== null && mc_pct >= 30;

  function handleSalvar() {
    if (!nome.trim())    { setErro("Informe o nome do prato."); return; }
    if (!preco || precoN <= 0) { setErro("Informe um preço de venda válido."); return; }
    setErro("");
    onSalvar({
      id:          inicial?.id ?? `prato_${Date.now()}`,
      nome:        nome.trim(),
      categoria,
      preco_venda: precoN,
      ficha_id:    fichaId || null,
      ativo:       inicial?.ativo ?? true,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <p className="text-sm font-black text-neutral-900">
        {inicial ? "Editar Prato" : "Novo Prato"}
      </p>

      {/* Nome */}
      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
          Nome do Prato
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => { setNome(e.target.value); setErro(""); }}
          placeholder="ex: Marmitex Executiva"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 placeholder:text-neutral-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all"
        />
      </div>

      {/* Categoria */}
      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
          Categoria
        </label>
        <div className="relative">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all pr-10"
          >
            {CATEGORIAS.filter((c) => c !== "Todos").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* Preço de Venda */}
      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
          Preço de Venda (R$)
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={preco}
          onChange={(e) => { setPreco(e.target.value); setErro(""); }}
          placeholder="ex: 19.90"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-base font-black text-neutral-900 placeholder:text-neutral-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all"
        />
      </div>

      {/* Ficha Técnica */}
      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
          Ficha Técnica (opcional)
        </label>
        <div className="relative">
          <select
            value={fichaId}
            onChange={(e) => setFichaId(e.target.value)}
            className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all pr-10"
          >
            <option value="">— Sem ficha vinculada —</option>
            {FICHAS_MOCK.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* Preview de MC em tempo real */}
      {fichaPreview && precoN > 0 && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            margem_ok ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
          }`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${margem_ok ? "text-emerald-500" : "text-rose-400"}`}>
                Preview de Margem
              </p>
              <p className={`text-xl font-black ${margem_ok ? "text-emerald-800" : "text-rose-700"}`}>
                MC {fmtPct(mc_pct)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-neutral-500 font-medium">Custo</p>
              <p className="text-base font-black text-neutral-700">{fmtBRL(custoPreview)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-rose-500 flex-shrink-0" />
          <p className="text-xs font-bold text-rose-700">{erro}</p>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancelar}
          className="flex-1 py-3.5 rounded-xl font-black text-sm text-neutral-700 bg-neutral-100 active:scale-95 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-[#10b981] active:scale-95 transition-all shadow-md"
        >
          {inicial ? "Salvar Alterações" : "Adicionar Prato"}
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function CardapioPage() {
  const router = useRouter();

  const [pratos,       setPratos]      = useState(PRATOS_SEED);
  const [busca,        setBusca]       = useState("");
  const [catFiltro,    setCatFiltro]   = useState("Todos");
  const [formAberto,   setFormAberto]  = useState(false);
  const [pratoEditar,  setPratoEditar] = useState(null); // null = novo prato
  const [salvou,       setSalvou]      = useState(false);

  // ── Métricas resumo ────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const ativos = pratos.filter((p) => p.ativo);
    const comFicha = ativos.filter((p) => p.ficha_id);
    const mcs = comFicha.map((p) => {
      const ficha = FICHAS_MOCK.find((f) => f.id === p.ficha_id);
      const custo = calcCustoFicha(ficha);
      const preco = parseFloat(p.preco_venda) || 0;
      return preco > 0 ? ((preco - custo) / preco) * 100 : 0;
    });
    const media_mc  = mcs.length > 0 ? mcs.reduce((a, b) => a + b, 0) / mcs.length : 0;
    const criticos  = mcs.filter((mc) => mc < 30).length;
    const saudaveis = mcs.filter((mc) => mc >= 30).length;
    return { total: pratos.length, ativos: ativos.length, media_mc, criticos, saudaveis };
  }, [pratos]);

  // ── Filtragem ─────────────────────────────────────────────────────────────
  const pratosFiltrados = useMemo(() => {
    return pratos.filter((p) => {
      const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
      const matchCat   = catFiltro === "Todos" || p.categoria === catFiltro;
      return matchBusca && matchCat;
    });
  }, [pratos, busca, catFiltro]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSalvarPrato(prato) {
    if (pratoEditar) {
      setPratos((prev) => prev.map((p) => (p.id === prato.id ? prato : p)));
    } else {
      setPratos((prev) => [...prev, prato]);
    }
    setFormAberto(false);
    setPratoEditar(null);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
    // TODO: supabase.from('cardapio').upsert(prato)
  }

  function handleToggle(id) {
    setPratos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p))
    );
    // TODO: supabase.from('cardapio').update({ ativo: !prato.ativo }).eq('id', id)
  }

  function handleDeletar(id) {
    setPratos((prev) => prev.filter((p) => p.id !== id));
    // TODO: supabase.from('cardapio').delete().eq('id', id)
  }

  function handleEditar(prato) {
    setPratoEditar(prato);
    setFormAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAbrirNovo() {
    setPratoEditar(null);
    setFormAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fbf9f5]">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} className="text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Cardápio</h1>
          <p className="text-[11px] text-neutral-400 font-medium">Pratos, preços e margem de contribuição</p>
        </div>
        <button
          onClick={handleAbrirNovo}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-[#10b981] text-white shadow-md active:scale-95 transition-all"
        >
          <Plus size={14} />
          Novo Prato
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Toast de salvo */}
        {salvou && (
          <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-2xl px-4 py-3">
            <Check size={15} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-black text-emerald-800">Cardápio atualizado!</p>
          </div>
        )}

        {/* Formulário (condicional) */}
        {formAberto && (
          <FormPrato
            inicial={pratoEditar}
            onSalvar={handleSalvarPrato}
            onCancelar={() => { setFormAberto(false); setPratoEditar(null); }}
          />
        )}

        {/* ── Cards de Resumo ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-[#10b981]/10 flex items-center justify-center mb-2">
              <BookOpen size={16} className="text-[#10b981]" />
            </div>
            <p className="text-2xl font-black text-neutral-900">{resumo.ativos}</p>
            <p className="text-[11px] font-bold text-neutral-400">Pratos ativos</p>
          </div>
          <div
            className={`rounded-2xl border shadow-sm p-4 ${
              resumo.media_mc >= 30
                ? "bg-emerald-50 border-emerald-200"
                : "bg-rose-50 border-rose-200"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${
                resumo.media_mc >= 30 ? "bg-emerald-100" : "bg-rose-100"
              }`}
            >
              <TrendingUp size={16} className={resumo.media_mc >= 30 ? "text-emerald-600" : "text-rose-500"} />
            </div>
            <p className={`text-2xl font-black ${resumo.media_mc >= 30 ? "text-emerald-800" : "text-rose-700"}`}>
              {fmtPct(resumo.media_mc)}
            </p>
            <p className={`text-[11px] font-bold ${resumo.media_mc >= 30 ? "text-emerald-600" : "text-rose-500"}`}>
              MC média do cardápio
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
              <Check size={16} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-800">{resumo.saudaveis}</p>
            <p className="text-[11px] font-bold text-neutral-400">MC ≥ 30% (saudável)</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center mb-2">
              <AlertCircle size={16} className="text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-700">{resumo.criticos}</p>
            <p className="text-[11px] font-bold text-neutral-400">CMV crítico (&lt;30%)</p>
          </div>
        </div>

        {/* ── Atalhos para módulos interligados ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/dashboard/operacao/fichas")}
            className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-4 py-3.5 flex items-center gap-3 active:scale-95 transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
              <ChefHat size={17} className="text-neutral-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-neutral-900">Fichas Técnicas</p>
              <p className="text-[10px] text-neutral-400 font-medium">Composição e custo</p>
            </div>
            <ArrowRight size={14} className="text-neutral-300 group-active:translate-x-1 transition-transform flex-shrink-0" />
          </button>
          <button
            onClick={() => router.push("/dashboard/operacao/ingredientes")}
            className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-4 py-3.5 flex items-center gap-3 active:scale-95 transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
              <FlaskConical size={17} className="text-neutral-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-neutral-900">Ingredientes</p>
              <p className="text-[10px] text-neutral-400 font-medium">Catálogo e custos</p>
            </div>
            <ArrowRight size={14} className="text-neutral-300 group-active:translate-x-1 transition-transform flex-shrink-0" />
          </button>
        </div>

        {/* ── Busca + Filtro ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar prato..."
              className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all shadow-sm"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X size={15} className="text-neutral-400" />
              </button>
            )}
          </div>

          {/* Chips de categoria */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFiltro(cat)}
                className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                  catFiltro === cat
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 border border-neutral-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Lista de Pratos ──────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
              {catFiltro === "Todos" ? "Todos os Pratos" : catFiltro}
            </p>
            <p className="text-[11px] font-bold text-neutral-400">
              {pratosFiltrados.length} prato{pratosFiltrados.length !== 1 ? "s" : ""}
            </p>
          </div>

          {pratosFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-1">
                <BookOpen size={22} className="text-neutral-300" />
              </div>
              <p className="text-sm font-bold text-neutral-500">
                {busca ? "Nenhum prato encontrado" : "Cardápio vazio"}
              </p>
              <p className="text-xs text-neutral-400 font-medium">
                {busca
                  ? `Nenhum resultado para "${busca}"`
                  : "Clique em Novo Prato para adicionar o primeiro item."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pratosFiltrados.map((prato) => (
                <CardPrato
                  key={prato.id}
                  prato={prato}
                  onEditar={handleEditar}
                  onToggle={handleToggle}
                  onDeletar={handleDeletar}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
