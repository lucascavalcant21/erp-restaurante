"use client";

// O "Modo Operação" (tablet) saiu: a tela única do estoque é simples para
// todos os autorizados (HDEV-EST-001). Endereço antigo redireciona.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TabletEstoqueAntigo() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/operacao/estoque"); }, [router]);
  return null;
}
