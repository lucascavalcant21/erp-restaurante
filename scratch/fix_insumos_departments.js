const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDepartments() {
  console.log("=== ORGANIZANDO DEPARTAMENTOS DOS 133 INSUMOS DA UNIDADE ===");

  const { data: insumos } = await supabase.from("insumos").select("*");
  console.log(`Total de insumos encontrados: ${insumos?.length}`);

  let contCozinha = 0;
  let contBar = 0;
  let contLimpeza = 0;
  let contEmbalagens = 0;

  for (const insumo of insumos || []) {
    const nome = (insumo.nome || "").toLowerCase();
    const cat = (insumo.categoria || "").toLowerCase();
    const deptOriginal = (insumo.departamento || "").toLowerCase();

    let novoDept = "cozinha";
    let novaCat = insumo.categoria;

    // 1. Limpeza
    if (
      deptOriginal.includes("limpeza") ||
      cat.includes("limpeza") ||
      cat.includes("higiene") ||
      /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo|palha de aco|alvejante|multiuso|pano)/.test(nome)
    ) {
      novoDept = "limpeza";
      if (!novaCat) novaCat = "Limpeza";
      contLimpeza++;
    }
    // 2. Embalagens
    else if (
      deptOriginal.includes("embalag") ||
      deptOriginal.includes("descartav") ||
      cat.includes("embalag") ||
      cat.includes("descartav") ||
      /(embalagem|caixa|sacola|copo descartavel|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio|bobina)/.test(nome)
    ) {
      novoDept = "embalagens";
      if (!novaCat) novaCat = "Embalagens";
      contEmbalagens++;
    }
    // 3. Bar
    else if (
      deptOriginal.includes("bar") ||
      deptOriginal.includes("bebida") ||
      deptOriginal.includes("drink") ||
      cat.includes("bebida") ||
      cat.includes("drink") ||
      cat.includes("cerveja") ||
      cat.includes("destilado") ||
      cat.includes("vinho") ||
      cat.includes("refrigerante") ||
      cat.includes("suco") ||
      cat.includes("xarope") ||
      /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|poupa)/.test(nome)
    ) {
      novoDept = "bar";
      if (!novaCat) novaCat = "Bebidas";
      contBar++;
    }
    // 4. Cozinha
    else {
      novoDept = "cozinha";
      contCozinha++;
    }

    if (insumo.departamento !== novoDept || (novaCat && insumo.categoria !== novaCat)) {
      console.log(`Atualizando "${insumo.nome}": dept="${insumo.departamento}" -> "${novoDept}", cat="${insumo.categoria}" -> "${novaCat}"`);
      await supabase.from("insumos").update({ departamento: novoDept, categoria: novaCat }).eq("id", insumo.id);
    }
  }

  console.log(`\n=== RESUMO REORGANIZAÇÃO DE DEPARTAMENTOS ===`);
  console.log(`- Cozinha: ${contCozinha} insumos`);
  console.log(`- Bar: ${contBar} insumos`);
  console.log(`- Limpeza: ${contLimpeza} insumos`);
  console.log(`- Embalagens: ${contEmbalagens} insumos`);
}

fixDepartments();
