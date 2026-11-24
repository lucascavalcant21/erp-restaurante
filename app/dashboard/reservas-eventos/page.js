"use client";

// Entrada do menu "Eventos": o Início no modelo do Delivery (dono, 24/11/2026).
// Quem não pode abrir o funil (/eventos) vê o funil aqui mesmo, como antes.

import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import EventosKanban from "./eventos/EventosKanban";
import InicioEventos from "./InicioEventos";

export default function ReservasEventosOverview() {
  const { sessao } = useERP();
  const podeFunil = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/reservas-eventos/eventos");
  return podeFunil ? <InicioEventos /> : <EventosKanban />;
}
