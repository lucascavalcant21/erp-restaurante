"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  ThumbsUp,
  Minus,
  ThumbsDown,
  Send,
  X,
  RefreshCw,
} from "lucide-react";
import { fetchAvaliacoes, inserirAvaliacao, AVALIACOES_SEED } from "../../../lib/clientes";
import Skeleton from "../../../components/Skeleton";

// ─── NPS Score ────────────────────────────────────────────────────────────────
// Promotores: 9-10 | Neutros: 7-8 | Detratores: 0-6
// NPS = % Promotores - % Detratores

function calcNPS(avaliacoes) {
  if (!avaliacoes.length) return { score: 0, promotores: 0, neutros: 0, detratores: 0, pct_p: 0, pct_n: 0, pct_d: 0 };
  const promotores  = avaliacoes.filter(a => a.nota >= 9).length;
  const neutros     = avaliacoes.filter(a => a.nota >= 7 && a.nota <= 8).length;
  const detratores  = avaliacoes.filter(a => a.nota <= 6).length;
  const total       = avaliacoes.length;
  const score       = Math.round((promotores / total - detratores / total) * 100);
  return {
    score, promotores, neutros, detratores,
    pct_p: Math.round(promotores / total * 100),
    pct_n: Math.round(neutros    / total * 100),
    pct_d: Math.round(detratores / total * 100),
  };
}

function scoreCor(score) {
  if (score >= 75) return { bg: "bg-emerald-50", borda: "border-emerald-200", cor: "text-emerald-800", label: "Excelente" };
  if (score >= 50) return { bg: "bg-blue-50",    borda: "border-blue-200",    cor: "text-blue-800",    label: "Muito Bom" };
  if (score >= 0)  return { bg: "bg-amber-50",   borda: "border-amber-200",   cor: "text-amber-800",   label: "Bom"       };
  return                  { bg: "bg-rose-50",    borda: "border-rose-200",    cor: "text-rose-800",    label: "Crítico"   };
}

// AVALIACOES_SEED importado de lib/clientes.js

const UNIDADES_OPT = ["Todas", "Seldeestrela", "Tico Tico Saladas", "Burguer"];
const FILTROS_NPS  = ["Todas", "Promotores", "Neutros", "Detratores"];

function categoriaNota(nota) {
  if (nota >= 9) return "promotor";
  if (nota >= 7) return "neutro";
  return "detrator";
}

const CATEGORIA_STYLE = {
  promotor: { label: "Promotor",  Icon: ThumbsUp,   bg: "bg-emerald-100", cor: "text-emerald-700" },
  neutro:   { label: "Neutro",    Icon: Minus,       bg: "bg-neutral-100", cor: "text-neutral-500" },
  detrator: { label: "Detrator",  Icon: ThumbsDown,  bg: "bg-rose-100",    cor: "text-rose-600"    },
};

// ─── Botão de nota (para enviar nova avaliação) ───────────────────────────────
function BotaoNota({ val, selecionado, onClick }) {
  const cor = val >= 9 ? "border-emerald-400 bg-emerald-50 text-emerald-700"
            : val >= 7 ? "border-neutral-300 bg-neutral-50 text-neutral-600"
            :             "border-rose-300 bg-rose-50 text-rose-600";
  const selCor = val >= 9 ? "bg-emerald-600 border-emerald-600 text-white"
               : val >= 7 ? "bg-neutral-700 border-neutral-700 text-white"
               :             "bg-rose-600 border-rose-600 text-white";
  return (
    <button
      onClick={() => onClick(val)}
      className={`w-8 h-8 rounded-lg border-2 text-xs font-black transition-all active:scale-90 ${selecionado ? selCor : cor}`}>
      {val}
    </button>
  );
}

