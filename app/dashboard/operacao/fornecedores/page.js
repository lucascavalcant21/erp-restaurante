"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchFornecedores, inserirFornecedor, atualizarFornecedor, removerFornecedor, FORNECEDORES_SEED } from "../../../lib/fornecedores";
import { useERP } from "../../../context/ERPContext";
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
  Phone,
  Mail,
  MapPin,
  Truck,
  Star,
  ToggleLeft,
  ToggleRight,
  ShoppingCart,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Categorias / Segmentos ────────────────────────────────────────────────────
const SEGMENTOS = ["Todos", "Carnes", "Grãos e Cereais", "Hortifruti", "Laticínios", "Bebidas", "Embalagens", "Limpeza e Higiene", "Equipamentos", "Outros"];
const FORMAS_PAGAMENTO = ["À Vista", "Boleto 7d", "Boleto 15d", "Boleto 28d", "Cartão", "Pix"];

// ─── Seed de dados ────────────────────────────────────────────────────────────
// ─── Componente: Estrelas ─────────────────────────────────────────────────────
function Estrelas({ valor, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)}>
          <Star size={16} className={n <= valor ? "text-amber-400 fill-amber-400" : "text-neutral-200 fill-neutral-200"} />
        </button>
      ))}
    </div>
  );
}

