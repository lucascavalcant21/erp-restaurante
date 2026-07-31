const fs = require('fs');

// 1. REMOVE DUPLICATE "Pré-preparos" IN fichas/page.js
const fichasFile = 'app/dashboard/operacao/fichas/page.js';
let fichasContent = fs.readFileSync(fichasFile, 'utf8');

fichasContent = fichasContent.replace(
  `const CATEGORIAS_CARDAPIO = [\n  "Prato principal 1 pessoa",\n  "Prato principal 2 pessoas",\n  "Entradas",\n  "Sobremesas",\n  "Acompanhamentos",\n  "Pré-preparos",\n];`,
  `const CATEGORIAS_CARDAPIO = [\n  "Prato principal 1 pessoa",\n  "Prato principal 2 pessoas",\n  "Entradas",\n  "Sobremesas",\n  "Acompanhamentos",\n];`
);

fichasContent = fichasContent.replace(
  `const CATEGORIAS_BAR = [\n  "Cervejas",\n  "Drinks",\n  "Vinhos",\n  "Doses",\n  "Chopp",\n  "Águas",\n  "Refrigerantes",\n  "Bombons",\n  "Pré-preparos",\n];`,
  `const CATEGORIAS_BAR = [\n  "Cervejas",\n  "Drinks",\n  "Vinhos",\n  "Doses",\n  "Chopp",\n  "Águas",\n  "Refrigerantes",\n  "Bombons",\n];`
);

fs.writeFileSync(fichasFile, fichasContent);
console.log("Successfully removed duplicate Pré-preparos from Fichas categories!");

// 2. REMOVE DUPLICATE "Pré-preparos" IN estoque/page.js
const estoqueFile = 'app/dashboard/operacao/estoque/page.js';
let estoqueContent = fs.readFileSync(estoqueFile, 'utf8');

estoqueContent = estoqueContent.replace(
  `const CATEGORIAS_ESTOQUE_COZINHA = [\n  "Prato principal 1 pessoa",\n  "Prato principal 2 pessoas",\n  "Entradas",\n  "Sobremesas",\n  "Acompanhamentos",\n  "Pré-preparos",\n];`,
  `const CATEGORIAS_ESTOQUE_COZINHA = [\n  "Prato principal 1 pessoa",\n  "Prato principal 2 pessoas",\n  "Entradas",\n  "Sobremesas",\n  "Acompanhamentos",\n  "Pré-preparos",\n];`
);

estoqueContent = estoqueContent.replace(
  `const CATEGORIAS_ESTOQUE_BAR = [\n  "Cervejas",\n  "Drinks",\n  "Vinhos",\n  "Doses",\n  "Chopp",\n  "Águas",\n  "Refrigerantes",\n  "Bombons",\n  "Pré-preparos",\n];`,
  `const CATEGORIAS_ESTOQUE_BAR = [\n  "Cervejas",\n  "Drinks",\n  "Vinhos",\n  "Doses",\n  "Chopp",\n  "Águas",\n  "Refrigerantes",\n  "Bombons",\n  "Pré-preparos",\n];`
);

fs.writeFileSync(estoqueFile, estoqueContent);
console.log("Successfully verified Estoque categories!");

// 3. OPTIMIZE REALTIME & PERFORMANCE IN app/lib/realtime.js
const realtimeFile = 'app/lib/realtime.js';
let realtimeContent = fs.readFileSync(realtimeFile, 'utf8');

const oldRealtimeHook = `    const aoVoltar = () => { if (document.visibilityState === "visible") disparar(null); };
    const intervalo = setInterval(() => { if (document.visibilityState === "visible") disparar(null); }, 15000);
    window.addEventListener("hefisto:mudou", h);
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(timer.current);
      clearInterval(intervalo);
      window.removeEventListener("hefisto:mudou", h);
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };`;

const newRealtimeHook = `    window.addEventListener("hefisto:mudou", h);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("hefisto:mudou", h);
    };`;

realtimeContent = realtimeContent.replace(/\r\n/g, '\n');
const oldRealtimeHookNorm = oldRealtimeHook.replace(/\r\n/g, '\n');
if (realtimeContent.includes(oldRealtimeHookNorm)) {
  realtimeContent = realtimeContent.replace(oldRealtimeHookNorm, newRealtimeHook);
  fs.writeFileSync(realtimeFile, realtimeContent);
  console.log("Successfully optimized Realtime hook performance (removed laggy polling)!");
}
