"use client";

// /dashboard/inteligencia/assistente — Assistente Héfisto (conversa estilo WhatsApp).
// Mesma permissão da Central de Inteligência (prefixo /dashboard/inteligencia
// no catálogo de rotas). A pergunta pode chegar pela Central em ?q=.

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import AssistenteHefisto from "../../../components/intelligence/assistente/AssistenteHefisto";
import { origemDaUrl } from "../../../components/intelligence/assistente/origem.mjs";

function Conteudo() {
  const { unidadeAtiva, unidadeInfo } = useERP() || {};
  const params = useSearchParams();
  const router = useRouter();
  const chave = params?.toString() || "";
  // pergunta e tela de origem (Alt+H em outra página); o servidor revalida tudo
  const origem = useMemo(() => origemDaUrl(new URLSearchParams(chave)), [chave]);
  const limparPergunta = useCallback(() => {
    const p = new URLSearchParams(chave);
    p.delete("q");
    const qs = p.toString();
    router.replace(`/dashboard/inteligencia/assistente${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [chave, router]);
  if (!unidadeAtiva) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-[15px] text-hf-text-2">
        Selecione uma unidade para conversar com o Assistente Héfisto. Ele trabalha com uma unidade por vez e nunca mistura dados de empresas diferentes.
      </div>
    );
  }
  return (
    <AssistenteHefisto
      unidadeId={unidadeAtiva}
      unidadeNome={unidadeInfo?.nome || ""}
      perguntaInicial={origem.pergunta}
      tela={origem.tela}
      rotuloOrigem={origem.rotulo}
      // a pergunta sai da URL depois de enviada: recarregar a página não repete o pedido
      onPerguntaInicialEnviada={limparPergunta}
      onVoltar={() => (origem.tela ? router.push(origem.tela.rota) : router.push("/dashboard/inteligencia"))}
    />
  );
}

export default function PaginaAssistenteHefisto() {
  return (
    <div className="h-full min-h-0">
      <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm font-bold text-hf-text"><Loader2 className="mr-2 animate-spin" />Abrindo conversa…</div>}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
