const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix(operacao): corrige caminhos relativos no OperacaoTab"');
cp.execSync('git push');
console.log('Push DONE');
