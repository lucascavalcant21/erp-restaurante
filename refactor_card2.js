const fs = require('fs');

let content = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');

// 1. Change grid container
content = content.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">',
  '<div className="flex flex-col gap-3">'
);

// 2. Change the card class
content = content.replace(
  /className=\{`erp-fichas-card bg-card rounded-3xl border p-5 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between \$\{dragId === f\.id \? 'opacity-50' : ''\} \$\{selecionadas\.includes\(f\.id\) \? 'border-emerald-500 ring-2 ring-emerald-500\/20' : 'border-slate-200\/90'\}`\}/g,
  'className={`erp-fichas-card bg-card rounded-2xl border p-3 sm:p-4 shadow-sm hover:shadow-md transition-all relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${dragId === f.id ? "opacity-50" : ""} ${selecionadas.includes(f.id) ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200"}`}'
);

fs.writeFileSync('app/dashboard/operacao/fichas/page.js', content);
console.log('Done grid replacement.');
