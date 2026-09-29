const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://sezccspqxgklicfndwxx.supabase.co', 'sb_publishable_hstqbkrp5CM1FBZoyrjcXg_MrOOKCsX');

async function test() {
  const { data, error } = await sb.from("eventos").select("id").limit(1);
  if (error) return console.log("Select Error:", error);
  const id = data[0].id;

  const { error: updErr } = await sb.from("eventos").update({ cardapio_itens: [] }).eq("id", id);
  console.log("Update Error:", updErr);
}
test();
