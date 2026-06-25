import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://sezccspqxgklicfndwxx.supabase.co",
  "sb_publishable_hstqbkrp5CM1FBZoyrjcXg_MrOOKCsX"
);

async function run() {
  const { data: mesas, error } = await supabase.from('mesas').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error('Erro ao buscar mesas:', error);
    return;
  }

  let counter = 1;
  for (const mesa of mesas) {
    if (mesa.numero_mesa === 'Mesa Antiga') {
      const { error: updErr } = await supabase.from('mesas').update({ numero_mesa: String(counter) }).eq('id', mesa.id);
      if (updErr) {
        console.error('Erro ao atualizar mesa', mesa.id, updErr);
      } else {
        console.log(`Mesa ${mesa.id} atualizada para número ${counter}`);
      }
      counter++;
    } else {
       const num = parseInt(mesa.numero_mesa);
       if(!isNaN(num) && num >= counter) {
          counter = num + 1;
       }
    }
  }
  console.log('Finalizado!');
}

run();
