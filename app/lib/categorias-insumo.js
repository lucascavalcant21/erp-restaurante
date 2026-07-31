// Categorias de insumo por setor + "adivinhador" por palavra-chave + categorias personalizadas.
// Conforme o usuário digita o nome, sugere a categoria; ele pode trocar ou criar novas.

export const CATEGORIAS_INSUMO = {
  cozinha: ["Aves", "Caranguejo", "Carne vermelha", "Frutos do mar", "Hortifrúti", "Laticínios", "Líquidos", "Peixe", "Pré-preparos", "Secos"],
  bar: ["Água", "Bombons", "Cervejas", "Chopp", "Destilados", "Pré-preparos", "Refrigerantes", "Vinhos"],
};

export function obterCategoriasCustom(departamento = "cozinha") {
  if (typeof window === "undefined") return [];
  try {
    const salvas = localStorage.getItem(`custom_categorias_${departamento}`);
    return salvas ? JSON.parse(salvas) : [];
  } catch {
    return [];
  }
}

export function salvarNovaCategoriaCustom(novaCategoria, departamento = "cozinha") {
  const cat = String(novaCategoria || "").trim();
  if (!cat) return;
  const atuais = obterCategoriasCustom(departamento);
  if (!atuais.includes(cat)) {
    const atualizadas = [...atuais, cat];
    try {
      localStorage.setItem(`custom_categorias_${departamento}`, JSON.stringify(atualizadas));
    } catch {}
  }
}

export function obterTodasCategoriasInsumo(departamento = "cozinha") {
  const padrao = CATEGORIAS_INSUMO[departamento] || CATEGORIAS_INSUMO.cozinha;
  const custom = obterCategoriasCustom(departamento);
  return [...new Set([...padrao, ...custom])].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Palavras-chave por categoria (minúsculas, sem acento tratado no matcher)
const KEYWORDS = {
  // cozinha
  "Carne vermelha": ["carne", "boi", "bovina", "picanha", "alcatra", "coxao", "acem", "costela", "porco", "suino", "linguica", "bacon", "cupim", "maminha", "fraldinha", "patinho", "moida", "hamburguer", "blend", "cordeiro"],
  "Peixe": ["peixe", "pirarucu", "tambaqui", "tilapia", "salmao", "bacalhau", "sardinha", "atum", "filhote", "dourada", "pescada", "robalo"],
  "Aves": ["frango", "galinha", "peru", "pato", "chester", "ave", "coxa", "sobrecoxa", "asa", "file de frango", "peito de frango"],
  "Frutos do mar": ["camarao", "lula", "polvo", "ostra", "marisco", "mexilhao"],
  "Caranguejo": ["caranguejo", "siri", "patola", "massa de caranguejo"],
  "Laticínios": ["queijo", "leite", "manteiga", "requeijao", "creme de leite", "iogurte", "muçarela", "mucarela", "cheddar", "catupiry", "coalho", "nata", "ricota", "parmesao"],
  "Hortifrúti": ["tomate", "cebola", "alho", "batata", "cenoura", "pimentao", "alface", "couve", "cheiro-verde", "cheiro verde", "coentro", "salsa", "chicoria", "abobora", "mandioca", "banana", "limao", "manga", "abacaxi", "maracuja", "repolho", "pepino", "beterraba", "quiabo", "jambu", "verdura", "legume"],
  "Secos": ["arroz", "feijao", "farinha", "acucar", "sal", "macarrao", "massa", "tapioca", "fuba", "amido", "fermento", "biscoito", "pao", "graos", "lentilha", "grao de bico", "aveia", "cafe", "cha", "pimenta", "colorau", "cominho", "curry", "acafrao", "louro", "oregano", "canela", "cravo", "noz-moscada", "tempero", "cumaru", "gengibre", "paprica"],
  "Líquidos": ["oleo", "azeite", "vinagre", "molho", "shoyu", "agua", "caldo", "leite de coco", "leite condensado"],
  "Pré-preparos": ["molho pronto", "base de caldo", "mix de temperos", "massa caseira", "xarope", "mix", "espuma"],
  // bar
  "Água": ["agua", "água", "tonica", "tônica", "schweppes", "perrier", "san pellegrino"],
  "Bombons": ["bombom", "trufa", "chocolate", "ferrero", "raffaello", "lacta", "nestle", "garoto"],
  "Cervejas": ["cerveja", "pilsen", "lager", "ipa", "heineken", "brahma", "skol", "budweiser", "corona", "long neck"],
  "Chopp": ["chopp", "chope", "barril"],
  "Destilados": ["destilado", "whisky", "uisque", "vodka", "smirnoff", "absolut", "ciroc", "cachaca", "cachaça", "pinga", "51", "licor", "amarula", "baileys", "rum", "bacardi", "conhaque", "brandy", "gin", "tequila", "aperol", "campari", "vermute"],
  "Refrigerantes": ["refrigerante", "coca", "guarana", "guaraná", "fanta", "sprite", "pepsi", "sukita"],
  "Vinhos": ["vinho", "espumante", "prosecco", "champagne", "frisante", "tinto", "rose", "rosé"],
};

function normalizar(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Adivinha a categoria pelo nome (e marca). Retorna null se nada casar.
export function adivinharCategoria(nome, departamento = "cozinha", marca = "") {
  const alvo = normalizar(`${nome} ${marca}`);
  if (!alvo.trim()) return null;
  const validas = obterTodasCategoriasInsumo(departamento);
  let melhor = null, melhorScore = 0;
  for (const cat of validas) {
    const kws = KEYWORDS[cat] || [];
    for (const kw of kws) {
      if (alvo.includes(kw)) {
        const score = kw.length;
        if (score > melhorScore) { melhorScore = score; melhor = cat; }
      }
    }
  }
  return melhor;
}

// Converte categorias antigas do Bar para a nova organização de Produtos.
export function categoriaDoProdutoBar(item = {}) {
  const atual = String(item.categoria || "").trim();
  const disponiveis = obterTodasCategoriasInsumo("bar");
  if (disponiveis.includes(atual)) return atual;

  const inferida = adivinharCategoria(item.nome, "bar", item.marca);
  if (inferida) return inferida;

  if (atual === "Sucos") return "Suco industrializado";
  if (["Águas", "Guarnições", "Geleias", "Frutas", "Hortaliças", "Destilados", "Outros"].includes(atual)) {
    return "Ingredientes";
  }
  return "Ingredientes";
}
