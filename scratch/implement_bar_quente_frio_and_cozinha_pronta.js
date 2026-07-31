const fs = require('fs');

const estoqueFile = 'app/dashboard/operacao/estoque/page.js';
let estoqueContent = fs.readFileSync(estoqueFile, 'utf8');

// 1. Add sub-header filters for Bar (Gelado/Quente) and Cozinha (Insumos / Resfriados / Congelados)
const oldSubHeaderFilter = `                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
                        {grupos.map(grupo => (
                          <button
                            key={grupo}
                            onClick={() => setFiltros(atuais => ({ ...atuais, grupo }))}
                            className={\`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold transition \${filtros.grupo === grupo ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}\`}
                          >
                            {grupo} <span className={filtros.grupo === grupo ? "text-emerald-100" : "text-slate-400"}>({contagemGrupos[grupo] || 0})</span>
                          </button>
                        ))}
                      </div>`;

const newSubHeaderFilter = `                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
                        {grupos.map(grupo => (
                          <button
                            key={grupo}
                            onClick={() => setFiltros(atuais => ({ ...atuais, grupo }))}
                            className={\`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold transition \${filtros.grupo === grupo ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}\`}
                          >
                            {grupo} <span className={filtros.grupo === grupo ? "text-emerald-100" : "text-slate-400"}>({contagemGrupos[grupo] || 0})</span>
                          </button>
                        ))}
                      </div>
                      
                      {/* Bar Temperature / Cozinha Ready Food Quick Filter Badges */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        {estoqueAtual?.departamento === "bar" || estoqueAtual?.slug === "bar" ? (
                          <>
                            <span className="text-xs font-black text-slate-500 mr-1">Filtro de Temperatura do Bar:</span>
                            {[
                              ["todos_temp", "Todos os Itens"],
                              ["apenas_gelado", "🧊 Apenas Gelados (Expositor)"],
                              ["apenas_quente", "🔥 Apenas Quentes (Depósito)"],
                            ].map(([id, label]) => (
                              <button
                                key={id}
                                onClick={() => setFiltros(atuais => ({ ...atuais, tempBar: id }))}
                                className={\`rounded-lg px-3 py-1.5 text-xs font-bold transition \${(filtros.tempBar || "todos_temp") === id ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}\`}
                              >
                                {label}
                              </button>
                            ))}
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-black text-slate-500 mr-1">Estado das Comidas & Insumos:</span>
                            {[
                              ["todos_estado", "Todos os Itens"],
                              ["insumos", "📦 Insumos Brutos"],
                              ["resfriados", "❄️ Comidas Prontas (Resfriadas)"],
                              ["congelados", "🧊 Comidas Prontas (Congeladas)"],
                            ].map(([id, label]) => (
                              <button
                                key={id}
                                onClick={() => setFiltros(atuais => ({ ...atuais, estadoCozinha: id }))}
                                className={\`rounded-lg px-3 py-1.5 text-xs font-bold transition \${(filtros.estadoCozinha || "todos_estado") === id ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}\`}
                              >
                                {label}
                              </button>
                            ))}
                          </>
                        )}
                      </div>`;

estoqueContent = estoqueContent.replace(/\r\n/g, '\n');
const oldSubHeaderFilterNorm = oldSubHeaderFilter.replace(/\r\n/g, '\n');
if (estoqueContent.includes(oldSubHeaderFilterNorm)) {
  estoqueContent = estoqueContent.replace(oldSubHeaderFilterNorm, newSubHeaderFilter);
  console.log("Successfully added Bar/Cozinha temperature sub-header filter buttons!");
} else {
  console.log("oldSubHeaderFilterNorm not found");
}

fs.writeFileSync(estoqueFile, estoqueContent);
