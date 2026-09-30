const fs = require('fs');
let content = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// The main dropdown items array
content = content.replace(
  '{ label: "Controle de Estoque", href: "/dashboard/operacao/estoque" }',
  '{ label: "Controle de Estoque", href: "/dashboard/operacao/estoque?gestao=1" }'
);

fs.writeFileSync('app/components/layout/TopNavigation.js', content);
