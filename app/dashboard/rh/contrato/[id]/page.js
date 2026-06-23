"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import { supabase } from "../../../../lib/supabase";
import { fetchCargos, fetchRegulamento } from "../../../../lib/rh";
import { Printer, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";

export default function ContratoRhPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  
  const [colaborador, setColaborador] = useState(null);
  const [cargoPadrao, setCargoPadrao] = useState(null);
  const [regulamento, setRegulamento] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!unidadeAtiva) return;
      setLoading(true);

      // 1. Busca funcionário
      const { data: f } = await supabase.from("colaboradores").select("*").eq("id", id).single();
      setColaborador(f);

      if (f) {
        // 2. Busca o cargo dele para pegar as funções
        const resCargos = await fetchCargos(unidadeAtiva);
        const cargoEncontrado = (resCargos.data || []).find(c => c.nome.toLowerCase() === f.cargo?.toLowerCase());
        setCargoPadrao(cargoEncontrado);
      }

      // 3. Busca regulamento
      const reg = await fetchRegulamento(unidadeAtiva);
      setRegulamento(reg.data);

      setLoading(false);
    }
    carregar();
  }, [id, unidadeAtiva]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Gerando documento...</div>;
  }

  if (!colaborador) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Funcionário não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-20">
      
      {/* Barra de Ferramentas (Não sai na impressão) */}
      <div className="print:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-xl">
        <button onClick={() => router.back()} className="flex items-center gap-2 font-bold hover:text-emerald-400 transition-colors">
          <ArrowLeft size={18}/> Voltar
        </button>
        <div className="flex gap-4">
          {regulamento?.url_pdf && (
            <a href={regulamento.url_pdf} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold transition-colors">
              <FileText size={16}/> Ver PDF Original
            </a>
          )}
          <button onClick={handlePrint} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl font-black transition-colors shadow-lg shadow-emerald-900/20">
            <Printer size={18}/> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {/* Papel (A4) */}
      <div className="max-w-[21cm] mx-auto bg-white p-[2cm] mt-8 shadow-2xl print:shadow-none print:m-0 print:p-0">
        
        {/* Cabeçalho */}
        <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
           <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{unidadeInfo?.nome || "Empresa"}</h1>
           <p className="text-sm font-bold text-slate-500 tracking-widest mt-1">Termo de Ciência e Responsabilidade</p>
        </div>

        {/* Dados do Funcionário */}
        <div className="mb-10 text-sm">
           <p className="mb-2"><strong className="text-slate-900">Nome do Colaborador:</strong> {colaborador.nome}</p>
           <p className="mb-2"><strong className="text-slate-900">Cargo / Função:</strong> {colaborador.cargo}</p>
           <p className="mb-2"><strong className="text-slate-900">Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Funções do Cargo */}
        <div className="mb-10">
           <h2 className="text-lg font-black bg-slate-100 p-2 mb-4 uppercase tracking-widest border-l-4 border-slate-900">1. Descrição do Cargo</h2>
           {cargoPadrao?.funcoes_padrao ? (
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-slate-200">
                {cargoPadrao.funcoes_padrao}
              </div>
           ) : (
              <p className="text-sm text-slate-500 italic pl-4">Nenhuma função preestabelecida para o cargo de {colaborador.cargo}. (Você pode adicionar isso nas Configurações de RH).</p>
           )}
        </div>

        {/* Regulamento Interno */}
        <div className="mb-16">
           <h2 className="text-lg font-black bg-slate-100 p-2 mb-4 uppercase tracking-widest border-l-4 border-slate-900">2. Regulamento Interno</h2>
           {regulamento?.texto_regulamento ? (
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed text-justify">
                {regulamento.texto_regulamento}
              </div>
           ) : (
              <p className="text-sm text-slate-500 italic pl-4">O regulamento interno da empresa não foi preenchido nas configurações.</p>
           )}
        </div>

        {/* Termo e Assinatura */}
        <div className="mt-20 pt-8 border-t border-slate-200">
           <p className="text-sm text-justify mb-16 leading-relaxed">
             Pelo presente termo, declaro para os devidos fins que recebi, li e estou ciente de todas as normas estipuladas no <strong>Regulamento Interno</strong> da empresa <strong>{unidadeInfo?.nome}</strong>, bem como compreendo integralmente a <strong>Descrição do meu Cargo</strong> e as funções inerentes à minha contratação. Comprometo-me a cumpri-las fielmente, sob pena de sofrer as sanções disciplinares cabíveis.
           </p>

           <div className="flex justify-between items-end mt-24">
              <div className="text-center w-1/2 px-4">
                 <div className="border-t border-slate-900 pt-2">
                    <p className="font-bold text-sm text-slate-900">{unidadeInfo?.nome}</p>
                    <p className="text-xs text-slate-500">Contratante</p>
                 </div>
              </div>
              <div className="text-center w-1/2 px-4">
                 <div className="border-t border-slate-900 pt-2">
                    <p className="font-bold text-sm text-slate-900">{colaborador.nome}</p>
                    <p className="text-xs text-slate-500">Colaborador(a)</p>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
