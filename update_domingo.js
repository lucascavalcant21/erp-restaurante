const fs = require('fs');
let txt = fs.readFileSync('app/dashboard/rh/page.js', 'utf8');

txt = txt.replace(
  'horaLocal: (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),',
  'horaLocal: (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),\n        genero: funcParaFolgas.genero,'
);

txt = txt.replace(
  '<label className="text-xs font-bold text-indigo-700 uppercase tracking-widest block mb-1">Folga de domingo (1 por mês)</label>',
  '<label className="text-xs font-bold text-indigo-700 uppercase tracking-widest block mb-1">Folga de domingo (1 p/ mês, 2 para mulheres)</label>'
);

fs.writeFileSync('app/dashboard/rh/page.js', txt);
