require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log("Checando mesas...");
  const { data: mesas, error: err1 } = await supabase.from('mesas').select('*').limit(1);
  if (err1) console.error("Erro mesas:", err1);
  else console.log("Colunas de mesas:", mesas.length > 0 ? Object.keys(mesas[0]) : "Tabela vazia");

  console.log("Checando produtos...");
  const { data: prod, error: err2 } = await supabase.from('produtos').select('*').limit(1);
  if (err2) console.error("Erro produtos:", err2);
  else console.log("Colunas de produtos:", prod.length > 0 ? Object.keys(prod[0]) : "Tabela vazia");
  
  console.log("Checando pedidos_itens...");
  const { data: pitens, error: err3 } = await supabase.from('pedidos_itens').select('*').limit(1);
  if (err3) console.error("Erro pedidos_itens:", err3);
  else console.log("Colunas de pedidos_itens:", pitens.length > 0 ? Object.keys(pitens[0]) : "Tabela vazia");

}

checkSchema();
