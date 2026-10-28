import Link from "next/link";
import Icone from "./Icone";
import s from "./ui.module.css";

// Barra inferior do celular (delivery, QR e área do cliente): ícone + nome, a
// aba atual na cor principal com o fundo verde claro, contador vermelho
// opcional ("2" descontos novos). `fixa` gruda no rodapé respeitando a área
// segura do iPhone.
export default function BarraNavegacao({ itens = [], fixa = false, rotulo = "Navegação", className = "" }) {
  return (
    <nav aria-label={rotulo} className={`${s.barra} ${fixa ? s.barraFixa : ""} ${className}`}>
      {itens.map((it) => {
        const Tag = it.href?.startsWith("/") ? Link : "a";
        return (
          <Tag key={it.rotulo} href={it.href || "#"} aria-current={it.atual ? "page" : undefined} className={`${s.aba} ${it.atual ? s.abaAtual : ""}`}>
            <span className={s.abaIcone}>
              <Icone nome={it.icone} tamanho={22} />
            </span>
            {it.rotulo}
            {it.contador ? <span className={s.abaContador}>{it.contador}</span> : null}
          </Tag>
        );
      })}
    </nav>
  );
}
