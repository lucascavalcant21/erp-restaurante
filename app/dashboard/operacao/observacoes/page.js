"use client";

// As observações prontas passaram para Configurações → Impressão (07/11/2026),
// organizadas por setor e por categoria. Esta página antiga só redireciona.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ObservacoesAntigasPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/configuracoes/impressao?aba=observacoes"); }, [router]);
  return <p className="p-6 text-sm text-hf-text-2">As observações prontas agora ficam em Configurações → Impressão. Abrindo…</p>;
}