// ─── Componente: Card de fornecedor ───────────────────────────────────────────
function CardFornecedor({ f, onEditar, onToggle, onDeletar }) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className={`bg-card rounded-2xl border  overflow-hidden transition-all ${!f.ativo ? "opacity-60 border-white/8" : "border-white/5"}`}>
      {/* Cabeçalho */}
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setExpandido(e => !e)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-dim uppercase tracking-wider">{f.segmento}</span>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${f.ativo ? "bg-emerald-100 text-emerald-700" : "bg-elevated text-subtle"}`}>
                {f.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="text-base font-black text-fg truncate">{f.nome}</p>
            <Estrelas valor={f.estrelas} />
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-black text-fg">{fmtBRL(f.total_compras)}</p>
            <p className="text-[11px] text-dim font-medium">total comprado</p>
          </div>
        </div>
      </button>

      {/* Detalhes expansíveis */}
      {expandido && (
        <div className="px-4 pb-4 space-y-2 border-t border-neutral-50 pt-3">
          {f.contato && (
            <div className="flex items-center gap-2 text-sm text-fg-soft font-medium">
              <div className="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center flex-shrink-0">
                <Truck size={13} className="text-subtle" />
              </div>
              {f.contato}
            </div>
          )}
          {f.telefone && (
            <a href={`tel:${f.telefone}`} className="flex items-center gap-2 text-sm text-blue-600 font-medium">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Phone size={13} className="text-blue-500" />
              </div>
              {f.telefone}
            </a>
          )}
          {f.email && (
            <a href={`mailto:${f.email}`} className="flex items-center gap-2 text-sm text-blue-600 font-medium">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Mail size={13} className="text-blue-500" />
              </div>
              <span className="truncate">{f.email}</span>
            </a>
          )}
          {f.cidade && (
            <div className="flex items-center gap-2 text-sm text-fg-soft font-medium">
              <div className="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center flex-shrink-0">
                <MapPin size={13} className="text-subtle" />
              </div>
              {f.cidade}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className=" rounded-xl px-3 py-2">
              <p className="text-[10px] font-black text-dim uppercase tracking-wider">Pagamento</p>
              <p className="text-sm font-black text-fg">{f.forma_pagamento}</p>
            </div>
            <div className=" rounded-xl px-3 py-2">
              <p className="text-[10px] font-black text-dim uppercase tracking-wider">Pedido Mín.</p>
              <p className="text-sm font-black text-fg">{fmtBRL(f.pedido_minimo)}</p>
            </div>
            <div className=" rounded-xl px-3 py-2 col-span-2">
              <p className="text-[10px] font-black text-dim uppercase tracking-wider">Última Compra</p>
              <p className="text-sm font-black text-fg">{fmtData(f.ultima_compra)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center border-t border-neutral-50 divide-x divide-neutral-50">
        <button onClick={() => onEditar(f)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-muted active: transition-colors">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onToggle(f.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black transition-colors active: ${f.ativo ? "text-subtle" : "text-emerald-600"}`}>
          {f.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          {f.ativo ? "Desativar" : "Ativar"}
        </button>
        <button onClick={() => onDeletar(f.id)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-accent active:bg-[rgba(5,150,105,0.1)] transition-colors">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </div>
  );
}

// ─── Formulário: Cadastrar / Editar Fornecedor ────────────────────────────────
function FormFornecedor({ inicial, onSalvar, onCancelar }) {
  const [nome,       setNome]       = useState(inicial?.nome            ?? "");
  const [segmento,   setSegmento]   = useState(inicial?.segmento        ?? "Outros");
  const [contato,    setContato]    = useState(inicial?.contato         ?? "");
  const [telefone,   setTelefone]   = useState(inicial?.telefone        ?? "");
  const [email,      setEmail]      = useState(inicial?.email           ?? "");
  const [cidade,     setCidade]     = useState(inicial?.cidade          ?? "");
  const [pagamento,  setPagamento]  = useState(inicial?.forma_pagamento ?? "À Vista");
  const [minimo,     setMinimo]     = useState(inicial?.pedido_minimo   ?? "");
  const [estrelas,   setEstrelas]   = useState(inicial?.estrelas        ?? 3);
  const [erro,       setErro]       = useState("");

  function handleSalvar() {
    if (!nome.trim()) { setErro("Informe o nome do fornecedor."); return; }
    setErro("");
    onSalvar({
      id:               inicial?.id ?? `f${Date.now()}`,
      nome:             nome.trim(),
      segmento,
      contato:          contato.trim(),
      telefone:         telefone.trim(),
      email:            email.trim(),
      cidade:           cidade.trim(),
      forma_pagamento:  pagamento,
      pedido_minimo:    parseFloat(minimo) || 0,
      estrelas,
      ultima_compra:    inicial?.ultima_compra ?? null,
      total_compras:    inicial?.total_compras ?? 0,
      ativo:            inicial?.ativo ?? true,
    });
  }

  return (
    <div className="bg-card rounded-2xl border border-white/5  p-5 space-y-4">
      <p className="text-sm font-black text-fg">{inicial ? "Editar Fornecedor" : "Novo Fornecedor"}</p>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Nome da Empresa *</label>
        <input type="text" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }}
          placeholder="ex: Frigorifico São Paulo"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg placeholder:text-dim placeholder:font-medium focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Segmento</label>
        <div className="relative">
          <select value={segmento} onChange={e => setSegmento(e.target.value)}
            className="w-full appearance-none  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-10" style={{ background: "#1E293B", color: "#F1F5F9" }} >
            {SEGMENTOS.filter(s => s !== "Todos").map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Contato</label>
          <input type="text" value={contato} onChange={e => setContato(e.target.value)}
            placeholder="Nome do vendedor"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Telefone</label>
          <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">E-mail</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="contato@fornecedor.com"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Cidade / Região</label>
        <input type="text" value={cidade} onChange={e => setCidade(e.target.value)}
          placeholder="ex: São Paulo, SP"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Forma de Pagamento</label>
          <div className="relative">
            <select value={pagamento} onChange={e => setPagamento(e.target.value)}
              className="w-full appearance-none  border border-white/8 rounded-xl px-3 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-8" style={{ background: "#1E293B", color: "#F1F5F9" }} >
              {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Pedido Mínimo (R$)</label>
          <input type="number" inputMode="decimal" step="10" min="0" value={minimo} onChange={e => setMinimo(e.target.value)}
            placeholder="0"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Avaliação</label>
        <Estrelas valor={estrelas} onChange={setEstrelas} />
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
          {inicial ? "Salvar Alterações" : "Cadastrar Fornecedor"}
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function FornecedoresPage() {
  const router = useRouter();

  const { unidadeAtiva } = useERP();
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFornecedores(unidadeAtiva).then(({ data }) => {
      setFornecedores(data);
      setLoading(false);
    });
  }, [unidadeAtiva]);
  const [busca,        setBusca]        = useState("");
  const [segFiltro,    setSegFiltro]    = useState("Todos");
  const [formAberto,   setFormAberto]   = useState(false);
  const [fEditar,      setFEditar]      = useState(null);
  const [salvou,       setSalvou]       = useState(false);

  // ── Métricas ──────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const ativos = fornecedores.filter(f => f.ativo).length;
    const total_compras = fornecedores.reduce((acc, f) => acc + (f.total_compras || 0), 0);
    const media_estrelas = fornecedores.length > 0
      ? fornecedores.reduce((acc, f) => acc + f.estrelas, 0) / fornecedores.length
      : 0;
    return { total: fornecedores.length, ativos, total_compras, media_estrelas };
  }, [fornecedores]);

  // ── Filtragem ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    return fornecedores.filter(f => {
      const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase()) ||
                         f.contato.toLowerCase().includes(busca.toLowerCase());
      const matchSeg   = segFiltro === "Todos" || f.segmento === segFiltro;
      return matchBusca && matchSeg;
    });
  }, [fornecedores, busca, segFiltro]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSalvar(f) {
    if (fEditar) {
      atualizarFornecedor(f.id, f);
      setFornecedores(prev => prev.map(x => x.id === f.id ? f : x));
    } else {
      const { data } = await inserirFornecedor(f, unidadeAtiva);
      setFornecedores(prev => [...prev, data ?? f]);
    }
    setFormAberto(false);
    setFEditar(null);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2500);
  }

  function handleEditar(f) {
    setFEditar(f);
    setFormAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleToggle(id) {
    setFornecedores(prev => prev.map(f => f.id === id ? { ...f, ativo: !f.ativo } : f));
  }

  function handleDeletar(id) {
    setFornecedores(prev => prev.filter(f => f.id !== id));
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
          <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Fornecedores</h1>
          <p className="text-[11px] text-dim font-medium">Contatos, pedidos e avaliações</p>
        </div>
        <button onClick={() => { setFEditar(null); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-accent text-white  active:scale-95 transition-all">
          <Plus size={14} /> Novo
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Toast */}
        {salvou && (
          <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-2xl px-4 py-3">
            <Check size={15} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-black text-emerald-800">Fornecedor salvo!</p>
          </div>
        )}

        {/* Formulário */}
        {formAberto && (
          <FormFornecedor
            inicial={fEditar}
            onSalvar={handleSalvar}
            onCancelar={() => { setFormAberto(false); setFEditar(null); }}
          />
        )}

        {/* ── Cards de Resumo ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-white/5  p-4">
            <div className="w-8 h-8 rounded-xl bg-elevated flex items-center justify-center mb-2">
              <Truck size={16} className="text-muted" />
            </div>
            <p className="text-2xl font-black text-fg">{resumo.ativos}</p>
            <p className="text-[11px] font-bold text-dim">Fornecedores ativos</p>
          </div>
          <div className="bg-card rounded-2xl border border-white/5  p-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
              <ShoppingCart size={16} className="text-emerald-600" />
            </div>
            <p className="text-xl font-black text-emerald-800">{fmtBRL(resumo.total_compras)}</p>
            <p className="text-[11px] font-bold text-dim">Total em compras</p>
          </div>
          <div className="bg-card rounded-2xl border border-white/5  p-4 col-span-2">
            <p className="text-[10px] font-black text-dim uppercase tracking-wider mb-1.5">Avaliação Média dos Fornecedores</p>
            <div className="flex items-center gap-3">
              <Estrelas valor={Math.round(resumo.media_estrelas)} />
              <p className="text-sm font-black text-fg-soft">{resumo.media_estrelas.toFixed(1)} de 5</p>
            </div>
          </div>
        </div>

        {/* ── Busca + Filtro ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar fornecedor ou contato..."
              className="w-full bg-card border border-white/8 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent " />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={15} className="text-dim" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SEGMENTOS.map(seg => (
              <button key={seg} onClick={() => setSegFiltro(seg)}
                className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${segFiltro === seg ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
                {seg}
              </button>
            ))}
          </div>
        </div>

        {/* ── Lista ─────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-dim uppercase tracking-wider">
              {segFiltro === "Todos" ? "Todos os Fornecedores" : segFiltro}
            </p>
            <p className="text-[11px] font-bold text-dim">{filtrados.length} fornecedor{filtrados.length !== 1 ? "es" : ""}</p>
          </div>

          {filtrados.length === 0 ? (
            <div className="bg-card rounded-2xl border border-white/5  p-8 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center mb-1">
                <Truck size={22} className="text-elevated" />
              </div>
              <p className="text-sm font-bold text-subtle">{busca ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}</p>
              <p className="text-xs text-dim font-medium">
                {busca ? `Sem resultados para "${busca}"` : "Clique em Novo para cadastrar o primeiro fornecedor."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrados.map(f => (
                <CardFornecedor key={f.id} f={f}
                  onEditar={handleEditar}
                  onToggle={handleToggle}
                  onDeletar={handleDeletar} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
