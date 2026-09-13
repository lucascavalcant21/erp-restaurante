"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchResumoFolhaMensal, fecharFolhaMensal } from "../../../lib/rh";
import { ArrowLeft, Save, Loader2, DollarSign, Calculator, AlertTriangle, Info } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function FechamentoFolhaPage() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const { unidadeAtiva } = useERP();
  
  const [mesAno, setMesAno] = useState(new Date().toISOString().substring(0,7)); // yyyy-MM
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pagamentos, setPagamentos] = useState([]);

  const carregarResumo = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    setLoading(true);
    const { data } = await fetchResumoFolhaMensal(unidadeAtiva, mesAno);
    
    // Inicializar os campos editáveis
    const pags = data.map(c => {
      const acrescimos = 0;
      const vales = Number(c.total_vales_pendentes) || 0;
      const descontos_manuais = 0;
      const liquido = c.base_calculada + acrescimos - vales - descontos_manuais;
      
      return {
        ...c,
        acrescimos: acrescimos,
        descontos_manuais: descontos_manuais,
        vales_descontados_ids: c.vales_detalhes.map(v => v.id),
        valor_liquido: liquido > 0 ? liquido : 0
      };
    });

    setPagamentos(pags);
    setLoading(false);
  };

  useEffect(() => {
    carregarResumo();
  }, [unidadeAtiva, mesAno]);

  const handleMudarValor = (id, campo, valorString) => {
    const val = parseFloat(valorString.replace(',', '.')) || 0;
    setPagamentos(prev => prev.map(p => {
      if (p.colaborador_id === id) {
        const pNovo = { ...p, [campo]: val };
        const liquido = pNovo.base_calculada + pNovo.acrescimos - pNovo.total_vales_pendentes - pNovo.descontos_manuais;
        pNovo.valor_liquido = liquido > 0 ? liquido : 0;
        return pNovo;
      }
      return p;
    }));
  };

  const handleFinalizar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return alert("Selecione uma loja específica primeiro.");
    if (pagamentos.length === 0) return alert("Não há funcionários nesta folha.");

    if(!confirm(`Deseja fechar a folha de ${mesAno.split('-').reverse().join('/')}? Isso enviará R$ ${pagamentos.reduce((acc,p)=>acc+p.valor_liquido,0).toFixed(2)} para o Contas a Pagar.`)) return;

    setSalvando(true);
    const resultado = await fecharFolhaMensal(unidadeAtiva, mesAno, pagamentos);
    setSalvando(false);

    if (resultado.error) {
      alert("Erro ao fechar folha: " + resultado.error);
    } else {
      alert(`Folha fechada com sucesso!\n\n${resultado.holeritesGerados} holerite(s) enviado(s) ao Portal do Colaborador.\n${resultado.contasCriadas} conta(s) criada(s) no financeiro.${resultado.contasJaExistentes ? `\n${resultado.contasJaExistentes} conta(s) já existiam e não foram duplicadas.` : ""}`);
      router.push("/dashboard/financeiro/contas");
    }
  };

  const totalCalculado = pagamentos.reduce((acc, p) => acc + p.valor_liquido, 0);

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="p-10 text-center font-bold text-muted">Por favor, selecione uma unidade/loja específica no menu lateral.</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] font-sans pb-24">
      {/* Header Escuro */}
      <div className="bg-slate-900 pt-8 pb-12 px-6 shadow-2xl relative text-white border-b border-slate-800">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
               <button onClick={() => abrirMenu()} className="text-subtle hover:text-white mb-4 flex items-center gap-2 font-bold transition-colors">
                  <ArrowLeft size={18}/> Voltar
               </button>
               <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Fechamento de Folha</h1>
               <p className="text-subtle font-bold uppercase tracking-widest text-xs mt-1">Geração de Holerites e CMO Automático</p>
            </div>
            
            <div className="flex gap-4 items-center bg-slate-800 p-2 pl-4 rounded-2xl border border-slate-700">
               <span className="font-bold text-sm text-subtle uppercase tracking-widest">Competência:</span>
               <input 
                  type="month" 
                  value={mesAno} 
                  onChange={(e) => setMesAno(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 font-black outline-none focus:border-indigo-500 text-white"
               />
            </div>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-6">
         <div className="bg-card rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-line">
            
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-line-soft">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                     <Calculator size={24}/>
                  </div>
                  <div>
                     <h2 className="text-xl font-black text-slate-800">Cálculo de Pagamentos</h2>
                     <p className="text-sm text-muted font-medium">Revise os dias e ajuste os descontos antes de finalizar.</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-subtle mb-1">Total da Folha</p>
                  <p className="text-3xl font-black text-slate-800">{fmtBRL(totalCalculado)}</p>
               </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-blue-800 text-sm mb-6 font-medium">
               <Info size={20} className="shrink-0"/>
               <p>
                  <strong>Regras aplicadas:</strong> Funcionários fixos recebem o Salário Fixo. Freelancers recebem o Salário (Diária) multiplicado pelos dias em que bateram ponto no mês selecionado. O vencimento no financeiro será gerado automaticamente para o 5º dia útil do mês seguinte.
               </p>
            </div>

            {loading ? (
               <div className="py-20 text-center text-muted flex flex-col items-center">
                  <Loader2 size={32} className="animate-spin mb-4 text-indigo-500"/>
                  <p className="font-bold">Calculando pagamentos...</p>
               </div>
            ) : pagamentos.length === 0 ? (
               <div className="py-20 text-center text-muted">
                  <p className="font-bold">Nenhum funcionário encontrado para esta unidade.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1040px]">
                     <thead>
                        <tr className="text-3xs uppercase font-bold tracking-widest text-subtle border-b-2 border-line-soft">
                           <th className="pb-4 pl-4 min-w-[210px]">Colaborador</th>
                           <th className="pb-4 text-center whitespace-nowrap">Dias Trabs.</th>
                           <th className="pb-4 text-right whitespace-nowrap">Base</th>
                           <th className="pb-4 text-right whitespace-nowrap">Bônus (+)</th>
                           <th className="pb-4 text-right whitespace-nowrap">Vales/Adiant. (-)</th>
                           <th className="pb-4 text-right whitespace-nowrap">Faltas/Outros (-)</th>
                           <th className="pb-4 pr-4 text-right whitespace-nowrap">Líquido Final</th>
                        </tr>
                     </thead>
                     <tbody className="text-sm font-bold">
                        {pagamentos.map(p => (
                           <tr key={p.colaborador_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                              <td className="py-4 pl-4">
                                 <p className="text-slate-800">{p.nome}</p>
                                 <span className={`text-3xs uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mt-1 ${p.tipo_contrato === 'Freelancer' ? 'bg-amber-100 text-amber-700' : 'bg-elevated text-slate-600'}`}>
                                    {p.tipo_contrato} {p.tipo_contrato === 'Freelancer' && `(${fmtBRL(p.salario_cadastrado)}/dia)`}
                                 </span>
                              </td>
                              
                              <td className="py-4 text-center">
                                 <span className="bg-elevated text-fg-soft px-3 py-1 rounded-lg font-black">
                                    {p.dias_trabalhados}
                                 </span>
                              </td>

                              <td className="py-4 text-right text-muted whitespace-nowrap">
                                 {fmtBRL(p.base_calculada)}
                              </td>

                              <td className="py-4 text-right">
                                 <input 
                                    type="text" 
                                    value={p.acrescimos || ''}
                                    onChange={(e) => handleMudarValor(p.colaborador_id, 'acrescimos', e.target.value)}
                                    placeholder="0,00"
                                    className="w-24 text-right p-2 bg-card border border-line rounded-lg outline-none focus:border-indigo-500 text-success font-bold"
                                 />
                              </td>

                              <td className="py-4 text-right relative group/vale cursor-help">
                                 <span className="text-rose-500 font-bold border-b border-dashed border-rose-300">
                                    {fmtBRL(p.total_vales_pendentes)}
                                 </span>
                                 {p.vales_detalhes.length > 0 && (
                                    <div className="absolute z-10 hidden group-hover/vale:block bottom-full right-0 mb-2 bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl w-64 text-left font-medium">
                                       <p className="font-bold text-subtle mb-2 uppercase tracking-widest text-3xs">Vales Pendentes:</p>
                                       {p.vales_detalhes.map(v => (
                                          <div key={v.id} className="flex justify-between border-b border-slate-700 pb-1 mb-1 last:border-0 last:mb-0">
                                             <span className="truncate pr-2">{v.descricao}</span>
                                             <span>{fmtBRL(v.valor_final)}</span>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                              </td>

                              <td className="py-4 text-right">
                                 <input 
                                    type="text" 
                                    value={p.descontos_manuais || ''}
                                    onChange={(e) => handleMudarValor(p.colaborador_id, 'descontos_manuais', e.target.value)}
                                    placeholder="0,00"
                                    className="w-24 text-right p-2 bg-card border border-line rounded-lg outline-none focus:border-indigo-500 text-rose-500 font-bold"
                                 />
                              </td>

                              <td className="py-4 pr-4 text-right whitespace-nowrap">
                                 <p className="text-lg font-black text-fg bg-elevated px-3 py-1.5 rounded-xl inline-block whitespace-nowrap shadow-inner">
                                    {fmtBRL(p.valor_liquido)}
                                 </p>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
            
            <div className="mt-8 flex justify-end border-t border-line-soft pt-6">
               <button 
                  onClick={handleFinalizar}
                  disabled={salvando || pagamentos.length === 0}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
               >
                  {salvando ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                  Confirmar, gerar holerites e CMO
               </button>
            </div>

         </div>
      </div>
    </div>
  );
}
