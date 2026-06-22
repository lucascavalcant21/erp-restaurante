const fs = require('fs');
const lucide = require('lucide-react');

const allFiles = [];
function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const p = dir + '/' + f;
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory() && !p.includes('node_modules') && !p.includes('.next')) {
        walk(p);
      } else if (p.endsWith('.js') && !p.includes('node_modules') && !p.includes('.next')) {
        allFiles.push(p);
      }
    } catch(e) {}
  });
}

walk('app');

allFiles.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const matches = code.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g);
  if (matches) {
    matches.forEach(imp => {
      const inner = imp.replace(/import\s*\{/, '').replace(/\}\s*from.*/, '');
      const names = inner.split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      names.forEach(name => {
        if (name && !lucide[name]) {
          console.log('INVALIDO:', name, 'em', file);
        }
      });
    });
  }
});

console.log('Varredura completa. Total de arquivos:', allFiles.length);
