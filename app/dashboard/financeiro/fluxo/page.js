"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* O "Fluxo de caixa realizado & projetado" antigo lia e gravava na tabela
 * `lancamentos`, que nenhuma outra tela lê (Central, Caixa e DRE usam
 * fin_pagamentos e fin_recebimentos), e procurava `contas_financeiras`, que não
 * existe no banco (a real é fin_contas_financeiras). Uma "Nova Receita" lançada
 * aqui sumia de todo o resto. Em produção a tabela antiga tem 1 linha (venda
 * de balcão de 01/07/2026); nada foi apagado.
 *
 * A rota continua viva de propósito: quem tem o link salvo ou anotado não pode
 * cair numa página quebrada. Ela leva para a tela que ficou.
 */
export default function FluxoRedirecionaCaixa() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/financeiro/caixa"); }, [router]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-hf-accent" size={28} />
        <p className="mt-3 text-sm font-bold text-hf-text">O fluxo de caixa agora fica em Caixa e Contas.</p>
        <p className="mt-1 text-xs text-hf-muted">Levando você para lá.</p>
      </div>
    </div>
  );
}
