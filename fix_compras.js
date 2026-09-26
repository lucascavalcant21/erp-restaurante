const fs = require('fs');
let p = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/ComprasTab.js', 'utf-8');
p = p.replace('../../../../../lib/operacao', '../../../../lib/operacao');
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/ComprasTab.js', p, 'utf-8');

const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "feat: compras proposta status e checklist"');
cp.execSync('git push');
console.log('Fixed and pushed!');
