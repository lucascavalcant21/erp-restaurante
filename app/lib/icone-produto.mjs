// Ícone de cada produto do estoque, deduzido do nome.
//
// Por que não buscar imagem na internet: o tablet do estoque trabalha em rede
// ruim e às vezes sem rede nenhuma — imagem que não carrega vira quadrado
// cinza justo na hora da contagem. Some-se a isso licença de uso incerta e
// trezentos downloads por unidade. Ícone vetorial já embutido no app abre
// sempre, pesa nada e continua legível a um metro do tablet.
//
// A dedução é pelo NOME primeiro e pela categoria depois: o nome é o que a
// pessoa lê no cartão, e é ele que diz "Heineken" quando a categoria só diz
// "Bebidas".
//
// Devolve o NOME do ícone, não o componente: assim este módulo roda no node e
// pode ser testado sem React.

const semAcento = (v) => String(v ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("pt-BR");

// Ordem importa: a primeira regra que casar vence. As mais específicas vêm
// antes — "creme de leite" tem de bater em leite, não em creme/sobremesa.
const REGRAS = [
  // ── Bar ─────────────────────────────────────────────────────────────────
  [/cerveja|chopp|lager|pilsen|\bipa\b|weiss|heineken|brahma|skol|budweiser|corona|stella|antarctica|itaipava|eisenbahn|amstel|spaten|original/, "Beer"],
  [/vinho|tinto seco|espumante|prosecco|chandon|frisante|sangria/, "Wine"],
  [/gin|vodka|whisk|uisque|cachaca|pinga|rum|tequila|licor|aperol|campari|absolut|jack daniel|ballantine|jameson|conhaque|sake|saque|vermute|destilado|aperitivo/, "Martini"],
  [/refrigerante|coca.?cola|pepsi|guarana|sprite|fanta|soda|tonica|schweppes|energetic|red bull|monster/, "CupSoda"],
  [/xarope|infusao|redu(c|ss)ao|pre.?preparo|mix de|essencia/, "FlaskConical"],
  [/\bgelo\b/, "Snowflake"],
  [/\bagua\b|agua com gas|agua mineral/, "GlassWater"],
  [/suco|polpa|nectar/, "Citrus"],
  [/\bcafe\b|expresso|espresso/, "Coffee"],

  // ── Cozinha ─────────────────────────────────────────────────────────────
  [/leite|creme de leite|manteiga|iogurte|nata|queijo|mucarela|mussarela|parmesao|requeijao|catupiry|coalho/, "Milk"],
  [/bacon|presunto|linguica|calabresa|pernil|porco|suin[ao]|salame|mortadela/, "Ham"],
  [/frango|galinha|coxa|sobrecoxa|asa de|peito de ave/, "Drumstick"],
  [/peixe|filhote|tambaqui|salmao|camarao|pescada|tilapia|dourada|pirarucu|frutos do mar|lula|polvo/, "Fish"],
  [/carne|bovin|picanha|alcatra|patinho|contra.?file|costela|hamburg|maminha|fraldinha|acem|musculo|charque/, "Beef"],
  [/\bovo/, "Egg"],
  [/pao|brioche|baguete|focaccia|torrada|bisnaga|massa folhada/, "Croissant"],
  [/farinha|trigo|fuba|aveia|arroz|macarrao|\bmassa\b|polenta|tapioca|amido/, "Wheat"],
  [/feijao|grao de bico|lentilha|ervilha|soja/, "Bean"],
  [/cenoura|batata|mandioca|macaxeira|aipim|beterraba|inhame|abobora/, "Carrot"],
  [/alface|salada|rucula|couve|tomate|cebola|alho|pimentao|repolho|pepino|legume|verdura|cheiro verde|coentro|salsa/, "Salad"],
  [/limao|laranja|lima|tangerina|acerola|maracuja|abacaxi/, "Citrus"],
  [/banana|manga|mamao|melancia|melao|uva|morango|fruta/, "Banana"],
  [/molho|caldo|sopa|creme de/, "Soup"],
  [/sorvete|gelato|picole/, "IceCreamCone"],
  [/acucar|chocolate|doce|sobremesa|calda|mel\b|leite condensado/, "Candy"],
];

// Quando o nome não diz nada, a categoria e o departamento decidem.
const POR_CATEGORIA = [
  [/cerveja/, "Beer"],
  [/vinho/, "Wine"],
  [/destilado|whisk|gin|vodka/, "Martini"],
  [/refrigerante|bebida nao alcoolica/, "CupSoda"],
  [/xarope|pre.?preparo/, "FlaskConical"],
  [/agua/, "GlassWater"],
  [/suco/, "Citrus"],
  [/carne|proteina/, "Beef"],
  [/hortifruti|verdura|legume/, "Salad"],
  [/laticinio|frios/, "Milk"],
  [/mercearia|seco/, "Wheat"],
  [/limpeza|embalagem|descartavel/, "Package"],
];

const PADRAO_DEPARTAMENTO = { bar: "GlassWater", cozinha: "Utensils" };

export function iconeDoProduto(item, departamento = "") {
  const nome = semAcento(item?.nome);
  for (const [padrao, icone] of REGRAS) {
    if (padrao.test(nome)) return icone;
  }

  const categoria = semAcento(item?.categoria ?? item?.insumo?.categoria);
  for (const [padrao, icone] of POR_CATEGORIA) {
    if (padrao.test(categoria)) return icone;
  }

  return PADRAO_DEPARTAMENTO[semAcento(departamento)] || "Package";
}

// Todos os nomes que a função pode devolver. O componente importa exatamente
// estes — lista fora de sincronia com as regras dá ícone indefinido em tela,
// que o React renderiza como nada.
export const ICONES_USADOS = [
  ...new Set([
    ...REGRAS.map(([, i]) => i),
    ...POR_CATEGORIA.map(([, i]) => i),
    ...Object.values(PADRAO_DEPARTAMENTO),
    "Package",
  ]),
].sort();
