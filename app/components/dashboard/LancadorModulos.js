"use client";

// Grade de módulos do Início, no visual do Nina (pedido do dono, 07/11/2026):
// ícone colorido, nome e uma linha do que tem dentro. A lista é a do menu do
// topo (menu-principal.mjs) com as mesmas regras de permissão: quem tem perfil
// limitado só vê as áreas que pode abrir.

import Link from "next/link";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { menuPrincipal, menuVisivel, universoLiberado } from "../../lib/menu-principal.mjs";
import { negociosDoLogin, semNegociosDaTroca } from "../../lib/negocios.mjs";
import IconeModulo from "../ui/IconeModulo";

export default function LancadorModulos() {
  const { sessao, unidades } = useERP();
  if (!sessao) return null;

  const pode = (rota, busca) => canAccessRoute(sessao, rota, busca);
  const podeInteligencia = !sessao.gerenciado || hasPermission(sessao, "dashboard.intelligence.view");
  const todos = menuPrincipal({ podeInteligencia });
  const limitado = !!sessao.gerenciado || !!sessao.is_app;
  const liberados = limitado
    ? menuVisivel(todos, (rota, busca) => pode(rota, busca) || universoLiberado(rota, pode))
    : todos;
  // Marmitaria e Eventos que estão na troca de negócio do topo não se repetem aqui.
  const negocios = sessao.is_app ? [] : negociosDoLogin(unidades, (rota) => pode(rota));
  const modulos = semNegociosDaTroca(liberados, negocios);
  if (modulos.length === 0) return null;

  // Para quem não pode abrir a página da área, o link é a primeira tela liberada dela.
  const destino = (m) => {
    const [rota, busca = ""] = m.href.split("?");
    if (!limitado || pode(rota, busca) || universoLiberado(rota, pode)) return m.href;
    return m.submodules?.[0]?.href || m.href;
  };

  return (
    <section aria-label="Módulos" className="space-y-3">
      <h2 className="text-[13px] font-medium text-hf-muted">Módulos</h2>
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 rounded-[22px] border border-hf-border bg-hf-surface px-2 py-5 shadow-xs sm:grid-cols-4 sm:px-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8">
        {modulos.map((m) => (
          <Link
            key={m.id}
            href={destino(m)}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 py-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
          >
            <IconeModulo item={m} tamanho="lg" className="transition group-hover:-translate-y-0.5 group-active:scale-95" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight text-hf-text">{m.label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-tight text-hf-muted line-clamp-2 sm:block">{m.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
