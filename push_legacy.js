const cp = require('child_process');
cp.execSync('git add app/dashboard/operacao/orcamento/page.js');
cp.execSync('git commit -m "fix(orcamento): remove header sticky, melhora exclusao, divide utensilios e agrupa por area"');
cp.execSync('git push');
console.log('Push DONE');
