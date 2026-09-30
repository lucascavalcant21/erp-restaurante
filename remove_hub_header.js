const fs = require('fs');
let c = fs.readFileSync('app/components/navigation/RhHub.js', 'utf-8');

c = c.replace(/<HubHeader[\s\S]*?Gestão Completa de RH\s*<\/HubActionButton>\s*\)\s*:\s*null\s*}\s*\/>/m, '');
fs.writeFileSync('app/components/navigation/RhHub.js', c);
console.log('Removed HubHeader from RhHub');
