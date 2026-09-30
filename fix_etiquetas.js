const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/etiquetas/page.js', 'utf-8');

c = c.replace(
  'style={aba === v\n                ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 2px 8px rgba(16,185,129,0.28)" }\n                : { background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--line)" }}',
  'className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all border ${aba === v ? "bg-accent text-accent-fg border-accent shadow-sm" : "bg-card text-fg border-line hover:bg-slate-100"}`}'
);

// Remove the old className string
c = c.replace(
  '              className="px-5 py-2.5 font-bold text-sm rounded-xl transition-all"\n              className={`px-5 py-2.5',
  '              className={`px-5 py-2.5'
);


c = c.replace(
  'style={{ background: "var(--elevated)" }}',
  'className="inline-flex gap-1 mb-4 rounded-xl p-1 bg-slate-100 border border-line"'
);

c = c.replace(
  'className="px-4 py-2 rounded-lg font-bold text-sm transition-all"\n              style={(deptUrl || "") === d ? { background: "var(--card)", color: "var(--fg)", boxShadow: "0 1px 2px rgba(0,0,0,.15)" } : { color: "var(--muted)" }}',
  'className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${ (deptUrl || "") === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200" }`}'
);

fs.writeFileSync('app/dashboard/operacao/etiquetas/page.js', c);
console.log('Fixed Etiquetas buttons');
