const fs = require('fs');

const files = [
  'app/dashboard/reservas-eventos/eventos/[id]/FinanceiroTab.js',
  'app/eventos/[unidade]/page.js'
];

files.forEach(file => {
  let p = fs.readFileSync(file, 'utf-8');
  p = p.replace(/\\`/g, '`');
  p = p.replace(/\\\$/g, '$');
  fs.writeFileSync(file, p, 'utf-8');
});

console.log('Fixed syntax!');
