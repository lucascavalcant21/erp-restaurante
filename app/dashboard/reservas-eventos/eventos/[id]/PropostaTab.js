"use client";

import { FileText, Link as LinkIcon, Download, CheckCircle, Send } from "lucide-react";

export default function PropostaTab({ evento }) {
  
  const handleGerarPDF = () => {
    window.print();
  };

  const valorCobrado = Number(evento?.valor_contratado || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div className="lg:col-span-1 space-y-6 print:hidden">
        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <h2 className="text-lg font-black text-slate-900 mb-6">Ações da Proposta</h2>
          
          <div className="space-y-3">
            <button onClick={handleGerarPDF} className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
              <Download size={18}/> Salvar PDF
            </button>
            <button className="w-full h-12 flex items-center justify-center gap-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold hover:bg-emerald-200 transition-colors">
              <Send size={18}/> Enviar por WhatsApp
            </button>
            <button className="w-full h-12 flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors">
              <LinkIcon size={18}/> Copiar Link Público
            </button>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6">
          <CheckCircle className="text-emerald-500 mb-2" size={32}/>
          <h3 className="font-black text-emerald-900 mb-1">Dica de Conversão</h3>
          <p className="text-sm text-emerald-700 font-medium">
            Propostas com links digitais têm 40% mais chance de aprovação rápida. O cliente pode aprovar e assinar pelo celular.
          </p>
        </div>
      </div>

      <div className="lg:col-span-2">
        {/* Preview da Proposta (Este container será impresso) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-12 min-h-[800px] shadow-sm print:border-none print:shadow-none print:p-0">
          <header className="border-b-2 border-slate-900 pb-8 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Proposta de Evento</h1>
              <p className="text-lg font-medium text-slate-500">{evento?.nome || "Evento sem título"}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800">Orçamento #{evento?.id?.split("-")[0]}</p>
              <p className="text-slate-500">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </header>

          <section className="mb-8 grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Dados do Cliente</h3>
              <p className="font-bold text-slate-800 text-lg">{evento?.cliente_nome || "Nome não informado"}</p>
              <p className="text-slate-500">{evento?.cliente_telefone || "Telefone não informado"}</p>
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Detalhes do Evento</h3>
              <p className="font-bold text-slate-800">Data: {evento?.data_evento ? new Date(evento.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "A definir"}</p>
              <p className="font-bold text-slate-800">Convidados: {evento?.capacidade || 0} pessoas</p>
            </div>
          </section>

          <section className="mb-12">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Cardápio Selecionado</h3>
            {(!evento?.cardapio_itens || evento.cardapio_itens.length === 0) ? (
              <p className="text-slate-500 italic">Nenhum prato selecionado no cardápio.</p>
            ) : (
              <ul className="space-y-3">
                {evento.cardapio_itens.map(item => (
                  <li key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-800">{item.nome}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-slate-900 text-white rounded-2xl p-8 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Investimento Total</h3>
              <p className="text-slate-300 text-sm">Validade da proposta: 7 dias</p>
            </div>
            <div className="text-right">
              <strong className="text-4xl font-black text-emerald-400">R$ {valorCobrado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
            </div>
          </section>

          <footer className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm font-medium">
            Obrigado por escolher nosso restaurante. Estamos à disposição para realizar o seu evento dos sonhos!
          </footer>
        </div>
      </div>

    </div>
  );
}
