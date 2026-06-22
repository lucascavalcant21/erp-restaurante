"use client";

import { useState, useEffect, useCallback } from "react";
import { Search as SearchIcon, MapPin, Clock, Users, Plus, Edit3, Trash2, Check, X, Truck, Settings, Motorbike, PackageOpen, PackageCheck, Route, Map } from "lucide-react";
import { Field, TextInput, Select, NumberInput } from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { 
  fetchDeliveryConfigs, salvarDeliveryConfigs, 
  fetchMotoboys, salvarMotoboy, removerMotoboy 
} from "../../lib/delivery";
// Reutilizando as buscas de vendas do KDS para unificar a base e acabar com os bugs de sumiço de pedidos
import { fetchPedidosAtivos } from "../../lib/kds";

function horaStr(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function DeliveryKanbanPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");
  const [abaConfig, setAbaConfig] = useState(false); // Alterna entre Kanban e Configurações

  // Kanban States
  const [pedidos, setPedidos] = useState([]);
  const [busca, setBusca] = useState("");
  
  // Modal Motoboys & Despacho
  const [motoboys, setMotoboys] = useState([]);
  const [modalDespacho, setModalDespacho] = useState(null); // Recebe o pedido a ser despachado

  // Configs State
  const [configs, setConfigs] = useState({
    raio_km: 5, taxa_base: 5, taxa_por_km: 1.5,
    tempo_min: 30, tempo_max: 50, status_loja: "aberto"
  });

  const showToast = useCallback((msg) => { 
    setToast(msg); setTimeout(() => setToast(""), 3000); 
  }, []);

  const carregarTudo = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    
    const [confRes, mbRes, pedRes] = await Promise.all([
      fetchDeliveryConfigs(unidadeAtiva),
      fetchMotoboys(unidadeAtiva),
      fetchPedidosAtivos(unidadeAtiva)
    ]);
    
    if (confRes.data) {
      setConfigs({
        raio_km: Number(confRes.data.raio_km) || 5,
        taxa_base: Number(confRes.data.taxa_base) || 5,
        taxa_por_km: Number(confRes.data.taxa_por_km) || 1.5,
        tempo_min: Number(confRes.data.tempo_min) || 30,
        tempo_max: Number(confRes.data.tempo_max) || 50,
        status_loja: confRes.data.status_loja || "aberto"
      });
    }
    
    setMotoboys(mbRes.data || []);

    // Filtramos apenas pedidos que parecem ser de Delivery (tem cliente/endereço ou estão sem mesa específica)
    // No sistema atual, Delivery tem nome de cliente ou começa com DELIVERY
    if (pedRes.data) {
       const entregas = pedRes.data.filter(p => p.cliente || (p.mesa && String(p.mesa).toUpperCase().includes("DELIVERY")));
       
       // Adiciona um status local "estagio" (cozinha, rampa, rota, entregue) baseado no status real dos itens
       const mapEstagios = entregas.map(p => {
         const itens = p.venda_itens || [];
         const todosProntos = itens.length > 0 && itens.every(i => i.status_preparo === 'entregue' || i.status_preparo === 'pronto');
         
         // Mock: Atribuímos um estágio visual se não existir no banco para a demonstração do Kanban
         let estagio = p.estagio_delivery || (todosProntos ? "rampa" : "cozinha");
         return { ...p, estagio };
       });

       setPedidos(mapEstagios);
    }
    
    if (!isSilent) setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => { 
    carregarTudo(); 
    const t = setInterval(() => carregarTudo(true), 10000);
    return () => clearInterval(t);
  }, [carregarTudo]);

  // AÇÕES DO KANBAN
  async function moverPedido(pedidoId, novoEstagio, motoboyNome = null) {
    // Atualiza otimista
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estagio: novoEstagio, motoboy: motoboyNome || p.motoboy } : p));
    
    if (novoEstagio === "rota") {
       showToast(`Pedido saiu para entrega com ${motoboyNome}!`);
       setModalDespacho(null);
    } else if (novoEstagio === "entregue") {
       showToast("Pedido finalizado com sucesso.");
       setTimeout(() => setPedidos(prev => prev.filter(p => p.id !== pedidoId)), 2000); // Some depois de 2s
    }

    // Numa versão completa, salvaríamos o 'estagio' na tabela 'vendas'.
  }

  // AÇÕES DE CONFIGURAÇÃO
  const handleConfigChange = (key, val) => setConfigs(prev => ({ ...prev, [key]: val }));
  
  const handleSalvarConfigs = async () => {
    setSalvando(true);
    const { error } = await salvarDeliveryConfigs(unidadeAtiva, configs);
    if (!error) showToast("Regras atualizadas!");
    setSalvando(false);
  };

  // ------------------------------------------------------------------
  // RENDER: CONFIGURAÇÕES (DRAWER/MODAL)
  // ------------------------------------------------------------------
  if (abaConfig) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 relative overflow-hidden">
        {toast && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-800 text-white px-6 py-3 rounded-full font-bold">{toast}</div>}
        
        <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
           <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Settings className="text-blue-600"/> Ajustes do Delivery</h1>
              <p className="text-sm font-bold text-slate-500 mt-1">Taxas, Zonas de Entrega e Motoboys</p>
           </div>
           <button onClick={() => setAbaConfig(false)} className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-slate-900 transition-colors">
              <ArrowLeft size={18} /> Voltar para Operação
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 hide-scrollbar">
           <div className="max-w-4xl mx-auto space-y-8">
              {/* Regras Gerais */}
              <div className="bg-white p-8 rounded-[24px] shadow-sm border border-slate-200">
                 <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Map size={24} className="text-teal-500" /> Regras de Raio e Taxa</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Field label="Raio de Atendimento (KM)">
                      <NumberInput value={configs.raio_km} onChange={(e) => handleConfigChange("raio_km", Number(e.target.value))} />
                    </Field>
                    <Field label="Taxa Base Fixa (R$)">
                      <NumberInput value={configs.taxa_base} onChange={(e) => handleConfigChange("taxa_base", Number(e.target.value))} />
                    </Field>
                    <Field label="Adicional por KM (R$)">
                      <NumberInput value={configs.taxa_por_km} onChange={(e) => handleConfigChange("taxa_por_km", Number(e.target.value))} />
                    </Field>
                 </div>
                 <button onClick={handleSalvarConfigs} disabled={salvando} className="w-full md:w-auto px-8 py-4 bg-teal-500 hover:bg-teal-600 text-white font-black rounded-xl">
                    {salvando ? "Salvando..." : "Salvar Regras"}
                 </button>
              </div>

              {/* Tabela de Motoboys Simplificada pro Walkthrough */}
              <div className="bg-white p-8 rounded-[24px] shadow-sm border border-slate-200">
                 <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Motorbike size={24} className="text-orange-500" /> Frota de Entregadores</h2>
                 
                 {motoboys.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 font-bold text-slate-400">Nenhum motoboy cadastrado.</div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {motoboys.map(m => (
                          <div key={m.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-slate-400 shadow-sm">{m.nome[0].toUpperCase()}</div>
                                <div>
                                   <p className="font-bold text-slate-800">{m.nome}</p>
                                   <p className="text-xs font-bold text-slate-500">{m.placa || "Sem Placa"} · {m.telefone}</p>
                                </div>
                             </div>
                             <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${m.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{m.status}</span>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // RENDER: KANBAN DE DESPACHO (OPERAÇÃO)
  // ------------------------------------------------------------------
  const colCozinha = pedidos.filter(p => p.estagio === "cozinha");
  const colRampa = pedidos.filter(p => p.estagio === "rampa");
  const colRota = pedidos.filter(p => p.estagio === "rota");
  const colEntregue = pedidos.filter(p => p.estagio === "entregue");

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-100 font-sans overflow-hidden relative">
      {toast && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl font-black text-sm animate-bounce">{toast}</div>}

      {/* HEADER OPERACIONAL */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20 shadow-sm">
               <Truck size={24} className="text-blue-600" />
            </div>
            <div>
               <h1 className="text-2xl font-black text-slate-800 tracking-tight">Expedição Delivery</h1>
               <p className="text-sm font-bold text-slate-500">Painel de controle de envios</p>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
               <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="text" placeholder="Buscar pedido ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-12 pr-4 py-3 bg-slate-100 rounded-xl text-slate-800 font-bold text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
            </div>
            <button onClick={() => setAbaConfig(true)} className="px-5 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 font-black rounded-xl transition-all shadow-sm flex items-center gap-2">
               <Settings size={18} /> Ajustes
            </button>
         </div>
      </div>

      {/* BOARD KANBAN */}
      <div className="flex-1 flex overflow-x-auto p-6 gap-6 hide-scrollbar items-start">
         
         {/* COLUNA 1: COZINHA (Preparando) */}
         <div className="flex-shrink-0 w-80 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 px-2">
               <h2 className="font-black text-slate-700 uppercase tracking-widest text-sm flex items-center gap-2">
                  <Flame size={18} className="text-orange-500" /> Na Cozinha
               </h2>
               <span className="bg-slate-200 text-slate-600 font-black px-3 py-1 rounded-full text-xs">{colCozinha.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar">
               {colCozinha.map(p => (
                 <div key={p.id} className="bg-white p-5 rounded-[20px] shadow-sm border-2 border-slate-100 border-l-4 border-l-orange-500 opacity-80 pointer-events-none">
                    <div className="flex justify-between items-start mb-2">
                       <span className="font-black text-slate-800">#{p.id.slice(0,4).toUpperCase()}</span>
                       <span className="text-xs font-bold text-slate-400">{horaStr(p.created_at)}</span>
                    </div>
                    <p className="font-bold text-slate-600 text-sm mb-3">👤 {p.cliente || "Cliente Delivery"}</p>
                    <div className="bg-orange-50 text-orange-600 font-bold text-[10px] uppercase tracking-widest p-2 rounded-lg text-center animate-pulse">
                       Aguardando KDS
                    </div>
                 </div>
               ))}
               {colCozinha.length === 0 && <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-[20px] font-bold text-slate-400 text-sm">Vazio</div>}
            </div>
         </div>

         {/* COLUNA 2: RAMPA (Pronto / Esperando Despacho) */}
         <div className="flex-shrink-0 w-80 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 px-2">
               <h2 className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                  <PackageOpen size={18} className="text-emerald-500" /> Na Rampa
               </h2>
               <span className="bg-emerald-100 text-emerald-700 font-black px-3 py-1 rounded-full text-xs">{colRampa.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar">
               {colRampa.map(p => (
                 <div key={p.id} className="bg-white p-5 rounded-[20px] shadow-[0_10px_30px_rgba(16,185,129,0.15)] border-2 border-emerald-400 transform hover:-translate-y-1 transition-transform">
                    <div className="flex justify-between items-start mb-2">
                       <span className="font-black text-slate-800 text-lg">#{p.id.slice(0,4).toUpperCase()}</span>
                       <span className="text-xs font-bold text-slate-400">{horaStr(p.created_at)}</span>
                    </div>
                    <p className="font-bold text-slate-800 text-sm mb-1">👤 {p.cliente || "Cliente Delivery"}</p>
                    <p className="font-medium text-slate-500 text-xs mb-4 line-clamp-2">📍 {p.observacao || "Endereço não informado"}</p>
                    
                    <button onClick={() => setModalDespacho(p)} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2">
                       <Motorbike size={16} /> Despachar
                    </button>
                 </div>
               ))}
               {colRampa.length === 0 && <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-[20px] font-bold text-slate-400 text-sm">Rampa Livre</div>}
            </div>
         </div>

         {/* COLUNA 3: EM ROTA */}
         <div className="flex-shrink-0 w-80 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 px-2">
               <h2 className="font-black text-slate-700 uppercase tracking-widest text-sm flex items-center gap-2">
                  <Route size={18} className="text-blue-500" /> Em Rota
               </h2>
               <span className="bg-slate-200 text-slate-600 font-black px-3 py-1 rounded-full text-xs">{colRota.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar">
               {colRota.map(p => (
                 <div key={p.id} className="bg-white p-5 rounded-[20px] shadow-sm border-2 border-slate-200 border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start mb-2">
                       <span className="font-black text-slate-800">#{p.id.slice(0,4).toUpperCase()}</span>
                       <span className="text-xs font-bold text-slate-400">{horaStr(p.created_at)}</span>
                    </div>
                    <p className="font-bold text-slate-600 text-sm mb-2">👤 {p.cliente || "Cliente"}</p>
                    <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg text-blue-700 text-xs font-black uppercase tracking-widest mb-3">
                       <Motorbike size={14}/> {p.motoboy || "Motoboy"}
                    </div>
                    
                    <button onClick={() => moverPedido(p.id, "entregue")} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2">
                       <Check size={14} /> Marcar Entregue
                    </button>
                 </div>
               ))}
               {colRota.length === 0 && <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-[20px] font-bold text-slate-400 text-sm">Nenhum motoboy na rua</div>}
            </div>
         </div>

         {/* COLUNA 4: ENTREGUES */}
         <div className="flex-shrink-0 w-80 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 px-2">
               <h2 className="font-black text-slate-400 uppercase tracking-widest text-sm flex items-center gap-2">
                  <PackageCheck size={18} /> Entregues
               </h2>
               <span className="bg-slate-200 text-slate-400 font-black px-3 py-1 rounded-full text-xs">{colEntregue.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar">
               {colEntregue.map(p => (
                 <div key={p.id} className="bg-slate-200 p-4 rounded-[16px] border border-slate-300 opacity-60">
                    <div className="flex justify-between items-start mb-1">
                       <span className="font-bold text-slate-500 text-sm">#{p.id.slice(0,4).toUpperCase()}</span>
                       <Check size={14} className="text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-500 text-xs">👤 {p.cliente || "Cliente"}</p>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* MODAL DE DESPACHO */}
      {modalDespacho && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Despachar Pedido</p>
                   <h2 className="font-black text-3xl text-slate-800 tracking-tight">#{modalDespacho.id.slice(0,4).toUpperCase()}</h2>
                </div>
                <button onClick={() => setModalDespacho(null)} className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"><X size={20}/></button>
             </div>

             <div className="p-8">
                <h3 className="font-black text-lg text-slate-800 mb-4">Selecione o Entregador</h3>
                
                <div className="space-y-3 mb-8 max-h-60 overflow-y-auto hide-scrollbar pr-2">
                   {motoboys.filter(m => m.status === 'online').length === 0 ? (
                      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                         <p className="font-bold text-rose-600 mb-1">Nenhum motoboy Online!</p>
                         <p className="text-xs text-rose-500">Vá em Configurações para ativar os motoboys.</p>
                      </div>
                   ) : (
                      motoboys.filter(m => m.status === 'online').map(mb => (
                         <button 
                            key={mb.id} 
                            onClick={() => moverPedido(modalDespacho.id, "rota", mb.nome)}
                            className="w-full flex items-center justify-between p-4 bg-white border-2 border-slate-100 hover:border-blue-500 rounded-2xl transition-all group"
                         >
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                  <Motorbike size={20} />
                               </div>
                               <div className="text-left">
                                  <p className="font-black text-slate-800 text-lg">{mb.nome}</p>
                                  <p className="text-xs font-bold text-slate-400">{mb.placa || "Placa não informada"}</p>
                               </div>
                            </div>
                            <span className="font-bold text-blue-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity">Selecionar</span>
                         </button>
                      ))
                   )}
                </div>

                {/* Opção Rápida: Cliente Retirou */}
                <button 
                  onClick={() => moverPedido(modalDespacho.id, "entregue", "Retirada Balcão")}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm uppercase tracking-widest"
                >
                   Cliente retirou no balcão
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
