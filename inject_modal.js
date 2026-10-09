const fs = require('fs');
let txt = fs.readFileSync('app/dashboard/rh/page.js', 'utf8');

const anchor = '      {/* Composição da equipe + Ações rápidas */}';
const replacement = `      {/* Modal de Detalhe do KPI */}
      {detalheKpi && (
         <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetalheKpi(null)}>
            <div className="bg-card w-full max-w-lg rounded-[32px] p-6 shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
               <button onClick={() => setDetalheKpi(null)} className="absolute right-6 top-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"><X size={18}/></button>
               <h3 className="font-black text-2xl mb-1 text-slate-800">{detalheKpi.rot}</h3>
               <p className="text-xs font-bold text-subtle uppercase tracking-widest mb-6">{detalheKpi.val}</p>
               <div className="max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                  {detalheKpi.render && detalheKpi.render()}
               </div>
            </div>
         </div>
      )}

` + anchor;

txt = txt.replace(anchor, replacement);
fs.writeFileSync('app/dashboard/rh/page.js', txt);
