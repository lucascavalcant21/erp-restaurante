const fs = require('fs');
let txt = fs.readFileSync('app/lib/folgas-domingo.mjs', 'utf8');

txt = txt.replace(
  'export function avisosDaFolga({ data, hoje, nome = "", folgas = [], pontoDoDia = null, horaLocal = (iso) => iso }) {',
  'export function avisosDaFolga({ data, hoje, nome = "", folgas = [], pontoDoDia = null, horaLocal = (iso) => iso, genero = "" }) {'
);

txt = txt.replace(
  'if (outras.length) avisos.push(`${quem} jǭ tem folga de domingo em ${nomeDoMes(data.slice(0, 7))} (${outras.map(dataCurta).join(", ")}). A regra Ǹ uma por mǦs.`);',
  'const limite = (genero === "Feminino") ? 2 : 1;\n    if (outras.length >= limite) avisos.push(`${quem} jǭ tem ${outras.length} folga(s) de domingo em ${nomeDoMes(data.slice(0, 7))} (${outras.map(dataCurta).join(", ")}). A regra Ǹ ${limite} por mǦs${genero === "Feminino" ? " para mulheres" : ""}.`);'
);

fs.writeFileSync('app/lib/folgas-domingo.mjs', txt);
