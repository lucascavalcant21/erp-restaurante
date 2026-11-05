// Logo do Héfisto: o H com a perna mais longa, fazendo a curva. Lembra Hefesto, o
// ferreiro que mancava. As cores vêm direto das variáveis do tema: a classe
// text-hf-accent troca o dourado pelo tom escuro usado em texto.

const OURO = "rgb(var(--hf-accent))";
const TINTA = "rgb(var(--hf-accent-fg))";

export default function LogoHefisto({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Héfisto">
      <rect width="64" height="64" rx="14" style={{ fill: OURO }} />
      <path style={{ fill: TINTA }} d="M11 10H23V24H41V34H23V44H11Z" />
      <path style={{ fill: "none", stroke: TINTA, strokeWidth: 12 }} d="M41 10V36C41 47 46 51 57 51" />
    </svg>
  );
}
