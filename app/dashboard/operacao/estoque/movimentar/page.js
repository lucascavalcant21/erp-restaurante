"use client";

// Endereço antigo da "Entrada e retirada": a tela única do estoque é
// /dashboard/operacao/estoque (HDEV-EST-001). Mantém os parâmetros.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirecionar() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const q = new URLSearchParams(params.toString());
    if (q.get("tipo") === "historico") { q.delete("tipo"); router.replace(`/dashboard/operacao/estoque/historico${q.toString() ? `?${q}` : ""}`); return; }
    router.replace(`/dashboard/operacao/estoque${q.toString() ? `?${q}` : ""}`);
  }, [router, params]);
  return null;
}

export default function MovimentarAntigo() {
  return <Suspense fallback={null}><Redirecionar /></Suspense>;
}
