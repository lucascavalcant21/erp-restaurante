"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* Existiam duas telas de producao no sistema, com interfaces diferentes
 * gravando na MESMA operacao (registrarProducao). Esta rodava sobre cardapio e
 * drinks; a que ficou trabalha com as fichas tecnicas, desconta o estoque e le
 * o memorando do dia — e e a que esta no menu.
 *
 * A rota continua viva de proposito: quem tem o link salvo ou anotado nao pode
 * cair numa pagina quebrada. Ela leva para a tela que ficou.
 */
export default function CozinhaProducaoRedirecionaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/operacao/producao?dept=cozinha");
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-emerald-600" size={28} />
        <p className="mt-3 text-sm font-bold text-slate-800">A producao da cozinha agora fica em Producao do Dia.</p>
        <p className="mt-1 text-2xs font-bold text-slate-500">Levando voce para la.</p>
      </div>
    </div>
  );
}
