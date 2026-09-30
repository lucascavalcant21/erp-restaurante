const fs = require('fs');

let content = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');

// 1. Change grid container
content = content.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">',
  '<div className="flex flex-col gap-3">'
);

const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('fichasPagina.map(f => {'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === '})}');

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find the block boundaries.");
    process.exit(1);
}

const newMapBody = `               {fichasPagina.map(f => {
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
                  
                  return (
                     <div
                       key={f.id}
                       onDragOver={e => { if (dragId) e.preventDefault(); }}
                       onDrop={() => reordenar(dragId, f.id)}
                       className={\`erp-fichas-card bg-card rounded-2xl border p-3 sm:p-4 shadow-sm hover:shadow-md transition-all relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 \${dragId === f.id ? 'opacity-50' : ''} \${selecionadas.includes(f.id) ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-line'}\`}
                     >
                       <div className="flex items-center gap-4 min-w-0 sm:w-[35%]">
                          <label className="grid h-6 w-6 shrink-0 place-items-center rounded border border-line bg-transparent cursor-pointer">
                             <input type="checkbox" checked={selecionadas.includes(f.id)} onChange={() => toggleSelecionar(f.id)} className="h-4 w-4 cursor-pointer rounded accent-emerald-600"/>
                          </label>
                          <div className="w-14 h-14 rounded-xl bg-slate-50 border border-line overflow-hidden shrink-0 flex items-center justify-center cursor-pointer" onClick={() => abrirFicha(f)}>
                             {f.imagem ? <img src={f.imagem.startsWith('data:') ? f.imagem : \`data:image/jpeg;base64,\${f.imagem}\`} className="w-full h-full object-cover" /> : <UtensilsCrossed size={20} className="text-slate-300"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-0.5">
                                <span className={\`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider \${f.eh_base ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}\`}>
                                   {f.eh_base ? "PREPARO" : "PRATO"}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                                   {f.categoria || "SEM CATEGORIA"}
                                </span>
                             </div>
                             <h3
                               onClick={() => abrirFicha(f)}
                               className="text-base font-black text-fg truncate cursor-pointer hover:text-emerald-600 transition-colors"
                               title={f.nome_receita}
                             >
                               {f.nome_receita}
                             </h3>
                          </div>
                       </div>

                       {(() => {
                            const custoTotalIng = custoTotalDaFicha(f, fichas);
                            const rend = Number(f.rendimento_porcoes) || 1;
                            const prod = produtos.find(x => x.ficha_id === f.id || String(x.nome_produto || "").toLowerCase() === String(f.nome_receita || "").toLowerCase());
                            const precoPorcao = (prod && Number(prod.preco_venda) > 0) ? Number(prod.preco_venda) : (Number(f.preco_venda) > 0 ? Number(f.preco_venda) : 0);
                            const meta = Number(f.cmv_meta) || 30;
                            const composicaoCount = (f.fichas_ingredientes || []).length;
                            const rendimentoTexto = textoRendimentoPadronizado(f);

                            const custoEmb = Number(f.custo_embalagem) >= 0 && f.custo_embalagem !== null && f.custo_embalagem !== undefined
                              ? Number(f.custo_embalagem)
                              : (f.embalagens || []).reduce((acc, emb) => acc + (Number(emb.custo) || Number(emb.preco_unitario) || 0) * (Number(emb.qtd) || 1), 0);

                            const taxaMaqPct = Number(f.taxa_maquininha ?? prod?.taxa_cartao ?? paramsSis?.taxaMaquininha ?? paramsSis?.taxa_maquininha ?? 2.5);
                            const impostoPct = Number(f.imposto_pct ?? prod?.aliquota_imposto ?? paramsSis?.impostoPct ?? paramsSis?.imposto_pct ?? 4.0);

                            const finCard = calculateFichaFinanceiro({
                              custoTotalIngredientes: custoTotalIng,
                              rendimentoPorcoes: rend,
                              custoEmbalagemPorPorcao: custoEmb,
                              precoVenda: precoPorcao,
                              taxaMaquininhaPct: f.eh_base ? 0 : taxaMaqPct,
                              impostoPct: f.eh_base ? 0 : impostoPct,
                            });

                            const custoIngred = finCard.custoIngredientesPorPorcao;
                            const cmv = finCard.cmv;

                           return (
                             <div className="flex flex-1 items-center justify-between sm:justify-around gap-4 min-w-0">
                                <div className="flex flex-col min-w-0">
                                   <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rendimento</span>
                                   <span className="text-sm font-black text-slate-700 truncate">{rendimentoTexto}</span>
                                </div>
                                {podeVerCustos ? (
                                   <>
                                     <div className="flex flex-col min-w-0">
                                        <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Custo/Porção</span>
                                        <span className="text-sm font-black text-fg truncate">{fmtBRL(custoIngred)}</span>
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                        <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Preço Sugerido</span>
                                        <span className="text-sm font-black text-emerald-700 truncate">{precoPorcao > 0 ? fmtBRL(precoPorcao) : "—"}</span>
                                     </div>
                                   </>
                                ) : (
                                   <div className="flex flex-col min-w-0">
                                      <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Composição</span>
                                      <span className="text-sm font-black text-slate-700 truncate">{composicaoCount} itens</span>
                                   </div>
                                )}
                                <div className="hidden lg:flex flex-col min-w-0">
                                   <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</span>
                                   {statusDaFicha(f) === "inativa" ? (
                                     <span className="text-xs font-bold text-slate-500">Inativa</span>
                                   ) : statusDaFicha(f) === "rascunho" ? (
                                     <span className="text-xs font-bold text-amber-600">Rascunho</span>
                                   ) : (podeVerCustos && cmv !== null && cmv > meta) ? (
                                     <span className="text-xs font-bold text-red-500">CMV Alto</span>
                                   ) : (
                                     <span className="text-xs font-bold text-emerald-600">Ativa</span>
                                   )}
                                </div>
                             </div>
                           );
                       })()}

                       <div className="flex items-center gap-1.5 shrink-0 mt-2 sm:mt-0 relative">
                         <button
                           onClick={() => abrirEditar(f)}
                           className="h-9 px-4 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition-colors hidden sm:flex items-center"
                         >
                           Editar
                         </button>
                         <button
                           onClick={() => setAcoesCardAberto(atual => atual === f.id ? "" : f.id)}
                           title="Mais opções"
                           className="h-9 w-9 rounded-xl border border-line bg-transparent text-slate-500 hover:text-fg flex items-center justify-center hover:bg-slate-50"
                         >
                           <MoreVertical size={16} />
                         </button>
                         
                         {acoesCardAberto === f.id && (
                           <div className="absolute right-0 top-11 z-[60] w-48 bg-card border border-line rounded-2xl shadow-xl p-1.5 flex flex-col gap-1">
                             <button onClick={() => { setAcoesCardAberto(""); abrirFicha(f); }} className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 text-fg font-bold text-xs text-left flex items-center gap-2"><BookOpen size={14}/> Ver Ficha</button>
                             <button onClick={() => router.push(\`/dashboard/operacao/fichas/\${f.id}\`)} className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 text-fg font-bold text-xs text-left flex items-center gap-2"><LayoutList size={14}/> Engenharia</button>
                             {!f.eh_base && <button onClick={() => router.push(\`/dashboard/operacao/montagem?dept=\${f.departamento || deptUrl}&q=\${encodeURIComponent(f.nome_receita)}\`)} className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 text-fg font-bold text-xs text-left flex items-center gap-2"><CheckSquare2 size={14}/> Montagem</button>}
                             <button onClick={() => abrirSimulacao(f)} className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 text-fg font-bold text-xs text-left flex items-center gap-2"><Calculator size={14}/> Simular Custos</button>
                             <button onClick={() => abrirPreviaImpressao("imprimir", [f])} className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 text-fg font-bold text-xs text-left flex items-center gap-2"><Printer size={14}/> Imprimir Ficha</button>
                             <button onClick={() => { setAcoesCardAberto(""); baixarPdfFichas([f]); }} className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 text-fg font-bold text-xs text-left flex items-center gap-2"><FileDown size={14}/> Baixar PDF</button>
                             <div className="h-px w-full bg-line-soft my-0.5"></div>
                             <button onClick={() => excluirImediatamente([f])} className="w-full px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 font-bold text-xs text-left flex items-center gap-2"><Trash2 size={14}/> Excluir Receita</button>
                           </div>
                         )}
                       </div>
                     </div>
                  );
               }`;

lines.splice(startIdx, endIdx - startIdx + 1, newMapBody);

fs.writeFileSync('app/dashboard/operacao/fichas/page.js', lines.join('\n'));
console.log('List fully refactored to Premium Horizontal Cards!');
