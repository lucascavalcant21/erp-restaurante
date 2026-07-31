"use client";
// tempo real: recarrega sozinho a cada 15s e quando o banco muda

import { useState, useEffect, useMemo } from "react";
import { useTempoReal } from "../../../lib/realtime";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoque, registrarCompra } from "../../../lib/estoque";
import { fetchFornecedores } from "../../../lib/fornecedores";
import { fetchProducoes } from "../../../lib/producao";
import { calcularAlertasRecorrenciaProducao } from "../../../lib/recorrencia-producao.mjs";
import { ShoppingCart, PackagePlus, Plus, ArrowLeft, TrendingUp, AlertCircle, Sparkles, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function ComprasPage() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const { unidadeAtiva } = useERP();
  
  const [insumos, setInsumos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [producoes, setProducoes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ insumoId: "", quantidade: 1, valorPago: "", fornecedorId: "" });

  const carregar = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const [ resEstoque, resFornecedores, resProducoes ] = await Promise.all([
      fetchEstoque(unidadeAtiva),
      fetchFornecedores(unidadeAtiva),
      fetchProducoes(unidadeAtiva)
    ]);
    setInsumos(resEstoque.data || []);
    setFornecedores(resFornecedores.data || []);
    setProducoes(resProducoes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);
  useTempoReal(null, () => carregar(true)); // atualiza sozinho (15s / mudanca no banco)

  const resultadoRecorrencia = useMemo(() => {
    return calcularAlertasRecorrenciaProducao(producoes, insumos, [], { diasAnalise: 30, margemSegurancaDias: 4 });
  }, [producoes, insumos]);

  const handleComprar = async (e) => {
     e.preventDefault();
     const ins = insumos.find(i => (i.insumo_id || i.id) === form.insumoId);
     if(!ins) return alert("Selecione um insumo.");
     
     const valorNum = parseFloat(form.valorPago.replace(',', '.'));
     if(isNaN(valorNum)) return alert("Valor inválido.");

     const forn = fornecedores.find(f => f.id === form.fornecedorId);
     const fornNome = forn ? forn.nome : "";

     const res = await registrarCompra(unidadeAtiva, ins.insumo_id || ins.id, ins.nome, ins.departamento, Number(form.quantidade), valorNum, fornNome);
     if(res?.error) return alert("❌ Erro ao registrar a compra: " + res.error);

     alert(`Compra registrada! ${form.quantidade} ${ins.unidade_medida} adicionado ao estoque e R$ ${valorNum} enviado para o Contas a Pagar (Financeiro).`);

     setModalOpen(false);
     setForm({ insumoId: "", quantidade: 1, valorPago: "", fornecedorId: "" });
     carregar();
  };

  const abrirCompraSugerida = (alerta) => {
    const ins = insumos.find(i => i.insumo_id === alerta.insumo_id || i.id === alerta.insumo_id);
    const custoEst = Number(alerta.custo_unitario) || 0;
    const valTotalEst = custoEst > 0 ? (custoEst * alerta.qtd_sugerida_compra).toFixed(2).replace('.', ',') : "";
    setForm({
      insumoId: ins?.insumo_id || alerta.insumo_id,
      quantidade: alerta.qtd_sugerida_compra || 1,
      valorPago: valTotalEst,
      fornecedorId: "",
    });
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      <div className="bg-slate-900 pt-6 sm:pt-8 pb-8 sm:pb-10 px-4 sm:px-8 shadow-lg text-white">
         <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button onClick={() => abrirMenu()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                 <ArrowLeft size={20}/>
              </button>
              <div className="hidden sm:flex w-16 h-16 shrink-0 rounded-2xl bg-emerald-500/20 text-emerald-400 items-center justify-center">
                 <ShoppingCart size={32} />
              </div>
              <div>
                 <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Entrada de Compras</h1>
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Integração: Recorrência de Produção & Financeiro</p>
              </div>
            </div>
            <button onClick={() => setModalOpen(true)} className="w-full md:w-auto px-5 sm:px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer">
               <PackagePlus size={20}/> Lançar Nota de Compra
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8 space-y-6">
         
         {/* Painel Inteligente de Recorrência de Produção */}
         {resultadoRecorrencia.alertas.length > 0 && (
           <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-5 sm:p-7 rounded-[28px] shadow-2xl border border-slate-800">
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2.5">
                 <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                   <Sparkles size={22} />
                 </div>
                 <div>
                   <h2 className="text-xl font-black tracking-tight text-white">Alertas de Recompra por Recorrência</h2>
                   <p className="text-xs text-slate-400 font-bold">Baseado no consumo médio das produções</p>
                 </div>
               </div>
               <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 text-xs font-black">
                 {resultadoRecorrencia.alertas.length} insumos em alerta
               </span>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
               {resultadoRecorrencia.alertas.map(alerta => (
                 <div key={alerta.insumo_id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 transition-all flex flex-col justify-between gap-3">
                   <div>
                     <div className="flex items-start justify-between gap-2">
                       <strong className="text-base font-black text-white">{alerta.nome}</strong>
                       <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${alerta.nivel_urgencia === "critico" ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"}`}>
                         {alerta.dias_cobertura <= 0 ? "Esgotado" : `Resta ${alerta.dias_cobertura} dia(s)`}
                       </span>
                     </div>
                     <p className="text-xs text-slate-300 mt-1">
                       Uso recorrente em: <strong className="text-emerald-400">{alerta.principal_pre_preparo}</strong>
                     </p>
                     <div className="mt-2 flex items-center justify-between text-xs text-slate-400 bg-white/5 p-2 rounded-xl">
                       <span>Saldo: <strong className="text-white">{alerta.saldo_atual} {alerta.unidade_medida}</strong></span>
                       <span>Consumo: <strong className="text-emerald-400">{alerta.consumo_diario} {alerta.unidade_medida}/dia</strong></span>
                     </div>
                   </div>

                   <button
                     onClick={() => abrirCompraSugerida(alerta)}
                     className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                   >
                     <ShoppingCart size={15} /> Sugestão: +{alerta.qtd_sugerida_compra} {alerta.unidade_medida}
                   </button>
                 </div>
               ))}
             </div>
           </div>
         )}

         <div className="bg-slate-50 border border-slate-200 p-4 sm:p-6 rounded-[24px] flex items-start gap-3 sm:gap-4">
            <AlertCircle className="text-slate-600 flex-shrink-0" size={28}/>
            <div>
               <h3 className="font-black text-amber-800 text-lg mb-1">Como funciona a Hiper-Automação?</h3>
               <p className="text-emerald-700 font-medium text-sm leading-relaxed">
                  Ao registrar uma compra de insumo (como Tomate ou Vodka) aqui, o sistema automaticamente: <br/>
                  1. Adiciona a quantidade comprada no <strong>Estoque Físico</strong> da Cozinha/Bar. <br/>
                  2. Gera uma conta pendente em <strong>Contas a Pagar</strong> no módulo Financeiro (como CMV).
               </p>
            </div>
         </div>

         {loading ? (
            <p className="text-center font-bold text-slate-500">Carregando insumos...</p>
         ) : (
            <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xl shadow-slate-200/50">
               <h2 className="text-xl font-black text-slate-800 mb-6 px-2">Status do Estoque de Insumos</h2>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {insumos.map(ins => (
                     <div key={ins.insumo_id || ins.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                        <p className="font-bold text-slate-700 leading-tight mb-2">{ins.nome}</p>
                        <div className="flex justify-between items-end mt-auto">
                           <span className="text-[10px] uppercase font-black text-slate-500">{ins.departamento}</span>
                           <span className="text-lg font-black text-emerald-600">{ins.quantidade_atual} {ins.unidade_medida}</span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         )}
      </div>

      {modalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-5 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <h2 className="font-black text-2xl text-slate-800 mb-6">Registrar Compra</h2>
               <form onSubmit={handleComprar} className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">O que você comprou?</label>
                     <select required value={form.insumoId} onChange={e=>setForm({...form, insumoId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500 mb-4">
                        <option value="">-- Selecione o Insumo --</option>
                        {insumos.map(i => <option key={i.insumo_id || i.id} value={i.insumo_id || i.id}>{i.nome}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Qual Fornecedor? (Opcional)</label>
                     <select value={form.fornecedorId} onChange={e=>setForm({...form, fornecedorId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500">
                        <option value="">-- Sem Fornecedor --</option>
                        {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                     </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Qtd (Em {insumos.find(i=>(i.insumo_id||i.id)===form.insumoId)?.unidade_medida || 'un'})</label>
                        <input required type="number" step="0.01" min="0" value={form.quantidade} onChange={e=>setForm({...form, quantidade: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Valor Total Pago (R$)</label>
                        <input required type="text" placeholder="50,00" value={form.valorPago} onChange={e=>setForm({...form, valorPago: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  <button type="submit" className="w-full mt-8 py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                     <TrendingUp size={20}/> Confirmar Compra
                  </button>
               </form>
            </div>
         </div>
      )}

    </div>
  );
}
