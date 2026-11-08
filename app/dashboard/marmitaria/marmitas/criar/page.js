"use client";

// Criar marmita (pedido do dono, 08/11/2026): proteína, empanamento,
// acompanhamentos, embalagem, preço, lucro, desconto, combos, descrição e foto
// numa tela só. Fica sob /marmitas para herdar a permissão da Ficha técnica.

import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import CriarMarmita from "../../../../components/marmitaria/CriarMarmita";
import { Cartao } from "../../../../components/marmitaria/ui";

export default function CriarMarmitaPage() {
  const { base, carregando } = useMarmitaria();
  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando…</p></Cartao> : null;
  return <CriarMarmita />;
}
