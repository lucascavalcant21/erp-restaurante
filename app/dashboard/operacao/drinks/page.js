"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// A antiga tela de drinks mantinha um cadastro separado das fichas técnicas.
// Todo o Bar agora vive no receituário integrado, evitando dados duplicados.
export default function DrinksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/operacao/fichas?dept=bar");
  }, [router]);

  return (
    <div className="flex min-h-[45vh] items-center justify-center px-4 text-sm font-bold text-slate-500">
      Abrindo as fichas integradas do Bar...
    </div>
  );
}
