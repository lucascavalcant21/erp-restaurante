const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): clareia header e corrige modal de salvar lista de etiquetas"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
