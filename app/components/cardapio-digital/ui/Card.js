import Link from "next/link";
import s from "./ui.module.css";

// Card do cardápio (9L): branco, borda #EEEEEE, sombra de duas camadas, canto
// 14 px. `elevado` = card sem borda e com sombra maior (carrossel do celular).
// Com `href` vira link (o card inteiro é tocável).
export default function Card({ href, as, elevado = false, className = "", children, ...resto }) {
  const Tag = as || (href ? (href.startsWith("/") ? Link : "a") : "div");
  const extra = href ? { href } : {};
  return (
    <Tag className={`${s.card} ${href ? s.pressiona : ""} ${elevado ? s.cardElevado : ""} ${className}`} {...extra} {...resto}>
      {children}
    </Tag>
  );
}
