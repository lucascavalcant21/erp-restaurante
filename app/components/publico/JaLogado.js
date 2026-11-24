"use client";

// Quem já está logado neste aparelho e abre a página inicial ("/") vai direto
// para o sistema (o login leva cada pessoa à sua tela). Antes parecia que o
// sistema tinha deslogado (dono, 24/11/2026, B-049). Só lê se existe a sessão
// guardada pelo Supabase; quem valida é o login.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function temSessaoGuardada(armazem) {
  try {
    for (let i = 0; i < (armazem?.length || 0); i += 1) {
      const k = armazem.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token") && armazem.getItem(k)) return true;
    }
  } catch (_) {}
  return false;
}

export default function JaLogado() {
  const router = useRouter();
  useEffect(() => {
    let sair = false;
    try { sair = new URLSearchParams(window.location.search).has("inicio"); } catch (_) {}
    if (!sair && temSessaoGuardada(window.localStorage)) router.replace("/login");
  }, [router]);
  return null;
}
