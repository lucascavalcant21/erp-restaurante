const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): corrige erro de sintaxe nos ternarios do rh e estoque"'); } catch(e){}
try { cp.execSync('git pull --rebase'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
