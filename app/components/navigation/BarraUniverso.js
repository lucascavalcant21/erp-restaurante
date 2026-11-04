"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { universoDaRota } from "../../lib/menu-principal.mjs";
import { guardarOrigem, lerOrigem } from "../../lib/universo-origem";

// Faixa fixa abaixo do menu: várias telas não têm botão de voltar próprio, e as
// que têm rolam junto com o conteúdo. Daqui o caminho de volta está sempre à mão.
export default function BarraUniverso() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [universo, setUniverso] = useState(null);

  useEffect(() => {
    const u = universoDaRota(pathname, search, lerOrigem());
    if (u?.href === pathname) guardarOrigem(u.id);
    setUniverso(u);
  }, [pathname, search]);

  if (!universo || universo.href === pathname) return null;
  return (
    <nav aria-label={`Voltar para ${universo.label}`} className="shrink-0 border-b border-hf-border bg-hf-surface">
      <Link
        href={universo.href}
        className="inline-flex min-h-11 items-center gap-2 px-4 lg:px-6 text-sm font-bold text-hf-text hover:text-hf-accent"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Voltar para {universo.label}
      </Link>
    </nav>
  );
}
