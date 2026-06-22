"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona automaticamente para o primeiro módulo operacional (Salão)
    router.replace("/dashboard/salao/mesas");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-slate-500 font-bold">
      Entrando na Unidade...
    </div>
  );
}
