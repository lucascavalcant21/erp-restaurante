"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  RefreshCw,
} from "lucide-react";
import {
  fetchFuncionarios,
  fetchPontoMes,
  registrarPonto,
  FUNCIONARIOS_SEED,
} from "../../../lib/rh";
import Skeleton from "../../../components/Skeleton";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtHora(str) {
  // "08:00" → retorna como está
  return str || "--:--";
}

function diffHoras(entrada, saida) {
  if (!entrada || !saida) return null;
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = saida.split(":").map(Number);
  const totalMin = (sh * 60 + sm) - (eh * 60 + em);
  if (totalMin <= 0) return null;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { h, m, totalMin, label: `${h}h${m > 0 ? m + "m" : ""}` };
}

function fmtData(dataStr) {
  // "2026-06-02" → "02/06"
  const [, m, d] = dataStr.split("-");
  return `${d}/${m}`;
}

function diaSemana(dataStr) {
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const d = new Date(dataStr + "T12:00:00");
  return dias[d.getDay()];
}

function statusRegistro(reg) {
  if (!reg.entrada) return "falta";
  const [eh] = reg.entrada.split(":").map(Number);
  const [, em] = reg.entrada.split(":").map(Number);
  const totalMin = eh * 60 + em;
  if (totalMin > (8 * 60 + 10)) return "atraso"; // mais de 10 min de atraso
  if (!reg.saida) return "em_servico";
  return "ok";
}

const STATUS_STYLE = {
  ok:          { label: "Normal",      bg: "bg-emerald-100", cor: "text-emerald-700", dot: "#10b981" },
  atraso:      { label: "Atraso",      bg: "bg-amber-100",   cor: "text-amber-700",   dot: "#f59e0b" },
  falta:       { label: "Falta",       bg: "bg-rose-100",    cor: "text-rose-700",    dot: "#f43f5e" },
  em_servico:  { label: "Em serviço",  bg: "bg-blue-100",    cor: "text-blue-700",    dot: "#3b82f6" },
};

// ─── Mês atual ─────────────────────────────────────────────────────────────────
function mesAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Card de linha de registro ────────────────────────────────────────────────
function LinhaRegistro({ reg }) {
  const st  = statusRegistro(reg);
  const stl = STATUS_STYLE[st];
  const dur = reg.entrada && reg.saida ? diffHoras(reg.entrada, reg.saida) : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-0">
      <div className="flex-shrink-0 w-10 text-center">
        <p className="text-[10px] font-black text-neutral-400">{diaSemana(reg.data)}</p>
        <p className="text-[13px] font-black text-neutral-700">{fmtData(reg.data)}</p>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-[9px] font-black text-neutral-400 uppercase">Entrada</p>
          <p className={`text-[13px] font-black ${reg.entrada ? "text-neutral-900" : "text-neutral-300"}`}>{fmtHora(reg.entrada)}</p>
        </div>
        <div>
          <p className="text-[9px] font-black text-neutral-400 uppercase">Saída</p>
          <p className={`text-[13px] font-black ${reg.saida ? "text-neutral-900" : "text-neutral-300"}`}>{fmtHora(reg.saida)}</p>
        </div>
        <div>
          <p className="text-[9px] font-black text-neutral-400 uppercase">Total</p>
          <p className={`text-[13px] font-black ${dur ? "text-emerald-700" : "text-neutral-300"}`}>{dur ? dur.label : "--"}</p>
        </div>
      </div>
      <span className={`flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-full ${stl.bg} ${stl.cor}`}>{stl.label}</span>
    </div>
  );
}

