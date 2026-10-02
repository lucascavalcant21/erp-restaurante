"use client";

import { FileText, Download, CheckCircle, Send, ChefHat, Wine, MapPin, Calendar, Clock, Users, ArrowRight } from "lucide-react";
import { fmtReais } from "../../../../lib/valor-percentual.mjs";

export default function PropostaTab({ evento, resumo = null }) {
  
  const handleGerarPDF = () => {
    window.print();
  };

  const valorCobrado = Number(evento?.valor_contratado || 0);
  const convidados = Math.max(Number(evento?.capacidade) || 0, 0);

  // WhatsApp: abre a conversa com o resumo da proposta. Quem envia é a pessoa,
  // no próprio WhatsApp — o sistema só monta o texto.
  const enviarWhatsApp = () => {
    const nomes = (evento?.cardapio_itens || []).map((i) => `• ${i.nome}`).join("\n");
    const texto = [
      `Olá${evento?.cliente_nome ? `, ${evento.cliente_nome}` : ""}! Segue a proposta do seu evento:`,
      `Data: ${evento?.data_evento ? new Date(evento.data_evento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "a definir"}`,
      convidados ? `Convidados: ${convidados}` : null,
      nomes ? `Cardápio:\n${nomes}` : null,
      valorCobrado > 0 ? `Investimento: ${fmtReais(valorCobrado)}${convidados ? ` (${fmtReais(valorCobrado / convidados)} por convidado)` : ""}` : null,
    ].filter(Boolean).join("\n\n");
    const fone = String(evento?.cliente_telefone || "").replace(/\D/g, "");
    const numero = fone && fone.length <= 11 ? `55${fone}` : fone;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };
  const dataEvento = evento?.data_evento ? new Date(evento.data_evento).toLocaleDateString('pt-BR') : 'A definir';
  
  // Agrupar pratos por departamento para exibir bonitinho
  const cardapio = evento?.cardapio_itens || [];
  const pratosCozinha = cardapio.filter(i => i.departamento === 'cozinha');
  const pratosBar = cardapio.filter(i => i.departamento === 'bar');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      
      {/* BARRA LATERAL - CONTROLES (escondida na impressão) */}
      <div className="xl:col-span-1 space-y-6 print:hidden">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sticky top-8">
          <h2 className="text-lg font-black text-slate-900 mb-6">Ações da Proposta</h2>
          
          <div className="space-y-3">
            <button onClick={handleGerarPDF} className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
              <Download size={18}/> Salvar PDF (Imprimir)
            </button>
            <button onClick={enviarWhatsApp} className="w-full h-12 flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#20b858] transition-colors">
              <Send size={18}/> Enviar por WhatsApp
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4">Status do Cliente</h3>
            <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <CheckCircle size={20} />
              <span className="font-bold text-sm">Proposta Gerada</span>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DA FOLHA DO DOCUMENTO (tamanho A4) */}
      <div className="xl:col-span-3 overflow-x-auto pb-12">
        {/* Usamos max-w-[800px] para simular uma folha A4 em tela. */}
        <div className="bg-white mx-auto w-full max-w-[800px] min-h-[1122px] shadow-2xl print:shadow-none print:max-w-none print:w-full print:p-0">
          
          {/* CABEÇALHO ELEGANTE */}
          <header className="bg-slate-900 text-white p-12">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h1 className="text-4xl font-black tracking-tighter mb-2">PROPOSTA DE EVENTO</h1>
                <p className="text-slate-800 font-medium text-lg">Experiência Gastronômica Exclusiva</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tracking-tight">{evento?.cliente_nome || "Cliente Especial"}</div>
                <div className="text-slate-800">Proposta #{evento?.id?.split('-')[0].toUpperCase()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-t border-slate-700/50">
              <div>
                <div className="text-slate-900 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Calendar size={12}/> Data</div>
                <div className="font-semibold">{dataEvento}</div>
              </div>
              <div>
                <div className="text-slate-900 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={12}/> Convidados</div>
                <div className="font-semibold">{evento?.capacidade || 0} pax</div>
              </div>
              <div>
                <div className="text-slate-900 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={12}/> Horário</div>
                <div className="font-semibold">{evento?.hora_inicio || 'A def.'} às {evento?.hora_fim || 'A def.'}</div>
              </div>
              <div>
                <div className="text-slate-900 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><MapPin size={12}/> Local</div>
                <div className="font-semibold truncate" title={evento?.local_evento || 'No restaurante'}>{evento?.local_evento || 'No restaurante'}</div>
              </div>
            </div>
          </header>

          <main className="p-12 space-y-16">
            
            {/* INTRODUÇÃO */}
            <section>
              <h3 className="text-2xl font-black text-slate-900 mb-4">Olá, {evento?.cliente_nome?.split(' ')[0] || "Cliente"}!</h3>
              <p className="text-slate-900 leading-relaxed">
                É um prazer apresentar a nossa proposta gastronômica para o seu evento <strong className="text-slate-900">{evento?.nome_evento}</strong>. 
                Nossa equipe elaborou um cardápio cuidadosamente selecionado para proporcionar uma experiência inesquecível aos seus convidados,
                aliando excelência no sabor e um serviço impecável.
              </p>
            </section>

            {/* O CARDÁPIO - COZINHA */}
            {pratosCozinha.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-4">
                  <ChefHat className="text-emerald-600" size={28}/>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Menu de Gastronomia</h3>
                </div>
                
                <ul className="space-y-4">
                  {pratosCozinha.map((prato, idx) => (
                    <li key={idx} className="flex gap-4 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0"></div>
                      <div>
                        <strong className="block text-slate-800 text-lg">{prato.nome}</strong>
                        <p className="text-slate-900 text-sm">Serviço incluso na experiência gastronômica.</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* O CARDÁPIO - BAR */}
            {pratosBar.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-4">
                  <Wine className="text-rose-600" size={28}/>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Carta de Bebidas & Bar</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pratosBar.map((bebida, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">🍷</div>
                      <strong className="text-slate-800">{bebida.nome}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* INVESTIMENTO */}
            <section className="bg-white border border-slate-200 rounded-3xl p-8">
              <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">Investimento</h3>
              
              <div className="flex justify-between items-center mb-6">
                <span className="text-slate-900 font-medium">Valor por Convidado ({evento?.capacidade || 0} pax)</span>
                <span className="text-lg font-bold text-slate-900">
                  {fmtReais(valorCobrado / Math.max(convidados, 1))}
                </span>
              </div>
              
              <div className="h-px w-full bg-slate-200 mb-6"></div>

              <div className="flex justify-between items-center">
                <span className="text-xl font-black text-slate-900">Total do Evento</span>
                <span className="text-3xl font-black text-emerald-600 tracking-tighter">
                  {fmtReais(valorCobrado)}
                </span>
              </div>

              <div className="mt-8 bg-white p-4 rounded-xl text-sm text-slate-900">
                <strong>Condições de Pagamento:</strong> O evento é confirmado mediante o pagamento do sinal de reserva. O valor restante deve ser quitado de acordo com a política de contratação do restaurante.
              </div>
            </section>

          </main>

          <footer className="bg-slate-900 text-slate-800 text-center py-8 text-sm mt-12">
            Este é um documento gerado automaticamente. Válido por 15 dias após a emissão.
          </footer>

        </div>
      </div>

    </div>
  );
}
