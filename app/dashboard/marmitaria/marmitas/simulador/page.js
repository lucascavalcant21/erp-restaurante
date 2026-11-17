"use client";

// Simulador de vendas e comparativo entre apps (dono, 17/11/2026: "onde está o
// simulador? publique ele"): o mesmo Painel de lucro, aberto direto no
// simulador, com área própria na barra da marmitaria (também na implantação).
// Fica sob /marmitas para herdar a mesma permissão de rota.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import PainelDeLucro from "../../../../components/marmitaria/PainelDeLucro";
import { Cartao } from "../../../../components/marmitaria/ui";

function Conteudo() {
  const { base, carregando } = useMarmitaria();
  const params = useSearchParams();
  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando simulador…</p></Cartao> : null;
  return <PainelDeLucro abaInicial={params.get("aba") === "apps" ? "apps" : "simulador"} />;
}

export default function SimuladorPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
