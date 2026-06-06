"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  Check,
  AlertCircle,
  FileDown,
} from "lucide-react";
import { exportarTabelaPDF } from "../../../lib/exportPDF";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CATEGORIAS_ENTRADA = ["Vendas Balcão", "iFood / Delivery", "Eventos", "Outros"];
const CATEGORIAS_SAIDA   = ["Fornecedores", "Folha de Pagamento", "Aluguel", "Energia", "Marketing", "Impostos", "Outros"];

// ─── Seed de lançamentos ──────────────────────────────────────────────────────
const hoje = new Date();
const ano  = hoje.getFullYear();
const mes  = hoje.getMonth() + 1; // 1-indexed

function dataIso(dia) {
  return `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
}

const LANCAMENTOS_SEED = [
  { id: "l1",  tipo: "entrada", categoria: "Vendas Balcão",      descricao: "Vendas do dia",            valor: 1850, data: dataIso(1)  },
  { id: "l2",  tipo: "entrada", categoria: "iFood / Delivery",   descricao: "Pedidos iFood",            valor: 620,  data: dataIso(1)  },
  { id: "l3",  tipo: "saida",   categoria: "Fornecedores",        descricao: "Frigorifico São Paulo",    valor: 700,  data: dataIso(2)  },
  { id: "l4",  tipo: "entrada", categoria: "Vendas Balcão",      descricao: "Vendas do dia",            valor: 2100, data: dataIso(3)  },
  { id: "l5",  tipo: "saida",   categoria: "Energia",             descricao: "Conta de Luz",             valor: 340,  data: dataIso(3)  },
  { id: "l6",  tipo: "entrada", categoria: "Vendas Balcão",      descricao: "Vendas do dia",            valor: 1960, data: dataIso(4)  },
  { id: "l7",  tipo: "saida",   categoria: "Fornecedores",        descricao: "Distribuidora GrãoVerde",  valor: 480,  data: dataIso(5)  },
  { id: "l8",  tipo: "entrada", categoria: "iFood / Delivery",   descricao: "Pedidos iFood",            valor: 780,  data: dataIso(5)  },
  { id: "l9",  tipo: "saida",   categoria: "Folha de Pagamento",  descricao: "Salários quinzena",        valor: 2750, data: dataIso(10) },
  { id: "l10", tipo: "entrada", categoria: "Eventos",             descricao: "Sinal Casamento Silva",    valor: 2000, data: dataIso(12) },
  { id: "l11", tipo: "saida",   categoria: "Aluguel",             descricao: "Aluguel mensal",           valor: 2200, data: dataIso(15) },
  { id: "l12", tipo: "entrada", categoria: "Vendas Balcão",      descricao: "Vendas do dia",            valor: 2350, data: dataIso(15) },
  { id: "l13", tipo: "saida",   categoria: "Marketing",           descricao: "Anúncios Instagram",       valor: 320,  data: dataIso(17) },
  { id: "l14", tipo: "entrada", categoria: "Vendas Balcão",      descricao: "Vendas do dia",            valor: 1980, data: dataIso(18) },
  { id: "l15", tipo: "saida",   categoria: "Impostos",            descricao: "Simples Nacional",         valor: 1265, data: dataIso(20) },
];

// ─── Formulário novo lançamento ───────────────────────────────────────────────
function FormLancamento({ onSalvar, onCancelar }) {
  const [tipo,      setTipo]      = useState("entrada");
  const [categoria, setCategoria] = useState("Vendas Balcão");
  const [descricao, setDescricao] = useState("");
  const [valor,     setValor]     = useState("");
  const [data,      setData]      = useState(new Date().toISOString().slice(0, 10));
  const [erro,      setErro]      = useState("");

  const cats = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

  function handleSalvar() {
    if (!descricao.trim())                   { setErro("Informe a descrição."); return; }
    if (!valor || parseFloat(valor) <= 0)    { setErro("Informe um valor válido."); return; }
    setErro("");
    onSalvar({ id: `l${Date.now()}`, tipo, categoria, descricao: descricao.trim(), valor: parseFloat(valor), data });
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <p className="text-sm font-black text-neutral-900">Novo Lançamento</p>

      {/* Tipo */}
      <div className="flex rounded-xl overflow-hidden border border-neutral-200">
        <button onClick={() => { setTipo("entrada"); setCategoria("Vendas Balcão"); }}
          className={`flex-1 py-3 text-sm font-black transition-colors ${tipo === "entrada" ? "bg-emerald-500 text-white" : "bg-white text-neutral-500"}`}>
          + Entrada
        </button>
        <button onClick={() => { setTipo("saida"); setCategoria("Fornecedores"); }}
          className={`flex-1 py-3 text-sm font-black transition-colors ${tipo === "saida" ? "bg-rose-500 text-white" : "bg-white text-neutral-500"}`}>
          − Saída
        </button>
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Categoria</label>
        <div className="relative">
          <select value={categoria} onChange={e => setCategoria(e.target.value)}
            className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] pr-10">
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Descrição</label>
        <input type="text" value={descricao} onChange={e => { setDescricao(e.target.value); setErro(""); }}
          placeholder="ex: Vendas do dia"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Valor (R$)</label>
          <input type="number" inputMode="decimal" step="0.01" min="0" value={valor} onChange={e => { setValor(e.target.value); setErro(""); }}
            placeholder="0,00"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-black text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Data</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-rose-500 flex-shrink-0" />
          <p className="text-xs font-bold text-rose-700">{erro}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onCancelar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-neutral-700 bg-neutral-100 active:scale-95 transition-all">Cancelar</button>
        <button onClick={handleSalvar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-[#10b981] active:scale-95 transition-all shadow-md">
          Lançar
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function FluxoCaixaPage() {
  const router = useRouter();
  const agora  = new Date();
  const [mes,  setMes]  = useState(agora.getMonth());
  const [ano,  setAno]  = useState(agora.getFullYear());
  const [lancamentos, setLancamentos] = useState(LANCAMENTOS_SEED);
  const [formAberto,  setFormAberto]  = useState(false);
  const [filtroTipo,  setFiltroTipo]  = useState("todos");
  const [salvou,      setSalvou]      = useState(false);

  const prev = () => { let m = mes - 1, a = ano; if (m < 0) { m = 11; a--; } setMes(m); setAno(a); };
  const next = () => {
    const hoje = new Date();
    if (ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes >= hoje.getMonth())) return;
    let m = mes + 1, a = ano; if (m > 11) { m = 0; a++; } setMes(m); setAno(a);
  };

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const { entradas, saidas, saldo, filtrados } = useMemo(() => {
    const mesStr = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    const doMes  = lancamentos.filter(l => l.data.startsWith(mesStr));
    const ent    = doMes.filter(l => l.tipo === "entrada").reduce((a, l) => a + l.valor, 0);
    const sai    = doMes.filter(l => l.tipo === "saida").reduce((a, l) => a + l.valor, 0);
    const f = filtroTipo === "todos" ? doMes
            : doMes.filter(l => l.tipo === filtroTipo);
    return { entradas: ent, saidas: sai, saldo: ent - sai, filtrados: f.sort((a, b) => b.data.localeCompare(a.data)) };
  }, [lancamentos, mes, ano, filtroTipo]);

  function handleSalvar(l) {
    setLancamentos(prev => [...prev, l]);
    setFormAberto(false);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
  }

  function handleDeletar(id) {
    setLancamentos(prev => prev.filter(l => l.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5]">
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Fluxo de Caixa</h1>
          <p className="text-[11px] text-neutral-400 font-medium">Entradas e saídas do período</p>
        </div>
        <button
          onClick={() => exportarTabelaPDF({
            titulo: `Fluxo de Caixa — ${new Date(ano, mes).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
            colunas: ["Data", "Descrição", "Categoria", "Tipo", "Valor"],
            dados: filtrados.map(l => [
              new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR"),
              l.descricao,
              l.categoria,
              l.tipo === "entrada" ? "Entrada" : "Saída",
              fmtBRL(l.valor),
            ]),
            rodape: `Total Entradas: ${fmtBRL(entradas)} · Total Saídas: ${fmtBRL(saidas)} · Saldo: ${fmtBRL(saldo)}`,
          })}
          className="flex items-center gap-1.5 bg-white border border-neutral-200 text-neutral-700 text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform shadow-sm mr-1">
          <FileDown size={13} /> PDF
        </button>
        <button onClick={() => { setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-[#10b981] text-white shadow-md active:scale-95 transition-all">
          <Plus size={14} /> Lançar
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Toast */}
        {salvou && (
          <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-2xl px-4 py-3">
            <Check size={15} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-black text-emerald-800">Lançamento registrado!</p>
          </div>
        )}

        {/* Formulário */}
        {formAberto && (
          <FormLancamento onSalvar={handleSalvar} onCancelar={() => setFormAberto(false)} />
        )}

        {/* Seletor de mês */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <button onClick={prev} className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center active:scale-95 shadow-sm">
              <ChevronLeft size={15} className="text-neutral-600" />
            </button>
            <span className="text-sm font-black text-neutral-900 w-32 text-center">{MESES[mes]} {ano}</span>
            <button onClick={next} className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center active:scale-95 shadow-sm">
              <ChevronRight size={15} className="text-neutral-600" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center mb-1.5">
              <ArrowUpCircle size={14} className="text-emerald-600" />
            </div>
            <p className="text-base font-black text-emerald-800 leading-tight">{fmtBRL(entradas)}</p>
            <p className="text-[10px] font-bold text-emerald-600">Entradas</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3">
            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center mb-1.5">
              <ArrowDownCircle size={14} className="text-rose-500" />
            </div>
            <p className="text-base font-black text-rose-700 leading-tight">{fmtBRL(saidas)}</p>
            <p className="text-[10px] font-bold text-rose-500">Saídas</p>
          </div>
          <div className={`rounded-2xl border p-3 ${saldo >= 0 ? "bg-white border-neutral-100" : "bg-rose-50 border-rose-200"}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${saldo >= 0 ? "bg-neutral-100" : "bg-rose-100"}`}>
              <Wallet size={14} className={saldo >= 0 ? "text-neutral-600" : "text-rose-500"} />
            </div>
            <p className={`text-base font-black leading-tight ${saldo >= 0 ? "text-neutral-900" : "text-rose-700"}`}>{fmtBRL(saldo)}</p>
            <p className={`text-[10px] font-bold ${saldo >= 0 ? "text-neutral-400" : "text-rose-500"}`}>Saldo</p>
          </div>
        </div>

        {/* Filtro tipo */}
        <div className="flex gap-2">
          {[{ id: "todos", label: "Todos" }, { id: "entrada", label: "Entradas" }, { id: "saida", label: "Saídas" }].map(f => (
            <button key={f.id} onClick={() => setFiltroTipo(f.id)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${filtroTipo === f.id ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de lançamentos */}
        <div>
          <div className="flex justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">Lançamentos</p>
            <p className="text-[11px] font-bold text-neutral-400">{filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}</p>
          </div>

          {filtrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex flex-col items-center text-center gap-2">
              <Wallet size={28} className="text-neutral-200 mb-1" />
              <p className="text-sm font-bold text-neutral-500">Nenhum lançamento no período</p>
              <p className="text-xs text-neutral-400 font-medium">Use o botão Lançar para registrar entradas e saídas.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-50">
              {filtrados.map(l => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${l.tipo === "entrada" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"}`}>
                    {l.tipo === "entrada" ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-neutral-900 truncate">{l.descricao}</p>
                    <p className="text-[10px] text-neutral-400 font-medium">{l.categoria} · {fmtData(l.data)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${l.tipo === "entrada" ? "text-emerald-600" : "text-rose-500"}`}>
                      {l.tipo === "entrada" ? "+" : "−"}{fmtBRL(l.valor)}
                    </p>
                  </div>
                  <button onClick={() => handleDeletar(l.id)} className="w-7 h-7 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0">
                    <Trash2 size={12} className="text-neutral-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
