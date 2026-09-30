const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

c = c.replace('label: "Operação",', 'label: "PDV",');
c = c.replace('label: "Estoque",', 'label: "Operacional",');

fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed names');
