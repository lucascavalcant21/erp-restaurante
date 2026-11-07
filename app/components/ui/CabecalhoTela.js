"use client";

// Cabeçalho das telas no visual do Nina (pedido do dono, 07/11/2026):
//   ← Unidade / Área / Tela                                 sábado, 07 nov.
//   [ícone colorido]  Título
//                     Subtítulo                          [ações]
// A área, o ícone e a cor saem do menu (telaDaRota), então a tela aberta pelo
// card "Etiquetas" da Cozinha mostra o mesmo ícone azul do card. O "voltar"
// leva à tela de cards de onde veio (abrirMenu do ERPContext), ou volta uma
// página quando `voltar="historico"`.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { telaDaRota } from "../../lib/menu-principal.mjs";
import { lerOrigem } from "../../lib/universo-origem";
import IconeModulo from "./IconeModulo";

function dataCurta(d) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" })
    .format(d)
    .replace(" de ", " ");
}

/** Área e card da tela atual (lido no navegador: a origem fica no sessionStorage). */
export function useTelaAtual() {
  const pathname = usePathname();
  const [busca, setBusca] = useState({ search: "", origem: null });
  useEffect(() => {
    setBusca({ search: window.location.search, origem: lerOrigem() });
  }, [pathname]);
  return useMemo(() => telaDaRota(pathname, busca.search, busca.origem), [pathname, busca]);
}

/**
 * @param {object} p
 * @param {string} p.titulo
 * @param {string} [p.subtitulo]
 * @param {Function} [p.icone]      ícone do lucide, só quando a tela não está no menu
 * @param {"area"|"historico"|false} [p.voltar]  para onde a seta leva
 * @param {boolean} [p.fixo]        gruda no topo ao rolar (telas longas)
 * @param {boolean} [p.embutido]    dentro de uma coluna que já tem margem lateral
 * @param {React.ReactNode} [p.children]  ações (botões) à direita
 */
export default function CabecalhoTela({ titulo, subtitulo, icone: IconeAvulso, voltar = "area", fixo = false, embutido = false, className = "", children }) {
  const router = useRouter();
  const { unidadeInfo, abrirMenu } = useERP();
  const { area, item } = useTelaAtual();
  const [hoje, setHoje] = useState("");
  useEffect(() => { setHoje(dataCurta(new Date())); }, []);

  const nomeTela = titulo || item?.label || area?.label || "";
  const trilha = [unidadeInfo?.nome, area?.label, item && item.label !== area?.label ? item.label : null]
    .filter(Boolean);
  // A trilha não repete o título quando ele é o mesmo nome do card.
  if (trilha.length > 1 && trilha[trilha.length - 1] === nomeTela) trilha.pop();

  const aoVoltar = () => {
    if (voltar === "historico") router.back();
    else if (abrirMenu) abrirMenu();
    else router.push("/dashboard");
  };

  return (
    <header
      className={`erp-cabecalho-tela min-w-0 space-y-2.5 ${embutido ? "pb-3 pt-1" : "px-4 pb-3 pt-4 sm:px-6 sm:pt-5 lg:px-8"} ${fixo ? "sticky top-0 z-20 bg-hf-bg/95 backdrop-blur" : ""} ${className}`}
    >
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <nav aria-label="Você está em" className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-hf-muted">
          {voltar && (
            <button
              type="button"
              onClick={aoVoltar}
              aria-label="Voltar"
              className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-hf-text-2 shadow-none hover:bg-hf-elevated hover:text-hf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          {trilha.map((parte, i) => (
            <span key={`${parte}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === 1 && area?.href ? (
                <Link href={area.href} className="truncate hover:text-hf-text">{parte}</Link>
              ) : (
                <span className={`truncate ${i === trilha.length - 1 ? "text-hf-text-2" : ""}`}>{parte}</span>
              )}
            </span>
          ))}
        </nav>
        {hoje && <p className="hidden shrink-0 text-xs font-medium text-hf-muted first-letter:uppercase sm:block">{hoje}</p>}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {item || area ? (
            <IconeModulo item={item || area} tamanho="md" />
          ) : IconeAvulso ? (
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-hf-tile-ardosia text-white">
              <IconeAvulso size={22} strokeWidth={1.9} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="erp-page-title truncate text-[22px] font-semibold leading-tight tracking-tight text-hf-text sm:text-[26px]">{nomeTela}</h1>
            {(subtitulo ?? item?.desc) && (
              <p className="erp-page-subtitle mt-0.5 text-sm text-hf-muted">{subtitulo ?? item?.desc}</p>
            )}
          </div>
        </div>
        {children && (
          <div className="erp-page-header-actions flex min-w-0 flex-wrap items-center gap-2 md:ml-auto md:justify-end">{children}</div>
        )}
      </div>
    </header>
  );
}
