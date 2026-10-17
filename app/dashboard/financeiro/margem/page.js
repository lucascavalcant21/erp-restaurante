"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* A tela "Lucro" calculava a margem pela tabela `cardapio`, que está vazia
 * em produção (o cardápio de verdade são produtos + fichas técnicas): mostrava
 * sempre "Sem dados de margem". A Pizza do Lucro calcula a margem de cada
 * prato com as fichas, o CMO e as despesas.
 *
 * A rota continua viva de propósito: quem tem o link salvo ou anotado não pode
 * cair numa página quebrada. Ela leva para a tela que ficou.
 */
export default function MargemRedirecionaPizza() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/financeiro/pizza"); }, [router]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-hf-accent" size={28} />
        <p className="mt-3 text-sm font-bold text-hf-text">A margem por prato agora fica na Pizza do Lucro.</p>
        <p className="mt-1 text-xs text-hf-muted">Levando você para lá.</p>
      </div>
    </div>
  );
}