// ─── Card de funcionário com histórico expansível ─────────────────────────────
function CardFuncionario({ func, registros }) {
  const [aberto, setAberto] = useState(false);

  const stats = useMemo(() => {
    const dias    = registros.length;
    const faltas  = registros.filter(r => !r.entrada).length;
    const atrasos = registros.filter(r => statusRegistro(r) === "atraso").length;
    const minsTrab = registros.reduce((acc, r) => {
      const d = r.entrada && r.saida ? diffHoras(r.entrada, r.saida) : null;
      return acc + (d ? d.totalMin : 0);
    }, 0);
    const hTrab = Math.floor(minsTrab / 60);
    const mTrab = minsTrab % 60;
    return { dias, faltas, atrasos, hTrab, mTrab };
  }, [registros]);

  const temAlerta = stats.faltas > 0 || stats.atrasos >= 2;
  const iniciais  = func.nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${temAlerta ? "border-amber-200" : "border-neutral-100"} bg-white`}>
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setAberto(v => !v)}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${temAlerta ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
            {iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-neutral-900 truncate">{func.nome}</p>
              {temAlerta && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />}
            </div>
            <p className="text-[11px] font-medium text-neutral-400">{func.cargo} · {func.turno}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-black text-neutral-900">{stats.hTrab}h{stats.mTrab > 0 ? stats.mTrab + "m" : ""}</p>
            <p className="text-[10px] font-bold text-neutral-400">trabalhadas</p>
          </div>
          {aberto ? <ChevronUp size={16} className="text-neutral-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-neutral-400 flex-shrink-0" />}
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-neutral-50 rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-black text-neutral-400 uppercase">Dias</p>
            <p className="text-sm font-black text-neutral-900">{stats.dias}</p>
          </div>
          <div className={`rounded-xl px-2 py-2 text-center ${stats.atrasos > 0 ? "bg-amber-50" : "bg-neutral-50"}`}>
            <p className="text-[9px] font-black text-neutral-400 uppercase">Atrasos</p>
            <p className={`text-sm font-black ${stats.atrasos > 0 ? "text-amber-700" : "text-neutral-900"}`}>{stats.atrasos}</p>
          </div>
          <div className={`rounded-xl px-2 py-2 text-center ${stats.faltas > 0 ? "bg-rose-50" : "bg-neutral-50"}`}>
            <p className="text-[9px] font-black text-neutral-400 uppercase">Faltas</p>
            <p className={`text-sm font-black ${stats.faltas > 0 ? "text-rose-700" : "text-neutral-900"}`}>{stats.faltas}</p>
          </div>
        </div>
      </button>

      {aberto && (
        <div className="px-4 pb-4 border-t border-neutral-100">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider pt-3 mb-2">Registros do Mês</p>
          {registros.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-4">Nenhum registro</p>
            : registros.map(r => <LinhaRegistro key={r.id} reg={r} />)
          }
        </div>
      )}
    </div>
  );
}

// ─── Modal: Registrar Ponto ───────────────────────────────────────────────────
const BLANK_REG = { func_id: "", tipo: "entrada", hora: "", data: new Date().toISOString().slice(0, 10) };

function ModalPonto({ funcionarios, onSalvar, onFechar }) {
  const [form, setForm] = useState(BLANK_REG);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function salvar() {
    if (!form.func_id || !form.hora) return;
    onSalvar(form);
    onFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onFechar}>
      <div className="w-full bg-white rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto" />
        <h2 className="text-lg font-black text-neutral-900">Registrar Ponto</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Funcionário</label>
            <select value={form.func_id} onChange={e => set("func_id", e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]">
              <option value="">Selecionar...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {[["entrada","Entrada"],["saida","Saída"]].map(([v, l]) => (
                  <button key={v} onClick={() => set("tipo", v)}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all ${form.tipo === v ? (v === "entrada" ? "bg-emerald-600 text-white" : "bg-rose-500 text-white") : "bg-neutral-100 text-neutral-600"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Hora</label>
              <input type="time" value={form.hora} onChange={e => set("hora", e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Data</label>
            <input type="date" value={form.data} onChange={e => set("data", e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
          </div>
        </div>
        <button onClick={salvar}
          className="w-full py-3.5 rounded-2xl bg-neutral-900 text-white font-black text-sm active:scale-95 transition-transform">
          Confirmar Registro
        </button>
        <button onClick={onFechar} className="w-full py-2 text-neutral-400 text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function PontoPage() {
  const router = useRouter();
  const [busca,        setBusca]        = useState("");
  const [modalAberto,  setModal]        = useState(false);
  const [funcionarios, setFuncionarios] = useState(FUNCIONARIOS_SEED);
  const [registros,    setRegistros]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [fromSeed,     setFromSeed]     = useState(false);
  const [mes,          setMes]          = useState(mesAtual);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const [resFunc, resPonto] = await Promise.all([
      fetchFuncionarios(),
      fetchPontoMes(mes),
    ]);
    if (resFunc.fromSeed) {
      setFuncionarios(FUNCIONARIOS_SEED);
      setFromSeed(true);
    } else {
      setFuncionarios(resFunc.data);
    }
    if (resPonto.fromSeed) {
      const { REGISTROS_PONTO_SEED } = await import("../../../lib/rh");
      setRegistros(REGISTROS_PONTO_SEED);
      setFromSeed(true);
    } else {
      setRegistros(resPonto.data);
      setFromSeed(false);
    }
    setLoading(false);
  }, [mes]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // Agrupa registros por funcionário
  const porFuncionario = useMemo(() => {
    return funcionarios
      .filter(f =>
        f.nome.toLowerCase().includes(busca.toLowerCase()) ||
        f.cargo.toLowerCase().includes(busca.toLowerCase())
      )
      .map(f => ({
        func: f,
        registros: registros
          .filter(r => r.func_id === f.id)
          .sort((a, b) => a.data.localeCompare(b.data)),
      }));
  }, [registros, funcionarios, busca]);

  // KPIs gerais
  const resumo = useMemo(() => {
    const totalFaltas  = registros.filter(r => !r.entrada).length;
    const totalAtrasos = registros.filter(r => statusRegistro(r) === "atraso").length;
    const emServico    = registros.filter(r => statusRegistro(r) === "em_servico").length;
    return { totalFaltas, totalAtrasos, emServico };
  }, [registros]);

  async function handleRegistro(form) {
    if (fromSeed) {
      // Modo seed: atualiza local
      const novo = {
        id: `r${Date.now()}`,
        func_id: form.func_id,
        data: form.data,
        entrada: form.tipo === "entrada" ? form.hora : null,
        saida:   form.tipo === "saida"   ? form.hora : null,
      };
      setRegistros(prev => {
        const idx = prev.findIndex(r => r.func_id === form.func_id && r.data === form.data);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], [form.tipo]: form.hora };
          return updated;
        }
        return [...prev, novo];
      });
    } else {
      await registrarPonto(form.func_id, form.data, form.tipo, form.hora);
      await carregarDados();
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-neutral-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-neutral-900 leading-tight">Controle de Ponto</h1>
            <p className="text-[11px] text-neutral-400 font-medium">Registros de entrada e saída</p>
          </div>
          <button onClick={carregarDados}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform mr-1">
            <RefreshCw size={15} className="text-neutral-500" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 bg-neutral-900 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform">
            <Clock size={13} />
            Bater Ponto
          </button>
        </div>

        {/* Seletor de mês */}
        <div className="mt-3">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] shadow-sm" />
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Banner demo */}
        {fromSeed && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-[11px] font-black text-amber-700">Modo demonstração — configure o Supabase para dados reais</p>
          </div>
        )}

        {loading && <Skeleton count={3} />}

        {!loading && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider mb-1">Em serviço</p>
                <p className="text-2xl font-black text-blue-800">{resumo.emServico}</p>
              </div>
              <div className={`rounded-2xl border p-3 text-center ${resumo.totalAtrasos > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-neutral-100"}`}>
                <p className={`text-[9px] font-black uppercase tracking-wider mb-1 ${resumo.totalAtrasos > 0 ? "text-amber-600" : "text-neutral-400"}`}>Atrasos</p>
                <p className={`text-2xl font-black ${resumo.totalAtrasos > 0 ? "text-amber-800" : "text-neutral-900"}`}>{resumo.totalAtrasos}</p>
              </div>
              <div className={`rounded-2xl border p-3 text-center ${resumo.totalFaltas > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-neutral-100"}`}>
                <p className={`text-[9px] font-black uppercase tracking-wider mb-1 ${resumo.totalFaltas > 0 ? "text-rose-600" : "text-neutral-400"}`}>Faltas</p>
                <p className={`text-2xl font-black ${resumo.totalFaltas > 0 ? "text-rose-800" : "text-neutral-900"}`}>{resumo.totalFaltas}</p>
              </div>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar funcionário..."
                className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] shadow-sm" />
              {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-neutral-400" /></button>}
            </div>

            {/* Cards por funcionário */}
            <div className="space-y-3">
              {porFuncionario.map(({ func, registros: regs }) => (
                <CardFuncionario key={func.id} func={func} registros={regs} />
              ))}
            </div>

            <p className="text-[10px] text-neutral-300 font-medium text-center">
              * Turno-base: 08:00. Atraso registrado após 10 min de tolerância.
            </p>
          </>
        )}
      </div>

      {modalAberto && (
        <ModalPonto funcionarios={funcionarios} onSalvar={handleRegistro} onFechar={() => setModal(false)} />
      )}
    </div>
  );
}
