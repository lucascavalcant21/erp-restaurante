const fs = require('fs');
let c = fs.readFileSync('app/dashboard/reservas-eventos/eventos/page.js', 'utf-8');
c = c.replace('<div className="relative flex-1 max-w-md mb-6 shrink-0">', '<div className="relative w-full max-w-md mb-6 shrink-0">');
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/page.js', c, 'utf-8');
console.log('Fixed flex-1');
