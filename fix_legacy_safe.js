const fs = require('fs');

let p = fs.readFileSync('app/dashboard/operacao/orcamento/page.js', 'utf-8');

// 1. Remover Sticky
p = p.replace('sticky top-0 z-10', 'relative');

// 2. Excluir Ficha - Botão Vermelho visível
p = p.replace(
  '<button onClick={() => removeItem(l.produto_id)} className="p-2 text-subtle hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"><Trash2 size={16}/></button>',
  '<button onClick={() => { if(confirm("Remover " + l.nome + "?")) removeItem(l.produto_id); }} className="px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-all shrink-0 font-bold flex items-center gap-2"><Trash2 size={16}/> Excluir Ficha</button>'
);

// 3. Organizar os Utensílios por área.
const utensiliosAntigo = `<div className="space-y-2">
                                 <label className="text-3xs font-bold text-muted uppercase tracking-widest flex items-center gap-1"><ChefHat size={12}/> Utensílios / equipamentos que vou levar</label>
                                 <textarea value={evento.utensilios || ""} onChange={e=>setEvento({utensilios:e.target.value})} placeholder="Ex: 2 rechauds, panela de 20L, tábuas, réchaud de banho-maria, garfos de servir, bandejas..." className="w-full bg-slate-50 border border-line rounded-xl p-4 font-medium text-sm outline-none focus:border-emerald-500 min-h-[80px]"/>
                              </div>`;

const utensiliosNovo = `
                              <div className="space-y-4">
                                 <label className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><ChefHat size={16}/> Organização de Utensílios / Equipamentos</label>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <label className="text-xs font-bold text-emerald-700 uppercase">COZINHA (Panelas, Rechauds, etc)</label>
                                       <textarea value={(evento.utensilios || "").split("||BAR||")[0] || ""} onChange={e => {
                                         const bar = (evento.utensilios || "").split("||BAR||")[1] || "";
                                         setEvento({utensilios: e.target.value + "||BAR||" + bar});
                                       }} placeholder="Ex: 2 rechauds, panela 20L..." className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 font-medium text-sm outline-none focus:border-emerald-500 min-h-[100px]"/>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-xs font-bold text-sky-700 uppercase">BAR (Copos, Gelo, etc)</label>
                                       <textarea value={(evento.utensilios || "").split("||BAR||")[1] || ""} onChange={e => {
                                         const coz = (evento.utensilios || "").split("||BAR||")[0] || "";
                                         setEvento({utensilios: coz + "||BAR||" + e.target.value});
                                       }} placeholder="Ex: Taças, 10kg gelo, dosadores..." className="w-full bg-sky-50/50 border border-sky-100 rounded-xl p-4 font-medium text-sm outline-none focus:border-sky-500 min-h-[100px]"/>
                                    </div>
                                 </div>
                              </div>
`;
p = p.replace(utensiliosAntigo, utensiliosNovo);

const printAntigo = `{evento.utensilios && (
                           <div className="box">
                              <h3>Utensílios / Equipamentos</h3>
                              <p className="ws">{evento.utensilios}</p>
                           </div>
                        )}`;

const printNovo = `
                        {evento.utensilios && (
                           <div className="box">
                              <h3>Utensílios / Equipamentos</h3>
                              <div style={{display: 'flex', gap: '20px'}}>
                                 <div style={{flex: 1}}>
                                    <strong>COZINHA:</strong>
                                    <p className="ws">{evento.utensilios.split("||BAR||")[0] || "Nenhum informado"}</p>
                                 </div>
                                 <div style={{flex: 1}}>
                                    <strong>BAR:</strong>
                                    <p className="ws">{evento.utensilios.split("||BAR||")[1] || "Nenhum informado"}</p>
                                 </div>
                              </div>
                           </div>
                        )}`;
p = p.replace(printAntigo, printNovo);

fs.writeFileSync('app/dashboard/operacao/orcamento/page.js', p, 'utf-8');
console.log('Partial fixes applied');
