"use client";

// Combos e promoções numa área própria da marmitaria (pedido do dono,
// 28/10/2026: "não tem nada de combos" — antes era uma aba escondida em
// Marmitas). Fica sob /marmitas para herdar a mesma permissão de rota.

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
  return <CombosPromocoes abaInicial={params.get("aba") || "cardapio"} onEditar={(m) => router.push(`/dashboard/marmitaria/marmitas?editar=${encodeURIComponent(m.id)}`)} />;
}

export default function CombosPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
