const fs = require('fs');

let content = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');

// 1. Change the grid container to a flex container
content = content.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">',
  '<div className="flex flex-col gap-3">'
);

// 2. We need to replace the entire return of the IIFE or the card itself.
// The card starts at: `<div\n                       key={f.id}`
// And ends at the closing `</div>` of the map.
// Let's find the exact indices.

const cardStartIndex = content.indexOf('className={`erp-fichas-card');
if (cardStartIndex === -1) {
    console.error("Could not find erp-fichas-card");
    process.exit(1);
}

// I will just use a regex to replace the content of the card, but keeping the dynamic variables.
// The IIFE starts at `{(() => {` and ends at `})()}`
// Actually, it's easier to replace the entire `return (` block inside the IIFE.
const iifeReturnStart = content.indexOf('return (', cardStartIndex);
const iifeEnd = content.indexOf('})()}', iifeReturnStart);

if (iifeReturnStart !== -1 && iifeEnd !== -1) {
  const newReturn = `return (
                             <div className="flex flex-col gap-3 w-full">
                               {/* Novo Layout Premium Horizontal */}
                               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
                                  
                                  {/* Info Principal */}
                                  <div className="flex items-center gap-3 w-full sm:w-[35%] min-w-0">
                                     <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-line-soft shrink-0 overflow-hidden flex items-center justify-center">
                                        {f.imagem ? (
                                           <img src={f.imagem.startsWith('data:') ? f.imagem : \`data:image/jpeg;base64,\${f.imagem}\`} className="w-full h-full object-cover" alt={f.nome_receita}/>
                                        ) : (
                                           <UtensilsCrossed size={20} className="text-slate-300" />
                                        )}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                           <span className={\`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider \${f.eh_base ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}\`}>
                                              {f.eh_base ? "Preparo" : "Prato"}
                                           </span>
                                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                                              {f.categoria || "Sem Categoria"}
                                           </span>
                                        </div>
                                        <h3 onClick={() => abrirFicha(f)} className="text-base font-black text-slate-900 truncate cursor-pointer hover:text-emerald-600 transition-colors">
                                           {f.nome_receita}
                                        </h3>
                                     </div>
                                  </div>

                                  {/* KPIs */}
                                  <div className="flex items-center justify-between sm:justify-around gap-4 w-full sm:w-[45%]">
                                     <div className="flex flex-col">
                                        <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rendimento</span>
                                        <span className="text-sm font-black text-slate-700">{rendimentoTexto}</span>
                                     </div>
                                     
                                     {podeVerCustos ? (
                                       <>
                                         <div className="flex flex-col">
                                            <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Custo/Porção</span>
                                            <span className="text-sm font-black text-slate-900">{fmtBRL(custoIngred)}</span>
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Venda Sugerida</span>
                                            <span className="text-sm font-black text-emerald-700">{precoPorcao > 0 ? fmtBRL(precoPorcao) : "—"}</span>
                                         </div>
                                       </>
                                     ) : (
                                       <div className="flex flex-col">
                                          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Itens</span>
                                          <span className="text-sm font-black text-slate-700">{composicaoCount} itens</span>
                                       </div>
                                     )}
                                  </div>

                                  {/* Opcional: Pizza se ativo */}
                                  {podeVerCustos && verPizza && (
                                     <div className="w-full sm:w-[20%]">
                                        <PizzaDoPrato compacta
                                          preco={precoPorcao}
                                          custoIngredientes={custoIngred}
                                          custoEmbalagem={custoEmb}
                                          impostoPct={f.eh_base ? 0 : impostoPct}
                                          taxaMaquininhaPct={f.eh_base ? 0 : taxaMaqPct}
                                          params={paramsSis} />
                                     </div>
                                  )}
                               </div>
                             </div>
                           );
                          `;

  content = content.substring(0, iifeReturnStart) + newReturn + '\n                          ' + content.substring(iifeEnd);
}

// 3. We must remove the top row that has "checkbox" and "editar" since it's redundant now, 
// OR we integrate it into the card properly!
// Actually, I just completely rewrote the IIFE. BUT the Top Row is ABOVE the IIFE!
// Let's fix the whole card.

