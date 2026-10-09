const fs = require('fs');

let txt = fs.readFileSync('app/dashboard/rh/page.js', 'utf8');

const replacement = `            const emExperiencia = fixos.filter(f => String(f.status_contrato || "").toLowerCase().includes("experi")).length;
            const incompletos = ativos.filter(f => !f.data_admissao || !f.cpf).length;
            const cards = [
               { 
                 rot: "Funcionários", val: ativos.length, sub: \`\${fixos.length} fixos · \${extras.length} extras\`,
                 render: () => (
                    <ul className="space-y-2 text-sm">
                       {ativos.map(f => <li key={f.id} className="flex justify-between border-b border-line pb-2"><span className="font-bold text-fg">{f.nome}</span><span className="text-subtle">{f.tipo_contrato}</span></li>)}
                    </ul>
                 )
               },
               {
                 rot: "Bateram ponto hoje", val: trabalhandoAgora, sub: "presença registrada",
                 render: () => {
                     const pres = pontosHoje.map(p => {
                         const f = ativos.find(x => x.id === p.colaborador_id);
                         return f ? { f, e: p.hora_entrada } : null;
                     }).filter(Boolean);
                     if (!pres.length) return <p className="text-sm font-bold text-subtle text-center py-4">Nenhum ponto registrado hoje.</p>;
                     return <ul className="space-y-2 text-sm">
                       {pres.map((x, i) => <li key={i} className="flex justify-between border-b border-line pb-2"><span className="font-bold text-fg">{x.f.nome}</span><span className="text-subtle">Entrou às {x.e.slice(0, 5)}</span></li>)}
                     </ul>
                 }
               },
               {
                 rot: "Custo de Hoje", val: fmtBRL(fixosDia + extrasDiaHoje), sub: \`\${fmtBRL(fixosDia)} (fixos) + \${fmtBRL(extrasDiaHoje)} (extras)\`,
                 render: () => (
                     <div>
                        <p className="text-xs font-medium text-subtle mb-4">Rateio do salário fixo (pelos dias trabalhados na semana) somado ao custo exato das diárias extras de quem bateu ponto hoje.</p>
                        <h4 className="font-black text-accent mt-4 mb-2">Fixos (\${fmtBRL(fixosDia)})</h4>
                        <ul className="space-y-2 text-sm">
                           {fixos.map(f => {
                               const n = (f.dias_trabalho || "").split(",").filter(Boolean).length;
                               const rateio = n ? (Number(f.salario) || 0) / (n * 4.345) : 0;
                               if (rateio === 0) return null;
                               return <li key={f.id} className="flex justify-between border-b border-line pb-1"><span className="text-fg">{f.nome}</span><span className="font-bold text-fg-soft">\${fmtBRL(rateio)}</span></li>;
                           })}
                        </ul>
                        <h4 className="font-black text-amber-600 mt-6 mb-2">Extras de hoje (\${fmtBRL(extrasDiaHoje)})</h4>
                        {extras.filter(f => idsPontoHoje.has(f.id)).length === 0 ? <p className="text-xs font-bold text-subtle">Nenhum extra bateu ponto hoje.</p> : (
                        <ul className="space-y-2 text-sm">
                           {extras.filter(f => idsPontoHoje.has(f.id)).map(f => (
                               <li key={f.id} className="flex justify-between border-b border-line pb-1"><span className="text-fg">{f.nome}</span><span className="font-bold text-fg-soft">\${fmtBRL(f.salario)}</span></li>
                           ))}
                        </ul>
                        )}
                     </div>
                 )
               },
               {
                 rot: "Média da Semana", val: fmtBRL(total / 4.345), sub: "estimativa do mês",
                 render: () => (
                     <p className="text-sm font-medium text-subtle">Este valor representa a média simples do Custo Total Mensal dividido por 4,345 semanas. Inclui a folha fixa integral e os gastos com extras (projeção baseada nos dias já trabalhados).</p>
                 )
               },
               {
                 rot: "Folha prevista (Mês)", val: fmtBRL(folhaFixa), sub: \`\${fixos.length} fixos · salário+VA+taxa\`,
                 render: () => (
                    <ul className="space-y-2 text-sm">
                        {fixos.map(f => {
                            const totM = (Number(f.salario) || 0) + (Number(f.vale_alimentacao) || 0) + (Number(f.taxa_servico_mes) || 0);
                            return <li key={f.id} className="flex justify-between border-b border-line pb-1"><span className="text-fg">{f.nome}</span><span className="font-bold text-fg-soft">\${fmtBRL(totM)}</span></li>;
                        })}
                    </ul>
                 )
               },
               {
                 rot: "CMO Total", val: fmtBRL(total), sub: pct === null ? "esperando faturamento" : \`\${pct.toFixed(1)}% do faturamento\`,
                 render: () => (
                     <p className="text-sm font-medium text-subtle">Soma total da Folha Fixa e Gasto com Extras no mês corrente, comparado ao Faturamento de Entradas lançado em Finanças.</p>
                 )
               }
            ];
            return (
               <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 relative">
                  {cards.map(c => (
                     <div key={c.rot} onClick={() => setDetalheKpi(c)} className="bg-card rounded-2xl border border-line shadow-sm px-3 py-2.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all active:scale-95">
                        <p className="text-3xs font-bold uppercase tracking-wider text-subtle leading-tight">{c.rot}</p>
                        <p className="text-lg font-black text-accent mt-0.5">{c.val}</p>
                        <p className="text-3xs font-bold text-subtle truncate">{c.sub}</p>
                     </div>
                  ))}
               </div>
            );`;

const targetStart = 'const emExperiencia = fixos.filter(f => String(f.status_contrato || "").toLowerCase().includes("experi")).length;';
const targetEndMatch = txt.match(/<\/div>\r?\n\s*\);\r?\n\s*\}\)\(\)\}/);

if (targetEndMatch) {
    const iStart = txt.indexOf(targetStart);
    if (iStart !== -1) {
        const toReplace = txt.substring(iStart, targetEndMatch.index + targetEndMatch[0].length - '         })()}'.length);
        txt = txt.replace(toReplace, replacement + '\n');
        fs.writeFileSync('app/dashboard/rh/page.js', txt);
        console.log("Substituição feita.");
    } else {
        console.log("Não achou start");
    }
} else {
    console.log("Não achou end match");
}
