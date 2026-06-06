"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  FileText,
  AlertCircle,
  Check,
  ChevronDown,
  Search,
  X,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  FileDown,
} from "lucide-react";
import { exportarTabelaPDF } from "../../../lib/exportPDF";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function diasParaVencer(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

// ─── Status ───────────────────────────────────────────────────────────────────
const STATUS_OPTS = ["Pendente", "Pago", "Vencido", "Cancelado"];
const STATUS_STYLE = {
  Pendente:  { bg: "bg-amber-100",   text: "text-amber-700",   Icon: Clock       },
  Pago:      { bg: "bg-emerald-100", text: "text-emerald-700", Icon: CheckCircle2 },
  Vencido:   { bg: "bg-rose-100",    text: "text-rose-700",    Icon: XCircle     },
  Cancelado: { bg: "bg-neutral-100", text: "text-neutral-500", Icon: XCircle     },
};

const TIPOS = ["Todos", "Nota Fiscal", "Boleto", "Fatura", "Contrato", "Recibo"];
const CATEGORIAS_DOC = ["Fornecedor", "Aluguel", "Energia", "Folha", "Imposto", "Marketing", "Outros"];

// ─── Seed de documentos ───────────────────────────────────────────────────────
const DOCS_SEED = [
  { id: "d1", tipo: "Boleto",      descricao: "Frigorifico São Paulo",   categoria: "Fornecedor", valor: 700,  emissao: "2026-06-01", vencimento: "2026-06-08", status: "Pago"     },
  { id: "d2", tipo: "Fatura",      descricao: "Conta de Energia",        categoria: "Energia",    valor: 680,  emissao: "2026-06-03", vencimento: "2026-06-15", status: "Pendente" },
  { id: "d3", tipo: "Boleto",      descricao: "Aluguel Loja",            categoria: "Aluguel",    valor: 2200, emissao: "2026-06-01", vencimento: "2026-06-15", status: "Pago"     },
  { id: "d4", tipo: "Nota Fiscal", descricao: "GrãoVerde — Grãos",       categoria: "Fornecedor", valor: 480,  emissao: "2026-05-30", vencimento: "2026-06-14", status: "Pago"     },
  { id: "d5", tipo: "Boleto",      descricao: "Simples Nacional",        categoria: "Imposto",    valor: 1265, emissao: "2026-06-01", vencimento: "2026-06-20", status: "Pendente" },
  { id: "d6", tipo: "Fatura",      descricao: "Folha de Pagamento",      categoria: "Folha",      valor: 5500, emissao: "2026-06-01", vencimento: "2026-06-05", status: "Pago"     },
  { id: "d7", tipo: "Boleto",      descricao: "Anúncios Meta Ads",       categoria: "Marketing",  valor: 320,  emissao: "2026-06-05", vencimento: "2026-06-25", status: "Pendente" },
  { id: "d8", tipo: "Nota Fiscal", descricao: "Embal Express",           categoria: "Fornecedor", valor: 280,  emissao: "2026-05-28", vencimento: "2026-06-05", status: "Vencido"  },
];

// ─── Formulário ───────────────────────────────────────────────────────────────
function FormDoc({ inicial, onSalvar, onCancelar }) {
  const [tipo,       setTipo]       = useState(inicial?.tipo       ?? "Boleto");
  const [descricao,  setDescricao]  = useState(inicial?.descricao  ?? "");
  const [categoria,  setCategoria]  = useState(inicial?.categoria  ?? "Fornecedor");
  const [valor,      setValor]      = useState(inicial?.valor      ?? "");
  const [emissao,    setEmissao]    = useState(inicial?.emissao    ?? new Date().toISOString().slice(0,10));
  const [vencimento, setVencimento] = useState(inicial?.vencimento ?? "");
  const [status,     setStatus]     = useState(inicial?.status     ?? "Pendente");
  const [erro,       setErro]       = useState("");

  function handleSalvar() {
    if (!descricao.trim())                { setErro("Informe a descrição."); return; }
    if (!valor || parseFloat(valor) <= 0) { setErro("Informe o valor."); return; }
    if (!vencimento)                       { setErro("Informe o vencimento."); return; }
    setErro("");
    onSalvar({
      id:        inicial?.id ?? `d${Date.now()}`,
      tipo, descricao: descricao.trim(), categoria,
      valor: parseFloat(valor), emissao, vencimento, status,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <p className="text-sm font-black text-neutral-900">{inicial ? "Editar Documento" : "Novo Documento"}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Tipo</label>
          <div className="relative">
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] pr-8">
              {TIPOS.filter(t => t !== "Todos").map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Categoria</label>
          <div className="relative">
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] pr-8">
              {CATEGORIAS_DOC.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Descrição</label>
        <input type="text" value={descricao} onChange={e => { setDescricao(e.target.value); setErro(""); }}
          placeholder="ex: Frigorifico São Paulo"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Valor (R$)</label>
          <input type="number" inputMode="decimal" step="0.01" min="0" value={valor} onChange={e => { setValor(e.target.value); setErro(""); }}
            placeholder="0,00"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-black text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Status</label>
          <div className="relative">
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] pr-8">
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Emissão</label>
          <input type="date" value={emissao} onChange={e => setEmissao(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Vencimento</label>
          <input type="date" value={vencimento} onChange={e => { setVencimento(e.target.value); setErro(""); }}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-rose-500 flex-shrink-0" />
          <p className="text-xs font-bold text-rose-700">{erro}</p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onCancelar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-neutral-700 bg-neutral-100 active:scale-95 transition-all">Cancelar</button>
        <button onClick={handleSalvar} className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-[#10b981] active:scale-95 transition-all shadow-md">
          {inicial ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

// ─── Card de documento ────────────────────────────────────────────────────────
function CardDoc({ doc, onEditar, onMudarStatus, onDeletar }) {
  const st   = STATUS_STYLE[doc.status] ?? STATUS_STYLE.Pendente;
  const dias = diasParaVencer(doc.vencimento);
  const urgente = doc.status === "Pendente" && dias !== null && dias <= 5;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${urgente ? "border-rose-200" : doc.status === "Vencido" ? "border-rose-200" : "border-neutral-100"}`}>
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">{doc.tipo}</span>
              <span className="text-[10px] font-bold text-neutral-400">·</span>
              <span className="text-[10px] font-bold text-neutral-400">{doc.categoria}</span>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>{doc.status}</span>
              {urgente && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">Vence em {dias}d!</span>}
            </div>
            <p className="text-sm font-black text-neutral-900 truncate">{doc.descricao}</p>
          </div>
          <p className="text-base font-black text-neutral-900 flex-shrink-0">{fmtBRL(doc.valor)}</p>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-bold text-neutral-400 mb-3">
          <span>Emissão: {fmtData(doc.emissao)}</span>
          <span className={doc.status === "Vencido" ? "text-rose-500 font-black" : ""}>
            Vencimento: {fmtData(doc.vencimento)}
          </span>
        </div>

        {/* Mudar status rápido */}
        {doc.status === "Pendente" && (
          <button onClick={() => onMudarStatus(doc.id, "Pago")}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-black text-emerald-700 active:scale-95 transition-all">
            <Check size={13} /> Marcar como Pago
          </button>
        )}
        {doc.status === "Vencido" && (
          <button onClick={() => onMudarStatus(doc.id, "Pago")}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-black text-rose-600 active:scale-95 transition-all">
            <Check size={13} /> Registrar Pagamento
          </button>
        )}
      </div>

      <div className="flex items-center border-t border-neutral-50 divide-x divide-neutral-50">
        <button onClick={() => onEditar(doc)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-neutral-600 active:bg-neutral-50 transition-colors">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onDeletar(doc.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-rose-400 active:bg-rose-50 transition-colors">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function DocumentosPage() {
  const router = useRouter();

  const [docs,       setDocs]       = useState(DOCS_SEED);
  const [busca,      setBusca]      = useState("");
  const [filtroSt,   setFiltroSt]   = useState("Todos");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [formAberto, setFormAberto] = useState(false);
  const [docEditar,  setDocEditar]  = useState(null);
  const [salvou,     setSalvou]     = useState(false);

  const resumo = useMemo(() => {
    const pendentes = docs.filter(d => d.status === "Pendente");
    const vencidos  = docs.filter(d => d.status === "Vencido");
    const pagos     = docs.filter(d => d.status === "Pago");
    const total_pendente = pendentes.reduce((a, d) => a + d.valor, 0);
    const total_pago     = pagos.reduce((a, d) => a + d.valor, 0);
    return { pendentes: pendentes.length, vencidos: vencidos.length, total_pendente, total_pago };
  }, [docs]);

  const filtrados = useMemo(() => {
    return docs.filter(d => {
      const matchBusca = d.descricao.toLowerCase().includes(busca.toLowerCase());
      const matchSt    = filtroSt   === "Todos" || d.status === filtroSt;
      const matchTipo  = filtroTipo === "Todos" || d.tipo   === filtroTipo;
      return matchBusca && matchSt && matchTipo;
    }).sort((a, b) => {
      // Vencidos e pendentes primeiro
      const ord = { Vencido: 0, Pendente: 1, Pago: 2, Cancelado: 3 };
      return (ord[a.status] ?? 4) - (ord[b.status] ?? 4);
    });
  }, [docs, busca, filtroSt, filtroTipo]);

  function handleSalvar(doc) {
    if (docEditar) {
      setDocs(prev => prev.map(d => d.id === doc.id ? doc : d));
    } else {
      setDocs(prev => [...prev, doc]);
    }
    setFormAberto(false);
    setDocEditar(null);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
  }

  function handleEditar(doc) {
    setDocEditar(doc);
    setFormAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleMudarStatus(id, novoStatus) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: novoStatus } : d));
  }

  function handleDeletar(id) {
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5]">
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Notas e Boletos</h1>
          <p className="text-[11px] text-neutral-400 font-medium">Contas a pagar e documentos fiscais</p>
        </div>
        <button
          onClick={() => exportarTabelaPDF({
            titulo: "Notas e Boletos",
            colunas: ["Descrição", "Tipo", "Categoria", "Vencimento", "Valor", "Status"],
            dados: filtrados.map(d => [
              d.descricao, d.tipo, d.categoria,
              new Date(d.vencimento + "T12:00:00").toLocaleDateString("pt-BR"),
              fmtBRL(d.valor),
              d.status === "pago" ? "Pago" : d.status === "vencido" ? "Vencido" : "Pendente",
            ]),
            rodape: `Total: ${filtrados.length} documentos · Gerado pelo Cerebro ERP`,
          })}
          className="flex items-center gap-1.5 bg-white border border-neutral-200 text-neutral-700 text-xs font-black px-2 py-2 rounded-xl active:scale-95 transition-transform shadow-sm mr-1">
          <FileDown size={13} /> PDF
        </button>
        <button onClick={() => { setDocEditar(null); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-[#10b981] text-white shadow-md active:scale-95 transition-all">
          <Plus size={14} /> Novo
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Toast */}
        {salvou && (
          <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-2xl px-4 py-3">
            <Check size={15} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-black text-emerald-800">Documento salvo!</p>
          </div>
        )}

        {/* Formulário */}
        {formAberto && (
          <FormDoc inicial={docEditar} onSalvar={handleSalvar} onCancelar={() => { setFormAberto(false); setDocEditar(null); }} />
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl border shadow-sm p-4 ${resumo.vencidos > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-neutral-100"}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${resumo.vencidos > 0 ? "bg-rose-100" : "bg-neutral-100"}`}>
              <AlertCircle size={16} className={resumo.vencidos > 0 ? "text-rose-500" : "text-neutral-400"} />
            </div>
            <p className={`text-2xl font-black ${resumo.vencidos > 0 ? "text-rose-700" : "text-neutral-900"}`}>{resumo.vencidos}</p>
            <p className={`text-[11px] font-bold ${resumo.vencidos > 0 ? "text-rose-500" : "text-neutral-400"}`}>Vencidos</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center mb-2">
              <Clock size={16} className="text-amber-500" />
            </div>
            <p className="text-xl font-black text-amber-800">{fmtBRL(resumo.total_pendente)}</p>
            <p className="text-[11px] font-bold text-amber-600">A pagar ({resumo.pendentes})</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm p-4 col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">Total Pago no Mês</p>
                <p className="text-2xl font-black text-emerald-800">{fmtBRL(resumo.total_pago)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar documento..."
            className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] shadow-sm" />
          {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-neutral-400" /></button>}
        </div>

        {/* Filtro status */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["Todos", ...STATUS_OPTS].map(s => (
            <button key={s} onClick={() => setFiltroSt(s)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtroSt === s ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Filtro tipo */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TIPOS.map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtroTipo === t ? "bg-neutral-700 text-white" : "bg-white text-neutral-500 border border-neutral-200"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div>
          <div className="flex justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">Documentos</p>
            <p className="text-[11px] font-bold text-neutral-400">{filtrados.length} documento{filtrados.length !== 1 ? "s" : ""}</p>
          </div>

          {filtrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex flex-col items-center text-center gap-2">
              <FileText size={28} className="text-neutral-200 mb-1" />
              <p className="text-sm font-bold text-neutral-500">Nenhum documento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrados.map(d => (
                <CardDoc key={d.id} doc={d}
                  onEditar={handleEditar}
                  onMudarStatus={handleMudarStatus}
                  onDeletar={handleDeletar} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
