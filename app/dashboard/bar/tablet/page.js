"use client";

// Tablet antigo (Bar): a movimentação do estoque é uma tela só
// (/dashboard/operacao/estoque, HDEV-EST-001). Abre já na área bar.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TabletAntigo() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/operacao/estoque?area=bar"); }, [router]);
  return null;
}
