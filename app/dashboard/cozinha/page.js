"use client";

import React from "react";
import CozinhaHub from "../../components/navigation/CozinhaHub";
import UniversoArea from "../../components/navigation/UniversoArea";

export default function CozinhaHubPage() {
  return (
    <UniversoArea id="cozinha">
      <section aria-label="Resumo de hoje" className="space-y-3">
        <h2 className="text-sm font-extrabold text-hf-text-2">Resumo de hoje</h2>
        <CozinhaHub embutido />
      </section>
    </UniversoArea>
  );
}
