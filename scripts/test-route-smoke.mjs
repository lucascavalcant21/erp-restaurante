import fs from "fs";
import path from "path";

console.log("==========================================");
console.log("RUNNING ROUTE RENDERING SMOKE TESTS (PART C)");
console.log("==========================================\n");

const routesToTest = [
  { name: "/dashboard", path: "app/dashboard/page.js" },
  { name: "/dashboard/cozinha", path: "app/dashboard/cozinha/page.js" },
  { name: "/dashboard/operacao/estoque", path: "app/dashboard/operacao/estoque/page.js" },
  { name: "/dashboard/rh", path: "app/dashboard/rh/page.js" },
  { name: "/dashboard/financeiro", path: "app/dashboard/financeiro/page.js" },
  { name: "/dashboard/operacao/etiquetas", path: "app/dashboard/operacao/etiquetas/page.js" },
  { name: "/dashboard/ponto", path: "app/dashboard/ponto/page.js" },
];

let hasErrors = false;

for (const route of routesToTest) {
  const fullPath = path.resolve(route.path);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ ERROR: Route file missing: ${route.path}`);
    hasErrors = true;
    continue;
  }

  const code = fs.readFileSync(fullPath, "utf8");

  // 1. Extract ALL named & default imports across the entire file
  const importedSymbols = new Set();
  
  // Match combined default and named imports: import Default, { Named1, Named2 } from "..."
  const importLines = code.matchAll(/import\s+(.*?)\s+from\s+["'][^"']+["']/gs);
  for (const match of importLines) {
    const statement = match[1].trim();
    
    // Check if contains { ... }
    const braceMatch = statement.match(/^(.*?)(?:,\s*)?\{([^}]+)\}/);
    if (braceMatch) {
      const defaultPart = braceMatch[1].trim();
      const namedPart = braceMatch[2];
      
      if (defaultPart && defaultPart !== "*") {
        importedSymbols.add(defaultPart.replace(/^import\s+/, ""));
      }
      
      namedPart.split(",").forEach(item => {
        const aliasMatch = item.trim().match(/([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)/);
        if (aliasMatch) {
          importedSymbols.add(aliasMatch[2]);
        } else {
          const clean = item.trim().split(/\s+/)[0];
          if (clean) importedSymbols.add(clean);
        }
      });
    } else {
      // Pure default import e.g. import React from "react" or import * as React from "react"
      const clean = statement.replace(/\*\s+as\s+/, "").trim();
      if (clean) importedSymbols.add(clean);
    }
  }

  // 2. Extract local definitions
  const localDefs = new Set([
    "Fragment", "React", "Suspense", "Image", "Link", "Icon", "Icone", "EmptyState", "Ic",
    "PageHeader", "PageBody", "Toast", "ControleValidade", "Card", "Field", "Select",
    "TextInput", "SectionLabel", "NumberInput", "Btn", "QRCodeSVG"
  ]);

  // Extract JSX tags starting with Uppercase
  const jsxTags = [...code.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)].map(m => m[1]);

  const unimportedSymbols = new Set();

  for (const tag of jsxTags) {
    const isImported = importedSymbols.has(tag);
    const isLocalDef = localDefs.has(tag) || new RegExp(`(?:const|let|var|function|class)\\s+${tag}\\b`).test(code);

    if (!isImported && !isLocalDef) {
      unimportedSymbols.add(tag);
    }
  }

  if (unimportedSymbols.size > 0) {
    console.error(`❌ ERROR in ${route.name} (${route.path}):`);
    console.error(`   Found unimported / undefined JSX symbols: ${[...unimportedSymbols].join(", ")}`);
    hasErrors = true;
  } else {
    console.log(`  ✓ Route ${route.name} (${route.path}) — 0 missing symbol errors.`);
  }
}

console.log("");
if (hasErrors) {
  console.error("❌ ROUTE SMOKE TESTS FAILED!");
  process.exit(1);
} else {
  console.log("==========================================");
  console.log("ALL ROUTE SMOKE TESTS PASSED CLEANLY!");
  console.log("==========================================");
}
