const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');

c = c.replace(
  '<div className="erp-ficha bg-transparent w-full max-w-6xl min-h-full sm:min-h-0 sm:max-h-[92vh] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">',
  '<div className="erp-ficha bg-slate-50 w-full max-w-6xl min-h-full sm:min-h-0 sm:max-h-[92vh] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">'
);

// Also check the Ficha viewer modal in `EditorFicha.js` and `VisualizacaoFicha.js` if they have similar issues.
fs.writeFileSync('app/dashboard/operacao/fichas/page.js', c);
console.log('Fixed Ficha bg');
