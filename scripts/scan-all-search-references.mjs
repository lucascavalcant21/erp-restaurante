import fs from "fs";
import path from "path";

console.log("==========================================");
console.log("SCANNING ALL FILES IN CODEBASE FOR UNDECLARED 'Search' SYMBOL");
console.log("==========================================\n");

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const full = path.join(dirPath, file);
    if (fs.statSync(full).isDirectory()) {
      if (!file.startsWith(".") && file !== "node_modules" && file !== ".next") {
        getAllFiles(full, arrayOfFiles);
      }
    } else if (/\.(js|jsx|mjs|ts|tsx)$/.test(file)) {
      arrayOfFiles.push(full);
    }
  });
  return arrayOfFiles;
}

const allFiles = getAllFiles(path.resolve("app"));
console.log(`Scanning ${allFiles.length} files...`);

let issuesFound = 0;

for (const filePath of allFiles) {
  const code = fs.readFileSync(filePath, "utf8");

  // Check if file uses Search in JSX (<Search ...>, <Search />, Search: Search, icon: Search)
  const referencesSearchInJsx = /<Search\b|\bicon:\s*Search\b|\bSearch,/g.test(code);

  if (referencesSearchInJsx) {
    // Check if Search is imported or defined
    const hasLucideImport = /import\s+\{[^}]*\bSearch\b[^}]*\}\s+from\s+["']lucide-react["']/.test(code);
    const hasSearchIconAlias = /import\s+\{[^}]*\bSearch\s+as\s+\w+[^}]*\}\s+from\s+["']lucide-react["']/.test(code);
    const hasOtherImport = /import\s+[^'"]*\bSearch\b[^'"]*from/.test(code);
    const hasLocalDef = /(?:const|let|var|function|class)\s+Search\b/.test(code);

    if (!hasLucideImport && !hasSearchIconAlias && !hasOtherImport && !hasLocalDef) {
      console.error(`❌ FOUND UNDECLARED 'Search' IN: ${path.relative(process.cwd(), filePath)}`);
      issuesFound++;
    } else {
      console.log(`  ✓ Valid: ${path.relative(process.cwd(), filePath)}`);
    }
  }
}

console.log("");
if (issuesFound > 0) {
  console.error(`❌ TOTAL ISSUES FOUND: ${issuesFound}`);
  process.exit(1);
} else {
  console.log("==========================================");
  console.log("ALL FILES SCANNED: 0 UNDECLARED 'Search' SYMBOLS FOUND!");
  console.log("==========================================");
}
