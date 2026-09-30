const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): ajusta safe area do ios no header e corrige fundo da ficha tecnica"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
