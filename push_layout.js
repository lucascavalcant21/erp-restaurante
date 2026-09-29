const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix(eventos): remove flex-1 da barra de busca do dashboard"');
cp.execSync('git push');
console.log('Push DONE');
