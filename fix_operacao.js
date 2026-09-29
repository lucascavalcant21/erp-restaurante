const fs = require('fs');

let c = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/OperacaoTab.js', 'utf-8');

// Adicionar a função calcularCustoFicha
const funcCalc = `
  const calcularCustoFicha = (ficha) => {
    let custoTotal = 0;
    if (ficha.fichas_ingredientes) {
      ficha.fichas_ingredientes.forEach(ing => {
        if (ing.insumos) {
          const custoPorGram = ing.insumos.custo_unit / (ing.insumos.peso_unit || 1);
          custoTotal += custoPorGram * ing.quantidade;
        }
      });
    }
    return custoTotal || ficha.custo_unitario || 0;
  };
`;

c = c.replace('// CARDÁPIO / ITENS', funcCalc + '\n  // CARDÁPIO / ITENS');

// Substituir ficha.nome por ficha.nome_receita e custo_unitario pelo calculado
c = c.replace(
  /const novoItem = \{\s*id: crypto\.randomUUID\(\),\s*ficha_id: ficha\.id,\s*nome: ficha\.nome,\s*quantidade_servida: 1,\s*custo_porcao: ficha\.custo_unitario \|\| 0,\s*departamento: departamento\s*\};/g,
  `const novoItem = {
      id: crypto.randomUUID(),
      ficha_id: ficha.id,
      nome: ficha.nome_receita || ficha.nome,
      quantidade_servida: 1,
      custo_porcao: calcularCustoFicha(ficha),
      departamento: departamento
    };`
);

c = c.replace(
  /<strong className="block text-slate-800 text-sm">\{ficha\.nome\}<\/strong>\s*<span className="text-xs text-slate-500 font-medium">Custo base: R\$ \{Number\(ficha\.custo_unitario \|\| 0\)\.toFixed\(2\)\}<\/span>/g,
  `<strong className="block text-slate-800 text-sm">{ficha.nome_receita || ficha.nome}</strong>
   <span className="text-xs text-slate-500 font-medium">Custo base: R$ {Number(calcularCustoFicha(ficha)).toFixed(2)}</span>`
);

c = c.replace(/f\.nome\.toLowerCase/g, '(f.nome_receita || f.nome).toLowerCase');

fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/OperacaoTab.js', c, 'utf-8');
console.log('OperacaoTab corrigida!');
