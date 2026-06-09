"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  fetchIngredientes,
} from "../../../lib/ingredientes";
import { supabase, isSupabaseReady } from "../../../lib/supabase";
import { atualizarPrato } from "../../../lib/cardapio";

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

// Seed de fallback (usado quando Supabase não está pronto)
const CATALOGO_SEED = INGREDIENTES_SEED.map((i) => ({
  ...i,
  custo_por_unidade_base: calcCustoUnitario(i.preco_compra, i.unidade),
}));

// ─── Ficha de demonstração pré-carregada ──────────────────────────────────────
// Representa a "Marmitex Executiva" com 3 linhas já compostas
const FICHA_DEMO = {
  id:          null,
  nome:        "",
  preco_venda: 0,
  itens: [],
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
        <p className="text-sm font-black text-fg truncate">{ing.nome}</p>
        <p className="text-[11px] text-dim font-medium">
          {fmtQtd(item.quantidade, ing.unidade)}
          {" · "}
          <span className="text-subtle">
            {fmtBRL(ing.custo_por_unidade_base, ing.custo_por_unidade_base < 0.01 ? 4 : 2)}
            {" "}
            {getUnidade(ing.unidade).label_base}
          </span>
        </p>
      </div>

      {/* Custo da linha */}
      <div className="text-right flex-shrink-0 mr-1">
        <p className="text-base font-black text-fg">{fmtBRL(custo)}</p>
      </div>

      {/* Remover */}
      <button
        onClick={() => onRemover(item.id)}
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.2)] active:scale-90 transition-transform flex-shrink-0"
      >
        <Trash2 size={12} className="text-accent" />
      </button>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function FichasTecnicasPage() {
  const router = useRouter();

  // Catálogo de ingredientes — carregado do Supabase
  const [catalogo, setCatalogo] = useState(CATALOGO_SEED);

  useEffect(() => {
    fetchIngredientes().then(({ data }) => setCatalogo(data));
  }, []);

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

  async function handleSalvarFicha() {
    if (isSupabaseReady()) {
      // 1. Upsert da ficha técnica
      const fichaPayload = {
        nome: ficha.nome,
        preco_venda: preco,
        custo_total,
        prato_id: ficha.prato_id ?? null,
      };
      let fichaId = ficha.id;
      if (fichaId) {
        await supabase.from("fichas_tecnicas").update(fichaPayload).eq("id", fichaId);
      } else {
        const { data: novaFicha } = await supabase
          .from("fichas_tecnicas").insert([fichaPayload]).select().single();
        fichaId = novaFicha?.id;
        if (fichaId) setFicha((p) => ({ ...p, id: fichaId }));
      }

      // 2. Substitui itens da ficha (delete + insert)
      if (fichaId) {
        await supabase.from("ficha_itens").delete().eq("ficha_id", fichaId);
        const itensPayload = ficha.itens.map((it) => ({
          ficha_id: fichaId,
          ingrediente_id: it.ingrediente_id,
          quantidade: it.quantidade,
        }));
        if (itensPayload.length) await supabase.from("ficha_itens").insert(itensPayload);
      }

      // 3. Propaga custo para o cardápio automaticamente
      if (ficha.prato_id) {
        await atualizarPrato(ficha.prato_id, { custo: custo_total });
      }
    }
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen ">

      {/* Header */}
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3 flex items-center gap-3" style={{ background: '#0F172A' }}>
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Ficha Técnica</h1>
          <p className="text-[11px] text-dim font-medium">Composição de receita e CMV</p>
        </div>
        <button
          onClick={handleSalvarFicha}
          className={`flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl  active:scale-95 transition-all ${
            salvou
              ? "bg-emerald-100 text-emerald-700"
              : "bg-accent text-white"
          }`}
        >
          {salvou ? <><Check size={13} /> Salvo</> : "Salvar"}
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Card do Prato */}
        <div className="bg-card rounded-2xl border border-white/5  p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <ChefHat size={20} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-dim uppercase tracking-wider mb-0.5">Nome do Prato</p>
              {editandoNome ? (
                <input
                  ref={nomeRef}
                  autoFocus
                  value={ficha.nome}
                  onChange={(e) => setFicha((p) => ({ ...p, nome: e.target.value }))}
                  onBlur={() => setEditandoNome(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditandoNome(false)}
                  className="text-lg font-black text-fg bg-transparent border-b-2 border-accent outline-none w-full"
                />
              ) : (
                <button
                  onClick={() => { setEditandoNome(true); setTimeout(() => nomeRef.current?.focus(), 50); }}
                  className="flex items-center gap-1.5 active:opacity-70 w-full text-left"
                >
                  <p className="text-lg font-black text-fg truncate">{ficha.nome}</p>
                  <Edit3 size={13} className="text-dim flex-shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* Preço de Venda */}
          <div className=" rounded-xl border border-white/5 p-4">
            <p className="text-[10px] font-bold text-dim uppercase tracking-wider mb-1">Preço de Venda</p>
            {editandoPreco ? (
              <div className="flex items-center gap-1">
                <span className="text-2xl font-black text-dim">R$</span>
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
                  className="text-3xl font-black text-fg bg-transparent border-b-2 border-accent outline-none w-32"
                />
              </div>
            ) : (
              <button
                onClick={() => { setEditandoPreco(true); setTimeout(() => precoRef.current?.focus(), 50); }}
                className="flex items-center gap-2 active:opacity-70"
              >
                <p className="text-3xl font-black text-fg">{fmtBRL(preco)}</p>
                <Edit3 size={15} className="text-dim" />
              </button>
            )}
          </div>
        </div>

        {/* ── Super Card de CMV ──────────────────────────────────────────────── */}
        <div
          className={`rounded-2xl border-2 p-5 transition-all duration-300 ${
            ficha.itens.length === 0
              ? " border-white/8"
              : margem_ok
              ? "bg-emerald-50 border-emerald-200"
              : "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]"
          }`}
        >
          <p
            className={`text-[10px] font-black uppercase tracking-wider mb-1 ${
              ficha.itens.length === 0
                ? "text-dim"
                : margem_ok
                ? "text-emerald-500"
                : "text-accent"
            }`}
          >
            Custo Total de Produção (CMV)
          </p>

          {/* Número gigante */}
          <p
            className={`text-6xl font-black leading-none mb-1 ${
              ficha.itens.length === 0
                ? "text-elevated"
                : margem_ok
                ? "text-emerald-800"
                : "text-accent-strong"
            }`}
          >
            {fmtBRL(custo_total)}
          </p>

          {ficha.itens.length > 0 && (
            <>
              <p
                className={`text-sm font-bold mb-4 ${
                  margem_ok ? "text-emerald-600" : "text-accent"
                }`}
              >
                {fmtBRL(mc_reais)} de margem · {mc_pct.toFixed(1)}% MC · CMV {cmv_pct.toFixed(1)}%
              </p>

              {/* Barra dupla: CMV vs MC */}
              <div className="h-3 bg-card/60 rounded-full overflow-hidden flex mb-3">
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
                <span className={margem_ok ? "text-emerald-600" : "text-accent"}>
                  ← CMV {cmv_pct.toFixed(1)}%
                </span>
                <span className="text-dim">
                  MC {mc_pct.toFixed(1)}% →
                </span>
              </div>

              {/* Alerta / OK */}
              {!margem_ok && (
                <div className="flex items-center gap-2 bg-[rgba(5,150,105,0.15)] rounded-xl px-3 py-2.5 mb-3">
                  <AlertCircle size={14} className="text-accent flex-shrink-0" />
                  <p className="text-xs font-black text-accent-strong">
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
          <div className="flex items-start gap-2 bg-card/70 rounded-xl px-3 py-2.5">
            <Info size={13} className="text-dim flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-subtle font-medium leading-relaxed">
              Este valor representa o custo bruto do prato e será enviado para o módulo de{" "}
              <span className="font-bold text-fg-soft">Cardápio</span> para calcular sua
              margem de lucro real sobre o preço de venda.
            </p>
          </div>
        </div>

        {/* ── Formulário: Adicionar Insumo ──────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-white/5  p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-elevated flex items-center justify-center">
              <FlaskConical size={15} className="text-muted" />
            </div>
            <p className="text-sm font-black text-fg">Adicionar Insumo à Receita</p>
          </div>

          {/* Select de ingrediente */}
          <div className="mb-3">
            <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">
              Ingrediente
            </label>
            <div className="relative">
              <select
                value={selIngId}
                onChange={(e) => { setSelIngId(e.target.value); setErroForm(""); }}
                className="w-full appearance-none  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent transition-all pr-10" style={{ background: "#1E293B", color: "#F1F5F9" }} >
                {catalogo.map((ing) => (
                  <option key={ing.id} value={String(ing.id)}>
                    {ing.nome} — {fmtBRL(ing.custo_por_unidade_base, ing.custo_por_unidade_base < 0.01 ? 4 : 2)}{" "}
                    {getUnidade(ing.unidade).label_base}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
            </div>
          </div>

          {/* Quantidade */}
          <div className="mb-3">
            <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">
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
              className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-base font-black text-fg placeholder:text-dim placeholder:font-medium focus:outline-none focus:ring-2 focus:border-accent transition-all"
            />
          </div>

          {/* Preview de custo em tempo real */}
          {previewCusto !== null && (
            <div className="flex items-center justify-between bg-accent/8 border border-accent/20 rounded-xl px-4 py-2.5 mb-3">
              <p className="text-[11px] font-bold text-muted">
                {fmtQtd(parseFloat(qtdInput), ingSelecionado?.unidade ?? "UN")} ×{" "}
                {ingSelecionado?.nome}
              </p>
              <p className="text-base font-black text-accent">{fmtBRL(previewCusto)}</p>
            </div>
          )}

          {/* Erro */}
          {erroForm && (
            <div className="flex items-center gap-2 bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.3)] rounded-xl px-3 py-2.5 mb-3">
              <AlertCircle size={13} className="text-accent flex-shrink-0" />
              <p className="text-xs font-bold text-accent-strong">{erroForm}</p>
            </div>
          )}

          {/* Botão Adicionar */}
          <button
            onClick={handleAdicionarInsumo}
            className="w-full py-4 rounded-xl font-black text-sm text-white bg-accent-strong flex items-center justify-center gap-2 active:scale-95 transition-all "
          >
            <Plus size={16} />
            Adicionar Insumo à Receita
          </button>
        </div>

        {/* ── Lista de Itens da Receita ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-dim uppercase tracking-wider">
              Composição da Receita
            </p>
            <p className="text-[11px] font-bold text-dim">
              {ficha.itens.length} insumo{ficha.itens.length !== 1 ? "s" : ""}
            </p>
          </div>

          {ficha.itens.length === 0 ? (
            <div className="bg-card rounded-2xl border border-white/5  p-8 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center mb-1">
                <ChefHat size={22} className="text-elevated" />
              </div>
              <p className="text-sm font-bold text-subtle">Nenhum insumo adicionado</p>
              <p className="text-xs text-dim font-medium">
                Use o formulário acima para montar a receita do prato.
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-white/5  overflow-hidden divide-y divide-neutral-50">
              {/* Cabeçalho da tabela */}
              <div className="flex items-center px-4 py-2 ">
                <p className="text-[10px] font-black text-dim uppercase tracking-wider flex-1">Ingrediente</p>
                <p className="text-[10px] font-black text-dim uppercase tracking-wider w-16 text-right mr-8">Custo</p>
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
              <div className="flex items-center justify-between px-4 py-3.5  border-t border-white/8">
                <p className="text-sm font-black text-fg-soft">Custo Total</p>
                <p className="text-lg font-black text-accent">{fmtBRL(custo_total)}</p>
              </div>
            </div>
          )}

          {/* ── Indicadores ─────────────────────────────────────────────── */}
          {ficha.itens.length > 0 && preco > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "CMV", value: `${cmv_pct.toFixed(1)}%`, ok: cmv_pct < 35, desc: "Custo s/ Venda" },
                { label: "MC",  value: `${mc_pct.toFixed(1)}%`,  ok: margem_ok,   desc: "Margem Contrib." },
                { label: "MC R$", value: fmtBRL(mc_reais), ok: mc_reais > 0,  desc: "Lucro por Prato" },
              ].map((ind) => (
                <div key={ind.label} className={`rounded-2xl border px-3 py-3 text-center ${ind.ok ? "border-emerald-500/20 bg-[rgba(16,185,129,0.06)]" : "border-rose-500/20 bg-[rgba(244,63,94,0.06)]"}`}>
                  <p className={`text-base font-black ${ind.ok ? "text-accent" : "text-danger"}`}>{ind.value}</p>
                  <p className="text-[9px] font-black text-dim uppercase tracking-wider mt-0.5">{ind.label}</p>
                  <p className="text-[9px] text-elevated font-medium">{ind.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Botão Salvar ─────────────────────────────────────────────── */}
          <button
            onClick={handleSalvarFicha}
            disabled={!ficha.nome || ficha.itens.length === 0}
            className="w-full py-4 rounded-2xl font-black text-sm text-white bg-accent disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all "
          >
            {salvou ? "✓ Ficha Salva!" : "Salvar Ficha Técnica"}
          </button>
        </div>
      </div>
    </div>
  );
}
