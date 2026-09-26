const fs = require('fs');

let p = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');

p = p.replace('import PropostaTab from "./PropostaTab";', 'import PropostaTab from "./PropostaTab";\nimport FinanceiroTab from "./FinanceiroTab";');

const oldFinanceiroRegex = /\{activeTab === "financeiro" && \(\(\) => \{[\s\S]*?\}\)\(\)\}/;

const newFinanceiro = `        {activeTab === "financeiro" && (
          <FinanceiroTab 
            evento={evento} 
            onUpdate={(novosDados) => setEvento({...evento, ...novosDados})} 
          />
        )}`;

p = p.replace(oldFinanceiroRegex, newFinanceiro);

fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', p, 'utf-8');
console.log('FinanceiroTab conectado!');
