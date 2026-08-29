"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

// SHA do build que ESTA janela carregou. Fica congelado no bundle: é o mesmo
// número que o selo do cabeçalho mostra.
const SHA_LOCAL = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "";

/* Aviso de versão nova.
 *
 * O app instalado fica dias com a mesma janela aberta e só procura atualização
 * quando a página carrega. O resultado é o pior tipo de silêncio: a correção
 * sobe, o deploy termina, e a tela continua mostrando o número errado — sem
 * nada que diga que existe algo mais novo do outro lado. Descobrir isso pelo
 * bug que deveria ter sumido custa caro.
 *
 * Aqui o app pergunta ao servidor qual commit está publicado (ao abrir, a cada
 * 5 minutos e sempre que a janela volta ao foco) e avisa quando difere do que
 * carregou. Atualizar é um clique.
 */
export default function AvisoNovaVersao() {
  const [shaPublicado, setShaPublicado] = useState(null);
  const [dispensado, setDispensado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    // Sem SHA no build (ambiente local) não há com o que comparar.
    if (!SHA_LOCAL) return;
    let cancelado = false;

    const conferir = async () => {
      try {
        const res = await fetch("/api/versao", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = await res.json();
        if (cancelado || !sha || sha === "dev" || sha === SHA_LOCAL) return;
        setShaPublicado(sha);
      } catch {
        // Sem rede não é hora de avisar nada: o app offline continua o dele.
      }
    };

    conferir();
    const timer = setInterval(conferir, 5 * 60 * 1000);
    const aoVoltarAoFoco = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltarAoFoco);
    window.addEventListener("focus", aoVoltarAoFoco);

    return () => {
      cancelado = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltarAoFoco);
      window.removeEventListener("focus", aoVoltarAoFoco);
    };
  }, []);

  const atualizar = async () => {
    setAtualizando(true);
    // O service worker guarda o shell da versão antiga. Sem limpar, o reload
    // pode trazer de volta exatamente o que estamos substituindo.
    try {
      if (typeof caches !== "undefined") {
        const chaves = await caches.keys();
        await Promise.all(chaves.map(chave => caches.delete(chave)));
      }
    } catch { /* cache indisponível não impede o reload */ }
    try {
      const registros = await navigator.serviceWorker?.getRegistrations?.() || [];
      await Promise.all(registros.map(reg => reg.update().catch(() => {})));
    } catch { /* idem */ }
    window.location.reload();
  };

  if (!shaPublicado || dispensado) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-[100] flex justify-center px-3 sm:bottom-6">
      <div className="flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 py-2.5 pl-4 pr-2.5 shadow-2xl">
        <span className="min-w-0 text-sm font-bold text-white">
          Nova versão disponível
          <span className="ml-2 hidden font-mono text-[10px] font-bold text-slate-400 sm:inline">
            {shaPublicado.slice(0, 7)}
          </span>
        </span>
        <button
          type="button"
          onClick={atualizar}
          disabled={atualizando}
          className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-sm font-black text-white hover:bg-emerald-400 disabled:opacity-60"
        >
          <RefreshCw size={15} className={atualizando ? "animate-spin" : ""} />
          {atualizando ? "Atualizando..." : "Atualizar"}
        </button>
        <button
          type="button"
          onClick={() => setDispensado(true)}
          title="Agora não"
          aria-label="Dispensar aviso de nova versão"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
