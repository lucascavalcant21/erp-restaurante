const fs = require('fs');

function fix(filepath) {
  let p = fs.readFileSync(filepath, 'utf-8');
  p = p.replace(/\\`/g, '`');
  p = p.replace(/\\\$/g, '$');
  fs.writeFileSync(filepath, p, 'utf-8');
}

fix('app/dashboard/reservas-eventos/eventos/page.js');
fix('app/dashboard/reservas-eventos/eventos/[id]/page.js');
console.log('Fixed');
