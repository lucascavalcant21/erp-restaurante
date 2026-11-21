"use client";

// Consultório (dono, 21/11/2026): agenda, atendimento, pacientes, preço e
// lucro da consulta. Unidade própria ("consultorio"); dado de saúde protegido
// no banco (CONS-1).

import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Stethoscope, TrendingUp, Users } from "lucide-react";
import CabecalhoTela from "../../components/ui/CabecalhoTela";
import { BarraDeAreas } from "../../components/gerencial/PainelGerencial";
import { ConsultorioProvider, useConsultorio } from "../../components/consultorio/contexto";
import { Aviso } from "../../components/marmitaria/ui";

const BASE = "/dashboard/consultorio";
const AREAS = [
  { href: BASE, rotulo: "Agenda", curto: "Agenda", icone: CalendarDays, exato: true },
  { href: `${BASE}/atendimento`, rotulo: "Atendimento", curto: "Atender", icone: Stethoscope },
  { href: `${BASE}/pacientes`, rotulo: "Pacientes", curto: "Pacientes", icone: Users },
  { href: `${BASE}/financeiro`, rotulo: "Preço e lucro", curto: "Lucro", icone: TrendingUp },
  { href: `${BASE}/cadastros`, rotulo: "Consultas e convênios", curto: "Cadastros", icone: ClipboardList },
];

function Conteudo({ children }) {
  const pathname = usePathname() || "";
  const { carregando, acesso, erro } = useConsultorio();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-3 sm:px-6 lg:px-8">
      <CabecalhoTela embutido titulo="Consultório" subtitulo="Agenda, atendimento, pacientes e o lucro de cada consulta" />
      <BarraDeAreas rotulo="Áreas do consultório" areas={AREAS}
        ativa={(a) => (a.exato ? pathname === a.href : pathname === a.href || pathname.startsWith(`${a.href}/`))} />
      {carregando ? <p className="py-10 text-center text-sm text-hf-muted">Abrindo o consultório…</p>
        : acesso === false ? <Aviso tipo="alerta">{erro || "Você não tem acesso ao consultório. Os dados de pacientes ficam só com o médico e a equipe do consultório."}</Aviso>
        : <>{erro && <Aviso tipo="alerta" className="mb-3">Parte dos dados não carregou: {erro}</Aviso>}{children}</>}
    </div>
  );
}

export default function ConsultorioLayout({ children }) {
  return (
    <ConsultorioProvider>
      <div className="min-h-full bg-hf-bg"><Conteudo>{children}</Conteudo></div>
    </ConsultorioProvider>
  );
}
