const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "feat(ui): limpa css legado da ficha tecnica (remove estilo injetado)"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
