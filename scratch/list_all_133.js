const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: insumos } = await supabase.from('insumos').select('id, nome, departamento, categoria, unidade_medida, custo_unitario, custo_compra');
  
  console.log("=== LISTA DE TODOS OS 133 INSUMOS ===");
  console.table(insumos.map((i, index) => ({
    idx: index,
    id: i.id,
    nome: i.nome,
    dept: i.departamento,
    cat: i.categoria,
    un: i.unidade_medida,
    custoUnit: i.custo_unitario,
    custoCompra: i.custo_compra
  })));
}

run();
