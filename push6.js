const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix(ui): aponta controle de estoque desk pra versao de gestao"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
