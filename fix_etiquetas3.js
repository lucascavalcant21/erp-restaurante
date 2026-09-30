const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/etiquetas/page.js', 'utf-8');

c = c.replace(
  'className="inline-flex gap-1 mb-4 rounded-xl p-1" className="inline-flex gap-1 mb-4 rounded-xl p-1 bg-slate-100 border border-line"',
  'className="inline-flex gap-1 mb-4 rounded-xl p-1 bg-slate-100 border border-line"'
);

c = c.replace(
  /className="px-4 py-2 rounded-lg font-bold text-sm transition-all"\s*style=\{\(deptUrl \|\| ""\) === d \? \{ background: "var\(--card\)", color: "var\(--fg\)", boxShadow: "0 1px 2px rgba\(0,0,0,\.15\)" \} : \{ color: "var\(--muted\)" \}\}/g,
  'className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${ (deptUrl || "") === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200" }`}'
);

fs.writeFileSync('app/dashboard/operacao/etiquetas/page.js', c);
console.log('Fixed Etiquetas buttons finally');
