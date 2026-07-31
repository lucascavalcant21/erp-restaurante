const fs = require('fs');

const content = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('calcular')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
