const cp = require('child_process');
try { cp.execSync('git add .'); } catch(e){}
try { cp.execSync('git commit -m "fix paths again"'); } catch(e){}
try { cp.execSync('git pull --rebase'); } catch(e){}
try { cp.execSync('git push'); } catch(e){}
console.log('DONE');
