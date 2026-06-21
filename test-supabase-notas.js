const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('notas_fiscais').select('id').limit(1);
  if (error) {
    console.error('ERRO:', error.message);
  } else {
    console.log('SUCESSO, tabela existe. Data:', data);
  }
}

test();
