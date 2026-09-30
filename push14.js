const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): corrige erro de sintaxe no map de fichas"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
