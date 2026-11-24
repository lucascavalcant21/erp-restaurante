"use client";

// Precificação do delivery: preço, markup, CMV e lucro por plataforma (combos
// e descontos ficam em /marmitas/combos). Fica sob /marmitas para herdar a mesma permissão de rota.

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import CombosPromocoes from "../../../../components/marmitaria/CombosPromocoes";
import { Cartao } from "../../../../components/marmitaria/ui";

function Conteudo() {
  const { base, carregando } = useMarmitaria();
  const router = useRouter();
  const params = useSearchParams();
  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando cardápio…</p></Cartao> : null;
  // links antigos de combos e promoções vão para a tela própria
  const abaPedida = params.get("aba");
  if (["combos", "promocoes"].includes(abaPedida)) { router.replace(`/dashboard/marmitaria/marmitas/combos?aba=${abaPedida}`); return null; }
  return <CombosPromocoes modo="precificacao" abaInicial={abaPedida || "cardapio"} onEditar={(m) => router.push(`/dashboard/marmitaria/marmitas?editar=${encodeURIComponent(m.id)}`)} />;
}

export default function CardapioPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
