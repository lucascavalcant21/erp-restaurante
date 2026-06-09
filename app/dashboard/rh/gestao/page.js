"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchFuncionarios, inserirFuncionario, atualizarFuncionario, removerFuncionario } from "../../../lib/rh";
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
const FUNCIONARIOS_SEED = [];

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

  const sel = "w-full appearance-none  border border-white/8 rounded-xl px-3 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent pr-8";

  return (
    <div className="bg-card rounded-2xl border border-white/5  p-5 space-y-4">
      <p className="text-sm font-black text-fg">{inicial ? "Editar Funcionário" : "Novo Funcionário"}</p>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Nome Completo *</label>
        <input type="text" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }}
          placeholder="ex: Ana Torres"
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg placeholder:text-dim placeholder:font-medium focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Cargo</label>
          <div className="relative"><select value={cargo} onChange={e => setCargo(e.target.value)} className={sel}>
            {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select><ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" /></div>
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Unidade</label>
          <div className="relative"><select value={unidade} onChange={e => setUnidade(e.target.value)} className={sel}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select><ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Turno</label>
          <div className="relative"><select value={turno} onChange={e => setTurno(e.target.value)} className={sel}>
            {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select><ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" /></div>
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Salário (R$)</label>
          <input type="number" inputMode="decimal" step="50" min="0" value={salario} onChange={e => { setSalario(e.target.value); setErro(""); }}
            placeholder="0"
            className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-black text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Data de Admissão *</label>
        <input type="date" value={admissao} onChange={e => { setAdmissao(e.target.value); setErro(""); }}
          className="w-full  border border-white/8 rounded-xl px-4 py-3.5 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:border-accent" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">Telefone</label>
          <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full  border border-white/8 rounded-xl px-4 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
        <div>
          <label className="text-[10px] font-black text-dim uppercase tracking-wider block mb-1.5">E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full  border border-white/8 rounded-xl px-4 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent" />
        </div>
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
    <div className={`bg-card rounded-2xl border  overflow-hidden ${!f.ativo ? "opacity-60 border-white/8" : "border-white/5"}`}>
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setExpandido(e => !e)}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-black flex-shrink-0 ${f.ativo ? "bg-accent/10 text-accent" : "bg-elevated text-dim"}`}>
            {f.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-black text-fg truncate">{f.nome}</p>
              {!f.ativo && <span className="text-[9px] font-black bg-elevated text-subtle px-1.5 py-0.5 rounded-full uppercase flex-shrink-0">Inativo</span>}
            </div>
            <p className="text-[11px] text-subtle font-medium truncate">{f.cargo} · {f.unidade}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-black text-fg">{fmtBRL(f.salario)}</p>
            <p className="text-[10px] text-dim font-medium">{tempo} de casa</p>
          </div>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-2 border-t border-neutral-50 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className=" rounded-xl px-3 py-2">
              <p className="text-[9px] font-black text-dim uppercase">Turno</p>
              <p className="text-xs font-bold text-fg">{f.turno}</p>
            </div>
            <div className=" rounded-xl px-3 py-2">
              <p className="text-[9px] font-black text-dim uppercase">Admissão</p>
              <p className="text-xs font-bold text-fg">{fmtData(f.admissao)}</p>
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
        <button onClick={() => onEditar(f)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-muted active: transition-colors">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onToggle(f.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black transition-colors active: ${f.ativo ? "text-subtle" : "text-emerald-600"}`}>
          {f.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          {f.ativo ? "Desativar" : "Reativar"}
        </button>
        <button onClick={() => onDeletar(f.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-accent active:bg-[rgba(5,150,105,0.1)] transition-colors">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function GestaoRHPage() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca,        setBusca]        = useState("");
  const [filtroUnid,   setFiltroUnid]   = useState("Todos");
  const [formAberto,   setFormAberto]   = useState(false);
  const [fEditar,      setFEditar]      = useState(null);
  const [salvou,       setSalvou]       = useState(false);

  useEffect(() => {
    fetchFuncionarios().then(({ data }) => {
      setFuncionarios(data);
      setLoading(false);
    });
  }, []);

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

  async function handleSalvar(f) {
    if (fEditar) {
      atualizarFuncionario(f.id, f);
      setFuncionarios(prev => prev.map(x => x.id === f.id ? f : x));
    } else {
      const { data } = await inserirFuncionario(f);
      setFuncionarios(prev => [...prev, data ?? f]);
    }
    setFormAberto(false); setFEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2500);
  }

  return (
    <div className="min-h-screen ">
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3 flex items-center gap-3" style={{ background: 'var(--surface)' }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Gestão de RH</h1>
          <p className="text-[11px] text-dim font-medium">Equipe, cargos e folha de pagamento</p>
        </div>
        <button onClick={() => { setFEditar(null); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl bg-accent text-white  active:scale-95 transition-all">
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
          <div className="bg-card rounded-2xl border border-white/5  p-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center mb-1.5">
              <UserCheck size={14} className="text-emerald-600" />
            </div>
            <p className="text-xl font-black text-fg">{resumo.ativos}</p>
            <p className="text-[10px] font-bold text-dim">Ativos</p>
          </div>
          <div className="bg-card rounded-2xl border border-white/5  p-3">
            <div className="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center mb-1.5">
              <UserX size={14} className="text-dim" />
            </div>
            <p className="text-xl font-black text-fg">{resumo.inativos}</p>
            <p className="text-[10px] font-bold text-dim">Inativos</p>
          </div>
          <div className="bg-card rounded-2xl border border-white/5  p-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center mb-1.5">
              <DollarSign size={14} className="text-blue-600" />
            </div>
            <p className="text-base font-black leading-tight text-fg">{fmtBRL(resumo.folha)}</p>
            <p className="text-[10px] font-bold text-dim">Folha/mês</p>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou cargo..."
            className="w-full bg-card border border-white/8 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:border-accent " />
          {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={15} className="text-dim" /></button>}
        </div>

        {/* Filtro unidade */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["Todos", ...UNIDADES].map(u => (
            <button key={u} onClick={() => setFiltroUnid(u)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtroUnid === u ? "bg-accent-strong text-white" : "bg-card text-muted border border-white/8"}`}>
              {u}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div>
          <div className="flex justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-dim uppercase tracking-wider">Equipe</p>
            <p className="text-[11px] font-bold text-dim">{filtrados.length} funcionário{filtrados.length !== 1 ? "s" : ""}</p>
          </div>
          {filtrados.length === 0 ? (
            <div className="bg-card rounded-2xl border border-white/5  p-8 flex flex-col items-center text-center gap-2">
              <Users size={28} className="text-neutral-200 mb-1" />
              <p className="text-sm font-bold text-subtle">Nenhum funcionário encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrados.map(f => (
                <CardFuncionario key={f.id} f={f}
                  onEditar={f => { setFEditar(f); setFormAberto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  onToggle={id => { atualizarFuncionario(id, { ativo: !funcionarios.find(x=>x.id===id)?.ativo }); setFuncionarios(prev => prev.map(x => x.id === id ? { ...x, ativo: !x.ativo } : x)); }}
                  onDeletar={id => { removerFuncionario(id); setFuncionarios(prev => prev.filter(x => x.id !== id)); }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
