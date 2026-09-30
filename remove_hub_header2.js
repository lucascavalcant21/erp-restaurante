const fs = require('fs');
let c = fs.readFileSync('app/components/navigation/EstoqueHub.js', 'utf-8');

c = c.replace(/<HubHeader[\s\S]*?<\/HubActionButton>\s*}\s*\/>/m, '');
fs.writeFileSync('app/components/navigation/EstoqueHub.js', c);
console.log('Removed HubHeader from EstoqueHub');
