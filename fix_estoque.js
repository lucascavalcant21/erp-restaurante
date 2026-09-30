const fs = require('fs');
let c = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8');

c = c.replace(
  'const [modoView, setModoView] = useState(() => searchParams.get("view") === "tabela" ? "tabela" : "hub");',
  ''
);

const renderLogicToReplace = `        {modoView === "hub" ? (
          <EstoqueHub
            onVerTabelaCompleta={() => setModoView("tabela")}
            onAbrirEntrada={() => { setModoView("tabela"); abrirOperacao("entrada"); }}
            onAbrirSaida={() => { setModoView("tabela"); abrirOperacao("saida"); }}
          />
        ) : (
          <>
            <section className="bg-card rounded-2xl border border-line p-3 shadow-xs">`;

const replacement = `        <>
            <EstoqueHub
              onAbrirEntrada={() => { abrirOperacao("entrada"); }}
              onAbrirSaida={() => { abrirOperacao("saida"); }}
            />
            <section className="bg-card rounded-2xl border border-line p-3 shadow-xs">`;

c = c.replace(renderLogicToReplace, replacement);

c = c.replace(
  /<div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 mr-1">[\s\S]*?<\/div>\s*\{\/\* Sair do quiosque/m,
  '{/* Sair do quiosque'
);

// and remove the closing tag of the ternary operation:
c = c.replace(
  /          <\/>\n        \)}\n      <\/main>/m,
  '          </>\n      </main>'
);

fs.writeFileSync('app/dashboard/operacao/estoque/page.js', c);
console.log('Fixed Estoque page');
