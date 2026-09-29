const fs = require('fs');
let c = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/OperacaoTab.js', 'utf-8');
c = c.replace(/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib/g, '../../../../lib');
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/OperacaoTab.js', c, 'utf-8');
console.log('Fixed paths');
