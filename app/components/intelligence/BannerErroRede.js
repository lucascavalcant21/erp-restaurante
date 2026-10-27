"use client";

import { memo } from "react";
import { AlertTriangle, WifiOff, RefreshCw, X } from "lucide-react";

/**
 * Componente reutilizável para exibir falhas de rede, timeouts ou erros de API
 * com opção clara de nova tentativa (retry) e feedback de carregamento.
 */
const BannerErroRede = memo(function BannerErroRede({
  mensagem,
  codigo = null,
  onTentarNovamente,
  carregando = false,
  onFechar,
  compacto = false,
}) {
  if (!mensagem) return null;
  const semRede = codigo === "SEM_REDE" || codigo === "FALHA_REDE" || codigo === "TIMEOUT";
  const Icone = semRede ? WifiOff : AlertTriangle;

  return (
    <div
      role="alert"
      className={`hf-animate-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/95 text-hf-text shadow-sm ${
        compacto ? "px-3.5 py-2.5 text-[13px]" : "p-4 sm:p-5 text-[14px]"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-hf-warning">
          <Icone size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-hf-text">{mensagem}</p>
          {semRede && !compacto && (
            <p className="mt-0.5 text-[12px] font-medium text-hf-text-2">
              Seus dados continuam seguros. Assim que a conexão estabilizar, atualize para sincronizar.
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onTentarNovamente && (
          <button
            type="button"
            onClick={onTentarNovamente}
            disabled={carregando}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-amber-400/60 bg-hf-surface px-3.5 py-1.5 text-[13px] font-bold text-hf-text shadow-xs transition hover:border-hf-accent hover:text-hf-accent disabled:opacity-50"
          >
            <RefreshCw size={14} className={carregando ? "animate-spin" : ""} aria-hidden="true" />
            {carregando ? "Reconectando…" : "Tentar novamente"}
          </button>
        )}
        {onFechar && (
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar aviso"
            className="grid h-9 w-9 place-items-center rounded-xl text-hf-text-2 transition hover:bg-amber-200/40 hover:text-hf-text"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
});

export default BannerErroRede;
