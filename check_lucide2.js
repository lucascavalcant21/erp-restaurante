// Verifica TODOS os identificadores usados como componentes JSX em cada arquivo
// e checa se eles existem nos exports do lucide-react

const fs = require('fs');
const lucide = require('lucide-react');

const allFiles = [];
function walk(dir) {
  try {
    fs.readdirSync(dir).forEach(f => {
      const p = dir + '/' + f;
      try {
        const stat = fs.statSync(p);
        if (stat.isDirectory() && !p.includes('node_modules') && !p.includes('.next')) {
          walk(p);
        } else if ((p.endsWith('.js') || p.endsWith('.jsx')) && !p.includes('node_modules') && !p.includes('.next')) {
          allFiles.push(p);
        }
      } catch(e) {}
    });
  } catch(e) {}
}

walk('app');

console.log('Total de arquivos:', allFiles.length);

let found = false;
allFiles.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  
  // Encontra todos os imports do lucide
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const inner = match[1];
    const names = inner.split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    names.forEach(name => {
      if (name && !lucide[name]) {
        console.log('INVALIDO:', name, 'em', file);
        found = true;
      }
    });
  }
});

if (!found) {
  console.log('Nenhum import invalido encontrado nos arquivos .js!');
  console.log('O problema pode estar em um componente sendo chamado como funcao quando nao e.');
}

// Agora vamos buscar qualquer componente importado de outro lugar que nao seja funcao
// Verifica o arquivo de ui.js
console.log('\n--- Verificando exports do ui.js ---');
const uiPath = 'app/components/ui.js';
if (fs.existsSync(uiPath)) {
  const uiCode = fs.readFileSync(uiPath, 'utf8');
  const exportedFns = uiCode.match(/export\s+(function|const)\s+([A-Za-z]+)/g) || [];
  console.log('Exports em ui.js:', exportedFns.map(e => e.replace(/export\s+(function|const)\s+/, '')));
}
