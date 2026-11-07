"use client";

// Quadradinho colorido com o ícone de uma tela ou área (visual inspirado no Nina,
// pedido do dono em 07/11/2026). A cor vem de app/lib/cores-modulo.mjs.

import {
  Bike, BookOpen, BrainCircuit, Carrot, CheckSquare, ChefHat, Citrus, ClipboardList, ConciergeBell,
  CookingPot, FileText, GlassWater, GraduationCap, Hourglass, Martini, MessageSquareText, NotebookPen,
  Package, PartyPopper, Salad, Search, ShoppingCart, Smartphone, Soup, Sparkles, SprayCan, Star,
  StickyNote, Store, Tag, Thermometer, Users, UtensilsCrossed, Wallet, WandSparkles, Wine,
} from "lucide-react";
import { corDoModulo, iconeClaroSobre } from "../../lib/cores-modulo.mjs";

// O pacote de ícones não tem coqueteleira, e ela diz "bar" melhor que uma chama.
export function Coqueteleira({ strokeWidth = 2, size, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2h8l1 5H7zM6 7h12l-2 15H8zM10 12h4" />
    </svg>
  );
}

export const ICONES_MODULO = {
  Bike, BookOpen, BrainCircuit, Carrot, CheckSquare, ChefHat, Citrus, ClipboardList, ConciergeBell,
  CookingPot, Coqueteleira, FileText, GlassWater, GraduationCap, Hourglass, Martini, MessageSquareText,
  NotebookPen, Package, PartyPopper, Salad, Search, ShoppingCart, Smartphone, Soup, Sparkles, SprayCan,
  Star, StickyNote, Store, Tag, Thermometer, Users, UtensilsCrossed, Wallet, WandSparkles, Wine,
};

// Classes escritas por extenso: o Tailwind só gera o que encontra no código.
const FUNDO = {
  amarelo: "bg-hf-tile-amarelo", dourado: "bg-hf-tile-dourado", laranja: "bg-hf-tile-laranja",
  vermelho: "bg-hf-tile-vermelho", rosa: "bg-hf-tile-rosa", violeta: "bg-hf-tile-violeta",
  indigo: "bg-hf-tile-indigo", azul: "bg-hf-tile-azul", ciano: "bg-hf-tile-ciano",
  verde: "bg-hf-tile-verde", grafite: "bg-hf-tile-grafite", ardosia: "bg-hf-tile-ardosia",
};

const TAMANHO = {
  sm: { caixa: "h-10 w-10 rounded-[11px]", icone: 20 },
  md: { caixa: "h-11 w-11 rounded-xl", icone: 22 },
  lg: { caixa: "h-14 w-14 rounded-[16px]", icone: 28 },
};

/** `item` é um card ou área do menu ({ icone, cor? }). */
export default function IconeModulo({ item, tamanho = "md", className = "" }) {
  const tom = corDoModulo(item);
  const Icone = ICONES_MODULO[item?.icone] || FileText;
  const t = TAMANHO[tamanho] || TAMANHO.md;
  const corIcone = iconeClaroSobre(tom) ? "text-hf-menu" : "text-white";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center ${t.caixa} ${FUNDO[tom]} ${corIcone} shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(16,24,40,0.12)] ${className}`}
    >
      <Icone size={t.icone} strokeWidth={1.9} />
    </span>
  );
}
