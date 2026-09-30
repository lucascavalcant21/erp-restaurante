const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');
c = c.replace('shadow-sm w-full relative"', 'shadow-sm shrink-0 w-full relative"');
fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed');
