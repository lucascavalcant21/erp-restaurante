const fs = require('fs');
let t = fs.readFileSync('app/dashboard/layout.js', 'utf-8');
const newCat = `  {
    category: "Eventos & Reservas",
    home: "/dashboard/reservas-eventos",
    icon: Calendar,
    items: [
      { label: "Visão Geral", href: "/dashboard/reservas-eventos" },
      { label: "Agenda", href: "/dashboard/reservas-eventos/agenda" },
      { label: "Reservas (Á La Carte)", href: "/dashboard/reservas-eventos/reservas" },
      { label: "Eventos & Buffet", href: "/dashboard/reservas-eventos/eventos" },
      { label: "Novos Contatos", href: "/dashboard/reservas-eventos/contatos" }
    ]
  },
`;
t = t.replace('  {\n    category: "Compras & Recebimento",', newCat + '  {\n    category: "Compras & Recebimento",');
fs.writeFileSync('app/dashboard/layout.js', t, 'utf-8');
console.log('Injected Sidebar');
