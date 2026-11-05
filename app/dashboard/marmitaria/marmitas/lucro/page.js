"use client";

// Painel de lucro da marmitaria. Fica sob /marmitas para herdar a mesma permissão de rota.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import PainelDeLucro from "../../../../components/marmitaria/PainelDeLucro";
import { Cartao } from "../../../../components/marmitaria/ui";

function Conteudo() {
  const { base, carregando } = useMarmitaria();
  const params = useSearchParams();
  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando painel…</p></Cartao> : null;
  return <PainelDeLucro abaInicial={params.get("aba") || "painel"} />;
}

export default function LucroPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
