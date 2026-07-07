"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

function Redirecionar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dept = searchParams.get("dept") || "";

  useEffect(() => {
    // Redireciona para a nova tela unificada de Rotina Operacional
    router.replace("/dashboard/operacao/rotina" + (dept ? `?dept=${dept}` : ""));
  }, []);

  return <div className="p-10 font-bold text-slate-500">Redirecionando para Rotina Operacional...</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 font-bold text-slate-500">Carregando...</div>}>
      <Redirecionar />
    </Suspense>
  );
}
