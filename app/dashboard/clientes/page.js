"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Star, MessageSquare, Megaphone, TrendingUp,
  Mail, Phone, MoreVertical, Search, Filter, Download,
  Heart, HeartCrack, Award, Gift, Send, X, Plus
} from "lucide-react";
import { PageBody, Card, fmtBRL } from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { 
  fetchClientes, fetchAvaliacoes, fetchCampanhas, inserirCampanha 
} from "../../lib/clientes";

export default function CRMPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [activeTab, setActiveTab] = useState("visao"); // visao | base | nps | campanhas
  
  const [clientes, setClientes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  // Modal Nova Campanha
  const [modalCampanha, setModalCampanha] = useState(false);
  const [novaCampanha, setNovaCampanha] = useState({ nome: "", descricao: "", tipo: "SMS", cupom: "", desconto: 0 });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [resCli, resNps, resCamp] = await Promise.all([
      fetchClientes(unidadeAtiva),
      fetchAvaliacoes(unidadeAtiva),
      fetchCampanhas(unidadeAtiva)
    ]);
    setClientes(resCli.data || []);
    setAvaliacoes(resNps.data || []);
    setCampanhas(resCamp.data || []);
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  // KPIs Calculados
  const kpis = useMemo(() => {
    const totalCli = clientes.length;
    const ltvGeral = clientes.reduce((acc, c) => acc + Number(c.total_gasto || 0), 0);
    const avgLtv = totalCli > 0 ? ltvGeral / totalCli : 0;
    
    // Taxa de Retorno (Clientes Frequentes ou VIP / Total)
    const retornaram = clientes.filter(c => c.status === "Vip" || c.status === "Frequente").length;
    const taxaRetorno = totalCli > 0 ? Math.round((retornaram / totalCli) * 100) : 0;

    // NPS Simples (Apenas média das avaliações multiplicada por 10)
    const npsAvg = avaliacoes.length > 0 
      ? Math.round((avaliacoes.reduce((acc, a) => acc + Number(a.nota||0), 0) / avaliacoes.length) * 10) 
      : 0;

    return { totalCli, avgLtv, taxaRetorno, npsAvg };
  }, [clientes, avaliacoes]);

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone?.includes(busca));
  }, [clientes, busca]);

  async function handleSalvarCampanha() {
    if(!novaCampanha.nome) return;
    setSalvando(true);
    
    // Calcula datas
    const dtInicio = new Date().toISOString().split('T')[0];
    const dtFim = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]; // +30 dias

    const res = await inserirCampanha({
       ...novaCampanha,
       inicio: dtInicio,
       fim: dtFim,
       meta_clientes: clientes.filter(c => c.status === 'Risco').length || 100,
       status: 'Ativa'
    }, unidadeAtiva);

    setSalvando(false);
    if (!res.error) {
       setModalCampanha(false);
       setNovaCampanha({ nome: "", descricao: "", tipo: "SMS", cupom: "", desconto: 0 });
       carregar();
       setActiveTab("campanhas");
    } else {
       alert("Erro ao criar campanha: " + res.error);
    }
  }

  // Renderização da Aba Visão Geral
  const renderVisaoGeral = () => (
    <div className="space-y-6">
      {/* KPIs Principais de CRM */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Clientes na Base</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">{kpis.totalCli}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-emerald-600"><Users size={20}/></div>
          </div>
          <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 mt-3">
            <TrendingUp size={12}/> +{(kpis.totalCli * 0.1).toFixed(0)} este mês
          </p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Score NPS</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">{kpis.npsAvg}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Star size={20} className="fill-emerald-600"/></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">{kpis.npsAvg > 80 ? "Zona de Excelência" : "Atenção Requerida"}</p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Taxa de Retorno</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">{kpis.taxaRetorno}%</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-emerald-600"><Heart size={20}/></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Clientes fidelizados</p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-slate-800 to-slate-900 border-none text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><Award size={120} /></div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">LTV Médio</p>
            <p className="text-3xl font-black tracking-tighter">{fmtBRL(kpis.avgLtv)}</p>
            <p className="text-xs font-bold text-slate-500 mt-3">Gasto de vida útil</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Top Clientes */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">🏆 Top Clientes (LTV)</h3>
              <p className="text-[10px] font-medium text-slate-500 mt-1">Os que mais gastaram historicamente</p>
            </div>
            <button onClick={() => setActiveTab("base")} className="text-xs font-bold text-emerald-600 hover:text-blue-800">Ver todos</button>
          </div>
          <div className="divide-y divide-slate-100">
            {clientes.slice(0,5).map((cliente, idx) => (
              <div key={cliente.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">
                    {idx + 1}º
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{cliente.nome}</p>
                    <p className="text-[11px] font-medium text-slate-500">{cliente.total_pedidos} visitas • LTV</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-600">{fmtBRL(cliente.total_gasto)}</span>
              </div>
            ))}
            {clientes.length === 0 && (
               <div className="p-8 text-center text-slate-500 font-medium">Nenhum cliente registrado</div>
            )}
          </div>
        </Card>

        {/* Alertas de Avaliações */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">⚠️ Atenção: Avaliações</h3>
              <p className="text-[10px] font-medium text-slate-500 mt-1">Reviews recentes com nota baixa</p>
            </div>
            <button onClick={() => setActiveTab("nps")} className="text-xs font-bold text-emerald-600 hover:text-blue-800">Abrir NPS</button>
          </div>
          <div className="p-4 space-y-4">
            {avaliacoes.filter(a => Number(a.nota) <= 5).slice(0,4).map((av) => (
              <div key={av.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HeartCrack size={16} className="text-slate-600"/>
                    <span className="text-xs font-bold text-slate-800">{av.nome}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{av.origem} (Nota {av.nota})</span>
                </div>
                <p className="text-sm text-slate-700 italic">"{av.comentario}"</p>
              </div>
            ))}
            {avaliacoes.filter(a => Number(a.nota) <= 5).length === 0 && (
               <div className="p-8 text-center text-emerald-500 font-bold flex flex-col items-center gap-2">
                  <Star size={32} />
                  Sem avaliações baixas recentes!
               </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  // Renderização da Aba Base de Clientes
  const renderBase = () => (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-64"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-100">
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Cliente</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Contato</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">LTV (Gasto Total)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <p className="font-bold text-slate-800 text-sm">{cliente.nome}</p>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 mt-0.5">{cliente.total_pedidos} visitas</p>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-600 font-medium">{cliente.telefone || cliente.tel || "Não inf."}</span>
                </td>
                <td className="p-4">
                  <span className={`inline-flex px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md border 
                    ${cliente.status === 'Vip' ? 'bg-slate-50 text-emerald-600 border-slate-200' : 
                      cliente.status === 'Risco' ? 'bg-slate-50 text-emerald-600 border-slate-200' : 
                      'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                    {cliente.status || "Ativo"}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-black text-slate-800">{fmtBRL(cliente.total_gasto)}</span>
                </td>
              </tr>
            ))}
            {clientesFiltrados.length === 0 && (
               <tr><td colSpan="4" className="p-8 text-center text-slate-500 font-medium">Nenhum cliente encontrado na busca.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // Renderização da Aba Avaliações (NPS)
  const renderNPS = () => (
    <Card className="p-0 overflow-hidden bg-slate-50">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tighter">Feedbacks e Avaliações</h3>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Resumo de satisfação</p>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {avaliacoes.map((av) => (
          <div key={av.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex text-slate-500">
                  {/* Converte nota 0-10 para 1-5 estrelas simbolicamente */}
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < (av.nota/2) ? "fill-yellow-400" : "text-slate-200"} />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{av.origem}</span>
              </div>
              <p className="text-sm font-medium text-slate-700 italic">"{av.comentario || 'Sem comentário'}"</p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">{av.nome}</p>
                <p className="text-[10px] text-slate-500">{av.data}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  // Renderização da Aba Campanhas
  const renderCampanhas = () => (
    <div className="space-y-6">
       <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="font-black text-xl text-slate-800">Campanhas e Cashback</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Acorde clientes inativos com SMS ou WhatsApp</p>
          </div>
          <button onClick={() => setModalCampanha(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">
            <Plus size={18}/> Criar Campanha
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campanhas.map(c => (
             <Card key={c.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 text-emerald-600 flex items-center justify-center">
                         <Megaphone size={24}/>
                      </div>
                      <div>
                         <h4 className="font-bold text-slate-800">{c.nome}</h4>
                         <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">{c.tipo} • Cupom: {c.cupom}</p>
                      </div>
                   </div>
                   <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100">
                     {c.status}
                   </span>
                </div>
                <p className="text-sm text-slate-600 mb-6">{c.descricao}</p>
                
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                   <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Atingidos</p>
                      <p className="font-black text-slate-800 text-lg">{c.clientes_atingidos || 0}</p>
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Conversão</p>
                      <p className="font-black text-slate-800 text-lg">
                        {c.meta_clientes > 0 ? Math.round(((c.clientes_atingidos||0) / c.meta_clientes)*100) : 0}%
                      </p>
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Receita (ROI)</p>
                      <p className="font-black text-emerald-600 text-lg">{fmtBRL(c.receita_gerada)}</p>
                   </div>
                </div>
             </Card>
          ))}
          {campanhas.length === 0 && (
             <div className="col-span-2 p-10 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-300">
               Nenhuma campanha criada ainda.
             </div>
          )}
       </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* HEADER DA TORRE DE CRM */}
      <div className="px-4 pt-8 md:pt-12 pb-6 bg-[var(--surface)] sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 max-w-6xl mx-auto">
          <div>
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Marketing</p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter text-slate-800">Relacionamento.</h1>
            <p className="text-sm font-semibold text-slate-500 mt-2">Gestão de clientes e fidelização em <span className="text-slate-800 font-bold">{unidadeInfo.nome}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setActiveTab('campanhas'); setModalCampanha(true); }} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 shadow-emerald-600/20 shadow-xl">
              <Megaphone size={18} /> Nova Campanha
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="max-w-6xl mx-auto mt-8 flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
          {[
            { id: "visao", label: "Visão Geral", icon: TrendingUp },
            { id: "base", label: "Base de Clientes", icon: Users },
            { id: "nps", label: "Avaliações (NPS)", icon: Star },
            { id: "campanhas", label: "Campanhas SMS", icon: Send },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id 
                  ? "bg-slate-800 text-white shadow-md" 
                  : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CORPO DA PÁGINA */}
      <PageBody>
        <div className="max-w-6xl mx-auto">
          {loading ? (
             <div className="py-20 text-center font-bold text-slate-500">Carregando CRM...</div>
          ) : (
             <>
               {activeTab === "visao" && renderVisaoGeral()}
               {activeTab === "base" && renderBase()}
               {activeTab === "nps" && renderNPS()}
               {activeTab === "campanhas" && renderCampanhas()}
             </>
          )}
        </div>
      </PageBody>

      {/* MODAL NOVA CAMPANHA */}
      {modalCampanha && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Criar Campanha</h2>
                  <button onClick={() => setModalCampanha(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Campanha</label>
                     <input type="text" value={novaCampanha.nome} onChange={e=>setNovaCampanha({...novaCampanha, nome: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" placeholder="Ex: Resgate Inverno"/>
                  </div>
                  
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mensagem/Descrição</label>
                     <textarea value={novaCampanha.descricao} onChange={e=>setNovaCampanha({...novaCampanha, descricao: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500 resize-none h-24" placeholder="Sua msg aqui..."/>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Código do Cupom</label>
                        <input type="text" value={novaCampanha.cupom} onChange={e=>setNovaCampanha({...novaCampanha, cupom: e.target.value.toUpperCase()})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600 outline-none focus:border-emerald-500" placeholder="Ex: VOLTA10"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Desconto (R$ ou %)</label>
                        <input type="number" value={novaCampanha.desconto} onChange={e=>setNovaCampanha({...novaCampanha, desconto: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" placeholder="10"/>
                     </div>
                  </div>
               </div>

               <button onClick={handleSalvarCampanha} disabled={salvando || !novaCampanha.nome} className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                  {salvando ? "Salvando..." : "Lançar Campanha"}
               </button>
            </div>
         </div>
      )}
    </div>
  );
}
