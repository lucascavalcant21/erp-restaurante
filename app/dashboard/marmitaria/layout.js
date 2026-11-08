"use client";

// Identidade "Gestão" (pedido do dono, 08/11/2026): .tema-gestao troca os
// tokens hf-* por vermelho e areia só dentro do módulo; a barra de áreas é preta
// com ícone em cima do nome.
// Marmitaria & Delivery: catorze áreas, uma barra só, na ordem do trabalho:
// comprar, guardar, produzir e vender. O menu de cima leva para
// cá sem submenu (a navegação do módulo mora aqui), e o que é secundário vira
// aba dentro de cada área.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarmitariaProvider, useMarmitaria } from "../../components/marmitaria/contexto";
import { Aviso } from "../../components/marmitaria/ui";
import { MSG_MIGRACAO } from "../../lib/marmitaria/dados";
import CabecalhoTela from "../../components/ui/CabecalhoTela";
import { BarraDeAreas } from "../../components/gerencial/PainelGerencial";
import { BadgeDollarSign, Boxes, ChefHat, ClipboardList, Gauge, Home, Layers, Package, Settings, ShoppingCart, TrendingUp, Users, Wallet, Warehouse } from "lucide-react";

const FICHA = "/dashboard/marmitaria/marmitas";
const ESTOQUE = "/dashboard/marmitaria/estoque";
const AREAS = [
  { href: "/dashboard/marmitaria", rotulo: "Início", exato: true, icone: Home },
  // Dashboard gerencial no modelo de gestão (pedido do dono, 08/11/2026).
  { href: "/dashboard/marmitaria/gerencial", rotulo: "Dashboard gerencial", icone: Gauge },
  { href: `${FICHA}/produtos`, rotulo: "Cadastro de ingredientes", icone: Package },
  { href: `${FICHA}/embalagens`, rotulo: "Cadastro de embalagens", icone: Boxes },
  { href: `${ESTOQUE}/compras`, rotulo: "Compras", icone: ShoppingCart },
  { href: ESTOQUE, rotulo: "Estoque", exceto: [`${ESTOQUE}/compras`, `${ESTOQUE}/producoes`, `${ESTOQUE}/cozinha`], icone: Warehouse },
  { href: FICHA, rotulo: "Ficha técnica", exceto: [`${FICHA}/cardapio`, `${FICHA}/embalagens`, `${FICHA}/lucro`, `${FICHA}/processos`, `${FICHA}/produtos`], icone: ClipboardList },
  { href: `${FICHA}/cardapio`, rotulo: "Precificação", icone: BadgeDollarSign },
  { href: `${ESTOQUE}/cozinha`, rotulo: "Produção do dia", tambem: [`${ESTOQUE}/producoes`], icone: ChefHat },
  { href: `${FICHA}/processos`, rotulo: "Montagem do prato", icone: Layers },
  { href: `${FICHA}/lucro`, rotulo: "Faturamento", icone: TrendingUp },
  { href: "/dashboard/marmitaria/funcionarios", rotulo: "Funcionários", icone: Users },
  { href: "/dashboard/marmitaria/financeiro", rotulo: "Financeiro", icone: Wallet },
  { href: "/dashboard/marmitaria/configuracoes", rotulo: "Configurações", icone: Settings },
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
      <div className="tema-gestao min-h-full bg-hf-bg">
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-3 sm:px-6 lg:px-8">
          <CabecalhoTela embutido titulo="Marmitaria e delivery" subtitulo="Pedidos, produção, entregas e compras da marmitaria" />
          <BarraDeAreas rotulo="Áreas da marmitaria" areas={AREAS} ativa={(a) => (a.exato ? pathname === a.href : (pathname === a.href || pathname.startsWith(`${a.href}/`)) && !(a.exceto || []).some((x) => pathname.startsWith(x)))
            || (a.tambem || []).some((x) => pathname.startsWith(x))} />
          <Estado />
          {children}
        </div>
      </div>
    </MarmitariaProvider>
  );
}
