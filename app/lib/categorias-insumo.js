// Categorias de insumo por setor + "adivinhador" por palavra-chave.
// Conforme o usuário digita o nome, sugere a categoria; ele pode trocar.

export const CATEGORIAS_INSUMO = {
  cozinha: ["Peixes", "Aves", "Carne vermelha", "Hortifrúti", "Congelados", "Laticínios", "Secos", "Líquidos", "Temperos", "Outros"],
  bar: ["Cervejas", "Refrigerantes", "Vinhos", "Ingredientes", "Whisky", "Vodka", "Cachaça", "Licor", "Suco industrializado", "Rum", "Conhaque"],
};

// Palavras-chave por categoria (minúsculas, sem acento tratado no matcher)
const KEYWORDS = {
  // cozinha
  "Peixes": ["peixe", "pirarucu", "tambaqui", "tilapia", "salmao", "bacalhau", "sardinha", "atum", "camarao", "lula", "polvo", "filhote", "dourada", "pescada", "mariscos", "siri", "caranguejo"],
  "Aves": ["frango", "galinha", "peru", "pato", "chester", "ave", "coxa", "sobrecoxa", "asa", "file de frango", "peito de frango"],
  "Carne vermelha": ["carne", "boi", "bovina", "picanha", "alcatra", "coxao", "acem", "costela", "porco", "suino", "linguica", "bacon", "cupim", "maminha", "fraldinha", "patinho", "moida", "hamburguer", "blend", "cordeiro"],
  "Hortifrúti": ["tomate", "cebola", "alho", "batata", "cenoura", "pimentao", "alface", "couve", "cheiro-verde", "cheiro verde", "coentro", "salsa", "chicoria", "abobora", "mandioca", "banana", "limao", "manga", "abacaxi", "maracuja", "repolho", "pepino", "beterraba", "quiabo", "jambu", "verdura", "legume"],
  "Congelados": ["congelado", "empanado", "nuggets", "polpa", "acai", "gelo", "sorvete", "batata palito"],
  "Laticínios": ["queijo", "leite", "manteiga", "requeijao", "creme de leite", "iogurte", "muçarela", "mucarela", "cheddar", "catupiry", "coalho", "nata", "ricota", "parmesao"],
  "Secos": ["arroz", "feijao", "farinha", "acucar", "sal", "macarrao", "massa", "tapioca", "fuba", "amido", "fermento", "biscoito", "pao", "graos", "lentilha", "grao de bico", "aveia", "cafe", "cha"],
  "Líquidos": ["oleo", "azeite", "vinagre", "molho", "shoyu", "agua", "caldo", "leite de coco", "leite condensado"],
  "Temperos": ["pimenta", "colorau", "cominho", "curry", "acafrao", "louro", "oregano", "canela", "cravo", "noz-moscada", "tempero", "cumaru", "gengibre", "paprica"],
  // bar
  "Refrigerantes": ["refrigerante", "coca", "guarana", "fanta", "sprite", "pepsi", "tonica", "soda", "schweppes", "antarctica"],
  "Cervejas": ["cerveja", "chopp", "chope", "ipa", "pilsen", "lager", "heineken", "brahma", "skol", "budweiser", "corona", "long neck", "barril"],
  "Vinhos": ["vinho", "espumante", "prosecco", "champagne", "frisante", "tinto", "branco seco", "rose"],
  "Whisky": ["whisky", "uisque", "bourbon", "scotch", "jack daniels", "johnnie walker", "chivas", "ballantines"],
  "Vodka": ["vodka", "smirnoff", "absolut", "ciroc"],
  "Cachaça": ["cachaca", "aguardente", "pinga", "caninha", "51"],
  "Licor": ["licor", "amarula", "baileys", "cointreau"],
  "Suco industrializado": ["suco", "nectar", "polpa", "concentrado", "del valle", "maguary"],
  "Rum": ["rum", "bacardi", "havana club", "malibu"],
  "Conhaque": ["conhaque", "brandy", "dreher", "domus"],
  "Ingredientes": ["agua", "gelo", "gin", "tequila", "aperol", "campari", "vermute", "sake", "steinhaeger", "guarnicao", "azeitona", "cereja", "xarope", "grenadine", "mel", "morango", "limao", "laranja", "abacaxi", "maracuja", "kiwi", "hortela", "menta", "framboesa", "amora", "fruta", "coco", "gengibre", "pepino", "manjericao", "alecrim", "capim santo", "pimenta"],
};

function normalizar(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Adivinha a categoria pelo nome (e marca). Retorna null se nada casar.
export function adivinharCategoria(nome, departamento = "cozinha", marca = "") {
  const alvo = normalizar(`${nome} ${marca}`);
  if (!alvo.trim()) return null;
  const validas = CATEGORIAS_INSUMO[departamento] || CATEGORIAS_INSUMO.cozinha;
  let melhor = null, melhorScore = 0;
  for (const cat of validas) {
    const kws = KEYWORDS[cat] || [];
    for (const kw of kws) {
      // match por palavra inteira ou substring, priorizando palavras maiores
      if (alvo.includes(kw)) {
        const score = kw.length;
        if (score > melhorScore) { melhorScore = score; melhor = cat; }
      }
    }
  }
  return melhor;
}

// Converte categorias antigas do Bar para a nova organização de Produtos.
// O valor é usado na listagem e passa a ser persistido quando o item for editado.
export function categoriaDoProdutoBar(item = {}) {
  const atual = String(item.categoria || "").trim();
  if (CATEGORIAS_INSUMO.bar.includes(atual)) return atual;

  const inferida = adivinharCategoria(item.nome, "bar", item.marca);
  if (inferida) return inferida;

  if (atual === "Sucos") return "Suco industrializado";
  if (["Águas", "Guarnições", "Geleias", "Frutas", "Hortaliças", "Destilados", "Outros"].includes(atual)) {
    return "Ingredientes";
  }
  return "Ingredientes";
}
