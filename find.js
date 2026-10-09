const fs=require('fs');
const lines = fs.readFileSync('app/dashboard/rh/page.js', 'utf-8').split('\n');
const i = lines.findIndex(l => l.includes('max="60"'));
console.log(lines.slice(i-5, i+15).join('\n'));
