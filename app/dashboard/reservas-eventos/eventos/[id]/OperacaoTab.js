"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase";
import { fetchFichas } from "../../../../lib/operacao";
import { ChefHat, Users, Clock, Search, Plus, Trash2, CheckSquare, Loader2, Wine, LayoutTemplate, MapPin, Check } from "lucide-react";

export default function OperacaoTab({ evento, unidadeAtiva, departamento, onUpdate }) {
  const [fichas, setFichas] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  
  // Equipe State
  const [equipe, setEquipe] = useState([]);
  const [novaPessoa, setNovaPessoa] = useState({ nome: "", funcao: "", custo: "", area: departamento });
  const [salvandoEquipe, setSalvandoEquipe] = useState(false);

  useEffect(() => {
    async function loadFichas() {
      // Puxa as fichas específicas para a área (Cozinha ou Bar)
      if (departamento === 'salao') {
        setCarregando(false);
        return;
      }
      
      const { data } = await fetchFichas(unidadeAtiva, departamento === 'bar' ? 'bar' : 'cozinha');
      setFichas(data || []);
      setCarregando(false);
    }
    loadFichas();
  }, [unidadeAtiva, departamento]);

  useEffect(() => {
    async function loadEquipe() {
      const { data } = await supabase.from("evento_equipe").select("*").eq("evento_id", evento.id).eq("area", departamento);
      setEquipe(data || []);
    }
    loadEquipe();
  }, [evento.id, departamento]);

  const calcularCustoFicha = (ficha) => {
    let custoTotal = 0;
    if (ficha.fichas_ingredientes && ficha.fichas_ingredientes.length > 0) {
      ficha.fichas_ingredientes.forEach(ing => {
        if (ing.insumos) {
          const custoPorGram = ing.insumos.custo_unit / (ing.insumos.peso_unit || 1);
          custoTotal += custoPorGram * ing.quantidade;
        }
      });
    }
    return custoTotal || ficha.custo_unitario || 0;
  };

  // CARDÁPIO / ITENS
  const itensGerais = evento.cardapio_itens || [];
  const itensDoDepto = itensGerais.filter(i => i.departamento === departamento);

  const adicionarPrato = async (ficha) => {
    const novoItem = {
      id: crypto.randomUUID(),
      ficha_id: ficha.id,
      nome: ficha.nome_receita || ficha.nome,
      quantidade_servida: 1,
      custo_porcao: calcularCustoFicha(ficha),
      departamento: departamento
    };
    const novaLista = [...itensGerais, novoItem];
    
    // Atualiza otimista
    if (onUpdate) onUpdate({ cardapio_itens: novaLista });
    await supabase.from("eventos").update({ cardapio_itens: novaLista }).eq("id", evento.id);
  };

  const atualizarQtd = async (id, qtd) => {
    const novaLista = itensGerais.map(i => i.id === id ? { ...i, quantidade_servida: Number(qtd) } : i);
    if (onUpdate) onUpdate({ cardapio_itens: novaLista });
    await supabase.from("eventos").update({ cardapio_itens: novaLista }).eq("id", evento.id);
  };

  const removerPrato = async (id) => {
    const novaLista = itensGerais.filter(i => i.id !== id);
    if (onUpdate) onUpdate({ cardapio_itens: novaLista });
    await supabase.from("eventos").update({ cardapio_itens: novaLista }).eq("id", evento.id);
  };

  // EQUIPE
  const addPessoa = async () => {
    if (!novaPessoa.nome || !novaPessoa.funcao || !novaPessoa.custo) return;
    setSalvandoEquipe(true);
    
    const { data, error } = await supabase.from("evento_equipe").insert([{
      evento_id: evento.id,
      ...novaPessoa,
      custo: Number(novaPessoa.custo)
    }]).select();

    if (!error && data) {
      setEquipe([...equipe, data[0]]);
      recalcularCustoEquipeGlobal([...equipe, data[0]], "add");
    }
    setNovaPessoa({ nome: "", funcao: "", custo: "", area: departamento });
    setSalvandoEquipe(false);
  };

  const removerPessoa = async (id, custoRemovido) => {
    setSalvandoEquipe(true);
    const { error } = await supabase.from("evento_equipe").delete().eq("id", id);
    if (!error) {
      setEquipe(equipe.filter(p => p.id !== id));
      recalcularCustoEquipeGlobal(equipe.filter(p => p.id !== id), "remove", custoRemovido);
    }
    setSalvandoEquipe(false);
  };

  const recalcularCustoEquipeGlobal = async (novaEquipeLocal, tipo, valorRemovido = 0) => {
    const { data: todaEquipe } = await supabase.from("evento_equipe").select("custo").eq("evento_id", evento.id);
    const novoTotal = (todaEquipe || []).reduce((acc, p) => acc + Number(p.custo), 0);
    
    await supabase.from("eventos").update({ total_custo_equipe: novoTotal }).eq("id", evento.id);
    if (onUpdate) onUpdate({ total_custo_equipe: novoTotal });
  };

  // DETALHES (UTENSÍLIOS E HORÁRIO)
  const operacaoDetalhes = evento.operacao_detalhes || {};
  const [utensilios, setUtensilios] = useState(operacaoDetalhes[`utensilios_${departamento}`] || "");
  const [horario, setHorario] = useState(operacaoDetalhes[`horario_${departamento}`] || "");
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false);

  const salvarDetalhes = async () => {
    setSalvandoDetalhes(true);
    const novoObj = { ...operacaoDetalhes, [`utensilios_${departamento}`]: utensilios, [`horario_${departamento}`]: horario };
    const { error } = await supabase.from("eventos").update({ operacao_detalhes: novoObj }).eq("id", evento.id);
    if (!error && onUpdate) onUpdate({ operacao_detalhes: novoObj });
    setTimeout(() => setSalvandoDetalhes(false), 500);
  };

  const IconeDepto = departamento === "cozinha" ? ChefHat : departamento === "bar" ? Wine : LayoutTemplate;
  const colorMap = {
    cozinha: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', icon: 'text-orange-600', btn: 'bg-orange-600 hover:bg-orange-700' },
    bar: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', icon: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700' },
    salao: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', icon: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700' }
  };
  const theme = colorMap[departamento];

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER DEPARTAMENTAL */}
      <header className={`relative overflow-hidden ${theme.bg} ${theme.border} border-2 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm`}>
        <div className="relative z-10 flex items-center gap-6">
          <div className={`w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0`}>
            <IconeDepto className={theme.icon} size={40}/>
          </div>
          <div>
            <h2 className={`text-4xl font-black ${theme.text} uppercase tracking-tighter mb-1`}>
              {departamento}
            </h2>
            <p className={`text-sm font-bold ${theme.icon} opacity-80 uppercase tracking-widest`}>
              Painel de Ordem de Serviço
            </p>
          </div>
        </div>
        <button className={`relative z-10 ${theme.btn} text-white px-8 py-4 rounded-2xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-3`}>
          🖨️ Imprimir OS do {departamento}
        </button>
      </header>

      <div className={`grid grid-cols-1 ${departamento === 'salao' ? 'lg:grid-cols-2' : 'lg:grid-cols-12'} gap-8`}>
        
        {/* COLUNA ESQUERDA: Equipe e Logística */}
        <div className={`${departamento === 'salao' ? 'col-span-1' : 'lg:col-span-5'} space-y-8`}>
          
          <section className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Users size={20} className="text-slate-600"/></div>
              Equipe Escalada
            </h3>
            
            <div className="flex gap-2 mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <input type="text" placeholder="Nome do colaborador" value={novaPessoa.nome} onChange={e => setNovaPessoa({...novaPessoa, nome: e.target.value})} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-slate-400" />
              <input type="text" placeholder="Função" value={novaPessoa.funcao} onChange={e => setNovaPessoa({...novaPessoa, funcao: e.target.value})} className="w-1/3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-slate-400" />
              <input type="number" placeholder="Custo R$" value={novaPessoa.custo} onChange={e => setNovaPessoa({...novaPessoa, custo: e.target.value})} className="w-28 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:border-slate-400" />
              <button onClick={addPessoa} disabled={salvandoEquipe} className={`w-12 rounded-xl flex items-center justify-center text-white ${theme.btn} disabled:opacity-50`}><Plus size={20}/></button>
            </div>

            <ul className="space-y-3">
              {equipe.length === 0 && <p className="text-slate-400 font-medium text-center py-6">Nenhum profissional escalado.</p>}
              {equipe.map(p => (
                <li key={p.id} className="flex justify-between items-center p-4 border border-slate-100 bg-white shadow-sm rounded-2xl group hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                      {p.nome.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <strong className="block text-slate-800 text-sm">{p.nome}</strong>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.funcao}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-slate-900 bg-slate-50 px-3 py-1 rounded-lg text-sm">R$ {Number(p.custo).toFixed(2)}</span>
                    <button onClick={() => removerPessoa(p.id, p.custo)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><CheckSquare size={20} className="text-slate-600"/></div>
                 Logística & Setup
               </h3>
               <button onClick={salvarDetalhes} disabled={salvandoDetalhes} className={`text-xs font-black px-4 py-2 rounded-xl text-white transition-all flex items-center gap-2 ${salvandoDetalhes ? 'bg-emerald-500' : theme.btn}`}>
                 {salvandoDetalhes ? <><Check size={14}/> Salvo!</> : 'Salvar Textos'}
               </button>
             </div>
             
             <div className="space-y-6">
               <div>
                 <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Equipamentos e Utensílios</label>
                 <textarea value={utensilios} onChange={e => setUtensilios(e.target.value)} placeholder="O que este setor precisa levar? Ex: 5 rechauds, 20 taças, pratos..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-medium text-sm min-h-[120px] outline-none focus:border-slate-400 resize-none transition-colors" />
               </div>
               <div>
                 <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Horários / Cronograma</label>
                 <textarea value={horario} onChange={e => setHorario(e.target.value)} placeholder="Ex: Chegada às 18h, preparo às 19h..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-medium text-sm min-h-[120px] outline-none focus:border-slate-400 resize-none transition-colors" />
               </div>
             </div>
          </section>

        </div>

        {/* COLUNA DIREITA: Cardápio / Produtos (Oculta se for Salão) */}
        {departamento !== 'salao' && (
          <div className="lg:col-span-7">
             <section className="bg-slate-900 rounded-[2rem] p-8 shadow-xl flex flex-col h-full border border-slate-800">
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center"><IconeDepto size={20} className="text-white"/></div>
                  Menu Selecionado
                </h3>
                
                {/* Busca */}
                <div className="relative mb-8">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                  <input 
                    type="text" 
                    placeholder="Buscar no catálogo do restaurante..." 
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="w-full bg-slate-800 border-none text-white rounded-2xl pl-14 pr-4 py-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500" 
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-[600px]">
                  {/* Pratos Selecionados */}
                  <div className="bg-slate-800/50 rounded-3xl p-6 flex flex-col overflow-hidden border border-slate-800">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Itens Inclusos na OS</h4>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {itensDoDepto.length === 0 && <p className="text-slate-500 font-medium text-sm text-center py-10">Nenhum item na ordem de serviço.</p>}
                      {itensDoDepto.map(item => (
                        <div key={item.id} className="p-4 border border-slate-700 bg-slate-800 rounded-2xl group flex flex-col gap-3">
                          <div className="flex justify-between items-start gap-2">
                            <strong className="block text-white text-sm leading-tight">{item.nome}</strong>
                            <button onClick={() => removerPrato(item.id)} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={16}/></button>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo: R$ {Number(item.custo_porcao).toFixed(2)}</span>
                            <div className="flex items-center gap-2 bg-slate-900 rounded-xl p-1 border border-slate-700">
                              <span className="text-[10px] font-bold text-slate-500 uppercase ml-2">Qtd</span>
                              <input 
                                type="number" 
                                value={item.quantidade_servida} 
                                onChange={(e) => atualizarQtd(item.id, e.target.value)}
                                className="w-14 bg-slate-800 border-none rounded-lg px-2 py-1 text-center font-bold text-white outline-none focus:bg-slate-700" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Catálogo para adicionar */}
                  <div className="flex flex-col overflow-hidden">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Catálogo Oficial</h4>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                      {carregando ? (
                        <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-slate-500" size={32} /></div>
                      ) : (
                        fichas
                          .filter(f => !busca || (f.nome_receita || f.nome).toLowerCase().includes(busca.toLowerCase()))
                          .filter(f => !itensDoDepto.find(i => i.ficha_id === f.id))
                          .map(ficha => (
                            <div key={ficha.id} className="flex justify-between items-center p-4 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-colors cursor-pointer group" onClick={() => adicionarPrato(ficha)}>
                              <div className="min-w-0 pr-4">
                                <strong className="block text-slate-200 text-sm truncate">{ficha.nome_receita || ficha.nome}</strong>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Base: R$ {Number(calcularCustoFicha(ficha)).toFixed(2)}</span>
                              </div>
                              <button className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                                <Plus size={16}/>
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
             </section>
          </div>
        )}
      </div>
    </div>
  );
}
