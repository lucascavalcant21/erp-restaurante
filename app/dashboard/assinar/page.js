"use client";

// CHECKOUT — para onde leva todo cadeado do plano Grátis (decisão do dono,
// 14/11/2026: "para acessar isso aqui tem que pagar; aí já vai para a página
// de checkout"). ?de= diz qual tela a pessoa tentou abrir.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PaginaAssinatura from "../../components/planos/PaginaAssinatura";

function Conteudo() {
  const de = useSearchParams().get("de");
  return <PaginaAssinatura checkout de={de && de.startsWith("/dashboard") ? de : null} />;
}

export default function CheckoutPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
