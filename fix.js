const fs = require('fs');
let lines = fs.readFileSync('app/dashboard/page.js', 'utf-8').split('\n');
let idx = lines.findIndex(l => l.includes('style={{'));
if (idx !== -1) {
  lines[idx] = '                <div className="absolute bottom-0 w-full bg-emerald-500 rounded-t-lg transition-all duration-500" style={{ height: `${h}%` }}></div>';
  fs.writeFileSync('app/dashboard/page.js', lines.join('\n'));
  console.log('Replaced!');
}
