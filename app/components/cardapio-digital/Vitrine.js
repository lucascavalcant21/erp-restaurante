"use client";
// Vitrine do delivery: capa viva (quando o dono não pôs banner), trilho de
// seções que acompanha a rolagem, ícone de cada seção/prato sem foto e o
// "voo" do prato até a sacola. Todo movimento respeita quem pediu menos
// movimento no aparelho (prefers-reduced-motion).

import { useCallback, useEffect, useRef } from "react";
import {
  Beef, Beer, Coffee, CookingPot, CupSoda, Drumstick, Fish, IceCreamCone, ListPlus, Martini, Pizza, Salad, Sandwich,
  Soup, UtensilsCrossed, Wine,
} from "lucide-react";
import s from "./cardapio.module.css";

const ICONES = {
  prato: UtensilsCrossed, adicional: ListPlus, cafe: Coffee, cerveja: Beer, vinho: Wine, suco: CupSoda, drink: Martini,
  sobremesa: IceCreamCone, pizza: Pizza, lanche: Sandwich, sopa: Soup, peixe: Fish, carne: Beef, salada: Salad,
  marmita: CookingPot, entrada: Drumstick,
};

export function IconeTema({ tema, size = 22, ...resto }) {
  const Icone = ICONES[tema] || UtensilsCrossed;
  return <Icone size={size} aria-hidden="true" {...resto} />;
}

export const semMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Capa sem banner: cores da casa em movimento lento, com os ícones do cardápio flutuando. */
export function CapaViva({ temas = [] }) {
  const lista = [...new Set(temas)].slice(0, 5);
  return (
    <div className={s.capaViva} aria-hidden="true">
      <span className={s.aurora} />
      <span className={`${s.aurora} ${s.aurora2}`} />
      {lista.map((t, i) => (
        <span key={t} className={s.flutua} style={{ "--i": i, "--n": lista.length }}><IconeTema tema={t} size={28} /></span>
      ))}
    </div>
  );
}

/**
 * Trilho de seções (celular e tablet em pé): fixo abaixo da barra, a pílula
 * desliza até a seção da tela e o trilho rola sozinho para mostrá-la.
 */
export function TrilhoSecoes({ secoes, ativa, onIr, rotulo }) {
  const trilho = useRef(null);
  const pilula = useRef(null);
  useEffect(() => {
    const el = trilho.current;
    const botao = el?.querySelector(`[data-id="${CSS.escape(ativa || "")}"]`);
    if (!el || !pilula.current) return;
    if (!botao) { pilula.current.style.opacity = "0"; return; }
    pilula.current.style.opacity = "1";
    pilula.current.style.width = `${botao.offsetWidth}px`;
    pilula.current.style.transform = `translateX(${botao.offsetLeft}px)`;
    const alvo = botao.offsetLeft - (el.clientWidth - botao.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, alvo), behavior: semMovimento() ? "auto" : "smooth" });
  }, [ativa, secoes]);
  if (secoes.length < 2) return null;
  return (
    <nav className={s.trilhoSecoes} aria-label={rotulo}>
      <div className={s.trilhoRolo} ref={trilho}>
        <span className={s.trilhoPilula} ref={pilula} aria-hidden="true" />
        {secoes.map((x) => (
          <button key={x.id} type="button" data-id={x.id} className={s.trilhoBotao} aria-current={ativa === x.id ? "true" : undefined} onClick={() => onIr(x.id)}>
            {x.tema ? <IconeTema tema={x.tema} size={16} /> : null}{x.nome}
          </button>
        ))}
      </div>
    </nav>
  );
}

/**
 * Voo do prato até a sacola: uma bolinha sai do dedo e cai na sacola que
 * estiver à vista ([data-sacola]), que dá um pulinho. Sem alvo à vista ou com
 * menos movimento pedido, não faz nada (o aviso "no pedido" já confirma).
 */
export function useVooParaSacola() {
  const toque = useRef(null);
  useEffect(() => {
    const anotar = (e) => { toque.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
    document.addEventListener("pointerdown", anotar, { passive: true });
    return () => document.removeEventListener("pointerdown", anotar);
  }, []);
  return useCallback(() => {
    const o = toque.current;
    if (!o || Date.now() - o.t > 1500 || semMovimento() || typeof document.body.animate !== "function") return;
    const alvo = [...document.querySelectorAll("[data-sacola]")].find((el) => el.offsetParent !== null || el.getClientRects().length);
    if (!alvo) return;
    const r = alvo.getBoundingClientRect();
    const dx = r.left + r.width / 2 - o.x;
    const dy = r.top + r.height / 2 - o.y;
    const bola = document.createElement("span");
    bola.className = s.voo;
    bola.style.left = `${o.x - 9}px`;
    bola.style.top = `${o.y - 9}px`;
    // Dentro do cardápio, para herdar a cor da casa (--c-primaria).
    (alvo.closest("[data-cardapio]") || document.body).appendChild(bola);
    const anim = bola.animate([
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.45)`, opacity: 0.6 },
    ], { duration: 620, easing: "cubic-bezier(.45,.05,.55,.95)" });
    anim.onfinish = () => {
      bola.remove();
      alvo.animate([{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(0.96)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
    };
  }, []);
}
