const fs = require('fs');
['app/dashboard/reservas-eventos/eventos/[id]/OperacaoTab.js', 'app/dashboard/reservas-eventos/eventos/[id]/FinanceiroTab.js', 'app/eventos/[unidade]/page.js'].forEach(f => {
  let c = fs.readFileSync(f, 'utf-8');
  c = c.replace(/import supabase from "([^"]+lib\/supabase)"/g, 'import { supabase } from "$1"');
  fs.writeFileSync(f, c, 'utf-8');
});
console.log('Fixed supabase imports');
