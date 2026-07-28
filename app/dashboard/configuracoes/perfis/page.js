"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Pencil, Plus, Power, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import PermissionBuilder from "../../../components/access-control/PermissionBuilder";
import { accessCommand, fetchAccessBootstrap } from "../../../lib/access-control";

const INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500";

function Modal({ title, onClose, wide = false, children }) {
  return <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 py-8 backdrop-blur-sm"><div className={`w-full ${wide?"max-w-6xl":"max-w-xl"} overflow-hidden rounded-2xl bg-white shadow-2xl`}><header className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-black text-slate-800">{title}</h2><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></header>{children}</div></div>;
}

export default function PerfisAcessoPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [applyProfile, setApplyProfile] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await fetchAccessBootstrap()); setError(""); } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const profiles = useMemo(() => (data?.profiles || []).filter((profile) => profile.is_current && profile.nome.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const open = (profile = null) => {
    setEditing(profile ? { ...profile } : { nome: "", descricao: "", tipo: "personalizado", ativo: true });
    setPermissions(profile?.permissions || []);
  };
  const save = async () => {
    if (!editing.nome.trim()) return setError("Informe o nome do perfil.");
    let applyMode = "all";
    if (editing.id) {
      const all = confirm("Aplicar esta mudança a todos os usuários atuais?\n\nOK: todos os usuários atuais.\nCancelar: escolher apenas novos usuários ou desistir.");
      if (!all) {
        const newOnly = confirm("Aplicar somente aos novos usuários?\n\nOK: cria uma nova versão do perfil.\nCancelar: não salvar.");
        if (!newOnly) return;
        applyMode = "new_only";
      }
    }
    setSaving(true);
    try {
      await accessCommand("save-profile", { profile: editing, permissions, applyMode });
      setEditing(null); setNotice(applyMode==="new_only"?"Nova versão criada para usuários futuros.":"Perfil salvo e aplicado."); await load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };
  const duplicate = async (profile) => {
    try { await accessCommand("duplicate-profile", { id: profile.id }); setNotice("Perfil duplicado."); await load(); } catch (e) { setError(e.message); }
  };
  const toggle = async (profile) => {
    try { await accessCommand("set-profile-status", { id: profile.id, ativo: !profile.ativo }); await load(); } catch (e) { setError(e.message); }
  };
  const remove = async (profile) => {
    if (!confirm(`Excluir o perfil ${profile.nome}?`)) return;
    try { await accessCommand("delete-profile", { id: profile.id }); setNotice("Perfil excluído."); await load(); } catch (e) { setError(e.message); }
  };
  const apply = async () => {
    if (!selectedUsers.length) return setError("Selecione ao menos um usuário.");
    setSaving(true);
    try { await accessCommand("apply-profile", { profileId: applyProfile.id, userIds: selectedUsers }); setApplyProfile(null); setSelectedUsers([]); setNotice("Perfil aplicado aos usuários selecionados."); await load(); }
    catch (e) { setError(e.message); }
    setSaving(false);
  };

  if (loading && !data) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-emerald-600"/></div>;
  return <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white"><ShieldCheck size={23}/></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet-600">Configurações</p><h1 className="text-2xl font-black text-slate-800">Perfis de acesso</h1><p className="text-sm text-slate-500">Conjuntos reutilizáveis de páginas e ações.</p></div></div><button onClick={()=>open()} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"><Plus size={17}/> Novo perfil</button></header>
    {error&&<div className="mb-4 flex justify-between rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}<button onClick={()=>setError("")}><X size={16}/></button></div>}
    {notice&&<div className="mb-4 flex justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}<button onClick={()=>setNotice("")}><X size={16}/></button></div>}
    <label className="relative mb-5 block max-w-md"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar perfil" className={INPUT+" pl-9"}/></label>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {profiles.map(profile=>{
        const count=(data.users||[]).filter(user=>user.perfil_id===profile.id).length;
        return <article key={profile.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${profile.ativo?"border-slate-200":"border-slate-100 opacity-60"}`}><div className="mb-4 flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><ShieldCheck size={19}/></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${profile.ativo?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{profile.ativo?"Ativo":"Inativo"}</span></div><h2 className="font-black text-slate-800">{profile.nome}</h2><p className="mt-1 min-h-10 text-sm text-slate-500">{profile.descricao||"Sem descrição."}</p><div className="my-4 flex gap-4 border-y border-slate-100 py-3 text-xs font-bold text-slate-500"><span>{profile.permissions.length} regras</span><span>{count} usuários</span>{profile.version>1&&<span>Versão {profile.version}</span>}</div><div className="flex flex-wrap gap-1">
          <button onClick={()=>open(profile)} title="Editar" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Pencil size={16}/></button>
          <button onClick={()=>duplicate(profile)} title="Duplicar" className="rounded-lg p-2 text-cyan-600 hover:bg-cyan-50"><Copy size={16}/></button>
          <button onClick={()=>{setApplyProfile(profile);setSelectedUsers([])}} title="Aplicar a usuários" className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Users size={16}/></button>
          <button onClick={()=>toggle(profile)} title={profile.ativo?"Desativar":"Ativar"} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><Power size={16}/></button>
          {!profile.sistema&&<button onClick={()=>remove(profile)} title="Excluir" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button>}
        </div></article>;
      })}
    </div>

    {editing&&<Modal wide title={editing.id?`Editar ${editing.nome}`:"Novo perfil"} onClose={()=>setEditing(null)}><div className="grid gap-3 border-b p-4 sm:grid-cols-3"><div><label className="mb-1 block text-xs font-black uppercase text-slate-400">Nome</label><input value={editing.nome} onChange={e=>setEditing({...editing,nome:e.target.value})} className={INPUT}/></div><div><label className="mb-1 block text-xs font-black uppercase text-slate-400">Tipo</label><select value={editing.tipo} onChange={e=>setEditing({...editing,tipo:e.target.value})} className={INPUT}><option value="personalizado">Personalizado</option><option value="administrador">Administrador</option><option value="gerente">Gerente</option><option value="supervisor">Supervisor</option><option value="funcionario">Funcionário</option><option value="consulta">Consulta</option><option value="terminal_ponto">Terminal de ponto</option></select></div><div><label className="mb-1 block text-xs font-black uppercase text-slate-400">Descrição</label><input value={editing.descricao||""} onChange={e=>setEditing({...editing,descricao:e.target.value})} className={INPUT}/></div></div><div className="p-4"><PermissionBuilder value={permissions} onChange={setPermissions} copySources={(data.profiles||[]).filter(p=>p.id!==editing.id).map(p=>({id:p.id,label:`Perfil: ${p.nome}`,permissions:p.permissions}))}/></div><footer className="flex justify-end gap-2 border-t p-4"><button onClick={()=>setEditing(null)} className="px-4 text-sm font-bold text-slate-500">Cancelar</button><button disabled={saving} onClick={save} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white">{saving?"Salvando...":"Salvar perfil"}</button></footer></Modal>}

    {applyProfile&&<Modal title={`Aplicar ${applyProfile.nome}`} onClose={()=>setApplyProfile(null)}><div className="max-h-[28rem] space-y-2 overflow-y-auto p-5">{data.users.map(user=><label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50"><input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={e=>setSelectedUsers(e.target.checked?[...selectedUsers,user.id]:selectedUsers.filter(id=>id!==user.id))} className="accent-emerald-600"/><div><p className="font-bold text-slate-700">{user.nome}</p><p className="text-xs text-slate-400">{user.login}</p></div></label>)}</div><footer className="flex justify-end gap-2 border-t p-4"><button onClick={()=>setApplyProfile(null)} className="px-4 text-sm font-bold text-slate-500">Cancelar</button><button disabled={saving||!selectedUsers.length} onClick={apply} className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-black text-white disabled:opacity-40">Aplicar a {selectedUsers.length} usuários</button></footer></Modal>}
  </div>;
}

