"use client";

// Instalar o Héfisto no aparelho: usa o instalador do navegador quando existe;
// senão, mostra só o caminho do aparelho que está aberto.

import { useEffect, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { Painel, Bloco } from "./ui";

export default function Instalar({ onVoltar }) {
  const [instalado, setInstalado] = useState(false);
  const [temPrompt, setTemPrompt] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try {
      setInstalado(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
      setIos(/iPhone|iPad|iPod/i.test(window.navigator.userAgent));
      const ver = () => setTemPrompt(!!window.__hefistoInstallPrompt);
      ver();
      const t = setInterval(ver, 1500);
      return () => clearInterval(t);
    } catch { return undefined; }
  }, []);

  const instalar = async () => {
    const p = window.__hefistoInstallPrompt;
    if (!p) return;
    try { p.prompt(); await p.userChoice; window.__hefistoInstallPrompt = null; setTemPrompt(false); } catch { /* recusado */ }
  };

  return (
    <Painel titulo="Instalar o app" descricao="Instalado, o Héfisto abre em tela cheia, sem a barra do navegador. O ponto e as estações funcionam como quiosque." onVoltar={onVoltar}>
      {instalado ? (
        <Bloco><p className="flex items-center gap-2 text-[15px] font-medium text-hf-success"><CheckCircle2 size={18} /> Você já está usando o app instalado.</p></Bloco>
      ) : temPrompt ? (
        <button type="button" onClick={instalar} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-hf-menu text-[15px] font-semibold text-white"><Download size={18} /> Instalar agora</button>
      ) : (
        <Bloco titulo={ios ? "No iPhone / iPad (Safari)" : "No Android (Chrome)"}>
          <p className="text-[15px] text-hf-text">{ios
            ? <>Toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.</>
            : <>Toque no menu <b>⋮</b> (canto de cima) e depois em <b>Instalar app</b>.</>}</p>
          <p className="text-[13px] text-hf-muted">Já tinha instalado e o app mudou? Apague o ícone e instale de novo.</p>
        </Bloco>
      )}
    </Painel>
  );
}
