const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');

c = c.replace(
  '<div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">',
  '<div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-0 sm:p-4 overflow-y-auto">'
);

c = c.replace(
  '<div className="erp-ficha bg-slate-50 w-full max-w-6xl min-h-full sm:min-h-0 sm:max-h-[92vh] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">',
  '<div className="erp-ficha bg-slate-50 w-full max-w-6xl min-h-full sm:min-h-0 sm:rounded-[28px] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 sm:my-8 overflow-hidden">'
);

c = c.replace(
  '<div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 sm:gap-5 items-start">',
  '<div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 sm:gap-5 items-start">'
);

fs.writeFileSync('app/dashboard/operacao/fichas/page.js', c);
console.log('Fixed Ficha layout');
