const fs = require('fs');

let layout = fs.readFileSync('app/dashboard/layout.js', 'utf-8');

// 1. Add import
if (!layout.includes('TopNavigation')) {
  layout = layout.replace(
    'import { HefistoPageContextProvider } from "../context/HefistoPageContext";',
    'import { HefistoPageContextProvider } from "../context/HefistoPageContext";\nimport TopNavigation from "../components/layout/TopNavigation";'
  );
}

// 2. Remove Sidebar
layout = layout.replace(
  /<div className="print:hidden h-full flex shrink-0">[\s\S]*?<\/div>/,
  ''
);

// 3. Remove TopHeader
layout = layout.replace(
  /<div className="print:hidden shrink-0">\s*<TopHeader[\s\S]*?\/>\s*<\/div>/,
  '<div className="print:hidden shrink-0"><TopNavigation sessao={sessao} onSair={sair} onOpenSearch={() => setCommandCenterOpen(true)} /></div>'
);

// 4. Change AppShell classes
layout = layout.replace(
  /className={`erp-app-shell \${compacto \? "erp-density-compact" : "erp-density-comfortable"} flex h-screen h-\[100dvh\] min-h-0 bg-\[#F8FAFC\] overflow-hidden print:bg-card print:block print:h-auto print:min-h-0`}/,
  'className={`erp-app-shell flex flex-col h-screen h-[100dvh] min-h-0 bg-[#F7F8F7] overflow-hidden print:bg-card print:block print:h-auto print:min-h-0`}'
);

fs.writeFileSync('app/dashboard/layout.js', layout, 'utf-8');
console.log("Layout.js modified!");
