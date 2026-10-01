"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* Vendas e Recebimentos foi substituída por Contas a Receber (F2.3).
 * A versão antiga gravava colunas que não existem no banco (ex.: valor_liquido), usava
 * uma unidade falsa quando faltava cadastro e listava vendas sem filtrar unidade.
 * Mantê-la exibiria números incompatíveis com a F2.3.
 * A rota continua viva para quem tem o link salvo: leva para a tela nova.
 */
export default function RedirecionaContasReceber() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/financeiro/receber"); }, [router]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-success" size={28} />
        <p className="mt-3 text-sm font-bold text-slate-800">Vendas e Recebimentos agora fica em Contas a Receber.</p>
        <p className="mt-1 text-2xs font-bold text-fg">Levando você para lá.</p>
      </div>
    </div>
  );
}
