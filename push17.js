const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): ajusta avatar e modal de visualizacao de fichas"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
