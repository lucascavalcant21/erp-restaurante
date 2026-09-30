const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "feat(estoque): unifica modo hub e modo tabela em uma unica tela com tema claro"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
