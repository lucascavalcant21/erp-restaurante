"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* "Notas e Boletos" gravava na tabela `documentos`, separada de contas_pagar:
 * o boleto lançado aqui não aparecia em Contas a Pagar, na Central nem na DRE.
 * Contas a Pagar já tem número do documento e anexo. Em produção a tabela
 * antiga tem 28 linhas pendentes sem unidade (importação antiga, 2020–2026),
 * que continuam no banco à espera da decisão do dono.
 *
 * A rota continua viva de propósito: quem tem o link salvo ou anotado não pode
 * cair numa página quebrada. Ela leva para a tela que ficou.
 */
export default function DocumentosRedirecionaContas() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/financeiro/contas"); }, [router]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-hf-accent" size={28} />
        <p className="mt-3 text-sm font-bold text-hf-text">Notas e boletos agora ficam em Contas a Pagar.</p>
        <p className="mt-1 text-xs text-hf-muted">Levando você para lá.</p>
      </div>
    </div>
  );
}
