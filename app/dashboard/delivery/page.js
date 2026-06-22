"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Search as SearchIcon, MapPin, Map, Clock, Users, Plus, Edit3, Trash2, Motorbike, Check, X } from "lucide-react";
import { Modal, Field, TextInput, Select, NumberInput, Toast, Btn } from "../../components/ui";
import { fmtBRL } from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { 
  fetchDeliveryConfigs, salvarDeliveryConfigs, 
  fetchMotoboys, salvarMotoboy, removerMotoboy 
} from "../../lib/delivery";

const DeliveryMap = dynamic(() => import("./MapComponent"), { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 font-bold">Carregando mapa...</div> });

export default function DeliverySettingsPage() {
  const { unidadeAtiva } = useERP();
  const [aba, setAba] = useState("mapa"); // mapa, horarios, motoboys

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");

  // Configs State
  const [configs, setConfigs] = useState({
    raio_km: 5, taxa_base: 5, taxa_por_km: 1.5,
    tempo_min: 30, tempo_max: 50, status_loja: "aberto"
  });

  // Motoboys State
  const [motoboys, setMotoboys] = useState([]);
  const [modalMotoboy, setModalMotoboy] = useState(false);
  const [motoboyEdit, setMotoboyEdit] = useState(null);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [confRes, mbRes] = await Promise.all([
      fetchDeliveryConfigs(unidadeAtiva),
      fetchMotoboys(unidadeAtiva)
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
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  // Handlers
  const handleConfigChange = (key, val) => {
    setConfigs(prev => ({ ...prev, [key]: val }));
  };

  const handleSalvarConfigs = async () => {
    setSalvando(true);
    const { error } = await salvarDeliveryConfigs(unidadeAtiva, configs);
    if (!error) showToast("Configurações salvas com sucesso!");
    else showToast("Erro ao salvar configurações.");
    setSalvando(false);
  };

  const handleMudarStatusLoja = async (novoStatus) => {
    handleConfigChange("status_loja", novoStatus);
    const { error } = await salvarDeliveryConfigs(unidadeAtiva, { ...configs, status_loja: novoStatus });
    if (!error) showToast(`Loja marcada como ${novoStatus}!`);
  };

  const handleAbrirModalMotoboy = (mb = null) => {
    setMotoboyEdit(mb || { nome: "", telefone: "", placa: "", status: "offline" });
    setModalMotoboy(true);
  };

  const handleSalvarMotoboy = async () => {
    setSalvando(true);
    const { error } = await salvarMotoboy(unidadeAtiva, motoboyEdit);
    if (!error) {
      showToast(motoboyEdit.id ? "Motoboy atualizado!" : "Motoboy cadastrado!");
      setModalMotoboy(false);
      carregar();
    } else {
      showToast("Erro ao salvar motoboy.");
    }
    setSalvando(false);
  };

  const handleDeleteMotoboy = async (id) => {
    if (!confirm("Tem certeza que deseja remover este entregador?")) return;
    const { error } = await removerMotoboy(id);
    if (!error) {
      showToast("Motoboy removido!");
      carregar();
    } else {
      showToast("Erro ao remover.");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 gap-4 overflow-hidden relative p-4">
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl font-bold text-sm transition-all">
          {toast}
        </div>
      )}

      {/* HEADER E TABS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5 flex-shrink-0">
         <div className="flex justify-between items-center">
            <div>
               <h1 className="text-2xl font-black text-slate-800 tracking-tight">Delivery</h1>
               <p className="text-sm font-semibold text-slate-500 mt-1">Configurações de área de entrega, taxas e motoboys</p>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-[16px]">
               <button onClick={() => handleMudarStatusLoja("aberto")} className={`px-4 py-2 font-bold text-sm rounded-[12px] transition-all ${configs.status_loja === "aberto" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Aberto</button>
               <button onClick={() => handleMudarStatusLoja("fechado")} className={`px-4 py-2 font-bold text-sm rounded-[12px] transition-all ${configs.status_loja === "fechado" ? "bg-red-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Fechado</button>
            </div>
         </div>

         <div className="flex gap-2">
            {[
              { id: "mapa", label: "Área e Taxas", icon: Map },
              { id: "horarios", label: "Horários de Funcionamento", icon: Clock },
              { id: "motoboys", label: "Motoboys", icon: Users },
            ].map(t => (
               <button key={t.id} onClick={() => setAba(t.id)} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[14px] transition-all ${aba === t.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <t.icon size={18} /> {t.label}
               </button>
            ))}
         </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
         {loading ? (
            <div className="h-full flex items-center justify-center font-bold text-slate-400">Carregando dados...</div>
         ) : (
            <>
              {aba === "mapa" && (
                  <div className="flex gap-4 h-full">
                    {/* Painel de Configurações */}
                    <div className="w-[400px] bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-y-auto hide-scrollbar flex-shrink-0">
                        <h2 className="font-black text-lg text-slate-800 tracking-tight mb-6">Regras de Entrega</h2>
                        
                        <div className="space-y-5">
                          <Field label="Raio Máximo de Entrega (KM)">
                            <NumberInput value={configs.raio_km} onChange={(e) => handleConfigChange("raio_km", Number(e.target.value))} min={1} max={50} />
                          </Field>
                          
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Preço do Frete</h3>
                            <div className="space-y-4">
                              <Field label="Taxa Base Fixa (R$)">
                                <NumberInput value={configs.taxa_base} onChange={(e) => handleConfigChange("taxa_base", Number(e.target.value))} step="0.5" />
                              </Field>
                              <Field label="Adicional por KM (R$)">
                                <NumberInput value={configs.taxa_por_km} onChange={(e) => handleConfigChange("taxa_por_km", Number(e.target.value))} step="0.5" />
                              </Field>
                            </div>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Tempo Estimado</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Mínimo (min)">
                                <NumberInput value={configs.tempo_min} onChange={(e) => handleConfigChange("tempo_min", Number(e.target.value))} />
                              </Field>
                              <Field label="Máximo (min)">
                                <NumberInput value={configs.tempo_max} onChange={(e) => handleConfigChange("tempo_max", Number(e.target.value))} />
                              </Field>
                            </div>
                          </div>

                          <button onClick={handleSalvarConfigs} disabled={salvando} className="w-full py-4 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:bg-slate-300 text-white font-black text-[15px] uppercase tracking-wide rounded-[14px] transition-all transform active:scale-95 shadow-[0_4px_14px_rgba(20,184,166,0.3)] mt-4 flex items-center justify-center gap-2">
                            {salvando ? "Salvando..." : <><Check size={20} /> Salvar Regras</>}
                          </button>
                        </div>
                    </div>

                    {/* Mapa Interativo */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 relative">
                        <DeliveryMap center={[-23.550520, -46.633308]} radiusKm={configs.raio_km} />
                        
                        <div className="absolute top-6 right-6 z-[400] bg-white p-3 rounded-xl shadow-lg border border-slate-100 flex items-center gap-3 pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                              <MapPin size={20} />
                          </div>
                          <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cobertura Atual</p>
                              <p className="font-black text-slate-800 text-[15px]">{configs.raio_km} KM</p>
                          </div>
                        </div>
                    </div>
                  </div>
              )}

              {aba === "horarios" && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <h2 className="text-lg font-bold">Horários de Funcionamento</h2>
                      <p className="text-sm mt-1">Configuração de horários automáticos virá em breve.</p>
                    </div>
                  </div>
              )}

              {aba === "motoboys" && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-full">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-black text-lg text-slate-800 tracking-tight">Motoboys e Entregadores</h2>
                        <button onClick={() => handleAbrirModalMotoboy()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm">
                          <Plus size={18} /> Novo Motoboy
                        </button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Entregador</th>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Contato</th>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Veículo</th>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
                              </tr>
                          </thead>
                          <tbody>
                              {motoboys.length === 0 ? (
                                <tr><td colSpan="5" className="p-6 text-center text-slate-400 font-bold">Nenhum motoboy cadastrado.</td></tr>
                              ) : motoboys.map(m => (
                                <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-500">
                                            {m.nome.substring(0,2).toUpperCase()}
                                          </div>
                                          <span className="font-bold text-slate-800">{m.nome}</span>
                                      </div>
                                    </td>
                                    <td className="p-4 font-semibold text-slate-600 text-sm">{m.telefone}</td>
                                    <td className="p-4 font-semibold text-slate-600 text-sm">{m.placa}</td>
                                    <td className="p-4">
                                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${m.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                          {m.status}
                                      </span>
                                    </td>
                                    <td className="p-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                          <button onClick={() => handleAbrirModalMotoboy(m)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                            <Edit3 size={16} />
                                          </button>
                                          <button onClick={() => handleDeleteMotoboy(m.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                            <Trash2 size={16} />
                                          </button>
                                      </div>
                                    </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                    </div>
                  </div>
              )}
            </>
         )}
      </div>

      {/* Modal Motoboy */}
      {modalMotoboy && motoboyEdit && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                  <h2 className="font-black text-xl text-slate-800 tracking-tight">{motoboyEdit.id ? "Editar Motoboy" : "Cadastrar Motoboy"}</h2>
                  <button onClick={() => setModalMotoboy(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X size={16}/></button>
               </div>
               <div className="p-6 space-y-4">
                  <Field label="Nome Completo">
                    <TextInput value={motoboyEdit.nome} onChange={e => setMotoboyEdit({...motoboyEdit, nome: e.target.value})} placeholder="Nome do entregador" />
                  </Field>
                  <Field label="Telefone">
                    <TextInput value={motoboyEdit.telefone} onChange={e => setMotoboyEdit({...motoboyEdit, telefone: e.target.value})} placeholder="(11) 99999-9999" />
                  </Field>
                  <Field label="Placa do Veículo">
                    <TextInput value={motoboyEdit.placa} onChange={e => setMotoboyEdit({...motoboyEdit, placa: e.target.value})} placeholder="ABC-1234" />
                  </Field>
                  <Field label="Status">
                    <Select value={motoboyEdit.status} onChange={e => setMotoboyEdit({...motoboyEdit, status: e.target.value})}>
                       <option value="offline">Offline</option>
                       <option value="online">Online</option>
                    </Select>
                  </Field>
                  
                  <div className="pt-4 flex gap-3">
                     <button className="flex-1 py-3.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setModalMotoboy(false)}>Cancelar</button>
                     <button onClick={handleSalvarMotoboy} disabled={salvando || !motoboyEdit.nome} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                       {salvando ? "Salvando..." : "Salvar Cadastro"}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
