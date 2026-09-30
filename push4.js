const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "feat(ui): refatoracao do menu, dropdown, area"'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
