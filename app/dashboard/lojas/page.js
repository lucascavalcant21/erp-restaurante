"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchUnidades, inserirUnidade, atualizarUnidade, removerUnidade } from "../../lib/unidades";
import { Plus, Edit2, Trash2, Building2, Store, Save, X, Info, FileText, MapPin, Phone } from "lucide-react";

export default function LojasPage() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalAberta, setModalAberta] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [abaAtual, setAbaAtual] = useState("basico");

  // Formulário
  const formPadrao = {
    nome: "",
    cor: "#10B981",
    cnpj: "",
    razao_social: "",
    nome_fantasia: "",
    inscricao_estadual: "",
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    telefone_unidade: "",
    email_unidade: ""
  };
  const [form, setForm] = useState(formPadrao);

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchUnidades();
    setUnidades(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const abrirNova = () => {
    setEditandoId(null);
    setForm({ ...formPadrao, cor: "#" + Math.floor(Math.random()*16777215).toString(16) });
    setAbaAtual("basico");
    setModalAberta(true);
  };

  const abrirEdicao = (unidade) => {
    setEditandoId(unidade.id);
    setForm({
      nome: unidade.nome || "",
      cor: unidade.cor || "#10B981",
      cnpj: unidade.cnpj || "",
      razao_social: unidade.razao_social || "",
      nome_fantasia: unidade.nome_fantasia || "",
      inscricao_estadual: unidade.inscricao_estadual || "",
      cep: unidade.cep || "",
      endereco: unidade.endereco || "",
      numero: unidade.numero || "",
      bairro: unidade.bairro || "",
      cidade: unidade.cidade || "",
      uf: unidade.uf || "",
      telefone_unidade: unidade.telefone_unidade || "",
      email_unidade: unidade.email_unidade || ""
    });
    setAbaAtual("basico");
    setModalAberta(true);
  };

  const handleSalvar = async () => {
    if(!form.nome.trim()) return alert("O Nome da Unidade é obrigatório!");

    if (editandoId) {
      await atualizarUnidade(editandoId, form);
    } else {
      await inserirUnidade(form);
    }
    
    setModalAberta(false);
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Tem certeza? Esta unidade e TODOS os dados atrelados ficarão inacessíveis permanentemente.")) {
      await removerUnidade(id);
      carregar();
    }
  };

  const buscarCep = async (cep) => {
    const limpo = cep.replace(/\D/g, "");
    if(limpo.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if(!data.erro) {
        setForm(prev => ({
          ...prev,
          endereco: data.logradouro,
          bairro: data.bairro,
          cidade: data.localidade,
          uf: data.uf
        }));
      }
    } catch(e) {}
  };

  if (loading) return <div className="p-10 font-bold text-slate-500 flex justify-center mt-20"><div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-10">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <Building2 size={32} className="text-slate-800" />
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Unidades</h1>
           </div>
           <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Gerenciador de Lojas e Dados Fiscais</p>
        </div>
        <button onClick={abrirNova} className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-xl shadow-slate-900/20 flex items-center gap-2 hover:-translate-y-1">
           <Plus size={20} /> Nova Unidade
        </button>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {unidades.map((u) => (
            <div key={u.id} className="bg-white p-6 flex flex-col rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
               <div className="flex items-start justify-between mb-4">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 border border-slate-100 shrink-0">
                       <div className="w-5 h-5 rounded-full" style={{background: u.cor}}></div>
                    </div>
                    <div>
                       <p className="font-black text-slate-800 text-xl tracking-tight leading-none mb-1">{u.nome}</p>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ID: {u.id.substring(0,8)}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => abrirEdicao(u)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors" title="Configurar Unidade"><Edit2 size={18}/></button>
                    {u.id !== "matriz" && (
                      <button onClick={() => handleRemover(u.id)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors" title="Remover"><Trash2 size={18}/></button>
                    )}
                 </div>
               </div>
               
               {u.cnpj ? (
                 <div className="mt-auto bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                   <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><FileText size={16}/></div>
                   <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNPJ Vinculado</p>
                     <p className="text-sm font-black text-slate-700">{u.cnpj}</p>
                   </div>
                 </div>
               ) : (
                 <div className="mt-auto bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                   <div className="bg-white p-2 rounded-lg shadow-sm text-amber-500"><Info size={16}/></div>
                   <div>
                     <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Sem Dados Fiscais</p>
                     <p className="text-xs font-medium text-amber-700 leading-tight mt-0.5">Clique em editar para configurar o CNPJ desta unidade.</p>
                   </div>
                 </div>
               )}
            </div>
         ))}
      </div>

      {/* Modal Nova/Editar */}
      {modalAberta && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] overflow-hidden">
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <h2 className="font-black text-2xl text-slate-800">{editandoId ? "Configurar Unidade" : "Nova Unidade"}</h2>
                  <button onClick={() => setModalAberta(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* Abas */}
               <div className="flex gap-4 mb-6 shrink-0 border-b border-slate-100">
                  <button onClick={()=>setAbaAtual("basico")} className={`pb-3 font-bold text-sm tracking-wide border-b-2 transition-colors ${abaAtual === "basico" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>Identificação</button>
                  <button onClick={()=>setAbaAtual("fiscal")} className={`pb-3 font-bold text-sm tracking-wide border-b-2 transition-colors ${abaAtual === "fiscal" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>Dados Fiscais / CNPJ</button>
                  <button onClick={()=>setAbaAtual("endereco")} className={`pb-3 font-bold text-sm tracking-wide border-b-2 transition-colors ${abaAtual === "endereco" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>Endereço & Contato</button>
               </div>

               <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4 custom-scrollbar">
                  {abaAtual === "basico" && (
                    <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Nome da Unidade *</label>
                          <input type="text" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} placeholder="Ex: Matriz Centro" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg outline-none focus:border-slate-900 text-slate-800"/>
                       </div>
                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Cor de Identificação</label>
                          <div className="flex items-center gap-4">
                             <input type="color" value={form.cor} onChange={e=>setForm({...form, cor: e.target.value})} className="w-14 h-14 rounded-xl cursor-pointer border-0 p-0 bg-transparent"/>
                             <span className="font-bold text-slate-500">{form.cor}</span>
                          </div>
                       </div>
                    </div>
                  )}

                  {abaAtual === "fiscal" && (
                    <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                       <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
                          <p className="text-sm font-medium text-slate-600">Estes dados serão utilizados para emissão de notas, cupons e recibos de forma automática por todos os módulos dessa unidade.</p>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">CNPJ</label>
                             <input type="text" value={form.cnpj} onChange={e=>setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Inscrição Estadual</label>
                             <input type="text" value={form.inscricao_estadual} onChange={e=>setForm({...form, inscricao_estadual: e.target.value})} placeholder="Opcional" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                       </div>
                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Razão Social</label>
                          <input type="text" value={form.razao_social} onChange={e=>setForm({...form, razao_social: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                       </div>
                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Nome Fantasia</label>
                          <input type="text" value={form.nome_fantasia} onChange={e=>setForm({...form, nome_fantasia: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                       </div>
                    </div>
                  )}

                  {abaAtual === "endereco" && (
                    <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Telefone da Unidade</label>
                             <input type="text" value={form.telefone_unidade} onChange={e=>setForm({...form, telefone_unidade: e.target.value})} placeholder="(00) 0000-0000" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">E-mail Comercial</label>
                             <input type="email" value={form.email_unidade} onChange={e=>setForm({...form, email_unidade: e.target.value})} placeholder="contato@loja.com" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                       </div>
                       
                       <div className="w-full h-px bg-slate-100 my-4"></div>
                       
                       <div className="grid grid-cols-3 gap-4">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">CEP</label>
                             <input type="text" value={form.cep} onChange={e=>{
                               setForm({...form, cep: e.target.value});
                               if(e.target.value.length >= 8) buscarCep(e.target.value);
                             }} placeholder="00000-000" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                          <div className="col-span-2">
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Endereço / Logradouro</label>
                             <input type="text" value={form.endereco} onChange={e=>setForm({...form, endereco: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                       </div>
                       <div className="grid grid-cols-4 gap-4">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Nº</label>
                             <input type="text" value={form.numero} onChange={e=>setForm({...form, numero: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                          <div className="col-span-3">
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Bairro</label>
                             <input type="text" value={form.bairro} onChange={e=>setForm({...form, bairro: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                       </div>
                       <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-3">
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Cidade</label>
                             <input type="text" value={form.cidade} onChange={e=>setForm({...form, cidade: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">UF</label>
                             <input type="text" value={form.uf} onChange={e=>setForm({...form, uf: e.target.value})} placeholder="SP" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900"/>
                          </div>
                       </div>
                    </div>
                  )}
               </div>

               <div className="mt-6 pt-4 border-t border-slate-100 shrink-0">
                  <button onClick={handleSalvar} disabled={!form.nome} className="w-full py-5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95">
                     {editandoId ? "Salvar Alterações da Loja" : "Criar Nova Loja"}
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
