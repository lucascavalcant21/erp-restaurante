const fs = require('fs');
const lines = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8').split('\n');
console.log(lines.slice(30, 45).join('\n'));
