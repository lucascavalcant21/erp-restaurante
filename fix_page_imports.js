const fs = require('fs');
let c = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');
c = c.replace('} from "lucide-react";', ', Wine, LayoutTemplate } from "lucide-react";\nimport OperacaoTab from "./OperacaoTab";');
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', c, 'utf-8');
console.log('Imports fixed');
