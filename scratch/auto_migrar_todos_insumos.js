import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrarTudo() {
  console.log("Iniciando migração automática de todos os insumos para os estoques...");
  
  const { data: insumos, error: errInsumos } = await supabase.from("insumos").select("*");
  if (errInsumos) {
    console.error("Erro ao buscar insumos:", errInsumos);
    return;
  }
  console.log(`Encontrados ${insumos.length} insumos no total.`);

  const { data: estoques, error: errEstoques } = await supabase.from("estoques").select("*");
  if (errEstoques) {
    console.error("Erro ao buscar estoques:", errEstoques);
    return;
  }
  console.log(`Encontrados ${estoques.length} estoques.`);

  let vinculados = 0;

  for (const item of insumos) {
    const unidadId = item.unidade_id;
    if (!unidadId) continue;

    const estoquesDaUnidade = estoques.filter(e => e.unidade_id === unidadId);
    if (!estoquesDaUnidade.length) continue;

    const dept = (item.departamento || "").toLowerCase();
    const cat = (item.categoria || "").toLowerCase();
    const nome = (item.nome || "").toLowerCase();

    let estoqueAlvo = null;

    // 1. Limpeza
    if (dept.includes("limpeza") || cat.includes("limpeza") || cat.includes("higiene") || /(detergente|sabao|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo)/.test(nome)) {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("limpeza") || e.tipo === "limpeza");
    }
    // 2. Embalagens
    else if (dept.includes("embalag") || dept.includes("descartav") || cat.includes("embalag") || cat.includes("descartav") || /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|filme pvc|aluminio)/.test(nome)) {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("embalag") || e.tipo === "embalagens");
    }
    // 3. Bar
    else if (dept.includes("bar") || dept.includes("bebida") || dept.includes("drink") || cat.includes("bebida") || cat.includes("drink") || cat.includes("cerveja") || cat.includes("destilado") || cat.includes("vinho") || cat.includes("refrigerante") || cat.includes("suco") || /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|vermute|bitter|espumante)/.test(nome)) {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("bar") || e.tipo === "bebidas");
    }
    // 4. Cozinha (fallback)
    else {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("cozinha") || e.tipo === "alimentos");
    }

    if (!estoqueAlvo) {
      estoqueAlvo = estoquesDaUnidade[0];
    }

    if (estoqueAlvo) {
      // Upsert em estoque_itens
      const { error: errItem } = await supabase.from("estoque_itens").upsert({
        unidade_id: unidadId,
        estoque_id: estoqueAlvo.id,
        insumo_id: item.id,
        quantidade_atual: item.quantidade_atual || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "estoque_id,insumo_id" });

      if (errItem) {
        console.warn(`Erro ao vincular item ${item.nome} (${item.id}) ao estoque ${estoqueAlvo.nome}:`, errItem.message);
      } else {
        vinculados++;
      }

      // Upsert em estoque_atual
      await supabase.from("estoque_atual").upsert({
        unidade_id: unidadId,
        insumo_id: item.id,
        quantidade_atual: item.quantidade_atual || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "unidade_id,insumo_id" }).catch(() => {});
    }
  }

  console.log(`Concluído! ${vinculados} insumos vinculados com sucesso aos estoques!`);
}

migrarTudo();