// ─── Modal nova avaliação ─────────────────────────────────────────────────────
function ModalAvaliacao({ onSalvar, onFechar }) {
  const [nota,       setNota]       = useState(null);
  const [comentario, setComentario] = useState("");
  const [nome,       setNome]       = useState("");
  const [unidade,    setUnidade]    = useState("Seldeestrela");

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onFechar}>
      <div className="w-full bg-white rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto" />
        <h2 className="text-lg font-black text-neutral-900">Nova Avaliação</h2>

        <div>
          <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Nome (opcional)</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>

        <div>
          <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-2">Unidade</label>
          <div className="flex gap-2">
            {["Seldeestrela", "Tico Tico Saladas", "Burguer"].map(u => (
              <button key={u} onClick={() => setUnidade(u)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 ${unidade === u ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}>
                {u.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-2">Nota (0–10)</label>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => (
              <BotaoNota key={i} val={i} selecionado={nota === i} onClick={setNota} />
            ))}
          </div>
          {nota !== null && (
            <p className={`text-[11px] font-black mt-2 ${nota >= 9 ? "text-emerald-700" : nota >= 7 ? "text-neutral-600" : "text-rose-600"}`}>
              {nota >= 9 ? "⭐ Promotor — vai recomendar!" : nota >= 7 ? "Neutro — satisfeito, mas não vai recomendar." : "⚠️ Detrator — insatisfeito."}
            </p>
          )}
        </div>

        <div>
          <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Comentário</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
            placeholder="O que achou?"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] resize-none" />
        </div>

        <button
          onClick={() => {
            if (nota === null) return;
            onSalvar({ nome: nome || "Anônimo", nota, comentario, unidade, data: new Date().toISOString().slice(0, 10) });
            onFechar();
          }}
          disabled={nota === null}
          className="w-full py-3.5 rounded-2xl bg-neutral-900 text-white font-black text-sm active:scale-95 transition-transform disabled:opacity-40">
          Enviar Avaliação
        </button>
        <button onClick={onFechar} className="w-full py-2 text-neutral-400 text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

// ─── Card de avaliação ────────────────────────────────────────────────────────
function CardAvaliacao({ aval }) {
  const cat  = CATEGORIA_STYLE[categoriaNota(aval.nota)];
  const Icon = cat.Icon;
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-4 py-3">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}`}>
          <Icon size={14} className={cat.cor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[12px] font-black text-neutral-900">{aval.nome}</p>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-neutral-900">{aval.nota}</span>
              <span className="text-[10px] text-neutral-400">/10</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${cat.bg} ${cat.cor}`}>{cat.label}</span>
            <span className="text-[10px] text-neutral-400">{aval.unidade}</span>
            <span className="text-[10px] text-neutral-400">{new Date(aval.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
          </div>
          {aval.comentario && <p className="text-[11px] font-medium text-neutral-600 leading-snug">{aval.comentario}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function NPSPage() {
  const router = useRouter();
  const [filtro,     setFiltro]     = useState("Todas");
  const [unidade,    setUnidade]    = useState("Todas");
  const [modal,      setModal]      = useState(false);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fromSeed,   setFromSeed]   = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const res = await fetchAvaliacoes();
    if (res.fromSeed) {
      setAvaliacoes(AVALIACOES_SEED);
      setFromSeed(true);
    } else {
      setAvaliacoes(res.data);
      setFromSeed(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const nps = useMemo(() => calcNPS(avaliacoes), [avaliacoes]);
  const st  = scoreCor(nps.score);

  const filtradas = useMemo(() => {
    return avaliacoes.filter(a => {
      const cat = categoriaNota(a.nota);
      const matchFiltro  = filtro === "Todas"
        || (filtro === "Promotores" && cat === "promotor")
        || (filtro === "Neutros"    && cat === "neutro")
        || (filtro === "Detratores" && cat === "detrator");
      const matchUnidade = unidade === "Todas" || a.unidade === unidade;
      return matchFiltro && matchUnidade;
    }).sort((a, b) => b.data.localeCompare(a.data));
  }, [avaliacoes, filtro, unidade]);

  // Histograma de notas 0-10
  const histograma = useMemo(() => {
    const counts = Array(11).fill(0);
    avaliacoes.forEach(a => { counts[a.nota]++; });
    const max = Math.max(...counts, 1);
    return counts.map((c, i) => ({ nota: i, count: c, pct: Math.round((c / max) * 100) }));
  }, [avaliacoes]);

  async function handleNovaAvaliacao(form) {
    const nova = { id: `a${Date.now()}`, ...form, data: new Date().toISOString().slice(0, 10) };
    if (fromSeed) {
      setAvaliacoes(prev => [nova, ...prev]);
    } else {
      await inserirAvaliacao({ ...form, data: new Date().toISOString().slice(0, 10) });
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
            <h1 className="text-lg font-black text-neutral-900 leading-tight">Avaliações (NPS)</h1>
            <p className="text-[11px] text-neutral-400 font-medium">Satisfação dos clientes</p>
          </div>
          <button onClick={carregarDados}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform mr-1">
            <RefreshCw size={15} className="text-neutral-500" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 bg-neutral-900 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform">
            <Send size={13} /> Registrar
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {fromSeed && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-[11px] font-black text-amber-700">Modo demonstração — configure o Supabase para dados reais</p>
          </div>
        )}

        {loading && <Skeleton variant="kpi" count={4} />}

        {!loading && (<>

        {/* Score NPS principal */}
        <div className={`rounded-2xl border p-5 ${st.bg} ${st.borda}`}>
          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1">NPS Score</p>
          <div className="flex items-end gap-3 mb-3">
            <p className={`text-6xl font-black leading-none ${st.cor}`}>{nps.score}</p>
            <div className="pb-1">
              <p className={`text-sm font-black ${st.cor}`}>{st.label}</p>
              <p className="text-[11px] text-neutral-500 font-medium">{avaliacoes.length} avaliações</p>
            </div>
          </div>
          {/* Barra NPS */}
          <div className="h-2.5 rounded-full overflow-hidden flex mb-2">
            <div className="h-full bg-rose-400 transition-all duration-700" style={{ width: `${nps.pct_d}%` }} />
            <div className="h-full bg-neutral-300 transition-all duration-700" style={{ width: `${nps.pct_n}%` }} />
            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${nps.pct_p}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-black">
            <span className="text-rose-600">🔴 Detratores {nps.pct_d}%</span>
            <span className="text-neutral-500">⬜ Neutros {nps.pct_n}%</span>
            <span className="text-emerald-700">🟢 Promotores {nps.pct_p}%</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-1">Promotores</p>
            <p className="text-2xl font-black text-emerald-800">{nps.promotores}</p>
          </div>
          <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm p-3 text-center">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider mb-1">Neutros</p>
            <p className="text-2xl font-black text-neutral-900">{nps.neutros}</p>
          </div>
          <div className={`rounded-2xl border p-3 text-center ${nps.detratores > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-neutral-100"}`}>
            <p className={`text-[9px] font-black uppercase tracking-wider mb-1 ${nps.detratores > 0 ? "text-rose-500" : "text-neutral-400"}`}>Detratores</p>
            <p className={`text-2xl font-black ${nps.detratores > 0 ? "text-rose-700" : "text-neutral-900"}`}>{nps.detratores}</p>
          </div>
        </div>

        {/* Histograma de notas */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-3">Distribuição de Notas</p>
          <div className="flex items-end gap-1 h-16">
            {histograma.map(({ nota, count, pct }) => (
              <div key={nota} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: "48px" }}>
                  <div className="w-full rounded-t-sm transition-all duration-700"
                    style={{
                      height: `${pct}%`,
                      minHeight: count > 0 ? "4px" : "0",
                      backgroundColor: nota >= 9 ? "#10b981" : nota >= 7 ? "#9ca3af" : "#f43f5e",
                    }} />
                </div>
                <span className="text-[8px] font-black text-neutral-500">{nota}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTROS_NPS.map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtro === f ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {UNIDADES_OPT.map(u => (
            <button key={u} onClick={() => setUnidade(u)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${unidade === u ? "bg-emerald-700 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {u.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex justify-between px-1">
          <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">Avaliações</p>
          <p className="text-[11px] font-bold text-neutral-400">{filtradas.length}</p>
        </div>

        <div className="space-y-2">
          {filtradas.map(a => <CardAvaliacao key={a.id} aval={a} />)}
        </div>

        </>)}
      </div>

      {modal && <ModalAvaliacao onSalvar={handleNovaAvaliacao} onFechar={() => setModal(false)} />}
    </div>
  );
}
