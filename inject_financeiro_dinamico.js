const fs = require('fs');

let p = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');

const regexFinanceiro = /\{activeTab === "financeiro" && \([\s\S]*?<\/button>\s*<\/section>\s*<\/div>\s*<\/div>\s*\)\}/;

const dynamicFinanceiro = `
        {activeTab === "financeiro" && (() => {
          const custoInsumos = evento.total_custo_insumos || 0;
          const custoEquipe = evento.total_custo_equipe || 0;
          const custoAluguel = Number(evento.custo_aluguel_espaco || 0);
          const taxaImpostoPct = Number(evento.taxa_imposto_pct || 6);
          const taxaMaquininhaPct = Number(evento.taxa_maquininha_pct || 2.5);
          
          const totalCustosFisicos = custoInsumos + custoEquipe + custoAluguel;
          
          // O valor cobrado poderia ser input livre, mas vou usar o valor_contratado
          const valorCobrado = Number(evento.valor_contratado || 0);
          
          const deducoesFiscais = valorCobrado * (taxaImpostoPct / 100);
          const deducoesMaquininha = valorCobrado * (taxaMaquininhaPct / 100);
          const totalDeducoes = deducoesFiscais + deducoesMaquininha;
          
          const lucroLiquido = valorCobrado - totalCustosFisicos - totalDeducoes;
          const margemLiquida = valorCobrado > 0 ? (lucroLiquido / valorCobrado) * 100 : 0;

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <section className="bg-white border border-slate-200 rounded-3xl p-6">
                  <header className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-900">Precificação e Orçamento</h2>
                    <span className="text-slate-500 font-bold text-sm">Atualizado ao vivo</span>
                  </header>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Custo de Insumos (Cardápio e Bar)</strong>
                        <span className="text-sm text-slate-500">Calculado automaticamente das fichas técnicas</span>
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
                        <input type="number" value={custoAluguel} onChange={e => {
                          // atualiza o evento no state, e precisaria chamar o banco
                        }} disabled className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right text-slate-700 outline-none focus:border-emerald-600" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Impostos (Ex: Simples Nacional)</strong>
                        <span className="text-sm text-slate-500">Deduzido do valor total bruto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" value={taxaImpostoPct} disabled className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right text-slate-700 outline-none focus:border-emerald-600" />
                        <span className="font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Taxa de Maquininha</strong>
                        <span className="text-sm text-slate-500">Custo financeiro de recebimento</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" value={taxaMaquininhaPct} disabled className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right text-slate-700 outline-none focus:border-emerald-600" />
                        <span className="font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              
              <div className="space-y-6">
                <section className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg sticky top-24">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Resumo de Lucratividade</h2>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Total de Custos (Físicos)</span>
                      <strong className="text-red-400">R$ {totalCustosFisicos.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Impostos e Taxas</span>
                      <strong className="text-red-400">R$ {totalDeducoes.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                    <div className="h-px bg-slate-800 w-full my-4"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Valor Cobrado (Bruto)</span>
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

                  <button className="w-full mt-6 h-12 rounded-xl bg-white text-slate-900 font-black hover:bg-slate-100 transition-colors">
                    Gerar PDF de Proposta
                  </button>
                </section>
              </div>
            </div>
          );
        })()}
`;

p = p.replace(regexFinanceiro, dynamicFinanceiro);
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', p, 'utf-8');
console.log('Injected Dynamic Financeiro');
