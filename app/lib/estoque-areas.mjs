// ÁREAS E CATEGORIAS DO ESTOQUE (HDEV-EST-001).
//
// A tela mostra 4 áreas: Cozinha, Bar, Salão, Limpeza (+ "Outros" quando há
// local que não cabe em nenhuma). Cada área agrupa os LOCAIS que já existem
// em `estoques` (nada é criado aqui): "Pré-preparos da Cozinha" é subárea da
// Cozinha, "Embalagens do Bar" do Bar. O produto é um só no cadastro
// (insumos); o saldo é por local (estoque_itens), independente.

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const AREAS = [
  { id: "cozinha", rotulo: "Cozinha", categorias: ["Carnes", "Peixes", "Frango", "Hortifruti", "Secos", "Líquidos", "Salgados", "Utensílios", "Produção"] },
  { id: "bar", rotulo: "Bar", categorias: ["Cervejas", "Refrigerantes", "Águas", "Destilados", "Vinhos", "Xaropes", "Polpas", "Hortifruti", "Descartáveis", "Utensílios", "Produção"] },
  { id: "salao", rotulo: "Salão", categorias: ["Papéis", "Descartáveis", "Utensílios"] },
  { id: "limpeza", rotulo: "Limpeza", categorias: ["Detergentes", "Desinfetantes", "Sabões", "Esponjas", "Outros materiais"] },
];
const OUTROS = { id: "outros", rotulo: "Outros", categorias: [] };

/** Área de um local pelo nome (e tipo, de reserva). */
export function areaDoLocal(estoque) {
  const n = norm(estoque?.nome);
  // Produtos da lava-louças ficam na Limpeza, mesmo sendo "da Cozinha"/"do Bar".
  if (/maquina/.test(n) || /^maquina-/.test(norm(estoque?.slug))) return "limpeza";
  if (/\bbar\b/.test(n)) return "bar";
  if (/cozinha/.test(n)) return "cozinha";
  if (/salao/.test(n)) return "salao";
  if (/limpeza/.test(n) || norm(estoque?.tipo) === "limpeza") return "limpeza";
  if (norm(estoque?.tipo) === "bebidas") return "bar";
  return "outros";
}

/** Subárea do local dentro da área: principal, pré-preparo, embalagens, abertos ou expositor. */
export function subareaDoLocal(estoque) {
  const n = norm(estoque?.nome);
  if (/pre-?preparo/.test(n)) return "preparo";
  if (/embalage/.test(n)) return "embalagens";
  if (/expositor|gelad/.test(n)) return "expositor";
  if (/\babertos?\b/.test(n)) return "abertos";
  return "principal";
}

/* FECHADOS, ABERTOS E GELADAS (pedido do dono, 28/10/2026: "dividir meu
 * estoque em produtos abertos e fechados — todos os que tenho são fechados —
 * e no bar a bebida gelada, que está no expositor"). Cada estado é um local
 * de estoque: o local principal guarda os fechados; "Abertos da Cozinha/do
 * Bar" os abertos; "Expositor do Bar" as geladas. Passar de um para o outro
 * é transferência (sai e entra numa operação só). */
