require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: unidade, error: errUnid } = await supabase
    .from("unidades")
    .select("*")
    .eq("id", "seldeestrela")
    .single();
    
  console.log("Unidade:", unidade);
  console.log("Error Unidade:", errUnid);
  
  const { data: colaboradores, error: errColab } = await supabase
    .from("colaboradores")
    .select("id, nome")
    .eq("unidade_id", "seldeestrela");
    
  console.log("Colab:", colaboradores?.length);
  console.log("Error Colab:", errColab);
  
  const { data: pontos, error: errPontos } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("unidade_id", "seldeestrela")
    .order("created_at", { ascending: true });
    
  console.log("Pontos:", pontos?.length);
  console.log("Error Pontos:", errPontos);
}

run();
