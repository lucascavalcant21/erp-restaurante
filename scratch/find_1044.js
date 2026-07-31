const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: todosInsumos } = await supabase.from('insumos').select('*');
  
  console.log(`Carregados ${todosInsumos.length} insumos.`);

  const unidades = [...new Set(todosInsumos.map(i => i.unidade_id))];
  console.log("Unidades encontradas:", unidades);

  for (const item of todosInsumos) {
    const q = Number(item.quantidade_atual) || 0;
    const cu = Number(item.custo_unitario) || 0;
    const cc = Number(item.custo_compra) || 0;
    
    // Mostra qualquer insumo que tenha custo_unitario ou custo_compra ou quantidade_atual
    if (cu > 0 || cc > 0 || q > 0) {
      // console.log(`${item.nome} (${item.unidade_id}): q=${q}, cu=${cu}, cc=${cc}`);
    }
  }
}

run();
