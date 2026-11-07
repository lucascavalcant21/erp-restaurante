"use client";

import React from "react";
import CozinhaHub from "../../components/navigation/CozinhaHub";
import UniversoArea from "../../components/navigation/UniversoArea";

export default function CozinhaHubPage() {
  return (
    <UniversoArea id="cozinha">
      <section aria-label="Resumo de hoje" className="space-y-3">
        <h2 className="text-[13px] font-medium text-hf-muted">Resumo de hoje</h2>
        <CozinhaHub embutido />
      </section>
    </UniversoArea>
  );
}
