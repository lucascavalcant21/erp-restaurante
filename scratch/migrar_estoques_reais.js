const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrarEstoquesReais() {
  console.log("=== INICIANDO MIGRAÇÃO E VERIFICAÇÃO DE ESTOQUES REAIS ===");

  // 1. Busca todas as unidades ativas
  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  console.log("Unidades encontradas:", unidades);

  const targetUnidades = (unidades || []).map(u => u.id).concat(["seldeestrela"]);
  const listaUnidades = [...new Set(targetUnidades.filter(Boolean))];

  for (const unidadeId of listaUnidades) {
    console.log(`\n--- Processando unidade: ${unidadeId} ---`);

    // Ensure standard stock areas exist
    const estsPadrao = [
      { nome: "Cozinha", slug: "cozinha", tipo: "alimentos", cor: "#059669", controla_validade: true, controla_minimo: true, ordem: 0 },
      { nome: "Bar", slug: "bar", tipo: "bebidas", cor: "#7c3aed", controla_validade: true, controla_minimo: true, ordem: 1 },
      { nome: "Limpeza", slug: "limpeza", tipo: "limpeza", cor: "#0284c7", controla_validade: false, controla_minimo: true, ordem: 2 },
      { nome: "Embalagens", slug: "embalagens", tipo: "embalagens", cor: "#db2777", controla_validade: false, controla_minimo: true, ordem: 3 },
      { nome: "Materiais variados", slug: "materiais-variados", tipo: "materiais", cor: "#d97706", controla_validade: false, controla_minimo: true, ordem: 4 },
    ];

    for (const est of estsPadrao) {
      await supabase.from("estoques").upsert({
        unidade_id: unidadeId,
        nome: est.nome,
        slug: est.slug,
        tipo: est.tipo,
        descricao: `Estoque de ${est.nome.toLowerCase()}`,
        status: "ativo",
        cor: est.cor,
        controla_validade: est.controla_validade,
        controla_minimo: est.controla_minimo,
        locais_internos: [],
        permissoes: [],
        ordem: est.ordem,
      }, { onConflict: "unidade_id,slug" });
    }

    // Busca os estoques criados/existentes
    const { data: estoques } = await supabase.from("estoques").select("*").eq("unidade_id", unidadeId);
    console.log(`Estoques da unidade ${unidadeId}:`, estoques?.map(e => `${e.nome} (${e.id})`));

    const estCozinha = estoques?.find(e => e.slug === "cozinha");
    const estBar = estoques?.find(e => e.slug === "bar");
    const estLimpeza = estoques?.find(e => e.slug === "limpeza");
    const estEmbalagens = estoques?.find(e => e.slug === "embalagens");
    const estMateriais = estoques?.find(e => e.slug === "materiais-variados");

    // Busca insumos cadastrados
    let queryInsumos = supabase.from("insumos").select("*");
    if (unidadeId !== "matriz") queryInsumos = queryInsumos.eq("unidade_id", unidadeId);
    const { data: insumos } = await queryInsumos;

    console.log(`Total de insumos cadastrados para ${unidadeId}:`, insumos?.length);

    // Busca saldos legados do estoque_atual
    const { data: saldosLegados } = await supabase.from("estoque_atual").select("*").eq("unidade_id", unidadeId);
    const mapaSaldos = new Map((saldosLegados || []).map(s => [s.insumo_id, Number(s.quantidade_atual) || 0]));

    let inseridos = 0;
    for (const insumo of insumos || []) {
      const dept = (insumo.departamento || "").toLowerCase();
      const cat = (insumo.categoria || "").toLowerCase();
      const nome = (insumo.nome || "").toLowerCase();

      let estoqueAlvo = estCozinha; // Padrão Cozinha

      if (dept.includes("limpeza") || cat.includes("limpeza") || cat.includes("higiene") || /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo)/.test(nome)) {
        estoqueAlvo = estLimpeza || estCozinha;
      } else if (dept.includes("embalag") || dept.includes("descartav") || cat.includes("embalag") || cat.includes("descartav") || /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio)/.test(nome)) {
        estoqueAlvo = estEmbalagens || estCozinha;
      } else if (dept.includes("bar") || dept.includes("bebida") || dept.includes("drink") || cat.includes("bebida") || cat.includes("drink") || cat.includes("cerveja") || cat.includes("destilado") || cat.includes("vinho") || cat.includes("refrigerante") || cat.includes("suco") || cat.includes("xarope") || /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila)/.test(nome)) {
        estoqueAlvo = estBar || estCozinha;
      }

      if (!estoqueAlvo) continue;

      const saldoLegado = mapaSaldos.get(insumo.id) || 0;

      const payloadItem = {
        unidade_id: unidadeId,
        estoque_id: estoqueAlvo.id,
        insumo_id: insumo.id,
        quantidade_atual: saldoLegado,
        estoque_minimo: insumo.estoque_minimo || null,
        estoque_maximo: insumo.estoque_maximo || null,
        local_interno: insumo.local_interno || null,
        custo_unitario: Number(insumo.custo_unitario ?? insumo.custo_compra) || 0,
        updated_at: new Date().toISOString(),
      };

      const { error: errInsert } = await supabase.from("estoque_itens").upsert(payloadItem, { onConflict: "estoque_id,insumo_id" });
      if (!errInsert) inseridos++;
      else console.error("Erro upsert estoque_item:", errInsert.message);
    }

    console.log(`Vínculos de estoque concluídos para ${unidadeId}: ${inseridos} insumos vinculados com sucesso!`);
  }
}

migrarEstoquesReais();
