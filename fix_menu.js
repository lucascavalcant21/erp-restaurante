const fs = require('fs');

let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// Single names
c = c.replace('label: "Cardápio & Produção",', 'label: "Cardápio",');
c = c.replace('label: "Estoque & Compras",', 'label: "Estoque",');
c = c.replace('label: "Eventos & Reservas",', 'label: "Eventos",');

// Insert Ingredientes under Estoque
const estoqueSubmodulesMatch = c.indexOf('id: "estoque",');
if (estoqueSubmodulesMatch !== -1) {
  c = c.replace(
    '{ label: "Controle de Estoque", href: "/dashboard/operacao/estoque?gestao=1" },',
    '{ label: "Controle de Estoque", href: "/dashboard/operacao/estoque?gestao=1" },\n        { label: "Cadastro de Ingredientes", href: "/dashboard/operacao/ingredientes" },'
  );
}

fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed TopNavigation names and added Ingredientes');
