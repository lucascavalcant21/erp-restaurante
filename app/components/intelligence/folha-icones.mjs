// Ícones da folha do prato/drink ("Drinks Visuais"): só enfeite visual escolhido
// pelo NOME já cadastrado — nunca muda quantidade nem acrescenta ingrediente.
// Sem palavra conhecida, um marcador neutro.

const semAcento = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ordem importa: o mais específico primeiro ("água com gás" antes de "água", "suco de limão" antes de "suco")
const INGREDIENTES = [
  [/gelo/, "🧊"],
  [/hortel|manjeric|alecrim|jambu|coentro|cheiro verde|salsa|cebolinha|folha/, "🌿"],
  [/limao|lima\b/, "🍋"],
  [/laranja|tangerina/, "🍊"],
  [/morango|frutas vermelhas/, "🍓"],
  [/maca\b|maca verde/, "🍏"],
  [/abacaxi/, "🍍"],
  [/maracuja|caja|cupuacu|acai|manga|goiaba|fruta/, "🥭"],
  [/coco/, "🥥"],
  [/banana/, "🍌"],
  [/pessego/, "🍑"],
  [/acucar|xarope|mel\b|melado|calda|rapadura/, "🍯"],
  [/agua com gas|agua c gas|com gas|soda|tonica|sprite|refrigerante|guarana|ginger/, "🫧"],
  [/cerveja|chopp|chope/, "🍺"],
  [/vinho|espumante|prosecco|aperol|vermute|martini|campari/, "🍷"],
  [/cachaca|velho barreiro|vodka|gin\b|rum\b|tequila|whisky|uisque|licor|cointreau|contreau|dose|pinga|conhaque|bitter|angostura/, "🥃"],
  [/leite|creme de leite|nata/, "🥛"],
  [/queijo|parmesao|mussarela|requeijao/, "🧀"],
  [/ovo/, "🥚"],
  [/camarao|lagosta/, "🦐"],
  [/peixe|pirarucu|arraia|file de|tilapia|filhote|dourada|tambaqui|salmao|bacalhau|atum/, "🐟"],
  [/caranguejo|siri|carangue/, "🦀"],
  [/frango|galinha|pato/, "🍗"],
  [/carne|picanha|maminha|alcatra|costela|charque|bacon|linguica|calabresa|porco|pernil|file mignon/, "🥩"],
  [/arroz/, "🍚"],
  [/feijao|grao|lentilha/, "🫘"],
  [/farinha|trigo|fuba|tapioca|goma|polvilho|pao/, "🌾"],
  [/mandioca|macaxeira|aipim|batata/, "🥔"],
  [/tomate/, "🍅"],
  [/cebola/, "🧅"],
  [/alho/, "🧄"],
  [/pimenta|pimentao|tucupi/, "🌶️"],
  [/azeite|oleo|dende|manteiga/, "🫒"],
  [/sal\b|sal fino|sal grosso|tempero/, "🧂"],
  [/cafe/, "☕"],
  [/chocolate|cacau/, "🍫"],
  [/agua/, "💧"],
  [/suco/, "🧃"],
];

export function iconeDoIngrediente(nome) {
  const n = semAcento(nome);
  for (const [re, icone] of INGREDIENTES) if (re.test(n)) return icone;
  return "•";
}

const SERVICO = {
  copo: (v) => (/taca|martini|coupe|cocktail/.test(semAcento(v)) ? "🍸" : /long|highball|collins|tulipa/.test(semAcento(v)) ? "🥤" : "🥃"),
  gelo: () => "🧊",
  metodo: (v) => (/bati|coquet|shake/.test(semAcento(v)) ? "🍸" : /macer/.test(semAcento(v)) ? "🍋" : "🥄"),
  guarnicao: () => "🌿",
  rende: () => "🍽️",
  porcao: () => "⚖️",
  tempo: () => "⏱️",
  servir: () => "🌡️",
  validade: () => "📅",
};

export function iconeDoServico(id, valor) {
  const f = SERVICO[id];
  return f ? f(valor || "") : "•";
}
