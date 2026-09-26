"use client";

import { useState } from "react";
import supabase from "../../../../../lib/supabase";
import { Plus, Trash2, Wallet, DollarSign, Loader2, CheckCircle2 } from "lucide-react";

export default function FinanceiroTab({ evento, onUpdate }) {
  const [salvando, setSalvando] = useState(false);
  const [novoPagamento, setNovoPagamento] = useState({ valor: "", data: new Date().toISOString().split("T")[0], metodo: "PIX", obs: "Sinal 50%" });

  // Valores base
  const custoInsumos = evento?.total_custo_insumos || 0;
  const custoEquipe = evento?.total_custo_equipe || 0;
  
  // Parâmetros editáveis
  const [custoAluguel, setCustoAluguel] = useState(Number(evento?.custo_aluguel_espaco || 0));
  const [taxaImpostoPct, setTaxaImpostoPct] = useState(Number(evento?.taxa_imposto_pct || 6));
  const [taxaMaquininhaPct, setTaxaMaquininhaPct] = useState(Number(evento?.taxa_maquininha_pct || 2.5));
  const [valorCobrado, setValorCobrado] = useState(Number(evento?.valor_contratado || 0));

  const pagamentos = evento?.historico_pagamentos || [];

  // Cálculos DRE
  const totalCustosFisicos = custoInsumos + custoEquipe + custoAluguel;
  const deducoesFiscais = valorCobrado * (taxaImpostoPct / 100);
  const deducoesMaquininha = valorCobrado * (taxaMaquininhaPct / 100);
  const totalDeducoes = deducoesFiscais + deducoesMaquininha;
  
  const lucroLiquido = valorCobrado - totalCustosFisicos - totalDeducoes;
  const margemLiquida = valorCobrado > 0 ? (lucroLiquido / valorCobrado) * 100 : 0;

  // Cálculos Recebimento
  const totalRecebido = pagamentos.reduce((acc, p) => acc + Number(p.valor), 0);
  const saldoPendente = valorCobrado - totalRecebido;

  const salvarParametros = async () => {
    setSalvando(true);
    const updates = {
      custo_aluguel_espaco: custoAluguel,
      taxa_imposto_pct: taxaImpostoPct,
      taxa_maquininha_pct: taxaMaquininhaPct,
      valor_contratado: valorCobrado
    };
    
    const { error } = await supabase.from("eventos").update(updates).eq("id", evento.id);
    if (!error && onUpdate) onUpdate(updates);
    setSalvando(false);
  };

  const registrarPagamento = async () => {
    if (!novoPagamento.valor) return;
    setSalvando(true);
    
    const id = crypto.randomUUID();
    const novaLista = [...pagamentos, { ...novoPagamento, id, valor: Number(novoPagamento.valor) }];
    
    const { error } = await supabase.from("eventos").update({ historico_pagamentos: novaLista }).eq("id", evento.id);
    if (!error && onUpdate) onUpdate({ historico_pagamentos: novaLista });
    
    setNovoPagamento({ valor: "", data: new Date().toISOString().split("T")[0], metodo: "PIX", obs: "" });
    setSalvando(false);
  };

  const removerPagamento = async (idRemover) => {
    setSalvando(true);
    const novaLista = pagamentos.filter(p => p.id !== idRemover);
    const { error } = await supabase.from("eventos").update({ historico_pagamentos: novaLista }).eq("id", evento.id);
    if (!error && onUpdate) onUpdate({ historico_pagamentos: novaLista });
    setSalvando(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Lado Esquerdo: Parâmetros e Pagamentos */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Bloco 1: DRE e Custos */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6">
          <header className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2"><DollarSign className="text-emerald-600"/> Engenharia de Custos</h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Configure os impostos e custos fixos para travar a margem.</p>
            </div>
            <button onClick={salvarParametros} disabled={salvando} className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold flex items-center gap-2 hover:bg-slate-100 disabled:opacity-50">
              {salvando ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
              Salvar DRE
            </button>
          </header>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
              <div>
                <strong className="block text-slate-800">Custo de Insumos (Cardápio e Bar)</strong>
                <span className="text-sm text-slate-500">Calculado automaticamente</span>
              </div>
              <span className="text-lg font-black text-red-600">- R$ {custoInsumos.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            
            <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
              <div>
                <strong className="block text-slate-800">Custo de Equipe (Diárias)</strong>
                <span className="text-sm text-slate-500">Soma da aba Equipe</span>
              </div>
              <span className="text-lg font-black text-red-600">- R$ {custoEquipe.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>

            <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
              <div>
                <strong className="block text-slate-800">Aluguel do Espaço / Custos Fixos</strong>
                <span className="text-sm text-slate-500">Locação, fretes, limpeza extra</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-400">R$</span>
                <input type="number" value={custoAluguel} onChange={e => setCustoAluguel(Number(e.target.value))} className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-right outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600" />
              </div>
            </div>

            <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
              <div>
                <strong className="block text-slate-800">Impostos (Ex: Simples Nacional)</strong>
                <span className="text-sm text-slate-500">Deduzido do valor total bruto</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={taxaImpostoPct} onChange={e => setTaxaImpostoPct(Number(e.target.value))} className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-right outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600" />
                <span className="font-bold text-slate-400">%</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
              <div>
                <strong className="block text-slate-800">Taxa de Maquininha</strong>
                <span className="text-sm text-slate-500">Custo financeiro de recebimento</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={taxaMaquininhaPct} onChange={e => setTaxaMaquininhaPct(Number(e.target.value))} className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-right outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600" />
                <span className="font-bold text-slate-400">%</span>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 border-2 border-emerald-500 rounded-2xl bg-emerald-50">
              <div>
                <strong className="block text-emerald-900">VALOR COBRADO DO CLIENTE</strong>
                <span className="text-sm text-emerald-700">Total bruto fechado no contrato</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-700">R$</span>
                <input type="number" value={valorCobrado} onChange={e => setValorCobrado(Number(e.target.value))} className="w-32 bg-white border-2 border-emerald-300 rounded-xl px-3 py-2 font-black text-right text-emerald-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600" />
              </div>
            </div>
          </div>
        </section>

        {/* Bloco 2: Extrato de Recebimentos */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6">
          <header className="mb-6">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2"><Wallet className="text-blue-600"/> Controle de Pagamentos (Sinal)</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Registre as parcelas e recebimentos do cliente.</p>
          </header>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input type="number" placeholder="Valor (R$)" value={novoPagamento.valor} onChange={e => setNovoPagamento({...novoPagamento, valor: e.target.value})} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:border-blue-600 focus:bg-white" />
            <select value={novoPagamento.metodo} onChange={e => setNovoPagamento({...novoPagamento, metodo: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:border-blue-600 focus:bg-white">
              <option value="PIX">PIX</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Transferência">Transferência</option>
            </select>
            <input type="date" value={novoPagamento.data} onChange={e => setNovoPagamento({...novoPagamento, data: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:border-blue-600 focus:bg-white" />
            <input type="text" placeholder="Obs (ex: Sinal 50%)" value={novoPagamento.obs} onChange={e => setNovoPagamento({...novoPagamento, obs: e.target.value})} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-600 focus:bg-white" />
            <button onClick={registrarPagamento} disabled={salvando || !novoPagamento.valor} className="h-[46px] px-6 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
              <Plus size={16}/> Lançar
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider">Data</th>
                  <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider">Método</th>
                  <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider">Descrição</th>
                  <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Valor</th>
                  <th className="py-3 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagamentos.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400 font-medium">Nenhum pagamento registrado.</td>
                  </tr>
                )}
                {pagamentos.map(pag => (
                  <tr key={pag.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-700">{new Date(pag.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                    <td className="py-3 px-4 font-bold text-slate-700">{pag.metodo}</td>
                    <td className="py-3 px-4 text-slate-500">{pag.obs}</td>
                    <td className="py-3 px-4 font-black text-emerald-600 text-right">R$ {Number(pag.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => removerPagamento(pag.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan="3" className="py-4 px-4 text-right font-bold text-slate-500">Total Recebido:</td>
                  <td className="py-4 px-4 text-right font-black text-emerald-700 text-lg">R$ {totalRecebido.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

      </div>
      
      {/* Lado Direito: Dashboards / Resumo */}
      <div className="space-y-6">
        
        {/* Resumo de Recebimento */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Status de Pagamento</h2>
          
          <div className="space-y-2 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Contrato Fechado</span>
              <strong className="text-slate-900">R$ {valorCobrado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Já Recebido</span>
              <strong className="text-emerald-600">R$ {totalRecebido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>
          </div>
          
          <div className="h-px bg-slate-200 w-full mb-6"></div>

          <div className="flex justify-between items-end mb-4">
            <span className="font-black text-slate-800">Saldo a Receber</span>
            <strong className={\`text-2xl font-black \${saldoPendente > 0 ? 'text-red-600' : 'text-slate-400'}\`}>R$ {saldoPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
          </div>
          
          {saldoPendente <= 0 && valorCobrado > 0 && (
            <div className="bg-emerald-100 text-emerald-800 rounded-xl p-3 text-center font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2">
              <CheckCircle2 size={18}/> 100% Quitado
            </div>
          )}
        </section>

        {/* Resumo de Lucratividade Escura */}
        <section className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl sticky top-24">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">DRE Projetado</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Total de Custos Físicos</span>
              <strong className="text-red-400">R$ {totalCustosFisicos.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Impostos e Taxas</span>
              <strong className="text-red-400">R$ {totalDeducoes.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
            </div>
            <div className="h-px bg-slate-800 w-full my-4"></div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Receita Bruta</span>
              <strong className="text-white text-xl">R$ {valorCobrado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
            </div>
          </div>

          <div className={\`border rounded-2xl p-4 mt-8 \${margemLiquida >= 20 ? 'bg-emerald-500/20 border-emerald-500/30' : margemLiquida >= 0 ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30'}\`}>
            <span className={\`block text-sm font-bold mb-1 \${margemLiquida >= 20 ? 'text-emerald-400' : margemLiquida >= 0 ? 'text-yellow-400' : 'text-red-400'}\`}>Lucro Líquido Real</span>
            <div className="flex justify-between items-end">
              <strong className={\`text-3xl font-black \${margemLiquida >= 20 ? 'text-emerald-400' : margemLiquida >= 0 ? 'text-yellow-400' : 'text-red-400'}\`}>R$ {lucroLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
              <span className={\`font-bold px-2 py-1 rounded-lg text-sm \${margemLiquida >= 20 ? 'text-emerald-400 bg-emerald-900' : margemLiquida >= 0 ? 'text-yellow-400 bg-yellow-900' : 'text-red-400 bg-red-900'}\`}>{margemLiquida.toFixed(1)}%</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
