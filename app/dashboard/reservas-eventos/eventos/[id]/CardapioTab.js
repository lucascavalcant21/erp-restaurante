"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, ChefHat, Info, Save, Loader2, ListOrdered, Check } from "lucide-react";
import { fetchFichas } from "../../../../lib/operacao";
import supabase from "../../../../lib/supabase";

export default function CardapioTab({ evento, unidadeAtiva, onUpdate }) {
  const [fichas, setFichas] = useState([]);
  const [itens, setItens] = useState(evento?.cardapio_itens || []);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function load() {
      setCarregando(true);
      const { data } = await fetchFichas(unidadeAtiva);
      setFichas(data || []);
      setCarregando(false);
    }
    load();
  }, [unidadeAtiva]);

  // Calcula custo de uma ficha global
  const calcularCustoFicha = (ficha) => {
    let custoTotal = 0;
    if (ficha.fichas_ingredientes) {
      ficha.fichas_ingredientes.forEach(ing => {
        if (ing.insumos) {
          // Ex: custa 10 reais o kg (1000g). Usa 200g.
          const custoPorGram = ing.insumos.custo_unit / (ing.insumos.peso_unit || 1);
          custoTotal += custoPorGram * ing.quantidade;
        }
      });
    }
    return custoTotal;
  };

  const adicionarFicha = (ficha) => {
    if (itens.find(i => i.ficha_id === ficha.id)) return;
    const custo = calcularCustoFicha(ficha);
    const novoItem = {
      id: crypto.randomUUID(),
      ficha_id: ficha.id,
      nome: ficha.nome_receita,
      rendimento: ficha.rendimento || 1,
      custo_unidade: custo,
      quantidade_servida: evento?.capacidade || 10,
    };
    setItens([...itens, novoItem]);
  };

  const removerItem = (id) => {
    setItens(itens.filter(i => i.id !== id));
  };

  const atualizarQtd = (id, val) => {
    setItens(itens.map(i => i.id === id ? { ...i, quantidade_servida: Number(val) } : i));
  };

  const custoTotalCardapio = itens.reduce((acc, curr) => acc + (curr.custo_unidade * curr.quantidade_servida), 0);

  const salvarCardapio = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from("eventos")
      .update({ cardapio_itens: itens, total_custo_insumos: custoTotalCardapio })
      .eq("id", evento.id);
      
    if (!error) {
      onUpdate && onUpdate({ ...evento, cardapio_itens: itens, total_custo_insumos: custoTotalCardapio });
    } else {
      alert("Erro ao salvar cardápio.");
    }
    setSalvando(false);
  };

  const fichasFiltradas = fichas.filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()));

  if (carregando) return <div className="p-12 text-center text-slate-500 font-bold"><Loader2 className="animate-spin mx-auto mb-4"/>Carregando Fichas Técnicas...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Lado Esquerdo: Buscador de Fichas */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col h-[600px]">
          <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><ChefHat className="text-emerald-600"/> Catálogo Global</h2>
          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar receita..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 h-10 rounded-xl border border-slate-200 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none font-medium text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {fichasFiltradas.map(f => (
              <div key={f.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:border-slate-300 transition-colors flex justify-between items-center group">
                <div>
                  <strong className="block text-slate-800 text-sm">{f.nome_receita}</strong>
                  <span className="text-xs text-slate-500 font-medium">Custo base: R$ {calcularCustoFicha(f).toFixed(2)}</span>
                </div>
                <button onClick={() => adicionarFicha(f)} className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus size={16} />
                </button>
              </div>
            ))}
            {fichasFiltradas.length === 0 && <p className="text-center text-slate-400 text-sm mt-8 font-medium">Nenhuma receita encontrada.</p>}
          </div>
        </div>
      </div>

      {/* Lado Direito: Menu do Evento */}
      <div className="lg:col-span-2 space-y-6">
        <section className="bg-white border border-slate-200 rounded-3xl p-6 h-[600px] flex flex-col">
          <header className="flex justify-between items-end mb-6 shrink-0">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ListOrdered className="text-slate-400"/> Pratos Selecionados
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Defina as porções para calcular o custo exato do evento.</p>
            </div>
            <button onClick={salvarCardapio} disabled={salvando} className="h-10 px-5 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50">
              {salvando ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
              Salvar Cardápio
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {itens.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <ChefHat size={48} className="mb-4 opacity-50"/>
                <p className="font-bold">Nenhum prato selecionado.</p>
                <p className="text-sm font-medium">Busque no catálogo ao lado e adicione.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider">Receita</th>
                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider">Custo Unid.</th>
                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider w-32">Porções</th>
                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Custo Total</th>
                    <th className="py-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{item.nome}</td>
                      <td className="py-3 px-4 font-bold text-slate-500">R$ {item.custo_unidade.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantidade_servida} 
                          onChange={e => atualizarQtd(item.id, e.target.value)}
                          className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                        />
                      </td>
                      <td className="py-3 px-4 font-black text-red-600 text-right">
                        R$ {(item.custo_unidade * item.quantidade_servida).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => removerItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <footer className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center shrink-0">
            <span className="flex items-center gap-2 text-slate-500 font-bold text-sm">
              <Info size={16}/> O custo será injetado no DRE do evento
            </span>
            <div className="text-right">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Custo de Insumos</span>
              <strong className="text-2xl font-black text-red-700">R$ {custoTotalCardapio.toFixed(2)}</strong>
            </div>
          </footer>
        </section>
      </div>

    </div>
  );
}
