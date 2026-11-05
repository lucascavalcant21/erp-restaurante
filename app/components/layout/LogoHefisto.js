// Logo do Héfisto: o H com a perna mais longa, fazendo a curva. Lembra Hefesto, o
// ferreiro que mancava. As cores vêm direto das variáveis do tema: a classe
// text-hf-accent troca o dourado pelo tom escuro usado em texto.
//
// `animada`: a perna chuta, feliz, enquanto o app carrega. O joelho é um círculo
// fixo para a perna não soltar do corpo ao girar. O movimento fica em globals.css.

const OURO = "rgb(var(--hf-accent))";
const TINTA = "rgb(var(--hf-accent-fg))";

export default function LogoHefisto({ className = "w-8 h-8", animada = false }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} ${animada ? "hf-logo-feliz" : ""}`} role="img" aria-label="Héfisto" overflow={animada ? "visible" : undefined}>
      <rect width="64" height="64" rx="14" style={{ fill: OURO }} />
      <path style={{ fill: TINTA }} d="M11 10H23V24H35V10H47V34H23V44H11Z" />
      {animada && <circle cx="41" cy="34" r="6" style={{ fill: TINTA }} />}
      <path className={animada ? "hf-perna-feliz" : undefined} style={{ fill: "none", stroke: TINTA, strokeWidth: 12 }} d="M41 33V36C41 47 46 51 57 51" />
    </svg>
  );
}
