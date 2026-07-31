const fs = require('fs');
const path = require('path');

function search(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git' || entry.name === 'scratch') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      search(full);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.mjs')) {
      const txt = fs.readFileSync(full, 'utf8');
      if (txt.includes('calcularValorItem')) {
        console.log(`ENCONTRADO EM ${full}`);
      }
    }
  }
}

search('.');
