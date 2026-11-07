// CORES DE MÓDULO — a cor do quadradinho do ícone de cada tela/área.
//
// Pedido do dono (07/11/2026): visual inspirado no Nina, com ícone colorido por
// função. A cor sai do ÍCONE, não da área: "Etiquetas" é azul na Cozinha e no
// Bar, "Estoque" é índigo em todo lugar. Assim o funcionário acha a tela pela
// cor, e um card novo no menu já nasce com a cor da função dele.
//
// Os tons são tokens hf-tile-* (app/globals.css). Este arquivo só devolve o
// NOME do tom; as classes do Tailwind ficam em app/components/ui/IconeModulo.js
// (o Tailwind não varre .mjs).

export const TONS = Object.freeze([
  "amarelo", "dourado", "laranja", "vermelho", "rosa", "violeta",
  "indigo", "azul", "ciano", "verde", "grafite", "ardosia",
]);

/** Tons claros: o ícone vai em grafite, não em branco (contraste). */
export const TONS_CLAROS = Object.freeze(["amarelo", "dourado"]);

const POR_ICONE = Object.freeze({
  // Receitas e preparo
  BookOpen: "amarelo", Martini: "amarelo", StickyNote: "amarelo", Star: "amarelo",
  CookingPot: "violeta", Coqueteleira: "violeta", WandSparkles: "violeta",
  Salad: "verde", Citrus: "verde", Sparkles: "verde",
  // Pedidos e atendimento
  ConciergeBell: "grafite", UtensilsCrossed: "laranja", Smartphone: "azul", MonitorPlay: "rosa",
  Bike: "vermelho", Users: "rosa", MessageSquareText: "azul",
  // Estoque e compras
  Package: "indigo", Carrot: "laranja", Wine: "laranja", ShoppingCart: "vermelho",
  // Rotina, controle e consulta
  Tag: "azul", Hourglass: "laranja", NotebookPen: "rosa", Search: "ardosia",
  CheckSquare: "verde", SprayCan: "ciano", Thermometer: "vermelho",
  GraduationCap: "azul", FileText: "ardosia",
  // Áreas do menu
  BrainCircuit: "violeta", ChefHat: "laranja", GlassWater: "azul", Store: "rosa",
  ClipboardList: "verde", PartyPopper: "rosa", Soup: "amarelo", Wallet: "verde",
});

/** Tom do ícone de um card ou área do menu: `cor` explícita vence o ícone. */
export function corDoModulo(item) {
  const cor = item?.cor;
  if (cor && TONS.includes(cor)) return cor;
  return POR_ICONE[item?.icone] || "ardosia";
}

/** O ícone tem cor escolhida (não cai no cinza padrão). */
export const iconeTemCor = (icone) => Object.prototype.hasOwnProperty.call(POR_ICONE, icone);

export const iconeClaroSobre = (tom) => TONS_CLAROS.includes(tom);
