const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix(eventos): resolve importacao do lucide react e tab de operacao"');
cp.execSync('git push');
console.log('Push DONE');
