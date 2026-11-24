"use client";

// Cozinha: o resumo de hoje (atenção, produção, estoque crítico, checklists)
// fica recolhido embaixo dos cards; o funcionário abre se quiser (24/11/2026).

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import CozinhaHub from "../../components/navigation/CozinhaHub";
import UniversoArea from "../../components/navigation/UniversoArea";

export default function CozinhaHubPage() {
  const [aberto, setAberto] = useState(false);
  return (
    <UniversoArea id="cozinha">
      <section aria-label="Resumo de hoje" className="space-y-3">
        <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
          className="flex min-h-[44px] w-full items-center justify-between rounded-[18px] border border-mw-borda bg-mw-card px-4 text-[15px] font-medium text-mw-texto shadow-none">
          Resumo de hoje (produção, estoque crítico, checklists)
          <ChevronDown size={18} className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
        {aberto && <CozinhaHub embutido />}
      </section>
    </UniversoArea>
  );
}
