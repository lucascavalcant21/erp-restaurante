"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Edit3, Search, X, AlertTriangle,
  TrendingDown, TrendingUp, Package, ChevronDown, Check,
  AlertCircle, ArrowUpCircle, ArrowDownCircle, BarChart2,
  RefreshCw, CheckCircle, XCircle, Minus, Activity,
} from "lucide-react";
import { fetchEstoque, inserirItem, movimentar, removerItem, ESTOQUE_SEED } from "../../../lib/estoque";

function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

const CATEGORIAS = ["Todos", "Carnes", "Grãos", "Laticínios", "Hortifruti", "Bebidas", "Embalagens", "Limpeza", "Outros"];
const UNIDADES_ESTOQUE = ["KG", "L", "UN", "CX", "MAÇO", "G", "ML"];

// Consumo médio diário estimado (seed) — em produção viria do histórico de saídas
const CONSUMO_DIARIO = {
  "e1": 3.5,   // Carne Moída (KG)
  "e2": 1.2,   // Arroz (KG)
  "e3": 0.6,   // Feijão (KG)
  "e4": 2.0,   // Alface (MAÇO)
  "e5": 1.5,   // Tomate (KG)
  "e6": 1.8,   // Frango (KG)
  "e7": 0.4,   // Queijo Mussarela (KG)
  "e8": 0.8,   // Requeijão (KG)
};

