const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8');

c = c.replace(/\{modoView === "hub" \? \([\s\S]*?abrirOperacao\("saida"\);\s*\}\}\s*\/>\s*\)\s*:\s*\(\s*<>/, '<>');
c = c.replace(/<\/>\n\s*\)\}\n\s*<\/main>/, '</>\n      </main>');

if (!c.includes('<EstoqueHub')) {
    c = c.replace(
      '          <div className="flex flex-wrap gap-2">',
      '          <div className="flex flex-wrap gap-2">'
    );
    // wait, where should we put it?
    // Let's just find <section className="bg-card rounded-2xl border border-line p-3 shadow-xs"> and prepend it
    c = c.replace(
      '<section className="bg-card rounded-2xl border border-line p-3 shadow-xs">',
      '<EstoqueHub onAbrirEntrada={() => abrirOperacao("entrada")} onAbrirSaida={() => abrirOperacao("saida")} />\n            <section className="bg-card rounded-2xl border border-line p-3 shadow-xs">'
    );
}

fs.writeFileSync('app/dashboard/operacao/estoque/page.js', c);
console.log('Fixed Estoque page broken modoView');
