"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* ATENCAO ao motivo, que era um defeito de verdade: esta tela gravava na
 * tabela `custos_fixos` e o painel da Pizza do Lucro grava em
 * `config_sistema.params`. Dois cadastros do MESMO numero, sem se falarem —
 * dava para ter aluguel de R$ 6.000 num e R$ 8.000 no outro, com cada tela
 * mostrando um resultado diferente. Agora ha um lugar so.
 *
 * A rota continua viva de proposito: quem tem o link salvo ou anotado nao pode
 * cair numa pagina quebrada. Ela leva para a tela que ficou.
 */
export default function CustosFixosRedirecionaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/financeiro/pizza");
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-emerald-600" size={28} />
        <p className="mt-3 text-sm font-bold text-slate-800">O custo fixo do mes agora fica na Pizza do Lucro.</p>
        <p className="mt-1 text-2xs font-bold text-slate-500">Levando voce para la.</p>
      </div>
    </div>
  );
}
