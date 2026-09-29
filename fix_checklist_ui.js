const fs = require('fs');

let c = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');

const regex = /<section className="bg-white border border-slate-200 rounded-3xl p-6">[\s\S]*?<\/section>/;

const novoChecklist = `<section className="bg-white border border-slate-200 rounded-3xl p-6">
                <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Activity className="text-emerald-600" /> Indicadores de Prontidão
                </h2>
                
                {(() => {
                  const items = [
                    { id: 'cardapio', empty: 'Cardápio não definido', done: 'Cardápio montado', isDone: (evento.cardapio_itens && evento.cardapio_itens.length > 0) },
                    { id: 'equipe', empty: 'Equipe não escalada', done: 'Equipe escalada', isDone: Number(evento.total_custo_equipe) > 0 },
                    { id: 'sinal', empty: 'Aguardando financeiro', done: 'Sinal/Pagam. recebido', isDone: (evento.historico_pagamentos && evento.historico_pagamentos.length > 0) }
                  ];
                  const progresso = Math.round((items.filter(i => i.isDone).length / items.length) * 100);
                  
                  return (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status da Organização</span>
                        <span className="text-sm font-black text-emerald-600">{progresso}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6">
                        <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: \`\${progresso}%\` }}></div>
                      </div>
                      
                      <div className="space-y-3">
                        {items.map(item => (
                          <div key={item.id} className={\`flex items-center gap-3 p-3 rounded-xl border \${item.isDone ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}\`}>
                            <div className={\`w-6 h-6 rounded-full flex items-center justify-center shrink-0 \${item.isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}\`}>
                              <CheckCircle2 size={14} />
                            </div>
                            <span className={\`font-bold \${item.isDone ? 'text-emerald-700' : 'text-slate-500'}\`}>
                              {item.isDone ? item.done : item.empty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </section>`;

c = c.replace(regex, novoChecklist);

fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', c, 'utf-8');
console.log('Checklist atualizado para automático!');
