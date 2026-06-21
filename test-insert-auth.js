const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function test() {
  // Login as admin or create a temp user
  const email = "teste_ocr_" + Date.now() + "@teste.com";
  const password = "password123";
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email, password, options: { data: { nome: "Test", papel: "admin", unidade: "todas" } }
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  console.log("Logged in!");
  
  const payload = {
    unidade_id: "todas",
    fornecedor: "Fornecedor Não Identificado",
    data_emissao: new Date().toISOString().slice(0, 10),
    valor_total: 0,
    imagem_url: "base64",
    categoria: "Hortifruti"
  };
  
  const { data, error } = await supabase.from("notas_fiscais").insert([payload]).select().single();
  if (error) {
    console.error("Insert error:", error.message, error.details, error.hint);
  } else {
    console.log("Insert success:", data);
  }
}

test();
