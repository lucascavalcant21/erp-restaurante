const fs = require('fs');
const path = require('path');

function searchAll(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (['node_modules', '.next', '.git', 'scratch'].includes(item.name)) continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      searchAll(fullPath);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('calcularValorItem')) {
          console.log(`========================================`);
          console.log(`FILE: ${fullPath}`);
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes('calcularValorItem')) {
              console.log(`  Line ${index + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  }
}

searchAll('.');
