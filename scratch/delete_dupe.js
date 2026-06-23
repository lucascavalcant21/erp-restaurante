const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { error } = await supabase
      .from("registro_ponto")
      .delete()
      .eq("id", "07938aa2-b5f2-4a2a-8f34-1225b0c091f8");

    if(error) console.error("Error delete:", error);
    else console.log("Linha fantasma deletada com sucesso!");
}
test();
