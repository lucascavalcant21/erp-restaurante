const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "feat(etiquetas): adiciona suporte a imagem e formato somente-imagem nas etiquetas rapidas"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
