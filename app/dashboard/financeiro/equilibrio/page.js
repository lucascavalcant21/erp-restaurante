"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* O Ponto de Equilíbrio virou parte da Pizza do Lucro.
 *
 * As duas telas calculavam a mesma coisa de dois jeitos: custo fixo por dia,
 * rateio por prato e a divisão da venda em fatias. Duas contas do mesmo número
 * no mesmo sistema acabam divergindo, e aí o dono não sabe em qual acreditar.
 *
 * A rota continua viva de propósito: quem tem o link salvo ou anotado não pode
 * cair numa página quebrada. Ela leva para a tela nova, onde o equilíbrio está
 * na aba "Custo por dia".
 */
export default function EquilibrioRedirecionaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/financeiro/pizza");
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-success" size={28} />
        <p className="mt-3 text-sm font-black text-slate-800">O Ponto de Equilíbrio agora fica na Pizza do Lucro.</p>
        <p className="mt-1 text-xs font-bold text-muted">Levando você para lá — o equilíbrio está na aba “Custo por dia”.</p>
      </div>
    </div>
  );
}
