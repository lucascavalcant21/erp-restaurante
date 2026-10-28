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
        // Com `onClick` a aba é um botão (abre uma folha na mesma tela); com `href`, um link.
        const Tag = it.onClick ? "button" : it.href?.startsWith("/") ? Link : "a";
        const extra = it.onClick ? { type: "button", onClick: it.onClick } : { href: it.href || "#" };
        return (
          <Tag key={it.rotulo} {...extra} aria-current={it.atual ? "page" : undefined} className={`${s.aba} ${it.atual ? s.abaAtual : ""}`}>
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
