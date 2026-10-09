const fs = require('fs');
let txt = fs.readFileSync('app/dashboard/rh/page.js', 'utf8');

txt = txt.replace(
  'const [atestedoForm, setAtestadoForm] = useState({ data_inicio: new Date().toISOString().split("T")[0], dias: "1", cid: "", medico: "", motivo: "", arquivo: null });',
  'const [atestedoForm, setAtestadoForm] = useState({ data_inicio: new Date().toISOString().split("T")[0], dias: "1", cid: "", medico: "", motivo: "", arquivo: null, parcial: false });'
);

fs.writeFileSync('app/dashboard/rh/page.js', txt);
