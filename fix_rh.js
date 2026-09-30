const fs = require('fs');
let c = fs.readFileSync('app/dashboard/rh/page.js', 'utf-8');

c = c.replace(
  'const [modoView, setModoView] = useState(() => searchParams.get("view") === "gestao" || searchParams.get("view") === "tabela" ? "gestao" : "hub");',
  ''
);

c = c.replace(
  /<div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 mr-1">[\s\S]*?<\/div>/m,
  ''
);

const renderLogicToReplace = `      {modoView === "hub" ? (
        <RhHub
          onVerGestaoCompleta={() => setModoView("gestao")}
          onAbrirPonto={() => router.push("/dashboard/rh/ponto")}
        />
      ) : (
        <>
          {/* HEADER: título + destaque; barra de ferramentas em linha própria, sem estourar */}
          <div className="pt-4 sm:pt-5 pb-5 px-4 sm:px-6 max-w-5xl mx-auto">`;

const replacement = `      <>
          {/* HEADER: título + destaque; barra de ferramentas em linha própria, sem estourar */}
          <div className="pt-4 sm:pt-5 pb-5 px-4 sm:px-6 max-w-5xl mx-auto">`;

c = c.replace(renderLogicToReplace, replacement);

c = c.replace(
  '                  <div>\n                     <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-fg">RH & Equipe</h1>',
  '                  <div>\n                     <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-fg">Gestão de Equipe</h1>'
);

// We need to inject <RhHub /> right under the header
c = c.replace(
  '          </div>\n          \n          {/* ABAS */}',
  '          </div>\n\n          <div className="max-w-5xl mx-auto px-4 sm:px-6">\n            <RhHub onAbrirPonto={() => router.push("/dashboard/rh/ponto")} />\n          </div>\n\n          {/* ABAS */}'
);


// and remove the closing tag of the ternary operation:
c = c.replace(
  /        <\/>\n      \)}\n\n      {modalNovo && \(/m,
  '        </>\n\n      {modalNovo && ('
);

fs.writeFileSync('app/dashboard/rh/page.js', c);
console.log('Fixed RH page');
