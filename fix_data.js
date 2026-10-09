const fs = require('fs');
let txt = fs.readFileSync('app/lib/contrato-experiencia.mjs', 'utf8');

const old = 'const dataDe = (iso) => { if(!iso) return null; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return isNaN(d.getTime()) ? null : meiaNoite(d); };';
const replace = `const dataDe = (iso) => {
  if(!iso) return null;
  let s = String(iso).slice(0, 10);
  if(s.includes('/')) {
    const p = s.split('/');
    if(p.length === 3) s = \`\${p[2]}-\${p[1]}-\${p[0]}\`;
  }
  const d = new Date(\`\${s}T12:00:00\`);
  return isNaN(d.getTime()) ? null : meiaNoite(d);
};`;

txt = txt.replace(old, replace);
fs.writeFileSync('app/lib/contrato-experiencia.mjs', txt);
