const fs = require("fs");

const text = fs.readFileSync("app/components/EtiquetasRapidas.js", "utf-8");
const idx = text.indexOf("export default function EtiquetasRapidas() {");
if (idx === -1) process.exit(1);

const head = text.substring(0, idx);
fs.writeFileSync("head.js", head, "utf-8");
