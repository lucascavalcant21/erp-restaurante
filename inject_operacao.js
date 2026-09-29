const fs = require('fs');

let p = fs.readFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', 'utf-8');

// Modificar os imports
p = p.replace(
  'import { Calendar, Users, DollarSign, Clock, FileText, CheckCircle2, ChevronRight, Info, Plus, ChevronLeft, MapPin, Search, ChefHat, ShoppingCart, LayoutTemplate } from "lucide-react";',
  'import { Calendar, Users, DollarSign, Clock, FileText, CheckCircle2, ChevronRight, Info, Plus, ChevronLeft, MapPin, Search, ChefHat, ShoppingCart, LayoutTemplate, Wine } from "lucide-react";\nimport OperacaoTab from "./OperacaoTab";'
);

// Modificar a constante TABS
const oldTabs = /const TABS = \[[\s\S]*?\];/;
const newTabs = `const TABS = [
  { id: "resumo", label: "CRM & Resumo", icon: FileText },
  { id: "financeiro", label: "Caixa & DRE", icon: DollarSign },
  { id: "cozinha", label: "Cozinha", icon: ChefHat },
  { id: "bar", label: "Bar", icon: Wine },
  { id: "salao", label: "Salão", icon: Users },
  { id: "compras", label: "Logística/Compras", icon: ShoppingCart },
  { id: "proposta", label: "Proposta", icon: LayoutTemplate }
];`;

p = p.replace(oldTabs, newTabs);

// O código de page.js tem uma sequência gigante de {activeTab === "..." && ...}
// O mais seguro é pegar TUDO dentro do switch das abas.
// O render das abas começa com {activeTab === "resumo" && ( ...
// Vamos apagar as abas velhas: "equipe" e "cardapio" e colocar as novas.
// old: {activeTab === "equipe" && ( ... )}
// old: {activeTab === "cardapio" && ( ... )}
// new: {activeTab === "cozinha" && <OperacaoTab... /> }
// new: {activeTab === "bar" && <OperacaoTab... /> }
// new: {activeTab === "salao" && <OperacaoTab... /> }

// Isso é perigoso fazer com regex bruta pq as divs não fecham perfeitamente na regex.
// O que eu vou fazer é reescrever a renderização de fallbacks também.
// E a aba `Resumo`? Mantém.
// A aba `Financeiro`? Mantém.
// A aba `Compras`? Mantém.
// A aba `Proposta`? Mantém.

const equipeTabRegex = /\{activeTab === "equipe" && \([\s\S]*?<\/div>\s*\)\}/;
const cardapioTabRegex = /\{activeTab === "cardapio" && \([\s\S]*?\}\s*\)\}/;

p = p.replace(equipeTabRegex, `
        {activeTab === "cozinha" && <OperacaoTab evento={evento} unidadeAtiva={unidadeAtiva} departamento="cozinha" onUpdate={(n) => setEvento({...evento, ...n})} />}
        {activeTab === "bar" && <OperacaoTab evento={evento} unidadeAtiva={unidadeAtiva} departamento="bar" onUpdate={(n) => setEvento({...evento, ...n})} />}
        {activeTab === "salao" && <OperacaoTab evento={evento} unidadeAtiva={unidadeAtiva} departamento="salao" onUpdate={(n) => setEvento({...evento, ...n})} />}
`);

p = p.replace(cardapioTabRegex, ''); // Apaga o cardapio velho.

// Corrige o fallback para as novas abas.
p = p.replace(/activeTab !== "equipe" && activeTab !== "cardapio"/g, 'activeTab !== "cozinha" && activeTab !== "bar" && activeTab !== "salao"');

fs.writeFileSync('app/dashboard/reservas-eventos/eventos/[id]/page.js', p, 'utf-8');
console.log('Hub de Eventos atualizado com as novas abas');
