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
      .order("created_at", { ascending: false })
      .limit(1);

    if(err) console.error("Error select:", err);
    console.log("Registro encontrado:", registros);

    if(registros && registros.length > 0) {
        const registro = registros[0];
        const agora = new Date().toISOString();
        const updates = { hora_saida_intervalo: agora, status_jornada: 2 };
        const { error } = await supabase.from("registro_ponto").update(updates).eq("id", registro.id);
        if(error) {
            console.error("Erro update:", error);
        } else {
            console.log("Update sucesso!");
        }
    }
}
test();
