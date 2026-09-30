const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/etiquetas/page.js', 'utf-8');

c = c.replace(
  /className="px-5 py-2\.5 font-bold text-sm rounded-xl transition-all"\s*style={aba === v\s*\? { background: "var\(--accent-strong\)", color: "#fff", boxShadow: "0 2px 8px rgba\(16,185,129,0\.28\)" }\s*: { background: "var\(--panel\)", color: "var\(--fg\)", border: "1px solid var\(--line\)" }}/g,
  'className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all border ${aba === v ? "bg-accent text-accent-fg border-accent shadow-sm" : "bg-card text-fg border-line hover:bg-slate-100"}`}'
);

c = c.replace(
  /className="inline-flex gap-1 mb-4 rounded-xl p-1" style={{ background: "var\(--elevated\)" }}/g,
  'className="inline-flex gap-1 mb-4 rounded-xl p-1 bg-slate-100 border border-line"'
);

fs.writeFileSync('app/dashboard/operacao/etiquetas/page.js', c);
console.log('Fixed Etiquetas buttons with regex');
