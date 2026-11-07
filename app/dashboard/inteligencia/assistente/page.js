"use client";

// /dashboard/inteligencia/assistente — Assistente Efto (conversa estilo WhatsApp).
// Mesma permissão da Central de Inteligência (prefixo /dashboard/inteligencia
// no catálogo de rotas). A pergunta pode chegar pela Central em ?q=.

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import AssistenteEfto from "../../../components/intelligence/efto/AssistenteEfto";

function Conteudo() {
  const { unidadeAtiva, unidadeInfo } = useERP() || {};
  const params = useSearchParams();
  const router = useRouter();
  const q = params?.get("q") || null;
  if (!unidadeAtiva) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-[15px] text-hf-text-2">
        Selecione uma unidade para conversar com o Assistente Efto. Ele trabalha com uma unidade por vez e nunca mistura dados de empresas diferentes.
      </div>
    );
  }
  return (
    <AssistenteEfto
      unidadeId={unidadeAtiva}
      unidadeNome={unidadeInfo?.nome || ""}
      perguntaInicial={q ? q.slice(0, 500) : null}
      onVoltar={() => router.push("/dashboard/inteligencia")}
    />
  );
}

export default function PaginaAssistenteEfto() {
  return (
    <div className="h-full min-h-0">
      <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm font-bold text-hf-text"><Loader2 className="mr-2 animate-spin" />Abrindo conversa…</div>}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
