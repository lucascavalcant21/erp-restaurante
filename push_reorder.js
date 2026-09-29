const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix(eventos): joga a aba DRE pro final"');
cp.execSync('git push');
console.log('Push DONE');
