const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "feat(rh): unifica modo hub e modo gestao em uma unica tela com tema claro"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
