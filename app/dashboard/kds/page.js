"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* Havia dois KDS. Este consultava o Supabase direto; o que ficou usa a
 * lib/kds — a mesma que a tela de Delivery consome — e atualiza em tempo real.
 *
 * A rota continua viva de proposito: quem tem o link salvo ou anotado nao pode
 * cair numa pagina quebrada. Ela leva para a tela que ficou.
 */
export default function KdsRedirecionaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/cozinha/kds");
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-success" size={28} />
        <p className="mt-3 text-sm font-bold text-slate-800">O KDS agora fica em KDS da Cozinha.</p>
        <p className="mt-1 text-2xs font-bold text-muted">Levando voce para la.</p>
      </div>
    </div>
  );
}
