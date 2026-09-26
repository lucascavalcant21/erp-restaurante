const cp = require('child_process');
cp.execSync('git add app/eventos');
cp.execSync('git commit -m "feat: formulario publico de captacao de eventos"');
cp.execSync('git push');
console.log('Push DONE');
