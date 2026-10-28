"use client";

// Marmitaria & Delivery: sete áreas, uma barra só. O menu de cima leva para
// cá sem submenu (a navegação do módulo mora aqui), e o que é secundário vira
// aba dentro de cada área.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarmitariaProvider, useMarmitaria } from "../../components/marmitaria/contexto";
import { Aviso } from "../../components/marmitaria/ui";
import { MSG_MIGRACAO } from "../../lib/marmitaria/dados";

// "curto" é o rótulo no celular: quatro por linha cabem sem quebrar.
const AREAS = [
  { href: "/dashboard/marmitaria", rotulo: "Visão geral", curto: "Geral", exato: true },
  { href: "/dashboard/marmitaria/marmitas", rotulo: "Marmitas", exceto: "/dashboard/marmitaria/marmitas/combos" },
  { href: "/dashboard/marmitaria/marmitas/combos", rotulo: "Combos" },
  { href: "/dashboard/marmitaria/estoque", rotulo: "Estoque e produção", curto: "Estoque" },
  { href: "/dashboard/marmitaria/funcionarios", rotulo: "Funcionários", curto: "Equipe" },
  { href: "/dashboard/marmitaria/financeiro", rotulo: "Financeiro" },
  { href: "/dashboard/marmitaria/configuracoes", rotulo: "Configurações", curto: "Ajustes" },
];

function Estado() {
  const { unidadeId, carregando, erro, base } = useMarmitaria();
  if (!unidadeId) return <Aviso tipo="alerta" className="mb-4">Selecione uma unidade no topo da tela para usar a marmitaria.</Aviso>;
  if (base?.migracaoPendente) return <Aviso tipo="alerta" className="mb-4">{MSG_MIGRACAO}</Aviso>;
  if (erro && !carregando) return <Aviso tipo="alerta" className="mb-4">Não foi possível carregar tudo: {erro}</Aviso>;
  return null;
}

export default function MarmitariaLayout({ children }) {
  const pathname = usePathname() || "";
  return (
    <MarmitariaProvider>
      <div className="min-h-full bg-hf-bg">
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6">
          <header className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-hf-accent">Operação</p>
            <h1 className="text-xl font-black text-hf-text sm:text-2xl">Marmitaria &amp; Delivery</h1>
          </header>
          <nav aria-label="Áreas da marmitaria" className="mb-5 grid grid-cols-4 gap-1 rounded-2xl border border-hf-border bg-hf-surface p-1 lg:grid-cols-7">
            {AREAS.map((a) => {
              const ativo = a.exato ? pathname === a.href : (pathname === a.href || pathname.startsWith(`${a.href}/`)) && !(a.exceto && pathname.startsWith(a.exceto));
              return (
                <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl px-2 text-center text-sm font-semibold transition ${ativo ? "bg-hf-accent text-hf-accent-fg" : "text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"}`}>
                  {a.curto ? <><span className="sm:hidden">{a.curto}</span><span className="hidden sm:inline">{a.rotulo}</span></> : a.rotulo}
                </Link>
              );
            })}
          </nav>
          <Estado />
          {children}
        </div>
      </div>
    </MarmitariaProvider>
  );
}
