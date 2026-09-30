const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');

c = c.replace(
  'className="flex-1 overflow-y-auto p-4 sm:p-7 bg-transparent/50 custom-scrollbar"',
  'className="flex-1 overflow-y-auto p-4 sm:p-7 bg-slate-50 custom-scrollbar"'
);

fs.writeFileSync('app/dashboard/operacao/fichas/page.js', c);
console.log('Fixed Fichas editor body bg');
