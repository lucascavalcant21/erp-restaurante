const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const hoje = new Date().toISOString().split('T')[0];
    const { data: registros, error: err } = await supabase
      .from("registro_ponto")
      .select("*")
      .eq("data_referencia", hoje)
      .order("created_at", { ascending: false });

    if(err) console.error("Error select:", err);
    console.log("Registros de hoje:", JSON.stringify(registros, null, 2));
}
test();
