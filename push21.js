const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): adiciona menu de notificacoes e corrige fundo do editor de fichas"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
