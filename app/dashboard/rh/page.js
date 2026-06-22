"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, UserPlus, FileText, Upload, Save, X, Search 
} from "lucide-react";
import { fmtBRL } from "../../components/ui";

export default function RHPage() {
  const router = useRouter();
  
  // Mocks de Funcionários (Na prática viria do Supabase)
  const [funcionarios, setFuncionarios] = useState([
    { id: "1", nome: "Carlos Silva", cargo: "Garçom", salario: 1800, docs: ["RG.pdf", "Contrato.pdf"] },
    { id: "2", nome: "Ana Pereira", cargo: "Cozinheira", salario: 2500, docs: ["CNH.pdf"] }
  ]);
  const [busca, setBusca] = useState("");
  const [modalNovo, setModalNovo] = useState(false);
  const [novoFunc, setNovoFunc] = useState({ nome: "", cargo: "", salario: "" });

  const filtrados = funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()));

  const handleSalvar = () => {
    if(!novoFunc.nome) return;
    setFuncionarios([...funcionarios, { ...novoFunc, id: Date.now().toString(), docs: [] }]);
    setModalNovo(false);
    setNovoFunc({ nome: "", cargo: "", salario: "" });
  };

  return (
    <div className="min-h-screen font-sans pb-24 text-slate-800">
      
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-5xl mx-auto flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
              <Users size={32} />
           </div>
           <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900">RH & Equipe</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Funcionários</p>
           </div>
         </div>
         <button onClick={() => setModalNovo(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
            <UserPlus size={18} /> Contratar
         </button>
      </div>

      <div className="max-w-5xl mx-auto px-6">
         
         <div className="bg-white p-4 rounded-t-3xl border border-slate-200 border-b-0 flex items-center gap-3">
            <Search size={18} className="text-slate-400" />
            <input type="text" placeholder="Buscar funcionário..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-medium text-slate-700" />
         </div>

         <div className="bg-white rounded-b-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Colaborador</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Cargo</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Remuneração Base</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Documentos</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filtrados.map(f => (
                     <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{f.nome}</td>
                        <td className="p-4 font-medium text-slate-600">{f.cargo}</td>
                        <td className="p-4 font-black text-slate-800">{fmtBRL(f.salario)}</td>
                        <td className="p-4 text-right">
                           <div className="flex flex-col items-end gap-1">
                              {f.docs.length > 0 ? f.docs.map((d, i) => (
                                <span key={i} className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md"><FileText size={10}/> {d}</span>
                              )) : <span className="text-[10px] text-slate-400">Sem docs</span>}
                              <button className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                                 <Upload size={12}/> Anexar PDF
                              </button>
                           </div>
                        </td>
                     </tr>
                  ))}
                  {filtrados.length === 0 && (
                     <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold">Nenhum funcionário encontrado.</td></tr>
                  )}
               </tbody>
            </table>
         </div>

      </div>

      {/* Modal Adicionar Funcionário */}
      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Novo Funcionário</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
                     <input type="text" value={novoFunc.nome} onChange={e=>setNovoFunc({...novoFunc, nome: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Função / Cargo</label>
                     <input type="text" value={novoFunc.cargo} onChange={e=>setNovoFunc({...novoFunc, cargo: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Salário Base (R$)</label>
                     <input type="number" value={novoFunc.salario} onChange={e=>setNovoFunc({...novoFunc, salario: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-indigo-600 outline-none focus:border-indigo-500"/>
                  </div>
               </div>

               <button onClick={handleSalvar} disabled={!novoFunc.nome} className="w-full mt-8 py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                  Salvar Colaborador
               </button>
            </div>
         </div>
      )}

    </div>
  );
}
