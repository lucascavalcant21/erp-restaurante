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

function inferirCategoriaBar(nome, marca, catAntiga) {
  const texto = `${catAntiga || ""} ${nome || ""} ${marca || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (/cerveja|chopp|chope|amstel|heineken|skol|brahma|corona|budweiser|stella|eisenbahn|sol|spaten|long neck|pilsen|ipa|lager/.test(texto)) return "Cervejas";
  if (/destilado|vodka|absolut|smirnoff|grey goose|whisky|whiskey|red label|black label|jack daniels|ballantines|chivas|passport|white horse|gin|tanqueray|beefeater|gordons|bombay|cachaca|cachaça|jambu|amburana|pirassununga|51|velho barreiro|seleta|salinas|ypioca|rum|bacardi|montilla|tequila|jose cuervo|licor|jagermeister|baileys|cointreau|amaretto|drambuie|campari|aperol|martini|vermute|conhaque|domecq|dreher|presidente|dose|drink|coquetel|caipirinha|mojito|margarita/.test(texto)) return "Destilados";
  if (/vinho|espumante|champagne|prosecco|cabernet|malbec|merlot|chardonnay|sauvignon|carmenere|tinto|branco|rose|rosé|chocovino|contry wine|campo largo|cordeiro con piel|pergola|santa helena|concha y toro/.test(texto)) return "Vinhos";
  if (/chopp|chope|barril/.test(texto)) return "Chopp";
  if (/agua|água|tonica|tônica|schweppes|perrier|san pellegrino/.test(texto)) return "Água";
  if (/refrigerante|coca|cocacola|guarana|guaraná|fanta|sprite|pepsi|soda|h2oh|sukita/.test(texto)) return "Refrigerantes";
  if (/bombom|trufa|chocolate|ferrero|raffaello|lacta|nestle|garoto/.test(texto)) return "Bombons";
  if (/xarope|mix|espuma|geleia|infusao|monin|1883|fabbri/.test(texto)) return "Pré-preparos";
  
  return "Destilados"; // fallback para bebidas sem tipo específico
}

async function fix() {
  console.log("Buscando insumos com categoria genérica...");
  const { data: insumos } = await supabase.from("insumos").select("*");
  let atualizados = 0;

  for (const item of insumos || []) {
    const cat = (item.categoria || "").trim();
    const dept = (item.departamento || "").trim().toLowerCase();
    
    const ehBar = dept === "bar" || dept === "bebidas" || cat.toLowerCase().includes("bebida");
    if (ehBar || !cat || /^(bebidas?|insumos?|ingredientes?|sem categoria)$/i.test(cat)) {
      const novaCat = inferirCategoriaBar(item.nome, item.marca, item.categoria);
      if (novaCat !== item.categoria) {
        await supabase.from("insumos").update({ categoria: novaCat }).eq("id", item.id);
        await supabase.from("estoque_itens").update({ categoria: novaCat }).eq("insumo_id", item.id);
        atualizados++;
      }
    }
  }

  console.log(`Concluído! ${atualizados} insumos do Bar recategorizados com sucesso!`);
}

fix();
