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

/** Subárea do local dentro da área: principal, pré-preparo ou embalagens. */
export function subareaDoLocal(estoque) {
  const n = norm(estoque?.nome);
  if (/pre-?preparo/.test(n)) return "preparo";
  if (/embalage/.test(n)) return "embalagens";
  return "principal";
}

/** Áreas com seus locais (principal primeiro), só as que têm local. */
export function areasComLocais(estoques) {
  const ordemSub = { principal: 0, preparo: 1, embalagens: 2 };
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
