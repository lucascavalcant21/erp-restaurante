// Catálogo de copos/taças do bar com DESENHO em SVG (traço preto, imprime
// nítido). Usado no Guia de Drinks: a seção "Copo" mostra o desenho + nome, e
// quando o drink não tem foto real a IA monta uma ilustração — o copo certo
// preenchido com a cor do líquido deduzida dos ingredientes.

const COPOS = [
  {
    id: "coupette", nome: "Taça Coupette", re: /(coupette|coupe|margarita)/i,
    contorno: ["M14 24 Q14 54 50 58 Q86 54 86 24", "M14 24 L86 24", "M50 58 L50 106", "M30 114 L70 114", "M50 106 L50 114"],
    liquido: "M19 30 Q21 48 50 52 Q79 48 81 30 Z",
  },
  {
    id: "martini", nome: "Taça Martini", re: /(martini|\bdry\b)/i,
    contorno: ["M12 22 L50 64 L88 22", "M12 22 L88 22", "M50 64 L50 106", "M30 114 L70 114", "M50 106 L50 114"],
    liquido: "M22 32 L50 58 L78 32 Z",
  },
  {
    id: "balloon", nome: "Taça Balloon", re: /(balloon|bal[aã]o)/i,
    contorno: ["M22 22 Q16 66 50 72 Q84 66 78 22", "M22 22 L78 22", "M50 72 L50 108", "M30 116 L70 116", "M50 108 L50 116"],
    liquido: "M26 34 Q24 60 50 66 Q76 60 74 34 Z",
  },
  {
    id: "vinho", nome: "Taça de Vinho", re: /(vinho|wine)/i,
    contorno: ["M28 18 Q26 58 50 64 Q74 58 72 18", "M28 18 L72 18", "M50 64 L50 108", "M32 116 L68 116", "M50 108 L50 116"],
    liquido: "M31 34 Q30 54 50 60 Q70 54 69 34 Z",
  },
  {
    id: "flute", nome: "Taça de Espumante", re: /(flute|espumante|champanhe|champagne)/i,
    contorno: ["M40 14 Q38 60 50 66 Q62 60 60 14", "M40 14 L60 14", "M50 66 L50 110", "M34 118 L66 118", "M50 110 L50 118"],
    liquido: "M42 26 Q41 56 50 62 Q59 56 58 26 Z",
  },
  {
    id: "caneca", nome: "Caneca de Cobre", re: /(caneca|mule|cobre|\bmug\b)/i,
    contorno: ["M28 34 L30 118 Q30 122 36 122 L64 122 Q70 122 70 118 L72 34", "M28 34 L72 34", "M72 52 Q92 54 90 76 Q88 96 71 96"],
    liquido: "M31 56 L33 117 Q33 119 37 119 L63 119 Q67 119 67 117 L69 56 Z",
  },
  {
    id: "longdrink", nome: "Copo Long Drink", re: /(long ?drink|highball|collins|t[ôo]nica)/i,
    contorno: ["M32 14 L36 118 Q37 124 44 124 L56 124 Q63 124 64 118 L68 14", "M32 14 L68 14"],
    liquido: "M35 46 L38.5 117 Q39 120 44 120 L56 120 Q61 120 61.5 117 L65 46 Z",
  },
  {
    id: "oldfashioned", nome: "Copo Old Fashioned", re: /(old ?fashioned|rocks|whisky|u[íi]sque)/i,
    contorno: ["M26 46 L30 116 Q31 122 38 122 L62 122 Q69 122 70 116 L74 46", "M26 46 L74 46"],
    liquido: "M29 70 L32.5 115 Q33 118 38 118 L62 118 Q67 118 67.5 115 L71 70 Z",
  },
  {
    id: "shot", nome: "Copo Shot (dose)", re: /(\bshot\b|\bdose\b|cavalinho)/i,
    contorno: ["M34 66 L38 118 Q38 122 44 122 L56 122 Q62 122 62 118 L66 66", "M34 66 L66 66"],
    liquido: "M37 80 L40.5 117 Q41 119 45 119 L55 119 Q59 119 59.5 117 L63 80 Z",
  },
  {
    id: "cerveja", nome: "Copo de Cerveja (tulipa)", re: /(cerveja|chopp|tulipa|caldereta|pint)/i,
    contorno: ["M30 16 L34 60 L30 118 Q30 122 36 122 L64 122 Q70 122 70 118 L66 60 L70 16", "M30 16 L70 16"],
    liquido: "M33 40 L36.7 60 L33 116 Q33 119 38 119 L62 119 Q67 119 67 116 L63.3 60 L67 40 Z",
  },
  {
    id: "generico", nome: "Copo de Vidro (americano)", re: /./,
    contorno: ["M30 24 L36 118 Q37 122 43 122 L57 122 Q63 122 64 118 L70 24", "M30 24 L70 24"],
    liquido: "M33.5 50 L39 116 Q39.5 119 44 119 L56 119 Q60.5 119 61 116 L66.5 50 Z",
  },
];

