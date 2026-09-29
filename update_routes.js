const fs = require('fs');

const filesToUpdate = [
  'app/components/RecipeWorkspace.js',
  'app/dashboard/area/page.js',
  'app/dashboard/layout.js',
  'app/dashboard/modulo/[modulo]/page.js',
  'app/lib/navigation-registry.mjs',
  'app/lib/permissions-catalog.mjs'
];

filesToUpdate.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(/\/dashboard\/operacao\/orcamento\?dept=(cozinha|bar)/g, '/dashboard/reservas-eventos/eventos');
    content = content.replace(/\/dashboard\/operacao\/orcamento/g, '/dashboard/reservas-eventos/eventos');
    content = content.replace(/Orçamento de [Ee]ventos/g, 'Eventos e Reservas');
    content = content.replace(/Orçamentos/g, 'Eventos e Reservas');
    fs.writeFileSync(file, content, 'utf-8');
  }
});
console.log('Rotas do menu atualizadas!');
