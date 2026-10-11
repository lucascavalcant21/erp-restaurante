"use client";

// Tablet antigo (Cozinha): a movimentação do estoque é uma tela só
// (/dashboard/operacao/estoque, HDEV-EST-001). Abre já na área cozinha.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TabletAntigo() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/operacao/estoque?area=cozinha"); }, [router]);
  return null;
}
