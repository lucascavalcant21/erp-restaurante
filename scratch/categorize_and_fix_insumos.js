const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: insumos } = await supabase.from('insumos').select('*');
  console.log(`Total insumos: ${insumos.length}`);

  const updates = [];

  for (const item of insumos) {
    const nome = (item.nome || "").toLowerCase();
    const cat = (item.categoria || "").toLowerCase();
    let nDept = item.departamento;

    // Checa se é Limpeza
    if (
      /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo|limpeza|higiene|sanitizante|lisoform|peroxido)/.test(nome) ||
      /(limpeza|higiene)/.test(cat)
    ) {
      nDept = "limpeza";
    }
    // Checa se é Embalagens / Descartáveis
    else if (
      /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio|descartav|papel manteiga|papel alum)/.test(nome) ||
      /(embalag|descartav)/.test(cat)
    ) {
      nDept = "embalagens";
    }
    // Checa se é Bar / Bebidas
    else if (
      /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|vermute|bitter|espumante|poupa|aperol|curacau|coca|sprite|fanta|guarana|schweppes|corona|amstel|heineken|stella)/.test(nome) ||
      /(bar|bebida|drink|adega|cerveja)/.test(cat) ||
      item.departamento === "bar"
    ) {
      nDept = "bar";
    } else {
      nDept = "cozinha";
    }

    if (nDept !== item.departamento) {
      updates.push({ id: item.id, nome: item.nome, de: item.departamento, para: nDept });
      await supabase.from('insumos').update({ departamento: nDept }).eq('id', item.id);
    }
  }

  console.log(`Atualizados ${updates.length} insumos com seus departamentos corretos:`);
  console.table(updates);
}

run();
