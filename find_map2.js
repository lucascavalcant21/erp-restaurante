const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8').split('\n');

for (let i = 2000; i < 2800; i++) {
  if (lines[i] && lines[i].includes('.map') && lines[i].includes('=>') && lines[i].includes('(')) {
    console.log(`Line ${i}:`, lines[i]);
  }
}
