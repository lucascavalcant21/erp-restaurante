"use client";

// Menu no topo: mostra o negócio aberto e, ao tocar, abre os outros embaixo.
// Trocar muda a unidade do app: RH, ingredientes e fichas passam a ser os dele.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { negocioAtual, negociosDoLogin } from "../../lib/negocios.mjs";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";

export default function TrocaNegocio({ sessao, pathname }) {
  const router = useRouter();
  const { unidades, unidadeAtiva, setUnidadeAtiva } = useERP();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);

  useEffect(() => { setAberto(false); }, [pathname]);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);

  if (!sessao || sessao.is_app) return null;
  const lista = negociosDoLogin(unidades, (rota) => canAccessRoute(sessao, rota));
  if (!lista.length) return null;
  const idAtual = negocioAtual(pathname, typeof unidadeAtiva === "object" ? unidadeAtiva?.id : unidadeAtiva);
  const atual = lista.find((n) => n.id === idAtual) || lista[0];

  function escolher(n) {
    setAberto(false);
    if (n.id === atual.id && pathname === n.href) return;
    setUnidadeAtiva(n.unidadeId);
    router.push(n.href);
  }

  return (
    <div ref={caixa} className="relative shrink-0">
      <button type="button" aria-haspopup="menu" aria-expanded={aberto} aria-label={`Negócio aberto: ${atual.rotulo}. Trocar`} onClick={() => setAberto(!aberto)}
        className="flex h-11 items-center gap-1 rounded-lg px-2.5 text-sm font-bold text-hf-menu-text transition-colors hover:bg-white/10">
        {atual.rotulo}
        <ChevronDown size={16} className={`transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div role="menu" aria-label="Trocar de negócio" className="absolute left-0 top-full z-[60] mt-1 w-48 overflow-hidden rounded-xl border border-hf-border bg-hf-surface py-1 shadow-lg">
          {lista.map((n) => (
            <button key={n.id} type="button" role="menuitem" onClick={() => escolher(n)}
              className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left text-sm font-bold text-hf-text hover:bg-hf-elevated ${n.id === atual.id ? "bg-hf-elevated" : ""}`}>
              {n.rotulo}
              {n.id === atual.id && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
