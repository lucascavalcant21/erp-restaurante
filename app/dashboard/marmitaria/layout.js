"use client";

// Marmitaria & Delivery: treze áreas, uma barra só, na ordem do trabalho:
// comprar, guardar, produzir e vender. O menu de cima leva para
// cá sem submenu (a navegação do módulo mora aqui), e o que é secundário vira
// aba dentro de cada área.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarmitariaProvider, useMarmitaria } from "../../components/marmitaria/contexto";
import { Aviso } from "../../components/marmitaria/ui";
import { MSG_MIGRACAO } from "../../lib/marmitaria/dados";
import CabecalhoTela from "../../components/ui/CabecalhoTela";

const FICHA = "/dashboard/marmitaria/marmitas";
const ESTOQUE = "/dashboard/marmitaria/estoque";
const AREAS = [
  { href: "/dashboard/marmitaria", rotulo: "Início", exato: true },
  { href: `${FICHA}/produtos`, rotulo: "Cadastro de ingredientes" },
  { href: `${FICHA}/embalagens`, rotulo: "Cadastro de embalagens" },
  { href: `${ESTOQUE}/compras`, rotulo: "Compras" },
  { href: ESTOQUE, rotulo: "Estoque", exceto: [`${ESTOQUE}/compras`, `${ESTOQUE}/producoes`, `${ESTOQUE}/cozinha`] },
  { href: FICHA, rotulo: "Ficha técnica", exceto: [`${FICHA}/cardapio`, `${FICHA}/embalagens`, `${FICHA}/lucro`, `${FICHA}/processos`, `${FICHA}/produtos`] },
  { href: `${FICHA}/cardapio`, rotulo: "Precificação" },
  { href: `${ESTOQUE}/cozinha`, rotulo: "Produção do dia", tambem: [`${ESTOQUE}/producoes`] },
  { href: `${FICHA}/processos`, rotulo: "Montagem do prato" },
  { href: `${FICHA}/lucro`, rotulo: "Faturamento" },
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
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-3 sm:px-6 lg:px-8">
          <CabecalhoTela embutido titulo="Marmitaria e delivery" subtitulo="Pedidos, produção, entregas e compras da marmitaria" />
          <nav aria-label="Áreas da marmitaria" className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {AREAS.map((a) => {
              const ativo = (a.exato ? pathname === a.href : (pathname === a.href || pathname.startsWith(`${a.href}/`)) && !(a.exceto || []).some((x) => pathname.startsWith(x)))
                || (a.tambem || []).some((x) => pathname.startsWith(x));
              return (
                <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${ativo ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"}`}>
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
