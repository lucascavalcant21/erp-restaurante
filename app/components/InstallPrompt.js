"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

// Banner discreto para instalar o app. No Android/desktop usa o evento nativo
// beforeinstallprompt; no iOS (Safari não expõe o evento) mostra a dica de
// "Compartilhar > Adicionar à Tela de Início".
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visivel, setVisivel] = useState(false);
  const [ehIOS, setEhIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const jaInstalado =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (jaInstalado) return;

    if (localStorage.getItem("hefisto_install_dispensado") === "1") return;

    const onBIP = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisivel(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS: sem evento nativo — detecta Safari no iPhone/iPad e mostra a dica
    const ua = window.navigator.userAgent || "";
    const iOS = /iphone|ipad|ipod/i.test(ua);
    const ehSafari = iOS && !/crios|fxios|edgios/i.test(ua);
    if (ehSafari) { setEhIOS(true); setVisivel(true); }

    window.addEventListener("appinstalled", () => setVisivel(false));
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const instalar = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setVisivel(false);
  };

  const dispensar = () => {
    setVisivel(false);
    try { localStorage.setItem("hefisto_install_dispensado", "1"); } catch {}
  };

  if (!visivel) return null;

  return (
    <div
      style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9998 }}
      className="mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in"
    >
      <div
        className="flex items-center gap-3 p-3 rounded-2xl shadow-2xl border"
        style={{ background: "var(--card, #0f172a)", borderColor: "var(--line, #1e293b)" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-soft, rgba(5,150,105,0.15))", color: "var(--accent-strong, #059669)" }}
        >
          <Download size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color: "var(--fg, #f8fafc)" }}>
            Instalar o Hefisto
          </p>
          {ehIOS ? (
            <p className="text-[11px] font-medium leading-tight mt-0.5 flex items-center gap-1" style={{ color: "var(--muted, #94a3b8)" }}>
              Toque em <Share size={11} className="inline" /> e depois em "Adicionar à Tela de Início"
            </p>
          ) : (
            <p className="text-[11px] font-medium leading-tight mt-0.5" style={{ color: "var(--muted, #94a3b8)" }}>
              Use como app no celular, tablet ou computador
            </p>
          )}
        </div>
        {!ehIOS && (
          <button
            onClick={instalar}
            className="px-4 py-2 rounded-xl font-bold text-sm shrink-0 text-white"
            style={{ background: "var(--accent-strong, #059669)" }}
          >
            Instalar
          </button>
        )}
        <button onClick={dispensar} className="p-2 rounded-lg shrink-0" style={{ color: "var(--muted, #94a3b8)" }} aria-label="Dispensar">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
