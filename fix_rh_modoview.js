const fs = require('fs');
let c = fs.readFileSync('app/dashboard/rh/page.js', 'utf-8');

c = c.replace(/\{modoView === "hub" \? \([\s\S]*?onAbrirPonto=\{\(\) => router.push\("\/dashboard\/rh\/ponto"\)\}\s*\/>\s*\)\s*:\s*\(\s*<>/, '<>');
c = c.replace(/<\/>\n\s*\)\}\n\n\s*\{modalNovo/, '</>\n      {modalNovo');

// We also need to re-add RhHub right after the header if we didn't before.
// Did I add RhHub before? Let's check if RhHub is in the file.
if (!c.includes('<RhHub onAbrirPonto')) {
    c = c.replace(
      '          </div>\n          \n          {/* ABAS */}',
      '          </div>\n\n          <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-8">\n            <RhHub onAbrirPonto={() => router.push("/dashboard/rh/ponto")} />\n          </div>\n\n          {/* ABAS */}'
    );
}

fs.writeFileSync('app/dashboard/rh/page.js', c);
console.log('Fixed RH page broken modoView');
