"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  ChevronDown,
  Beef,
  Droplets,
  Package,
  Leaf,
  Box,
  Edit2,
  Trash2,
  FlaskConical,
  Check,
  AlertCircle,
} from "lucide-react";

import {
  INGREDIENTES_SEED,
  UNIDADES,
  calcCustoUnitario,
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

function fmtCustoFracionado(preco, unidade_id) {
  const custo = calcCustoUnitario(preco, unidade_id);
  const u = getUnidade(unidade_id);
  // Decide casas decimais: se custo < 0,01 usa 4 casas
  const casas = custo < 0.01 ? 4 : 2;
  return `${fmtBRL(custo, casas)} ${u.label_base}`;
}

function gerarId() {
  return Date.now();
}

// ─── Ícone por unidade ──────────────────────────────────────────────────────
const ICONE_UNIDADE = {
  KG:   Beef,
  L:    Droplets,
  UN:   Package,
  MACO: Leaf,
  CX:   Box,
};

function IconeUnidade({ unidade, size = 16, className = "" }) {
  const Icone = ICONE_UNIDADE[unidade] ?? Package;
  return <Icone size={size} className={className} />;
}

// ─── Cores por unidade ──────────────────────────────────────────────────────
const COR_UNIDADE = {
  KG:   { bg: "#fef3c7", text: "#d97706" },
  L:    { bg: "#dbeafe", text: "#2563eb" },
  UN:   { bg: "#f3e8ff", text: "#7c3aed" },
  MACO: { bg: "#dcfce7", text: "#16a34a" },
  CX:   { bg: "#fce7f3", text: "#be185d" },
};

function BadgeUnidade({ unidade }) {
  const cor = COR_UNIDADE[unidade] ?? { bg: "#f5f5f5", text: "#737373" };
  return (
    <span
      className="text-[10px] font-black px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cor.bg, color: cor.text }}
    >
      {unidade}
    </span>
  );
}

// ─── Estado inicial do formulário ─────────────────────────────────────────────
const FORM_VAZIO = { nome: "", unidade: "KG", preco_compra: "" };

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function IngredientesPage() {
  const router = useRouter();
  const inputNomeRef = useRef(null);

  const [ingredientes, setIngredientes] = useState(
    INGREDIENTES_SEED.map((i) => ({
      ...i,
      custo_por_unidade_base: calcCustoUnitario(i.preco_compra, i.unidade),
    }))
  );
  const [busca, setBusca]               = useState("");
  const [form, setForm]                 = useState(FORM_VAZIO);
  const [formAberto, setFormAberto]     = useState(false);
  const [editandoId, setEditandoId]     = useState(null);
  const [erroForm, setErroForm]         = useState("");
  const [deletandoId, setDeletandoId]   = useState(null);
  const [salvou, setSalvou]             = useState(false);

  // ── Lista filtrada ─────────────────────────────────────────────────────────
  const lista = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return ingredientes;
    return ingredientes.filter((i) => i.nome.toLowerCase().includes(q));
  }, [ingredientes, busca]);

  // ── Handlers de formulário ─────────────────────────────────────────────────
  function setField(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErroForm("");
  }

  function validarForm() {
    if (!form.nome.trim()) return "Informe o nome do ingrediente.";
    if (!form.preco_compra || isNaN(parseFloat(String(form.preco_compra).replace(",", ".")))) {
      return "Informe um preço de compra válido.";
    }
    if (parseFloat(String(form.preco_compra).replace(",", ".")) <= 0) {
      return "O preço deve ser maior que zero.";
    }
    return "";
  }

  function handleSalvar() {
    const erro = validarForm();
    if (erro) { setErroForm(erro); return; }

    const preco = parseFloat(String(form.preco_compra).replace(",", "."));
    const novo = {
      id:                    editandoId ?? gerarId(),
      nome:                  form.nome.trim(),
      unidade:               form.unidade,
      preco_compra:          preco,
      custo_por_unidade_base: calcCustoUnitario(preco, form.unidade),
    };

    if (editandoId !== null) {
      setIngredientes((prev) => prev.map((i) => (i.id === editandoId ? novo : i)));
    } else {
      setIngredientes((prev) => [...prev, novo]);
    }

    // TODO: persistir no Supabase:
    //   editandoId
    //     ? supabase.from('ingredientes').update(novo).eq('id', editandoId)
    //     : supabase.from('ingredientes').insert(novo)

    setForm(FORM_VAZIO);
    setEditandoId(null);
    setFormAberto(false);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
  }

  function handleEditar(ing) {
    setForm({
      nome:         ing.nome,
      unidade:      ing.unidade,
      preco_compra: String(ing.preco_compra),
    });
    setEditandoId(ing.id);
    setFormAberto(true);
    setTimeout(() => inputNomeRef.current?.focus(), 100);
  }

  function handleDeletar(id) {
    // TODO: supabase.from('ingredientes').delete().eq('id', id)
    setIngredientes((prev) => prev.filter((i) => i.id !== id));
    setDeletandoId(null);
  }

  function handleCancelar() {
    setForm(FORM_VAZIO);
    setEditandoId(null);
    setFormAberto(false);
    setErroForm("");
  }

  function abrirForm() {
    setFormAberto(true);
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setTimeout(() => inputNomeRef.current?.focus(), 100);
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
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Ingredientes</h1>
          <p className="text-[11px] text-neutral-400 font-medium">
            {ingredientes.length} insumo{ingredientes.length !== 1 ? "s" : ""} cadastrado{ingredientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={abrirForm}
          className="flex items-center gap-1.5 bg-[#10b981] text-white text-xs font-black px-3 py-2 rounded-xl shadow-md active:scale-95 transition-transform"
        >
          <Plus size={14} />
          Novo
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-3">

        {/* Toast de sucesso */}
        {salvou && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 animate-pulse">
            <Check size={16} className="text-emerald-600" />
            <p className="text-sm font-bold text-emerald-800">
              {editandoId !== null ? "Ingrediente atualizado!" : "Ingrediente salvo com sucesso!"}
            </p>
          </div>
        )}

        {/* Formulário de Cadastro / Edição */}
        {formAberto && (
          <div className="bg-white rounded-2xl border-2 border-[#10b981]/30 shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                  <FlaskConical size={15} className="text-[#10b981]" />
                </div>
                <p className="text-sm font-black text-neutral-900">
                  {editandoId !== null ? "Editar Ingrediente" : "Novo Ingrediente"}
                </p>
              </div>
              <button onClick={handleCancelar} className="p-1 rounded-lg active:bg-neutral-100">
                <X size={18} className="text-neutral-400" />
              </button>
            </div>

            {/* Nome */}
            <div className="mb-3">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
                Nome do Ingrediente
              </label>
              <input
                ref={inputNomeRef}
                type="text"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Ex: Carne Moída (Patinho)"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all"
              />
            </div>

            {/* Unidade + Preço */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
                  Unidade
                </label>
                <div className="relative">
                  <select
                    value={form.unidade}
                    onChange={(e) => setField("unidade", e.target.value)}
                    className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all pr-8"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">
                  Preço de Compra (R$)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.preco_compra}
                  onChange={(e) => setField("preco_compra", e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-black text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all text-right"
                />
              </div>
            </div>

            {/* Preview de custo fracionado em tempo real */}
            {form.preco_compra && parseFloat(String(form.preco_compra).replace(",", ".")) > 0 && (
              <div className="bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold text-neutral-500">Custo fracionado</p>
                <p className="text-sm font-black text-neutral-900">
                  {fmtCustoFracionado(
                    parseFloat(String(form.preco_compra).replace(",", ".")),
                    form.unidade
                  )}
                </p>
              </div>
            )}

            {/* Erro */}
            {erroForm && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-3">
                <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
                <p className="text-xs font-bold text-rose-700">{erroForm}</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2">
              <button
                onClick={handleCancelar}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-neutral-500 bg-neutral-100 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="flex-1 py-3 rounded-xl font-black text-sm text-white bg-[#10b981] shadow-md active:scale-95 transition-all"
              >
                {editandoId !== null ? "Atualizar" : "Salvar"}
              </button>
            </div>
          </div>
        )}

        {/* Barra de Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ingrediente…"
            className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-10 py-3 text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all shadow-sm"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={15} className="text-neutral-400" />
            </button>
          )}
        </div>

        {/* Lista de Ingredientes */}
        {lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-1">
              <FlaskConical size={22} className="text-neutral-400" />
            </div>
            <p className="text-sm font-bold text-neutral-700">
              {busca ? "Nenhum ingrediente encontrado" : "Nenhum ingrediente cadastrado"}
            </p>
            <p className="text-xs text-neutral-400 font-medium">
              {busca ? `Sem resultados para "${busca}"` : 'Toque em "+ Novo" para cadastrar o primeiro insumo.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((ing) => {
              const emDelecao = deletandoId === ing.id;
              return (
                <div
                  key={ing.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 ${
                    emDelecao ? "border-rose-200 bg-rose-50" : "border-neutral-100"
                  }`}
                >
                  {/* Linha principal */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Ícone */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: (COR_UNIDADE[ing.unidade] ?? { bg: "#f5f5f5" }).bg,
                        color:           (COR_UNIDADE[ing.unidade] ?? { text: "#737373" }).text,
                      }}
                    >
                      <IconeUnidade unidade={ing.unidade} size={18} />
                    </div>

                    {/* Dados */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-black text-neutral-900 truncate">{ing.nome}</p>
                        <BadgeUnidade unidade={ing.unidade} />
                      </div>
                      <p className="text-[11px] text-neutral-400 font-medium">
                        Compra: <span className="font-bold text-neutral-600">{fmtBRL(ing.preco_compra)}</span>
                        {" · "}
                        <span className="text-[#10b981] font-black">
                          {fmtCustoFracionado(ing.preco_compra, ing.unidade)}
                        </span>
                      </p>
                    </div>

                    {/* Ações */}
                    {!emDelecao ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEditar(ing)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-neutral-50 border border-neutral-100 active:scale-90 transition-transform"
                        >
                          <Edit2 size={13} className="text-neutral-500" />
                        </button>
                        <button
                          onClick={() => setDeletandoId(ing.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-rose-50 border border-rose-100 active:scale-90 transition-transform"
                        >
                          <Trash2 size={13} className="text-rose-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setDeletandoId(null)}
                          className="text-xs font-bold text-neutral-500 bg-neutral-100 rounded-xl px-2.5 py-1.5 active:scale-95 transition-transform"
                        >
                          Não
                        </button>
                        <button
                          onClick={() => handleDeletar(ing.id)}
                          className="text-xs font-black text-white bg-rose-500 rounded-xl px-2.5 py-1.5 active:scale-95 transition-transform"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Faixa de detalhe fracionado (expandida ao entrar em deleção) */}
                  {emDelecao && (
                    <div className="px-4 pb-3 pt-0">
                      <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                        <AlertCircle size={12} />
                        Tem certeza? Fichas técnicas que usam este insumo precisarão ser revisadas.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Nota de arquitetura */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-5 py-4">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">
            Como a Ficha Técnica usa estes dados
          </p>
          <div className="space-y-1.5">
            {[
              { ing: "Carne Moída", qtd: "150g", custo: "R$ 5,25" },
              { ing: "Arroz Agulhinha", qtd: "200g", custo: "R$ 1,20" },
              { ing: "Embalagem Marmita", qtd: "1 un", custo: "R$ 0,60" },
            ].map((ex) => (
              <div key={ex.ing} className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500 font-medium">{ex.ing} × {ex.qtd}</span>
                <span className="font-black text-neutral-800">{ex.custo}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs border-t border-dashed border-neutral-200 pt-1.5 mt-1">
              <span className="font-black text-neutral-700">Custo Total da Marmitex</span>
              <span className="font-black text-[#10b981]">R$ 7,05</span>
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 font-medium mt-2.5 leading-relaxed">
            A Ficha Técnica busca cada ingrediente por <code className="bg-neutral-100 px-1 rounded text-[10px]">id</code> e multiplica o custo/grama pela quantidade usada na receita.
          </p>
        </div>

      </div>
    </div>
  );
}
