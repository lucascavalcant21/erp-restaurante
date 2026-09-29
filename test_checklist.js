require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // Let's grab the first event id
  const { data: ev } = await sb.from("eventos").select("id").limit(1);
  if (!ev || !ev.length) return console.log("No events");
  const id = ev[0].id;
  
  const { data, error } = await sb.from("eventos").update({ checklist: { cardapio: true } }).eq("id", id);
  console.log("Checklist update result:", { error });
}
run();
