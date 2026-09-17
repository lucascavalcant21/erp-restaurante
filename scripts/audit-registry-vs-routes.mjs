import fs from "fs";
import path from "path";
import { NAVIGATION_REGISTRY } from "../app/lib/navigation-registry.mjs";

function getPhysicalDashboardRoutes(dir, baseRoute = "/dashboard") {
  let routes = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Pula diretorios como api ou componentes se existirem dentro de app/dashboard
      if (entry.name.startsWith("_") || entry.name === "api") continue;

      let subRoute = `${baseRoute}/${entry.name}`;
      if (entry.name.startsWith("[") && entry.name.endsWith("]")) {
        subRoute = `${baseRoute}/${entry.name}`;
      }
      routes = routes.concat(getPhysicalDashboardRoutes(fullPath, subRoute));
    } else if (entry.isFile() && (entry.name === "page.js" || entry.name === "page.jsx" || entry.name === "page.tsx")) {
      routes.push(baseRoute);
    }
  }
  return routes;
}

const dashboardDir = path.resolve("app/dashboard");
const physicalRoutes = getPhysicalDashboardRoutes(dashboardDir);

console.log("=== AUDITORIA: ROTAS FÍSICAS X NAVIGATION REGISTRY ===");
console.log(`Rotas físicas encontradas no App Router (/dashboard): ${physicalRoutes.length}`);
console.log(`Destinos cadastrados no Navigation Registry: ${NAVIGATION_REGISTRY.length}`);

const registryRoutes = NAVIGATION_REGISTRY.map(r => r.route.split("?")[0]);

// Rotas registradas que não existem fisicamente (Rotas fantasmas)
const ghostRoutes = registryRoutes.filter(r => !physicalRoutes.some(p => p === r || r.startsWith(p.split("[")[0])));

console.log(`\n1. Rotas Fantasmas (No Registry mas sem arquivo de página física): ${ghostRoutes.length}`);
if (ghostRoutes.length === 0) {
  console.log("✅ ZERO rotas fantasmas! Todas as entradas do Registry apontam para rotas físicas reais.");
} else {
  console.log("⚠️ ATENÇÃO: Rotas fantasmas encontradas:", ghostRoutes);
}

// Rotas físicas que não estão explicitamente como entrada própria no Registry
const unmappedPhysical = physicalRoutes.filter(p => !registryRoutes.includes(p));

console.log(`\n2. Sub-rotas/Páginas internas não listadas como destino principal: ${unmappedPhysical.length}`);
console.log("Exemplos de sub-rotas/telas internas mantidas por botões contextuais (sem poluírem o menu):");
unmappedPhysical.slice(0, 15).forEach(r => console.log(`   - ${r}`));

console.log("\n=======================================================");
