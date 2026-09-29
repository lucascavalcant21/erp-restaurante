const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix(eventos): resolve bug do cardapio sem nome e automatiza checklist de prontidao"');
cp.execSync('git push');
console.log('Push DONE');
