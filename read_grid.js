const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8').split('\n');
const mapIndex = lines.findIndex((l, i) => l.includes('.map(') && l.includes('=>') && lines[i-1] && lines[i-1].includes('grid'));
if (mapIndex !== -1) {
  console.log(lines.slice(mapIndex - 5, mapIndex + 30).join('\n'));
} else {
  console.log('Not found');
}
