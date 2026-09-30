const fs = require('fs');

function cleanFile(path) {
  try {
    let content = fs.readFileSync(path, 'utf-8');
    content = content.replace(/<style>\{\`[\s\S]*?\.erp-fichas-theme[\s\S]*?\`\}<\/style>/g, '');
    content = content.replace(/erp-fichas-theme/g, '');
    fs.writeFileSync(path, content);
    console.log(`Cleaned ${path}`);
  } catch(e) {
    console.error(`Error in ${path}`, e.message);
  }
}

cleanFile('app/dashboard/operacao/fichas/page.js');
cleanFile('app/dashboard/operacao/fichas/[id]/page.js');
