"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  fetchIngredientes,
  inserirIngrediente,
  atualizarIngrediente,
  removerIngrediente,
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

  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busca, setBusca]               = useState("");
  const [form, setForm]                 = useState(FORM_VAZIO);
  const [formAberto, setFormAberto]     = useState(false);
  const [editandoId, setEditandoId]     = useState(null);
  const [erroForm, setErroForm]         = useState("");
  const [deletandoId, setDeletandoId]   = useState(null);
  const [salvou, setSalvou]             = useState(false);

  // ── Carrega do Supabase na montagem ───────────────────────────────────────
  useEffect(() => {
    fetchIngredientes().then(({ data }) => {
      setIngredientes(data);
      setLoading(false);
    });
  }, []);

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
      setIngredientes((prev) => prev.map((i) => (i.id === editandoId ? { ...i, ...novo } : i)));
      atualizarIngrediente(editandoId, novo); // async — propaga para fichas/cardápio automaticamente
    } else {
      inserirIngrediente(novo).then(({ data }) => {
        if (data) setIngredientes((prev) => [...prev, data]);
      });
    }

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
    removerIngrediente(id);
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
    <div className="min-h-screen ">

      {/* Header */}
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3 flex items-center gap-3" style={{ background: '#0F172A' }}>
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-[#1E293B] border border-white/8 flex items-center justify-center  active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} className="text-[#94A3B8]" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Ingredientes</h1>
          <p className="text-[11px] text-[#475569] font-medium">
            {ingredientes.length} insumo{ingredientes.length !== 1 ? "s" : ""} cadastrado{ingredientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={abrirForm}
          className="flex items-center gap-1.5 bg-[#10b981] text-white text-xs font-black px-3 py-2 rounded-xl  active:scale-95 transition-transform"
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
          <div className="bg-[#1E293B] rounded-2xl border-2 border-[#10b981]/30  p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                  <FlaskConical size={15} className="text-[#10b981]" />
                </div>
                <p className="text-sm font-black text-[#F1F5F9]">
                  {editandoId !== null ? "Editar Ingrediente" : "Novo Ingrediente"}
                </p>
              </div>
              <button onClick={handleCancelar} className="p-1 rounded-lg active:bg-[#334155]">
                <X size={18} className="text-[#475569]" />
              </button>
            </div>

            {/* Nome */}
            <div className="mb-3">
              <label className="text-[10px] font-black text-[#475569] uppercase tracking-wider block mb-1.5">
                Nome do Ingrediente
              </label>
              <input
                ref={inputNomeRef}
                type="text"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Ex: Carne Moída (Patinho)"
                className="w-full  border border-white/8 rounded-xl px-4 py-3 text-sm font-bold text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all"
              />
            </div>

            {/* Unidade + Preço */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-black text-[#475569] uppercase tracking-wider block mb-1.5">
                  Unidade
                </label>
                <div className="relative">
                  <select
                    value={form.unidade}
                    onChange={(e) => setField("unidade", e.target.value)}
                    className="w-full appearance-none  border border-white/8 rounded-xl px-3 py-3 text-sm font-bold text-[#F1F5F9] focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all pr-8" style={{ background: "#1E293B", color: "#F1F5F9" }} >
                    {UNIDADES.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#475569] uppercase tracking-wider block mb-1.5">
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
                  className="w-full  border border-white/8 rounded-xl px-3 py-3 text-sm font-black text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all text-right"
                />
              </div>
            </div>

            {/* Preview de custo fracionado em tempo real */}
            {form.preco_compra && parseFloat(String(form.preco_compra).replace(",", ".")) > 0 && (
              <div className=" border border-white/5 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold text-[#64748B]">Custo fracionado</p>
                <p className="text-sm font-black text-[#F1F5F9]">
                  {fmtCustoFracionado(
                    parseFloat(String(form.preco_compra).replace(",", ".")),
                    form.unidade
                  )}
                </p>
              </div>
            )}

            {/* Erro */}
            {erroForm && (
              <div className="flex items-center gap-2 bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.3)] rounded-xl px-3 py-2.5 mb-3">
                <AlertCircle size={14} className="text-[#10b981] flex-shrink-0" />
                <p className="text-xs font-bold text-[#059669]">{erroForm}</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2">
              <button
                onClick={handleCancelar}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-[#64748B] bg-[#334155] active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="flex-1 py-3 rounded-xl font-black text-sm text-white bg-[#10b981]  active:scale-95 transition-all"
              >
                {editandoId !== null ? "Atualizar" : "Salvar"}
              </button>
            </div>
          </div>
        )}

        {/* Barra de Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ingrediente…"
            className="w-full bg-[#1E293B] border border-white/8 rounded-xl pl-10 pr-10 py-3 text-sm font-medium text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:border-[#10b981] transition-all "
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={15} className="text-[#475569]" />
            </button>
          )}
        </div>

        {/* Lista de Ingredientes */}
        {lista.length === 0 ? (
          <div className="bg-[#1E293B] rounded-2xl border border-white/5  p-8 flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#334155] flex items-center justify-center mb-1">
              <FlaskConical size={22} className="text-[#475569]" />
            </div>
            <p className="text-sm font-bold text-[#CBD5E1]">
              {busca ? "Nenhum ingrediente encontrado" : "Nenhum ingrediente cadastrado"}
            </p>
            <p className="text-xs text-[#475569] font-medium">
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
                  className={`bg-[#1E293B] rounded-2xl border  overflow-hidden transition-all duration-200 ${
                    emDelecao ? "border-[rgba(5,150,105,0.3)] bg-[rgba(5,150,105,0.1)]" : "border-white/5"
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
                        <p className="text-sm font-black text-[#F1F5F9] truncate">{ing.nome}</p>
                        <BadgeUnidade unidade={ing.unidade} />
                      </div>
                      <p className="text-[11px] text-[#475569] font-medium">
                        Compra: <span className="font-bold text-[#94A3B8]">{fmtBRL(ing.preco_compra)}</span>
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
                          className="w-8 h-8 rounded-xl flex items-center justify-center  border border-white/5 active:scale-90 transition-transform"
                        >
                          <Edit2 size={13} className="text-[#64748B]" />
                        </button>
                        <button
                          onClick={() => setDeletandoId(ing.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.2)] active:scale-90 transition-transform"
                        >
                          <Trash2 size={13} className="text-[#10b981]" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setDeletandoId(null)}
                          className="text-xs font-bold text-[#64748B] bg-[#334155] rounded-xl px-2.5 py-1.5 active:scale-95 transition-transform"
                        >
                          Não
                        </button>
                        <button
                          onClick={() => handleDeletar(ing.id)}
                          className="text-xs font-black text-white bg-[rgba(5,150,105,0.1)]0 rounded-xl px-2.5 py-1.5 active:scale-95 transition-transform"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Faixa de detalhe fracionado (expandida ao entrar em deleção) */}
                  {emDelecao && (
                    <div className="px-4 pb-3 pt-0">
                      <p className="text-xs font-bold text-[#059669] flex items-center gap-1.5">
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
        <div className="bg-[#1E293B] rounded-2xl border border-white/5  px-5 py-4">
          <p className="text-[10px] font-black text-[#475569] uppercase tracking-wider mb-2">
            Como a Ficha Técnica usa estes dados
          </p>
          <div className="space-y-1.5">
            {[
              { ing: "Carne Moída", qtd: "150g", custo: "R$ 5,25" },
              { ing: "Arroz Agulhinha", qtd: "200g", custo: "R$ 1,20" },
              { ing: "Embalagem Marmita", qtd: "1 un", custo: "R$ 0,60" },
            ].map((ex) => (
              <div key={ex.ing} className="flex items-center justify-between text-[11px]">
                <span className="text-[#64748B] font-medium">{ex.ing} × {ex.qtd}</span>
                <span className="font-black text-[#F1F5F9]">{ex.custo}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs border-t border-dashed border-white/8 pt-1.5 mt-1">
              <span className="font-black text-[#CBD5E1]">Custo Total da Marmitex</span>
              <span className="font-black text-[#10b981]">R$ 7,05</span>
            </div>
          </div>
          <p className="text-[10px] text-[#475569] font-medium mt-2">
            Ao alterar o preço de qualquer ingrediente, o sistema recalcula automaticamente todas as fichas técnicas e o custo dos pratos no cardápio.
          </p>
        </div>

      </div>
    </div>
  );
}