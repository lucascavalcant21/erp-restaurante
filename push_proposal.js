const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "feat(eventos): importa CheckCircle2 e cria proposta PDF premium"');
cp.execSync('git push');
console.log('Push DONE');
