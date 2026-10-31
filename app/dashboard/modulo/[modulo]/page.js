"use client";

// Os antigos painéis /dashboard/modulo/<área> repetiam telas com uma lista
// própria, diferente do menu (pedido do dono, 31/10/2026: "é uma tela que não
// está no meu menu"). Agora abrem a página da área no menu principal.

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { destinoDoPainelAntigo } from "../../../lib/menu-principal.mjs";

export default function ModuloPage() {
  const params = useParams();
  const router = useRouter();
  const destino = destinoDoPainelAntigo(params?.modulo);
  useEffect(() => { router.replace(destino); }, [destino, router]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm font-bold text-hf-text-2">
      <Loader2 className="animate-spin text-hf-accent mr-2" size={18} /> Abrindo…
    </div>
  );
}
