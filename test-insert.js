const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function test() {
  const nota = {
    unidade_id: null,
    fornecedor: "Teste Central",
    data_emissao: "2026-06-10",
    valor_total: 100
  };
  const { data, error } = await supabase.from('notas_fiscais').insert([nota]);
  console.log('Insert com null:', error ? error.message : 'Sucesso');
  
  const nota2 = {
    unidade_id: "todas",
    fornecedor: "Teste Todas",
    data_emissao: "2026-06-10",
    valor_total: 100
  };
  const { data: d2, error: e2 } = await supabase.from('notas_fiscais').insert([nota2]);
  console.log('Insert com todas:', e2 ? e2.message : 'Sucesso');
}

test();
