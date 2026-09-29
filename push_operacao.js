const cp = require('child_process');
cp.execSync('git add .');
cp.execSync('git commit -m "fix(eventos): importa supabase com chaves e finaliza abas departamentais"');
cp.execSync('git push');
console.log('Push DONE');
