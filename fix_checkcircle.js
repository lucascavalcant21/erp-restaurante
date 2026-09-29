const fs = require('fs');
let c = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');
c = c.replace(', Wine, LayoutTemplate } from "lucide-react";', ', Wine, LayoutTemplate, CheckCircle2 } from "lucide-react";');
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', c, 'utf-8');
console.log('Fixed CheckCircle2 import');
