"use client";

// Marmitaria & Delivery: quatorze áreas, uma barra só, na ordem do trabalho:
// comprar, guardar, produzir e vender. O menu de cima leva para
// cá sem submenu (a navegação do módulo mora aqui), e o que é secundário vira
// aba dentro de cada área.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarmitariaProvider, useMarmitaria } from "../../components/marmitaria/contexto";
import { Aviso } from "../../components/marmitaria/ui";
import { MSG_MIGRACAO } from "../../lib/marmitaria/dados";

const FICHA = "/dashboard/marmitaria/marmitas";
const ESTOQUE = "/dashboard/marmitaria/estoque";
const AREAS = [
  { href: "/dashboard/marmitaria", rotulo: "Início", exato: true },
  { href: `${FICHA}/produtos`, rotulo: "Cadastro de ingredientes" },
  { href: `${FICHA}/embalagens`, rotulo: "Cadastro de embalagens" },
  { href: `${ESTOQUE}/compras`, rotulo: "Compras" },
  { href: ESTOQUE, rotulo: "Estoque", exceto: [`${ESTOQUE}/compras`, `${ESTOQUE}/producoes`, `${ESTOQUE}/cozinha`] },
  { href: `${ESTOQUE}/producoes`, rotulo: "Planejar produção" },
  { href: `${ESTOQUE}/cozinha`, rotulo: "Produção do dia" },
  { href: FICHA, rotulo: "Ficha técnica", exceto: [`${FICHA}/cardapio`, `${FICHA}/embalagens`, `${FICHA}/lucro`, `${FICHA}/processos`, `${FICHA}/produtos`] },
  { href: `${FICHA}/processos`, rotulo: "Montagem do prato" },
  { href: `${FICHA}/cardapio`, rotulo: "Cardápio" },
  { href: `${FICHA}/lucro`, rotulo: "Precificação" },
  { href: "/dashboard/marmitaria/funcionarios", rotulo: "Funcionários" },
  { href: "/dashboard/marmitaria/financeiro", rotulo: "Financeiro" },
  { href: "/dashboard/marmitaria/configuracoes", rotulo: "Configurações" },
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
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-hf-accent">Operação</p>
              <h1 className="text-xl font-black text-hf-text sm:text-2xl">Marmitaria &amp; Delivery</h1>
            </div>
          </header>
          <nav aria-label="Áreas da marmitaria" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-hf-border bg-hf-surface p-1 sm:inline-flex sm:max-w-full sm:flex-wrap">
            {AREAS.map((a) => {
              const ativo = a.exato ? pathname === a.href : (pathname === a.href || pathname.startsWith(`${a.href}/`)) && !(a.exceto || []).some((x) => pathname.startsWith(x));
              return (
                <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-[48px] items-center justify-center rounded-xl px-1 text-center text-[12px] font-semibold min-[360px]:text-[13px] leading-tight transition sm:min-h-[38px] sm:px-4 sm:text-sm ${ativo ? "bg-hf-accent text-hf-accent-fg" : "text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"}`}>
                  {a.rotulo}
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
