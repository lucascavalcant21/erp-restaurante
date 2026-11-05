"use client";

// Estoque da marmitaria: Produtos, Embalagens, Limpeza e Produção. Aqui só se retira.

import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { Estoque } from "../../../components/marmitaria/TelasDeEstoque";

export default function EstoquePage() {
  const { base } = useMarmitaria();
  return base ? <Estoque /> : null;
}
