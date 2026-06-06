"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Megaphone,
  Tag,
  Users,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  X,
  RefreshCw,
} from "lucide-react";
import { fetchCampanhas, inserirCampanha, atualizarStatusCampanha, CAMPANHAS_SEED } from "../../../lib/clientes";
import Skeleton from "../../../components/Skeleton";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(str) {
  const [y, m, d] = str.split("-");
  return `${d}/${m}`;
}
function diasRestantes(fim) {
  const diff = new Date(fim + "T23:59:59").getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Status ───────────────────────────────────────────────────────────────────
const STATUS_CAMP = {
  ativa:     { label: "Ativa",     Icon: CheckCircle, bg: "bg-emerald-100", cor: "text-emerald-700", dot: "#10b981" },
  agendada:  { label: "Agendada",  Icon: Clock,       bg: "bg-blue-100",    cor: "text-blue-700",    dot: "#3b82f6" },
  encerrada: { label: "Encerrada", Icon: XCircle,     bg: "bg-neutral-100", cor: "text-neutral-500", dot: "#9ca3af" },
};

const TIPOS_CAMP = {
  cupom:      { label: "Cupom de Desconto", emoji: "🏷️" },
  fidelidade: { label: "Fidelidade",        emoji: "⭐" },
  lancamento: { label: "Lançamento",        emoji: "🚀" },
  sazonale:   { label: "Sazonal",           emoji: "🎉" },
};

// CAMPANHAS_SEED importado de lib/clientes.js
const _IGNORE = [
  {
    id: "camp1", nome: "Quinta do Suco",       tipo: "cupom",
    descricao: "Suco natural por R$6,90 toda quinta-feira para clientes cadastrados.",
    cupom: "SUCO5",  desconto: 10, unidade: "Seldeestrela",
    inicio: "2026-06-01", fim: "2026-06-30",
    meta_clientes: 200, clientes_atingidos: 142,
    receita_gerada: 980.00, status: "ativa",
  },
  {
    id: "camp2", nome: "Combo VIP de Junho",   tipo: "fidelidade",
    descricao: "Clientes VIP ganham Sobremesa do Dia grátis em qualquer pedido acima de R$25.",
    cupom: "VIPJUN",  desconto: 0, unidade: "Todas",
    inicio: "2026-06-01", fim: "2026-06-15",
    meta_clientes: 50, clientes_atingidos: 38,
    receita_gerada: 1240.00, status: "ativa",
  },
  {
    id: "camp3", nome: "Salada do Verão",       tipo: "lancamento",
    descricao: "Lançamento da nova Salada Premium com ingredientes importados.",
    cupom: "SALADANOVA", desconto: 15, unidade: "Tico Tico Saladas",
    inicio: "2026-06-10", fim: "2026-06-20",
    meta_clientes: 100, clientes_atingidos: 0,
    receita_gerada: 0, status: "agendada",
  },
  {
    id: "camp4", nome: "Dia das Mães",          tipo: "sazonale",
    descricao: "10% off em todos os combos durante o Dia das Mães.",
    cupom: "MAES2026", desconto: 10, unidade: "Todas",
    inicio: "2026-05-10", fim: "2026-05-12",
    meta_clientes: 300, clientes_atingidos: 287,
    receita_gerada: 3420.00, status: "encerrada",
  },
];

const FILTROS = ["Todas", "Ativa", "Agendada", "Encerrada"];
const UNIDADES_OPT = ["Todas", "Seldeestrela", "Tico Tico Saladas", "Burguer"];

// ─── Form nova campanha ────────────────────────────────────────────────────────
const BLANK_CAMP = {
  nome: "", tipo: "cupom", descricao: "", cupom: "", desconto: "",
  unidade: "Todas", inicio: "", fim: "",
};

function FormCampanha({ onSalvar, onFechar }) {
  const [form, setForm] = useState(BLANK_CAMP);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onFechar}>
      <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto" />
        <h2 className="text-lg font-black text-neutral-900">Nova Campanha</h2>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Nome da Campanha</label>
            <input value={form.nome} onChange={e => set("nome", e.target.value)}
              placeholder="Ex: Quinta do Suco"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
          </div>
          <div>
            <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => set("tipo", e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]">
              {Object.entries(TIPOS_CAMP).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={2}
              placeholder="Descreva a campanha..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Cupom</label>
              <input value={form.cupom} onChange={e => set("cupom", e.target.value.toUpperCase())}
                placeholder="CODIGO"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-black text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
            </div>
            <div>
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Desconto (%)</label>
              <input type="number" value={form.desconto} onChange={e => set("desconto", e.target.value)}
                placeholder="0"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Início</label>
              <input type="date" value={form.inicio} onChange={e => set("inicio", e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
            </div>
            <div>
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Fim</label>
              <input type="date" value={form.fim} onChange={e => set("fim", e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Unidade</label>
            <select value={form.unidade} onChange={e => set("unidade", e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]">
              {UNIDADES_OPT.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => { if (form.nome && form.inicio && form.fim) { onSalvar(form); onFechar(); } }}
          className="w-full py-3.5 rounded-2xl bg-neutral-900 text-white font-black text-sm active:scale-95 transition-transform">
          Criar Campanha
        </button>
        <button onClick={onFechar} className="w-full py-2 text-neutral-400 text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

// ─── Card campanha ────────────────────────────────────────────────────────────
function CardCampanha({ camp, onStatusChange }) {
  const [aberto, setAberto] = useState(false);
  const st     = STATUS_CAMP[camp.status];
  const tipo   = TIPOS_CAMP[camp.tipo] || { label: camp.tipo, emoji: "📢" };
  const progr  = camp.meta_clientes > 0 ? Math.min((camp.clientes_atingidos / camp.meta_clientes) * 100, 100) : 0;
  const dias   = camp.status === "ativa" ? diasRestantes(camp.fim) : null;

  function copiarCupom() {
    if (camp.cupom) navigator.clipboard?.writeText(camp.cupom);
  }

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden bg-white ${camp.status === "encerrada" ? "border-neutral-100 opacity-75" : camp.status === "agendada" ? "border-blue-200" : "border-emerald-200"}`}>
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setAberto(v => !v)}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-lg flex-shrink-0">
            {tipo.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${st.bg} ${st.cor}`}>{st.label}</span>
              <span className="text-[9px] font-medium text-neutral-400">{camp.unidade}</span>
              {dias !== null && dias >= 0 && (
                <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{dias}d restantes</span>
              )}
            </div>
            <p className="text-sm font-black text-neutral-900 truncate">{camp.nome}</p>
          </div>
          {aberto ? <ChevronUp size={15} className="text-neutral-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-neutral-400 flex-shrink-0" />}
        </div>

        {/* Barra progresso */}
        {camp.meta_clientes > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] font-black mb-1">
              <span className="text-neutral-400">Alcance</span>
              <span className="text-neutral-700">{camp.clientes_atingidos}/{camp.meta_clientes} clientes</span>
            </div>
            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progr}%`, backgroundColor: st.dot }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-neutral-50 rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-neutral-400 uppercase">Receita</p>
            <p className="text-[11px] font-black text-emerald-700">{fmtBRL(camp.receita_gerada)}</p>
          </div>
          <div className="bg-neutral-50 rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-neutral-400 uppercase">Período</p>
            <p className="text-[11px] font-black text-neutral-900">{fmtData(camp.inicio)}–{fmtData(camp.fim)}</p>
          </div>
          <div className="bg-neutral-50 rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-neutral-400 uppercase">Desconto</p>
            <p className="text-[11px] font-black text-neutral-900">{camp.desconto > 0 ? `${camp.desconto}%` : "—"}</p>
          </div>
        </div>
      </button>

      {aberto && (
        <div className="px-4 pb-4 border-t border-neutral-100 pt-3 space-y-3">
          <p className="text-[12px] font-medium text-neutral-600 leading-snug">{camp.descricao}</p>

          {camp.cupom && (
            <div className="flex items-center justify-between bg-neutral-50 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider">Código do Cupom</p>
                <p className="text-base font-black text-neutral-900 tracking-widest">{camp.cupom}</p>
              </div>
              <button onClick={copiarCupom}
                className="flex items-center gap-1 text-[11px] font-black text-neutral-600 bg-white border border-neutral-200 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform">
                <Copy size={12} /> Copiar
              </button>
            </div>
          )}

          {camp.status === "ativa" && (
            <button onClick={() => onStatusChange(camp.id, "encerrada")}
              className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-black active:scale-95 transition-transform">
              Encerrar Campanha
            </button>
          )}
          {camp.status === "agendada" && (
            <button onClick={() => onStatusChange(camp.id, "ativa")}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black active:scale-95 transition-transform">
              Ativar Agora
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function CampanhasPage() {
  const router = useRouter();
  const [filtro,    setFiltro]    = useState("Todas");
  const [modal,     setModal]     = useState(false);
  const [campanhas, setCampanhas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [fromSeed,  setFromSeed]  = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const res = await fetchCampanhas();
    if (res.fromSeed) {
      setCampanhas(CAMPANHAS_SEED);
      setFromSeed(true);
    } else {
      setCampanhas(res.data);
      setFromSeed(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const resumo = useMemo(() => {
    const ativas    = campanhas.filter(c => c.status === "ativa").length;
    const receita   = campanhas.reduce((a, c) => a + Number(c.receita_gerada || 0), 0);
    const clientes  = campanhas.reduce((a, c) => a + Number(c.clientes_atingidos || 0), 0);
    return { ativas, receita, clientes };
  }, [campanhas]);

  const filtradas = useMemo(() => {
    if (filtro === "Todas") return campanhas;
    return campanhas.filter(c => c.status === filtro.toLowerCase());
  }, [campanhas, filtro]);

  async function handleNovaCampanha(form) {
    const nova = {
      ...form,
      desconto: Number(form.desconto) || 0,
      meta_clientes: 0, clientes_atingidos: 0,
      receita_gerada: 0, status: "agendada",
    };
    if (fromSeed) {
      setCampanhas(prev => [{ id: `camp${Date.now()}`, ...nova }, ...prev]);
    } else {
      await inserirCampanha(nova);
      await carregarDados();
    }
  }

  async function handleStatusChange(id, novoStatus) {
    if (fromSeed) {
      setCampanhas(prev => prev.map(c => c.id === id ? { ...c, status: novoStatus } : c));
    } else {
      await atualizarStatusCampanha(id, novoStatus);
      await carregarDados();
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5]">
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-neutral-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-neutral-900 leading-tight">Campanhas de Vendas</h1>
            <p className="text-[11px] text-neutral-400 font-medium">Marketing e promoções</p>
          </div>
          <button onClick={carregarDados}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform mr-1">
            <RefreshCw size={15} className="text-neutral-500" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 bg-neutral-900 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform">
            <Plus size={13} /> Nova
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {fromSeed && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-[11px] font-black text-amber-700">Modo demonstração — configure o Supabase para dados reais</p>
          </div>
        )}

        {loading && <Skeleton count={3} />}

        {!loading && (<>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-1">Ativas</p>
            <p className="text-2xl font-black text-emerald-800">{resumo.ativas}</p>
          </div>
          <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm p-3 text-center">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider mb-1">Clientes</p>
            <p className="text-2xl font-black text-neutral-900">{resumo.clientes}</p>
          </div>
          <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm p-3 text-center">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider mb-0.5">Receita</p>
            <p className="text-sm font-black text-neutral-900">{fmtBRL(resumo.receita)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTROS.map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtro === f ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {filtradas.length === 0
            ? <div className="text-center py-12 text-neutral-300">
                <Megaphone size={32} className="mx-auto mb-2 opacity-40" />
                <p className="font-black text-sm">Nenhuma campanha</p>
              </div>
            : filtradas.map(c => (
                <CardCampanha key={c.id} camp={c} onStatusChange={handleStatusChange} />
              ))
          }
        </div>

        </>)}
      </div>

      {modal && <FormCampanha onSalvar={handleNovaCampanha} onFechar={() => setModal(false)} />}
    </div>
  );
}
