import { createClient } from '@supabase/supabase-js';

/* Script avulso de manutenção. A URL e a chave do projeto de PRODUÇÃO estavam
   escritas aqui dentro: rodar o arquivo por engano mexia no banco real.
   Agora ele exige as variáveis do ambiente em que você quer mexer. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !chave) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY do ambiente alvo antes de rodar este script.");
  process.exit(1);
}
const supabase = createClient(url, chave);

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
