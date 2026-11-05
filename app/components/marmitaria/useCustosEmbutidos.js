"use client";

// Equipe e custos fixos do último mês fechado, os mesmos números do DRE da
// marmitaria, repartidos por marmita.

import { useMemo } from "react";
import { useMarmitaria } from "./contexto";
import { useDreMarmitaria } from "./Dre";
import { baseDosCustos, custosEmbutidos, mesAnterior } from "../../lib/marmitaria/cardapio.mjs";

export function useBaseDosCustos() {
  const mes = useMemo(() => mesAnterior(new Date().toLocaleDateString("sv-SE")), []);
  const apurado = useDreMarmitaria(mes);
  return useMemo(() => baseDosCustos(apurado), [apurado]);
}

export function useCustosEmbutidos() {
  const { base } = useMarmitaria();
  const doSistema = useBaseDosCustos();
  return useMemo(() => custosEmbutidos({ ...doSistema, config: base?.config }), [doSistema, base]);
}
