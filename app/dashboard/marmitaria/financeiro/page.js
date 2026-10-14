"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { Abas } from "../../../components/marmitaria/ui";
import Dre from "../../../components/marmitaria/Dre";
import Vendas from "../../../components/marmitaria/Vendas";
import Simulador from "../../../components/marmitaria/Simulador";

const ABAS = [{ id: "resultado", rotulo: "Resultado (DRE)" }, { id: "vendas", rotulo: "Vendas" }, { id: "simulador", rotulo: "Simulador" }];

function Conteudo() {
  const { base } = useMarmitaria();
  const params = useSearchParams();
  const router = useRouter();
  const [aba, setAba] = useState(ABAS.some((a) => a.id === params.get("aba")) ? params.get("aba") : "resultado");
  if (!base) return null;
  return (
    <div className="space-y-4">
      <Abas abas={ABAS} valor={aba} onChange={(v) => { setAba(v); router.replace(`?aba=${v}`); }} />
      {aba === "resultado" && <Dre />}
      {aba === "vendas" && <Vendas />}
      {aba === "simulador" && <Simulador />}
    </div>
  );
}

export default function FinanceiroPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
