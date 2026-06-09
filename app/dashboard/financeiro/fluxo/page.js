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
    <div className="bg-card rounded-2xl border border-white/5  p-5 space-y-4">
      <p className="text-sm font-black text-fg">Novo Lançamento</p>

      {/* Tipo */}
      <div className="flex rounded-xl overflow-hidden border border-white/8">
        <button onClick={() => { setTipo("entrada"); setCategoria("Vendas Balcão"); }}
          className={`flex-1 py-3 text-sm font-black transition-colors ${tipo === "entrada" ? "bg-emerald-500 text-white" : "bg-card text-subtle"}`}>
          + Entrada
        </button>
        <button onClick={() => { setTipo("saida"); setCategoria("Fornecedores"); }}
          className={`flex-1 py-3 text-sm font-black transition-colors ${tipo === "saida" ? "bg-[rgba(5,150,105,0.1)]0 text-white" : "bg-card text-subtle"}`}>
          − Saída
        </button>
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Categoria</label>
        <div className="relative">
          <select value={categoria} onChange={e => setCategoria(e.target.value)}
            className="w-full appearance-none  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-10" style={{ background: "#1E293B", color: "#F1F5F9" }} >
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Descrição</label>
        <input type="text" value={descricao} onChange={e => { setDescricao(e.target.value); setErro(""); }}
          placeholder="ex: Vendas do dia"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Valor (R$)</label>
          <input type="number" inputMode="decimal" step="0.01" min="0" value={valor} onChange={e => { setValor(e.target.value); setErro(""); }}
            placeholder="0,00"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Data</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.3)] rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-accent flex-shrink-0" />
          <p className="text-xs font-bold text-accent-strong">{erro}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onCancelar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-fg-soft bg-elevated active:scale-95 transition-all">Cancelar</button>
        <button onClick={handleSalvar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-accent active:scale-95 transition-all ">
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
    <div className="min-h-screen ">
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3 flex items-center gap-3" style={{ background: '#0F172A' }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Fluxo de Caixa</h1>
          <p className="text-[11px] text-dim font-medium">Entradas e saídas do período</p>
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
          className="flex items-center gap-1.5 bg-card border border-white/8 text-fg-soft text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform  mr-1">
          <FileDown size={13} /> PDF
        </button>
        <button onClick={() => { setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-accent text-white  active:scale-95 transition-all">
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
            <button onClick={prev} className="w-8 h-8 rounded-xl bg-card border border-white/8 flex items-center justify-center active:scale-95 ">
              <ChevronLeft size={15} className="text-muted" />
            </button>
            <span className="text-sm font-black text-fg w-32 text-center">{MESES[mes]} {ano}</span>
            <button onClick={next} className="w-8 h-8 rounded-xl bg-card border border-white/8 flex items-center justify-center active:scale-95 ">
              <ChevronRight size={15} className="text-muted" />
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
          <div className="bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.3)] rounded-2xl p-3">
            <div className="w-7 h-7 rounded-lg bg-[rgba(5,150,105,0.15)] flex items-center justify-center mb-1.5">
              <ArrowDownCircle size={14} className="text-accent" />
            </div>
            <p className="text-base font-black text-accent-strong leading-tight">{fmtBRL(saidas)}</p>
            <p className="text-[10px] font-bold text-accent">Saídas</p>
          </div>
          <div className={`rounded-2xl border p-3 ${saldo >= 0 ? "bg-card border-white/5" : "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]"}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${saldo >= 0 ? "bg-elevated" : "bg-[rgba(5,150,105,0.15)]"}`}>
              <Wallet size={14} className={saldo >= 0 ? "text-muted" : "text-accent"} />
            </div>
            <p className={`text-base font-black leading-tight ${saldo >= 0 ? "text-fg" : "text-accent-strong"}`}>{fmtBRL(saldo)}</p>
            <p className={`text-[10px] font-bold ${saldo >= 0 ? "text-dim" : "text-accent"}`}>Saldo</p>
          </div>
        </div>

        {/* Filtro tipo */}
        <div className="flex gap-2">
          {[{ id: "todos", label: "Todos" }, { id: "entrada", label: "Entradas" }, { id: "saida", label: "Saídas" }].map(f => (
            <button key={f.id} onClick={() => setFiltroTipo(f.id)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${filtroTipo === f.id ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de lançamentos */}
        <div>
          <div className="flex justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-dim uppercase tracking-wider">Lançamentos</p>
            <p className="text-[11px] font-bold text-dim">{filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}</p>
          </div>

          {filtrados.length === 0 ? (
            <div className="bg-card rounded-2xl border border-white/5  p-8 flex flex-col items-center text-center gap-2">
              <Wallet size={28} className="text-neutral-200 mb-1" />
              <p className="text-sm font-bold text-subtle">Nenhum lançamento no período</p>
              <p className="text-xs text-dim font-medium">Use o botão Lançar para registrar entradas e saídas.</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-white/5  overflow-hidden divide-y divide-neutral-50">
              {filtrados.map(l => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${l.tipo === "entrada" ? "bg-emerald-100 text-emerald-600" : "bg-[rgba(5,150,105,0.15)] text-accent"}`}>
                    {l.tipo === "entrada" ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-fg truncate">{l.descricao}</p>
                    <p className="text-[10px] text-dim font-medium">{l.categoria} · {fmtData(l.data)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${l.tipo === "entrada" ? "text-emerald-600" : "text-accent"}`}>
                      {l.tipo === "entrada" ? "+" : "−"}{fmtBRL(l.valor)}
                    </p>
                  </div>
                  <button onClick={() => handleDeletar(l.id)} className="w-7 h-7 rounded-lg  border border-white/5 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0">
                    <Trash2 size={12} className="text-dim" />
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
