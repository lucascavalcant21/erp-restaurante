const fs=require('fs');
const content = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');
const lines = content.split('\n');
const startIndex = lines.findIndex(l => l.includes('function FichasRunner()'));
let returnIndex = -1;
for (let i = startIndex; i < lines.length; i++) {
  if (lines[i].includes('return (') && !lines[i].includes('?')) {
    // maybe this is it? Let's print all returns inside FichasRunner
  }
}
const allReturns = lines.slice(startIndex, startIndex+4000).filter(l => l.trim().startsWith('return ('));
console.log(allReturns);
