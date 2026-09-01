"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { mascaraCPF, mascaraRG, mascaraTelefone } from "../../../lib/mascaras.mjs";

const INPUT = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function Campo({ label, children, largo = false }) {
  return <label className={largo ? "sm:col-span-2" : ""}><span className="text-xs font-black text-slate-600">{label} <b className="text-rose-500">*</b></span>{children}</label>;
}

export default function AtualizarPerfilRH() {
  const { token } = useParams();
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch(`/api/rh/perfil-compartilhado?token=${encodeURIComponent(token)}`)
      .then(async resposta => ({ ok: resposta.ok, dados: await resposta.json() }))
      .then(({ ok, dados }) => { if (!ok) throw new Error(dados.error); setPerfil({ ...dados.perfil, filhos: Array.isArray(dados.perfil?.filhos) ? dados.perfil.filhos : [] }); })
      .catch(e => setErro(e.message || "Link inválido ou vencido."))
      .finally(() => setCarregando(false));
  }, [token]);

  const set = (campo, valor) => { setSalvo(false); setPerfil(atual => ({ ...atual, [campo]: valor })); };
  const salvar = async e => {
    e.preventDefault(); setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/rh/perfil-compartilhado", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, perfil }) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error);
      setSalvo(true); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setErro(e.message || "Não foi possível salvar."); }
    finally { setSalvando(false); }
  };

  if (carregando) return <main className="min-h-screen bg-slate-50 grid place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-emerald-600"/><p className="mt-3 font-bold text-slate-500">Abrindo seu cadastro...</p></div></main>;
  if (erro && !perfil) return <main className="min-h-screen bg-slate-50 grid place-items-center p-5"><div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto text-rose-500" size={42}/><h1 className="mt-4 text-xl font-black text-slate-900">Este link não está disponível</h1><p className="mt-2 text-sm font-medium text-slate-500">{erro}</p><p className="mt-4 text-xs text-slate-400">Peça ao RH um novo link de atualização.</p></div></main>;

  return <main className="min-h-screen bg-slate-100 px-3 py-6 sm:px-6 sm:py-10"><form onSubmit={salvar} className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
    <header className="bg-gradient-to-br from-emerald-800 to-emerald-600 px-5 py-7 text-white sm:px-8"><div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><UserRound size={30}/></span><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-100">Atualização segura do RH</p><h1 className="mt-1 text-2xl font-black">Olá, {perfil.nome?.split(" ")[0] || "colaborador"}</h1><p className="mt-1 text-sm text-emerald-50">Confira seus dados e corrija o que for necessário.</p></div></div></header>
    <div className="space-y-7 p-5 sm:p-8">
      {salvo && <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 className="shrink-0"/><div><p className="font-black">Dados atualizados com sucesso</p><p className="text-sm">O RH já consegue ver as novas informações.</p></div></div>}
      {erro && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{erro}</p>}
      <section><h2 className="mb-4 text-sm font-black uppercase tracking-wider text-emerald-700">Dados pessoais</h2><div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome completo" largo><input required value={perfil.nome || ""} onChange={e=>set("nome",e.target.value)} className={INPUT}/></Campo>
        <Campo label="Telefone / WhatsApp"><input required value={perfil.telefone || ""} onChange={e=>set("telefone",mascaraTelefone(e.target.value))} className={INPUT}/></Campo>
        <Campo label="E-mail"><input required type="email" value={perfil.email || ""} onChange={e=>set("email",e.target.value)} className={INPUT}/></Campo>
        <Campo label="CPF"><input required value={perfil.cpf || ""} onChange={e=>set("cpf",mascaraCPF(e.target.value))} className={INPUT}/></Campo>
        <Campo label="RG"><input required value={perfil.rg || ""} onChange={e=>set("rg",mascaraRG(e.target.value))} className={INPUT}/></Campo>
        <Campo label="Data de nascimento"><input required type="date" value={String(perfil.data_nascimento || "").slice(0,10)} onChange={e=>set("data_nascimento",e.target.value)} className={INPUT}/></Campo>
        <Campo label="Cidade de nascimento"><input required value={perfil.cidade_nascimento || ""} onChange={e=>set("cidade_nascimento",e.target.value)} className={INPUT}/></Campo>
        <Campo label="Gênero"><select required value={perfil.genero || ""} onChange={e=>set("genero",e.target.value)} className={INPUT}><option value="">Selecione</option><option>Feminino</option><option>Masculino</option><option>Não binário</option><option>Prefiro não informar</option></select></Campo>
        <Campo label="Estado civil"><select required value={perfil.estado_civil || ""} onChange={e=>set("estado_civil",e.target.value)} className={INPUT}><option value="">Selecione</option>{["Solteiro(a)","Casado(a)","União estável","Divorciado(a)","Viúvo(a)"].map(x=><option key={x}>{x}</option>)}</select></Campo>
        <Campo label="Escolaridade"><input required value={perfil.escolaridade || ""} onChange={e=>set("escolaridade",e.target.value)} className={INPUT}/></Campo>
      </div></section>
      <section><h2 className="mb-4 text-sm font-black uppercase tracking-wider text-emerald-700">Endereço</h2><div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Rua / Avenida" largo><input required value={perfil.rua_av || ""} onChange={e=>set("rua_av",e.target.value)} className={INPUT}/></Campo><Campo label="Número"><input required value={perfil.numero_casa || ""} onChange={e=>set("numero_casa",e.target.value)} className={INPUT}/></Campo><Campo label="Bairro"><input required value={perfil.bairro || ""} onChange={e=>set("bairro",e.target.value)} className={INPUT}/></Campo><Campo label="Cidade / UF"><input required value={perfil.cidade_uf || ""} onChange={e=>set("cidade_uf",e.target.value)} className={INPUT}/></Campo><Campo label="CEP"><input required value={perfil.cep || ""} onChange={e=>set("cep",e.target.value)} className={INPUT}/></Campo>
      </div></section>
      <section><h2 className="mb-4 text-sm font-black uppercase tracking-wider text-emerald-700">Família, pagamento e transporte</h2><div className="grid gap-4 sm:grid-cols-2"><Campo label="Nome da mãe"><input required value={perfil.nome_mae || ""} onChange={e=>set("nome_mae",e.target.value)} className={INPUT}/></Campo><Campo label="Nome do pai"><input required value={perfil.nome_pai || ""} onChange={e=>set("nome_pai",e.target.value)} className={INPUT}/></Campo><Campo label="Chave Pix" largo><input required value={perfil.chave_pix || ""} onChange={e=>set("chave_pix",e.target.value)} className={INPUT}/></Campo>
        <Campo label="Possui transporte próprio"><select required value={perfil.tem_transporte === true ? "sim" : perfil.tem_transporte === false ? "nao" : ""} onChange={e=>set("tem_transporte",e.target.value === "sim")} className={INPUT}><option value="">Selecione</option><option value="sim">Sim</option><option value="nao">Não</option></select></Campo>
        <Campo label="Utiliza vale-transporte"><select required value={perfil.usa_vale_transporte === true ? "sim" : perfil.usa_vale_transporte === false ? "nao" : ""} onChange={e=>set("usa_vale_transporte",e.target.value === "sim")} className={INPUT}><option value="">Selecione</option><option value="sim">Sim</option><option value="nao">Não</option></select></Campo>
        {perfil.tem_transporte && <Campo label="Tipo de transporte" largo><input required value={perfil.tipo_transporte || ""} onChange={e=>set("tipo_transporte",e.target.value)} placeholder="Ex.: carro, moto, bicicleta" className={INPUT}/></Campo>}
        <Campo label="Possui filhos ou dependentes" largo><select required value={perfil.tem_filhos === true ? "sim" : perfil.tem_filhos === false ? "nao" : ""} onChange={e=>{ const tem=e.target.value === "sim"; setSalvo(false); setPerfil(atual=>({...atual,tem_filhos:tem,filhos:tem?(atual.filhos?.length?atual.filhos:[{nome:"",data_nascimento:""}]):[]})); }} className={INPUT}><option value="">Selecione</option><option value="sim">Sim</option><option value="nao">Não</option></select></Campo>
      </div>{perfil.tem_filhos && <div className="mt-5"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-black text-slate-600">Filhos / dependentes <b className="text-rose-500">*</b></p><button type="button" onClick={()=>set("filhos",[...(perfil.filhos||[]),{nome:"",data_nascimento:""}])} className="flex items-center gap-1 text-xs font-black text-emerald-700"><Plus size={14}/> Adicionar</button></div><div className="space-y-2">{(perfil.filhos||[]).map((filho,i)=><div key={i} className="grid grid-cols-[1fr_140px_36px] gap-2"><input required value={filho.nome||""} onChange={e=>set("filhos",perfil.filhos.map((x,j)=>j===i?{...x,nome:e.target.value}:x))} placeholder="Nome" className={INPUT.replace("mt-1.5 ","")}/><input required type="date" value={String(filho.data_nascimento||"").slice(0,10)} onChange={e=>set("filhos",perfil.filhos.map((x,j)=>j===i?{...x,data_nascimento:e.target.value}:x))} className={INPUT.replace("mt-1.5 ","")}/><button type="button" onClick={()=>set("filhos",perfil.filhos.filter((_,j)=>j!==i))} className="grid place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={16}/></button></div>)}</div></div>}</section>
      <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500"><ShieldCheck size={16} className="shrink-0 text-emerald-600"/>Todos os campos com * são obrigatórios. Este formulário não mostra salário, avaliações ou histórico. O link é pessoal e vence automaticamente.</p>
    </div><footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:px-8"><button disabled={salvando} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 font-black text-white shadow-lg shadow-emerald-700/20 disabled:opacity-60">{salvando?<Loader2 className="animate-spin" size={19}/>:<Save size={19}/>} {salvando?"Salvando...":"Salvar meus dados"}</button></footer>
  </form></main>;
}
