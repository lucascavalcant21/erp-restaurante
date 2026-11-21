"use client";

// Identidade "Gestão" (pedido do dono, 08/11/2026): .tema-gestao troca os
// tokens hf-* por vermelho e areia só dentro do módulo; a barra de áreas é preta
// com ícone em cima do nome.
// Marmitaria & Delivery: dezesseis áreas, uma barra só, na ordem do trabalho:
// comprar, guardar, produzir e vender. O menu de cima leva para
// cá sem submenu (a navegação do módulo mora aqui), e o que é secundário vira
// aba dentro de cada área.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarmitariaProvider, useMarmitaria } from "../../components/marmitaria/contexto";
import FilaOffline from "../../components/marmitaria/FilaOffline";
import { JornadaProvider, useJornada } from "../../components/marmitaria/useJornada";
import { PASSOS, ROTAS } from "../../lib/marmitaria/jornada.mjs";
import { tituloDoDelivery } from "../../lib/marmitaria/delivery.mjs";
import { Aviso } from "../../components/marmitaria/ui";
import { MSG_MIGRACAO } from "../../lib/marmitaria/dados";
import CabecalhoTela from "../../components/ui/CabecalhoTela";
import { BarraDeAreas } from "../../components/gerencial/PainelGerencial";
import { BadgeDollarSign, BarChart3, Boxes, Calculator, CheckCircle2, CupSoda, ChefHat, ClipboardList, Gauge, GraduationCap, Home, Layers, Package, Percent, Receipt, Settings, ShoppingCart, Smartphone, Store, TrendingUp, Users, Wallet, Warehouse } from "lucide-react";

const FICHA = "/dashboard/marmitaria/marmitas";
const ESTOQUE = "/dashboard/marmitaria/estoque";
// Dia a dia (depois da sequência concluída).
const AREAS = [
  { href: "/dashboard/marmitaria", rotulo: "Início", exato: true, icone: Home },
  { href: `${FICHA}/simulador`, rotulo: "Simulador e apps", icone: Calculator },
  { href: `${FICHA}/lucro`, rotulo: "Vendas e faturamento", icone: TrendingUp },
  { href: `${ESTOQUE}/cozinha`, rotulo: "Produção do dia", tambem: [`${ESTOQUE}/producoes`], icone: ChefHat },
  { href: `${ESTOQUE}/compras`, rotulo: "Compras", icone: ShoppingCart },
  { href: ESTOQUE, rotulo: "Estoque", exceto: [`${ESTOQUE}/compras`, `${ESTOQUE}/producoes`, `${ESTOQUE}/cozinha`], icone: Warehouse },
  { href: FICHA, rotulo: "Ficha técnica", exceto: [`${FICHA}/cardapio`, `${FICHA}/combos`, `${FICHA}/bebidas`, `${FICHA}/embalagens`, `${FICHA}/lucro`, `${FICHA}/simulador`, `${FICHA}/processos`, `${FICHA}/produtos`, `${FICHA}/organizador`], icone: ClipboardList },
  { href: `${FICHA}/cardapio`, rotulo: "Precificação", icone: BadgeDollarSign },
  { href: `${FICHA}/combos`, rotulo: "Combos e descontos", icone: Percent },
  { href: `${FICHA}/organizador`, rotulo: "Organizador de plataforma", icone: Smartphone },
  { href: "/dashboard/marmitaria/concorrentes", rotulo: "Concorrentes", icone: Store },
  { href: `${FICHA}/processos`, rotulo: "Guia de montagem", icone: Layers },
  { href: `${FICHA}/produtos`, rotulo: "Ingredientes", icone: Package },
  { href: `${FICHA}/bebidas`, rotulo: "Bebidas", icone: CupSoda },
  { href: `${FICHA}/embalagens`, rotulo: "Embalagens", icone: Boxes },
  { href: "/dashboard/marmitaria/funcionarios", rotulo: "Equipe", icone: Users },
  { href: "/dashboard/marmitaria/treinamento", rotulo: "Treinamento", icone: GraduationCap },
  { href: "/dashboard/marmitaria/configuracoes", rotulo: "Custos e apps", icone: Settings },
  { href: "/dashboard/marmitaria/financeiro/gastos", rotulo: "Gastos e rendimento", icone: Receipt },
  { href: "/dashboard/marmitaria/financeiro", rotulo: "DRE e financeiro", exceto: ["/dashboard/marmitaria/financeiro/gastos"], icone: Wallet },
  // Dashboard gerencial no modelo de gestão (pedido do dono, 08/11/2026).
  { href: "/dashboard/marmitaria/gerencial", rotulo: "Dashboard gerencial", icone: Gauge },
];

