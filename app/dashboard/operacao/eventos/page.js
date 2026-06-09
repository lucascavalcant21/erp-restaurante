"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchEventos, inserirEvento, atualizarEvento, removerEvento, EVENTOS_SEED } from "../../../lib/eventos";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  Check,
  AlertCircle,
  ChevronDown,
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function diasParaEvento(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return dias;
}

// ─── Status ───────────────────────────────────────────────────────────────────
const STATUS_OPTS = ["Confirmado", "Pendente", "Cancelado", "Concluído"];
const STATUS_STYLE = {
  Confirmado: { bg: "bg-emerald-100", text: "text-emerald-700", Icon: CheckCircle2, iconColor: "text-emerald-500" },
  Pendente:   { bg: "bg-amber-100",   text: "text-amber-700",   Icon: HelpCircle,  iconColor: "text-amber-500"   },
  Cancelado:  { bg: "bg-[rgba(5,150,105,0.15)]",    text: "text-accent-strong",    Icon: XCircle,     iconColor: "text-accent"    },
  Concluído:  { bg: "bg-elevated", text: "text-muted", Icon: CheckCircle2,iconColor: "text-dim" },
};

// ─── Tipos de evento ──────────────────────────────────────────────────────────
const TIPOS = ["Todos", "Casamento", "Aniversário", "Corporativo", "Formatura", "Confraternização", "Churrasco", "Outro"];

