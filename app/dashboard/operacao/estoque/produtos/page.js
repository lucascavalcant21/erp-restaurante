"use client";

// "Todos os produtos" virou a própria tela do Estoque (uma tela só, pedido do
// dono, 27/10/2026). Endereço antigo redireciona mantendo os parâmetros.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirecionar() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => { router.replace(`/dashboard/operacao/estoque${params.toString() ? `?${params}` : ""}`); }, [router, params]);
  return null;
}

export default function TodosOsProdutosAntigo() {
  return <Suspense fallback={null}><Redirecionar /></Suspense>;
}
