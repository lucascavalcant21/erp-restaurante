const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix: final syntax errors"');
cp.execSync('git push');
console.log('Push DONE');
