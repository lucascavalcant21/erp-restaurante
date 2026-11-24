"use client";

// /dashboard/inteligencia/assistente — Assistente Héfisto (conversa estilo WhatsApp).
// Mesma permissão da Central de Inteligência (prefixo /dashboard/inteligencia
// no catálogo de rotas). A pergunta pode chegar pela Central em ?q=.

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import AssistenteHefisto from "../../../components/intelligence/assistente/AssistenteHefisto";
import { origemDaUrl } from "../../../components/intelligence/assistente/origem.mjs";

function Conteudo() {
  const { unidadeAtiva, unidadeInfo, unidades, setUnidadeAtiva, erroUnidades } = useERP() || {};
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
    // Sem unidade: nunca uma tela sem saída (dono, 17/11/2026: "não consigo sair
    // ou voltar"). Voltar, as unidades do login como botões, e o texto abaixo da
    // barra do iPhone (safe-area).
    const lista = (unidades || []).filter((u) => u.ativo !== false);
    return (
      <div className="mx-auto max-w-md px-4 pb-10" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard"))}
          className="mb-4 inline-flex min-h-[48px] items-center gap-2 rounded-full border border-mw-borda bg-mw-card px-4 text-[15px] font-semibold text-mw-marinho">
          <ArrowLeft size={18} /> Voltar
        </button>
        {!lista.length && !erroUnidades ? (
          <p className="flex items-center text-[15px] text-hf-text-2"><Loader2 size={16} className="mr-2 animate-spin" /> Abrindo sua unidade…</p>
        ) : (
          <>
            <p className="text-[15px] text-hf-text-2">Escolha a unidade para conversar. O assistente trabalha com uma unidade por vez e nunca mistura dados de empresas diferentes.</p>
            {erroUnidades && <p className="mt-2 text-[14px] text-hf-danger">{erroUnidades}</p>}
            <div className="mt-4 grid gap-2">
              {lista.map((u) => (
                <button key={u.id} type="button" onClick={() => setUnidadeAtiva(u.id)}
                  className="flex min-h-[56px] items-center rounded-2xl border border-mw-borda bg-mw-card px-4 text-left text-[16px] font-semibold text-mw-marinho active:scale-[0.99]">
                  {u.nome}
                </button>
              ))}
            </div>
          </>
        )}
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
