const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "style(estoque): ajusta cores de tabelas e listas para modo white"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
