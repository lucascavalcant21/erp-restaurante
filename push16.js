const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): move cadastro de ingredientes para cardapio"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
