const fs = require('fs');

let rh = fs.readFileSync('app/dashboard/rh/page.js', 'utf-8');
rh = rh.replace(/<\/>\r?\n\s*\)\}/, '</>'); // Remova the first hanging )}
fs.writeFileSync('app/dashboard/rh/page.js', rh);

let estoque = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8');
estoque = estoque.replace(/<\/>\r?\n\s*\)\}/, '</>');
fs.writeFileSync('app/dashboard/operacao/estoque/page.js', estoque);

console.log('Fixed syntax errors in RH and Estoque');
