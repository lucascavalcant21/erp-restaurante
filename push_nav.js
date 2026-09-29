const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix(navigation): substitui orcamento antigo pela central de eventos"');
cp.execSync('git push');
console.log('Push DONE');
