const fs = require('fs');

const tabEquipe = `
        {activeTab === "equipe" && (
          <div className="space-y-6">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Escala da Equipe</h2>
                <p className="text-slate-500 font-medium">Controle de funcionários e freelancers (diárias)</p>
              </div>
              <button className="h-10 px-4 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800">
                Escalar Pessoa
              </button>
            </header>
            
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Nome</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Setor</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Função</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Custo (Diária)</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Placeholder estático por enquanto */}
                  <tr className="hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <strong className="block text-slate-900 font-bold">Carlos Silva (Fixo)</strong>
                      <span className="text-sm text-slate-500">Funcionário CLT</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-700">Cozinha</td>
                    <td className="py-4 px-6 font-bold text-slate-700">Chef de Praça</td>
                    <td className="py-4 px-6 font-black text-red-600">R$ 180,00</td>
                    <td className="py-4 px-6"><span className="px-2 py-1 bg-yellow-100 text-yellow-800 font-bold text-xs rounded-lg uppercase">Pendente</span></td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <strong className="block text-slate-900 font-bold">Amanda Souza (Freelancer)</strong>
                      <span className="text-sm text-slate-500">(11) 90000-0000</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-700">Salão</td>
                    <td className="py-4 px-6 font-bold text-slate-700">Garçom</td>
                    <td className="py-4 px-6 font-black text-red-600">R$ 150,00</td>
                    <td className="py-4 px-6"><span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg uppercase">Pago</span></td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-slate-50 border-t border-slate-200 p-4 text-right">
                <span className="text-slate-500 font-bold mr-4">Total de Diárias:</span>
                <span className="text-xl font-black text-red-700">R$ 330,00</span>
              </div>
            </div>
          </div>
        )}
`;

const tabFinanceiro = `
        {activeTab === "financeiro" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white border border-slate-200 rounded-3xl p-6">
                <h2 className="text-lg font-black text-slate-900 mb-6">Precificação e Orçamento</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                    <div>
                      <strong className="block text-slate-800">Custo de Insumos (Cardápio e Bar)</strong>
                      <span className="text-sm text-slate-500">Calculado automaticamente das fichas técnicas</span>
                    </div>
                    <span className="text-lg font-black text-red-600">- R$ 1.250,00</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                    <div>
                      <strong className="block text-slate-800">Custo de Equipe (Diárias)</strong>
                      <span className="text-sm text-slate-500">Soma da aba Equipe</span>
                    </div>
                    <span className="text-lg font-black text-red-600">- R$ 330,00</span>
                  </div>

                  <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                    <div>
                      <strong className="block text-slate-800">Aluguel do Espaço / Custos Fixos</strong>
                      <span className="text-sm text-slate-500">Locação, fretes, limpeza extra</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400">R$</span>
                      <input type="number" defaultValue="500" className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right outline-none focus:border-emerald-600" />
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                    <div>
                      <strong className="block text-slate-800">Impostos (Simples Nacional, etc)</strong>
                      <span className="text-sm text-slate-500">Deduzido do valor total bruto</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="6.0" className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right outline-none focus:border-emerald-600" />
                      <span className="font-bold text-slate-400">%</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                    <div>
                      <strong className="block text-slate-800">Taxa de Maquininha</strong>
                      <span className="text-sm text-slate-500">Custo financeiro de recebimento</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="2.5" className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right outline-none focus:border-emerald-600" />
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
                    <span className="text-slate-300">Total de Custos (R$)</span>
                    <strong className="text-red-400">R$ 2.080,00</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Impostos e Taxas</span>
                    <strong className="text-red-400">R$ 425,00</strong>
                  </div>
                  <div className="h-px bg-slate-800 w-full my-4"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Valor Cobrado (Bruto)</span>
                    <strong className="text-white text-xl">R$ 5.000,00</strong>
                  </div>
                </div>

                <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 mt-8">
                  <span className="block text-sm font-bold text-emerald-400 mb-1">Lucro Líquido Real</span>
                  <div className="flex justify-between items-end">
                    <strong className="text-3xl font-black text-emerald-400">R$ 2.495,00</strong>
                    <span className="text-emerald-400 font-bold bg-emerald-900 px-2 py-1 rounded-lg text-sm">49,9%</span>
                  </div>
                </div>

                <button className="w-full mt-6 h-12 rounded-xl bg-white text-slate-900 font-black hover:bg-slate-100 transition-colors">
                  Salvar Precificação
                </button>
              </section>
            </div>
          </div>
        )}
`;

let p = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');

// The original fallback looks like this:
const fallbackRegex = /\{\/\* \.\.\. Outras abas \(serão expandidas depois\) \*\/\}([\s\S]*?)<\/div>/;

p = p.replace(fallbackRegex, 
  tabEquipe + '\n' + tabFinanceiro + '\n' + 
  `        {activeTab !== "resumo" && activeTab !== "cardapio" && activeTab !== "equipe" && activeTab !== "financeiro" && (
           <div className="text-center p-12 bg-white border border-slate-200 rounded-3xl">
           <h2 className="text-xl font-bold text-slate-800 mb-2">Aba {TABS.find(t=>t.id === activeTab)?.label}</h2>
           <p className="text-slate-500 max-w-md mx-auto">
             Módulo em construção (Próximas Fases).
           </p>
         </div>
        )}
      </div>`
);

fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', p, 'utf-8');
console.log('Injetou as abas de equipe e financeiro.');
