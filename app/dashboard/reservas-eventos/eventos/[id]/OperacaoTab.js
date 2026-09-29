"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../../../lib/supabase";
import { fetchFichas } from "../../../../../lib/operacao";
import { ChefHat, Users, Clock, Search, Plus, Trash2, CheckSquare, Loader2, Wine, LayoutTemplate } from "lucide-react";

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
      const { data } = await fetchFichas(unidadeAtiva);
      setFichas(data || []);
      setCarregando(false);
    }
    loadFichas();
  }, [unidadeAtiva]);

  useEffect(() => {
    async function loadEquipe() {
      const { data } = await supabase.from("evento_equipe").select("*").eq("evento_id", evento.id).eq("area", departamento);
      setEquipe(data || []);
    }
    loadEquipe();
  }, [evento.id, departamento]);

  // CARDÁPIO / ITENS
  const itensGerais = evento.cardapio_itens || [];
  const itensDoDepto = itensGerais.filter(i => i.departamento === departamento);

  const adicionarPrato = async (ficha) => {
    const novoItem = {
      id: crypto.randomUUID(),
      ficha_id: ficha.id,
      nome: ficha.nome,
      quantidade_servida: 1,
      custo_porcao: ficha.custo_unitario || 0,
      departamento: departamento
    };
    const novaLista = [...itensGerais, novoItem];
    await salvarCardapio(novaLista);
  };

  const atualizarQtd = async (id, qtd) => {
    const novaLista = itensGerais.map(i => i.id === id ? { ...i, quantidade_servida: Number(qtd) } : i);
    await salvarCardapio(novaLista);
  };

  const removerPrato = async (id) => {
    const novaLista = itensGerais.filter(i => i.id !== id);
    await salvarCardapio(novaLista);
  };

  const salvarCardapio = async (novaLista) => {
    const { error } = await supabase.from("eventos").update({ cardapio_itens: novaLista }).eq("id", evento.id);
    if (!error && onUpdate) onUpdate({ cardapio_itens: novaLista });
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
    // Busca a equipe toda do evento para somar
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
    setSalvandoDetalhes(false);
  };

  const IconeDepto = departamento === "cozinha" ? ChefHat : departamento === "bar" ? Wine : LayoutTemplate;
  const corDepto = departamento === "cozinha" ? "emerald" : departamento === "bar" ? "sky" : "indigo";

  return (
    <div className="space-y-6">
      <header className={`bg-${corDepto}-50 border border-${corDepto}-200 p-6 rounded-3xl flex items-center justify-between`}>
        <div>
          <h2 className={`text-2xl font-black text-${corDepto}-900 flex items-center gap-3 uppercase tracking-tight`}>
            <IconeDepto className={`text-${corDepto}-600`} size={28}/> 
            Operação: {departamento}
          </h2>
          <p className={`text-${corDepto}-700 font-medium mt-1`}>Painel de controle isolado para a equipe de {departamento}</p>
        </div>
        <button className={`bg-${corDepto}-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-${corDepto}-800 transition-colors`}>
          🖨️ Imprimir Ordem de Serviço
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUNA ESQUERDA: Equipe e Detalhes */}
        <div className="space-y-6">
          
          <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Users className="text-slate-400"/> Equipe do Setor</h3>
            
            <div className="flex gap-2 mb-6">
              <input type="text" placeholder="Nome" value={novaPessoa.nome} onChange={e => setNovaPessoa({...novaPessoa, nome: e.target.value})} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium outline-none focus:border-slate-400" />
              <input type="text" placeholder="Função" value={novaPessoa.funcao} onChange={e => setNovaPessoa({...novaPessoa, funcao: e.target.value})} className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium outline-none focus:border-slate-400" />
              <input type="number" placeholder="Custo R$" value={novaPessoa.custo} onChange={e => setNovaPessoa({...novaPessoa, custo: e.target.value})} className="w-1/4 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-slate-400" />
              <button onClick={addPessoa} disabled={salvandoEquipe} className="bg-slate-900 text-white w-12 rounded-xl flex items-center justify-center hover:bg-slate-800 disabled:opacity-50"><Plus size={18}/></button>
            </div>

            <ul className="space-y-2">
              {equipe.length === 0 && <p className="text-slate-400 font-medium text-center py-4">Nenhuma equipe escalada</p>}
              {equipe.map(p => (
                <li key={p.id} className="flex justify-between items-center p-3 border border-slate-100 bg-slate-50 rounded-xl">
                  <div>
                    <strong className="block text-slate-800">{p.nome}</strong>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{p.funcao}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-emerald-600">R$ {Number(p.custo).toFixed(2)}</span>
                    <button onClick={() => removerPessoa(p.id, p.custo)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><CheckSquare className="text-slate-400"/> Utensílios & Logística</h3>
               <button onClick={salvarDetalhes} disabled={salvandoDetalhes} className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-200">Salvar Textos</button>
             </div>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Equipamentos e Utensílios a levar</label>
                 <textarea value={utensilios} onChange={e => setUtensilios(e.target.value)} placeholder="Ex: 5 rechauds, 20 taças..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm min-h-[100px] outline-none focus:border-slate-400" />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cronograma e Horários</label>
                 <textarea value={horario} onChange={e => setHorario(e.target.value)} placeholder="Ex: Chegada às 18h, liberar buffet às 20h..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm min-h-[100px] outline-none focus:border-slate-400" />
               </div>
             </div>
          </section>

        </div>

        {/* COLUNA DIREITA: Cardápio / Produtos */}
        <div className="space-y-6">
           <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-full">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><ChefHat className="text-slate-400"/> Catálogo & Cardápio</h3>
              
              <div className="relative mb-6">
                <Search className="absolute left-4 top-3 text-slate-400" size={18}/>
                <input 
                  type="text" 
                  placeholder="Buscar ficha técnica..." 
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 font-medium outline-none focus:border-slate-400" 
                />
              </div>

              {/* Lista dos pratos selecionados */}
              <div className="mb-6 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pratos Selecionados</h4>
                {itensDoDepto.length === 0 && <p className="text-slate-400 font-medium text-sm">Nenhum item selecionado para este setor.</p>}
                {itensDoDepto.map(item => (
                  <div key={item.id} className={`flex items-center gap-4 p-3 border border-${corDepto}-200 bg-${corDepto}-50 rounded-xl`}>
                    <div className="flex-1 min-w-0">
                      <strong className={`block text-${corDepto}-900 truncate`}>{item.nome}</strong>
                      <span className={`text-xs font-bold text-${corDepto}-600`}>Porção: R$ {Number(item.custo_porcao).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={item.quantidade_servida} 
                        onChange={(e) => atualizarQtd(item.id, e.target.value)}
                        className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold outline-none focus:border-slate-500" 
                      />
                      <span className={`text-xs font-bold text-${corDepto}-700`}>Qtd</span>
                    </div>
                    <button onClick={() => removerPrato(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>

              <div className="h-px bg-slate-100 w-full mb-6"></div>

              {/* Catálogo para adicionar */}
              <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-white py-1">Adicionar ao Cardápio</h4>
                {carregando ? (
                  <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                ) : (
                  fichas
                    .filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()))
                    // Impede de adicionar o que já foi adicionado
                    .filter(f => !itensDoDepto.find(i => i.ficha_id === f.id))
                    .map(ficha => (
                      <div key={ficha.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                        <div>
                          <strong className="block text-slate-800 text-sm">{ficha.nome}</strong>
                          <span className="text-xs text-slate-500 font-medium">Custo base: R$ {Number(ficha.custo_unitario || 0).toFixed(2)}</span>
                        </div>
                        <button onClick={() => adicionarPrato(ficha)} className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 shrink-0">
                          <Plus size={16}/>
                        </button>
                      </div>
                    ))
                )}
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
