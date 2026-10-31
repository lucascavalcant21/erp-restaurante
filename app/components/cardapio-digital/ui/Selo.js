import { palavraDesconto } from "../../../lib/cardapio-visual.mjs";
import Icone from "./Icone";
import s from "./ui.module.css";

// Selos da ficha técnica (9C.4): sempre o lado positivo e o negativo.
//   ok      — verde com ✓ ("Sem glúten", "Vegano");
//   alerta  — amarelo com ⚠ ("Contém glúten", "Contém crustáceos");
//   pimenta — vermelho claro com a pimentinha (versão pequena do card da lista).
// Quem decide o texto e o tipo é a regra da ficha; aqui é só o desenho.

const TIPOS = { ok: s.seloOk, alerta: s.seloAlerta, pimenta: s.seloPimenta };
const ICONE = { ok: ["check", 2.6], alerta: ["alerta", 2.2], pimenta: ["pimenta", 0] };

export default function Selo({ tipo = "ok", pequeno = false, semIcone = false, className = "", children, ...resto }) {
  const [icone, traco] = ICONE[tipo] || ICONE.ok;
  return (
    <span className={`${s.selo} ${TIPOS[tipo] || s.seloOk} ${pequeno ? s.seloP : ""} ${className}`} {...resto}>
      {semIcone ? null : <Icone nome={icone} tamanho={pequeno ? 11 : 16} traco={traco} />}
      {children}
    </span>
  );
}

const ESTADOS = { ok: s.estadoOk, neutro: s.estadoNeutro, falta: s.estadoFalta };

/** Situação de um grupo de complementos: "✓ Ok", "1 / 2" ou "⚠ Falta 1". */
export function EstadoGrupo({ tipo = "neutro", children }) {
  return <span className={`${s.estado} ${ESTADOS[tipo] || s.estadoNeutro}`}>{children}</span>;
}

/**
 * A palavra DESCONTO (9M): maiúscula, negrito, um pouco maior e com espaço
 * antes. Uso: <>10% de<PalavraDesconto /> em todos os pratos</>.
 */
export function PalavraDesconto({ idioma = "pt", espacoAntes = true }) {
  return (
    <>
      {espacoAntes ? " " : null}
      <strong className={s.desconto}>{palavraDesconto(idioma)}</strong>
    </>
  );
}

/** "10% DESCONTO" num lugar só (9M). */
export function SeloDesconto({ valor, idioma = "pt", className = "" }) {
  return (
    <span className={className}>
      {valor}
      <PalavraDesconto idioma={idioma} />
    </span>
  );
}

const NOMES_PIMENTA = ["Sem pimenta", "Pimenta leve", "Pimenta média", "Pimenta forte"];
const PIMENTA = "M14.5 6.5c2.8-.4 5.2 1.6 5.4 4.4.3 4.8-5.7 10.6-13.6 10.6-2.2 0-3.3-.8-3.3-1.6 0-.9 1.3-1.2 2.6-1.6 3.5-1 5.3-3.7 6-7.2.5-2.6 1.1-4.3 2.9-4.6z";

/**
 * Nível de pimenta (0 a 3) com três pimentinhas e uma frase curta. 0 fica
 * verde ("Sem pimenta"); 1 a 3 ficam vermelhos. `nivel` nulo = sem dado na
 * ficha: não mostra nada.
 */
export function IndicadorPimenta({ nivel, nota, className = "" }) {
  if (nivel == null || !Number.isFinite(Number(nivel))) return null;
  const n = Math.max(0, Math.min(3, Math.round(Number(nivel))));
  return (
    <div className={`${s.pimentaCaixa} ${n === 0 ? s.pimentaCaixaSem : ""} ${className}`}>
      <div className={s.pimentas} aria-hidden="true">
        {[1, 2, 3].map((k) => (
          <svg key={k} width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.4" strokeLinejoin="round">
            <path d={PIMENTA} className={k <= n ? s.pimentaAcesa : s.pimentaApagada} />
            <path d="M15 6.5c0-1.6.8-3 2.3-3.6" className={s.pimentaTalo} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ))}
      </div>
      <div className={s.pimentaTextos}>
        <span className={s.pimentaTitulo}>{NOMES_PIMENTA[n]}</span>
        {nota ? <span className={s.pimentaNota}>{nota}</span> : null}
      </div>
    </div>
  );
}
