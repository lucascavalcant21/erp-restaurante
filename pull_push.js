const cp = require('child_process');
cp.execSync('git pull');
cp.execSync('git push');
console.log('DONE');
