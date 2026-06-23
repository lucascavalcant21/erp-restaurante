"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { fetchPontosMes } from "../../../../lib/ponto";
import { fetchFolgasEsporadicas } from "../../../../lib/rh";
import { Printer, ArrowLeft } from "lucide-react";

export default function EspelhoDePonto() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const colabId = params.id;
  const mesParam = searchParams.get("mes") || new Date().toISOString().slice(0, 7); // ex: 2026-06

  const [colaborador, setColaborador] = useState(null);
  const [pontos, setPontos] = useState([]);
  const [folgasEsporadicas, setFolgasEsporadicas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!colabId) return;
      
      // Busca Colaborador
      const { data: colab } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("id", colabId)
        .single();
        
      if (colab) {
        if (colab.unidade_id) {
           const { data: unid } = await supabase.from("unidades").select("nome, cnpj").eq("id", colab.unidade_id).single();
           colab.unidade = unid;
        }
        setColaborador(colab);
      }

      // Busca Pontos
      const { data: pts } = await fetchPontosMes(colabId, mesParam);
      setPontos(pts || []);

      // Busca Folgas Esporádicas
      const resFolgas = await fetchFolgasEsporadicas(colabId);
      setFolgasEsporadicas(resFolgas.data || []);

      setLoading(false);
    }
    carregar();
  }, [colabId, mesParam]);

  if (loading) return <div className="p-10 font-bold text-center text-slate-500">Carregando relatório...</div>;
  if (!colaborador) return <div className="p-10 font-bold text-center text-red-500">Colaborador não encontrado.</div>;

  const diasNoMes = new Date(mesParam.slice(0,4), mesParam.slice(5,7), 0).getDate();
  const arrayDias = Array.from({length: diasNoMes}, (_, i) => i + 1);

  // Calcula horas
  const calcularHorasDecimais = (h1, h2) => {
    if (!h1 || !h2) return 0;
    const diff = new Date(h2) - new Date(h1);
    if (diff < 0) return 0;
    return diff / (1000 * 60 * 60);
  };

  const fmtHoras = (horasDecimais) => {
    const h = Math.floor(horasDecimais);
    const m = Math.round((horasDecimais - h) * 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  };

  let totalHorasMes = 0;

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-20 print:bg-white print:pb-0">
      
      {/* Barra de Ações (Oculta na impressão) */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between print:hidden max-w-[210mm] mx-auto mt-6 rounded-t-xl">
         <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-600 font-bold hover:text-slate-800">
            <ArrowLeft size={20}/> Voltar
         </button>
         <button onClick={() => window.print()} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
            <Printer size={18}/> Imprimir PDF
         </button>
      </div>

      {/* Folha A4 */}
      <div className="max-w-[210mm] mx-auto bg-white py-0 px-[10mm] shadow-md print:shadow-none print:p-0 print:m-0 min-h-[297mm] print:min-h-0">
         <style dangerouslySetInnerHTML={{__html: `
           @media print {
             @page { margin: 5mm; }
             body { -webkit-print-color-adjust: exact; }
           }
           .tabela-ponto th, .tabela-ponto td {
             font-size: 10px !important;
             line-height: 1.1 !important;
             padding: 1px !important;
             height: 14px !important;
           }
         `}} />
         
         {/* Cabeçalho */}
         <div className="border border-slate-800 p-1 mb-1">
            <h1 className="text-lg font-black text-center uppercase tracking-widest border-b border-slate-800 pb-1 mb-1">
               Folha de Frequência - {mesParam.split('-').reverse().join('/')}
            </h1>
            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase mt-1">
               <div>
                  <p><strong>Empregador:</strong> {colaborador.unidade?.nome || "Empresa"}</p>
                  <p><strong>CNPJ:</strong> {colaborador.unidade?.cnpj || "00.000.000/0000-00"}</p>
               </div>
               <div>
                  <p><strong>Empregado(a):</strong> {colaborador.nome}</p>
                  <p><strong>Função:</strong> {colaborador.cargo}</p>
               </div>
            </div>
         </div>

         {/* Tabela de Pontos */}
         <table className="tabela-ponto w-full border-collapse border border-slate-800 text-center">
            <thead>
               <tr className="bg-slate-100">
                  <th className="border border-slate-800 !py-0 !px-1 w-8">DIA</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-20">ENTRADA</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-20">SAÍDA INT.</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-20">VOLTA INT.</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-20">SAÍDA FINAL</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-20">TOTAL DIÁRIO</th>
                  <th className="border border-slate-800 !py-0 !px-1">ASSINATURA</th>
               </tr>
            </thead>
            <tbody>
               {arrayDias.map(dia => {
                  const dataString = `${mesParam}-${dia.toString().padStart(2,'0')}`;
                  const reg = pontos.find(p => p.data_referencia === dataString);
                  
                  // Verifica se é folga
                  const dataObj = new Date(dataString + "T12:00:00Z");
                  const diaSemana = dataObj.getUTCDay().toString();
                  const isFolgaFixa = colaborador?.dias_trabalho ? !colaborador.dias_trabalho.split(',').includes(diaSemana) : false;
                  const isFolgaEsporadica = folgasEsporadicas.some(f => f.data_folga === dataString);
                  const isFolga = isFolgaFixa || isFolgaEsporadica;

                  if (isFolga && !reg) {
                      return (
                         <tr key={dia}>
                            <td className="border border-slate-800 !py-0 !px-1 font-bold bg-slate-50 text-slate-500">{dia.toString().padStart(2,'0')}</td>
                            <td colSpan={5} className="border border-slate-800 !py-0 !px-1 font-black tracking-[0.5em] text-slate-400 bg-slate-50">FOLGA</td>
                            <td className="border border-slate-800 !py-0 !px-1"></td>
                         </tr>
                      );
                  }
                  
                  // Calculando horas do dia
                  let horasDia = 0;
                  if (reg && reg.hora_entrada && reg.hora_saida_intervalo) {
                     horasDia += calcularHorasDecimais(reg.hora_entrada, reg.hora_saida_intervalo);
                  }
                  if (reg && reg.hora_retorno_intervalo && reg.hora_saida) {
                     horasDia += calcularHorasDecimais(reg.hora_retorno_intervalo, reg.hora_saida);
                  }
                  totalHorasMes += horasDia;

                  const horaStr = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR').slice(0,5) : "";

                  return (
                     <tr key={dia}>
                        <td className="border border-slate-800 !py-0 !px-1 font-bold">{dia.toString().padStart(2,'0')}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_entrada)}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_saida_intervalo)}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_retorno_intervalo)}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_saida)}</td>
                        <td className="border border-slate-800 !py-0 !px-1 font-bold">{horasDia > 0 ? fmtHoras(horasDia) : ""}</td>
                        <td className="border border-slate-800 !py-0 !px-1"></td>
                     </tr>
                  );
               })}
            </tbody>
            <tfoot>
               <tr className="bg-slate-100">
                  <td colSpan={5} className="border border-slate-800 !py-1 !px-2 text-right font-black uppercase text-[10px]">Total de Horas no Mês:</td>
                  <td colSpan={2} className="border border-slate-800 !py-1 !px-2 text-left font-black text-[11px]">{fmtHoras(totalHorasMes)} hrs</td>
               </tr>
            </tfoot>
         </table>

         {/* Assinaturas */}
         <div className="mt-12 flex justify-between w-full px-12 text-[10px] font-bold uppercase text-center gap-10">
            <div className="w-[45%]">
               <div className="border-b border-slate-800 mb-1"></div>
               {colaborador.unidade?.nome || "Assinatura do Empregador"}
            </div>
            <div className="w-[45%]">
               <div className="border-b border-slate-800 mb-1"></div>
               {colaborador.nome}
            </div>
         </div>
         
         <div className="mt-4 text-[8px] text-center text-slate-500">
            Documento gerado pelo sistema REP-A. Reconhecimento de marcação de ponto nos termos da Portaria MTP nº 671/2021.
         </div>

      </div>

    </div>
  );
}
