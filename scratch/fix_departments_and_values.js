const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: insumos } = await supabase.from('insumos').select('*');
  console.log(`Carregados ${insumos.length} insumos.`);

  const porDept = {};
  for (const i of insumos) {
    const d = i.departamento || 'sem_dept';
    porDept[d] = (porDept[d] || 0) + 1;
  }
  console.log("Contagem por departamento atual em insumos:", porDept);

  // Vamos inspecionar itens com nome de limpeza ou embalagem
  const limpeza = insumos.filter(i => {
    const n = (i.nome || "").toLowerCase();
    const c = (i.categoria || "").toLowerCase();
    const d = (i.departamento || "").toLowerCase();
    return /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo|limpeza|higiene)/.test(n) || /(limpeza|higiene)/.test(c) || d === "limpeza";
  });

  const embalagens = insumos.filter(i => {
    const n = (i.nome || "").toLowerCase();
    const c = (i.categoria || "").toLowerCase();
    const d = (i.departamento || "").toLowerCase();
    return /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio|descartav)/.test(n) || /(embalag|descartav)/.test(c) || d === "embalagens";
  });

  console.log(`\nEncontrados ${limpeza.length} itens de LIMPEZA:`);
  console.table(limpeza.map(i => ({ id: i.id, nome: i.nome, dept: i.departamento, cat: i.categoria, custoUnit: i.custo_unitario, custoCompra: i.custo_compra })));

  console.log(`\nEncontrados ${embalagens.length} itens de EMBALAGENS:`);
  console.table(embalagens.map(i => ({ id: i.id, nome: i.nome, dept: i.departamento, cat: i.categoria, custoUnit: i.custo_unitario, custoCompra: i.custo_compra })));
}

run();
