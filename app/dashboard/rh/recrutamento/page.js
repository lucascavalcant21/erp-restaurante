"use client";

import { ArrowLeft, Users } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import BancoTalentos from "../components/BancoTalentos";

export default function RecrutamentoPage() {
  const { abrirMenu, unidadeAtiva, unidadeInfo } = useERP();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 sm:px-6 pt-12 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={abrirMenu}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200"
          aria-label="Voltar"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-black leading-tight flex items-center gap-2 text-slate-800">
            <Users size={20} className="text-indigo-600" /> Recrutamento e Portal de Vagas
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Candidaturas e respostas conectadas ao portal · {unidadeInfo?.nome || "Unidade selecionada"}
          </p>
        </div>
      </div>

      <main className="p-4 sm:p-6">
        <BancoTalentos unidadeAtiva={unidadeAtiva} />
      </main>
    </div>
  );
}
