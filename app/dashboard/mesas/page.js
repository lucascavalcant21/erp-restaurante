"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Users, Search as SearchIcon, RefreshCw, X, ChevronRight, Clock, Banknote, Map, Coffee } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchMesasEComandas, gerarMesas } from "../../lib/mesas";
import { supabase, isSupabaseReady } from "../../lib/supabase";
import { carimbarUnidade } from "../../lib/unidades";
import { useRouter } from "next/navigation";
import { formatarTempoMesa } from "../../lib/vendas-pdv-utils.mjs";

function fmtBRL(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function tempoDecorrido(isoStr) {
  if (!isoStr) return "--";
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  const m = Math.floor(diff / 60);
  return `${m}m`;
}

export default function MesasPDVPage() {
  const { unidadeAtiva } = useERP();
  const router = useRouter();

  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);

  // Seleção e Drawer
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");
  const [busca, setBusca] = useState("");

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

  // Se o Drawer fechar, limpa a mesa selecionada após a animação (opcional)
  function fecharDrawer() {
    setDrawerAberto(false);
    setTimeout(() => setMesaSelecionada(null), 300);
  }

  function abrirDrawer(m) {
    setMesaSelecionada(m);
    setDrawerAberto(true);
  }

  async function handleAdicionarMesa() {
    if (!isSupabaseReady()) return;
    setSalvando(true);
    await supabase.from("mesas").insert([carimbarUnidade({ numero: `Mesa ${mesas.length + 1}` }, unidadeAtiva)]);
    await carregar(true);
    setSalvando(false);
    showToast(`Mesa ${mesas.length + 1} adicionada!`);
  }

  const mesasFiltradas = mesas.filter(m => m.numero.toLowerCase().includes(busca.toLowerCase()));
  const mesasLivres = mesas.filter(m => (m.comandas?.length || 0) === 0).length;
  const mesasOcupadas = mesas.length - mesasLivres;
  const quantidadeVisivel = mesasFiltradas.length;
  // O tamanho acompanha a quantidade: mais mesas = cartões menores e mais
  // colunas. No celular a grade continua com duas colunas para o toque não
  // ficar apertado demais.
  const mesaMinima = quantidadeVisivel <= 12 ? 160
    : quantidadeVisivel <= 24 ? 120
      : quantidadeVisivel <= 40 ? 96
        : quantidadeVisivel <= 60 ? 82 : 72;
  const mesaGap = quantidadeVisivel <= 12 ? 18 : quantidadeVisivel <= 24 ? 12 : 8;
  const mesaCompacta = quantidadeVisivel > 12;
  const mesaMuitoCompacta = quantidadeVisivel > 32;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-100 relative overflow-hidden font-sans">
      <style>{`
        .mesas-grade-adaptativa{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--mesa-min),1fr));gap:var(--mesa-gap)}
        @media(max-width:640px){.mesas-grade-adaptativa{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
      `}</style>
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl font-black text-sm transition-all animate-bounce">
          {toast}
        </div>
      )}

      {/* TOP BAR OPERACIONAL (CLEAN) */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-sm z-10">
         <div className="flex items-center gap-3 sm:gap-6 min-w-0 overflow-x-auto pb-1 lg:pb-0">
            <h1 className="font-black text-xl sm:text-2xl text-slate-800 tracking-tight flex items-center gap-2 shrink-0">
              <Map className="text-emerald-600"/> Salão
            </h1>
            <div className="h-8 w-px bg-slate-200 shrink-0"></div>
            
            {/* KPIs Rápidos */}
            <div className="flex gap-2 sm:gap-3 shrink-0">
              <div className="px-3 sm:px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> {mesasLivres} Livres
              </div>
              <div className="px-3 sm:px-4 py-2 bg-slate-50 text-emerald-700 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div> {mesasOcupadas} Ocupadas
              </div>
            </div>
         </div>

         <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="relative flex-1 lg:flex-none">
              <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar Mesa..." 
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-12 pr-4 py-3 bg-slate-100 rounded-2xl text-slate-800 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-full lg:w-64 transition-all"
              />
            </div>
            <button onClick={() => carregar(true)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-emerald-600 flex items-center justify-center transition-colors shadow-sm active:scale-95">
              <RefreshCw size={20} />
            </button>
            <button onClick={handleAdicionarMesa} disabled={salvando} className="px-3 sm:px-5 py-3 rounded-2xl bg-slate-800 text-white font-black text-sm uppercase tracking-wide sm:tracking-widest hover:bg-slate-900 shadow-lg shadow-slate-900/20 transition-all active:scale-95 flex items-center gap-2 shrink-0">
              <Plus size={18} /> <span className="hidden sm:inline">Add Mesa</span>
            </button>
         </div>
      </div>

      {/* MAPA DE MESAS (GRID) */}
      <div className={`flex-1 overflow-y-auto hide-scrollbar ${mesaMuitoCompacta ? "p-2 sm:p-3" : "p-3 sm:p-5"}`}>
        {loading ? (
          <div className="h-full flex items-center justify-center font-black text-2xl text-slate-500">Carregando Mapa...</div>
        ) : mesas.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-500 px-4 text-center">
              <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                <Coffee size={40} className="text-slate-500" />
              </div>
              <p className="font-black text-2xl mb-2 text-slate-800">O Salão está vazio</p>
              <p className="mb-8 font-medium">Adicione mesas para começar a operar.</p>
               <button onClick={() => gerarMesas(unidadeAtiva, 12).then(()=>carregar(true))} className="px-5 sm:px-8 py-3 sm:py-4 bg-emerald-600 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-emerald-700 active:scale-95 transition-all">
                Gerar 12 Mesas Automaticamente
              </button>
           </div>
        ) : (
          <div className="mesas-grade-adaptativa pb-20" style={{ "--mesa-min": `${mesaMinima}px`, "--mesa-gap": `${mesaGap}px` }}>
            {mesasFiltradas.map(m => {
              const ocupada = (m.comandas?.length || 0) > 0;
              const maiorTempo = ocupada ? Math.floor(m.comandas.reduce((t,c) => {
                const inicio = c.aberta_em || c.created_at;
                const d = inicio ? Math.max(0, Date.now() - new Date(inicio).getTime()) : 0;
                return d > t ? d : t;
              },0)/60000) : 0;
              const tempoExibido = formatarTempoMesa(maiorTempo);
              const valorTotal = ocupada ? m.comandas.reduce((t, c) => t + (c.itens||[]).reduce((s,i) => s + i.preco*i.quantidade, 0), 0) : 0;
              
              return (
                <button
                  key={m.id}
                  onClick={() => abrirDrawer(m)}
                  className={`relative flex flex-col transition-all duration-300 active:scale-95 text-left overflow-hidden group ${mesaMuitoCompacta ? "min-h-32 p-2 rounded-xl border-b-4" : mesaCompacta ? "min-h-40 p-3 rounded-2xl border-b-[6px]" : "min-h-48 p-3 sm:p-5 rounded-2xl sm:rounded-[28px] border-b-8"} ${
                    ocupada 
                      ? 'bg-emerald-500 border-emerald-600 shadow-[0_8px_20px_rgba(16,185,129,0.22)] hover:-translate-y-1'
                      : 'bg-white border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-emerald-200'
                  }`}
                >
                  {/* Numero da Mesa */}
                  <h3 className={`font-black tracking-tighter leading-none transition-colors ${mesaMuitoCompacta ? "text-2xl" : mesaCompacta ? "text-3xl" : "text-4xl sm:text-5xl"} ${ocupada ? 'text-white' : 'text-slate-800 group-hover:text-emerald-600'}`}>
                    {m.numero.replace(/Mesa /i, "")}
                  </h3>
                  
                  {ocupada ? (
                    <div className={`mt-auto w-full ${mesaMuitoCompacta ? "space-y-1" : "space-y-2"}`}>
                       <div className={`relative z-10 flex max-w-full items-center gap-1 whitespace-nowrap text-emerald-50 font-bold uppercase bg-black/20 rounded-lg w-fit ${mesaMuitoCompacta ? "text-[8px] px-1.5 py-1" : "text-xs tracking-wide px-2.5 py-1.5"}`}>
                         {!mesaMuitoCompacta && <Clock size={12}/>} {tempoExibido}
                       </div>
                       <div className={`relative z-10 flex max-w-full items-center gap-1 whitespace-nowrap text-white font-black bg-black/20 rounded-lg w-fit ${mesaMuitoCompacta ? "text-[9px] px-1.5 py-1" : "text-sm sm:text-base px-2 sm:px-3 py-1.5"}`}>
                         {!mesaMuitoCompacta && <Banknote size={15}/>} {fmtBRL(valorTotal)}
                       </div>
                    </div>
                  ) : (
                    <div className="mt-auto w-full">
                       <span className={`inline-block rounded-lg bg-slate-100 text-slate-500 font-bold uppercase group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors ${mesaMuitoCompacta ? "px-2 py-1 text-[8px]" : "px-4 py-2 text-xs tracking-widest"}`}>
                         Livre
                       </span>
                    </div>
                  )}

                  {/* Efeito Visual Ocupada */}
                  {ocupada && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* OVERLAY DO DRAWER */}
      {drawerAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity" onClick={fecharDrawer}></div>
      )}

      {/* DRAWER LATERAL (ACTION PANEL) */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.1)] z-[110] transform transition-transform duration-300 ease-out flex flex-col border-l border-slate-200 ${
          drawerAberto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {mesaSelecionada && (
          <>
            {/* Header Drawer */}
            <div className="p-4 sm:p-8 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Gerenciar</p>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">{mesaSelecionada.numero}</h2>
              </div>
              <button onClick={fecharDrawer} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 shadow-sm border border-slate-200 transition-colors active:scale-95">
                <X size={24}/>
              </button>
            </div>

            {/* Conteúdo Drawer */}
             <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white">
               
               <button 
                 onClick={() => router.push(`/dashboard/vendas?novaMesa=${mesaSelecionada.id}`)} 
                 className="w-full p-4 sm:p-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200 rounded-3xl flex flex-col items-center justify-center gap-3 transition-colors mb-6 sm:mb-10 active:scale-95 group"
               >
                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-emerald-500 group-hover:scale-110 transition-transform">
                   <Plus size={32} />
                 </div>
                 <span className="font-black text-xl uppercase tracking-widest">Abrir Comanda</span>
               </button>

               <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Comandas em Atividade</div>
               
               {mesaSelecionada.comandas?.length > 0 ? (
                 <div className="flex flex-col gap-4">
                   {mesaSelecionada.comandas.map(c => {
                     const totalComanda = (c.itens||[]).reduce((s,i) => s + i.preco*i.quantidade, 0);
                     return (
                       <button 
                         key={c.id} 
                         onClick={() => router.push(`/dashboard/vendas?comanda=${c.id}`)} 
                          className="flex items-center gap-3 sm:gap-5 p-3 sm:p-5 bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-3xl transition-all text-left w-full shadow-sm hover:shadow-lg group active:scale-95"
                       >
                         <div className="w-14 h-14 rounded-full bg-slate-50 text-emerald-600 font-black flex items-center justify-center text-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                           {c.nome_cliente?.[0]?.toUpperCase()||"C"}
                         </div>
                         <div className="flex-1">
                           <p className="font-black text-slate-800 text-lg mb-1">{c.nome_cliente || "Sem nome"}</p>
                           <div className="flex items-center gap-3">
                             <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{tempoDecorrido(c.aberta_em)}</span>
                             <span className="text-sm font-black text-emerald-600">{fmtBRL(totalComanda)}</span>
                           </div>
                         </div>
                         <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 group-hover:bg-slate-100 group-hover:text-emerald-600 transition-colors">
                           <ChevronRight size={24}/>
                         </div>
                       </button>
                     )
                   })}
                 </div>
               ) : (
                 <div className="text-center py-10 px-4 text-slate-500 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <Coffee size={40} className="mx-auto mb-4 text-slate-500" />
                    <p className="font-bold text-lg mb-1">Mesa Livre</p>
                    <p className="text-sm">Nenhuma comanda aberta nesta mesa no momento.</p>
                 </div>
               )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