// ─── Seed de dados ────────────────────────────────────────────────────────────
// ─── Componente: Card de evento ───────────────────────────────────────────────
function CardEvento({ evento, onEditar, onDeletar, onMudarStatus }) {
  const st     = STATUS_STYLE[evento.status] ?? STATUS_STYLE.Pendente;
  const lucro  = evento.valor_contrato - evento.custo_estimado;
  const margem = evento.valor_contrato > 0 ? (lucro / evento.valor_contrato) * 100 : 0;
  const dias   = diasParaEvento(evento.data);
  const futuro = dias !== null && dias > 0;

  return (
    <div className={`bg-card rounded-2xl border  overflow-hidden ${evento.status === "Cancelado" ? "opacity-60 border-white/8" : "border-white/5"}`}>
      <div className="px-4 pt-4 pb-3">
        {/* Topo */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[10px] font-black text-dim uppercase tracking-wider">{evento.tipo}</span>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                {evento.status}
              </span>
              {futuro && (
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${dias <= 7 ? "bg-[rgba(5,150,105,0.15)] text-accent-strong" : dias <= 30 ? "bg-amber-100 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                  {dias === 0 ? "Hoje!" : `Em ${dias}d`}
                </span>
              )}
            </div>
            <p className="text-base font-black leading-tight text-fg">{evento.nome}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-black text-fg">{fmtBRL(evento.valor_contrato)}</p>
            <p className="text-[11px] text-dim font-medium">contrato</p>
          </div>
        </div>

        {/* Infos */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-[12px] text-muted font-medium">
            <Calendar size={13} className="text-dim flex-shrink-0" />
            {fmtDataHora(evento.data)}
          </div>
          {evento.local && (
            <div className="flex items-center gap-2 text-[12px] text-muted font-medium">
              <MapPin size={13} className="text-dim flex-shrink-0" />
              <span className="truncate">{evento.local}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[12px] text-muted font-medium">
            <Users size={13} className="text-dim flex-shrink-0" />
            {evento.convidados} convidados · Resp: {evento.responsavel}
          </div>
        </div>

        {/* Break-even / Lucratividade */}
        <div className=" rounded-xl px-3 py-2.5 mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-[10px] font-black text-dim uppercase tracking-wider">Lucro Estimado</p>
            <p className={`text-sm font-black ${lucro >= 0 ? "text-emerald-700" : "text-accent-strong"}`}>{fmtBRL(lucro)}</p>
          </div>
          <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(Math.max(margem, 0), 100)}%`, backgroundColor: margem >= 40 ? "#10b981" : margem >= 20 ? "#f59e0b" : "#f43f5e" }} />
          </div>
          <div className="flex justify-between text-[10px] font-bold mt-1">
            <span className="text-dim">Custo: {fmtBRL(evento.custo_estimado)}</span>
            <span className={margem >= 40 ? "text-emerald-600" : margem >= 20 ? "text-amber-500" : "text-accent"}>
              Margem: {margem.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Observações */}
        {evento.observacoes && (
          <p className="text-[11px] text-subtle font-medium  rounded-xl px-3 py-2 mb-3 leading-relaxed">
            {evento.observacoes}
          </p>
        )}

        {/* Mudar status rápido */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTS.filter(s => s !== evento.status).map(s => {
            const sst = STATUS_STYLE[s];
            return (
              <button key={s} onClick={() => onMudarStatus(evento.id, s)}
                className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-colors active:scale-95 ${sst.bg} ${sst.text} border-transparent`}>
                → {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center border-t border-neutral-50 divide-x divide-neutral-50">
        <button onClick={() => onEditar(evento)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-muted active: transition-colors">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onDeletar(evento.id)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-accent active:bg-[rgba(5,150,105,0.1)] transition-colors">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </div>
  );
}

// ─── Formulário: Cadastrar / Editar Evento ────────────────────────────────────
function FormEvento({ inicial, onSalvar, onCancelar }) {
  const [nome,       setNome]       = useState(inicial?.nome            ?? "");
  const [tipo,       setTipo]       = useState(inicial?.tipo            ?? "Outro");
  const [status,     setStatus]     = useState(inicial?.status          ?? "Pendente");
  const [data,       setData]       = useState(inicial?.data            ?? "");
  const [local,      setLocal]      = useState(inicial?.local           ?? "");
  const [responsavel,setResponsavel]= useState(inicial?.responsavel     ?? "");
  const [convidados, setConvidados] = useState(inicial?.convidados      ?? "");
  const [valor,      setValor]      = useState(inicial?.valor_contrato  ?? "");
  const [custo,      setCusto]      = useState(inicial?.custo_estimado  ?? "");
  const [obs,        setObs]        = useState(inicial?.observacoes     ?? "");
  const [erro,       setErro]       = useState("");

  const valorN = parseFloat(valor) || 0;
  const custoN = parseFloat(custo) || 0;
  const lucroPreview = valorN - custoN;
  const margemPreview = valorN > 0 ? (lucroPreview / valorN) * 100 : null;

  function handleSalvar() {
    if (!nome.trim()) { setErro("Informe o nome do evento."); return; }
    if (!data)        { setErro("Informe a data e hora do evento."); return; }
    setErro("");
    onSalvar({
      id:               inicial?.id ?? `ev${Date.now()}`,
      nome:             nome.trim(),
      tipo,
      status,
      data,
      local:            local.trim(),
      responsavel:      responsavel.trim(),
      convidados:       parseInt(convidados) || 0,
      valor_contrato:   valorN,
      custo_estimado:   custoN,
      observacoes:      obs.trim(),
    });
  }

  return (
    <div className="bg-card rounded-2xl border border-white/5  p-5 space-y-4">
      <p className="text-sm font-black text-fg">{inicial ? "Editar Evento" : "Novo Evento"}</p>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Nome do Evento *</label>
        <input type="text" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }}
          placeholder="ex: Casamento Silva & Costa"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg placeholder:text-dim placeholder:font-medium focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Tipo</label>
          <div className="relative">
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full appearance-none  border border-white/8 rounded-xl px-3 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-8" style={{ background: "#1E293B", color: "#F1F5F9" }} >
              {TIPOS.filter(t => t !== "Todos").map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Status</label>
          <div className="relative">
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full appearance-none  border border-white/8 rounded-xl px-3 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-8" style={{ background: "#1E293B", color: "#F1F5F9" }} >
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Data e Hora *</label>
        <input type="datetime-local" value={data} onChange={e => { setData(e.target.value); setErro(""); }}
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Local</label>
        <input type="text" value={local} onChange={e => setLocal(e.target.value)}
          placeholder="ex: Salão Villa Bella"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Responsável</label>
          <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)}
            placeholder="Nome"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Convidados</label>
          <input type="number" inputMode="numeric" min="0" value={convidados} onChange={e => setConvidados(e.target.value)}
            placeholder="0"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Valor do Contrato (R$)</label>
          <input type="number" inputMode="decimal" step="100" min="0" value={valor} onChange={e => setValor(e.target.value)}
            placeholder="0"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Custo Estimado (R$)</label>
          <input type="number" inputMode="decimal" step="100" min="0" value={custo} onChange={e => setCusto(e.target.value)}
            placeholder="0"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
      </div>

      {/* Preview de lucro */}
      {valorN > 0 && (
        <div className={`rounded-xl border px-4 py-3 ${lucroPreview >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-[rgba(5,150,105,0.1)] border-[rgba(5,150,105,0.3)]"}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${lucroPreview >= 0 ? "text-emerald-500" : "text-accent"}`}>Lucro Estimado</p>
              <p className={`text-xl font-black ${lucroPreview >= 0 ? "text-emerald-800" : "text-accent-strong"}`}>{fmtBRL(lucroPreview)}</p>
            </div>
            {margemPreview !== null && (
              <p className={`text-sm font-black ${margemPreview >= 40 ? "text-emerald-600" : margemPreview >= 20 ? "text-amber-500" : "text-accent"}`}>
                {margemPreview.toFixed(1)}% margem
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Observações</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)}
          placeholder="Cardápio, exigências especiais, pendências..."
          rows={3}
          className="w-full  border border-white/8 rounded-xl px-4 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent resize-none" />
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
          {inicial ? "Salvar Alterações" : "Criar Evento"}
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function EventosPage() {
  const router = useRouter();

  const [eventos,    setEventos]   = useState([]);
  const [loading,    setLoading]   = useState(true);

  useEffect(() => {
    fetchEventos().then(({ data }) => {
      setEventos(data);
      setLoading(false);
    });
  }, []);
  const [busca,      setBusca]     = useState("");
  const [filtroTipo, setFiltroTipo]= useState("Todos");
  const [filtroSt,   setFiltroSt]  = useState("Todos");
  const [formAberto, setFormAberto]= useState(false);
  const [evEditar,   setEvEditar]  = useState(null);
  const [salvou,     setSalvou]    = useState(false);

  // ── Métricas ──────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const confirmados = eventos.filter(e => e.status === "Confirmado");
    const faturamento = confirmados.reduce((a, e) => a + e.valor_contrato, 0);
    const lucro       = confirmados.reduce((a, e) => a + (e.valor_contrato - e.custo_estimado), 0);
    const proximos    = eventos.filter(e => {
      const d = diasParaEvento(e.data);
      return d !== null && d >= 0 && d <= 30 && e.status !== "Cancelado" && e.status !== "Concluído";
    }).length;
    return {
      total: eventos.length,
      confirmados: confirmados.length,
      faturamento,
      lucro,
      proximos,
    };
  }, [eventos]);

  // ── Filtragem ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    return eventos.filter(e => {
      const matchBusca = e.nome.toLowerCase().includes(busca.toLowerCase());
      const matchTipo  = filtroTipo === "Todos" || e.tipo === filtroTipo;
      const matchSt    = filtroSt === "Todos"   || e.status === filtroSt;
      return matchBusca && matchTipo && matchSt;
    }).sort((a, b) => new Date(a.data) - new Date(b.data));
  }, [eventos, busca, filtroTipo, filtroSt]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSalvar(ev) {
    if (evEditar) {
      setEventos(prev => prev.map(e => e.id === ev.id ? ev : e));
    } else {
      setEventos(prev => [...prev, ev]);
    }
    setFormAberto(false);
    setEvEditar(null);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
  }

  function handleEditar(ev) {
    setEvEditar(ev);
    setFormAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDeletar(id) {
    removerEvento(id); setEventos(prev => prev.filter(e => e.id !== id));
  }

  function handleMudarStatus(id, novoStatus) {
    setEventos(prev => prev.map(e => e.id === id ? { ...e, status: novoStatus } : e));
  }

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3 flex items-center gap-3" style={{ background: 'var(--surface)' }}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Gestão de Eventos</h1>
          <p className="text-[11px] text-dim font-medium">Planejamento, reservas e break-even</p>
        </div>
        <button onClick={() => { setEvEditar(null); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-accent text-white  active:scale-95 transition-all">
          <Plus size={14} /> Novo Evento
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Toast */}
        {salvou && (
          <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-2xl px-4 py-3">
            <Check size={15} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-black text-emerald-800">Evento salvo!</p>
          </div>
        )}

        {/* Formulário */}
        {formAberto && (
          <FormEvento
            inicial={evEditar}
            onSalvar={handleSalvar}
            onCancelar={() => { setFormAberto(false); setEvEditar(null); }}
          />
        )}

        {/* ── Cards de Resumo ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-white/5  p-4">
            <div className="w-8 h-8 rounded-xl bg-elevated flex items-center justify-center mb-2">
              <Calendar size={16} className="text-muted" />
            </div>
            <p className="text-2xl font-black text-fg">{resumo.confirmados}</p>
            <p className="text-[11px] font-bold text-dim">Eventos confirmados</p>
          </div>
          <div className={`rounded-2xl border  p-4 ${resumo.proximos > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-white/5"}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${resumo.proximos > 0 ? "bg-amber-100" : "bg-elevated"}`}>
              <Clock size={16} className={resumo.proximos > 0 ? "text-amber-500" : "text-dim"} />
            </div>
            <p className={`text-2xl font-black ${resumo.proximos > 0 ? "text-amber-800" : "text-fg"}`}>{resumo.proximos}</p>
            <p className={`text-[11px] font-bold ${resumo.proximos > 0 ? "text-amber-500" : "text-dim"}`}>Próximos 30 dias</p>
          </div>
          <div className="bg-card rounded-2xl border border-white/5  p-4">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center mb-2">
              <DollarSign size={16} className="text-blue-600" />
            </div>
            <p className="text-lg font-black text-fg">{fmtBRL(resumo.faturamento)}</p>
            <p className="text-[11px] font-bold text-dim">Faturamento confirmado</p>
          </div>
          <div className="bg-card rounded-2xl border border-white/5  p-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <p className="text-lg font-black text-emerald-800">{fmtBRL(resumo.lucro)}</p>
            <p className="text-[11px] font-bold text-dim">Lucro estimado</p>
          </div>
        </div>

        {/* ── Busca + Filtros ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar evento..."
              className="w-full bg-card border border-white/8 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent " />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={15} className="text-dim" />
              </button>
            )}
          </div>
          {/* Filtro por status */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["Todos", ...STATUS_OPTS].map(s => (
              <button key={s} onClick={() => setFiltroSt(s)}
                className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtroSt === s ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
                {s}
              </button>
            ))}
          </div>
          {/* Filtro por tipo */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TIPOS.map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtroTipo === t ? "bg-neutral-700 text-white" : "bg-card text-subtle border border-white/8"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Lista de Eventos ──────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-dim uppercase tracking-wider">Eventos</p>
            <p className="text-[11px] font-bold text-dim">{filtrados.length} evento{filtrados.length !== 1 ? "s" : ""}</p>
          </div>

          {filtrados.length === 0 ? (
            <div className="bg-card rounded-2xl border border-white/5  p-8 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center mb-1">
                <Calendar size={22} className="text-elevated" />
              </div>
              <p className="text-sm font-bold text-subtle">{busca ? "Nenhum evento encontrado" : "Nenhum evento cadastrado"}</p>
              <p className="text-xs text-dim font-medium">
                {busca ? `Sem resultados para "${busca}"` : "Clique em Novo Evento para começar."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrados.map(ev => (
                <CardEvento key={ev.id} evento={ev}
                  onEditar={handleEditar}
                  onDeletar={handleDeletar}
                  onMudarStatus={handleMudarStatus} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
