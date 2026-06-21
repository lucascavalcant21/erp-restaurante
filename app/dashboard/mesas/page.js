"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Users, Search as SearchIcon, RefreshCw, X } from "lucide-react";
import { Modal, Field, NumberInput, TextInput, Select, Btn, Toast, fmtBRL } from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { fetchMesasEComandas, gerarMesas, abrirComanda, adicionarItemComanda, removerItemComanda, fecharComanda } from "../../lib/mesas";
import { supabase, isSupabaseReady } from "../../lib/supabase";
import { carimbarUnidade } from "../../lib/unidades";
import { useRouter } from "next/navigation";

// ... funções utilitárias ...
function tempoDecorrido(isoStr) {
  if (!isoStr) return "--";
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  const m = Math.floor(diff / 60);
  return `${m}m`;
}

export default function MesasPDVPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();

  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);

  // Seleção
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  
  // Modais
  const [modalComandas, setModalComandas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg, dur = 3000) => {
    setToast(msg); setTimeout(() => setToast(""), dur);
  }, []);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const mRes = await fetchMesasEComandas(unidadeAtiva);
    const mesasData = mRes.data || [];
    setMesas(mesasData);

    const fatAtivo = mesasData.reduce((total, m) =>
      total + m.comandas.reduce((t, c) =>
        t + (c.itens||[]).reduce((s,i) => s + i.preco*i.quantidade, 0)
      , 0)
    , 0);
    setFaturamentoHoje(fatAtivo);

    if (mesaSelecionada) {
      const m = mesasData.find(x => x.id === mesaSelecionada.id);
      if (m) setMesaSelecionada(m);
    }
    if (!silencioso) setLoading(false);
  }, [unidadeAtiva, mesaSelecionada?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleAdicionarMesa() {
    if (!isSupabaseReady()) return;
    setSalvando(true);
    await supabase.from("mesas").insert([carimbarUnidade({ numero: `Mesa ${mesas.length + 1}` }, unidadeAtiva)]);
    await carregar(true);
    setSalvando(false);
    showToast(`Mesa ${mesas.length + 1} adicionada!`);
  }

  // Cores
  const TEAL = "#14b8a6"; // teal-500
  const TEAL_DARK = "#0f766e"; // teal-700
  const AMBAR = "#f59e0b"; // ambar-500
  const AMBAR_DARK = "#b45309";

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2">
          {toast}
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO SUPERIOR */}
      <div className="flex items-center justify-between px-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex gap-1">
          {["Mesas","Comandas Offline","Modo Balcão"].map((tab, i) => (
            <button key={tab} className={`px-5 py-4 text-[13px] font-bold border-b-[3px] transition-colors ${i===0 ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => carregar(true)} className="p-2 text-slate-400 hover:text-teal-600 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm" title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <button onClick={handleAdicionarMesa} disabled={salvando} className="flex items-center gap-2 text-sm font-bold bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors shadow-sm">
            <Plus size={16} /> Nova Mesa
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Lado Esquerdo: Grid de Mesas */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto hide-scrollbar">
          
          <div className="flex items-center gap-4 mb-8">
            <div className="relative flex-1 max-w-md">
              <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Busque pelo número da mesa" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-teal-500 focus:bg-white transition-colors" />
            </div>
            
            {faturamentoHoje > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 px-4 py-2 rounded-lg">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Em aberto</span>
                <span className="font-black text-amber-600">{fmtBRL(faturamentoHoje)}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">Carregando mesas...</div>
          ) : mesas.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Users size={48} className="mb-4 opacity-50 text-slate-300" />
                <p className="mb-4 text-sm font-medium">Nenhuma mesa configurada.</p>
                <button onClick={() => gerarMesas(unidadeAtiva, 20).then(()=>carregar(true))} className="px-6 py-2.5 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 shadow-sm transition-colors">Gerar 20 Mesas</button>
             </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-5">
              {mesas.map(m => {
                const ocupada = (m.comandas?.length || 0) > 0;
                const maiorTempo = ocupada ? Math.floor(m.comandas.reduce((t,c) => { const d=Date.now()-new Date(c.aberta_em).getTime(); return d>t?d:t; },0)/60000) : 0;
                
                return (
                  <button
                    key={m.id}
                    onClick={() => { setMesaSelecionada(m); setModalComandas(true); }}
                    className={`relative flex flex-col items-center justify-center p-4 aspect-square rounded-[20px] transition-all hover:-translate-y-1 hover:shadow-lg ${ocupada ? 'bg-amber-500 hover:bg-amber-400 border-amber-600 shadow-amber-500/20' : 'bg-teal-500 hover:bg-teal-400 border-teal-600 shadow-teal-500/20'} border-b-4 shadow-md`}
                  >
                    <span className="text-white font-black text-3xl drop-shadow-sm mb-2 tracking-tighter">{m.numero.replace(/Mesa /i, "")}</span>
                    {ocupada ? (
                      <span className="text-amber-100 font-bold text-[10px] uppercase tracking-wider bg-black/15 px-3 py-1 rounded-full shadow-inner">{m.comandas.length} cmd · {maiorTempo}m</span>
                    ) : (
                      <span className="text-teal-100 font-bold text-[11px] uppercase tracking-wider">Livre</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Lado Direito: Resumo Rápido */}
        <div className="hidden lg:flex w-[320px] bg-slate-50 border-l border-slate-100 flex-col">
          <div className="p-5 border-b border-slate-200 bg-white">
            <h3 className="font-bold text-slate-800">Painel de Pedidos</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Selecione uma mesa para iniciar</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm font-medium p-8 text-center opacity-60">
            <Users size={48} className="mb-4 text-slate-300" />
            Nenhuma mesa selecionada
          </div>
        </div>
      </div>

      {/* Modal Comandas */}
      {modalComandas && mesaSelecionada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{mesaSelecionada.numero}</h2>
              <button onClick={() => setModalComandas(false)} className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-500 transition-colors shadow-sm"><X size={16}/></button>
            </div>
            <div className="p-5">
               <button onClick={() => router.push(`/dashboard/vendas?novaMesa=${mesaSelecionada.id}`)} className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors mb-6 shadow-md">
                 <Plus size={18} /> Nova Comanda
               </button>

               <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Comandas abertas</div>
               {mesaSelecionada.comandas?.length > 0 ? (
                 <div className="flex flex-col gap-3">
                   {mesaSelecionada.comandas.map(c => (
                     <button key={c.id} onClick={() => router.push(`/dashboard/vendas?comanda=${c.id}`)} className="flex items-center gap-4 p-4 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl transition-colors text-left w-full shadow-sm group">
                       <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-black flex items-center justify-center text-lg group-hover:bg-teal-500 group-hover:text-white transition-colors">{c.nome_cliente?.[0]?.toUpperCase()||"C"}</div>
                       <div className="flex-1">
                         <p className="font-bold text-slate-800 text-[15px]">{c.nome_cliente || "Sem nome"}</p>
                         <p className="text-[11px] font-semibold text-slate-500">{tempoDecorrido(c.aberta_em)}</p>
                       </div>
                       <div className="text-slate-300 group-hover:text-teal-600 transition-colors"><ChevronRight size={20}/></div>
                     </button>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-6 text-slate-500 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">Mesa livre. Nenhuma comanda aberta.</div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChevronRight({ size=24, className }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}><polyline points="9 18 15 12 9 6"/></svg>
}
