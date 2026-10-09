const fs = require('fs');
let txt = fs.readFileSync('app/dashboard/rh/page.js', 'utf8');

const oldCard = `               { 
                 rot: "Funcionários", val: ativos.length, sub: \\\`\\\${fixos.length} fixos · \\\${extras.length} extras\\\`,
                 render: () => (
                    <ul className="space-y-2 text-sm">
                       {ativos.map(f => <li key={f.id} className="flex justify-between border-b border-line pb-2"><span className="font-bold text-fg">{f.nome}</span><span className="text-subtle">{f.tipo_contrato}</span></li>)}
                    </ul>
                 )
               },`;

const newCard = `               { 
                 rot: "Equipe Fixa", val: fixos.length, sub: \\\`+ \\\${extras.length} freelancers na rede\\\`,
                 render: () => (
                    <div>
                       <p className="text-xs font-medium text-subtle mb-4">A equipe fixa representa o seu quadro de funcionários contratados. Freelancers não são funcionários, mas compõem a sua rede extra.</p>
                       <h4 className="font-black text-slate-800 mt-4 mb-2">Funcionários ({fixos.length})</h4>
                       <ul className="space-y-2 text-sm mb-6">
                          {fixos.map(f => <li key={f.id} className="flex justify-between border-b border-line pb-1"><span className="font-bold text-fg">{f.nome}</span><span className="text-subtle">{f.cargo || f.tipo_contrato}</span></li>)}
                       </ul>
                       <h4 className="font-black text-amber-600 mb-2">Rede Extra ({extras.length})</h4>
                       {extras.length === 0 ? <p className="text-xs font-bold text-subtle">Sem extras ativos.</p> : (
                          <ul className="space-y-2 text-sm mb-4">
                             {extras.map(f => <li key={f.id} className="flex justify-between border-b border-line pb-1"><span className="font-bold text-fg">{f.nome}</span><span className="text-subtle">Freelancer</span></li>)}
                          </ul>
                       )}
                    </div>
                 )
               },`;

txt = txt.replace(oldCard, newCard);
fs.writeFileSync('app/dashboard/rh/page.js', txt);
