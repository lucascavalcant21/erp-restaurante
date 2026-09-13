"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* Mesma razao da producao da cozinha: duas telas gravando a mesma operacao.
 * A que ficou trabalha com fichas, estoque e memorando.
 *
 * A rota continua viva de proposito: quem tem o link salvo ou anotado nao pode
 * cair numa pagina quebrada. Ela leva para a tela que ficou.
 */
export default function BarProducaoRedirecionaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/operacao/producao?dept=bar");
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-emerald-600" size={28} />
        <p className="mt-3 text-sm font-bold text-slate-800">A producao do bar agora fica em Producao do Dia.</p>
        <p className="mt-1 text-2xs font-bold text-slate-500">Levando voce para la.</p>
      </div>
    </div>
  );
}
