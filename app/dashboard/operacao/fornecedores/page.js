"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
const FORNECEDORES_SEED = [
  {
    id: "f1",
    nome: "Frigorifico São Paulo",
    segmento: "Carnes",
    contato: "João Silva",
    telefone: "(11) 98765-4321",
    email: "joao@frigorificosaopaulo.com.br",
    cidade: "São Paulo, SP",
    forma_pagamento: "Boleto 7d",
    pedido_minimo: 200,
    ultima_compra: "2026-05-28",
    total_compras: 4800,
    ativo: true,
    estrelas: 5,
  },
  {
    id: "f2",
    nome: "Distribuidora GrãoVerde",
    segmento: "Grãos e Cereais",
    contato: "Maria Souza",
    telefone: "(11) 91234-5678",
    email: "compras@graoverde.com",
    cidade: "Campinas, SP",
    forma_pagamento: "Boleto 15d",
    pedido_minimo: 150,
    ultima_compra: "2026-05-30",
    total_compras: 3200,
    ativo: true,
    estrelas: 4,
  },
  {
    id: "f3",
    nome: "Embal Express",
    segmento: "Embalagens",
    contato: "Carlos Lima",
    telefone: "(11) 94444-3333",
    email: "vendas@embalexpress.com",
    cidade: "Santo André, SP",
    forma_pagamento: "À Vista",
    pedido_minimo: 100,
    ultima_compra: "2026-06-01",
    total_compras: 1500,
    ativo: true,
    estrelas: 4,
  },
  {
    id: "f4",
    nome: "Verdurão do Bairro",
    segmento: "Hortifruti",
    contato: "Ana Torres",
    telefone: "(11) 99876-5432",
    email: "",
    cidade: "Local",
    forma_pagamento: "Pix",
    pedido_minimo: 50,
    ultima_compra: "2026-06-02",
    total_compras: 980,
    ativo: false,
    estrelas: 3,
  },
];

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
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${!f.ativo ? "opacity-60 border-neutral-200" : "border-neutral-100"}`}>
      {/* Cabeçalho */}
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setExpandido(e => !e)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">{f.segmento}</span>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${f.ativo ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                {f.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="text-base font-black text-neutral-900 truncate">{f.nome}</p>
            <Estrelas valor={f.estrelas} />
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-black text-neutral-900">{fmtBRL(f.total_compras)}</p>
            <p className="text-[11px] text-neutral-400 font-medium">total comprado</p>
          </div>
        </div>
      </button>

      {/* Detalhes expansíveis */}
      {expandido && (
        <div className="px-4 pb-4 space-y-2 border-t border-neutral-50 pt-3">
          {f.contato && (
            <div className="flex items-center gap-2 text-sm text-neutral-700 font-medium">
              <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <Truck size={13} className="text-neutral-500" />
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
            <div className="flex items-center gap-2 text-sm text-neutral-700 font-medium">
              <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <MapPin size={13} className="text-neutral-500" />
              </div>
              {f.cidade}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-neutral-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Pagamento</p>
              <p className="text-sm font-black text-neutral-900">{f.forma_pagamento}</p>
            </div>
            <div className="bg-neutral-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Pedido Mín.</p>
              <p className="text-sm font-black text-neutral-900">{fmtBRL(f.pedido_minimo)}</p>
            </div>
            <div className="bg-neutral-50 rounded-xl px-3 py-2 col-span-2">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Última Compra</p>
              <p className="text-sm font-black text-neutral-900">{fmtData(f.ultima_compra)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center border-t border-neutral-50 divide-x divide-neutral-50">
        <button onClick={() => onEditar(f)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-neutral-600 active:bg-neutral-50 transition-colors">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onToggle(f.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black transition-colors active:bg-neutral-50 ${f.ativo ? "text-neutral-500" : "text-emerald-600"}`}>
          {f.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          {f.ativo ? "Desativar" : "Ativar"}
        </button>
        <button onClick={() => onDeletar(f.id)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-rose-400 active:bg-rose-50 transition-colors">
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
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <p className="text-sm font-black text-neutral-900">{inicial ? "Editar Fornecedor" : "Novo Fornecedor"}</p>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Nome da Empresa *</label>
        <input type="text" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }}
          placeholder="ex: Frigorifico São Paulo"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 placeholder:text-neutral-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:border-[#10b981]" />
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Segmento</label>
        <div className="relative">
          <select value={segmento} onChange={e => setSegmento(e.target.value)}
            className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] pr-10">
            {SEGMENTOS.filter(s => s !== "Todos").map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Contato</label>
          <input type="text" value={contato} onChange={e => setContato(e.target.value)}
            placeholder="Nome do vendedor"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Telefone</label>
          <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">E-mail</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="contato@fornecedor.com"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Cidade / Região</label>
        <input type="text" value={cidade} onChange={e => setCidade(e.target.value)}
          placeholder="ex: São Paulo, SP"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Forma de Pagamento</label>
          <div className="relative">
            <select value={pagamento} onChange={e => setPagamento(e.target.value)}
              className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] pr-8">
              {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Pedido Mínimo (R$)</label>
          <input type="number" inputMode="decimal" step="10" min="0" value={minimo} onChange={e => setMinimo(e.target.value)}
            placeholder="0"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-black text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Avaliação</label>
        <Estrelas valor={estrelas} onChange={setEstrelas} />
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
          {inicial ? "Salvar Alterações" : "Cadastrar Fornecedor"}
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function FornecedoresPage() {
  const router = useRouter();

  const [fornecedores, setFornecedores] = useState(FORNECEDORES_SEED);
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
  function handleSalvar(f) {
    if (fEditar) {
      setFornecedores(prev => prev.map(x => x.id === f.id ? f : x));
    } else {
      setFornecedores(prev => [...prev, f]);
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
    <div className="min-h-screen bg-[#fbf9f5]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Fornecedores</h1>
          <p className="text-[11px] text-neutral-400 font-medium">Contatos, pedidos e avaliações</p>
        </div>
        <button onClick={() => { setFEditar(null); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-[#10b981] text-white shadow-md active:scale-95 transition-all">
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
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center mb-2">
              <Truck size={16} className="text-neutral-600" />
            </div>
            <p className="text-2xl font-black text-neutral-900">{resumo.ativos}</p>
            <p className="text-[11px] font-bold text-neutral-400">Fornecedores ativos</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
              <ShoppingCart size={16} className="text-emerald-600" />
            </div>
            <p className="text-xl font-black text-emerald-800">{fmtBRL(resumo.total_compras)}</p>
            <p className="text-[11px] font-bold text-neutral-400">Total em compras</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 col-span-2">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-1.5">Avaliação Média dos Fornecedores</p>
            <div className="flex items-center gap-3">
              <Estrelas valor={Math.round(resumo.media_estrelas)} />
              <p className="text-sm font-black text-neutral-700">{resumo.media_estrelas.toFixed(1)} de 5</p>
            </div>
          </div>
        </div>

        {/* ── Busca + Filtro ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar fornecedor ou contato..."
              className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] shadow-sm" />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={15} className="text-neutral-400" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SEGMENTOS.map(seg => (
              <button key={seg} onClick={() => setSegFiltro(seg)}
                className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${segFiltro === seg ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
                {seg}
              </button>
            ))}
          </div>
        </div>

        {/* ── Lista ─────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
              {segFiltro === "Todos" ? "Todos os Fornecedores" : segFiltro}
            </p>
            <p className="text-[11px] font-bold text-neutral-400">{filtrados.length} fornecedor{filtrados.length !== 1 ? "es" : ""}</p>
          </div>

          {filtrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-1">
                <Truck size={22} className="text-neutral-300" />
              </div>
              <p className="text-sm font-bold text-neutral-500">{busca ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}</p>
              <p className="text-xs text-neutral-400 font-medium">
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
