"use client";

import { useState, useEffect } from "react";
import { fetchFichas } from "../../../../lib/operacao";
import { ShoppingCart, CheckSquare, Square, Printer, Loader2 } from "lucide-react";

export default function ComprasTab({ evento, unidadeAtiva }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function compilarLista() {
      if (!evento || !evento.cardapio_itens || evento.cardapio_itens.length === 0) {
        setLista([]);
        setCarregando(false);
        return;
      }
      
      setCarregando(true);
      const { data: fichas } = await fetchFichas(unidadeAtiva);
      if (!fichas) {
        setCarregando(false);
        return;
      }

      // Agrupar insumos
      const insumosAgrupados = {};

      evento.cardapio_itens.forEach(itemCardapio => {
        const fichaOrigem = fichas.find(f => f.id === itemCardapio.ficha_id);
        if (fichaOrigem && fichaOrigem.fichas_ingredientes) {
          fichaOrigem.fichas_ingredientes.forEach(ing => {
            if (ing.insumos) {
              const idInsumo = ing.insumo_id;
              // Quantidade total necessária = qtd na ficha * porções vendidas
              const qtdTotalGramas = ing.quantidade * itemCardapio.quantidade_servida;
              
              if (!insumosAgrupados[idInsumo]) {
                insumosAgrupados[idInsumo] = {
                  id: idInsumo,
                  nome: ing.insumos.nome,
                  unidade: ing.insumos.unidade || "g",
                  quantidade_total: 0,
                  custo_unitario: ing.insumos.custo_unit / (ing.insumos.peso_unit || 1)
                };
              }
              insumosAgrupados[idInsumo].quantidade_total += qtdTotalGramas;
            }
          });
        }
      });

      const listaFinal = Object.values(insumosAgrupados).sort((a,b) => a.nome.localeCompare(b.nome));
      setLista(listaFinal);
      setCarregando(false);
    }

    compilarLista();
  }, [evento, unidadeAtiva]);

  const handlePrint = () => {
    window.print();
  };

  if (carregando) return <div className="p-12 text-center text-slate-500 font-bold"><Loader2 className="animate-spin mx-auto mb-4"/>Montando Lista de Compras...</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden print:border-none print:shadow-none">
      <header className="p-6 border-b border-slate-200 flex justify-between items-end bg-slate-50">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2"><ShoppingCart className="text-emerald-600"/> Lista de Compras</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Consolidação exata dos insumos necessários para as porções do cardápio.</p>
        </div>
        <button onClick={handlePrint} className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold flex items-center gap-2 hover:bg-slate-100 print:hidden">
          <Printer size={16}/> Imprimir Lista
        </button>
      </header>

      {lista.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <ShoppingCart size={48} className="mx-auto mb-4 opacity-50"/>
          <p className="font-bold">Nenhum insumo encontrado.</p>
          <p className="text-sm">Adicione pratos na aba Cardápio primeiro.</p>
        </div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-3 px-6 w-12 print:hidden"></th>
              <th className="py-3 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Insumo</th>
              <th className="py-3 px-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Quantidade a Comprar</th>
              <th className="py-3 px-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right print:hidden">Custo Estimado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map(item => {
              // Converte gramas para Kg se for muito grande
              let displayQtd = item.quantidade_total;
              let displayUnid = item.unidade;
              
              if ((item.unidade === 'g' || item.unidade === 'ml') && item.quantidade_total >= 1000) {
                displayQtd = item.quantidade_total / 1000;
                displayUnid = item.unidade === 'g' ? 'kg' : 'L';
              }

              const custoFinal = item.quantidade_total * item.custo_unitario;

              return (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 print:hidden">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer" />
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-800">{item.nome}</td>
                  <td className="py-4 px-6 text-right">
                    <span className="inline-flex px-3 py-1 bg-slate-100 text-slate-800 font-black rounded-lg">
                      {displayQtd.toFixed(2).replace('.00', '')} {displayUnid}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-slate-400 print:hidden">
                    R$ {custoFinal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