export const ESTADOS = [
  { id: "fechado", rotulo: "Fechados" },
  { id: "aberto", rotulo: "Abertos" },
  { id: "gelada", rotulo: "Geladas (expositor)" },
];
export function estadoDoLocal(estoque) {
  const sub = subareaDoLocal(estoque);
  if (sub === "abertos") return "aberto";
  if (sub === "expositor") return "gelada";
  if (sub === "principal" && ["cozinha", "bar"].includes(areaDoLocal(estoque))) return "fechado";
  return null;
}
export const LOCAIS_DE_ESTADO = [
  { slug: "abertos-cozinha", nome: "Abertos da Cozinha", tipo: "alimentos", area: "cozinha", estado: "aberto" },
  { slug: "abertos-bar", nome: "Abertos do Bar", tipo: "bebidas", area: "bar", estado: "aberto" },
  { slug: "expositor-bar", nome: "Expositor do Bar (gelada)", tipo: "bebidas", area: "bar", estado: "gelada" },
];
/** Locais de aberto/gelada que ainda não existem (só onde há o local principal da área). */
export function locaisDeEstadoQueFaltam(estoques = []) {
  const lista = estoques || [];
  return LOCAIS_DE_ESTADO.filter((d) => lista.some((e) => areaDoLocal(e) === d.area && subareaDoLocal(e) === "principal")
    && !lista.some((e) => areaDoLocal(e) === d.area && estadoDoLocal(e) === d.estado));
}
/** Para onde vai ao "Abrir" ou "Gelar" um produto de um local fechado. */
export function destinoDoEstado(estoques = [], origem, estado) {
  const area = areaDoLocal(origem);
  return (estoques || []).find((e) => e.id !== origem?.id && areaDoLocal(e) === area && estadoDoLocal(e) === estado) || null;
}

