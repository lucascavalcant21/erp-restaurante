"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* Esta tela era um passo a mais para escolher entre Bar, Cozinha e Cervejas.
 * O menu lateral e o hub de modulos ja fazem isso direto, sem a parada no meio.
 *
 * A rota continua viva de proposito: quem tem o link salvo ou anotado nao pode
 * cair numa pagina quebrada. Ela leva para a tela que ficou.
 */
export default function DepartamentosRedirecionaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-emerald-600" size={28} />
        <p className="mt-3 text-sm font-bold text-slate-800">A escolha de departamento agora esta no proprio menu.</p>
        <p className="mt-1 text-2xs font-bold text-slate-500">Levando voce para la.</p>
      </div>
    </div>
  );
}
