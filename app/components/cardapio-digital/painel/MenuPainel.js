import Link from "next/link";
import s from "./painel.module.css";

// Menu do painel do restaurante (9K). Só entra o que já tem tela: os itens do
// protótipo ainda sem tela (Dashboard, Disparos, Recomendações, Degustação,
// Nossa história) aparecem quando a etapa deles for entregue. Os que hoje
// moram no editor antigo abrem nele, já na aba certa.
export const ITENS_PAINEL = [
  { id: "crm", rotulo: "Clientes (CRM)", href: "/dashboard/clientes/crm" },
  { id: "campanhas", rotulo: "Campanhas automáticas", href: "/dashboard/clientes/campanhas" },
  { id: "cardapio", rotulo: "Cardápio", href: "/dashboard/operacao/cardapio?aba=produtos" },
  { id: "promocoes", rotulo: "Promoções e descontos", href: "/dashboard/operacao/cardapio?aba=promocoes" },
  { id: "fidelidade", rotulo: "Fidelidade e selos", href: "/dashboard/operacao/cardapio?aba=fidelidade" },
  { id: "vitrine", rotulo: "Vitrine e banners", href: "/dashboard/operacao/cardapio?aba=abertura" },
  { id: "idiomas", rotulo: "Idiomas", href: "/dashboard/operacao/cardapio?aba=idiomas" },
  { id: "configuracoes", rotulo: "Configurações", href: "/dashboard/operacao/cardapio?aba=aparencia" },
];

/** Iniciais da loja para o quadradinho do menu ("Casa Brasa" → "CB"). */
export function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  const letras = partes.slice(0, 2).map((p) => p[0]).join("");
  return (letras || String(nome || "?").slice(0, 2)).toUpperCase();
}

export default function MenuPainel({ atual, nomeLoja, itens }) {
  itens = itens || ITENS_PAINEL;
  return (
    <nav aria-label="Painel" className={s.menu}>
      <div className={s.marca}>
        <div className={s.marcaLogo} aria-hidden="true">{iniciais(nomeLoja)}</div>
        <span className={s.marcaNome}>Painel</span>
      </div>
      {itens.map((it) => {
        const eu = it.id === atual;
        return (
          <Link key={it.id} href={it.href} aria-current={eu ? "page" : undefined} className={`${s.menuItem} ${eu ? s.menuAtual : ""}`}>
            {it.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
