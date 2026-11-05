"use client";

// Painel de lucro da marmitaria. Fica sob /marmitas para herdar a mesma permissão de rota.

import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import PainelDeLucro from "../../../../components/marmitaria/PainelDeLucro";
import { Cartao } from "../../../../components/marmitaria/ui";

export default function LucroPage() {
  const { base, carregando } = useMarmitaria();
  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando painel…</p></Cartao> : null;
  return <PainelDeLucro />;
}
