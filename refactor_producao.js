const fs = require('fs');

let content = fs.readFileSync('app/dashboard/operacao/producao/page.js', 'utf-8');

// 1. Change grid container
content = content.replace(
  '<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">',
  '<div className="flex flex-col gap-3">'
);

// 2. We need to replace the entire map body
const mapStart = content.indexOf('{fichasFiltradas.map(f => {');
const returnStart = content.indexOf('return (', mapStart);
const mapEnd = content.indexOf('                  );\n               })}\n            </div>', returnStart);

if (mapStart === -1 || returnStart === -1 || mapEnd === -1) {
    console.error("Could not find boundaries.");
    process.exit(1);
}

const newReturn = `return (
                  <button
                     key={f.id}
                     onClick={() => abrirProduzir(f)}
                     className="bg-card p-3 sm:p-4 rounded-2xl border border-line shadow-sm hover:shadow-md transition-all relative group text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full"
                  >
                     <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
                        <span className={\`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border border-line bg-white text-emerald-600\`}>
                           {f.departamento === 'bar' ? <Wine size={20}/> : <UtensilsCrossed size={20}/>}
                        </span>
                        <div className="flex flex-col min-w-0">
                           <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">{f.nome_receita}</h3>
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{f.fichas_ingredientes?.length || 0} Ingredientes</p>
                        </div>
                     </div>

                     <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-line sm:border-0">
                        {cmv !== null && (
                           <span className={\`px-3 py-1 rounded-xl text-xs font-bold \${corCmv(cmv).bg} \${corCmv(cmv).text} border \${corCmv(cmv).border}\`}>
                              CMV {cmv.toFixed(1)}%
                           </span>
                        )}
                        <span className={\`inline-flex items-center gap-2 font-bold text-sm text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl group-hover:bg-emerald-100 transition-colors\`}>
                           {isBar ? <Droplets size={16}/> : <Flame size={16}/>} Iniciar
                        </span>
                     </div>
                  </button>
`;

content = content.substring(0, returnStart) + newReturn + content.substring(mapEnd);

fs.writeFileSync('app/dashboard/operacao/producao/page.js', content);
console.log('Producao Diaria list refactored!');
