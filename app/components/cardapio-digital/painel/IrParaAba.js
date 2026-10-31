"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* O painel do Cardápio virou uma tela só (dono, 30/10/2026: "tudo em uma
 * mesma tela"). Os endereços antigos de Produtos, Promoções e Fidelidade
 * continuam vivos para quem tem o link salvo: levam para a aba certa. */
export default function IrParaAba({ aba }) {
  const router = useRouter();
  useEffect(() => { router.replace(`/dashboard/operacao/cardapio?aba=${aba}`); }, [router, aba]);
  return <p style={{ padding: 24 }}>Abrindo o Cardápio…</p>;
}
