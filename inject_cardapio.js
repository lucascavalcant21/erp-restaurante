const fs = require('fs');
let p = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');
p = p.replace('import Link from "next/link";', 'import Link from "next/link";\nimport CardapioTab from "./CardapioTab";');
const tabContent = `        {activeTab === "cardapio" && (
          <CardapioTab 
            evento={evento} 
            unidadeAtiva={unidadeAtiva} 
            onUpdate={(novo) => setEvento({ ...evento, ...novo })} 
          />
        )}`;
p = p.replace(/\{\s*activeTab === "cardapio" && \(\s*<div className="text-center[\s\S]*?<\/div>\s*\)\}/, tabContent);
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', p, 'utf-8');
console.log('Injected CardapioTab');
