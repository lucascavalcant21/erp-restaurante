"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  ArrowLeft,
  Search,
  X,
  Phone,
  MessageCircle,
  Star,
  ChevronDown,
  ChevronUp,
  Plus,
  User,
  ShoppingBag,
  Calendar,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { fetchClientes, inserirCliente, CLIENTES_SEED } from "../../../lib/clientes";
import Skeleton from "../../../components/Skeleton";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}
function diasDesde(str) {
  if (!str) return 999;
  const diff = Date.now() - new Date(str + "T12:00:00").getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────
const CATEGORIAS_CLIENTE = {
  vip:     { label: "⭐ VIP",     bg: "bg-amber-100",   cor: "text-amber-700",   borda: "border-amber-200"   },
  regular: { label: "✓ Regular", bg: "bg-emerald-100", cor: "text-emerald-700", borda: "border-emerald-200" },
  inativo: { label: "● Inativo", bg: "bg-elevated", cor: "text-subtle", borda: "border-white/8" },
};

function classificarCliente(totalGasto, ultimaCompra) {
  const dias = diasDesde(ultimaCompra);
  if (dias > 60) return "inativo";
  if (totalGasto >= 500) return "vip";
  return "regular";
}

// ─── Pedidos recentes locais (demo — não está no schema básico do Supabase) ────
const PEDIDOS_LOCAIS = {
  c1: [
    { data: "2026-06-04", itens: "Marmitex Executiva × 2", valor: 39.80 },
    { data: "2026-06-02", itens: "Suco Natural + Salada",   valor: 23.90 },
    { data: "2026-05-30", itens: "Combo Salada + Suco",     valor: 18.90 },
  ],
  c2: [
    { data: "2026-06-03", itens: "Marmitex Premium",        valor: 24.90 },
    { data: "2026-05-28", itens: "Refrigerante + Marmitex", valor: 25.90 },
  ],
  c3: [
    { data: "2026-06-05", itens: "Salada Completa × 2",     valor: 29.80 },
    { data: "2026-06-01", itens: "Combo Salada + Suco",     valor: 18.90 },
  ],
  c4: [{ data: "2026-04-10", itens: "Burguer Combo",         valor: 32.00 }],
  c5: [
    { data: "2026-06-04", itens: "Sobremesa do Dia × 2",    valor: 17.00 },
    { data: "2026-05-27", itens: "Marmitex Executiva",      valor: 19.90 },
  ],
  c6: [{ data: "2026-03-15", itens: "Salada Completa",       valor: 14.90 }],
};

const UNIDADES = ["Todas", "Seldeestrela", "Tico Tico Saladas", "Burguer"];
const FILTROS  = ["Todos", "VIP", "Regular", "Inativo"];

// ─── Form novo cliente ────────────────────────────────────────────────────────
const BLANK = { nome: "", tel: "", unidade: "Seldeestrela" };

function FormCliente({ onSalvar, onFechar }) {
  const [form, setForm] = useState(BLANK);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-accent-strong/40" onClick={onFechar}>
      <div className="w-full bg-card rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-elevated rounded-full mx-auto" />
        <h2 className="text-lg font-black text-fg">Novo Cliente</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-black text-dim uppercase tracking-wider block mb-1">Nome</label>
            <input value={form.nome} onChange={e => set("nome", e.target.value)}
              placeholder="Nome completo"
              className="w-full  border border-white/8 rounded-xl px-3 py-3 text-sm font-medium text-fg focus:outline-none focus:ring-2 focus:border-accent" />
          </div>
          <div>
            <label className="text-[11px] font-black text-dim uppercase tracking-wider block mb-1">Telefone</label>
            <input value={form.tel} onChange={e => set("tel", e.target.value)}
              placeholder="(XX) XXXXX-XXXX"
              className="w-full  border border-white/8 rounded-xl px-3 py-3 text-sm font-medium text-fg focus:outline-none focus:ring-2 focus:border-accent" />
          </div>
          <div>
            <label className="text-[11px] font-black text-dim uppercase tracking-wider block mb-1">Unidade</label>
            <select value={form.unidade} onChange={e => set("unidade", e.target.value)}
              className="w-full  border border-white/8 rounded-xl px-3 py-3 text-sm font-medium text-fg focus:outline-none focus:ring-2 focus:border-accent">
              {["Seldeestrela", "Tico Tico Saladas", "Burguer"].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => { if (form.nome) { onSalvar(form); onFechar(); } }}
          className="w-full py-3.5 rounded-2xl bg-accent-strong text-white font-black text-sm active:scale-95 transition-transform">
          Salvar Cliente
        </button>
        <button onClick={onFechar} className="w-full py-2 text-dim text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

// ─── Card cliente ──────────────────────────────────────────────────────────────
function CardCliente({ cliente }) {
  const [aberto, setAberto] = useState(false);
  const categoria = classificarCliente(cliente.total_gasto, cliente.ultima_compra);
  const cat       = CATEGORIAS_CLIENTE[categoria];
  const iniciais  = cliente.nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const dias      = diasDesde(cliente.ultima_compra);
  const pedidos   = PEDIDOS_LOCAIS[cliente.id] || [];

  return (
    <div className={`rounded-2xl border  overflow-hidden bg-card ${categoria === "inativo" ? "border-white/8" : cat.borda}`}>
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setAberto(v => !v)}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${cat.bg} ${cat.cor}`}>
            {iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-black text-fg truncate">{cliente.nome}</p>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${cat.bg} ${cat.cor}`}>{cat.label}</span>
            </div>
            <p className="text-[11px] font-medium text-dim">
              {cliente.unidade} · Última compra há {dias}d
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-black text-fg">{fmtBRL(cliente.total_gasto)}</p>
            <p className="text-[10px] font-bold text-dim">{cliente.total_pedidos} pedidos</p>
          </div>
          {aberto ? <ChevronUp size={16} className="text-dim flex-shrink-0" /> : <ChevronDown size={16} className="text-dim flex-shrink-0" />}
        </div>
      </button>

      {aberto && (
        <div className="px-4 pb-4 border-t border-white/5">
          {/* Ações */}
          <div className="flex gap-2 pt-3 mb-3">
            {cliente.tel && (
              <>
                <a href={`tel:${cliente.tel}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-elevated text-fg-soft text-xs font-black active:scale-95 transition-transform">
                  <Phone size={13} /> Ligar
                </a>
                <a href={`https://wa.me/55${cliente.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-black active:scale-95 transition-transform">
                  <MessageCircle size={13} /> WhatsApp
                </a>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className=" rounded-xl p-2 text-center">
              <p className="text-[9px] font-black text-dim uppercase">Total gasto</p>
              <p className="text-[12px] font-black text-fg">{fmtBRL(cliente.total_gasto)}</p>
            </div>
            <div className=" rounded-xl p-2 text-center">
              <p className="text-[9px] font-black text-dim uppercase">Pedidos</p>
              <p className="text-[12px] font-black text-fg">{cliente.total_pedidos}</p>
            </div>
            <div className={`rounded-xl p-2 text-center ${dias > 60 ? "bg-[rgba(5,150,105,0.1)]" : ""}`}>
              <p className="text-[9px] font-black text-dim uppercase">Dias sem</p>
              <p className={`text-[12px] font-black ${dias > 60 ? "text-accent-strong" : "text-fg"}`}>{dias}d</p>
            </div>
          </div>

          {/* Últimas compras */}
          {pedidos.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-dim uppercase tracking-wider mb-2">Últimas Compras</p>
              <div className="space-y-1.5">
                {pedidos.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black text-fg-soft">{p.itens}</p>
                      <p className="text-[10px] text-dim">{fmtData(p.data)}</p>
                    </div>
                    <p className="text-[12px] font-black text-fg">{fmtBRL(p.valor)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function CRMPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [clientes,    setClientes]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fromSeed,    setFromSeed]    = useState(false);
  const [busca,       setBusca]       = useState("");
  const [filtro,      setFiltro]      = useState("Todos");
  const [unidade,     setUnidade]     = useState("Todas");
  const [formAberto,  setFormAberto]  = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const res = await fetchClientes(unidadeAtiva);
    if (res.fromSeed) {
      setClientes(CLIENTES_SEED);
      setFromSeed(true);
    } else {
      setClientes(res.data);
      setFromSeed(false);
    }
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const categoria = classificarCliente(c.total_gasto, c.ultima_compra);
      const matchBusca   = c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.tel || "").includes(busca);
      const matchFiltro  = filtro === "Todos" || categoria.toLowerCase() === filtro.toLowerCase();
      const matchUnidade = unidade === "Todas" || c.unidade === unidade;
      return matchBusca && matchFiltro && matchUnidade;
    });
  }, [clientes, busca, filtro, unidade]);

  const resumo = useMemo(() => {
    const vip     = clientes.filter(c => classificarCliente(c.total_gasto, c.ultima_compra) === "vip").length;
    const inativo = clientes.filter(c => classificarCliente(c.total_gasto, c.ultima_compra) === "inativo").length;
    const totalGasto = clientes.reduce((a, c) => a + Number(c.total_gasto || 0), 0);
    return { vip, inativo, total: clientes.length, totalGasto };
  }, [clientes]);

  async function handleNovoCliente(form) {
    if (fromSeed) {
      const novo = { id: `c${Date.now()}`, ...form, total_gasto: 0, total_pedidos: 0, ultima_compra: new Date().toISOString().slice(0, 10) };
      setClientes(prev => [novo, ...prev]);
    } else {
      await inserirCliente({ ...form, total_gasto: 0, total_pedidos: 0, ultima_compra: new Date().toISOString().slice(0, 10) }, unidadeAtiva);
      await carregarDados();
    }
  }

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-muted" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>CRM — Clientes</h1>
            <p className="text-[11px] text-dim font-medium">{clientes.length} clientes cadastrados</p>
          </div>
          <button onClick={carregarDados}
            className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform mr-1">
            <RefreshCw size={15} className="text-subtle" />
          </button>
          <button onClick={() => setFormAberto(true)}
            className="flex items-center gap-1.5 bg-accent-strong text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform">
            <Plus size={13} />
            Novo
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Banner demo */}
        {fromSeed && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-[11px] font-black text-amber-700">Modo demonstração — configure o Supabase para dados reais</p>
          </div>
        )}

        {loading && <Skeleton count={4} />}

        {!loading && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider mb-1">VIPs</p>
                <p className="text-2xl font-black text-amber-800">{resumo.vip}</p>
              </div>
              <div className="bg-card border border-white/5 rounded-2xl  p-3 text-center">
                <p className="text-[9px] font-black text-dim uppercase tracking-wider mb-1">Total</p>
                <p className="text-2xl font-black text-fg">{resumo.total}</p>
              </div>
              <div className={`rounded-2xl border p-3 text-center ${resumo.inativo > 0 ? "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]" : "bg-card border-white/5"}`}>
                <p className={`text-[9px] font-black uppercase tracking-wider mb-1 ${resumo.inativo > 0 ? "text-accent-strong" : "text-dim"}`}>Inativos</p>
                <p className={`text-2xl font-black ${resumo.inativo > 0 ? "text-rose-800" : "text-fg"}`}>{resumo.inativo}</p>
              </div>
            </div>

            {/* Ticket médio */}
            <div className="bg-card border border-white/5 rounded-2xl  px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-dim uppercase tracking-wider">Gasto Total (CRM)</p>
                <p className="text-lg font-black text-fg">{fmtBRL(resumo.totalGasto)}</p>
              </div>
              <TrendingUp size={22} className="text-emerald-500" />
            </div>

            {/* Filtros */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
                <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou telefone..."
                  className="w-full bg-card border border-white/8 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent " />
                {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-dim" /></button>}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTROS.map(f => (
                  <button key={f} onClick={() => setFiltro(f)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${filtro === f ? "bg-accent-strong text-white" : "bg-card border border-white/8 text-muted"}`}>
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {UNIDADES.map(u => (
                  <button key={u} onClick={() => setUnidade(u)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${unidade === u ? "bg-emerald-600 text-white" : "bg-card border border-white/8 text-muted"}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista */}
            <div className="space-y-3">
              {clientesFiltrados.length === 0 ? (
                <div className="bg-card rounded-2xl border border-white/5 p-8 text-center">
                  <p className="text-dim font-medium text-sm">Nenhum cliente encontrado</p>
                </div>
              ) : (
                clientesFiltrados.map(c => <CardCliente key={c.id} cliente={c} />)
              )}
            </div>
          </>
        )}
      </div>

      {formAberto && (
        <FormCliente onSalvar={handleNovoCliente} onFechar={() => setFormAberto(false)} />
      )}
    </div>
  );
}
