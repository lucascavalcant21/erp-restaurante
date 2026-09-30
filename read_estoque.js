const fs = require('fs');
const content = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8');

const tableIndex = content.indexOf('<table');
if (tableIndex !== -1) {
  console.log('TABLE FOUND');
  console.log(content.substring(tableIndex - 200, tableIndex + 1500));
}

const mapIndex = content.indexOf('.map');
console.log('MAP FOUND AROUND', mapIndex);
