const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function reorganizarEstoques() {
  console.log("=== REORGANIZANDO E SEPARANDO ESTOQUES DA UNIDADE ===");

  const { data: estoques } = await supabase.from("estoques").select("*").eq("unidade_id", "seldeestrela");
  console.log("Estoques disponíveis:", estoques.map(e => `${e.nome} (${e.slug}) -> ${e.id}`));

  const estCozinha = estoques.find(e => e.slug === "cozinha");
  const estBar = estoques.find(e => e.slug === "bar");
  const estLimpeza = estoques.find(e => e.slug === "limpeza");
  const estEmbalagens = estoques.find(e => e.slug === "embalagens");
  const estMateriais = estoques.find(e => e.slug === "materiais-variados");

  const { data: itens, error } = await supabase
    .from("estoque_itens")
    .select("*, insumo:insumos(id, nome, departamento, categoria)");

  console.log(`Total de itens em estoque_itens: ${itens?.length}`);

  let reclassificados = 0;
  for (const item of itens || []) {
    const insumo = item.insumo;
    if (!insumo) continue;

    const dept = (insumo.departamento || "").toLowerCase();
    const cat = (insumo.categoria || "").toLowerCase();
    const nome = (insumo.nome || "").toLowerCase();

    let novoEstoque = estCozinha; // Padrão Cozinha

    // 1. Limpeza
    if (
      dept.includes("limpeza") ||
      cat.includes("limpeza") ||
      cat.includes("higiene") ||
      /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo|palha de aco|alvejante|multiuso|pano)/.test(nome)
    ) {
      novoEstoque = estLimpeza || estCozinha;
    }
    // 2. Embalagens
    else if (
      dept.includes("embalag") ||
      dept.includes("descartav") ||
      cat.includes("embalag") ||
      cat.includes("descartav") ||
      /(embalagem|caixa|sacola|copo descartavel|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio|bobina)/.test(nome)
    ) {
      novoEstoque = estEmbalagens || estCozinha;
    }
    // 3. Bar
    else if (
      dept.includes("bar") ||
      dept.includes("bebida") ||
      dept.includes("drink") ||
      cat.includes("bebida") ||
      cat.includes("drink") ||
      cat.includes("cerveja") ||
      cat.includes("destilado") ||
      cat.includes("vinho") ||
      cat.includes("refrigerante") ||
      cat.includes("suco") ||
      cat.includes("xarope") ||
      /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila)/.test(nome)
    ) {
      novoEstoque = estBar || estCozinha;
    }

    if (novoEstoque && item.estoque_id !== novoEstoque.id) {
      console.log(`Reclassificando "${insumo.nome}" de [${item.estoque_id}] -> [${novoEstoque.nome} (${novoEstoque.id})]`);
      const { error: errUpd } = await supabase
        .from("estoque_itens")
        .update({ estoque_id: novoEstoque.id, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (!errUpd) reclassificados++;
      else console.error("Erro update:", errUpd.message);
    }
  }

  console.log(`\nReclassificação concluída! ${reclassificados} itens movidos para suas áreas corretas.`);

  // Conta itens por estoque
  const { data: contagem } = await supabase.from("estoque_itens").select("estoque_id");
  const porEstoque = new Map();
  (contagem || []).forEach(c => porEstoque.set(c.estoque_id, (porEstoque.get(c.estoque_id) || 0) + 1));

  console.log("\nResumo de itens por área após organização:");
  estoques.forEach(e => {
    console.log(`- ${e.nome} (${e.slug}): ${porEstoque.get(e.id) || 0} itens`);
  });
}

reorganizarEstoques();