// Sequência de implantação (pedido do dono, 16/11/2026): nove passos
// numerados, na ordem. Concluída, a barra vira a do dia a dia.
const ICONES_PASSO = { empresa: Users, custos: Calculator, apps: Smartphone, ingredientes: Package, bebidas: CupSoda, embalagens: Boxes, fichas: ClipboardList, preco: BadgeDollarSign, combos: Percent, montagem: Layers, dre: BarChart3 };
function areasDaJornada(jornada) {
  const status = Object.fromEntries((jornada?.passos || []).map((p) => [p.id, p.status]));
  const exatos = new Set([ROTAS.fichas, "/dashboard/marmitaria/configuracoes"]);
  return [
    { href: "/dashboard/marmitaria", rotulo: "Início", exato: true, icone: Home },
    ...PASSOS.map((p) => ({
      href: p.rota,
      rotulo: `${p.numero}. ${p.titulo}`,
      icone: status[p.id] === "feito" ? CheckCircle2 : ICONES_PASSO[p.id],
      exato: exatos.has(p.rota),
      tambem: p.id === "fichas" ? [`${FICHA}/nova`, `${FICHA}/editar`] : [],
    })),
    { href: `${ESTOQUE}/compras`, rotulo: "Compras", icone: ShoppingCart },
    { href: ESTOQUE, rotulo: "Estoque", exceto: [`${ESTOQUE}/compras`, `${ESTOQUE}/producoes`, `${ESTOQUE}/cozinha`], icone: Warehouse },
    // ferramentas que valem desde o começo (dono, 17/11/2026: "onde está o simulador?")
    { href: `${FICHA}/simulador`, rotulo: "Simulador e apps", icone: Calculator },
    { href: "/dashboard/marmitaria/financeiro/gastos", rotulo: "Gastos e rendimento", icone: Receipt },
    { href: "/dashboard/marmitaria/concorrentes", rotulo: "Concorrentes", icone: Store },
    { href: `${FICHA}/organizador`, rotulo: "Organizador de plataforma", icone: Smartphone },
  ];
}


function Estado() {
  const { unidadeId, carregando, erro, base } = useMarmitaria();
  if (!unidadeId) return <Aviso tipo="alerta" className="mb-4">Selecione uma unidade no topo da tela para usar o delivery.</Aviso>;
  if (base?.migracaoPendente) return <Aviso tipo="alerta" className="mb-4">{MSG_MIGRACAO}</Aviso>;
  if (erro && !carregando) return <Aviso tipo="alerta" className="mb-4">Não foi possível carregar tudo: {erro}</Aviso>;
  return null;
}

function Titulo() {
  const { delivery } = useJornada();
  return <CabecalhoTela embutido titulo={tituloDoDelivery(delivery)} subtitulo="Pedidos, produção, entregas e compras do delivery" />;
}

function Barra() {
  const pathname = usePathname() || "";
  const { jornada } = useJornada();
  // Enquanto não sabe (carregando), mostra o dia a dia: quem já concluiu não vê a sequência piscar.
  const naJornada = jornada && !jornada.concluida;
  const areas = naJornada ? areasDaJornada(jornada) : AREAS;
  return (
    <BarraDeAreas rotulo={naJornada ? "Sequência de implantação do delivery" : "Áreas do delivery"} areas={areas}
      ativa={(a) => (a.exato ? pathname === a.href : (pathname === a.href || pathname.startsWith(`${a.href}/`)) && !(a.exceto || []).some((x) => pathname.startsWith(x)))
        || (a.tambem || []).some((x) => pathname.startsWith(x))} />
  );
}

export default function MarmitariaLayout({ children }) {
  return (
    <MarmitariaProvider>
      <JornadaProvider>
        <div className="tema-gestao min-h-full bg-hf-bg">
          <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-3 sm:px-6 lg:px-8">
            <Titulo />
            <Barra />
            <Estado />
            <div className="mb-3"><FilaOffline /></div>
            {children}
          </div>
        </div>
      </JornadaProvider>
    </MarmitariaProvider>
  );
}
