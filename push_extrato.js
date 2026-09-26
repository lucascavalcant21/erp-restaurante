const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "feat: registro de extrato de pagamentos de eventos"');
cp.execSync('git push');
console.log('Push DONE');
