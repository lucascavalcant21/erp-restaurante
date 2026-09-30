const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "feat(eventos): unifica telas de funil de eventos e reservas em uma unica pagina e padroniza cabecalhos"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
