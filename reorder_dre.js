const fs = require('fs');

let c = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');

const regexFinanceiro = /\s*\{\s*id:\s*"financeiro"[^\}]+\},/;
const match = c.match(regexFinanceiro);

if (match) {
  c = c.replace(match[0], '');
  c = c.replace('{ id: "proposta"', match[0].trim() + '\n  { id: "proposta"');
  fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', c, 'utf-8');
  console.log('Reordered');
} else {
  console.log('Not found');
}
