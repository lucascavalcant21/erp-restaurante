"use client";

// Marmitaria & Delivery: treze áreas, uma barra só. O menu de cima leva para
// cá sem submenu (a navegação do módulo mora aqui), e o que é secundário vira
// aba dentro de cada área.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { MarmitariaProvider, useMarmitaria } from "../../components/marmitaria/contexto";
import { EntrarNaMarmitaria, SairDaMarmitaria } from "../../components/marmitaria/PortaDaMarmitaria";
import { UNIDADE_MARMITARIA } from "../../lib/marmitaria/acesso.mjs";
import { Aviso } from "../../components/marmitaria/ui";
import { MSG_MIGRACAO } from "../../lib/marmitaria/dados";

// "curto" é o rótulo no celular: quatro por linha cabem sem quebrar.
const AREAS = [
  { href: "/dashboard/marmitaria", rotulo: "Visão geral", curto: "Geral", exato: true },
  { href: "/dashboard/marmitaria/marmitas", rotulo: "Ficha técnica", curto: "Ficha", exceto: ["/dashboard/marmitaria/marmitas/cardapio", "/dashboard/marmitaria/marmitas/embalagens", "/dashboard/marmitaria/marmitas/lucro", "/dashboard/marmitaria/marmitas/processos", "/dashboard/marmitaria/marmitas/produtos"] },
  { href: "/dashboard/marmitaria/marmitas/produtos", rotulo: "Produtos" },
  { href: "/dashboard/marmitaria/marmitas/processos", rotulo: "Processos" },
  { href: "/dashboard/marmitaria/marmitas/embalagens", rotulo: "Embalagens", curto: "Embal." },
  { href: "/dashboard/marmitaria/marmitas/cardapio", rotulo: "Cardápio" },
  { href: "/dashboard/marmitaria/marmitas/lucro", rotulo: "Painel de lucro", curto: "Lucro" },
  { href: "/dashboard/marmitaria/estoque/compras", rotulo: "Compras" },
  { href: "/dashboard/marmitaria/estoque", rotulo: "Estoque", exceto: ["/dashboard/marmitaria/estoque/compras", "/dashboard/marmitaria/estoque/cozinha"] },
  { href: "/dashboard/marmitaria/estoque/cozinha", rotulo: "Cozinha" },
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
  const { unidadeAtiva } = useERP();
  const atual = typeof unidadeAtiva === "object" ? unidadeAtiva?.id : unidadeAtiva;
  // A marmitaria é outra unidade: fora dela, a tela pede a senha.
  if (atual !== UNIDADE_MARMITARIA) {
    return <div className="min-h-full bg-hf-bg px-4 pb-16 pt-8"><EntrarNaMarmitaria /></div>;
  }
  return (
    <MarmitariaProvider>
      <div className="min-h-full bg-hf-bg">
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-hf-accent">Operação</p>
              <h1 className="text-xl font-black text-hf-text sm:text-2xl">Marmitaria &amp; Delivery</h1>
            </div>
            <SairDaMarmitaria />
          </header>
          <nav aria-label="Áreas da marmitaria" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-hf-border bg-hf-surface p-1 sm:inline-flex sm:max-w-full sm:flex-wrap">
            {AREAS.map((a) => {
              const ativo = a.exato ? pathname === a.href : (pathname === a.href || pathname.startsWith(`${a.href}/`)) && !(a.exceto || []).some((x) => pathname.startsWith(x));
              return (
                <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl px-2 text-center text-sm font-semibold transition sm:min-h-[38px] sm:px-4 ${ativo ? "bg-hf-accent text-hf-accent-fg" : "text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"}`}>
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
