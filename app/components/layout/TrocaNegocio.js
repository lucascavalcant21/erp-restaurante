"use client";

// Troca entre restaurante, marmitaria e eventos, sempre à vista no topo.

import Link from "next/link";
import { negocioDaRota, negociosVisiveis } from "../../lib/negocios.mjs";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";

export default function TrocaNegocio({ sessao, pathname }) {
  if (!sessao || sessao.is_app) return null;
  const lista = negociosVisiveis((rota) => canAccessRoute(sessao, rota));
  if (!lista.length) return null;
  const atual = negocioDaRota(pathname);
  return (
    <nav aria-label="Trocar de negócio" className="border-t border-hf-menu-border px-2 py-1.5 lg:px-6">
      <div className="mx-auto flex max-w-md gap-1">
        {lista.map((n) => (
          <Link key={n.id} href={n.href} aria-current={atual === n.id ? "page" : undefined}
            className={`flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-2 text-sm font-bold transition-colors ${atual === n.id ? "bg-hf-accent text-hf-accent-fg" : "text-hf-menu-muted hover:text-hf-menu-text"}`}>
            {n.rotulo}
          </Link>
        ))}
      </div>
    </nav>
  );
}
