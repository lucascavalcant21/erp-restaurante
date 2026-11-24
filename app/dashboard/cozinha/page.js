"use client";

// Cozinha: o resumo de hoje (atenção, produção, estoque crítico, checklists)
// fica recolhido embaixo dos cards; o funcionário abre se quiser (24/11/2026).

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import CozinhaHub from "../../components/navigation/CozinhaHub";
import UniversoArea from "../../components/navigation/UniversoArea";
import { useERP } from "../../context/ERPContext";
import { usePermission } from "../../components/access-control/PermissionGate";
import { useEquipamentos } from "../../lib/equipamentos-dados";
import { avisosEquipamentos } from "../../lib/equipamentos.mjs";
import { AvisosEquipamentos } from "../../components/equipamentos/Partes";

// Avisos da fritadeira e da coifa no alto da Cozinha (dono, 24/11/2026: "amanhã é dia de limpar a fritadeira…").
function AvisosDaCozinha() {
  const { unidadeAtiva } = useERP();
  const api = useEquipamentos(unidadeAtiva);
  const avisos = avisosEquipamentos(api.equipamentos, { insumos: api.insumos, saldos: api.saldos });
  return avisos.length ? <AvisosEquipamentos avisos={avisos} compacto /> : null;
}

export default function CozinhaHubPage() {
  const [aberto, setAberto] = useState(false);
  const veEquipamentos = usePermission("cozinha.equipment.view");
  return (
    <UniversoArea id="cozinha">
      {veEquipamentos && <AvisosDaCozinha />}
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
