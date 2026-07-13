"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

function Redirecionar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultaAtual = searchParams.toString();

  useEffect(() => {
    // Redireciona para a nova tela unificada de Rotina Operacional
    const params = new URLSearchParams(consultaAtual);
    const consulta = params.toString();
    router.replace(`/dashboard/operacao/rotina${consulta ? `?${consulta}` : ""}`);
  }, [consultaAtual, router]);

  return <div className="min-h-[40vh] px-4 py-8 sm:p-10 flex items-center justify-center text-center font-bold text-slate-500">Redirecionando para Rotina Operacional...</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] px-4 py-8 sm:p-10 flex items-center justify-center text-center font-bold text-slate-500">Carregando...</div>}>
      <Redirecionar />
    </Suspense>
  );
}
