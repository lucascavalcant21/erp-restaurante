"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChefHat,
  FlaskConical,
  Edit3,
  ChevronDown,
  ArrowRight,
  Info,
  Check,
  AlertCircle,
  Beef,
  Droplets,
  Package,
  Leaf,
  Box,
} from "lucide-react";

import {
  INGREDIENTES_SEED,
  UNIDADES,
  calcCustoUnitario,
  calcCustoLinha,
  getIngredienteById,
  getUnidade,
} from "../../../lib/ingredientes";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val, decimais = 2) {
  return Number(val).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

function fmtQtd(quantidade, unidade_id) {
  const u = getUnidade(unidade_id);
  return `${quantidade} ${u.base}`;
}

// ─── Ícone / Cor por unidade ────────────────────────────────────────────────
const ICONE_UN = { KG: Beef, L: Droplets, UN: Package, MACO: Leaf, CX: Box };
const COR_UN = {
  KG:   { bg: "#fef3c7", text: "#d97706" },
  L:    { bg: "#dbeafe", text: "#2563eb" },
  UN:   { bg: "#f3e8ff", text: "#7c3aed" },
  MACO: { bg: "#dcfce7", text: "#16a34a" },
  CX:   { bg: "#fce7f3", text: "#be185d" },
};
function IcUn({ unidade, size = 15 }) {
  const Ic = ICONE_UN[unidade] ?? Package;
  return <Ic size={size} />;
}

// ─── Ingredientes em memória (mock — substituir por Supabase) ─────────────────
// Supabase: const { data: catalogo } = await supabase.from('ingredientes').select('*')
const CATALOGO = INGREDIENTES_SEED.map((i) => ({
  ...i,
  custo_por_unidade_base: calcCustoUnitario(i.preco_compra, i.unidade),
}));

// ─── Ficha de demonstração pré-carregada ──────────────────────────────────────
// Representa a "Marmitex Executiva" com 3 linhas já compostas
const FICHA_DEMO = {
  id:          "ficha_001",
  nome:        "Marmitex Executiva",
  preco_venda: 19.90,
  itens: [
    { id: "l1", ingrediente_id: 1, quantidade: 150 }, // 150g Carne Moída
    { id: "l2", ingrediente_id: 2, quantidade: 200 }, // 200g Arroz
    { id: "l3", ingrediente_id: 3, quantidade: 1   }, // 1 Embalagem
  ],
};

// ─── Componente — linha da receita ─────────────────────────────────────────────
function LinhaReceita({ item, catalogo, onRemover }) {
  const ing = getIngredienteById(item.ingrediente_id, catalogo);
  if (!ing) return null;

  const custo = calcCustoLinha(ing, item.quantidade);
  const cor   = COR_UN[ing.unidade] ?? { bg: "#f5f5f5", text: "#737373" };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 group">
      {/* Ícone */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: cor.bg, color: cor.text }}
      >
        <IcUn unidade={ing.unidade} />
      </div>

      {/* Dados */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-neutral-900 truncate">{ing.nome}</p>
        <p className="text-[11px] text-neutral-400 font-medium">
          {fmtQtd(item.quantidade, ing.unidade)}
          {" · "}
          <span className="text-neutral-500">
            {fmtBRL(ing.custo_por_unidade_base, ing.custo_por_unidade_base < 0.01 ? 4 : 2)}
            {" "}
            {getUnidade(ing.unidade).label_base}
          </span>
        </p>
      </div>

      {/* Custo da linha */}
      <div className="text-right flex-shrink-0 mr-1">
        <p className="text-base font-black text-neutral-900">{fmtBRL(custo)}</p>
      </div>

      {/* Remover */}
      <button
        onClick={() => onRemover(item.id)}
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 border border-rose-100 active:scale-90 transition-transform flex-shrink-0"
      >
        <Trash2 size={12} className="text-rose-400" />
      </button>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function FichasTecnicasPage() {
  const router = useRouter();

  // Catálogo de ingredientes (em produção: fetch do Supabase na montagem)
  const [catalogo] = useState(CATALOGO);

  // Ficha em edição
  const [ficha, setFicha]         = useState(FICHA_DEMO);
  const [editandoNome, setEditandoNome] = useState(false);
  const [editandoPreco, setEditandoPreco] = useState(false);
  const nomeRef  = useRef(null);
  const precoRef = useRef(null);

  // Formulário de adição de insumo
  const [selIngId,  setSelIngId]  = useState(String(catalogo[0]?.id ?? ""));
  const [qtdInput,  setQtdInput]  = useState("");
  const [erroForm,  setErroForm]  = useState("");
  const [salvou,    setSalvou]    = useState(false);

  // ── Cálculos em tempo real ─────────────────────────────────────────────────
  const { custo_total, itens_calculados } = useMemo(() => {
    let total = 0;
    const calculados = ficha.itens.map((item) => {
      const ing   = getIngredienteById(item.ingrediente_id, catalogo);
      const custo = ing ? calcCustoLinha(ing, item.quantidade) : 0;
      total += custo;
      return { ...item, custo };
    });
    return { custo_total: total, itens_calculados: calculados };
  }, [ficha.itens, catalogo]);

  const preco       = parseFloat(ficha.preco_venda) || 0;
  const mc_reais    = preco - custo_total;
  const mc_pct      = preco > 0 ? (mc_reais / preco) * 100 : 0;
  const cmv_pct     = preco > 0 ? (custo_total / preco) * 100 : 0;
  const margem_ok   = mc_pct >= 30;

  // ── Ingrediente selecionado no form ────────────────────────────────────────
  const ingSelecionado = getIngredienteById(selIngId, catalogo);
  const unidadeBase    = ingSelecionado ? getUnidade(ingSelecionado.unidade) : null;
  const previewCusto   =
    ingSelecionado && qtdInput && !isNaN(parseFloat(qtdInput))
      ? calcCustoLinha(ingSelecionado, parseFloat(qtdInput))
      : null;

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleAdicionarInsumo() {
    const qtd = parseFloat(qtdInput);
    if (!selIngId) { setErroForm("Selecione um ingrediente."); return; }
    if (!qtdInput || isNaN(qtd) || qtd <= 0) { setErroForm("Informe uma quantidade válida maior que zero."); return; }

    const novoItem = {
      id:             `l${Date.now()}`,
      ingrediente_id: parseInt(selIngId),
      quantidade:     qtd,
    };

    setFicha((prev) => ({ ...prev, itens: [...prev.itens, novoItem] }));
    setQtdInput("");
    setErroForm("");
  }

  function handleRemoverItem(itemId) {
    setFicha((prev) => ({ ...prev, itens: prev.itens.filter((i) => i.id !== itemId) }));
  }

  function handleSalvarFicha() {
    // TODO: persistir no Supabase:
    //   supabase.from('fichas').upsert({
    //     id: ficha.id, nome: ficha.nome, preco_venda: ficha.preco_venda,
    //     custo_total, mc_reais, mc_pct, updated_at: new Date()
    //   })
    //   supabase.from('ficha_itens').upsert(ficha.itens.map(i => ({ ...i, ficha_id: ficha.id })))
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Ficha Técnica</h1>
          <p className="text-[11px] text-neutral-400 font-medium">Composição de receita e CMV</p>
        </div>
        <button
          onClick={handleSalvarFicha}
          className={`flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl shadow-md active:scale-95 transition-all ${
            salvou
              ? "bg-emerald-100 text-emerald-700"
              : "bg-[#10b981] text-white"
          }`}
        >
          {salvou ? <><Check size={13} /> Salvo</> : "Salvar"}
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Card do Prato */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
              <ChefHat size={20} className="text-[#10b981]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Nome do Prato</p>
              {editandoNome ? (
                <input
                  ref={nomeRef}
                  autoFocus
                  value={ficha.nome}
                  onChange={(e) => setFicha((p) => ({ ...p, nome: e.target.value }))}
                  onBlur={() => setEditandoNome(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditandoNome(false)}
                  className="text-lg font-black text-neutral-900 bg-transparent border-b-2 border-[#10b981] outline-none w-full"
                />
              ) : (
                <button
                  onClick={() => { setEditandoNome(true); setTimeout(() => nomeRef.current?.focus(), 50); }}
                  className="flex items-center gap-1.5 active:opacity-70 w-full text-left"
                >
                  <p className="text-lg font-black text-neutral-900 truncate">{ficha.nome}</p>
                  <Edit3 size={13} className="text-neutral-400 flex-shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* Preço de Venda */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Preço de Venda</p>
            {editandoPreco ? (
              <div className="flex items-center gap-1">
                <span className="text-2xl font-black text-neutral-400">R$</span>
                <input
                  ref={precoRef}
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={ficha.preco_venda}
                  onChange={(e) => setFicha((p) => ({ ...p, preco_venda: e.target.value }))}
                  onBlur={() => setEditandoPreco(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditandoPreco(false)}
                  className="text-3xl font-black text-neutral-900 bg-transparent border-b-2 border-[#10b981] outline-none w-32"
                />
              </div>
            ) : (
              <button
                onClick={() => { setEditandoPreco(true); setTimeout(() => precoRef.current?.focus(), 50); }}
                className="flex items-center gap-2 active:opacity-70"
              >
                <p className="text-3xl font-black text-neutral-900">{fmtBRL(preco)}</p>
                <Edit3 size={15} className="text-neutral-400" />
              </button>
            )}
          </div>
        </div>

        {/* ── Super Card de CMV ──────────────────────────────────────────────── */}
        <div
          className={`rounded-2xl border-2 p-5 transition-all duration-300 ${
            ficha.itens.length === 0
              ? "bg-neutral-50 border-neutral-200"
              : margem_ok
              ? "bg-emerald-50 border-emerald-200"
              : "bg-rose-50 border-rose-200"
          }`}
        >
          <p
            className={`text-[10px] font-black uppercase tracking-wider mb-1 ${
              ficha.itens.length === 0
                ? "text-neutral-400"
                : margem_ok
                ? "text-emerald-500"
                : "text-rose-400"
            }`}
          >
            Custo Total de Produção (CMV)
          </p>

          {/* Número gigante */}
          <p
            className={`text-6xl font-black leading-none mb-1 ${
              ficha.itens.length === 0
                ? "text-neutral-300"
                : margem_ok
                ? "text-emerald-800"
                : "text-rose-700"
            }`}
          >
            {fmtBRL(custo_total)}
          </p>

          {ficha.itens.length > 0 && (
            <>
              <p
                className={`text-sm font-bold mb-4 ${
                  margem_ok ? "text-emerald-600" : "text-rose-500"
                }`}
              >
                {fmtBRL(mc_reais)} de margem · {mc_pct.toFixed(1)}% MC · CMV {cmv_pct.toFixed(1)}%
              </p>

              {/* Barra dupla: CMV vs MC */}
              <div className="h-3 bg-white/60 rounded-full overflow-hidden flex mb-3">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${Math.min(cmv_pct, 100)}%`, backgroundColor: margem_ok ? "#10b981" : "#f43f5e" }}
                />
                <div
                  className="h-full opacity-30 flex-1"
                  style={{ backgroundColor: margem_ok ? "#10b981" : "#f43f5e" }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold mb-3">
                <span className={margem_ok ? "text-emerald-600" : "text-rose-500"}>
                  ← CMV {cmv_pct.toFixed(1)}%
                </span>
                <span className="text-neutral-400">
                  MC {mc_pct.toFixed(1)}% →
                </span>
              </div>

              {/* Alerta / OK */}
              {!margem_ok && (
                <div className="flex items-center gap-2 bg-rose-100 rounded-xl px-3 py-2.5 mb-3">
                  <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
                  <p className="text-xs font-black text-rose-700">
                    Atenção: Margem abaixo de 30% — prato com CMV crítico!
                  </p>
                </div>
              )}
              {margem_ok && (
                <div className="flex items-center gap-2 bg-emerald-100 rounded-xl px-3 py-2.5 mb-3">
                  <Check size={14} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-xs font-black text-emerald-800">
                    Composição saudável — prato viável para operação.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Nota explicativa */}
          <div className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2.5">
            <Info size={13} className="text-neutral-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">
              Este valor representa o custo bruto do prato e será enviado para o módulo de{" "}
              <span className="font-bold text-neutral-700">Cardápio</span> para calcular sua
              margem de lucro real sobre o preço de venda.
            </p>
          </div>
        </div>

        {/* ── Formulário: Adicionar Insumo ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center">
              <FlaskConical size={15} className="text-neutral-600" />
            </div>
            <p className="text-sm font-black text-neutral-900">Adicionar Insumo à Receita</p>
          </div>

          {/* Select de ingrediente */}
          <div className="mb-3">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
              Ingrediente
            </label>
            <div className="relative">
              <select
                value={selIngId}
                onChange={(e) => { setSelIngId(e.target.value); setErroForm(""); }}
                className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all pr-10"
              >
                {catalogo.map((ing) => (
                  <option key={ing.id} value={String(ing.id)}>
                    {ing.nome} — {fmtBRL(ing.custo_por_unidade_base, ing.custo_por_unidade_base < 0.01 ? 4 : 2)}{" "}
                    {getUnidade(ing.unidade).label_base}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          {/* Quantidade */}
          <div className="mb-3">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
              Quantidade utilizada{unidadeBase ? ` (${unidadeBase.base})` : ""}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              value={qtdInput}
              onChange={(e) => { setQtdInput(e.target.value); setErroForm(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAdicionarInsumo()}
              placeholder={unidadeBase?.base === "g" ? "ex: 150" : unidadeBase?.base === "mL" ? "ex: 30" : "ex: 1"}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-base font-black text-neutral-900 placeholder:text-neutral-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all"
            />
          </div>

          {/* Preview de custo em tempo real */}
          {previewCusto !== null && (
            <div className="flex items-center justify-between bg-[#10b981]/8 border border-[#10b981]/20 rounded-xl px-4 py-2.5 mb-3">
              <p className="text-[11px] font-bold text-neutral-600">
                {fmtQtd(parseFloat(qtdInput), ingSelecionado?.unidade ?? "UN")} ×{" "}
                {ingSelecionado?.nome}
              </p>
              <p className="text-base font-black text-[#10b981]">{fmtBRL(previewCusto)}</p>
            </div>
          )}

          {/* Erro */}
          {erroForm && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-3">
              <AlertCircle size={13} className="text-rose-500 flex-shrink-0" />
              <p className="text-xs font-bold text-rose-700">{erroForm}</p>
            </div>
          )}

          {/* Botão Adicionar */}
          <button
            onClick={handleAdicionarInsumo}
            className="w-full py-4 rounded-xl font-black text-sm text-white bg-neutral-900 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={16} />
            Adicionar Insumo à Receita
          </button>
        </div>

        {/* ── Lista de Itens da Receita ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
              Composição da Receita
            </p>
            <p className="text-[11px] font-bold text-neutral-400">
              {ficha.itens.length} insumo{ficha.itens.length !== 1 ? "s" : ""}
            </p>
          </div>

          {ficha.itens.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-1">
                <ChefHat size={22} className="text-neutral-300" />
              </div>
              <p className="text-sm font-bold text-neutral-500">Nenhum insumo adicionado</p>
              <p className="text-xs text-neutral-400 font-medium">
                Use o formulário acima para montar a receita do prato.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-50">
              {/* Cabeçalho da tabela */}
              <div className="flex items-center px-4 py-2 bg-neutral-50">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider flex-1">Ingrediente</p>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider w-16 text-right mr-8">Custo</p>
              </div>

              {/* Linhas */}
              {itens_calculados.map((item) => (
                <LinhaReceita
                  key={item.id}
                  item={item}
                  catalogo={catalogo}
                  onRemover={handleRemoverItem}
                />
              ))}

              {/* Rodapé total */}
              <div className="flex items-center justify-between px-4 py-3.5 bg-neutral-50 border-t border-neutral-200">
                <p className="text-sm font-black text-neutral-700">Total de Produção</p>
                <p className="text-lg font-black text-neutral-900">{fmtBRL(custo_total)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Link para Cardápio */}
        <button
          onClick={() => router.push("/dashboard/operacao/cardapio")}
          className="w-full flex items-center justify-between bg-white border border-neutral-100 rounded-2xl shadow-sm px-5 py-4 active:scale-95 transition-all group"
        >
          <div className="text-left">
            <p className="text-sm font-black text-neutral-900">Ir para Cardápio</p>
            <p className="text-[11px] text-neutral-400 font-medium">
              Vincular esta ficha a um prato e calcular margem final
            </p>
          </div>
          <ArrowRight size={18} className="text-neutral-400 group-active:translate-x-1 transition-transform" />
        </button>

      </div>
    </div>
  );
}
