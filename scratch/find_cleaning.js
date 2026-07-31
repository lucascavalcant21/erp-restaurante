const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function findInsumos() {
  const { data: insumos } = await supabase.from("insumos").select("id, nome, departamento, categoria");
  console.log("=== TODOS OS 133 INSUMOS ===");
  insumos.forEach(i => console.log(`[${i.departamento || 'sem dept'}] ${i.nome}`));
}

findInsumos();
