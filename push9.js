const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): remove fundo e texto cinza (tudo branco e de alto contraste)"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
