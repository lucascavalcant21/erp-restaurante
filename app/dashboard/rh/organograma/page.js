"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, User, Search } from "lucide-react";
import { PageHeader, PageBody, Card, EmptyState, SearchBar } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchFuncionarios } from "../../../lib/rh";

// Componente recursivo para desenhar a árvore
function TreeNode({ func, childrenMap, level, isLast }) {
  const children = childrenMap[func.id] || [];
  
  return (
    <div className="relative">
      {/* Linha vertical de conexão vinda do pai */}
      {level > 0 && (
        <div 
          className="absolute border-l-2 border-emerald-500/20" 
          style={{ left: '-1.5rem', top: '-1rem', bottom: isLast && children.length === 0 ? '50%' : 0 }} 
        />
      )}
      
      {/* Linha horizontal para este nó */}
      {level > 0 && (
        <div 
          className="absolute border-t-2 border-emerald-500/20" 
          style={{ left: '-1.5rem', top: '50%', width: '1.2rem' }} 
        />
      )}

      <Card className="flex items-center gap-3 !p-3 mb-3 hover:border-emerald-500/30 transition-colors w-full max-w-md">
        {func.foto_url ? (
          <img src={func.foto_url} alt={func.nome} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            {func.nome?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate text-[var(--fg)]">{func.nome}</p>
          <p className="text-[11px] truncate text-[var(--dim)]">{func.cargo}</p>
        </div>
        {children.length > 0 && (
          <div className="text-[10px] font-bold bg-[var(--elevated)] px-2 py-1 rounded-md text-[var(--muted)]">
            {children.length} {children.length === 1 ? 'liderado' : 'liderados'}
          </div>
        )}
      </Card>

      {/* Renderizar filhos recursivamente */}
      {children.length > 0 && (
        <div className="ml-10 relative">
          {children.map((child, index) => (
            <TreeNode 
              key={child.id} 
              func={child} 
              childrenMap={childrenMap} 
              level={level + 1} 
              isLast={index === children.length - 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrganogramaPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const { data } = await fetchFuncionarios(unidadeAtiva);
      setLista(data?.filter(f => f.ativo !== false) || []); // Somente ativos no organograma
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  // Construir a árvore
  const { roots, childrenMap } = useMemo(() => {
    const map = {};
    const rootNodes = [];

    // Procurar por filtro de busca
    let dados = lista;
    if (busca) {
      const termo = busca.toLowerCase();
      dados = lista.filter(f => f.nome.toLowerCase().includes(termo) || f.cargo.toLowerCase().includes(termo));
      // Se tiver busca, ignora hierarquia e mostra lista flat
      return { roots: dados, childrenMap: {} };
    }

    // Organizar hierarquia
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
    <div className="min-h-screen">
      <PageHeader title="Organograma" subtitle={`Quadro de Hierarquia · ${unidadeInfo.nome}`} icon={Users} />
      
      <PageBody>
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar colaborador ou cargo..." />

        {loading ? (
          <EmptyState icon={Users} title="Montando quadro..." />
        ) : lista.length === 0 ? (
          <EmptyState icon={User} title="Equipe Vazia" hint="Cadastre funcionários no RH para ver o organograma." />
        ) : (
          <div className="mt-6 py-2 overflow-x-auto">
            {roots.map(root => (
              <TreeNode key={root.id} func={root} childrenMap={childrenMap} level={0} isLast={true} />
            ))}
          </div>
        )}
      </PageBody>
    </div>
  );
}
