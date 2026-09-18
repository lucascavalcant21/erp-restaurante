import fs from "fs";
import path from "path";

console.log("==========================================");
console.log("AST & SCOPE CHECK FOR app/dashboard/page.js");
console.log("==========================================\n");

const code = fs.readFileSync(path.resolve("app/dashboard/page.js"), "utf8");

// 1. Extract imports
const imports = new Set();
const importMatches = code.matchAll(/import\s+(?:([A-Za-z0-9_$]+)|(?:\{([^}]+)\}))\s+from\s+["'][^"']+["']/gs);
for (const m of importMatches) {
  if (m[1]) imports.add(m[1].trim());
  if (m[2]) {
    m[2].split(",").forEach(item => {
      const aliasMatch = item.trim().match(/([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)/);
      if (aliasMatch) imports.add(aliasMatch[2]);
      else {
        const clean = item.trim().split(/\s+/)[0];
        if (clean) imports.add(clean);
      }
    });
  }
}

console.log("Imported symbols in app/dashboard/page.js:", Array.from(imports).sort());

// Check if Search is in imports
if (!imports.has("Search")) {
  console.error("❌ ERROR: Search is NOT imported in app/dashboard/page.js!");
  process.exit(1);
} else {
  console.log("✓ SUCCESS: 'Search' is correctly imported from 'lucide-react' in app/dashboard/page.js!");
}
