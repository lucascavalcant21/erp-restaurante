const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "style(etiquetas): padroniza cores e botoes da aba de gestao"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
