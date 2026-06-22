const fs = require('fs');
const code = fs.readFileSync('app/dashboard/delivery/page.js', 'utf8');
const lines = code.split('\n');
const importLines = lines.filter(l => l.trim().startsWith('import'));
console.log('=== IMPORTS ===');
importLines.forEach(l => console.log(l.trim()));

// Also check for any component used as a function call pattern
console.log('\n=== CHECKING MAP import vs window ===');
console.log('Has Map from lucide:', code.includes('Map,') || code.includes(', Map'));
console.log('Has dynamic import:', code.includes('dynamic'));
console.log('Has ssr: false:', code.includes('ssr: false'));
