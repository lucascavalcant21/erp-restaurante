const fs = require('fs');

let p = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');

// 1. Inserir Imports
p = p.replace('import CardapioTab from "./CardapioTab";', 'import CardapioTab from "./CardapioTab";\nimport ComprasTab from "./ComprasTab";\nimport PropostaTab from "./PropostaTab";');

// 2. Modificar o badge de status para um dropdown.
// O código atual é algo como:
// <span className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">
//   {evento.funil_status || "NOVO CONTATO"}
// </span>
const statusDropdown = `
                <select 
                  value={evento.funil_status || "NOVO CONTATO"}
                  onChange={async (e) => {
                    const novoStatus = e.target.value;
                    setEvento({...evento, funil_status: novoStatus});
                    await supabase.from("eventos").update({funil_status: novoStatus}).eq("id", evento.id);
                  }}
                  className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-widest outline-none cursor-pointer appearance-none text-center"
                >
                  <option value="NOVO CONTATO">NOVO CONTATO</option>
                  <option value="PROPOSTA ENVIADA">PROPOSTA ENVIADA</option>
                  <option value="NEGOCIAÇÃO">NEGOCIAÇÃO</option>
                  <option value="APROVADO">APROVADO</option>
                  <option value="AGUARDANDO SINAL">AGUARDANDO SINAL</option>
                  <option value="CONFIRMADO">CONFIRMADO</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>
`;
p = p.replace(/<span className="bg-slate-900 text-white text-xs font-black px-2\.5 py-1 rounded-lg uppercase tracking-widest">\s*\{evento\.funil_status \|\| "NOVO CONTATO"\}\s*<\/span>/, statusDropdown);

// 3. Modificar o Checklist na aba Resumo
// O código atual do checklist:
const regexChecklist = /<div className="space-y-3">[\s\S]*?<\/div>\s*<\/section>/;

const novoChecklist = `
                <div className="space-y-3">
                  {[
                    { id: 'cardapio', label: 'Cardápio definido?' },
                    { id: 'sinal', label: 'Sinal pago?' },
                    { id: 'equipe', label: 'Equipe escalada?' },
                    { id: 'compras', label: 'Compras realizadas?' }
                  ].map(item => {
                    const checklistAtual = evento.checklist || { cardapio: false, sinal: false, equipe: false, compras: false };
                    const isChecked = checklistAtual[item.id] === true;
                    
                    return (
                      <label key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={async (e) => {
                            const newChecklist = { ...checklistAtual, [item.id]: e.target.checked };
                            setEvento({ ...evento, checklist: newChecklist });
                            await supabase.from("eventos").update({ checklist: newChecklist }).eq("id", evento.id);
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" 
                        />
                        <span className="font-bold text-slate-700">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
`;

p = p.replace(regexChecklist, novoChecklist);

// 4. Inserir Proposta e Compras no final
const regexFallback = /\{activeTab !== "resumo" &&[\s\S]*?<\/div>\s*\)\}/;

const novoFallback = `
        {activeTab === "compras" && (
          <ComprasTab evento={evento} unidadeAtiva={unidadeAtiva} />
        )}
        
        {activeTab === "proposta" && (
          <PropostaTab evento={evento} />
        )}

        {activeTab !== "resumo" && activeTab !== "cardapio" && activeTab !== "equipe" && activeTab !== "financeiro" && activeTab !== "compras" && activeTab !== "proposta" && (
           <div className="text-center p-12 bg-white border border-slate-200 rounded-3xl">
           <h2 className="text-xl font-bold text-slate-800 mb-2">Aba {TABS.find(t=>t.id === activeTab)?.label}</h2>
           <p className="text-slate-500 max-w-md mx-auto">
             Módulo em construção (Próximas Fases).
           </p>
         </div>
        )}
`;

p = p.replace(regexFallback, novoFallback);

fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', p, 'utf-8');
console.log('Modifications applied');