/** Áreas com seus locais (principal primeiro), só as que têm local. */
export function areasComLocais(estoques) {
  const ordemSub = { principal: 0, abertos: 1, expositor: 2, preparo: 3, embalagens: 4 };
  const grupos = [...AREAS, OUTROS].map((a) => ({ ...a, locais: [] }));
  for (const e of estoques || []) {
    const g = grupos.find((x) => x.id === areaDoLocal(e));
    g.locais.push(e);
  }
  for (const g of grupos) g.locais.sort((a, b) => ordemSub[subareaDoLocal(a)] - ordemSub[subareaDoLocal(b)] || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return grupos.filter((g) => g.locais.length || g.id !== "outros");
}

// Sinônimos das categorias do cadastro → categoria da área.
const SINONIMOS = {
  carnes: ["carne", "bovino", "suino", "porco", "linguica", "bacon"],
  peixes: ["peixe", "frutos do mar", "camarao", "salmao", "tilapia"],
  frango: ["frango", "aves", "galinha"],
  hortifruti: ["hortifruti", "hortifruti", "verdura", "legume", "fruta", "folha", "temper"],
  secos: ["seco", "graos", "grao", "farinha", "arroz", "feijao", "massa", "acucar", "mercearia"],
  liquidos: ["liquido", "oleo", "azeite", "leite", "molho", "vinagre"],
  salgados: ["salgado", "embutido", "queijo", "frios"],
  utensilios: ["utensilio", "patrimonio"],
  producao: ["producao", "preparo", "pre-preparo", "pre preparo"],
  cervejas: ["cerveja", "chopp", "chope"],
  refrigerantes: ["refrigerante", "refri", "soda"],
  aguas: ["agua"],
  destilados: ["destilado", "vodka", "gin", "whisky", "cachaca", "rum", "tequila", "licor"],
  vinhos: ["vinho", "espumante"],
  xaropes: ["xarope"],
  polpas: ["polpa"],
  descartaveis: ["descartavel", "copo", "canudo", "guardanapo", "embalagem"],
  papeis: ["papel", "toalha", "guardanapo", "bobina"],
  detergentes: ["detergente"],
  desinfetantes: ["desinfetante", "alcool", "agua sanitaria", "cloro"],
  saboes: ["sabao", "sabonete"],
  esponjas: ["esponja", "pano", "flanela"],
};

/** Categoria da área para um produto (pela categoria do cadastro, depois pelo nome); null = sem categoria. */
export function categoriaNaArea(insumo, areaId) {
  const area = AREAS.find((a) => a.id === areaId);
  if (!area) return null;
  const textos = [norm(insumo?.categoria), norm(insumo?.nome)];
  for (const t of textos) {
    if (!t) continue;
    for (const cat of area.categorias) {
      const chave = norm(cat).replace(/\s+/g, "");
      if (t === norm(cat)) return cat;
      const lista = SINONIMOS[chave] || [];
      if (lista.some((s) => t.includes(s))) return cat;
    }
  }
  return area.categorias.includes("Outros materiais") ? "Outros materiais" : null;
}

/* GRUPOS DO ESTOQUE (pedido do dono, 30/10/2026: "no estoque dividido por
 * hortifrúti, carne vermelha, suína… para cozinha e bar, conforme suas
 * categorias"). O cadastro não muda: o grupo sai da categoria que já existe
 * e, quando ela é larga ("Carne vermelha", "Outros"), do nome do produto. */
export const GRUPOS_ESTOQUE = {
  cozinha: [
    { id: "vermelha", rotulo: "Carne vermelha" },
    { id: "suina", rotulo: "Carne suína" },
    { id: "aves", rotulo: "Aves" },
    { id: "hortifruti", rotulo: "Hortifrúti" },
    { id: "secos", rotulo: "Produtos secos" },
    { id: "liquidos", rotulo: "Produtos líquidos" },
    { id: "petiscos", rotulo: "Petiscos" },
    { id: "peixes", rotulo: "Peixes" },
    { id: "outros", rotulo: "Outros" },
  ],
  bar: [
    { id: "hortifruti", rotulo: "Hortifrúti" },
    { id: "descartaveis", rotulo: "Descartáveis" },
    { id: "cervejas", rotulo: "Cervejas" },
    { id: "aguas", rotulo: "Águas" },
    { id: "refrigerantes", rotulo: "Refrigerantes" },
    { id: "destilados", rotulo: "Destilados" },
    { id: "vinhos", rotulo: "Vinhos" },
    { id: "xaropes", rotulo: "Xaropes" },
    { id: "limao", rotulo: "Super suco de limão" },
    { id: "polpas", rotulo: "Polpas" },
    { id: "outros", rotulo: "Outros" },
  ],
};

const tem = (t, re) => re.test(t);
const SUINA = /\b(porco|suin[oa]s?|bacon|lombo|pernil|panceta|torresmo|linguica|calabresa|costelinha suina|paio|presunto|toucinho)\b/;
const AVES = /\b(frango|galinha|peru|chester|pato|sobrecoxa)\b/;
const PEIXES = /\b(peixe|camarao|camaroes|tilapia|salmao|bacalhau|polvo|lula|sururu|caranguejo|siri|marisco|mexilhao|manjuba|lagosta|crab|pescada|filhote|tambaqui|pirarucu|dourada|atum)\b/;
const BOVINA = /\b(picanha|alcatra|maminha|fraldinha|contra ?file|mignon|patinho|acem|cupim|costela|carne|musculo|lagarto|coxao|hamburguer|charque|bovin[oa]|bife)\b/;
const HORTI = /\b(tomate|cebola|alho|batata|cenoura|alface|rucula|limao|laranja|banana|abacaxi|maracuja|manga|morango|cheiro verde|coentro|salsa|cebolinha|pimentao|pepino|abobora|macaxeira|mandioca|aipim|jambu|chicoria|repolho|couve|brocolis|milho verde|hortela|manjericao|gengibre|uva|melancia|mamao|acerola|cupuacu|graviola|tucuma|maniva|acai|legumes?|verduras?|frutas?)\b/;
const LATI = /\b(leite|queijo|manteiga|creme de leite|requeijao|iogurte|nata|mussarela|parmesao|catupiry|cheddar|cheedar|ovos?)\b/;
const MOLHOS = /\b(molho|tucupi|caldo|tempero|mostarda|colorau|ketchup|maionese|shoyu|vinagrete)\b/;
const DESTILADOS = /\b(cachaca|vodka|gin|whisky|whiskey|rum|tequila|licor|aperitivo|campari|aperol|conhaque|jager|jagermeister|absolut|smirnoff|ypioca|velho barreiro|domecq|chivas?|martini|vermute|curacau|cointreau|contreau|steinhaeger|absinto|destilados?)\b/;
const CERVEJAS = /\b(cervejas?|chopp?|chope|heineken|corona|stella|amstel|eisenbahn|cerpa|budweiser|brahma|skol|itaipava|original|long neck|coroa)\b/;
const REFRI = /\b(refrigerantes?|coca|guarana|fanta|sprite|soda|tonica|schweppes|energetico|red bull)\b/;

/** Grupo do produto no estoque (Cozinha ou Bar). O nome vence a categoria quando é claro. */
export function grupoDoEstoque(linha = {}) {
  const area = linha.area === "bar" ? "bar" : "cozinha";
  const cat = norm(linha.categoria);
  const nome = norm(linha.nome);
  if (area === "bar") {
    if (tem(nome, /\b(canudos?|copos?|guardanapos?|descartave(l|is)|tampas?|mexedor|palitos?)\b/) || tem(cat, /descartave/)) return "descartaveis";
    if (tem(nome, /\bsuco de limao\b|\bsuper suco\b/)) return "limao";
    if (tem(nome, /\b(xarope|monin|calda|syrup|grenadine|espumas?)\b/)) return "xaropes";
    if (tem(nome, /\b(polpa|poupa|suco)\b/)) return "polpas";
    if (tem(nome, DESTILADOS)) return "destilados";
    if (tem(nome, /\b(vinho|espumante|prosecco|champagne|sangria)\b/) || tem(cat, /vinho/)) return "vinhos";
    if (tem(nome, CERVEJAS)) return "cervejas";
    if (tem(nome, REFRI)) return "refrigerantes";
    if (tem(nome, /\bagua\b/)) return "aguas";
    if (tem(nome, HORTI) || tem(cat, /hortifruti|fruta|guarnic/) || tem(nome, /\b(alecrim|hibisco|ibisco|abacate|casca de laranja|desidratad[oa])\b/)) return "hortifruti";
    if (tem(cat, /xarope|espuma/)) return "xaropes";
    if (tem(cat, /polpa|suco|batida/)) return "polpas";
    if (tem(cat, /destilad|cachaca|vodka|licor|aperitiv/)) return "destilados";
    if (tem(cat, /cervej/)) return "cervejas";
    if (tem(cat, /refrigerante/)) return "refrigerantes";
    if (tem(cat, /agua/)) return "aguas";
    return "outros";
  }
  // Cozinha (laticínios e molhos líquidos vão para Produtos líquidos; queijo e ovo para Outros)
  if (tem(nome, SUINA) && !tem(nome, /\bpimenta\b/)) return "suina";
  if (tem(cat, /petisco|congelad|salgado/)) return "petiscos";
  if (tem(nome, PEIXES) && !tem(cat, /molho|caldo/)) return "peixes";
  if (tem(cat, /hortifruti|legume|verdura|fruta/)) return "hortifruti";
  if (tem(cat, /frutos do mar|peixe/)) return "peixes";
  if (tem(cat, /\baves?\b|frango/) || tem(nome, AVES)) return "aves";
  if (tem(cat, /carne|bovin/) || (tem(nome, BOVINA) && !tem(cat, /molho|caldo/))) return "vermelha";
  if (tem(cat, /liquido|oleo|molho|caldo/)) return "liquidos";
  if (tem(cat, /laticini/)) return tem(nome, /\b(queijo|mussarela|parmesao|cheddar|cheedar|pastel)\b/) ? "outros" : "liquidos";
  if (tem(cat, /seco|farinha|empanament|grao|mercearia/)) return "secos";
  if (tem(nome, HORTI)) return "hortifruti";
  if (tem(nome, MOLHOS) || tem(nome, /\b(oleo|azeite|vinagre|leite|creme de leite)\b/)) return "liquidos";
  if (tem(nome, /\b(arroz|feijao|farinha|acucar|sal|macarrao|trigo|fuba|aveia|tapioca|cafe|chocolate|castanha|amendoim|gelatina|amido|glutamato|ajinomoto|corante|pimenta|colorau|louro)\b/)) return "secos";
  return "outros";
}

export const rotuloDoGrupo = (area, id) => (GRUPOS_ESTOQUE[area === "bar" ? "bar" : "cozinha"].find((g) => g.id === id) || { rotulo: "Outros" }).rotulo;