// ─── Curva ABC ────────────────────────────────────────────────────────────────
function calcularCurvaABC(itens) {
  const comValor = itens.map(i => ({
    ...i,
    valor_total: i.quantidade * i.custo_unitario,
  })).sort((a, b) => b.valor_total - a.valor_total);

  const total = comValor.reduce((s, i) => s + i.valor_total, 0);
  let acumulado = 0;
  return comValor.map(i => {
    acumulado += i.valor_total;
    const pct = total > 0 ? (acumulado / total) * 100 : 0;
    const classe = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    return { ...i, valor_total: i.valor_total, pct_acumulado: pct, classe_abc: classe };
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="bg-card rounded-2xl border border-white/5 p-4 animate-pulse">
          <div className="flex justify-between mb-3">
            <div className="space-y-2">
              <div className="h-2 w-16 bg-elevated rounded-full" />
              <div className="h-4 w-40 bg-elevated rounded-full" />
            </div>
            <div className="h-8 w-12 bg-elevated rounded-xl" />
          </div>
          <div className="h-2 bg-elevated rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Card de item ──────────────────────────────────────────────────────────────
function CardItem({ item, onEditar, onMovimentar, onDeletar }) {
  const critico  = item.quantidade <= item.minimo;
  const baixo    = item.quantidade > item.minimo && item.quantidade <= item.minimo * 1.5;
  const valorTotal = item.quantidade * item.custo_unitario;

  return (
    <div className={`bg-card rounded-2xl border  overflow-hidden ${critico ? "border-[rgba(5,150,105,0.3)]" : baixo ? "border-amber-200" : "border-white/5"}`}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-dim uppercase tracking-wider">{item.categoria}</span>
              {critico && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[rgba(5,150,105,0.15)] text-accent-strong">Crítico</span>}
              {baixo   && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">Baixo</span>}
            </div>
            <p className="text-base font-black text-fg truncate">{item.nome}</p>
            <p className="text-[11px] text-dim font-medium mt-0.5">Última entrada: {fmtData(item.ultima_entrada)}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black text-fg">{item.quantidade}</p>
            <p className="text-[11px] text-dim font-medium">{item.unidade}</p>
          </div>
        </div>
        <div className="mb-2">
          <div className="h-2 bg-elevated rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min((item.quantidade / (item.minimo * 3)) * 100, 100)}%`, backgroundColor: critico ? "#f43f5e" : baixo ? "#f59e0b" : "#10b981" }} />
          </div>
          <div className="flex justify-between text-[10px] font-bold mt-1">
            <span className={critico ? "text-accent" : baixo ? "text-amber-500" : "text-dim"}>Mín: {item.minimo} {item.unidade}</span>
            <span className="text-dim">Valor: {fmtBRL(valorTotal)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center border-t border-neutral-50 divide-x divide-neutral-50">
        <button onClick={() => onMovimentar(item, "entrada")} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-emerald-600 active:bg-emerald-50 transition-colors">
          <ArrowUpCircle size={13} /> Entrada
        </button>
        <button onClick={() => onMovimentar(item, "saida")} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-blue-600 active:bg-blue-50 transition-colors">
          <ArrowDownCircle size={13} /> Saída
        </button>
        <button onClick={() => onEditar(item)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-muted active: transition-colors">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onDeletar(item.id)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-accent active:bg-[rgba(5,150,105,0.1)] transition-colors">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </div>
  );
}

// ─── Formulário ───────────────────────────────────────────────────────────────
function FormItem({ inicial, onSalvar, onCancelar }) {
  const [nome,       setNome]       = useState(inicial?.nome           ?? "");
  const [categoria,  setCategoria]  = useState(inicial?.categoria      ?? "Outros");
  const [unidade,    setUnidade]    = useState(inicial?.unidade        ?? "KG");
  const [quantidade, setQuantidade] = useState(inicial?.quantidade     ?? "");
  const [minimo,     setMinimo]     = useState(inicial?.minimo         ?? "");
  const [custo,      setCusto]      = useState(inicial?.custo_unitario ?? "");
  const [erro,       setErro]       = useState("");

  function handleSalvar() {
    if (!nome.trim())                              { setErro("Informe o nome do item."); return; }
    if (!quantidade || parseFloat(quantidade) < 0) { setErro("Informe a quantidade."); return; }
    if (!minimo || parseFloat(minimo) < 0)         { setErro("Informe o estoque mínimo."); return; }
    if (!custo || parseFloat(custo) <= 0)          { setErro("Informe o custo unitário."); return; }
    setErro("");
    onSalvar({
      id: inicial?.id ?? `e${Date.now()}`,
      nome: nome.trim(), categoria, unidade,
      quantidade: parseFloat(quantidade),
      minimo: parseFloat(minimo),
      custo_unitario: parseFloat(custo),
      ultima_entrada: inicial?.ultima_entrada ?? new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <div className="bg-card rounded-2xl border border-white/5  p-5 space-y-4">
      <p className="text-sm font-black text-fg">{inicial ? "Editar Item" : "Novo Item de Estoque"}</p>
      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Nome</label>
        <input type="text" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }}
          placeholder="ex: Carne Moída"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg placeholder:text-dim placeholder:font-medium focus:outline-none focus:ring-2 focus:border-accent transition-all" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Categoria</label>
          <div className="relative">
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="w-full appearance-none  border border-white/8 rounded-xl px-3 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-8" style={{ background: "#1E293B", color: "#F1F5F9" }} >
              {CATEGORIAS.filter(c => c !== "Todos").map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Unidade</label>
          <div className="relative">
            <select value={unidade} onChange={e => setUnidade(e.target.value)}
              className="w-full appearance-none  border border-white/8 rounded-xl px-3 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-8" style={{ background: "#1E293B", color: "#F1F5F9" }} >
              {UNIDADES_ESTOQUE.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Qtd. Atual</label>
          <input type="number" inputMode="decimal" min="0" value={quantidade} onChange={e => { setQuantidade(e.target.value); setErro(""); }}
            placeholder="0"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Mínimo</label>
          <input type="number" inputMode="decimal" min="0" value={minimo} onChange={e => { setMinimo(e.target.value); setErro(""); }}
            placeholder="0"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Custo Unitário (R$)</label>
        <input type="number" inputMode="decimal" step="0.01" min="0" value={custo} onChange={e => { setCusto(e.target.value); setErro(""); }}
          placeholder="0.00"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
      </div>
      {erro && (
        <div className="flex items-center gap-2 bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.3)] rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-accent flex-shrink-0" />
          <p className="text-xs font-bold text-accent-strong">{erro}</p>
        </div>
      )}
      <div className="flex gap-3 pt-1">
        <button onClick={onCancelar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-fg-soft bg-elevated active:scale-95 transition-all">Cancelar</button>
        <button onClick={handleSalvar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-accent active:scale-95 transition-all ">
          {inicial ? "Salvar Alterações" : "Cadastrar Item"}
        </button>
      </div>
    </div>
  );
}

// ─── Modal Movimentação ────────────────────────────────────────────────────────
function ModalMovimentacao({ item, tipo, onConfirmar, onCancelar }) {
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const entrada = tipo === "entrada";

  function handleConfirmar() {
    const q = parseFloat(qtd);
    if (!qtd || isNaN(q) || q <= 0) return;
    if (!entrada && q > item.quantidade) return;
    onConfirmar(item.id, entrada ? q : -q, obs);
  }

  return (
    <div className="fixed inset-0 z-50 bg-accent-strong/40 flex items-end justify-center">
      <div className="bg-card rounded-t-3xl w-full max-w-md p-6 pb-10 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${entrada ? "bg-emerald-100" : "bg-blue-100"}`}>
            {entrada ? <ArrowUpCircle size={20} className="text-emerald-600" /> : <ArrowDownCircle size={20} className="text-blue-600" />}
          </div>
          <div>
            <p className="text-base font-black text-fg">{entrada ? "Registrar Entrada" : "Registrar Saída"}</p>
            <p className="text-[11px] text-dim font-medium truncate">{item.nome}</p>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">
            Quantidade ({item.unidade})
            {!entrada && <span className="ml-1 text-dim normal-case font-medium">— disponível: {item.quantidade}</span>}
          </label>
          <input autoFocus type="number" inputMode="decimal" min="0.1" step="0.1"
            value={qtd} onChange={e => setQtd(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleConfirmar()}
            placeholder="ex: 5"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-xl font-black text-fg placeholder:text-elevated focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Observação (opcional)</label>
          <input type="text" value={obs} onChange={e => setObs(e.target.value)}
            placeholder="ex: Compra Fornecedor X"
            className="w-full  border border-white/8 rounded-xl px-4 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancelar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-fg-soft bg-elevated active:scale-95 transition-all">Cancelar</button>
          <button onClick={handleConfirmar}
            disabled={!qtd || parseFloat(qtd) <= 0 || (!entrada && parseFloat(qtd) > item.quantidade)}
            className={`flex-1 py-3.5 rounded-xl font-black text-sm text-white active:scale-95 transition-all  disabled:opacity-40 ${entrada ? "bg-emerald-500" : "bg-blue-500"}`}>
            Confirmar {entrada ? "Entrada" : "Saída"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Controle (CRUD) ───────────────────────────────────────────────────────
function TabControle({ itens, resumo, fromSeed, onEditar, onMovimentar, onDeletar, formAberto, itemEditar, onAbrirForm, onFecharForm, onSalvar, salvou }) {
  const [busca,     setBusca]     = useState("");
  const [catFiltro, setCatFiltro] = useState("Todos");

  const itensFiltrados = useMemo(() => {
    return itens.filter(i => {
      const matchBusca = i.nome.toLowerCase().includes(busca.toLowerCase());
      const matchCat   = catFiltro === "Todos" || i.categoria === catFiltro;
      return matchBusca && matchCat;
    });
  }, [itens, busca, catFiltro]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-white/5  p-4">
          <div className="w-8 h-8 rounded-xl bg-elevated flex items-center justify-center mb-2">
            <Package size={16} className="text-muted" />
          </div>
          <p className="text-2xl font-black text-fg">{resumo.total}</p>
          <p className="text-[11px] font-bold text-dim">Itens cadastrados</p>
        </div>
        <div className="bg-card rounded-2xl border border-white/5  p-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
            <BarChart2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-800">{fmtBRL(resumo.valorTotal)}</p>
          <p className="text-[11px] font-bold text-dim">Valor total em estoque</p>
        </div>
        <div className={`rounded-2xl border  p-4 ${resumo.criticos > 0 ? "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" : "bg-card border-white/5"}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${resumo.criticos > 0 ? "bg-[rgba(5,150,105,0.15)]" : "bg-elevated"}`}>
            <AlertTriangle size={16} className={resumo.criticos > 0 ? "text-accent" : "text-dim"} />
          </div>
          <p className={`text-2xl font-black ${resumo.criticos > 0 ? "text-accent-strong" : "text-fg"}`}>{resumo.criticos}</p>
          <p className={`text-[11px] font-bold ${resumo.criticos > 0 ? "text-accent" : "text-dim"}`}>Itens críticos</p>
        </div>
        <div className={`rounded-2xl border  p-4 ${resumo.baixos > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-white/5"}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${resumo.baixos > 0 ? "bg-amber-100" : "bg-elevated"}`}>
            <TrendingDown size={16} className={resumo.baixos > 0 ? "text-amber-500" : "text-dim"} />
          </div>
          <p className={`text-2xl font-black ${resumo.baixos > 0 ? "text-amber-700" : "text-fg"}`}>{resumo.baixos}</p>
          <p className={`text-[11px] font-bold ${resumo.baixos > 0 ? "text-amber-500" : "text-dim"}`}>Estoque baixo</p>
        </div>
      </div>

      {/* Toast */}
      {salvou && (
        <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-2xl px-4 py-3">
          <Check size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-black text-emerald-800">Estoque atualizado!</p>
        </div>
      )}

      {/* Form */}
      {formAberto && (
        <FormItem inicial={itemEditar} onSalvar={onSalvar}
          onCancelar={() => onFecharForm()} />
      )}

      {/* Botão novo item */}
      {!formAberto && (
        <button onClick={onAbrirForm}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-white/8 text-[11px] font-black text-dim active:scale-95 transition-all hover:border-emerald-300 hover:text-emerald-600">
          <Plus size={14} /> Novo Item de Estoque
        </button>
      )}

      {/* Busca + filtro */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar item..."
            className="w-full bg-card border border-white/8 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent " />
          {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-dim" /></button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIAS.map(cat => (
            <button key={cat} onClick={() => setCatFiltro(cat)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${catFiltro === cat ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[11px] font-black text-dim uppercase tracking-wider">{catFiltro === "Todos" ? "Todos os Itens" : catFiltro}</p>
          <p className="text-[11px] font-bold text-dim">{itensFiltrados.length} iten{itensFiltrados.length !== 1 ? "s" : ""}</p>
        </div>
        {itensFiltrados.length === 0 ? (
          <div className="bg-card rounded-2xl border border-white/5  p-8 flex flex-col items-center text-center gap-2">
            <Package size={22} className="text-elevated" />
            <p className="text-sm font-bold text-subtle">{busca ? "Nenhum item encontrado" : "Estoque vazio"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {itensFiltrados.map(item => (
              <CardItem key={item.id} item={item}
                onEditar={onEditar} onMovimentar={onMovimentar} onDeletar={onDeletar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Curva ABC ─────────────────────────────────────────────────────────────
function TabCurvaABC({ itens }) {
  const abc = useMemo(() => calcularCurvaABC(itens), [itens]);
  const totalValor = abc.reduce((s, i) => s + i.valor_total, 0);

  const resumoABC = useMemo(() => {
    const A = abc.filter(i => i.classe_abc === "A");
    const B = abc.filter(i => i.classe_abc === "B");
    const C = abc.filter(i => i.classe_abc === "C");
    return {
      A: { qtd: A.length, valor: A.reduce((s, i) => s + i.valor_total, 0) },
      B: { qtd: B.length, valor: B.reduce((s, i) => s + i.valor_total, 0) },
      C: { qtd: C.length, valor: C.reduce((s, i) => s + i.valor_total, 0) },
    };
  }, [abc]);

  const ABC_STYLE = {
    A: { bg: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-500 text-white", cor: "#10b981", label: "Alta prioridade" },
    B: { bg: "bg-amber-50 border-amber-200",     badge: "bg-amber-500 text-white",   cor: "#f59e0b", label: "Média prioridade" },
    C: { bg: " border-white/8", badge: "bg-neutral-400 text-white", cor: "#9ca3af", label: "Baixa prioridade" },
  };

  // Gráfico de barras horizontal (valor por item)
  const maxValor = abc[0]?.valor_total || 1;

  return (
    <div className="space-y-4">
      {/* Resumo ABC */}
      <div className="grid grid-cols-3 gap-2">
        {["A", "B", "C"].map(cls => {
          const st = ABC_STYLE[cls];
          const r  = resumoABC[cls];
          const pctValor = totalValor > 0 ? (r.valor / totalValor) * 100 : 0;
          return (
            <div key={cls} className={`rounded-2xl border  p-3 text-center ${st.bg}`}>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${st.badge}`}>{cls}</span>
              <p className="text-xl font-black text-fg mt-2">{r.qtd}</p>
              <p className="text-[10px] font-bold text-subtle">iten{r.qtd !== 1 ? "s" : ""}</p>
              <p className="text-xs font-black mt-1" style={{ color: st.cor }}>{pctValor.toFixed(0)}% do valor</p>
            </div>
          );
        })}
      </div>

      {/* Explicação */}
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">Como funciona</p>
        <div className="space-y-2">
          {[
            { cls: "A", desc: "Top 80% do valor — máximo controle, compras frequentes, sem ruptura" },
            { cls: "B", desc: "Próximos 15% do valor — controle médio, reposição periódica" },
            { cls: "C", desc: "Últimos 5% do valor — controle simplificado, pedidos esporádicos" },
          ].map(e => {
            const st = ABC_STYLE[e.cls];
            return (
              <div key={e.cls} className="flex items-start gap-3">
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${st.badge}`}>{e.cls}</span>
                <p className="text-[11px] text-muted leading-relaxed">{e.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista ranqueada */}
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">Ranking por Valor em Estoque</p>
        <div className="space-y-3">
          {abc.map((item, i) => {
            const st = ABC_STYLE[item.classe_abc];
            const barPct = totalValor > 0 ? (item.valor_total / totalValor) * 100 : 0;
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-elevated w-5">#{i+1}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${st.badge}`}>{item.classe_abc}</span>
                  <p className="text-xs font-black text-fg flex-1 truncate">{item.nome}</p>
                  <p className="text-xs font-black text-fg-soft flex-shrink-0">{fmtBRL(item.valor_total)}</p>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: st.cor }} />
                  </div>
                  <span className="text-[9px] text-dim font-medium w-10 text-right">{barPct.toFixed(1)}%</span>
                  <span className="text-[9px] text-elevated font-medium w-14 text-right">acum. {item.pct_acumulado.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Cobertura & Giro ──────────────────────────────────────────────────────
function TabCobertura({ itens }) {
  const itensComCobertura = useMemo(() => {
    return itens.map(item => {
      const consumo = CONSUMO_DIARIO[item.id] || (item.quantidade / 30);
      const dias_cobertura = consumo > 0 ? Math.round(item.quantidade / consumo) : 999;
      const giro_mensal = consumo > 0 ? Math.round((consumo * 30) / Math.max(item.quantidade, 0.01) * 10) / 10 : 0;
      const status =
        dias_cobertura <= 3  ? "critico" :
        dias_cobertura <= 7  ? "alerta"  :
        dias_cobertura > 60  ? "excesso" : "ok";
      return { ...item, consumo_dia: consumo, dias_cobertura, giro_mensal, status_cobertura: status };
    }).sort((a, b) => a.dias_cobertura - b.dias_cobertura);
  }, [itens]);

  const STATUS_STYLE = {
    critico: { bg: "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]",     cor: "#f43f5e", badge: "bg-[rgba(5,150,105,0.15)] text-accent-strong",    label: "Crítico"   },
    alerta:  { bg: "bg-amber-50 border-amber-200",   cor: "#f59e0b", badge: "bg-amber-100 text-amber-700",  label: "Atenção"   },
    ok:      { bg: "bg-card border-white/5",     cor: "#10b981", badge: "bg-emerald-100 text-emerald-700", label: "OK"    },
    excesso: { bg: "bg-blue-50 border-blue-200",     cor: "#3b82f6", badge: "bg-blue-100 text-blue-700",    label: "Excesso"   },
  };

  const stats = useMemo(() => ({
    criticos: itensComCobertura.filter(i => i.status_cobertura === "critico").length,
    alertas:  itensComCobertura.filter(i => i.status_cobertura === "alerta").length,
    excessos: itensComCobertura.filter(i => i.status_cobertura === "excesso").length,
    media_dias: Math.round(itensComCobertura.filter(i => i.dias_cobertura < 999).reduce((s, i) => s + i.dias_cobertura, 0) / Math.max(itensComCobertura.filter(i => i.dias_cobertura < 999).length, 1)),
  }), [itensComCobertura]);

  const maxDias = Math.min(Math.max(...itensComCobertura.filter(i => i.dias_cobertura < 200).map(i => i.dias_cobertura), 1), 90);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl border  p-4 ${stats.criticos > 0 ? "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" : "bg-card border-white/5"}`}>
          <p className="text-[10px] font-black text-dim uppercase mb-1">Cobertura crítica (≤3d)</p>
          <p className={`text-2xl font-black ${stats.criticos > 0 ? "text-accent-strong" : "text-fg"}`}>{stats.criticos}</p>
        </div>
        <div className={`rounded-2xl border  p-4 ${stats.alertas > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-white/5"}`}>
          <p className="text-[10px] font-black text-dim uppercase mb-1">Atenção (4–7 dias)</p>
          <p className={`text-2xl font-black ${stats.alertas > 0 ? "text-amber-700" : "text-fg"}`}>{stats.alertas}</p>
        </div>
        <div className="bg-card rounded-2xl border border-white/5  p-4">
          <p className="text-[10px] font-black text-dim uppercase mb-1">Cobertura média</p>
          <p className="text-2xl font-black text-fg">{stats.media_dias}d</p>
        </div>
        <div className={`rounded-2xl border  p-4 ${stats.excessos > 0 ? "bg-blue-50 border-blue-200" : "bg-card border-white/5"}`}>
          <p className="text-[10px] font-black text-dim uppercase mb-1">Excesso de estoque</p>
          <p className={`text-2xl font-black ${stats.excessos > 0 ? "text-blue-700" : "text-fg"}`}>{stats.excessos}</p>
        </div>
      </div>

      {/* Gráfico de barras — dias de cobertura */}
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-1">Dias de Cobertura por Item</p>
        <p className="text-[10px] text-dim mb-3">Baseado no consumo médio diário</p>
        <div className="space-y-2.5">
          {itensComCobertura.filter(i => i.dias_cobertura < 200).slice(0, 10).map(item => {
            const st = STATUS_STYLE[item.status_cobertura];
            const barPct = Math.min((item.dias_cobertura / maxDias) * 100, 100);
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${st.badge}`}>{st.label}</span>
                    <p className="text-xs font-black text-fg truncate">{item.nome}</p>
                  </div>
                  <p className="text-xs font-black flex-shrink-0 ml-2" style={{ color: st.cor }}>
                    {item.dias_cobertura}d
                  </p>
                </div>
                <div className="h-2 bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(barPct, 2)}%`, backgroundColor: st.cor }} />
                </div>
                <p className="text-[9px] text-dim">Consumo: {item.consumo_dia.toFixed(1)} {item.unidade}/dia · Estoque: {item.quantidade} {item.unidade}</p>
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-white/5">
          {[["critico", "≤3d"], ["alerta", "4–7d"], ["ok", "8–60d"], ["excesso", ">60d"]].map(([s, l]) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_STYLE[s].cor }} />
              <span className="text-[10px] text-subtle font-medium">{STATUS_STYLE[s].label} {l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Giro de estoque */}
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-1">Giro de Estoque / Mês</p>
        <p className="text-[10px] text-dim mb-3">Quantas vezes o estoque se renova por mês</p>
        <div className="space-y-2">
          {[...itensComCobertura].sort((a, b) => b.giro_mensal - a.giro_mensal).slice(0, 8).map((item, i) => {
            const maxGiro = Math.max(...itensComCobertura.map(x => x.giro_mensal), 1);
            const cor = item.giro_mensal >= 4 ? "#10b981" : item.giro_mensal >= 2 ? "#f59e0b" : "#f43f5e";
            return (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-[11px] font-black text-elevated w-4">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <p className="text-xs font-black text-fg truncate">{item.nome}</p>
                    <p className="text-xs font-black flex-shrink-0 ml-2" style={{ color: cor }}>{item.giro_mensal}x</p>
                  </div>
                  <div className="h-2 bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((item.giro_mensal / maxGiro) * 100, 100)}%`, backgroundColor: cor }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-white/5 text-[10px] text-subtle">
          <span>🟢 Alto giro ≥4x</span>
          <span>🟡 Médio 2–4x</span>
          <span>🔴 Baixo &lt;2x</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Análise ───────────────────────────────────────────────────────────────
function TabAnalise({ itens, resumo }) {
  const abc = useMemo(() => calcularCurvaABC(itens), [itens]);
  const totalValor = abc.reduce((s, i) => s + i.valor_total, 0);

  const itensComCobertura = useMemo(() => {
    return itens.map(item => {
      const consumo = CONSUMO_DIARIO[item.id] || (item.quantidade / 30);
      const dias_cobertura = consumo > 0 ? Math.round(item.quantidade / consumo) : 999;
      return { ...item, dias_cobertura };
    });
  }, [itens]);

  const criticos_cobertura = itensComCobertura.filter(i => i.dias_cobertura <= 3);
  const alertas_cobertura  = itensComCobertura.filter(i => i.dias_cobertura > 3 && i.dias_cobertura <= 7);
  const excessos           = itensComCobertura.filter(i => i.dias_cobertura > 60);
  const itensA             = abc.filter(i => i.classe_abc === "A");
  const itensA_criticos    = itensA.filter(i => i.quantidade <= i.minimo);

  const analises = useMemo(() => {
    const lista = [];

    if (resumo.criticos === 0) {
      lista.push({ tipo: "ok", titulo: "Nenhum item em nível crítico de estoque", descricao: "Todos os itens estão acima do mínimo configurado. Continue monitorando." });
    } else {
      lista.push({ tipo: "critico", titulo: `${resumo.criticos} iten${resumo.criticos > 1 ? "s" : ""} abaixo do estoque mínimo`, descricao: `${itens.filter(i => i.quantidade <= i.minimo).map(i => i.nome).join(", ")}. Reposição imediata necessária.` });
    }

    if (criticos_cobertura.length > 0) {
      lista.push({ tipo: "critico", titulo: `${criticos_cobertura.length} iten${criticos_cobertura.length > 1 ? "s" : ""} com cobertura ≤3 dias`, descricao: `${criticos_cobertura.map(i => i.nome).join(", ")}. Risco de ruptura nos próximos dias.` });
    }

    if (alertas_cobertura.length > 0) {
      lista.push({ tipo: "alerta", titulo: `${alertas_cobertura.length} iten${alertas_cobertura.length > 1 ? "s" : ""} com cobertura 4–7 dias`, descricao: `${alertas_cobertura.map(i => i.nome).join(", ")}. Programar reposição esta semana.` });
    }

    if (itensA_criticos.length > 0) {
      lista.push({ tipo: "critico", titulo: "Itens classe A com estoque crítico", descricao: `${itensA_criticos.map(i => i.nome).join(", ")} representam parte significativa do valor. Ruptura impacta diretamente o faturamento.` });
    } else {
      lista.push({ tipo: "ok", titulo: "Itens classe A com cobertura adequada", descricao: `Os ${itensA.length} itens de alta prioridade (${((itensA.reduce((s, i) => s + i.valor_total, 0) / Math.max(totalValor, 1)) * 100).toFixed(0)}% do valor) estão bem estocados.` });
    }

    if (excessos.length > 0) {
      lista.push({ tipo: "alerta", titulo: `${excessos.length} iten${excessos.length > 1 ? "s" : ""} com excesso de estoque (>60 dias)`, descricao: `${excessos.map(i => i.nome).join(", ")}. Capital imobilizado desnecessariamente — avaliar redução de pedidos.` });
    }

    const maiorValor = abc[0];
    if (maiorValor) {
      lista.push({ tipo: "info", titulo: `"${maiorValor.nome}" representa o maior valor em estoque`, descricao: `${fmtBRL(maiorValor.valor_total)} (${((maiorValor.valor_total / Math.max(totalValor, 1)) * 100).toFixed(1)}% do total). Item classe ${maiorValor.classe_abc} — controle máximo recomendado.` });
    }

    return lista;
  }, [itens, resumo, criticos_cobertura, alertas_cobertura, excessos, itensA, itensA_criticos, abc, totalValor]);

  const TIPO_STYLE = {
    ok:      { icon: <CheckCircle size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />, bg: "bg-emerald-50 border-emerald-200" },
    alerta:  { icon: <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />, bg: "bg-amber-50 border-amber-200" },
    critico: { icon: <XCircle size={15} className="text-accent flex-shrink-0 mt-0.5" />,        bg: "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" },
    info:    { icon: <Minus size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />,          bg: "bg-blue-50 border-blue-200" },
  };

  // Valor por categoria
  const porCategoria = useMemo(() => {
    const map = {};
    itens.forEach(i => {
      if (!map[i.categoria]) map[i.categoria] = 0;
      map[i.categoria] += i.quantidade * i.custo_unitario;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [itens]);
  const maxCat = porCategoria[0]?.[1] || 1;

  return (
    <div className="space-y-4">
      {/* Valor por categoria */}
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">Valor em Estoque por Categoria</p>
        <div className="space-y-2">
          {porCategoria.map(([cat, val]) => (
            <div key={cat} className="flex items-center gap-3">
              <p className="text-xs font-black text-fg-soft w-24 flex-shrink-0">{cat}</p>
              <div className="flex-1 h-2.5 bg-elevated rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(val / maxCat) * 100}%` }} />
              </div>
              <p className="text-xs font-black text-fg-soft w-24 text-right flex-shrink-0">{fmtBRL(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Análise automática */}
      <div className="bg-card rounded-2xl border border-white/5  p-4">
        <p className="text-xs font-black text-fg uppercase tracking-wider mb-3">Análise Automática</p>
        <div className="space-y-3">
          {analises.map((a, i) => (
            <div key={i} className={`flex gap-3 p-3 rounded-xl border ${TIPO_STYLE[a.tipo]?.bg}`}>
              {TIPO_STYLE[a.tipo]?.icon}
              <div>
                <p className="text-xs font-black text-fg">{a.titulo}</p>
                <p className="text-[11px] text-subtle mt-0.5 leading-relaxed">{a.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plano de ação */}
      <div className="bg-accent-strong rounded-2xl p-4">
        <p className="text-xs font-black text-white uppercase tracking-wider mb-3">Plano de Reposição</p>
        <div className="space-y-2.5">
          {itens
            .filter(i => i.quantidade <= i.minimo * 1.5)
            .sort((a, b) => a.quantidade - b.quantidade)
            .slice(0, 5)
            .map((item, i) => {
              const urgencia = item.quantidade <= item.minimo ? "alta" : "media";
              const qtd_repor = Math.max(0, (item.minimo * 3) - item.quantidade);
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-card/10 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">{item.nome} — repor ~{qtd_repor.toFixed(1)} {item.unidade}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-white/50">Estoque: {item.quantidade} · Mín: {item.minimo}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${urgencia === "alta" ? "bg-[rgba(5,150,105,0.1)]0/30 text-rose-300" : "bg-amber-500/30 text-amber-300"}`}>
                        {urgencia.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          {itens.filter(i => i.quantidade <= i.minimo * 1.5).length === 0 && (
            <p className="text-xs text-white/50 text-center py-2">Nenhum item necessita reposição urgente.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function EstoquePage() {
  const router = useRouter();
  const [itens,      setItens]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fromSeed,   setFromSeed]   = useState(false);
  const [tab,        setTab]        = useState("controle");
  const [formAberto, setFormAberto] = useState(false);
  const [itemEditar, setItemEditar] = useState(null);
  const [movModal,   setMovModal]   = useState(null);
  const [salvou,     setSalvou]     = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const { data, error, fromSeed: demo } = await fetchEstoque();
    if (demo || error) {
      setItens(ESTOQUE_SEED);
      setFromSeed(true);
    } else {
      setItens(data);
      setFromSeed(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const resumo = useMemo(() => {
    const criticos  = itens.filter(i => i.quantidade <= i.minimo).length;
    const baixos    = itens.filter(i => i.quantidade > i.minimo && i.quantidade <= i.minimo * 1.5).length;
    const valorTotal = itens.reduce((acc, i) => acc + i.quantidade * i.custo_unitario, 0);
    return { total: itens.length, criticos, baixos, valorTotal };
  }, [itens]);

  async function handleSalvar(item) {
    if (fromSeed) {
      if (itemEditar) setItens(prev => prev.map(i => i.id === item.id ? item : i));
      else setItens(prev => [...prev, item]);
    } else {
      const payload = { nome: item.nome, categoria: item.categoria, unidade: item.unidade, quantidade: item.quantidade, minimo: item.minimo, preco_unit: item.custo_unitario };
      await inserirItem(payload);
      await carregarDados();
    }
    setFormAberto(false); setItemEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2500);
  }

  function handleEditar(item) { setItemEditar(item); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function handleDeletar(id) {
    if (fromSeed) setItens(prev => prev.filter(i => i.id !== id));
    else { await removerItem(id); await carregarDados(); }
  }

  async function handleConfirmarMov(id, delta, obs) {
    if (fromSeed) {
      setItens(prev => prev.map(i => i.id !== id ? i : {
        ...i, quantidade: Math.max(0, i.quantidade + delta),
        ultima_entrada: delta > 0 ? new Date().toISOString().slice(0, 10) : i.ultima_entrada,
      }));
    } else {
      await movimentar(id, delta > 0 ? "entrada" : "saida", Math.abs(delta), obs);
      await carregarDados();
    }
    setMovModal(null); setSalvou(true); setTimeout(() => setSalvou(false), 2500);
  }

  const TABS = [
    { id: "controle", label: "Controle" },
    { id: "abc",      label: "Curva ABC" },
    { id: "cobertura",label: "Cobertura" },
    { id: "analise",  label: "Análise" },
  ];

  return (
    <div className="min-h-screen ">
      {movModal && (
        <ModalMovimentacao item={movModal.item} tipo={movModal.tipo}
          onConfirmar={handleConfirmarMov} onCancelar={() => setMovModal(null)} />
      )}

      {/* Header */}
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-0" style={{ background: '#0F172A' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-muted" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Controle de Estoque</h1>
            <p className="text-[11px] text-dim font-medium">Entradas, saídas e análise</p>
          </div>
          <button onClick={carregarDados} className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
            <RefreshCw size={15} className={`text-muted ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 -mb-px overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-[11px] font-black transition-all border-b-2 ${tab === t.id ? "border-neutral-900 text-fg" : "border-transparent text-dim"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">
        {/* Banner demo */}
        {fromSeed && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
            <p className="text-[11px] font-bold text-amber-800">
              Modo demonstração — configure o Supabase em <code className="font-black">.env.local</code> para dados reais.
            </p>
          </div>
        )}

        {loading && <Skeleton />}

        {!loading && (
          <>
            {tab === "controle"  && (
              <TabControle
                itens={itens} resumo={resumo} fromSeed={fromSeed}
                onEditar={handleEditar} onMovimentar={(item, tipo) => setMovModal({ item, tipo })} onDeletar={handleDeletar}
                formAberto={formAberto} itemEditar={itemEditar}
                onAbrirForm={() => { setItemEditar(null); setFormAberto(true); }}
                onFecharForm={() => { setFormAberto(false); setItemEditar(null); }}
                onSalvar={handleSalvar} salvou={salvou}
              />
            )}
            {tab === "abc"       && <TabCurvaABC itens={itens} />}
            {tab === "cobertura" && <TabCobertura itens={itens} />}
            {tab === "analise"   && <TabAnalise itens={itens} resumo={resumo} />}
          </>
        )}
      </div>
    </div>
  );
}
