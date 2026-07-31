import { createClient } from "@supabase/supabase-js";
import fs from "fs";

let envText = "";
try { envText = fs.readFileSync(".env.local", "utf8"); } catch {}
const envVars = {};
envText.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ESTOQUES_PADRAO = [
  { nome: "Cozinha", slug: "cozinha", tipo: "alimentos", cor: "#059669", controla_validade: true, controla_minimo: true },
  { nome: "Bar", slug: "bar", tipo: "bebidas", cor: "#7c3aed", controla_validade: true, controla_minimo: true },
  { nome: "Limpeza", slug: "limpeza", tipo: "limpeza", cor: "#0284c7", controla_validade: false, controla_minimo: true },
  { nome: "Materiais variados", slug: "materiais-variados", tipo: "materiais", cor: "#d97706", controla_validade: false, controla_minimo: true },
  { nome: "Embalagens", slug: "embalagens", tipo: "embalagens", cor: "#db2777", controla_validade: false, controla_minimo: true },
];

async function executar() {
  console.log("1. Atualizando qualquer 'fardo' para 'lata' nos insumos...");
  await supabase.from("insumos").update({ unidade_comercial: "lata" }).ilike("unidade_comercial", "%fardo%");
  await supabase.from("insumos").update({ embalagem: "lata" }).ilike("embalagem", "%fardo%");

  console.log("2. Buscando todos os insumos...");
  const { data: insumos } = await supabase.from("insumos").select("*");
  if (!insumos || !insumos.length) {
    console.log("Nenhum insumo encontrado.");
    return;
  }

  const unidades = [...new Set(insumos.map(i => i.unidade_id).filter(Boolean))];
  console.log("Unidades encontradas:", unidades);

  for (const unidadId of unidades) {
    // Garante que existam os estoques padrão para esta unidade
    for (const est of ESTOQUES_PADRAO) {
      try {
        await supabase.from("estoques").upsert({
          unidade_id: unidadId,
          nome: est.nome,
          slug: est.slug,
          tipo: est.tipo,
          cor: est.cor,
          controla_validade: est.controla_validade,
          controla_minimo: est.controla_minimo,
          status: "ativo",
          updated_at: new Date().toISOString(),
        }, { onConflict: "unidade_id,slug" });
      } catch {}
    }

    const { data: ests } = await supabase.from("estoques").select("*").eq("unidade_id", unidadId);
    console.log(`Unidade ${unidadId}: ${ests?.length || 0} estoques ativos.`);

    const insumosDaUnidade = insumos.filter(i => i.unidade_id === unidadId);
    let vinculados = 0;

    for (const item of insumosDaUnidade) {
      const dept = (item.departamento || "").toLowerCase();
      const cat = (item.categoria || "").toLowerCase();
      const nome = (item.nome || "").toLowerCase();

      let estoqueAlvo = null;

      // 1. Limpeza
      if (dept.includes("limpeza") || cat.includes("limpeza") || cat.includes("higiene") || /(detergente|sabao|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo)/.test(nome)) {
        estoqueAlvo = ests.find(e => (e.slug || e.nome || "").toLowerCase().includes("limpeza") || e.tipo === "limpeza");
      }
      // 2. Embalagens
      else if (dept.includes("embalag") || dept.includes("descartav") || cat.includes("embalag") || cat.includes("descartav") || /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|filme pvc|aluminio)/.test(nome)) {
        estoqueAlvo = ests.find(e => (e.slug || e.nome || "").toLowerCase().includes("embalag") || e.tipo === "embalagens");
      }
      // 3. Bar
      else if (dept.includes("bar") || dept.includes("bebida") || dept.includes("drink") || cat.includes("bebida") || cat.includes("drink") || cat.includes("cerveja") || cat.includes("destilado") || cat.includes("vinho") || cat.includes("refrigerante") || cat.includes("suco") || /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|vermute|bitter|espumante|absolut)/.test(nome)) {
        estoqueAlvo = ests.find(e => (e.slug || e.nome || "").toLowerCase().includes("bar") || e.tipo === "bebidas");
      }
      // 4. Cozinha (fallback)
      else {
        estoqueAlvo = ests.find(e => (e.slug || e.nome || "").toLowerCase().includes("cozinha") || e.tipo === "alimentos");
      }

      if (!estoqueAlvo) estoqueAlvo = ests[0];

      if (estoqueAlvo) {
        const { error: errItem } = await supabase.from("estoque_itens").upsert({
          unidade_id: unidadId,
          estoque_id: estoqueAlvo.id,
          insumo_id: item.id,
          quantidade_atual: item.quantidade_atual || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "estoque_id,insumo_id" });

        if (!errItem) vinculados++;

        try {
          await supabase.from("estoque_atual").upsert({
            unidade_id: unidadId,
            insumo_id: item.id,
            quantidade_atual: item.quantidade_atual || 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: "unidade_id,insumo_id" });
        } catch {}
      }
    }

    console.log(`Unidade ${unidadId}: Sucesso! ${vinculados} de ${insumosDaUnidade.length} insumos migrados e vinculados ao Estoque!`);
  }
}

executar();
