"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban, CheckCircle2, Copy, Eye, History, KeyRound, Loader2, Lock,
  Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, X,
} from "lucide-react";
import PermissionBuilder from "../../../components/access-control/PermissionBuilder";
import { accessCommand, avatarInitials, fetchAccessBootstrap, formatLastAccess } from "../../../lib/access-control";
import { allPermissionKeys, permissionMatches } from "../../../lib/permissions-catalog";

const EMPTY = {
  nome: "", funcionario_id: "", avatar_url: "", email: "", telefone: "", login: "",
  password: "", confirmPassword: "", setor_principal_id: "", cargo: "",
  unidade_principal_id: "", status: "ativo", tipo_acesso: "funcionario", perfil_id: "",
  pagina_inicial: "/dashboard", exigir_troca_senha: true,
  allowed_days: [0,1,2,3,4,5,6], allowed_start_time: "", allowed_end_time: "",
  max_failed_attempts: 5, valid_from: "", valid_until: "",
  encerrar_sessoes_anteriores: false, allowed_device_ids: [], acesso_externo: true,
  allowed_ips: [],
};
const TYPES = [
  ["administrador","Administrador"],["gerente","Gerente"],["supervisor","Supervisor"],
  ["funcionario","Funcionário"],["personalizado","Usuário personalizado"],["setor","Usuário de setor"],
  ["consulta","Somente consulta"],["terminal_ponto","Terminal de ponto"],
];
const DAYS = [["0","D"],["1","S"],["2","T"],["3","Q"],["4","Q"],["5","S"],["6","S"]];
const INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500";
const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-[.14em] text-slate-400";

