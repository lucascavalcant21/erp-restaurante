const fs = require('fs');

let c = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8');

// Change Table Header from black to light
c = c.replace(
  'className="sticky top-0 z-20 bg-slate-900 text-xs font-bold uppercase tracking-wider text-white shadow-md"',
  'className="sticky top-0 z-20 bg-slate-50 border-b border-line text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm"'
);

// Group Header from slate-100/90 to white/slate-50
c = c.replace(
  'className="bg-slate-100/90 border-y border-line cursor-pointer hover:bg-slate-200/80 transition-colors select-none"',
  'className="bg-slate-50 border-y border-line cursor-pointer hover:bg-slate-100 transition-colors select-none"'
);

// Mobile Group Header from bg-card to bg-slate-50
c = c.replace(
  'className="flex items-center justify-between rounded-xl bg-card px-3.5 py-2.5 text-xs font-extrabold text-slate-800 cursor-pointer active:bg-slate-200 transition"',
  'className="flex items-center justify-between rounded-xl bg-slate-50 border border-line px-3.5 py-2.5 text-xs font-extrabold text-slate-800 cursor-pointer hover:bg-slate-100 transition"'
);

fs.writeFileSync('app/dashboard/operacao/estoque/page.js', c);
console.log('Fixed Estoque visual identity');
