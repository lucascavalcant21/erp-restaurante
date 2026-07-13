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

  return <div className="min-h-[40vh] px-4 py-8 sm:p-10 flex items-center justify-center text-center font-bold text-slate-500">Redirecionando para Rotina Operacional...</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] px-4 py-8 sm:p-10 flex items-center justify-center text-center font-bold text-slate-500">Carregando...</div>}>
      <Redirecionar />
    </Suspense>
  );
}
