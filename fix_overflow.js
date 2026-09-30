const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');
c = c.replace('className="hidden xl:flex items-center h-full gap-2 overflow-hidden"', 'className="hidden xl:flex items-center h-full gap-2"');
fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed overflow-hidden');
