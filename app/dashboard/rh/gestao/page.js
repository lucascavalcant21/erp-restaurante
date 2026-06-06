"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Edit3, Search, X, Check,
  AlertCircle, ChevronDown, Users, DollarSign, UserCheck,
  UserX, Phone, Mail, Calendar, Briefcase, ToggleLeft, ToggleRight,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function anosDeEmpresa(iso) {
  if (!iso) return null;
  const diff = (new Date() - new Date(iso)) / (1000 * 60 * 60 * 24 * 365.25);
  if (diff < 1) return `${Math.floor(diff * 12)}m`;
  return `${Math.floor(diff)}a`;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const CARGOS = ["Gerente", "Cozinheiro", "Auxiliar de Cozinha", "Atendente", "Caixa", "Entregador", "Limpeza", "Estoquista", "Assistente Administrativo"];
const UNIDADES = ["Seldeestrela", "Tico Tico Saladas", "Burguer"];
const TURNOS = ["Manhã (06-14h)", "Tarde (14-22h)", "Noite (22-06h)", "Integral (08-18h)", "Folguista"];

// ─── Seed de funcionários ────────────────────────────────────────────────────
const FUNCIONARIOS_SEED = [
  { id: "f1", nome: "Ana Torres",      cargo: "Gerente",            unidade: "Seldeestrela",    turno: "Integral (08-18h)", salario: 3200, admissao: "2022-03-15", telefone: "(11) 99111-2233", email: "ana@seldeestrela.com",  ativo: true  },
  { id: "f2", nome: "João Santos",     cargo: "Cozinheiro",         unidade: "Seldeestrela",    turno: "Manhã (06-14h)",    salario: 2100, admissao: "2023-06-01", telefone: "(11) 99222-3344", email: "",                       ativo: true  },
  { id: "f3", nome: "Maria Lima",      cargo: "Atendente",          unidade: "Tico Tico Saladas",turno: "Tarde (14-22h)",    salario: 1600, admissao: "2024-01-10", telefone: "(11) 99333-4455", email: "",                       ativo: true  },
  { id: "f4", nome: "Carlos Pereira",  cargo: "Auxiliar de Cozinha",unidade: "Burguer",         turno: "Noite (22-06h)",    salario: 1500, admissao: "2023-09-20", telefone: "(11) 99444-5566", email: "",                       ativo: true  },
  { id: "f5", nome: "Fernanda Costa",  cargo: "Caixa",              unidade: "Seldeestrela",    turno: "Tarde (14-22h)",    salario: 1700, admissao: "2024-03-05", telefone: "(11) 99555-6677", email: "",                       ativo: true  },
  { id: "f6", nome: "Roberto Alves",   cargo: "Entregador",         unidade: "Burguer",         turno: "Tarde (14-22h)",    salario: 1450, admissao: "2023-11-15", telefone: "(11) 99666-7788", email: "",                       ativo: false },
];

// ─── Formulário ───────────────────────────────────────────────────────────────
function FormFuncionario({ inicial, onSalvar, onCancelar }) {
  const [nome,     setNome]     = useState(inicial?.nome     ?? "");
  const [cargo,    setCargo]    = useState(inicial?.cargo    ?? "Atendente");
  const [unidade,  setUnidade]  = useState(inicial?.unidade  ?? "Seldeestrela");
  const [turno,    setTurno]    = useState(inicial?.turno    ?? "Manhã (06-14h)");
  const [salario,  setSalario]  = useState(inicial?.salario  ?? "");
  const [admissao, setAdmissao] = useState(inicial?.admissao ?? "");
  const [telefone, setTelefone] = useState(inicial?.telefone ?? "");
  const [email,    setEmail]    = useState(inicial?.email    ?? "");
  const [erro,     setErro]     = useState("");

  function handleSalvar() {
    if (!nome.trim())    { setErro("Informe o nome."); return; }
    if (!admissao)       { setErro("Informe a data de admissão."); return; }
    if (!salario || parseFloat(salario) <= 0) { setErro("Informe o salário."); return; }
    setErro("");
    onSalvar({
      id:       inicial?.id ?? `f${Date.now()}`,
      nome:     nome.trim(),
      cargo, unidade, turno,
      salario:  parseFloat(salario),
      admissao, telefone: telefone.trim(), email: email.trim(),
      ativo:    inicial?.ativo ?? true,
    });
  }

  const sel = "w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981] pr-8";

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <p className="text-sm font-black text-neutral-900">{inicial ? "Editar Funcionário" : "Novo Funcionário"}</p>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Nome Completo *</label>
        <input type="text" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }}
          placeholder="ex: Ana Torres"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 placeholder:text-neutral-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:border-[#10b981]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Cargo</label>
          <div className="relative"><select value={cargo} onChange={e => setCargo(e.target.value)} className={sel}>
            {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select><ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" /></div>
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Unidade</label>
          <div className="relative"><select value={unidade} onChange={e => setUnidade(e.target.value)} className={sel}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select><ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Turno</label>
          <div className="relative"><select value={turno} onChange={e => setTurno(e.target.value)} className={sel}>
            {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select><ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" /></div>
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Salário (R$)</label>
          <input type="number" inputMode="decimal" step="50" min="0" value={salario} onChange={e => { setSalario(e.target.value); setErro(""); }}
            placeholder="0"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-black text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Data de Admissão *</label>
        <input type="date" value={admissao} onChange={e => { setAdmissao(e.target.value); setErro(""); }}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">Telefone</label>
          <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
        </div>
        <div>
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1.5">E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981]" />
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
          {inicial ? "Salvar" : "Cadastrar"}
        </button>
      </div>
    </div>
  );
}

// ─── Card funcionário ─────────────────────────────────────────────────────────
function CardFuncionario({ f, onEditar, onToggle, onDeletar }) {
  const [expandido, setExpandido] = useState(false);
  const tempo = anosDeEmpresa(f.admissao);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${!f.ativo ? "opacity-60 border-neutral-200" : "border-neutral-100"}`}>
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setExpandido(e => !e)}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-black flex-shrink-0 ${f.ativo ? "bg-[#10b981]/10 text-[#10b981]" : "bg-neutral-100 text-neutral-400"}`}>
            {f.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-black text-neutral-900 truncate">{f.nome}</p>
              {!f.ativo && <span className="text-[9px] font-black bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full uppercase flex-shrink-0">Inativo</span>}
            </div>
            <p className="text-[11px] text-neutral-500 font-medium truncate">{f.cargo} · {f.unidade}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-black text-neutral-900">{fmtBRL(f.salario)}</p>
            <p className="text-[10px] text-neutral-400 font-medium">{tempo} de casa</p>
          </div>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-2 border-t border-neutral-50 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-neutral-50 rounded-xl px-3 py-2">
              <p className="text-[9px] font-black text-neutral-400 uppercase">Turno</p>
              <p className="text-xs font-bold text-neutral-800">{f.turno}</p>
            </div>
            <div className="bg-neutral-50 rounded-xl px-3 py-2">
              <p className="text-[9px] font-black text-neutral-400 uppercase">Admissão</p>
              <p className="text-xs font-bold text-neutral-800">{fmtData(f.admissao)}</p>
            </div>
          </div>
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
        </div>
      )}

      <div className="flex items-center border-t border-neutral-50 divide-x divide-neutral-50">
        <button onClick={() => onEditar(f)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-neutral-600 active:bg-neutral-50 transition-colors">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onToggle(f.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black transition-colors active:bg-neutral-50 ${f.ativo ? "text-neutral-500" : "text-emerald-600"}`}>
          {f.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          {f.ativo ? "Desativar" : "Reativar"}
        </button>
        <button onClick={() => onDeletar(f.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-rose-400 active:bg-rose-50 transition-colors">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function GestaoRHPage() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState(FUNCIONARIOS_SEED);
  const [busca,        setBusca]        = useState("");
  const [filtroUnid,   setFiltroUnid]   = useState("Todos");
  const [formAberto,   setFormAberto]   = useState(false);
  const [fEditar,      setFEditar]      = useState(null);
  const [salvou,       setSalvou]       = useState(false);

  const resumo = useMemo(() => {
    const ativos   = funcionarios.filter(f => f.ativo);
    const folha    = ativos.reduce((a, f) => a + f.salario, 0);
    const inativos = funcionarios.filter(f => !f.ativo).length;
    return { ativos: ativos.length, inativos, folha };
  }, [funcionarios]);

  const filtrados = useMemo(() => {
    return funcionarios.filter(f => {
      const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase()) ||
                         f.cargo.toLowerCase().includes(busca.toLowerCase());
      const matchUnid  = filtroUnid === "Todos" || f.unidade === filtroUnid;
      return matchBusca && matchUnid;
    });
  }, [funcionarios, busca, filtroUnid]);

  function handleSalvar(f) {
    if (fEditar) setFuncionarios(prev => prev.map(x => x.id === f.id ? f : x));
    else         setFuncionarios(prev => [...prev, f]);
    setFormAberto(false); setFEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2500);
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5]">
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-neutral-900 leading-tight">Gestão de RH</h1>
          <p className="text-[11px] text-neutral-400 font-medium">Equipe, cargos e folha de pagamento</p>
        </div>
        <button onClick={() => { setFEditar(null); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-[#10b981] text-white shadow-md active:scale-95 transition-all">
          <Plus size={14} /> Novo
        </button>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">
        {salvou && (
          <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-2xl px-4 py-3">
            <Check size={15} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-black text-emerald-800">Funcionário salvo!</p>
          </div>
        )}
        {formAberto && (
          <FormFuncionario inicial={fEditar} onSalvar={handleSalvar}
            onCancelar={() => { setFormAberto(false); setFEditar(null); }} />
        )}

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center mb-1.5">
              <UserCheck size={14} className="text-emerald-600" />
            </div>
            <p className="text-xl font-black text-neutral-900">{resumo.ativos}</p>
            <p className="text-[10px] font-bold text-neutral-400">Ativos</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center mb-1.5">
              <UserX size={14} className="text-neutral-400" />
            </div>
            <p className="text-xl font-black text-neutral-900">{resumo.inativos}</p>
            <p className="text-[10px] font-bold text-neutral-400">Inativos</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center mb-1.5">
              <DollarSign size={14} className="text-blue-600" />
            </div>
            <p className="text-base font-black text-neutral-900 leading-tight">{fmtBRL(resumo.folha)}</p>
            <p className="text-[10px] font-bold text-neutral-400">Folha/mês</p>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou cargo..."
            className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-[#10b981] shadow-sm" />
          {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-neutral-400" /></button>}
        </div>

        {/* Filtro unidade */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["Todos", ...UNIDADES].map(u => (
            <button key={u} onClick={() => setFiltroUnid(u)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtroUnid === u ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {u}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div>
          <div className="flex justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">Equipe</p>
            <p className="text-[11px] font-bold text-neutral-400">{filtrados.length} funcionário{filtrados.length !== 1 ? "s" : ""}</p>
          </div>
          {filtrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex flex-col items-center text-center gap-2">
              <Users size={28} className="text-neutral-200 mb-1" />
              <p className="text-sm font-bold text-neutral-500">Nenhum funcionário encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrados.map(f => (
                <CardFuncionario key={f.id} f={f}
                  onEditar={f => { setFEditar(f); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  onToggle={id => setFuncionarios(prev => prev.map(x => x.id === id ? { ...x, ativo: !x.ativo } : x))}
                  onDeletar={id => setFuncionarios(prev => prev.filter(x => x.id !== id))} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
