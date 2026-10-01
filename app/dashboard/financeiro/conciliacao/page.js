"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* A Conciliação foi substituída por Contas a Receber (F2.3).
 * A versão antiga dependia de tabelas e de uma RPC que não existem em produção
 * (contas_receber, conciliar_recebivel_banco) e de uma unidade falsa.
 * A rota continua viva para quem tem o link salvo: leva para a tela nova.
 */
export default function RedirecionaContasReceber() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/financeiro/receber"); }, [router]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-success" size={28} />
        <p className="mt-3 text-sm font-bold text-slate-800">A Conciliação agora fica em Contas a Receber.</p>
        <p className="mt-1 text-2xs font-bold text-fg">Levando você para lá.</p>
      </div>
    </div>
  );
}
