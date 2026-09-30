const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// Remove from Estoque
c = c.replace(
  '        { label: "Cadastro de Ingredientes", href: "/dashboard/operacao/ingredientes" },\n',
  ''
);

// Add to Cardapio above Fichas Tecnicas
c = c.replace(
  '        { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas" },',
  '        { label: "Cadastro de Ingredientes", href: "/dashboard/operacao/ingredientes" },\n        { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas" },'
);

fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Moved Ingredientes menu');