// Catálogo para o select do formulário (sem o genérico duplicado no fim).
export const CATALOGO_COPOS = COPOS.filter((c) => c.id !== "generico").concat([COPOS[COPOS.length - 1]]);

export function identificarCopo(texto) {
  const t = String(texto || "");
  return COPOS.find((c) => c.re.test(t)) || COPOS[COPOS.length - 1];
}

// Desenho do copo em SVG. Com `corLiquido`, sai preenchido (ilustração do
// drink); sem, sai só o traço (ícone da seção "Copo").
export function desenhoCopoSVG(texto, { altura = 48, corLiquido = null, traco = "#111" } = {}) {
  const copo = identificarCopo(texto);
  const largura = Math.round((altura * 100) / 140);
  const liquido = corLiquido && copo.liquido
    ? `<path d="${copo.liquido}" fill="${corLiquido}" opacity="0.92"/>`
    : "";
  const linhas = copo.contorno.map((d) => `<path d="${d}" fill="none" stroke="${traco}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="0 0 100 140" width="${largura}" height="${altura}" xmlns="http://www.w3.org/2000/svg" style="display:block">${liquido}${linhas}</svg>`;
}

// ── Fotos REAIS dos copos (tiradas pelo usuário) ────────────────────────────
// Carregadas da unidade ao abrir a tela; quando existem, substituem o desenho.
let FOTOS_COPOS = {};
export function definirFotosCopos(mapa) {
  FOTOS_COPOS = mapa && typeof mapa === "object" ? mapa : {};
}
export function fotoCopoReal(texto) {
  return FOTOS_COPOS[identificarCopo(texto).id] || null;
}

// Imagem do copo para os cards impressos: a FOTO real se o usuário tirou uma;
// senão, o desenho em SVG.
export function imagemCopoHTML(texto, { altura = 58 } = {}) {
  const url = fotoCopoReal(texto);
  if (url) {
    const seguro = String(url).replace(/"/g, "&quot;");
    const larg = Math.round(altura * 0.78);
    return `<img src="${seguro}" alt="" style="height:${altura}px;width:${larg}px;object-fit:cover;border-radius:6px;border:1.5px solid #111;display:block;background:#f4f4f5"/>`;
  }
  return desenhoCopoSVG(texto, { altura });
}

// Cor do líquido deduzida dos ingredientes/nome do drink.
const CORES_DRINK = [
  [/campari|negroni|morango|cranberry|hibisco|frutas vermelhas|bloody/i, "#dc2626"],
  [/aperol|spritz|laranja|tangerina|p[êe]ssego|mimosa/i, "#f97316"],
  [/lim[ãa]o|\blima\b|hortel[ãa]|mojito|caipirinha|kiwi|matcha|abacate/i, "#84cc16"],
  [/caf[ée]|espresso|coca|cola|chocolate|licor 43\b|amarula escura?/i, "#3b2314"],
  [/abacaxi|maracuj[áa]|manga|gengibre|caju|mel\b/i, "#f5b60a"],
  [/uva|a[çc]a[íi]|jabuticaba|blueberry|ameixa/i, "#7c3aed"],
  [/cura[çc]au|azul|blue/i, "#2563eb"],
  [/leite|coco|colada|baileys|creme|iogurte/i, "#f2e8d5"],
  [/vinho tinto|tinto|sangria/i, "#7f1d1d"],
  [/cerveja|chopp/i, "#f0b429"],
  [/espumante|prosecco|champa|vodka|\bgin\b|tequila|cacha[çc]a|\brum\b|soda|t[ôo]nica|[áa]gua/i, "#f5e7ac"],
];
export function corDoDrink(texto) {
  const t = String(texto || "");
  for (const [re, cor] of CORES_DRINK) if (re.test(t)) return cor;
  return "#e8a33d";
}

// Ilustração automática do drink (quando não há foto real): o copo certo com a
// cor do líquido dos ingredientes.
export function ilustracaoDrinkSVG(copoTexto, ingredientesTexto, altura = 96) {
  return desenhoCopoSVG(copoTexto, { altura, corLiquido: corDoDrink(ingredientesTexto) });
}
