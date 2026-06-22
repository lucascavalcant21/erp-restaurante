"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, User, Search, Network, ChevronDown } from "lucide-react";
import { PageHeader, PageBody, EmptyState } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchFuncionarios } from "../../../lib/rh";

// ════════════════════════════════════════════════════════════
// NÓ DO ORGANOGRAMA CORPORATIVO
// ════════════════════════════════════════════════════════════
function TreeNode({ func, childrenMap, level, isLast, isRoot }) {
  const children = childrenMap[func.id] || [];
  const hasChildren = children.length > 0;
  
  // Cores Baseadas no Nível Hierárquico
  const isCLevel = level === 0;
  const isManager = level === 1;
  const isOperator = level >= 2;

  const bgCard = isCLevel ? "bg-slate-900 border-slate-800" : isManager ? "bg-white border-slate-200 shadow-md" : "bg-white border-slate-100 shadow-sm";
  const textName = isCLevel ? "text-white" : "text-slate-900";
  const textRole = isCLevel ? "text-emerald-400" : isManager ? "text-blue-600" : "text-slate-500";
  const avatarBg = isCLevel ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600";

  return (
    <div className="relative flex flex-col items-center">
      
      {/* O Cartão do Funcionário */}
      <div className={`relative z-10 flex flex-col items-center p-6 rounded-[32px] border transition-all hover:-translate-y-1 hover:shadow-xl w-64 ${bgCard}`}>
         
         {/* Avatar */}
         <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl mb-4 shadow-inner border-4 ${isCLevel ? 'border-slate-800' : 'border-white'} ${avatarBg}`}>
            {func.foto_url ? (
              <img src={func.foto_url} alt={func.nome} className="w-full h-full rounded-full object-cover" />
            ) : (
              func.nome?.[0]?.toUpperCase()
            )}
         </div>

         {/* Informações */}
         <h3 className={`font-black text-lg text-center leading-tight truncate w-full px-2 ${textName}`}>{func.nome}</h3>
         <p className={`text-[10px] font-black uppercase tracking-widest mt-1 text-center ${textRole}`}>{func.cargo}</p>

         {/* Badge de Liderança */}
         {hasChildren && (
            <div className={`mt-4 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${isCLevel ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
               <Users size={12} /> {children.length} Liderado{children.length > 1 ? 's' : ''}
            </div>
         )}
      </div>

      {/* Conectores Lineares (Se tiver filhos) */}
      {hasChildren && (
        <div className="relative flex flex-col items-center w-full">
           {/* Linha Vertical descendo do pai */}
           <div className="w-px h-8 bg-slate-300"></div>
           
           {/* Linha Horizontal (só se tiver mais de 1 filho) */}
           {children.length > 1 && (
             <div className="absolute top-8 left-0 right-0 h-px bg-slate-300" style={{ 
               width: `calc(100% - ${100 / children.length}%)`,
               margin: '0 auto' 
             }}></div>
           )}

           {/* Filhos renderizados lado a lado */}
           <div className="flex justify-center gap-8 pt-8">
             {children.map((child, index) => (
               <div key={child.id} className="relative flex flex-col items-center">
                  {/* Linha Vertical subindo para conectar na horizontal (ou direto no pai se for filho único) */}
                  <div className="absolute -top-8 w-px h-8 bg-slate-300"></div>
                  <TreeNode 
                    func={child} 
                    childrenMap={childrenMap} 
                    level={level + 1} 
                    isLast={index === children.length - 1} 
                    isRoot={false}
                  />
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function OrganogramaCorporativoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const { data } = await fetchFuncionarios(unidadeAtiva);
      setLista(data?.filter(f => f.ativo !== false) || []); 
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  // Lógica de Árvore
  const { roots, childrenMap } = useMemo(() => {
    const map = {};
    const rootNodes = [];

    // Se estiver buscando, mostra lista flat simples
    let dados = lista;
    if (busca) {
      const termo = busca.toLowerCase();
      dados = lista.filter(f => f.nome.toLowerCase().includes(termo) || f.cargo.toLowerCase().includes(termo));
      return { roots: dados, childrenMap: {} };
    }

    dados.forEach(f => {
      if (f.supervisor_id) {
        if (!map[f.supervisor_id]) map[f.supervisor_id] = [];
        map[f.supervisor_id].push(f);
      } else {
        rootNodes.push(f);
      }
    });

    return { roots: rootNodes, childrenMap: map };
  }, [lista, busca]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      
      {/* HEADER CORPORATIVO */}
      <div className="bg-slate-900 text-white px-6 py-10 rounded-b-[40px] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5"><Network size={200} /></div>
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 max-w-7xl mx-auto">
            <div>
               <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                  <Network size={14}/> Gestão de Pessoas
               </p>
               <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Quadro Corporativo.</h1>
               <p className="text-sm font-medium text-slate-400 mt-2">Estrutura Hierárquica da {unidadeInfo.nome}</p>
            </div>
            
            <div className="w-full md:w-96 relative">
               <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
               <input 
                 type="text" 
                 value={busca} 
                 onChange={e => setBusca(e.target.value)} 
                 placeholder="Pesquisar funcionário..." 
                 className="w-full pl-12 pr-4 py-4 bg-slate-800/80 border border-slate-700 rounded-2xl text-white font-bold placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none backdrop-blur-sm"
               />
            </div>
         </div>
      </div>

      <PageBody className="max-w-7xl mx-auto mt-10">
        {loading ? (
          <EmptyState icon={Network} title="Desenhando estrutura..." />
        ) : lista.length === 0 ? (
          <EmptyState icon={User} title="Organograma Vazio" hint="Cadastre funcionários no RH e defina seus supervisores." />
        ) : busca ? (
          // Visualização de Busca (Lista Flat)
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {roots.map(func => (
                <div key={func.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center gap-4">
                   <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 font-black flex items-center justify-center">
                      {func.nome[0].toUpperCase()}
                   </div>
                   <div>
                      <p className="font-bold text-slate-900">{func.nome}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">{func.cargo}</p>
                   </div>
                </div>
             ))}
             {roots.length === 0 && <p className="text-slate-500 font-medium p-4">Nenhum funcionário encontrado.</p>}
          </div>
        ) : (
          // Visualização Árvore Hierárquica Horizontal (O Organograma de fato)
          <div className="w-full overflow-x-auto pb-10 custom-scrollbar">
             <div className="min-w-max flex justify-center p-8">
               {roots.map(root => (
                 <TreeNode key={root.id} func={root} childrenMap={childrenMap} level={0} isLast={true} isRoot={true} />
               ))}
             </div>
          </div>
        )}
      </PageBody>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}} />
    </div>
  );
}