function Modal({ title, subtitle, onClose, wide = false, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 py-8 backdrop-blur-sm">
      <div className={`w-full ${wide ? "max-w-6xl" : "max-w-3xl"} overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-lg font-black text-slate-800">{title}</h2>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19}/></button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Status({ value }) {
  const styles = { ativo: "bg-emerald-50 text-emerald-700", bloqueado: "bg-amber-50 text-amber-700", desativado: "bg-slate-100 text-slate-500" };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${styles[value] || styles.desativado}`}>{value}</span>;
}

export default function UsuariosAcessosPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ text: "", profile: "", sector: "", unit: "", status: "", last: "" });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [permissionValue, setPermissionValue] = useState([]);

  const load = async () => {
    setLoading(true); setError("");
    try { setData(await fetchAccessBootstrap()); } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const profiles = (data?.profiles || []).filter((profile) => profile.ativo && profile.is_current);
  const profileName = (id) => (data?.profiles || []).find((profile) => profile.id === id)?.nome || "Sem perfil";
  const unitName = (id) => data?.units.find((unit) => unit.id === id)?.nome || "Todas";
  const sectorName = (id) => data?.sectors.find((sector) => sector.id === id)?.nome || "—";
  const users = useMemo(() => (data?.users || []).filter((user) => {
    const text = filters.text.toLowerCase();
    if (text && !`${user.nome} ${user.login} ${user.email || ""}`.toLowerCase().includes(text)) return false;
    if (filters.profile && user.perfil_id !== filters.profile) return false;
    if (filters.sector && user.setor_principal_id !== filters.sector) return false;
    if (filters.unit && user.unidade_principal_id !== filters.unit) return false;
    if (filters.status && user.status !== filters.status) return false;
    if (filters.last === "never" && user.ultimo_acesso_em) return false;
    if (filters.last === "7d" && (!user.ultimo_acesso_em || Date.now() - new Date(user.ultimo_acesso_em) > 7 * 86400000)) return false;
    return true;
  }), [data, filters]);

  const scopeFor = (id) => data?.scopes.find((scope) => scope.usuario_id === id) || {};
  const openForm = (user = null, duplicate = false) => {
    const scope = user ? scopeFor(user.id) : {};
    setForm(user ? {
      ...EMPTY, ...user, id: duplicate ? null : user.id, auth_user_id: duplicate ? null : user.auth_user_id,
      source_user_id: duplicate ? user.id : null,
      nome: duplicate ? `${user.nome} (cópia)` : user.nome,
      login: duplicate ? `${user.login}.copia` : user.login,
      password: "", confirmPassword: "",
      allowed_start_time: user.allowed_start_time?.slice(0,5) || "",
      allowed_end_time: user.allowed_end_time?.slice(0,5) || "",
      valid_from: user.valid_from?.slice(0,16) || "", valid_until: user.valid_until?.slice(0,16) || "",
      scope_empresa_id: scope.empresa_id || "", scope_data: scope.data_scope || "setor",
      allowed_device_ids_text: (user.allowed_device_ids || []).join(", "),
      allowed_ips_text: (user.allowed_ips || []).join(", "),
    } : { ...EMPTY, scope_empresa_id: data?.companies?.[0]?.id || "", scope_data: "setor", allowed_device_ids_text: "", allowed_ips_text: "" });
    setModal("form");
  };

  const submitUser = async () => {
    if (!form.nome.trim() || !form.login.trim()) return setError("Nome e login são obrigatórios.");
    if (!form.id && (form.password.length < 8 || form.password !== form.confirmPassword)) return setError("Informe senhas iguais, com ao menos 8 caracteres.");
    setSaving(true); setError("");
    try {
      const user = {
        ...form,
        allowed_device_ids: form.allowed_device_ids_text.split(",").map((item) => item.trim()).filter(Boolean),
        allowed_ips: form.allowed_ips_text.split(",").map((item) => item.trim()).filter(Boolean),
      };
      const scopes = [{
        empresa_id: form.scope_empresa_id || null, unidade_id: form.unidade_principal_id || null,
        setor_id: form.setor_principal_id || null, data_scope: form.scope_data || "setor",
      }];
      const sourceRows = form.source_user_id ? data.userPermissions.filter((item) => item.usuario_id === form.source_user_id) : [];
      await accessCommand(form.id ? "update-user" : "create-user", {
        id: form.id, user, scopes,
        allowPermissions: sourceRows.filter((item) => item.effect === "allow").map((item) => item.permission_key),
        denyPermissions: sourceRows.filter((item) => item.effect === "deny").map((item) => item.permission_key),
      });
      setModal(null); setNotice(form.id ? "Usuário atualizado." : "Usuário criado com senha temporária."); await load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const expand = (keys = []) => new Set(allPermissionKeys().filter((wanted) => keys.some((granted) => permissionMatches(granted, wanted))));
  const openPermissions = (user) => {
    const profile = (data?.profiles || []).find((item) => item.id === user.perfil_id);
    const inherited = expand(profile?.permissions || []);
    const rows = data.userPermissions.filter((item) => item.usuario_id === user.id);
    rows.filter((item) => item.effect === "allow").forEach((item) => expand([item.permission_key]).forEach((key) => inherited.add(key)));
    rows.filter((item) => item.effect === "deny").forEach((item) => expand([item.permission_key]).forEach((key) => inherited.delete(key)));
    setForm(user); setPermissionValue([...inherited]); setModal("permissions");
  };
  const savePermissions = async () => {
    setSaving(true);
    try {
      const profile = (data?.profiles || []).find((item) => item.id === form.perfil_id);
      const inherited = expand(profile?.permissions || []);
      const selected = new Set(permissionValue);
      const allowPermissions = [...selected].filter((key) => !inherited.has(key));
      const denyPermissions = [...inherited].filter((key) => !selected.has(key));
      await accessCommand("save-user-permissions", { id: form.id, allowPermissions, denyPermissions });
      setModal(null); setNotice("Permissões individuais atualizadas."); await load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const status = async (user, value) => {
    if (!confirm(`${value === "ativo" ? "Liberar" : value === "bloqueado" ? "Bloquear" : "Desativar"} ${user.nome}?`)) return;
    try { await accessCommand("set-user-status", { id: user.id, status: value }); await load(); } catch (e) { setError(e.message); }
  };
  const remove = async (user) => {
    if (!confirm(`Excluir definitivamente o usuário ${user.nome}? Esta ação encerra o login dele.`)) return;
    try { await accessCommand("delete-user", { id: user.id }); setNotice("Usuário excluído."); await load(); } catch (e) { setError(e.message); }
  };
  const resetPassword = async () => {
    if (form.password.length < 8 || form.password !== form.confirmPassword) return setError("Informe senhas iguais, com ao menos 8 caracteres.");
    setSaving(true);
    try { await accessCommand("reset-password", { id: form.id, password: form.password, requireChange: true }); setModal(null); setNotice("Senha redefinida; a troca será exigida no próximo acesso."); }
    catch (e) { setError(e.message); }
    setSaving(false);
  };
  const migrate = async () => {
    if (!confirm("Migrar todos os acessos antigos para o login seguro? As senhas em texto puro serão removidas após cada migração bem-sucedida.")) return;
    setSaving(true);
    try { const result = await accessCommand("migrate-legacy"); setNotice(`${result.migrated} de ${result.total} acessos antigos migrados.`); await load(); }
    catch (e) { setError(e.message); }
    setSaving(false);
  };

  if (loading && !data) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-emerald-600"/></div>;

  return (
    <div className="mx-auto w-full max-w-[95rem] p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white"><ShieldCheck size={23}/></div>
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">Configurações</p><h1 className="text-2xl font-black text-slate-800">Usuários e acessos</h1><p className="text-sm text-slate-500">Login, escopos, segurança e permissões individuais.</p></div>
        </div>
        <button onClick={() => openForm()} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200"><Plus size={17}/> Novo usuário</button>
      </header>

      {error && <div className="mb-4 flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}<button onClick={() => setError("")}><X size={16}/></button></div>}
      {notice && <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}<button onClick={() => setNotice("")}><X size={16}/></button></div>}
      {!!data?.legacyCount && <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-amber-900">{data.legacyCount} acessos antigos precisam ser protegidos</p><p className="text-sm text-amber-700">Migre-os para o Supabase Auth e remova as senhas em texto puro.</p></div><button disabled={saving} onClick={migrate} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white">Migrar agora</button></div>}

      <div className="mb-5 grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 xl:grid-cols-7">
        <label className="relative xl:col-span-2"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={filters.text} onChange={(e) => setFilters({...filters,text:e.target.value})} placeholder="Nome ou login" className={INPUT+" pl-9"}/></label>
        <select value={filters.profile} onChange={(e) => setFilters({...filters,profile:e.target.value})} className={INPUT}><option value="">Todos os perfis</option>{profiles.map((p)=><option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        <select value={filters.sector} onChange={(e) => setFilters({...filters,sector:e.target.value})} className={INPUT}><option value="">Todos os setores</option>{data?.sectors.map((s)=><option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        <select value={filters.unit} onChange={(e) => setFilters({...filters,unit:e.target.value})} className={INPUT}><option value="">Todas as unidades</option>{data?.units.map((u)=><option key={u.id} value={u.id}>{u.nome}</option>)}</select>
        <select value={filters.status} onChange={(e) => setFilters({...filters,status:e.target.value})} className={INPUT}><option value="">Todos os status</option><option value="ativo">Ativo</option><option value="bloqueado">Bloqueado</option><option value="desativado">Desativado</option></select>
        <select value={filters.last} onChange={(e) => setFilters({...filters,last:e.target.value})} className={INPUT}><option value="">Qualquer acesso</option><option value="7d">Últimos 7 dias</option><option value="never">Nunca acessou</option></select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[82rem] text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[.12em] text-slate-400"><tr>
              <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Funcionário</th><th className="px-4 py-3">Login</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Setor / unidade</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3">Criação</th><th className="px-4 py-3">Criado por</th><th className="px-4 py-3">Ações</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const employee = (data?.employees || []).find((item) => item.id === user.funcionario_id);
                return <tr key={user.id} className="text-sm text-slate-600 hover:bg-slate-50/70">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{avatarInitials(user.nome)}</span><div><p className="font-black text-slate-800">{user.nome}</p><p className="text-xs text-slate-400">{TYPES.find(([id])=>id===user.tipo_acesso)?.[1]}</p></div></div></td>
                  <td className="px-4 py-3">{employee?.nome || "—"}</td><td className="px-4 py-3 font-bold">{user.login}</td><td className="px-4 py-3">{profileName(user.perfil_id)}</td>
                  <td className="px-4 py-3"><p className="font-bold">{sectorName(user.setor_principal_id)}</p><p className="text-xs text-slate-400">{unitName(user.unidade_principal_id)}</p></td>
                  <td className="px-4 py-3"><Status value={user.status}/></td><td className="px-4 py-3">{formatLastAccess(user.ultimo_acesso_em)}</td><td className="px-4 py-3">{new Date(user.created_at).toLocaleDateString("pt-BR")}</td><td className="px-4 py-3">{(data?.users || []).find((item)=>item.auth_user_id===user.criado_por)?.nome||"Sistema"}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button title="Visualizar" onClick={()=>{setForm(user);setModal("view")}} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye size={15}/></button>
                    <button title="Editar" onClick={()=>openForm(user)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Pencil size={15}/></button>
                    <button title="Alterar permissões" onClick={()=>openPermissions(user)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><ShieldCheck size={15}/></button>
                    <button title="Redefinir senha" onClick={()=>{setForm({...user,password:"",confirmPassword:""});setModal("password")}} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><KeyRound size={15}/></button>
                    {user.status==="ativo"?<button title="Bloquear" onClick={()=>status(user,"bloqueado")} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><Lock size={15}/></button>:<button title="Desbloquear" onClick={()=>status(user,"ativo")} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 size={15}/></button>}
                    <button title="Desativar" onClick={()=>status(user,"desativado")} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Ban size={15}/></button>
                    <button title="Duplicar" onClick={()=>openForm(user,true)} className="rounded-lg p-2 text-cyan-600 hover:bg-cyan-50"><Copy size={15}/></button>
                    <button title="Histórico" onClick={()=>{setForm(user);setModal("history")}} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><History size={15}/></button>
                    <button title="Excluir" onClick={()=>remove(user)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15}/></button>
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {!users.length && <div className="p-12 text-center text-sm font-bold text-slate-400">Nenhum usuário encontrado.</div>}
      </div>

      {modal==="form" && <Modal title={form.id?"Editar usuário":"Novo usuário"} subtitle="Dados pessoais, vínculo, escopo e políticas de segurança." onClose={()=>setModal(null)}>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div><label className={LABEL}>Nome completo *</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Funcionário vinculado</label><select value={form.funcionario_id||""} onChange={e=>{const emp=(data?.employees || []).find(x=>x.id===e.target.value);setForm({...form,funcionario_id:e.target.value,cargo:form.cargo||emp?.cargo||""})}} className={INPUT}><option value="">Nenhum</option>{(data?.employees || []).filter(e=>e.ativo!==false).map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
          <div><label className={LABEL}>Foto ou avatar (URL)</label><input value={form.avatar_url||""} onChange={e=>setForm({...form,avatar_url:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>E-mail de contato</label><input type="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Telefone</label><input value={form.telefone||""} onChange={e=>setForm({...form,telefone:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Login *</label><input value={form.login} onChange={e=>setForm({...form,login:e.target.value})} className={INPUT}/></div>
          {!form.id&&<><div><label className={LABEL}>Senha temporária *</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className={INPUT}/></div><div><label className={LABEL}>Confirmar senha *</label><input type="password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} className={INPUT}/></div></>}
          <div><label className={LABEL}>Empresa</label><select value={form.scope_empresa_id||""} onChange={e=>setForm({...form,scope_empresa_id:e.target.value})} className={INPUT}>{data.companies.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          <div><label className={LABEL}>Unidade principal</label><select value={form.unidade_principal_id||""} onChange={e=>setForm({...form,unidade_principal_id:e.target.value,setor_principal_id:""})} className={INPUT}><option value="">Todas</option>{data.units.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
          <div><label className={LABEL}>Setor principal</label><select value={form.setor_principal_id||""} onChange={e=>setForm({...form,setor_principal_id:e.target.value})} className={INPUT}><option value="">Todos</option>{data.sectors.filter(s=>!form.unidade_principal_id||s.unidade_id===form.unidade_principal_id).map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
          <div><label className={LABEL}>Escopo dos dados</label><select value={form.scope_data||"setor"} onChange={e=>setForm({...form,scope_data:e.target.value})} className={INPUT}><option value="proprio">Somente próprios</option><option value="setor">Setor</option><option value="unidade">Unidade</option><option value="empresa">Empresa</option><option value="todos">Todos</option></select></div>
          <div><label className={LABEL}>Cargo</label><input value={form.cargo||""} onChange={e=>setForm({...form,cargo:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Tipo de acesso</label><select value={form.tipo_acesso} onChange={e=>setForm({...form,tipo_acesso:e.target.value})} className={INPUT}>{TYPES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
          <div><label className={LABEL}>Perfil de acesso</label><select value={form.perfil_id||""} onChange={e=>setForm({...form,perfil_id:e.target.value})} className={INPUT}><option value="">Personalizado</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
          <div><label className={LABEL}>Página inicial</label><input value={form.pagina_inicial} onChange={e=>setForm({...form,pagina_inicial:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className={INPUT}><option value="ativo">Ativo</option><option value="bloqueado">Bloqueado</option><option value="desativado">Desativado</option></select></div>
          <div className="sm:col-span-2"><label className={LABEL}>Dias permitidos</label><div className="flex gap-2">{DAYS.map(([day,label])=><button type="button" key={day} onClick={()=>{const n=Number(day),days=form.allowed_days.includes(n)?form.allowed_days.filter(x=>x!==n):[...form.allowed_days,n];setForm({...form,allowed_days:days})}} className={`h-9 w-9 rounded-lg text-xs font-black ${form.allowed_days.includes(Number(day))?"bg-emerald-600 text-white":"bg-slate-100 text-slate-400"}`}>{label}</button>)}</div></div>
          <div><label className={LABEL}>Horário inicial</label><input type="time" value={form.allowed_start_time||""} onChange={e=>setForm({...form,allowed_start_time:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Horário final</label><input type="time" value={form.allowed_end_time||""} onChange={e=>setForm({...form,allowed_end_time:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Acesso válido a partir de</label><input type="datetime-local" value={form.valid_from||""} onChange={e=>setForm({...form,valid_from:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Acesso válido até</label><input type="datetime-local" value={form.valid_until||""} onChange={e=>setForm({...form,valid_until:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Bloquear após tentativas</label><input type="number" min="1" value={form.max_failed_attempts} onChange={e=>setForm({...form,max_failed_attempts:e.target.value})} className={INPUT}/></div>
          <div><label className={LABEL}>Dispositivos autorizados (IDs)</label><input value={form.allowed_device_ids_text||""} onChange={e=>setForm({...form,allowed_device_ids_text:e.target.value})} placeholder="Separados por vírgula" className={INPUT}/></div>
          <div><label className={LABEL}>IPs externos autorizados</label><input value={form.allowed_ips_text||""} onChange={e=>setForm({...form,allowed_ips_text:e.target.value})} placeholder="Separados por vírgula" className={INPUT}/></div>
          <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">{[["exigir_troca_senha","Trocar senha no primeiro acesso"],["encerrar_sessoes_anteriores","Encerrar sessões anteriores"],["acesso_externo","Permitir acesso externo"]].map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600"><input type="checkbox" checked={!!form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})} className="accent-emerald-600"/>{label}</label>)}</div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 p-4"><button onClick={()=>setModal(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button><button disabled={saving} onClick={submitUser} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white">{saving?"Salvando...":"Salvar usuário"}</button></footer>
      </Modal>}

      {modal==="permissions"&&<Modal wide title={`Permissões de ${form.nome}`} subtitle="Tudo bloqueado, exceto o que estiver selecionado." onClose={()=>setModal(null)}><div className="p-4"><PermissionBuilder value={permissionValue} onChange={setPermissionValue} copySources={[...(data?.profiles || []).map(p=>({id:`p-${p.id}`,label:`Perfil: ${p.nome}`,permissions:p.permissions})),...(data?.users || []).filter(u=>u.id!==form.id).map(u=>({id:`u-${u.id}`,label:`Usuário: ${u.nome}`,permissions:data.userPermissions.filter(x=>x.usuario_id===u.id&&x.effect==="allow").map(x=>x.permission_key)}))]}/></div><footer className="flex justify-end gap-2 border-t p-4"><button onClick={()=>setModal(null)} className="px-4 text-sm font-bold text-slate-500">Cancelar</button><button disabled={saving} onClick={savePermissions} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white">Salvar permissões</button></footer></Modal>}

      {modal==="password"&&<Modal title={`Redefinir senha de ${form.nome}`} onClose={()=>setModal(null)}><div className="space-y-4 p-5"><div><label className={LABEL}>Nova senha temporária</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className={INPUT}/></div><div><label className={LABEL}>Confirmar senha</label><input type="password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} className={INPUT}/></div><p className="text-sm text-slate-500">O usuário será obrigado a criar uma senha própria no próximo acesso.</p></div><footer className="flex justify-end gap-2 border-t p-4"><button onClick={()=>setModal(null)} className="px-4 text-sm font-bold text-slate-500">Cancelar</button><button onClick={resetPassword} className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-black text-white">Redefinir senha</button></footer></Modal>}

      {modal==="view"&&<Modal title={form.nome} subtitle={form.login} onClose={()=>setModal(null)}><div className="grid grid-cols-2 gap-4 p-5 text-sm">{[["Perfil",profileName(form.perfil_id)],["Tipo",TYPES.find(([id])=>id===form.tipo_acesso)?.[1]],["Setor",sectorName(form.setor_principal_id)],["Unidade",unitName(form.unidade_principal_id)],["Status",form.status],["Último acesso",formatLastAccess(form.ultimo_acesso_em)],["E-mail",form.email||"—"],["Telefone",form.telefone||"—"],["Cargo",form.cargo||"—"],["Página inicial",form.pagina_inicial]].map(([k,v])=><div key={k}><p className={LABEL}>{k}</p><p className="font-bold text-slate-700">{v}</p></div>)}</div></Modal>}

      {modal==="history"&&<Modal title={`Histórico de ${form.nome}`} subtitle="Acessos permitidos, falhas e bloqueios." onClose={()=>setModal(null)}><div className="max-h-[30rem] divide-y overflow-y-auto p-5">{(data.accessLogs||[]).filter(log=>log.usuario_id===form.id).map(log=><div key={log.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-bold text-slate-700">{log.evento.replaceAll("_"," ")}</p><p className="text-xs text-slate-400">{log.ip||"IP não informado"} · {log.device_id||"dispositivo não identificado"}</p></div><div className="text-right"><Status value={log.sucesso?"ativo":"bloqueado"}/><p className="mt-1 text-xs text-slate-400">{formatLastAccess(log.created_at)}</p></div></div>)}{!(data.accessLogs||[]).some(log=>log.usuario_id===form.id)&&<p className="py-8 text-center text-sm font-bold text-slate-400">Nenhum acesso registrado.</p>}</div></Modal>}
    </div>
  );
}
