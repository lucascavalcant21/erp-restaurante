const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): nomes de modulos mais diretos e adiciona ingredientes ao submenu de estoque"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
