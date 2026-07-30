"use client";

import { useEffect } from "react";

// Tela de erro do dashboard com recuperação automática e recarregamento garantido
export default function DashboardError({ error, reset }) {
  const msg = String(error?.message || error || "").toLowerCase();
  const isChunkError = msg.includes("loading chunk") || msg.includes("chunkloaderror") || msg.includes("failed to fetch");

  // Se o erro for de carregamento de chunk (nova versão publicada na Vercel), força o reload automático imediatamente
  useEffect(() => {
    if (isChunkError) {
      const key = "hefisto_auto_chunk_reload";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 3000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }, [isChunkError]);

  const handleRecarregar = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="erp-card p-8 max-w-md w-full text-center shadow-2xl">
        <p className="text-lg font-black" style={{ color: "var(--fg)" }}>
          {isChunkError ? "🚀 Nova Atualização Disponível" : "Algo quebrou nesta tela"}
        </p>
        <p className="text-xs font-medium mt-2 break-words rounded-lg p-3" style={{ color: "var(--danger-strong)", background: "var(--danger-soft)" }}>
          {isChunkError
            ? "Uma nova versão do sistema foi lançada no servidor! Clique no botão abaixo para carregar as novidades."
            : String(error?.message || error || "Erro desconhecido")}
        </p>
        <p className="text-[11px] font-medium mt-3" style={{ color: "var(--dim)" }}>
          {isChunkError
            ? "O aplicativo será atualizado para exibir as novas categorias e recursos recém-publicados."
            : "Se o erro continuar, recarregue a página ou mande a mensagem acima para o suporte."}
        </p>
        <button onClick={handleRecarregar} className="erp-btn erp-btn-primary mt-5 w-full font-bold">
          {isChunkError ? "Atualizar Aplicativo Agora" : "Recarregar Página"}
        </button>
        <button onClick={() => { window.location.href = "/dashboard"; }} className="erp-btn erp-btn-ghost mt-2 w-full">
          Voltar ao painel
        </button>
      </div>
    </div>
  );
}
