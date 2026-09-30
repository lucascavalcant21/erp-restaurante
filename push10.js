const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): listagem limpa de producao diaria"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
